// ── AUTH & BOOT ──
async function bootApp() {
  setTimeout(() => {
    const ls = $('loading-screen'), lg = $('login');
    if (ls) ls.style.display = 'none';
    if (lg && lg.style.display === 'none') lg.style.display = 'flex';
  }, 5000);

  function wt(p, ms) {
    return Promise.race([p, new Promise(r => setTimeout(() => r({data:null, error:{message:'timeout'}}), ms))]);
  }

  try {
    setLoadMsg('Loading staff...');
    try { 
      const {data, error} = await wt(db.from('staff').select('*'), 5000); 
      if (error) throw error;
      if (data && data.length) S.staff = JSON.parse(JSON.stringify(data)); 
    } catch(e) {
      logError('bootApp: staff loading', e);
      showWarning('Could not load staff data from server. Using offline defaults.');
    }

    setLoadMsg('Loading shops...');
    try { 
      const {data, error} = await wt(db.from('shops').select('*').order('created_at'), 5000); 
      if (error) throw error;
      if (data && data.length) { 
        S.shops = JSON.parse(JSON.stringify(data)); 
        SHOPS = data.map(s => s.name); 
      } 
    } catch(e) {
      logError('bootApp: shops loading', e);
      showWarning('Could not load shops data from server. Using offline defaults.');
    }
    if (!SHOPS.length) SHOPS = ['Kiawara','Nyeri','Gachatha'];

    SHOPS.forEach(sh => {
      if (!S.shopData[sh]) S.shopData[sh] = {
        games:{stellar:{open:0,close:0,topups:[]},pilot:{open:0,close:0,topups:[]},spin:{open:0,close:0,topups:[]}},
        expenses:[], openingCash:0, cashRecon:null, cashMovements:[]
      };
    });

    setLoadMsg('Loading reports...');
    try {
      const {data, error} = await wt(db.from('reports').select('*').order('id',{ascending:false}), 5000);
      if (error) throw error;
      if (data) S.reports = JSON.parse(JSON.stringify(data)).map(r => ({
        id:r.id, shop:r.shop, date:r.date, time:r.time, by:r.by_name,
        games:r.games||{}, expenses:r.expenses||[], cashRecon:r.cash_recon, totals:r.totals||{}
      }));
    } catch(e) {
      logError('bootApp: reports loading', e);
      showWarning('Could not load reports history from server.');
    }

    setLoadMsg('Loading shop data...');
    try {
      const {data, error} = await wt(db.from('shop_state').select('*'), 5000);
      if (error) throw error;
      if (data) JSON.parse(JSON.stringify(data)).forEach(row => {
        const sh = row.shop; if (!sh) return;
        if (!S.shopData[sh]) S.shopData[sh] = {games:{}, expenses:[], openingCash:0, cashRecon:null, cashMovements:[]};
        S.shopData[sh].games = row.games && Object.keys(row.games).length ? row.games : {stellar:{open:0,close:0,topups:[]},pilot:{open:0,close:0,topups:[]},spin:{open:0,close:0,topups:[]}};
        S.shopData[sh].expenses = Array.isArray(row.expenses) ? row.expenses : [];
        S.shopData[sh].openingCash = row.opening_cash || 0;
        S.shopData[sh].cashRecon = row.cash_recon || null;
        S.shopData[sh].cashMovements = Array.isArray(row.cash_movements) ? row.cash_movements : [];
        S.shopData[sh].openedAt = row.opened_at || null;
      });
    } catch(e) {
      logError('bootApp: shop state loading', e);
      showWarning('Could not load current shop data from server.');
    }

    try {
      const {data:bd, error:be} = await wt(db.from('banks').select('*'), 4000); 
      if (be) throw be;
      if (bd) S.banks = JSON.parse(JSON.stringify(bd));
      
      const {data:dd, error:de} = await wt(db.from('debts').select('*'), 4000); 
      if (de) throw de;
      if (dd) S.debts = JSON.parse(JSON.stringify(dd));

      const {data:md, error:me} = await wt(db.from('mpesa_deposits').select('*'), 4000);
      if (me) throw me;
      if (md) S.mpesaDeposits = JSON.parse(JSON.stringify(md));
    } catch(e) {
      logError('bootApp: banking/debts loading', e);
      showWarning('Could not load banking data from server.');
    }

    try {
      const {data:sd, error:se} = await wt(db.from('ai_summaries').select('*').order('created_at',{ascending:false}).limit(10), 4000);
      if (se) throw se;
      if (sd) savedSummaries = JSON.parse(JSON.stringify(sd)).map(s => ({period:s.period, date:s.date, text:s.text, reports:s.report_count}));
    } catch(e) {
      logError('bootApp: AI summaries loading', e);
      // Non-critical, no warning needed
    }

    try {
      const {data:rd} = await wt(db.from('roadmap').select('*').order('sort_order'), 4000);
      if (rd && rd.length) S.roadmap = JSON.parse(JSON.stringify(rd));
    } catch(e) {}

    const _gk = new Set(['stellar','pilot','spin']);
    Object.values(S.shopData).forEach(sd => { Object.keys(sd.games || {}).forEach(g => _gk.add(g)); });
    GAMES = [..._gk];

    setLoadMsg('Ready!');
  } catch(e) {
    setLoadMsg('Offline mode');
  } finally {
    if (!S.staff.length) S.staff = [{name:'Jane Kamau', shop:'All', pin:'1234', role:'admin', perms:{...ADMINPERMS}}];
    if (!SHOPS.length) SHOPS = ['Kiawara','Nyeri','Gachatha'];
    SHOPS.forEach(sh => {
      if (!S.shopData[sh]) S.shopData[sh] = {
        games:{stellar:{open:0,close:0,topups:[]},pilot:{open:0,close:0,topups:[]},spin:{open:0,close:0,topups:[]}},
        expenses:[], openingCash:0, cashRecon:null, cashMovements:[]
      };
    });
    const lnShop = $('ln-shop');
    if (lnShop) lnShop.innerHTML = SHOPS.map(s => `<option value="${s}">${s}</option>`).join('');
    const ls = $('loading-screen'), lg = $('login');
    if (ls) ls.style.display = 'none';
    
    // Try to restore session from localStorage
    try {
      const savedSession = localStorage.getItem('swiftstake_session');
      const savedActiveShop = localStorage.getItem('swiftstake_activeShop');
      const savedThresholds = localStorage.getItem('swiftstake_cashThresholds');
      
      if (savedSession) {
        sess = JSON.parse(savedSession);
        if (savedActiveShop) activeShop = savedActiveShop;
        if (savedThresholds) S.cashThresholds = JSON.parse(savedThresholds);
        
        // Verify the user still exists in staff list
        const userExists = S.staff.find(s => s.name === sess.name && s.role === sess.role);
        
        if (userExists) {
          // Auto-login with saved session
          $('app').style.display = 'flex';
          $('app').style.flexDirection = 'column';
          $('userpill').textContent = sess.name.split(' ')[0] + ' · ' + (sess.isAdmin ? 'Admin' : sess.shop);
          setupNav(); initPlanning(); startNotifScheduler(); subscribeToChat(); subscribeToDataChanges(); startClock(); renderChatPane();
          goTab('dashboard', $('nav-dashboard'));
          return; // Skip showing login screen
        } else {
          // User no longer exists, clear invalid session
          localStorage.removeItem('swiftstake_session');
          localStorage.removeItem('swiftstake_activeShop');
        }
      }
    } catch(e) {
      // If session restoration fails, just show login screen
      console.error('Session restoration failed:', e);
    }
    
    if (lg) lg.style.display = 'flex';
  }
}

