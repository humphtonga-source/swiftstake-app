// ── DASHBOARD ──
function renderDashboard() {
  const p = $('pane-dashboard'); if (!p) return;
  const now = new Date();
  const todayStr = now.toDateString();
  const todayRpts = S.reports.filter(r => new Date(r.id).toDateString() === todayStr);
  const allRpts = sess.isAdmin ? S.reports : S.reports.filter(r => r.shop === sess.shop && new Date(r.id).toDateString() === todayStr);
  const tRev = allRpts.reduce((s,r) => s + N(r.totals.revenue), 0);
  const tNet = allRpts.reduce((s,r) => s + N(r.totals.net), 0);
  const tExp = allRpts.reduce((s,r) => s + N(r.totals.expenses || (Array.isArray(r.expenses) ? r.expenses.reduce((ss,e) => ss + N(e.amount), 0) : 0)), 0);
  const todayNet = todayRpts.filter(r => sess.isAdmin || r.shop === sess.shop).reduce((s,r) => s + N(r.totals.net), 0);
  const pendingTasks = (S.planTasks.daily || []).filter(t => !t.done).length;
  const submittedToday = new Set(todayRpts.map(r => r.shop));
  const pendingShops = sess.isAdmin ? SHOPS.filter(s => !submittedToday.has(s)) : [];

  p.innerHTML = `
  <div class="clock-widget">
    <div>
      <div class="clock-time" id="dash-clock">--:--:--</div>
      <div class="clock-date" id="dash-date"></div>
    </div>
    <div class="clock-shop">${sess.isAdmin ? '🛡️ Admin' : '📍 ' + sess.shop}</div>
  </div>

  <div class="ph"><div class="ph-icon">🏠</div><h2>Dashboard</h2>
    <div class="phr"><span style="font-size:12px;color:var(--txt3);">${now.toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short'})}</span></div>
  </div>

  <div class="quickstats">
    <div class="qs-card"><div class="qs-icon gold">💰</div><div><div class="qs-val" data-amount="${tRev}" style="display:flex;align-items:center;gap:6px;">${PrivacyMode.getToggleHtml('dashboard-rev', tRev)}</div><div class="qs-lbl">Total Revenue</div></div></div>
    <div class="qs-card"><div class="qs-icon ${tNet >= 0 ? 'green' : 'red'}">📈</div><div><div class="qs-val" data-amount="${tNet}" style="color:${tNet >= 0 ? 'var(--green)' : 'var(--red)'}; display:flex;align-items:center;gap:6px;">${PrivacyMode.getToggleHtml('dashboard-net', tNet)}</div><div class="qs-lbl">Net Profit</div></div></div>
    <div class="qs-card"><div class="qs-icon blue">📋</div><div><div class="qs-val">${allRpts.length}</div><div class="qs-lbl">Total Reports</div></div></div>
    <div class="qs-card"><div class="qs-icon ${todayNet >= 0 ? 'green' : 'red'}">☀️</div><div><div class="qs-val" data-amount="${todayNet}" style="color:${todayNet >= 0 ? 'var(--green)' : 'var(--red)'}; display:flex;align-items:center;gap:6px;">${PrivacyMode.getToggleHtml('dashboard-today', todayNet)}</div><div class="qs-lbl">Today's Net</div></div></div>
  </div>

  ${sess.isAdmin && pendingShops.length ? `<div class="ibar">⏳ Awaiting reports: <strong>${pendingShops.join(', ')}</strong></div>` : ''}
  ${sess.isAdmin && submittedToday.size ? `<div class="ibar" style="background:var(--greenl);border-color:rgba(34,197,94,0.25);color:var(--green);">✅ Submitted today: <strong>${[...submittedToday].join(', ')}</strong></div>` : ''}

  ${sess.isAdmin ? `<div class="card"><div class="cardtitle">🏪 Shop Status Today</div>
    ${SHOPS.map(sh => {
      const rpt = todayRpts.find(r => r.shop === sh);
      const live = S.shopData[sh];
      const liveRev = live ? GAMES.reduce((s,g) => {
        const gd = live.games && live.games[g]; if (!gd) return s;
        const tops = (gd.topups||[]).reduce((ss,t) => ss + N(t.amount), 0);
        return s + (N(gd.open) + tops - N(gd.close));
      }, 0) : 0;
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:8px;height:8px;border-radius:50%;background:${rpt ? 'var(--green)' : 'var(--gold)'};flex-shrink:0;"></div>
        <span style="flex:1;font-weight:600;color:var(--txt);font-size:14px;">${sh}</span>
        ${rpt ? `<span class="tag tag-green">✅ Submitted</span><span style="font-size:13px;font-weight:700;color:var(--green);" data-amount="${rpt.totals.net}">${PrivacyMode.getToggleHtml('shop-' + sh, rpt.totals.net)}</span>` : `<span class="tag tag-gold">🔄 Live</span><span style="font-size:13px;font-weight:700;color:var(--gold);" data-amount="${liveRev}">${PrivacyMode.getToggleHtml('live-' + sh, liveRev)}</span>`}
        <button class="sbtn" style="font-size:12px;" onclick="goTab('finance',document.getElementById('nav-finance'));setTimeout(()=>switchShop(null,'${sh}'),200);">View →</button>
      </div>`;
    }).join('')}
  </div>` : ''}

  <div class="card"><div class="cardtitle">📅 Today's Tasks
    <span style="margin-left:auto;font-size:12px;color:var(--txt3);">${pendingTasks} pending</span>
  </div>
  ${(S.planTasks.daily || []).slice(0, 5).map((t, i) => `
    <div class="titem" onclick="togglePTask('daily',${i})">
      <div class="tcb ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</div>
      <span class="ttext ${t.done ? 'done' : ''}">${t.text}</span>
      ${t.due ? `<span class="tdue">⏰ ${t.due}</span>` : ''}
    </div>`).join('')}
  ${!S.planTasks.daily.length ? '<div style="font-size:13px;color:var(--txt3);padding:8px 0;">No tasks. Add some in Planning.</div>' : ''}
  <button class="sbtn" style="margin-top:10px;width:100%;" onclick="goTab('planning',document.getElementById('nav-planning'))">View all tasks →</button>
  </div>

  ${allRpts.length ? `<div class="card"><div class="cardtitle">📋 Recent Reports</div>
    ${allRpts.slice(0, 3).map(r => {
      const net = N(r.totals.net);
      return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);">
        <div style="width:8px;height:8px;border-radius:50%;background:${net >= 0 ? 'var(--green)' : 'var(--red)'};flex-shrink:0;"></div>
        <div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--txt);">${r.shop}</div><div style="font-size:11px;color:var(--txt3);">${r.date}</div></div>
        <span style="font-size:13px;font-weight:700;color:${net >= 0 ? 'var(--green)' : 'var(--red)'};" data-amount="${net}">${PrivacyMode.getToggleHtml('report-' + r.id, net)}</span>
      </div>`;
    }).join('')}
    <button class="sbtn" style="margin-top:10px;width:100%;" onclick="goTab('history',document.getElementById('nav-history'))">View all reports →</button>
  </div>` : ''}`;
}
