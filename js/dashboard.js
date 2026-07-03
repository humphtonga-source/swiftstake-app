// ── DASHBOARD ──
function renderDashboard() {
  const p = $('pane-dashboard'); if (!p) return;
  const now = new Date();
  const todayStr = now.toDateString();
  const todayRpts = S.reports.filter(r => new Date(r.id).toDateString() === todayStr);
  const allRpts = sess.isAdmin ? S.reports : S.reports.filter(r => r.shop === sess.shop && new Date(r.id).toDateString() === todayStr);
  const tRev = allRpts.reduce((s,r) => s + N(r.totals.revenue), 0);
  const tNet = allRpts.reduce((s,r) => s + N(r.totals.net), 0);
  const todayNet = todayRpts.filter(r => sess.isAdmin || r.shop === sess.shop).reduce((s,r) => s + N(r.totals.net), 0);
  const pendingTasks = (S.planTasks.daily || []).filter(t => !t.done).length;
  const submittedToday = new Set(todayRpts.map(r => r.shop));
  const pendingShops = sess.isAdmin ? SHOPS.filter(s => !submittedToday.has(s)) : [];
  const pendingDeposits = sess.isAdmin ? (S.mpesaDeposits || []).filter(d => d.status === 'pending') : [];
  const lowFloatShops = sess.isAdmin ? getLowFloatShops() : (getLowFloatShops().filter(r => r.shop === sess.shop));
  const hasAttentionItems = pendingShops.length || pendingDeposits.length || lowFloatShops.length;

  p.innerHTML = `
  <div class="status-strip">
    <div class="status-strip-dot"></div>
    <span class="status-strip-label">Live</span>
    <span class="status-strip-shop">${sess.isAdmin ? 'Admin · All Shops' : sess.shop}</span>
    <span class="status-strip-time clock-time" id="dash-clock">--:--:--</span>
  </div>

  ${hasAttentionItems ? `<div style="margin-bottom:4px;">
    <div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;padding-left:2px;">Needs attention</div>
    ${lowFloatShops.map(r => `<div class="attn-card" style="background:var(--redl);border:1px solid rgba(239,68,68,0.3);" onclick="goTab('finance',document.getElementById('nav-finance'));setTimeout(()=>switchShop(null,'${r.shop}'),200);">
      <span class="attn-icon">⚠️</span>
      <span class="attn-text" style="color:var(--red);">${r.shop} float is low — est. <span class="mono-fig">KES ${fmt(r.cash)}</span> (min <span class="mono-fig">KES ${fmt(r.threshold)}</span>)</span>
      <span class="attn-arrow">→</span>
    </div>`).join('')}
    ${pendingDeposits.length ? `<div class="attn-card" style="background:var(--bluel);border:1px solid rgba(59,130,246,0.3);" onclick="goTab('banking',document.getElementById('nav-banking'))">
      <span class="attn-icon">📱</span>
      <span class="attn-text" style="color:var(--blue);">${pendingDeposits.length} M-Pesa deposit${pendingDeposits.length!==1?'s':''} awaiting approval</span>
      <span class="attn-arrow">→</span>
    </div>` : ''}
    ${pendingShops.length ? `<div class="attn-card" style="background:var(--goldl);border:1px solid rgba(245,158,11,0.3);" onclick="goTab('history',document.getElementById('nav-history'))">
      <span class="attn-icon">⏳</span>
      <span class="attn-text" style="color:var(--gold);">Awaiting today's report: ${pendingShops.join(', ')}</span>
      <span class="attn-arrow">→</span>
    </div>` : ''}
  </div>` : ''}

  <div class="board">
    <div class="board-head">
      <span class="board-title">🏆 ${sess.isAdmin ? "Today's Board" : 'Your Standing'}</span>
    </div>
    ${sess.isAdmin ? `<div class="board-period-tabs">
      <button onclick="renderRankings('daily')" id="rank-btn-daily">Daily</button>
      <button onclick="renderRankings('weekly')" id="rank-btn-weekly">Weekly</button>
      <button onclick="renderRankings('monthly')" id="rank-btn-monthly">Monthly</button>
    </div>
    <div id="rankings-list"></div>` : `<div id="cashier-ranking"></div>`}
  </div>

  <div class="ledger">
    <div class="ledger-row">
      <span class="ledger-icon">💰</span>
      <span class="ledger-label">Total Revenue</span>
      <span class="ledger-figure" data-amount="${tRev}">${PrivacyMode.getToggleHtml('dashboard-rev', tRev)}</span>
    </div>
    <div class="ledger-row">
      <span class="ledger-icon">📈</span>
      <span class="ledger-label">Net Profit</span>
      <span class="ledger-figure" data-amount="${tNet}">${PrivacyMode.getToggleHtml('dashboard-net', tNet)}</span>
    </div>
    <div class="ledger-row">
      <span class="ledger-icon">☀️</span>
      <span class="ledger-label">Today's Net</span>
      <span class="ledger-figure" data-amount="${todayNet}">${PrivacyMode.getToggleHtml('dashboard-today', todayNet)}</span>
    </div>
    <div class="ledger-row">
      <span class="ledger-icon">📋</span>
      <span class="ledger-label">Total Reports</span>
      <span class="ledger-figure mono-fig">${allRpts.length}</span>
    </div>
  </div>

  <div class="chartwrap"><div class="charttitle">7-Day Net Profit Trend</div><div class="chartsub">${sess.isAdmin ? 'All shops combined' : sess.shop}</div><canvas id="chart-dash-trend" height="150"></canvas></div>

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
        ${rpt ? `<span class="tag tag-green">✅ Submitted</span><span class="mono-fig" style="font-size:13px;font-weight:700;color:var(--green);" data-amount="${rpt.totals.net}">${PrivacyMode.getToggleHtml('shop-' + sh, rpt.totals.net)}</span>` : `<span class="tag tag-gold">🔄 Live</span><span class="mono-fig" style="font-size:13px;font-weight:700;color:var(--gold);" data-amount="${liveRev}">${PrivacyMode.getToggleHtml('live-' + sh, liveRev)}</span>`}
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
        <span class="mono-fig" style="font-size:13px;font-weight:700;color:${net >= 0 ? 'var(--green)' : 'var(--red)'};" data-amount="${net}">${PrivacyMode.getToggleHtml('report-' + r.id, net)}</span>
      </div>`;
    }).join('')}
    <button class="sbtn" style="margin-top:10px;width:100%;" onclick="goTab('history',document.getElementById('nav-history'))">View all reports →</button>
  </div>` : ''}`;
  
  // Render rankings, trend chart, and check for month rollover on dashboard load
  setTimeout(() => {
    renderRankings('daily');
    updateCashierRanking();
    renderDashTrendChart();
    if (sess.isAdmin) archiveCompletedMonths();
  }, 100);
}