function setLoadMsg(m) { const el = $('ls-msg'); if (el) el.textContent = m; }

function selRole(el) {
  document.querySelectorAll('.rolebtn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  selRole_ = el.dataset.role;
  $('pinlbl').textContent = selRole_ === 'admin' ? 'Admin PIN' : 'Your PIN';
}
function pnext(i) { if ($('p' + i).value && i < 3) $('p' + (i + 1)).focus(); }
function getPin() { return [0,1,2,3].map(i => $('p' + i).value).join(''); }
function clrPins() { [0,1,2,3].forEach(i => $('p' + i).value = ''); }
function showErr(m) { const e = $('lerr'); e.textContent = m; e.style.display = 'block'; }

async function doLogin() {
  const name = $('ln-name').value.trim(), shop = $('ln-shop').value, pin = getPin();
  if (!name) { showErr('Please enter your name.'); return; }
  if (pin.length < 4) { showErr('Please enter your 4-digit PIN.'); return; }
  $('lerr').style.display = 'none';
  const m = S.staff.find(s => s.name.toLowerCase() === name.toLowerCase() && s.pin === pin && (s.shop === shop || s.shop === 'All'));
  if (!m) { showErr('Name or PIN not recognised.'); clrPins(); return; }
  if (selRole_ === 'admin' && m.role !== 'admin') { showErr('You are not registered as an administrator.'); clrPins(); return; }
  if (selRole_ === 'cashier' && m.role === 'admin') { showErr('Administrators must sign in using the Admin option.'); clrPins(); return; }
  sess = {role:m.role, name:m.name, shop:m.shop === 'All' ? shop : m.shop, perms:{...m.perms}, isAdmin:m.role === 'admin'};
  activeShop = sess.isAdmin ? SHOPS[0] : sess.shop;
  
  // Save session to localStorage for persistence
  try {
    localStorage.setItem('swiftstake_session', JSON.stringify(sess));
    localStorage.setItem('swiftstake_activeShop', activeShop);
  } catch(e) {}
  
  $('login').style.display = 'none';
  $('app').style.display = 'flex';
  $('app').style.flexDirection = 'column';
  $('userpill').textContent = sess.name.split(' ')[0] + ' · ' + (sess.isAdmin ? 'Admin' : sess.shop);
  setupNav(); initPlanning(); startNotifScheduler(); subscribeToChat(); subscribeToDataChanges(); startClock(); renderChatPane();
  goTab('dashboard', $('nav-dashboard'));
}

function doLogout() {
  if (realtimeSub) { db.removeChannel(realtimeSub); realtimeSub = null; }
  if (realtimeDataSub) { db.removeChannel(realtimeDataSub); realtimeDataSub = null; }
  
  // Clear session from localStorage
  try {
    localStorage.removeItem('swiftstake_session');
    localStorage.removeItem('swiftstake_activeShop');
  } catch(e) {}
  
  $('app').style.display = 'none';
  $('login').style.display = 'flex';
  clrPins();
  $('ln-name').value = '';
  document.querySelectorAll('.rolebtn').forEach(b => b.classList.remove('sel'));
  document.querySelector('[data-role="cashier"]').classList.add('sel');
  selRole_ = 'cashier';
  $('lerr').style.display = 'none';
}

function setupNav() {
  const ai = ['adminlbl','nav-turnover','nav-aisummary','nav-banking','nav-roadmap','nav-settings'];
  ai.forEach(id => {
    const el = $(id);
    if (el) el.style.display = sess.isAdmin ? (id === 'adminlbl' ? 'block' : 'flex') : 'none';
  });
  if (!sess.isAdmin) {
    if (!sess.perms.analytics) $('nav-analytics').style.display = 'none';
    if (!sess.perms.history)   $('nav-history').style.display   = 'none';
    if (!sess.perms.planning)  $('nav-planning').style.display  = 'none';
  }
  const ps = $('proj-shop');
  if (ps) ps.innerHTML = SHOPS.map(s => `<option value="${s}">${s}</option>`).join('');
  const sel = $('proj-cashier');
  if (sel) {
    sel.innerHTML = '<option value="">— None —</option>';
    S.staff.filter(s => s.role !== 'admin').forEach(s => {
      sel.innerHTML += `<option value="${s.name}">${s.name} (${s.shop})</option>`;
    });
  }
  updateBankingNavBadge();
}

function updateBankingNavBadge() {
  const navBanking = $('nav-banking');
  if (!navBanking || !sess.isAdmin) return;
  const pendingCount = (S.mpesaDeposits || []).filter(d => d.status === 'pending').length;
  let badge = navBanking.querySelector('.nav-badge');
  if (pendingCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'nav-badge';
      navBanking.appendChild(badge);
    }
    badge.textContent = pendingCount;
  } else if (badge) {
    badge.remove();
  }
}

