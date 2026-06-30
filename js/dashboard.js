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

  ${sess.isAdmin ? `<div class="card"><div class="cardtitle">🏆 Shop Rankings</div>
    <div style="margin-bottom:16px;">
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <button onclick="renderRankings('daily')" id="rank-btn-daily" style="padding:6px 12px;background:var(--blue);color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">📅 Daily</button>
        <button onclick="renderRankings('weekly')" id="rank-btn-weekly" style="padding:6px 12px;background:var(--surface2);color:var(--txt);border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">📊 Weekly</button>
        <button onclick="renderRankings('monthly')" id="rank-btn-monthly" style="padding:6px 12px;background:var(--surface2);color:var(--txt);border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">📈 Monthly</button>
      </div>
      <div id="rankings-list"></div>
    </div>
  </div>` : `<div class="card"><div class="cardtitle">🏆 Your Ranking Today</div>
    <div id="cashier-ranking"></div>
  </div>`}

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
  
  // Render rankings on dashboard load
  setTimeout(() => {
    renderRankings('daily');
    updateCashierRanking();
  }, 100);
}

function renderRankings(period = 'daily') {
  const now = new Date();
  let startDate;
  
  if (period === 'daily') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'weekly') {
    const day = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - day);
    startDate.setHours(0, 0, 0, 0);
  } else { // monthly
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  const filteredRpts = S.reports.filter(r => new Date(r.id) >= startDate);
  const shopStats = {};
  
  SHOPS.forEach(shop => {
    const rpts = filteredRpts.filter(r => r.shop === shop);
    const totalNet = rpts.reduce((s, r) => s + N(r.totals.net || 0), 0);
    const totalRev = rpts.reduce((s, r) => s + N(r.totals.revenue || 0), 0);
    const avgNet = rpts.length > 0 ? totalNet / rpts.length : 0;
    shopStats[shop] = { totalNet, totalRev, avgNet, count: rpts.length };
  });
  
  // Sort by total net profit
  const ranked = Object.entries(shopStats)
    .sort((a, b) => N(b[1].totalNet) - N(a[1].totalNet))
    .map(([shop, stats], idx) => ({shop, ...stats, position: idx + 1}));
  
  const listEl = $('rankings-list');
  if (listEl) {
    listEl.innerHTML = ranked.map((r, i) => {
      const color = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--blue)' : i === 2 ? 'var(--red)' : 'var(--txt3)';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border-left:4px solid ${color};margin-bottom:8px;border-radius:2px;">
        <span style="font-size:20px;font-weight:700;color:${color};width:40px;text-align:center;">${medal}</span>
        <div style="flex:1;">
          <div style="font-weight:700;color:var(--txt);font-size:14px;">${r.shop}</div>
          <div style="font-size:12px;color:var(--txt3);margin-top:2px;">${r.count} report${r.count!==1?'s':''} · Avg: KES ${fmt(r.avgNet)}/day</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;color:${N(r.totalNet) >= 0 ? 'var(--green)' : 'var(--red)'};font-size:14px;">KES ${fmt(r.totalNet)}</div>
          <div style="font-size:11px;color:var(--txt3);">Total Net</div>
        </div>
      </div>`;
    }).join('');
  }
  
  // Update button states
  ['daily', 'weekly', 'monthly'].forEach(p => {
    const btn = $(`rank-btn-${p}`);
    if (btn) {
      btn.style.background = p === period ? 'var(--blue)' : 'var(--surface2)';
      btn.style.color = p === period ? '#fff' : 'var(--txt)';
    }
  });
}

function updateCashierRanking() {
  if (sess.isAdmin) return;
  
  const now = new Date();
  const todayStr = now.toDateString();
  const todayRpts = S.reports.filter(r => new Date(r.id).toDateString() === todayStr);
  
  const shopStats = {};
  SHOPS.forEach(shop => {
    const rpt = todayRpts.find(r => r.shop === shop);
    shopStats[shop] = N(rpt ? rpt.totals.net : 0);
  });
  
  const ranked = Object.entries(shopStats)
    .sort((a, b) => N(b[1]) - N(a[1]))
    .map(([shop, net], idx) => ({shop, net, position: idx + 1}));
  
  const myRanking = ranked.find(r => r.shop === sess.shop);
  const rankEl = $('cashier-ranking');
  
  if (rankEl && myRanking) {
    const medal = myRanking.position === 1 ? '🥇' : myRanking.position === 2 ? '🥈' : myRanking.position === 3 ? '🥉' : '📍';
    rankEl.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:40px;margin-bottom:10px;">${medal}</div>
        <div style="font-size:24px;font-weight:700;color:var(--txt);margin-bottom:8px;">Position #${myRanking.position} of ${ranked.length}</div>
        <div style="font-size:14px;color:var(--txt2);margin-bottom:12px;">Today's Net: <span style="color:${N(myRanking.net) >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700;">KES ${fmt(myRanking.net)}</span></div>
        <div style="background:var(--bg2);padding:12px;border-radius:4px;font-size:12px;color:var(--txt3);">
          ${myRanking.position === 1 ? '🎉 You\'re leading today!' : myRanking.position === 2 ? '😊 Almost there, keep pushing!' : '💪 Keep working, catch up!'}
        </div>
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--surface2);border-radius:4px;">
        <div style="font-weight:700;color:var(--txt);font-size:12px;margin-bottom:8px;">📊 Today's Standings:</div>
        ${ranked.map((r, i) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);">
          <span>${i+1}. ${r.shop}</span>
          <span style="color:${N(r.net) >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700;">KES ${fmt(r.net)}</span>
        </div>`).join('')}
      </div>
    `;
  }
}
