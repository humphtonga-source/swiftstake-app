// ── AUDIT TRAIL ──
// Every push, edit, and submission is recorded here.
// Records: who, when, shop, section, action, before-value, after-value.

const AuditLog = (() => {
  // In-memory cache so we can show the log without an extra DB round-trip
  let _cache = [];
  let _loaded = false;

  // Snapshot helpers — produce a compact, human-readable "before" or "after" string
  function snapGame(gd) {
    if (!gd) return 'none';
    const tops = (gd.topups || []).reduce((s, t) => s + N(t.amount), 0);
    return `open:${N(gd.open)} topups:${tops} close:${N(gd.close)}`;
  }

  function snapExpenses(exps) {
    if (!Array.isArray(exps) || !exps.length) return 'none';
    return exps.map(e => `${e.desc || '?'}=KES${N(e.amount)}`).join(', ');
  }

  function snapRecon(r) {
    if (!r) return 'none';
    return `opening:${N(r.opening)} cash:${N(r.cash)} mpesa:${N(r.mpesa)} diff:${N(r.diff)}`;
  }

  function snapCashMovements(movs) {
    if (!Array.isArray(movs) || !movs.length) return 'none';
    return movs.map(m => `${m.amount > 0 ? '+' : ''}${N(m.amount)} ${m.type} by ${m.by}`).join(', ');
  }

  // Build a before/after snapshot for any section from shopData
  function snapshotSection(section, shopData) {
    if (!shopData) return 'no data';
    if (section === 'opening') {
      return `cash:${N(shopData.openingCash)} openedAt:${shopData.openedAt || 'not set'}`;
    }
    if (section === 'expenses') {
      return snapExpenses(shopData.expenses);
    }
    if (section === 'recon') {
      return snapRecon(shopData.cashRecon);
    }
    if (section === 'cashMovements') {
      return snapCashMovements(shopData.cashMovements);
    }
    if (section.startsWith('game:')) {
      const g = section.split(':')[1];
      return snapGame(shopData.games && shopData.games[g]);
    }
    // Full state snapshot (for saveShopState calls)
    return `openingCash:${N(shopData.openingCash)} expenses:${(shopData.expenses || []).length}`;
  }

  // Core write: insert one audit record into Supabase + local cache
  async function _write(entry) {
    _cache.unshift(entry);
    if (_cache.length > 200) _cache.pop();

    try {
      await db.from('audit_log').insert({
        ts:         entry.ts,
        actor_name: entry.actor,
        shop:       entry.shop,
        section:    entry.section,
        action:     entry.action,
        before_val: entry.before,
        after_val:  entry.after
      });
    } catch (e) {
      // Audit failures are silent — never block the main operation
      logError('AuditLog._write', e, entry);
    }
  }

  // Public API
  return {
    // Call BEFORE mutating data, pass the old snapshot; call record() after
    snapshot(section, shopData) {
      return snapshotSection(section, shopData);
    },

    // Record a change
    async record(action, shop, section, before, after) {
      const entry = {
        ts:      new Date().toISOString(),
        actor:   (sess && sess.name) ? sess.name : 'unknown',
        shop,
        section,
        action,
        before,
        after
      };
      await _write(entry);
    },

    // Load recent audit log from DB (admin only)
    async load(limit = 150) {
      try {
        const { data, error } = await db
          .from('audit_log')
          .select('*')
          .order('ts', { ascending: false })
          .limit(limit);
        if (error) throw error;
        if (data) {
          _cache = data.map(r => ({
            ts:      r.ts,
            actor:   r.actor_name,
            shop:    r.shop,
            section: r.section,
            action:  r.action,
            before:  r.before_val,
            after:   r.after_val
          }));
          _loaded = true;
        }
      } catch (e) {
        logError('AuditLog.load', e);
      }
      return _cache;
    },

    get cache() { return _cache; },
    get loaded() { return _loaded; }
  };
})();

