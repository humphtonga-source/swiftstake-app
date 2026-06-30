// ── UI HELPERS ──
function openModal(id)  { const el = $(id); if (el) el.classList.add('on'); }
function closeModal(id) { const el = $(id); if (el) el.classList.remove('on'); }

const confirmModal = {
  _resolve: null,
  show(title, msg, okLabel, okColor, icon, preview) {
    return new Promise(resolve => {
      this._resolve = resolve;
      const m = $('confirm-modal');
      $('confirm-title').textContent = title || 'Are you sure?';
      $('confirm-msg').textContent   = msg   || '';
      $('confirm-icon').textContent  = icon  || '⚠️';
      const okBtn = $('confirm-ok-btn');
      okBtn.textContent = okLabel || 'Confirm';
      okBtn.style.background = okColor || 'var(--blue)';
      const prev = $('confirm-preview');
      if (preview) { prev.style.display = 'block'; prev.innerHTML = preview; }
      else prev.style.display = 'none';
      m.style.display = 'flex';
    });
  },
  ok()     { const m = $('confirm-modal'); if (m) m.style.display = 'none'; if (this._resolve) this._resolve(true);  this._resolve = null; },
  cancel() { const m = $('confirm-modal'); if (m) m.style.display = 'none'; if (this._resolve) this._resolve(false); this._resolve = null; }
};

// ── NOTIFICATIONS & TOASTS ──
let notifTimer = null;

function pushNotif(title, sub) {
  S.notifs.unshift({title, sub, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})});
  renderNotifs();
  showToast(title, sub);
  if (Notification.permission === 'granted') {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification('SwiftStake: ' + title, {body: sub})).catch(() => {});
    } else {
      try { new Notification('SwiftStake: ' + title, {body: sub}); } catch(e) {}
    }
  }
}

function showToast(title, sub) {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    wrap.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:90%;max-width:360px;';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.style.cssText = 'background:#1e293b;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 16px;color:#f1f5f9;font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,0.4);opacity:0;transform:translateY(12px);transition:all 0.25s ease;max-width:100%;word-break:break-word;';
  t.innerHTML = '<span>' + title + '</span>' + (sub ? '<span style="font-weight:400;color:#94a3b8;margin-left:6px;font-size:12px;">' + sub + '</span>' : '');
  wrap.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(12px)'; setTimeout(() => t.remove(), 300); }, 3500);
}

function renderNotifs() {
  const el = $('notiflist'); if (!el) return;
  $('belldot').classList.toggle('on', S.notifs.length > 0);
  if (!S.notifs.length) { el.innerHTML = '<div class="notifempty">No notifications</div>'; return; }
  el.innerHTML = S.notifs.slice(0, 20).map(n =>
    `<div class="notifitem"><div class="notificon">${n.title.split(' ')[0]}</div><div><div class="ntitle">${n.title}</div><div class="nsub">${n.sub}</div><div class="ntime">${n.time}</div></div></div>`
  ).join('');
}

function toggleNotif() { $('notifpanel').classList.toggle('on'); $('belldot').classList.remove('on'); }
function clearNotifs() { S.notifs = []; renderNotifs(); $('notifpanel').classList.remove('on'); }

document.addEventListener('click', e => {
  if (!e.target.closest('.notifpanel') && !e.target.closest('.topbtn'))
    $('notifpanel').classList.remove('on');
});

function startNotifScheduler() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default' && !(/Mobi|Android/i.test(navigator.userAgent)))
    Notification.requestPermission();
  if (notifTimer) clearInterval(notifTimer);
  notifTimer = setInterval(() => {
    const hhmm = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    (S.planTasks.daily || []).forEach(t => { if (!t.done && t.due && t.due === hhmm) pushNotif('⏰ Task reminder', t.text); });
  }, 60000);
  setTimeout(() => {
    const n = (S.planTasks.daily || []).filter(t => !t.done).length;
    pushNotif('👋 Welcome, ' + sess.name.split(' ')[0] + '!', n + ' daily task' + (n !== 1 ? 's' : '') + ' pending');
  }, 1200);
}

// ── LIGHTBOX ──
function openLightbox(src) { const li = $('lbimg'); if (li) li.src = src; const lb = $('lightbox'); if (lb) lb.classList.add('on'); }
function closeLightbox()   { const lb = $('lightbox'); if (lb) lb.classList.remove('on'); }

// ── GAME MODAL ──
function openGameModal()  { const m = $('game-modal'); if (m) m.style.display = 'flex'; renderGameList(); }
function closeGameModal() { const m = $('game-modal'); if (m) m.style.display = 'none'; }

