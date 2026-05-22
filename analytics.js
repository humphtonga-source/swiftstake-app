// ── ANALYTICS ──
function setupAnalytics() {
  const p = $('pane-analytics'); if (!p) return;
  if (!sess.perms.analytics) { p.innerHTML = '<div class="denied"><div class="dico">🔒</div><h3>Analytics restricted</h3></div>'; return; }
  const rpts = sess.isAdmin ? S.reports : S.reports.filter(r => r.shop === sess.shop);
  const tR = rpts.reduce((s,r) => s + N(r.totals.revenue), 0), tN = rpts.reduce((s,r) => s + N(r.totals.net), 0);
  p.innerHTML = `<div class="ph"><div class="ph-icon">📈</div><h2>Analytics</h2><div class="phr">${sess.isAdmin ? '<button class="redbtn" onclick="deleteAllAnalytics()">🗑️ Clear</button>' : ''}<button class="sbtn" onclick="renderCharts()">🔄 Refresh</button></div></div>
    <div id="nodata-msg" class="ibar">📭 No reports yet. Submit end-of-day reports to see analytics.</div>
    <div class="metrics">
      <div class="mc"><div class="mclbl">Total Revenue</div><div class="mcval pos">KES ${fmt(tR)}</div></div>
      <div class="mc"><div class="mclbl">Total Net Profit</div><div class="mcval ${tN >= 0 ? 'pos' : 'neg'}">KES ${fmt(tN)}</div></div>
      <div class="mc"><div class="mclbl">Best Shop</div><div class="mcval" style="font-size:15px;" id="an-best">—</div></div>
      <div class="mc"><div class="mclbl">Total Reports</div><div class="mcval">${rpts.length}</div></div>
    </div>
    <div class="chartwrap"><div class="charttitle">Net Profit by Shop</div><div class="chartsub">Comparing profit across all shops</div><canvas id="chart-shops" height="180"></canvas></div>
    <div class="chartwrap"><div class="charttitle">Revenue by Game</div><div class="chartsub">Total revenue per game type</div><canvas id="chart-games" height="160"></canvas></div>
    <div class="chartwrap"><div class="charttitle">Net Trend</div><div class="chartsub">Last 10 submissions</div><canvas id="chart-trend" height="160"></canvas></div>`;
  renderCharts();
}

function renderCharts() {
  const rpts = sess.isAdmin ? S.reports : S.reports.filter(r => r.shop === sess.shop);
  const nm = $('nodata-msg'); if (nm) nm.style.display = rpts.length ? 'none' : 'block'; if (!rpts.length) return;
  const sN = {}; SHOPS.forEach(s => sN[s] = 0); rpts.forEach(r => sN[r.shop] = (sN[r.shop] || 0) + N(r.totals.net));
  const best = Object.entries(sN).sort((a,b) => b[1] - a[1])[0]; const ab = $('an-best'); if (ab && best) ab.textContent = best[0];
  dChart('chart-shops', 'bar', SHOPS, SHOPS.map(s => sN[s]), COLORS);
  const gR = {}; GAMES.forEach(g => gR[g] = 0); rpts.forEach(r => GAMES.forEach(g => gR[g] += N(r.games[g] ? r.games[g].revenue : 0)));
  dChart('chart-games', 'bar', GAMES.map(g => g.charAt(0).toUpperCase() + g.slice(1)), GAMES.map(g => gR[g]), COLORS);
  const sl = [...rpts].reverse().slice(-10); dChart('chart-trend', 'line', sl.map(r => r.shop), sl.map(r => N(r.totals.net)), '#f59e0b');
}

function dChart(id, type, labels, data, colors) {
  if (chartObjs[id]) chartObjs[id].destroy(); const cv = $(id); if (!cv) return;
  const w = cv.offsetWidth || 280, h = cv.offsetHeight || 180; cv.width = w * devicePixelRatio; cv.height = h * devicePixelRatio;
  const ctx = cv.getContext('2d'); ctx.scale(devicePixelRatio, devicePixelRatio);
  const pd = 42, pb = 46, pt = 12, pr = 12, cw = w - pd - pr, ch = h - pb - pt; const mx = Math.max(...data.map(Math.abs), 1);
  ctx.clearRect(0, 0, w, h); ctx.font = '11px -apple-system,sans-serif'; ctx.fillStyle = '#64748b';
  for (let i = 0; i <= 4; i++) { const y = pt + ch - (ch / 4 * i); ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.moveTo(pd, y); ctx.lineTo(pd + cw, y); ctx.stroke(); const v = Math.round(mx / 4 * i); ctx.textAlign = 'right'; ctx.fillText(v >= 1000 ? (v/1000).toFixed(0) + 'k' : v, pd - 4, y + 4); }
  if (type === 'bar') {
    const bw = Math.max(8, Math.min(36, (cw / labels.length) - 6));
    labels.forEach((l, i) => { const x = pd + cw / labels.length * i + cw / labels.length / 2 - bw / 2, v = data[i], bh = Math.abs(v) / mx * ch, by = v >= 0 ? pt + ch - bh : pt + ch; ctx.fillStyle = Array.isArray(colors) ? colors[i % colors.length] : colors; if (ctx.roundRect) ctx.roundRect(x, by, bw, bh, 4); else ctx.rect(x, by, bw, bh); ctx.fill(); ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.fillText((l.length > 7 ? l.substring(0, 7) + '…' : l), x + bw / 2, h - pb + 14); });
  } else {
    ctx.beginPath(); ctx.strokeStyle = colors; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    data.forEach((v, i) => { const x = pd + cw / (data.length - 1 || 1) * i, y = pt + ch - (v + mx) / (mx * 2) * ch; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke();
    data.forEach((v, i) => { const x = pd + cw / (data.length - 1 || 1) * i, y = pt + ch - (v + mx) / (mx * 2) * ch; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = colors; ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); });
    labels.forEach((l, i) => { const x = pd + cw / (labels.length - 1 || 1) * i; ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.fillText((l.length > 8 ? l.substring(0, 8) + '…' : l), x, h - pb + 14); });
  }
  chartObjs[id] = { destroy: () => { const c = $(id); if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); } };
}

async function deleteAllAnalytics() {
  const ok = await confirmModal.show('Clear Analytics', 'Delete ALL reports permanently?', '🗑️ Delete All', 'var(--red)', '🚨');
  if (!ok) return;
  try { for (const r of S.reports) await db.from('reports').eq('id', r.id).delete(); S.reports = []; setupAnalytics(); } catch(e) { alert('Could not delete.'); }
}