// ── AUDIT LOG VIEWER (Admin only) ──
async function renderAuditLog() {
  const container = $('audit-log-container');
  if (!container) return;

  if (!sess.isAdmin) {
    container.innerHTML = '<div class="ibar" style="color:var(--txt2);">Audit log visible to admins only.</div>';
    return;
  }

  container.innerHTML = '<div style="font-size:12px;color:var(--txt3);padding:8px 0;">⏳ Loading audit log…</div>';

  const entries = await AuditLog.load(200);

  if (!entries.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--txt3);padding:8px 0;">No audit entries yet.</div>';
    return;
  }

  // Filter controls
  const shops  = [...new Set(entries.map(e => e.shop).filter(Boolean))];
  const actors = [...new Set(entries.map(e => e.actor).filter(Boolean))];

  let html = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <select id="audit-filter-shop" onchange="filterAuditLog()"
        style="padding:6px 10px;border:1px solid var(--border2);border-radius:var(--radius2);background:var(--bg2);color:var(--txt);font-size:12px;">
        <option value="">All shops</option>
        ${shops.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select id="audit-filter-actor" onchange="filterAuditLog()"
        style="padding:6px 10px;border:1px solid var(--border2);border-radius:var(--radius2);background:var(--bg2);color:var(--txt);font-size:12px;">
        <option value="">All staff</option>
        ${actors.map(a => `<option value="${a}">${a}</option>`).join('')}
      </select>
      <select id="audit-filter-action" onchange="filterAuditLog()"
        style="padding:6px 10px;border:1px solid var(--border2);border-radius:var(--radius2);background:var(--bg2);color:var(--txt);font-size:12px;">
        <option value="">All actions</option>
        <option value="push">Push</option>
        <option value="submit">Submit</option>
        <option value="edit">Edit</option>
        <option value="add">Add</option>
        <option value="remove">Remove</option>
      </select>
    </div>
    <div id="audit-entries">`;

  html += _buildAuditEntries(entries) + '</div>';
  container.innerHTML = html;

  // Store for filter re-use
  window._auditEntries = entries;
}

function _buildAuditEntries(entries) {
  if (!entries.length) return '<div style="font-size:12px;color:var(--txt3);">No matching entries.</div>';

  const actionColor = {
    push:   'var(--blue)',
    submit: 'var(--green)',
    edit:   'var(--gold)',
    add:    'var(--green)',
    remove: 'var(--red)',
    delete: 'var(--red)'
  };

  return entries.map(e => {
    const dt   = new Date(e.ts);
    const date = dt.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    const time = dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const col  = actionColor[e.action] || 'var(--txt2)';

    const hasDiff = e.before && e.after && e.before !== e.after && e.before !== 'no data';

    return `<div style="border:1px solid var(--border);border-radius:var(--radius2);padding:10px 12px;margin-bottom:8px;background:var(--bg2);">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:${hasDiff ? 6 : 0}px;">
        <span style="font-size:11px;font-weight:800;color:${col};text-transform:uppercase;letter-spacing:.5px;">${e.action}</span>
        <span style="font-size:12px;font-weight:700;color:var(--txt);">${e.section}</span>
        <span style="font-size:11px;color:var(--txt3);">·</span>
        <span style="font-size:12px;color:var(--txt2);">🏪 ${e.shop || '—'}</span>
        <span style="font-size:11px;color:var(--txt3);">·</span>
        <span style="font-size:12px;color:var(--txt2);">👤 ${e.actor || '—'}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--txt3);">${date} ${time}</span>
      </div>
      ${hasDiff ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;">
        <div style="background:var(--redl);border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:6px 8px;">
          <div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:3px;">Before</div>
          <div style="font-size:11px;color:var(--txt2);word-break:break-word;">${e.before}</div>
        </div>
        <div style="background:var(--greenl);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:6px 8px;">
          <div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:3px;">After</div>
          <div style="font-size:11px;color:var(--txt2);word-break:break-word;">${e.after}</div>
        </div>
      </div>` : (e.after ? `<div style="font-size:11px;color:var(--txt3);margin-top:4px;">${e.after}</div>` : '')}
    </div>`;
  }).join('');
}

function filterAuditLog() {
  const entries = window._auditEntries || [];
  const shop   = ($('audit-filter-shop')   || {}).value || '';
  const actor  = ($('audit-filter-actor')  || {}).value || '';
  const action = ($('audit-filter-action') || {}).value || '';

  const filtered = entries.filter(e =>
    (!shop   || e.shop   === shop)   &&
    (!actor  || e.actor  === actor)  &&
    (!action || e.action === action)
  );

  const el = $('audit-entries');
  if (el) el.innerHTML = _buildAuditEntries(filtered);
}