// Permanently snapshots any fully-completed month that hasn't been archived
// yet, so historical totals survive even though the live dashboard/rankings
// always show a fresh view scoped to the current day/week/month.
async function archiveCompletedMonths() {
  const now = new Date();
  const thisMonthKey = now.getFullYear() + '-' + (now.getMonth() + 1);
  if (localStorage.getItem('swiftstake_lastArchiveCheck') === thisMonthKey) return;
  localStorage.setItem('swiftstake_lastArchiveCheck', thisMonthKey);

  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthsWithData = new Set();
  S.reports.forEach(r => {
    const d = new Date(r.id);
    if (d < firstOfThisMonth) prevMonthsWithData.add(d.getFullYear() + '-' + (d.getMonth() + 1));
  });

  for (const key of prevMonthsWithData) {
    const [year, month] = key.split('-').map(Number);
    const alreadyArchived = (S.monthlyArchives || []).some(a => a.year === year && a.month === month);
    if (alreadyArchived) continue;
    await archiveMonth(year, month, false);
  }
}

async function archiveMonth(year, month, isManual) {
  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month, 1);
  for (const shop of SHOPS) {
    const rpts = S.reports.filter(r => r.shop === shop && new Date(r.id) >= rangeStart && new Date(r.id) < rangeEnd);
    if (!rpts.length && !isManual) continue;
    const totals = {
      shop, year, month,
      total_net: rpts.reduce((s,r) => s + N(r.totals.net||0), 0),
      total_revenue: rpts.reduce((s,r) => s + N(r.totals.revenue||0), 0),
      total_expenses: rpts.reduce((s,r) => s + N(r.totals.expenses||0), 0),
      report_count: rpts.length,
      archived_by: sess.name
    };
    try {
      const existing = (S.monthlyArchives || []).find(a => a.shop === shop && a.year === year && a.month === month);
      if (existing && isManual) {
        const {error} = await db.from('monthly_archives').eq('id', existing.id).update(totals);
        if (error) throw new Error(error.message);
        Object.assign(existing, totals);
      } else if (existing) {
        continue; // auto-archive: never overwrite an already-sealed past month
      } else {
        const {data, error} = await db.from('monthly_archives').insert(totals);
        if (error) throw new Error(error.message);
        if (data && data[0]) S.monthlyArchives.push(JSON.parse(JSON.stringify(data[0])));
      }
    } catch(e) {
      logError('archiveMonth', e, {shop, year, month});
    }
  }
  if (isManual) pushNotif('📦 Month archived', `${month}/${year} totals saved for all shops`);
}

