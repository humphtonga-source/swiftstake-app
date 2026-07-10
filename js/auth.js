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

    const _gk = new Set(['stellar','pilot','spin']);
    Object.values(S.shopData).forEach(sd => { Object.keys(sd.games || {}).forEach(g => _gk.add(g)); });
    GAMES = [..._gk];

    setLoadMsg('Ready!');
  } catch(e) {
    setLoadMsg('Offline mode');
  } finally {
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
      const savedToken = localStorage.getItem('swiftstake_token');
      
      if (savedSession && savedToken && jwtStillValid(savedToken)) {
        sess = JSON.parse(savedSession);
        sessToken = savedToken;
        if (savedActiveShop) activeShop = savedActiveShop;
        
        $('app').style.display = 'flex';
        $('app').style.flexDirection = 'column';
        $('userpill').textContent = sess.name.split(' ')[0] + ' · ' + (sess.isAdmin ? 'Admin' : sess.shop);
        await loadAuthenticatedData();
        try { _rdb.realtime.setAuth(sessToken); } catch(e) {}
        setupNav(); initPlanning(); startNotifScheduler(); subscribeToChat(); subscribeToDataChanges(); startClock(); renderChatPane();
        goTab('dashboard', $('nav-dashboard'));
        return; // Skip showing login screen
      } else if (savedSession) {
        // Session exists but the token is missing/expired - the old
        // session can't do anything useful anymore, so clear it
        // cleanly rather than show a logged-in app with no real data.
        localStorage.removeItem('swiftstake_session');
        localStorage.removeItem('swiftstake_activeShop');
        localStorage.removeItem('swiftstake_token');
      }
    } catch(e) {
      // If session restoration fails, just show login screen
      console.error('Session restoration failed:', e);
    }
    
    if (lg) lg.style.display = 'flex';
  }
}

