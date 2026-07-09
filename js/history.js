// ── HISTORY ──
function renderHistory() {
  const p = $('pane-history'); if (!p) return;
  if (!sess.perms.history) { p.innerHTML = '<div class="denied"><div class="dico">🔒</div><h3>History restricted</h3></div>'; return; }
  const rpts = sess.isAdmin ? S.reports : S.reports.filter(r => r.shop === sess.shop);
  let html = `<div class="ph"><div class="ph-icon">📋</div><h2>Report History</h2><div class="phr">${sess.isAdmin ? '<button class="redbtn" onclick="deleteAllHistory()">🗑️ Delete All</button>' : ''}</div></div>`;
  if (!rpts.length) { html += '<div style="text-align:center;padding:60px 20px;color:var(--txt2);">No reports yet.</div>'; }
  else {
    rpts.forEach(r => {
      const net = N(r.totals.net), nc = net >= 0 ? 'pos' : 'neg';
      const allKeys = [...new Set([...GAMES, ...Object.keys(r.games || {})])];
      const gh = allKeys.map(g => { const gd = r.games[g] || {}, rev = N(gd.revenue); if (!rev && !gd.open && !gd.close) return ''; return `<div class="hegame"><b>${g.charAt(0).toUpperCase() + g.slice(1)}:</b> KES ${fmt(rev)}</div>`; }).join('');
      const tExp = (r.expenses || []).reduce((s,e) => s + N(e.amount), 0);
      const delBtn = sess.isAdmin ? `<button class="redbtn" onclick="deleteReport(${r.id})">🗑️</button>` : '';

      const rc = r.cashRecon;
      const cashToggleHtml = (sess.isAdmin && rc) ? `<button class="hcash-toggle" onclick="toggleCashBreakdown(${r.id},event)">💰 Cash Breakdown ▾</button>
        <div class="hcash-detail" id="hcash-${r.id}" style="display:none;">
          <div class="hcash-row"><span>Notes</span><span class="mono-fig">KES ${fmt(N(rc.notes))}</span></div>
          <div class="hcash-row"><span>Coins</span><span class="mono-fig">KES ${fmt(N(rc.coins))}</span></div>
          <div class="hcash-row"><span>M-Pesa</span><span class="mono-fig">KES ${fmt(N(rc.mpesa))}</span></div>
          <div class="hcash-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:6px;"><span>Declared</span><span class="mono-fig" style="font-weight:700;">KES ${fmt(N(rc.declared))}</span></div>
          <div class="hcash-row"><span>Expected</span><span class="mono-fig">KES ${fmt(N(rc.expected))}</span></div>
          <div class="hcash-row"><span>${rc.ok ? '✅ Balanced' : (N(rc.diff) > 0 ? '⚠️ Over' : '⚠️ Short')}</span><span class="mono-fig" style="color:${rc.ok ? 'var(--green)' : 'var(--red)'};font-weight:700;">${rc.ok ? '—' : 'KES ' + fmt(Math.abs(N(rc.diff)))}</span></div>
        </div>` : '';

      html += `<div class="hentry"><div class="hehead"><div style="width:10px;height:10px;border-radius:50%;background:${net >= 0 ? 'var(--green)' : 'var(--red)'};flex-shrink:0;"></div><span class="heshop">${r.shop}</span><span class="hedate">${r.date}${r.time ? ' · ' + r.time : ''}</span><span class="henet ${nc}">KES ${fmt(net)}</span></div><div class="hegames">${gh}</div><div style="font-size:12px;color:var(--txt3);margin-bottom:10px;">Expenses: KES ${fmt(tExp)} · By: ${r.by || ''}</div>${cashToggleHtml}<div style="display:flex;gap:7px;margin-top:8px;"><button class="sbtn" onclick="exportHistReport(${r.id})">📄 Export</button>${delBtn}</div></div>`;
    });
  }

  // ── Audit Log section (admin only) ──
  if (sess.isAdmin) {
    html += `
    <div style="margin-top:32px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:18px;">🔍</span>
        <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--txt);">Audit Trail</h3>
        <span style="font-size:11px;color:var(--txt3);background:var(--surface2);padding:2px 8px;border-radius:99px;">Admin only</span>
        <button onclick="renderAuditLog()" style="margin-left:auto;padding:5px 12px;background:var(--bluel);color:var(--blue);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius2);font-size:11px;font-weight:700;cursor:pointer;">🔄 Refresh</button>
      </div>
      <div class="ibar" style="margin-bottom:12px;">Every push, edit, addition, deletion and end-of-day submission is recorded here with who did it, when, and what changed.</div>
      <div id="audit-log-container"></div>
    </div>`;
  }

  p.innerHTML = html;

  // Auto-load audit log when tab opens
  if (sess.isAdmin) renderAuditLog();
}

function toggleCashBreakdown(id, e) {
  if (e) e.stopPropagation();
  const el = $('hcash-' + id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  const btn = e && e.target;
  if (btn) btn.textContent = isOpen ? '💰 Cash Breakdown ▾' : '💰 Cash Breakdown ▴';
}

async function deleteReport(id) {
  const ok = await confirmModal.show('Delete Report', 'Delete this report permanently?', '🗑️ Delete', 'var(--red)', '⚠️');
  if (!ok) return;
  try { await db.from('reports').eq('id', id).delete(); S.reports = S.reports.filter(r => r.id !== id); renderHistory(); } catch(e) { alert('Could not delete.'); }
}

async function deleteAllHistory() {
  const ok = await confirmModal.show('Delete ALL History', 'This permanently deletes ALL reports. Cannot be undone.', '🗑️ Delete All', 'var(--red)', '🚨');
  if (!ok) return;
  try { for (const r of S.reports) await db.from('reports').eq('id', r.id).delete(); S.reports = []; renderHistory(); } catch(e) { alert('Could not delete.'); }
}