async function resetShopDayData(shop) {
  const ok = await confirmModal.show(
    '⚠️ Reset Today\'s Data',
    `Reset ${shop}'s in-progress data for today?\n\nThis clears unsaved game floats, expenses, and reconciliation entries back to blank. It does NOT delete any already-submitted reports or history — those are permanent.`,
    '🔄 Reset',
    'var(--red)',
    '⚠️'
  );
  if (!ok) return;
  const blank = {}; GAMES.forEach(g => { blank[g] = {open:0, close:0, topups:[]}; });
  S.shopData[shop] = {games:blank, expenses:[], openingCash:0, cashRecon:null, cashMovements:[], openedAt:null};
  await saveShopState(shop, true);
  await AuditLog.record('reset', shop, 'daily-data', 'admin manual reset', `${sess.name} reset ${shop}'s in-progress daily data`);
  pushNotif('🔄 Shop data reset', shop + ' is back to a blank slate for today');
  if (activeShop === shop) { renderFinance(); }
  renderDashboard();
}

function renderDashTrendChart() {
  const cv = $('chart-dash-trend'); if (!cv) return;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const scoped = sess.isAdmin ? S.reports : S.reports.filter(r => r.shop === sess.shop);
  const dayNets = days.map(day => {
    const dayStr = day.toDateString();
    return scoped.filter(r => new Date(r.id).toDateString() === dayStr)
      .reduce((s, r) => s + N(r.totals.net || 0), 0);
  });
  const labels = days.map(d => d.toLocaleDateString('en-KE', {weekday: 'short'}));
  dChart('chart-dash-trend', 'line', labels, dayNets, '#22c55e');
}