function renderGameList() {
  const wrap = $('game-list-wrap'); if (!wrap) return;
  const builtIn = ['stellar','pilot','spin'];
  if (!GAMES.length) { wrap.innerHTML = '<div style="color:var(--txt3);font-size:13px;">No games.</div>'; return; }
  wrap.innerHTML = GAMES.map(g => {
    const isBuiltIn = builtIn.includes(g), label = g.charAt(0).toUpperCase() + g.slice(1).replace(/_/g, ' ');
    const tag = isBuiltIn
      ? '<span class="tag tag-blue">Built-in</span>'
      : `<button onclick="deleteGame(this.dataset.game)" data-game="${g}" class="redbtn">🗑️ Delete</button>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);"><span style="flex:1;font-weight:600;color:var(--txt);font-size:14px;">${label}</span>${tag}</div>`;
  }).join('');
}

async function addGame() {
  const inp = $('new-game-name'), msg = $('game-modal-msg');
  const rawName = inp ? inp.value.trim() : '';
  if (!rawName) { if (msg) { msg.textContent = '⚠️ Enter a game name.'; msg.style.color = 'var(--red)'; } return; }
  const name = rawName.toLowerCase().replace(/\s+/g, '_'), label = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  if (GAMES.includes(name)) { if (msg) { msg.textContent = '⚠️ Game already exists.'; msg.style.color = 'var(--red)'; } return; }
  const ok = await confirmModal.show('Add Game', 'Add "' + label + '" to all shops?', '✅ Add Game', 'var(--green)', '🎮');
  if (!ok) return;
  GAMES.push(name);
  Object.keys(S.shopData).forEach(sh => { if (!S.shopData[sh].games[name]) S.shopData[sh].games[name] = {open:0, close:0, topups:[]}; });
  if (inp) inp.value = '';
  if (msg) { msg.textContent = '✅ "' + label + '" added!'; msg.style.color = 'var(--green)'; }
  renderGameList();
  SHOPS.forEach(sh => saveShopState(sh));
  if ($('pane-finance') && $('pane-finance').classList.contains('on')) renderFinance();
  setTimeout(() => { const m = $('game-modal-msg'); if (m) m.textContent = ''; }, 3000);
}

async function deleteGame(name) {
  const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
  const ok = await confirmModal.show('Delete Game', 'Delete "' + label + '"? Historical reports are kept.', '🗑️ Delete', 'var(--red)', '⚠️');
  if (!ok) return;
  const idx = GAMES.indexOf(name); if (idx > -1) GAMES.splice(idx, 1);
  Object.keys(S.shopData).forEach(sh => { delete S.shopData[sh].games[name]; });
  renderGameList();
  SHOPS.forEach(sh => saveShopState(sh));
  if ($('pane-finance') && $('pane-finance').classList.contains('on')) renderFinance();
  const msg = $('game-modal-msg');
  if (msg) { msg.textContent = '✅ "' + label + '" deleted.'; msg.style.color = 'var(--green)'; }
  setTimeout(() => { const m = $('game-modal-msg'); if (m) m.textContent = ''; }, 3000);
}

// ── SAVE ON HIDE / UNLOAD ──
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && sess.name) SHOPS.forEach(sh => saveShopState(sh));
});
window.addEventListener('beforeunload', () => {
  if (sess.name) { saveInputs(); SHOPS.forEach(sh => saveShopState(sh)); }
});

// ── PRIVACY TOGGLE (Revenue visibility) ──
const PrivacyMode = {
  isHidden(key) {
    const hidden = JSON.parse(localStorage.getItem('privacy_hidden') || '{}');
    return hidden[key] === true;
  },
  toggle(key) {
    const hidden = JSON.parse(localStorage.getItem('privacy_hidden') || '{}');
    hidden[key] = !hidden[key];
    localStorage.setItem('privacy_hidden', JSON.stringify(hidden));
    return hidden[key];
  },
  formatValue(amount, key) {
    if (this.isHidden(key)) return 'KES ••••';
    return 'KES ' + fmt(N(amount));
  },
  getToggleHtml(key, amount) {
    const isHidden = this.isHidden(key);
    return `<span class="privacy-val" id="privacy-${key}">${this.formatValue(amount, key)}</span><button class="privacy-toggle" onclick="togglePrivacy('${key}',event)" style="background:none;border:none;cursor:pointer;font-size:14px;padding:4px;color:var(--txt3);">${isHidden ? '👁️' : '👁️‍🗨️'}</button>`;
  }
};

function togglePrivacy(key, e) {
  e.preventDefault();
  e.stopPropagation();
  PrivacyMode.toggle(key);
  const el = $('privacy-' + key);
  if (el) {
    const parent = e.target.parentElement;
    const amount = parent.dataset.amount;
    el.textContent = PrivacyMode.formatValue(amount, key);
  }
  const btn = e.target;
  const isHidden = PrivacyMode.isHidden(key);
  btn.textContent = isHidden ? '👁️' : '👁️‍🗨️';
}
