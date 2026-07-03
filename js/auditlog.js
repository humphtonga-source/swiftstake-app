// ── AUDIT LOG VIEWER (admin only) ──
let _auditPage = 0;
let _auditFilters = {shop: '', q: ''};
const AUDIT_PAGE_SIZE = 50;

const AUDIT_ACTION_ICON = {
  submit: '✅', deposit: '📱', confirm: '💳', withdraw: '💸',
  reset: '🔄', remove: '🗑️', update: '✏️', add: '➕'
};

function renderAuditLog() {
  const p = $('pane-auditlog'); if (!p) return;
  p.innerHTML = `
  <div class="ph"><div class="ph-icon">📜</div><h2>Audit Log</h2></div>
  <div class="ibar">Every action taken across every shop, permanent and unfiltered by the app itself. This is the real record.</div>
  <div class="card" style="margin-bottom:14px;">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:0;">
      <select id="audit-shop-filter" onchange="applyAuditFilter()" style="flex:1;min-width:120px;background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:6px;padding:8px;font-size:13px;">
        <option value="">All shops</option>
        ${SHOPS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input id="audit-search" type="text" placeholder="Search person, action, details..." oninput="debounceAuditSearch()" style="flex:2;min-width:160px;background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:6px;padding:8px;font-size:13px;">
    </div>
  </div>
  <div id="audit-list"></div>
  <button id="audit-more-btn" class="sbtn" style="width:100%;margin-top:10px;" onclick="loadMoreAudit()">Load more</button>
  <div id="audit-empty" style="display:none;text-align:center;padding:24px;color:var(--txt3);font-size:13px;">No matching entries.</div>
  `;
  _auditPage = 0;
  loadAuditPage(true);
}

let _auditSearchTimer = null;
function debounceAuditSearch() {
  clearTimeout(_auditSearchTimer);
  _auditSearchTimer = setTimeout(applyAuditFilter, 350);
}

function applyAuditFilter() {
  _auditFilters.shop = $('audit-shop-filter') ? $('audit-shop-filter').value : '';
  _auditFilters.q = $('audit-search') ? $('audit-search').value.trim() : '';
  _auditPage = 0;
  loadAuditPage(true);
}

async function loadAuditPage(reset) {
  const list = $('audit-list'), moreBtn = $('audit-more-btn'), empty = $('audit-empty');
  if (!list) return;
  if (reset) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt3);font-size:13px;">Loading...</div>';
  if (moreBtn) moreBtn.textContent = 'Loading...';

  try {
    let q = db.from('audit_log').select('*').order('ts', {ascending: false});
    if (_auditFilters.shop) q = q.eq('shop', _auditFilters.shop);
    if (_auditFilters.q) q = q.ilike('actor_name', '%' + _auditFilters.q + '%');
    q = q.limit(AUDIT_PAGE_SIZE).offset(_auditPage * AUDIT_PAGE_SIZE);
    const {data, error} = await q;
    if (error) throw new Error(error.message);

    // Fallback: if searching and nothing matched actor_name, also try matching action/section text client-side on this page
    let rows = data || [];
    if (_auditFilters.q && rows.length === 0 && _auditPage === 0) {
      const {data: allData} = await db.from('audit_log').select('*').order('ts', {ascending: false}).limit(AUDIT_PAGE_SIZE);
      const needle = _auditFilters.q.toLowerCase();
      rows = (allData || []).filter(r =>
        (r.actor_name||'').toLowerCase().includes(needle) ||
        (r.action||'').toLowerCase().includes(needle) ||
        (r.section||'').toLowerCase().includes(needle) ||
        (r.after_val||'').toLowerCase().includes(needle)
      );
    }

    if (reset) list.innerHTML = '';
    if (rows.length === 0 && _auditPage === 0) {
      if (empty) empty.style.display = 'block';
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }
    if (empty) empty.style.display = 'none';

    list.insertAdjacentHTML('beforeend', rows.map(r => {
      const icon = AUDIT_ACTION_ICON[r.action] || '📋';
      const when = new Date(r.ts).toLocaleString('en-KE', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:16px;">${icon}</span>
          <span style="font-weight:700;color:var(--txt);font-size:13px;flex:1;">${r.actor_name || 'Unknown'}</span>
          <span class="tag" style="font-size:10px;">${r.shop || '—'}</span>
          <span style="font-size:11px;color:var(--txt3);white-space:nowrap;">${when}</span>
        </div>
        <div style="font-size:12px;color:var(--txt2);padding-left:24px;">
          <span style="text-transform:capitalize;font-weight:600;color:var(--gold);">${r.section || r.action}</span>
          ${r.after_val ? ' — ' + escapeHtml(r.after_val) : ''}
        </div>
      </div>`;
    }).join(''));

    if (moreBtn) {
      moreBtn.textContent = 'Load more';
      moreBtn.style.display = rows.length < AUDIT_PAGE_SIZE ? 'none' : 'block';
    }
  } catch(e) {
    logError('loadAuditPage', e);
    if (reset) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red);font-size:13px;">Could not load audit log. Please try again.</div>';
  }
}

function loadMoreAudit() {
  _auditPage++;
  loadAuditPage(false);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