// Decodes a JWT's payload (no signature verification needed here - this
// is a client-side "is it worth even trying" check; the server still
// verifies the signature on every real request regardless) and checks
// its expiry hasn't passed, with a 5-minute safety margin.
function jwtStillValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload.exp && (payload.exp * 1000) > (Date.now() + 5 * 60 * 1000);
  } catch(e) {
    return false;
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

// Loads everything that RLS scopes per-person - reports, live shop
// data, banking, staff list (admin only) - right after a successful
// login, with a real JWT already in hand. Moved out of the pre-login
// bootApp() sequence, where it would silently return nothing once RLS
// started requiring a real identity.
async function loadAuthenticatedData() {
  function wt(p, ms) {
    return Promise.race([p, new Promise(r => setTimeout(() => r({data:null, error:{message:'timeout'}}), ms))]);
  }

  // Thresholds live in the database now, not localStorage - a threshold
  // an admin sets on their own device previously never reached anyone
  // else's, meaning a cashier's submission could silently fall back to
  // the hardcoded default instead of what the admin actually configured.
  try {
    const {data, error} = await wt(db.from('cash_thresholds').select('*'), 5000);
    if (error) throw error;
    S.cashThresholds = S.cashThresholds || {};
    if (data) data.forEach(row => { S.cashThresholds[row.shop] = N(row.amount); });
  } catch(e) {
    logError('loadAuthenticatedData: cash thresholds', e);
    // Falls back to the hardcoded 5000 default per-shop where used, not fatal
  }

  try {
    const {data, error} = await wt(db.from('reports').select('*').order('id',{ascending:false}), 6000);
    if (error) throw error;
    if (data) S.reports = JSON.parse(JSON.stringify(data)).map(r => ({
      id:r.id, shop:r.shop, date:r.date, time:r.time, by:r.by_name,
      games:r.games||{}, expenses:r.expenses||[], cashRecon:r.cash_recon, totals:r.totals||{}
    }));
  } catch(e) {
    logError('loadAuthenticatedData: reports', e);
    showWarning('Could not load reports history from server.');
  }

  try {
    const {data, error} = await wt(db.from('shop_state').select('*'), 6000);
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
    logError('loadAuthenticatedData: shop state', e);
    showWarning('Could not load current shop data from server.');
  }

  // Admin-only tables (RLS enforces this server-side too - a cashier
  // session simply gets nothing back from these, harmlessly).
  try {
    const {data:bd, error:be} = await wt(db.from('banks').select('*'), 5000);
    if (be) throw be;
    if (bd) S.banks = JSON.parse(JSON.stringify(bd));

    const {data:dd, error:de} = await wt(db.from('debts').select('*'), 5000);
    if (de) throw de;
    if (dd) S.debts = JSON.parse(JSON.stringify(dd));

    const {data:md, error:me} = await wt(db.from('mpesa_deposits').select('*'), 5000);
    if (me) throw me;
    if (md) S.mpesaDeposits = JSON.parse(JSON.stringify(md));

    const {data:wd, error:we} = await wt(db.from('bank_withdrawals').select('*'), 5000);
    if (we) throw we;
    if (wd) S.bankWithdrawals = JSON.parse(JSON.stringify(wd)).sort((a,b) => new Date(b.withdrawn_at) - new Date(a.withdrawn_at));

    const {data:ma, error:ae} = await wt(db.from('monthly_archives').select('*'), 5000);
    if (ae) throw ae;
    if (ma) S.monthlyArchives = JSON.parse(JSON.stringify(ma));
  } catch(e) {
    logError('loadAuthenticatedData: banking/debts', e);
    if (sess.isAdmin) showWarning('Could not load banking data from server.');
  }

  if (sess.isAdmin) {
    try {
      const {data, error} = await db.from('staff').select('*');
      if (error) throw error;
      if (data) S.staff = JSON.parse(JSON.stringify(data));
    } catch(e) { logError('loadAuthenticatedData: staff', e); }
  }

  try {
    const {data:sd} = await wt(db.from('ai_summaries').select('*').order('created_at',{ascending:false}).limit(10), 4000);
    if (sd) savedSummaries = JSON.parse(JSON.stringify(sd)).map(s => ({period:s.period, date:s.date, text:s.text, reports:s.report_count}));
  } catch(e) { logError('loadAuthenticatedData: AI summaries', e); }

  try {
    const {data:rd} = await wt(db.from('roadmap').select('*').order('sort_order'), 4000);
    if (rd && rd.length) S.roadmap = JSON.parse(JSON.stringify(rd));
  } catch(e) {}

  const _gk = new Set(['stellar','pilot','spin']);
  Object.values(S.shopData).forEach(sd => { Object.keys(sd.games || {}).forEach(g => _gk.add(g)); });
  GAMES = [..._gk];
}

async function doLogin() {
  const name = $('ln-name').value.trim(), shop = $('ln-shop').value, pin = getPin();
  if (!name) { showErr('Please enter your name.'); return; }
  if (pin.length < 4) { showErr('Please enter your 4-digit PIN.'); return; }
  $('lerr').style.display = 'none';

  let m = null;
  try {
    const resp = await fetch(SUPABASE_URL + '/functions/v1/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'apikey': SUPABASE_KEY},
      body: JSON.stringify({name, pin, shop})
    });
    const data = await resp.json();
    if (resp.ok && data.staff && data.token) {
      m = data.staff;
      sessToken = data.token;
    } else if (resp.status === 401) {
      showErr('Name or PIN not recognised.'); clrPins(); return;
    } else {
      logError('doLogin - login service', new Error(data.error || 'Login service error'));
      showErr('Could not reach the login service. Please check your connection and try again.');
      clrPins(); return;
    }
  } catch(e) {
    logError('doLogin - login service', e);
    showErr('Could not reach the login service. Please check your connection and try again.');
    clrPins(); return;
  }

  if (selRole_ === 'admin' && m.role !== 'admin') { showErr('You are not registered as an administrator.'); clrPins(); return; }
  if (selRole_ === 'cashier' && m.role === 'admin') { showErr('Administrators must sign in using the Admin option.'); clrPins(); return; }
  sess = {role:m.role, name:m.name, shop:m.shop === 'All' ? shop : m.shop, perms:{...m.perms}, isAdmin:m.role === 'admin'};
  activeShop = sess.isAdmin ? SHOPS[0] : sess.shop;
  
  // Save session to localStorage for persistence. The token is saved
  // too now - its expiry gets checked before ever being trusted again,
  // so a stale one can't cause silent 401s the way an unchecked one could.
  try {
    localStorage.setItem('swiftstake_session', JSON.stringify(sess));
    localStorage.setItem('swiftstake_activeShop', activeShop);
    localStorage.setItem('swiftstake_token', sessToken);
  } catch(e) {}
  
  // Reports, shop data, banking, and staff info can only be correctly
  // scoped by RLS once a real per-user JWT exists - so it's loaded here,
  // right after login, rather than at page boot before anyone's signed in.
  const btn = document.querySelector('.lbtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading your data...'; }
  await loadAuthenticatedData();
  if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
  
  $('login').style.display = 'none';
  $('app').style.display = 'flex';
  $('app').style.flexDirection = 'column';
  $('userpill').textContent = sess.name.split(' ')[0] + ' · ' + (sess.isAdmin ? 'Admin' : sess.shop);
  try { _rdb.realtime.setAuth(sessToken); } catch(e) {}
  setupNav(); initPlanning(); startNotifScheduler(); subscribeToChat(); subscribeToDataChanges(); startClock(); renderChatPane();
  goTab('dashboard', $('nav-dashboard'));
}

function doLogout() {
  if (realtimeSub) { db.removeChannel(realtimeSub); realtimeSub = null; }
  if (realtimeDataSub) { db.removeChannel(realtimeDataSub); realtimeDataSub = null; }
  
  sessToken = null;
  
  // Clear session from localStorage
  try {
    localStorage.removeItem('swiftstake_session');
    localStorage.removeItem('swiftstake_activeShop');
    localStorage.removeItem('swiftstake_token');
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
  const ai = ['adminlbl','nav-turnover','nav-aisummary','nav-banking','nav-auditlog','nav-roadmap','nav-settings'];
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
  const pendingCount = (S.mpesaDeposits || []).filter(d => d.status === 'pending' && !d.deleted_at).length;
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
    auditlog: renderAuditLog,
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