function toggleSB() { $('sidebar').classList.toggle('open'); $('overlay').classList.toggle('on'); }
function closeSB()  { $('sidebar').classList.remove('open'); $('overlay').classList.remove('on'); }

function goTab(tab, el) {
  document.querySelectorAll('.sitem').forEach(s => s.classList.remove('act'));
  el.classList.add('act');
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
  $('pane-' + tab).classList.add('on');
  closeSB();
  const renders = {
    dashboard: renderDashboard,
    finance: () => sess.isAdmin
      ? refreshShopData(activeShop).then(() => { renderFinance(); setTimeout(() => loadShopData(activeShop), 80); })
      : renderFinance(),
    analytics: setupAnalytics,
    history: renderHistory,
    settings: renderSettings,
    banking: renderBanking,
    roadmap: renderRoadmap,
    planning: renderPlanning,
    turnover: () => renderTurnover('daily'),
    aisummary: initSummaryPage,
    chat: renderChatPane
  };
  if (renders[tab]) renders[tab]();
}

function startClock() {
  function tick() {
    const now = new Date();
    document.querySelectorAll('.clock-time').forEach(el => el.textContent = now.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
    document.querySelectorAll('.clock-date').forEach(el => el.textContent = now.toLocaleDateString('en-KE',{weekday:'long',day:'numeric',month:'long'}));
  }
  tick(); setInterval(tick, 1000);
}


// ── PUSH NOTIFICATION INIT (called after login) ──
function tryInitPush() {
  try {
    if (typeof initPushNotifications === 'function' && sess && sess.name) {
      setTimeout(() => initPushNotifications(sess.name, sess.shop || 'admin'), 3000);
    }
  } catch(e) { console.log('Push init skipped:', e); }
}