async function renderRankings(period = 'daily') {
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
  
  const listEl = $('rankings-list');
  if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--txt3);font-size:12px;">Loading...</div>';
  
  let ranked = [];
  try {
    const {data, error} = await db.rpc('get_shop_rankings', {since_ms: startDate.getTime()});
    if (error) throw new Error(error.message);
    const shopStats = {};
    SHOPS.forEach(shop => { shopStats[shop] = {totalNet: 0, totalRev: 0, count: 0}; });
    (data || []).forEach(row => {
      shopStats[row.shop] = {totalNet: N(row.total_net), totalRev: N(row.total_revenue), count: Number(row.report_count) || 0};
    });
    ranked = Object.entries(shopStats)
      .map(([shop, stats]) => ({shop, ...stats, avgNet: stats.count > 0 ? stats.totalNet / stats.count : 0}))
      .sort((a, b) => N(b.totalNet) - N(a.totalNet))
      .map((r, idx) => ({...r, position: idx + 1}));
  } catch(e) {
    logError('renderRankings', e);
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:12px;">Could not load rankings.</div>';
    return;
  }
  
  if (listEl) {
    listEl.innerHTML = ranked.map((r, i) => {
      const color = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--blue)' : i === 2 ? 'var(--red)' : 'var(--txt3)';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
      return `<div class="board-row">
        <span class="board-rank" style="color:${color};">${medal}</span>
        <div class="board-shop">
          <div class="board-shop-name">${r.shop}</div>
          <div class="board-shop-sub">${r.count} report${r.count!==1?'s':''} · avg KES ${fmt(r.avgNet)}/day</div>
        </div>
        <span class="board-figure ${N(r.totalNet) >= 0 ? 'pos' : 'neg'}">KES ${fmt(r.totalNet)}</span>
      </div>`;
    }).join('');
  }
  
  ['daily', 'weekly', 'monthly'].forEach(p => {
    const btn = $(`rank-btn-${p}`);
    if (btn) {
      btn.style.background = p === period ? 'var(--blue)' : 'var(--surface2)';
      btn.style.color = p === period ? '#fff' : 'var(--txt)';
    }
  });
}

async function updateCashierRanking() {
  if (sess.isAdmin) return;
  
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rankEl = $('cashier-ranking');
  if (rankEl) rankEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--txt3);font-size:12px;">Loading...</div>';
  
  let ranked = [];
  try {
    const {data, error} = await db.rpc('get_shop_rankings', {since_ms: startOfToday.getTime()});
    if (error) throw new Error(error.message);
    const byShop = {}; SHOPS.forEach(s => byShop[s] = 0);
    (data || []).forEach(row => { byShop[row.shop] = N(row.total_net); });
    ranked = Object.entries(byShop)
      .sort((a, b) => N(b[1]) - N(a[1]))
      .map(([shop, net], idx) => ({shop, net, position: idx + 1}));
  } catch(e) {
    logError('updateCashierRanking', e);
    if (rankEl) rankEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:12px;">Could not load ranking.</div>';
    return;
  }
  
  const myRanking = ranked.find(r => r.shop === sess.shop);
  
  if (rankEl && myRanking) {
    const medal = myRanking.position === 1 ? '🥇' : myRanking.position === 2 ? '🥈' : myRanking.position === 3 ? '🥉' : '📍';
    rankEl.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:40px;margin-bottom:10px;">${medal}</div>
        <div style="font-size:24px;font-weight:700;color:var(--txt);margin-bottom:8px;">Position #${myRanking.position} of ${ranked.length}</div>
        <div style="font-size:14px;color:var(--txt2);margin-bottom:12px;">Today's Net: <span class="mono-fig ${N(myRanking.net) >= 0 ? 'pos' : 'neg'}">KES ${fmt(myRanking.net)}</span></div>
        <div style="background:var(--bg2);padding:12px;border-radius:4px;font-size:12px;color:var(--txt3);">
          ${myRanking.position === 1 ? '🎉 You\'re leading today!' : myRanking.position === 2 ? '😊 Almost there, keep pushing!' : '💪 Keep working, catch up!'}
        </div>
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--surface2);border-radius:4px;">
        <div style="font-weight:700;color:var(--txt);font-size:12px;margin-bottom:8px;">📊 Today's Standings:</div>
        ${ranked.map((r, i) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);">
          <span>${i+1}. ${r.shop}</span>
          <span class="mono-fig ${N(r.net) >= 0 ? 'pos' : 'neg'}">KES ${fmt(r.net)}</span>
        </div>`).join('')}
      </div>
    `;
  }
}
