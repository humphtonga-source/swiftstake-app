function recalcDebounced() {
  clearTimeout(window._recalcTimer);
  window._recalcTimer = setTimeout(recalc, 500);
}

// ── DATA PERSISTENCE HELPERS ──
function ensureShopDataExists(shop) {
  if (!S.shopData) S.shopData = {};
  if (!S.shopData[shop]) {
    S.shopData[shop] = {
      games: {},
      expenses: [],
      openingCash: 0,
      cashRecon: null,
      cashMovements: [],
      openedAt: null
    };
    // Initialize all games
    GAMES.forEach(g => {
      S.shopData[shop].games[g] = {open: 0, close: 0, topups: []};
    });
  }
  return S.shopData[shop];
}

function autoSaveShopState(shop) {
  clearTimeout(window._autoSaveTimer);
  window._autoSaveTimer = setTimeout(() => {
    saveInputs();
    saveShopState(shop);
  }, 1000);
}

// ── FINANCE ──
async function saveShopState(shop, skip) {
  if (!skip && shop === activeShop && !_resetting) saveInputs();
  const d = ensureShopDataExists(shop);
  if (!d) return;
  try {
    const p = {
      shop, games: d.games,
      expenses: Array.isArray(d.expenses) ? d.expenses : [],
      opening_cash: d.openingCash || 0,
      cash_recon: d.cashRecon || null,
      cash_movements: Array.isArray(d.cashMovements) ? d.cashMovements : [],
      opened_at: d.openedAt || null,
      updated_at: new Date().toISOString()
    };
    const {data:u, error:e} = await db.from('shop_state').eq('shop', shop).update(p);
    if (e || !u || !u.length) await db.from('shop_state').insert(p);
  } catch(e) {
    logError('saveShopState', e, {shop});
    // Non-critical - offline mode should continue working
  }
}

function updateOpenedAtDisplay() {
  const d = S.shopData[activeShop], el = $('opened-at-display'), btn = $('mark-open-btn');
  if (!el) return;
  if (d && d.openedAt) {
    const t = new Date(d.openedAt);
    el.innerHTML = '<span style="color:var(--green);">● Opened at <strong>' + t.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'}) + '</strong></span>';
    if (btn) btn.style.display = 'none';
  } else {
    el.innerHTML = '<span style="color:var(--txt3);">Not yet marked as opened</span>';
    if (btn) btn.style.display = 'block';
  }
}

async function markShopOpened() {
  S.shopData[activeShop].openedAt = new Date().toISOString();
  updateOpenedAtDisplay();
  await saveShopState(activeShop, true);
}

function renderFinance() {
  const pane = $('pane-finance'); if (!pane) return;
  if (!sess.perms.finance) {
    pane.innerHTML = '<div class="denied"><div class="dico">🔒</div><h3>Finance access restricted</h3><p>Contact your manager.</p></div>';
    return;
  }
  if (!sess.isAdmin) activeShop = sess.shop;

  const shopTabsHTML = sess.isAdmin
    ? `<div class="shoptabs">${SHOPS.map(s => `<button class="stab${s === activeShop ? ' act' : ''}" onclick="switchShop(this,'${s}')">${s}</button>`).join('')}<button class="stab" style="background:var(--greenl);color:var(--green);" onclick="goTab('settings',document.getElementById('nav-settings'))">⚙️ Shops</button><button class="stab" style="background:var(--purplel);color:var(--purple);" onclick="openGameModal()">🎮 Games</button></div>`
    : `<div class="ibar ibar-blue">📍 Viewing finances for <strong>${sess.shop}</strong> only.</div>`;

  pane.innerHTML = `
  <div class="ph"><div class="ph-icon">📊</div><h2>Daily Finances</h2>
    <div class="phr">
      <span style="font-size:12px;color:var(--txt3);">${new Date().toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short'})}</span>
      <button class="sbtn" onclick="exportCurrent()">📄 Export</button>
      <button class="goldbtn" onclick="submitReport()">✅ Submit Day</button>
    </div>
  </div>
  ${shopTabsHTML}
  <div id="shop-display" style="font-size:12px;color:var(--txt3);margin-bottom:14px;"></div>

  <div class="card" style="border-color:rgba(245,158,11,0.3);">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="font-size:14px;font-weight:700;color:var(--gold);">☀️ Opening Cash Float</span>
      <button id="push-opening-btn" onclick="pushSection('opening')" style="margin-left:auto;padding:5px 12px;background:var(--bluel);color:var(--blue);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius2);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;"><span>🔄</span><span>Push to Admin</span></button>
    </div>
    <input type="number" id="opening-cash-inp" class="fl-inp" placeholder="e.g. 5000" min="0" style="font-size:18px;font-weight:800;color:var(--gold);border-color:rgba(245,158,11,0.4);" oninput="if(this.value<0)this.value=0;S.shopData[activeShop].openingCash=N(this.value);recalcDebounced();autoSaveShopState(activeShop);" onblur="if(this.value<0)this.value=0;S.shopData[activeShop].openingCash=N(this.value);saveShopState(activeShop);">
    <div id="opened-at-display" style="font-size:11px;margin-top:6px;"></div>
    <button onclick="markShopOpened()" id="mark-open-btn" style="margin-top:8px;width:100%;padding:6px 0;border:1px dashed rgba(245,158,11,0.4);border-radius:6px;background:transparent;color:var(--gold);font-size:11px;font-weight:700;cursor:pointer;">🕐 Mark as Opened Now</button>
    <div id="push-opening-status" style="font-size:11px;margin-top:6px;min-height:14px;"></div>
  </div>

  <div class="metrics">
    <div class="mc"><div class="mclbl">Game Revenue</div><div class="mcval pos" id="s-rev">KES 0</div></div>
    <div class="mc"><div class="mclbl">Expenses</div><div class="mcval neg" id="s-exp">KES 0</div></div>
    <div class="mc mc-accent" style="grid-column:1/-1;"><div class="mclbl">Net Today</div><div class="mcval" id="s-net">KES 0</div></div>
  </div>

  <div class="cashmov-card">
    <div class="cardtitle">💵 Cash / M-Pesa Movement
      ${!sess.isAdmin ? '<span style="margin-left:auto;font-size:11px;font-weight:400;color:var(--txt3);">Admin-managed · live</span>' : ''}
    </div>
    ${sess.isAdmin ? `
    <div class="cashmov-btns"><button class="cashmov-btn add" onclick="showCashMovForm('add')">➕ Add Cash / M-Pesa</button><button class="cashmov-btn withdraw" onclick="showCashMovForm('withdraw')">💸 Withdraw</button></div>
    <div id="cashmov-form" class="cashmov-form">
      <div id="cashmov-form-title" style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--green);">Adding cash to shop</div>
      <div class="fr2" style="margin-bottom:10px;"><div><label class="fl-lbl">Amount (KES)</label><input type="number" id="cashmov-amt" class="fl-inp" placeholder="e.g. 5000" min="1"></div><div><label class="fl-lbl">Type</label><select id="cashmov-type" class="fl-inp"><option value="cash">Hard Cash</option><option value="mpesa">M-Pesa</option></select></div></div>
      <div style="margin-bottom:10px;"><label class="fl-lbl">Reason (optional)</label><input type="text" id="cashmov-note" class="fl-inp" placeholder="Reason..."></div>
      <div style="display:flex;gap:8px;"><button id="cashmov-confirm-btn" onclick="confirmCashMov()" style="padding:10px 18px;border:none;border-radius:var(--radius2);background:var(--green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✅ Confirm</button><button onclick="hideCashMovForm()" style="padding:10px 14px;border:1px solid var(--border2);border-radius:var(--radius2);background:transparent;font-size:13px;color:var(--txt2);cursor:pointer;">Cancel</button></div>
    </div>` : ''}
    <div id="cashmov-log" class="cashmov-log"></div>
  </div>

  ${GAMES.map(g => gameCardHTML(g)).join('')}

  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
      <span class="cardtitle" style="margin-bottom:0;">💸 Daily Expenses</span>
      <button id="push-expenses-btn" onclick="pushSection('expenses')" style="margin-left:auto;padding:5px 12px;background:var(--bluel);color:var(--blue);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius2);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;"><span>🔄</span><span>Push to Admin</span></button>
    </div>
    <div id="push-expenses-status" style="font-size:11px;margin-bottom:8px;min-height:14px;"></div>
    <div id="explist" style="margin-top:6px;"></div>
    <button class="addexp" onclick="addExp()">+ Add expense</button>
  </div>

  <div class="eodcard">
    <div class="eodtitle">📋 End of Day Summary</div>
    <div class="eodrow"><span class="eodlbl">Opening Cash Float</span><span class="eodval" id="eod-ocash">KES 0</span></div>
    <div class="eodrow"><span class="eodlbl">Admin Top-ups</span><span class="eodval gold" id="eod-topup">KES 0</span></div>
    <div class="eodrow"><span class="eodlbl">Cash/M-Pesa Added</span><span class="eodval gold" id="eod-cashadd">KES 0</span></div>
    <div class="eodrow"><span class="eodlbl">Cash/M-Pesa Withdrawn</span><span class="eodval red" id="eod-cashwith">KES 0</span></div>
    <div class="eodrow"><span class="eodlbl">Total Game Revenue</span><span class="eodval" id="eod-rev">KES 0</span></div>
    <div class="eodrow"><span class="eodlbl">Total Expenses</span><span class="eodval" id="eod-exp">KES 0</span></div>
    <div class="eodrow total"><span class="eodlbl">NET TOTAL</span><span class="eodval" id="eod-net">KES 0</span></div>
  </div>

  <div class="reconcard">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span class="cardtitle" style="color:var(--gold);margin-bottom:0;">💼 Cash Reconciliation</span>
      <button id="push-recon-btn" onclick="pushSection('recon')" style="margin-left:auto;padding:5px 12px;background:var(--bluel);color:var(--blue);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius2);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;"><span>🔄</span><span>Push to Admin</span></button>
    </div>
    <div id="push-recon-status" style="font-size:11px;margin-bottom:8px;min-height:14px;"></div>
    <div class="ibar">Opening Float + Revenue − Expenses = Expected Float. Compare to physical cash + M-Pesa.</div>
    <div class="recongrid">
      <div class="reconmc" style="background:var(--greenl);border:1px solid rgba(34,197,94,0.2);"><div class="fl-lbl" style="color:var(--green);">💵 Physical Cash (KES)</div><input type="number" id="recon-cash" class="fl-inp" placeholder="0" min="0" oninput="doRecon()" style="margin-top:6px;font-size:18px;font-weight:800;border-color:rgba(34,197,94,0.4);background:var(--bg2);"></div>
      <div class="reconmc" style="background:var(--bluel);border:1px solid rgba(59,130,246,0.2);"><div class="fl-lbl" style="color:var(--blue);">📱 M-Pesa (KES)</div><input type="number" id="recon-mpesa" class="fl-inp" placeholder="0" min="0" oninput="doRecon()" style="margin-top:6px;font-size:18px;font-weight:800;border-color:rgba(59,130,246,0.4);background:var(--bg2);"></div>
      <div class="reconmc" style="background:var(--surface2);border:1px solid var(--border);"><div class="fl-lbl">🎯 Expected Float (KES)</div><div id="recon-expected" style="font-size:20px;font-weight:800;color:var(--txt);margin-top:8px;">KES 0</div><div id="recon-diff" style="font-size:12px;font-weight:700;margin-top:6px;color:var(--txt3);">Enter amounts to check</div></div>
    </div>
    <div id="recon-result" style="margin-top:6px;"></div>
  </div>
  <button class="submitbtn" onclick="submitReport()">✅ Submit End of Day Report</button>`;

  loadShopData(activeShop);
}

function gameCardHTML(g) {
  const label = g.charAt(0).toUpperCase() + g.slice(1).replace(/_/g, ' ');
  const _bm = {stellar:'gb-s', pilot:'gb-p', spin:'gb-sp'}; const badge = _bm[g] || 'gb-custom';
  return `<div class="gamecard">
    <div class="gchead" onclick="toggleGame('${g}-body')">
      <span class="gbadge ${badge}">${g.toUpperCase()}</span>
      <span class="gname">${label}</span>
      <span class="grev" id="grev-${g}">Revenue: KES 0</span>
      <span style="margin-left:6px;font-size:11px;color:var(--txt3);">▼</span>
    </div>
    <div id="${g}-body" class="gcbody">
      <div class="fr2">
        <div><label class="fl-lbl">Opening Float (KES)</label><input type="number" class="fl-inp" id="${g}-open" placeholder="0" oninput="if(this.value<0)this.value=0;const game='${g}';S.shopData[activeShop].games[game].open=N(this.value);recalcDebounced();autoSaveShopState(activeShop);" onblur="if(this.value<0)this.value=0;const game='${g}';S.shopData[activeShop].games[game].open=N(this.value);saveShopState(activeShop)" min="0"></div>
        <div><label class="fl-lbl">Closing Float (KES)</label><input type="number" class="fl-inp" id="${g}-close" placeholder="0" oninput="if(this.value<0)this.value=0;const game='${g}';S.shopData[activeShop].games[game].close=N(this.value);recalcDebounced();autoSaveShopState(activeShop);" onblur="if(this.value<0)this.value=0;const game='${g}';S.shopData[activeShop].games[game].close=N(this.value);saveShopState(activeShop)" min="0"></div>
      </div>
      <div class="gres" id="gres-${g}">Enter opening and closing float above</div>
      <div id="topup-log-${g}"></div><div id="topup-notice-${g}"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <button id="push-game-${g}-btn" onclick="pushSection('game:${g}')" style="padding:5px 12px;background:var(--bluel);color:var(--blue);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius2);font-size:11px;font-weight:700;cursor:pointer;">🔄 Push ${label} to Admin</button>
        <span id="push-game-${g}-status" style="font-size:11px;"></span>
      </div>
      ${sess.isAdmin ? `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button style="flex:1;padding:9px;border:1px solid rgba(34,197,94,0.3);border-radius:var(--radius2);background:var(--greenl);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;" onclick="showTopupForm('${g}','add')">💵 Add Float</button>
        <button style="flex:1;padding:9px;border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius2);background:var(--redl);color:var(--red);font-size:13px;font-weight:700;cursor:pointer;" onclick="showTopupForm('${g}','withdraw')">💸 Withdraw</button>
      </div>
      <div id="topupform-${g}" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:14px;margin-top:10px;">
        <div id="topupform-title-${g}" style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:10px;">Adding float to ${g.toUpperCase()}</div>
        <div class="fr2"><input type="number" id="topup-amt-${g}" placeholder="Amount (KES)" min="1" class="fl-inp"><input type="text" id="topup-note-${g}" placeholder="Reason (optional)" class="fl-inp"></div>
        <div style="display:flex;gap:8px;margin-top:10px;"><button id="topup-confirm-btn-${g}" onclick="confirmTopup('${g}','add')" style="padding:9px 16px;background:var(--green);color:#fff;border:none;border-radius:var(--radius2);font-size:13px;font-weight:700;cursor:pointer;">✅ Confirm</button><button onclick="hideTopupForm('${g}')" style="padding:9px 12px;border:1px solid var(--border2);border-radius:var(--radius2);background:transparent;font-size:13px;color:var(--txt2);cursor:pointer;">Cancel</button></div>
      </div>` : ''}
    </div>
  </div>`;
}

function toggleGame(id) { const el = $(id); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

function showTopupForm(g, mode) {
  const f = $('topupform-' + g), tEl = $('topupform-title-' + g), bEl = $('topup-confirm-btn-' + g), aEl = $('topup-amt-' + g), nEl = $('topup-note-' + g);
  if (!f) return; const isAdd = mode === 'add';
  if (tEl) { tEl.textContent = (isAdd ? 'Adding float to ' : 'Withdrawing from ') + g.toUpperCase(); tEl.style.color = isAdd ? 'var(--green)' : 'var(--red)'; }
  if (aEl) { aEl.value = ''; aEl.style.borderColor = isAdd ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'; }
  if (nEl) { nEl.value = ''; nEl.style.borderColor = isAdd ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'; }
  if (bEl) { bEl.textContent = isAdd ? '✅ Confirm Add' : '💸 Confirm Withdraw'; bEl.style.background = isAdd ? 'var(--green)' : 'var(--red)'; bEl.onclick = () => confirmTopup(g, mode); }
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
function hideTopupForm(g) { const f = $('topupform-' + g); if (f) f.style.display = 'none'; }

async function confirmTopup(g, mode) {
  const aEl = $('topup-amt-' + g), nEl = $('topup-note-' + g), amt = N(aEl ? aEl.value : 0);
  if (amt <= 0) { alert('Enter a valid amount.'); return; }
  const isW = mode === 'withdraw';
  const ok = await confirmModal.show(isW ? 'Withdraw Float' : 'Add Float', 'Confirm KES ' + fmt(amt) + ' ' + (isW ? 'withdrawal from' : 'top-up for') + ' ' + g.toUpperCase() + '?', isW ? '💸 Confirm' : '✅ Confirm', isW ? 'var(--red)' : 'var(--green)', isW ? '💸' : '💵');
  if (!ok) return;
  const note = nEl ? nEl.value.trim() : '';

  const beforeSnap = AuditLog.snapshot('game:' + g, S.shopData[activeShop]);

  const topup = {amount: isW ? -amt : amt, note: note || (isW ? 'Float withdrawal' : 'Float top-up'), by: sess.name, type: isW ? 'withdraw' : 'add', time: new Date().toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})};
  if (!S.shopData[activeShop].games[g].topups) S.shopData[activeShop].games[g].topups = [];
  S.shopData[activeShop].games[g].topups.push(topup);
  if (aEl) aEl.value = ''; if (nEl) nEl.value = '';
  hideTopupForm(g); renderTopupLog(g); recalc(); saveShopState(activeShop);

  const afterSnap = AuditLog.snapshot('game:' + g, S.shopData[activeShop]);
  await AuditLog.record(isW ? 'remove' : 'add', activeShop, 'float:' + g,
    beforeSnap, afterSnap + ` | ${isW ? '−' : '+'}KES ${fmt(amt)} "${note || (isW ? 'Float withdrawal' : 'Float top-up')}"`);

  pushNotif(isW ? '💸 Float withdrawn' : '💰 Float added', g.toUpperCase() + ': KES ' + fmt(amt));
}

function renderTopupLog(g) {
  const logEl = $('topup-log-' + g), noticeEl = $('topup-notice-' + g);
  const gd = S.shopData[activeShop].games[g] || {}, topups = Array.isArray(gd.topups) ? gd.topups : [];
  const adds = topups.filter(t => N(t.amount) > 0).reduce((s,t) => s + N(t.amount), 0);
  const withdraws = Math.abs(topups.filter(t => N(t.amount) < 0).reduce((s,t) => s + N(t.amount), 0));
  if (logEl && topups.length) {
    let h = `<div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;margin-bottom:6px;">Float Movements`;
    if (adds > 0)      h += ` <span class="tag tag-green">+KES ${fmt(adds)}</span>`;
    if (withdraws > 0) h += ` <span class="tag tag-red">−KES ${fmt(withdraws)}</span>`;
    h += '</div>';
    logEl.innerHTML = h + topups.map((t,i) => {
      const isW = N(t.amount) < 0, absAmt = Math.abs(N(t.amount));
      return `<div class="topupentry ${isW ? 'with' : 'add'}"><span class="topupamt" style="color:${isW ? 'var(--red)' : 'var(--green)'};">${isW ? '−' : '+'} KES ${fmt(absAmt)}</span><span style="flex:1;color:var(--txt2);font-size:12px;">${t.note||''} · ${t.by}</span><span style="font-size:11px;color:var(--txt3);">${t.time}</span>${sess.isAdmin ? `<button onclick="removeTopup('${g}',${i})" style="padding:2px 6px;border:1px solid ${isW ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'};border-radius:4px;background:transparent;color:var(--red);font-size:10px;cursor:pointer;">✕</button>` : ''}</div>`;
    }).join('');
  } else if (logEl) logEl.innerHTML = '';
  if (noticeEl && !sess.isAdmin && topups.length) {
    const net = adds - withdraws;
    noticeEl.innerHTML = `<div class="ibar" style="margin-top:8px;">💰 Admin float: <strong>${net >= 0 ? '+' : '−'}KES ${fmt(Math.abs(net))}</strong> on ${g.toUpperCase()}</div>`;
  } else if (noticeEl) noticeEl.innerHTML = '';
}

async function removeTopup(g, i) {
  const ok = await confirmModal.show('Remove Float Entry','Remove this float movement?','🗑️ Remove','var(--red)','💸');
  if (!ok) return;
  const beforeSnap = AuditLog.snapshot('game:' + g, S.shopData[activeShop]);
  const removed = S.shopData[activeShop].games[g].topups[i];
  S.shopData[activeShop].games[g].topups.splice(i, 1);
  renderTopupLog(g); recalc(); saveShopState(activeShop);
  await AuditLog.record('remove', activeShop, 'float:' + g,
    beforeSnap,
    `Removed entry: ${removed ? (N(removed.amount) > 0 ? '+' : '') + 'KES ' + fmt(Math.abs(N(removed.amount))) + ' "' + (removed.note || '') + '" by ' + (removed.by || '?') : 'entry ' + i}`);
}

let _resetting = false;

// ✅ FIX: Improved saveInputs with shop existence check
function saveInputs() {
  if (_resetting) return;
  const shop = activeShop;
  ensureShopDataExists(shop);
  const d = S.shopData[shop];
  
  const oci = $('opening-cash-inp'); 
  if (oci && oci.value !== '') d.openingCash = N(oci.value);
  
  GAMES.forEach(g => {
    if (!d.games[g]) d.games[g] = {open:0, close:0, topups:[]};
    const oi = $(`${g}-open`), ci = $(`${g}-close`);
    if (oi && oi.value !== '') d.games[g].open  = N(oi.value);
    if (ci && ci.value !== '') d.games[g].close = N(ci.value);
  });
  
  const rows = document.querySelectorAll('#explist .exprow');
  rows.forEach((row, i) => {
    if (d.expenses[i]) {
      const descEl = row.querySelector('input[type="text"]'), amtEl = row.querySelector('input[type="number"]');
      if (descEl) d.expenses[i].desc   = descEl.value;
      if (amtEl) d.expenses[i].amount = parseFloat(amtEl.value) || 0;
    }
  });
}

function loadShopData(shop) {
  ensureShopDataExists(shop);
  const sd = $('shop-display');
  if (sd) sd.textContent = shop + ' — ' + new Date().toLocaleDateString('en-KE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const d = S.shopData[shop];
  
  requestAnimationFrame(() => {
    const oci = $('opening-cash-inp'); 
    if (oci) oci.value = (d.openingCash && d.openingCash > 0) ? d.openingCash : '';
    
    GAMES.forEach(g => {
      if (!d.games[g]) d.games[g] = {open:0, close:0, topups:[]};
      const gd = d.games[g], oi = $(`${g}-open`), ci = $(`${g}-close`);
      if (oi) oi.value = (gd.open  && gd.open  > 0) ? gd.open  : '';
      if (ci) ci.value = (gd.close && gd.close > 0) ? gd.close : '';
      renderTopupLog(g);
    });
    
    const rc = $('recon-cash'), rm = $('recon-mpesa');
    if (d.cashRecon) {
      if (rc && d.cashRecon.cash)    rc.value = d.cashRecon.cash;
      if (rm && d.cashRecon.mpesa)   rm.value = d.cashRecon.mpesa;
    } else {
      if (rc) rc.value = '';
      if (rm) rm.value = '';
      const re = $('recon-expected'), rd = $('recon-diff'), rr = $('recon-result');
      if (re) re.textContent = 'KES 0';
      if (rd) { rd.textContent = 'Enter amounts to check'; rd.style.color = 'var(--txt3)'; }
      if (rr) rr.innerHTML = '';
    }
    renderExpList(); renderCashMovLog(); updateCashMovEOD(); updateOpenedAtDisplay(); recalc();
  });
}

async function switchShop(el, shop) {
  if (!sess.isAdmin) return;
  saveInputs(); 
  await saveShopState(activeShop);
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('act'));
  if (el) el.classList.add('act');
  
  _resetting = true; activeShop = shop;
  const oci = $('opening-cash-inp'); if (oci) oci.value = '';
  GAMES.forEach(g => {
    const oi = $(`${g}-open`), ci = $(`${g}-close`);
    if (oi) oi.value = ''; if (ci) ci.value = '';
    const logEl = $('topup-log-' + g), noticeEl = $('topup-notice-' + g), gresEl = $('gres-' + g), grevEl = $('grev-' + g);
    if (logEl) logEl.innerHTML = ''; if (noticeEl) noticeEl.innerHTML = '';
    if (gresEl) gresEl.textContent = 'Enter opening and closing float above';
    if (grevEl) grevEl.textContent = 'Revenue: KES 0';
  });
  const explist = $('explist'); if (explist) explist.innerHTML = '';
  const cashmovlog = $('cashmov-log'); if (cashmovlog) cashmovlog.innerHTML = '';
  ['s-rev','s-exp','eod-ocash','eod-topup','eod-rev','eod-exp','eod-net','eod-cashadd','eod-cashwith'].forEach(id => { const e = $(id); if (e) e.textContent = 'KES 0'; });
  const sn = $('s-net'); if (sn) { sn.textContent = 'KES 0'; sn.className = 'mcval'; }
  
  await refreshShopData(shop);
  _resetting = false; 
  renderFinance(); 
  setTimeout(() => loadShopData(shop), 80);
}

async function refreshShopData(shop) {
  try {
    const {data, error} = await db.from('shop_state').eq('shop', shop).select('*');
    if (error) throw error;
    if (!data || !data.length) {
      ensureShopDataExists(shop);
      return;
    }
    const row = JSON.parse(JSON.stringify(data[0]));
    ensureShopDataExists(shop);
    S.shopData[shop].games = row.games && Object.keys(row.games).length ? row.games : {stellar:{open:0,close:0,topups:[]},pilot:{open:0,close:0,topups:[]},spin:{open:0,close:0,topups:[]}};
    S.shopData[shop].expenses = Array.isArray(row.expenses) ? row.expenses : [];
    S.shopData[shop].openingCash = row.opening_cash || 0;
    S.shopData[shop].cashRecon = row.cash_recon || null;
    S.shopData[shop].cashMovements = Array.isArray(row.cash_movements) ? row.cash_movements : [];
    S.shopData[shop].openedAt = row.opened_at || null;
    if (row.games) Object.keys(row.games).forEach(g => { if (!GAMES.includes(g)) GAMES.push(g); });
  } catch(e) {
    logError('refreshShopData', e, {shop});
    ensureShopDataExists(shop);
  }
}

let _cashMovMode = 'add';
function showCashMovForm(mode) {
  _cashMovMode = mode;
  const form = $('cashmov-form'), title = $('cashmov-form-title'), btn = $('cashmov-confirm-btn'), amt = $('cashmov-amt'), note = $('cashmov-note');
  if (!form) return;
  if (form.style.display === 'block' && form.dataset.mode === mode) { hideCashMovForm(); return; }
  form.dataset.mode = mode; const isAdd = mode === 'add'; form.style.display = 'block';
  if (title) { title.textContent = (isAdd ? '➕ Adding cash to ' : '💸 Withdrawing from ') + activeShop; title.style.color = isAdd ? 'var(--green)' : 'var(--red)'; }
  if (btn)   { btn.textContent = isAdd ? '✅ Confirm Add' : '💸 Confirm Withdraw'; btn.style.background = isAdd ? 'var(--green)' : 'var(--red)'; }
  if (amt)   { amt.value = ''; amt.style.borderColor = isAdd ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'; }
  if (note)  { note.value = ''; note.style.borderColor = isAdd ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'; }
  if (amt) amt.focus();
}
function hideCashMovForm() { const f = $('cashmov-form'); if (f) { f.style.display = 'none'; f.dataset.mode = ''; } }

async function confirmCashMov() {
  const amt = N($('cashmov-amt') ? $('cashmov-amt').value : 0); if (amt <= 0) { alert('Enter a valid amount.'); return; }
  const type = $('cashmov-type') ? $('cashmov-type').value : 'cash', note = $('cashmov-note') ? $('cashmov-note').value.trim() : '';
  const isAdd = _cashMovMode === 'add';
  const ok = await confirmModal.show(isAdd ? 'Add Cash' : 'Withdraw Cash', 'Confirm KES ' + fmt(amt) + ' ' + (type === 'mpesa' ? 'M-Pesa' : 'Cash') + ' ' + (isAdd ? 'addition' : 'withdrawal') + '?', isAdd ? '✅ Confirm' : '💸 Confirm', isAdd ? 'var(--green)' : 'var(--red)', isAdd ? '💵' : '💸');
  if (!ok) return;
  const movement = {amount: isAdd ? amt : -amt, type, mode: _cashMovMode, note: note || (isAdd ? 'Cash added' : 'Cash withdrawn'), by: sess.name, time: new Date().toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})};
  ensureShopDataExists(activeShop);
  if (!S.shopData[activeShop].cashMovements) S.shopData[activeShop].cashMovements = [];
  const beforeSnap = AuditLog.snapshot('cashMovements', S.shopData[activeShop]);
  S.shopData[activeShop].cashMovements.push(movement);
  hideCashMovForm(); renderCashMovLog(); updateCashMovEOD(); recalc(); saveShopState(activeShop);
  await AuditLog.record(isAdd ? 'add' : 'remove', activeShop, 'cashMovement',
    beforeSnap,
    `${isAdd ? '+' : '−'}KES ${fmt(amt)} ${type === 'mpesa' ? 'M-Pesa' : 'Cash'} "${note || (isAdd ? 'Cash added' : 'Cash withdrawn')}"`);
  pushNotif(isAdd ? '💵 Cash added — ' + activeShop : '💸 Cash withdrawn', type === 'mpesa' ? 'M-Pesa' : 'Cash' + ': KES ' + fmt(amt));
}

async function removeCashMov(i) {
  const ok = await confirmModal.show('Remove Movement','Remove this cash movement?','🗑️ Remove','var(--red)','💸');
  if (!ok) return;
  const beforeSnap = AuditLog.snapshot('cashMovements', S.shopData[activeShop]);
  const removed = S.shopData[activeShop].cashMovements[i];
  S.shopData[activeShop].cashMovements.splice(i, 1);
  renderCashMovLog(); updateCashMovEOD(); recalc(); saveShopState(activeShop);
  await AuditLog.record('remove', activeShop, 'cashMovement',
    beforeSnap,
    `Removed: ${removed ? (N(removed.amount) > 0 ? '+' : '') + 'KES ' + fmt(Math.abs(N(removed.amount))) + ' ' + (removed.type || '') + ' "' + (removed.note || '') + '"' : 'entry ' + i}`);
}

function renderCashMovLog() {
  const logEl = $('cashmov-log'); if (!logEl) return;
  const movs = S.shopData[activeShop].cashMovements || [];
  if (!movs.length) { logEl.innerHTML = '<div style="font-size:12px;color:var(--txt3);padding:4px 0;">No cash movements today.</div>'; return; }
  const tA = movs.filter(m => m.amount > 0).reduce((s,m) => s + m.amount, 0);
  const tW = Math.abs(movs.filter(m => m.amount < 0).reduce((s,m) => s + m.amount, 0));
  let html = `<div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;margin-bottom:8px;">Cash Movements ${tA ? `<span class="tag tag-green">+KES ${fmt(tA)}</span>` : ''}${tW ? `<span class="tag tag-red">−KES ${fmt(tW)}</span>` : ''}</div>`;
  html += movs.map((m,i) => {
    const isA = m.amount > 0, a = Math.abs(m.amount), ic = m.type === 'mpesa' ? '📱' : '💵';
    return `<div class="cashmov-entry ${isA ? 'add-entry' : 'withdraw-entry'}"><span class="cashmov-amt" style="color:${isA ? 'var(--green)' : 'var(--red)'};">${isA ? '+' : '−'} KES ${fmt(a)}</span><span class="cashmov-meta">${ic} ${m.note} · ${m.by}</span><span class="cashmov-time">${m.time}</span>${sess.isAdmin ? `<button onclick="removeCashMov(${i})" style="padding:2px 7px;border:1px solid ${isA ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};border-radius:5px;background:transparent;color:var(--red);font-size:11px;cursor:pointer;">✕</button>` : ''}</div>`;
  }).join('');
  logEl.innerHTML = html;
}

function updateCashMovEOD() {
  const m = S.shopData[activeShop].cashMovements || [];
  const a = $('eod-cashadd'), w = $('eod-cashwith');
  if (a) a.textContent = 'KES ' + fmt(m.filter(x => x.amount > 0).reduce((s,x) => s + x.amount, 0));
  if (w) w.textContent = 'KES ' + fmt(Math.abs(m.filter(x => x.amount < 0).reduce((s,x) => s + x.amount, 0)));
}

function recalc() {
  saveInputs(); 
  const d = S.shopData[activeShop];
  if (!d) return;
  
  let tO = 0, tT = 0, tW = 0, tR = 0;
  GAMES.forEach(g => {
    if (!d.games[g]) d.games[g] = {open:0, close:0, topups:[]};
    const gd = d.games[g], op = N(gd.open), cl = N(gd.close), ta = gd.topups || [];
    const adds = ta.filter(t => N(t.amount) > 0).reduce((s,t) => s + N(t.amount), 0);
    const withdraws = Math.abs(ta.filter(t => N(t.amount) < 0).reduce((s,t) => s + N(t.amount), 0));
    const eff = op + adds - withdraws, rev = eff - cl;
    tO += op; tT += adds; tW += withdraws; tR += rev;
    const gr = $(`gres-${g}`);
    if (gr) gr.innerHTML = `<span>Opening: <strong>KES ${fmt(op)}</strong></span>${adds ? `<span>Top-ups: <strong style="color:var(--green);">+KES ${fmt(adds)}</strong></span>` : ''}${withdraws ? `<span>Withdrawals: <strong style="color:var(--red);">−KES ${fmt(withdraws)}</strong></span>` : ''}<span>Effective: <strong>KES ${fmt(eff)}</strong></span><span>Closing: <strong>KES ${fmt(cl)}</strong></span><span>Revenue: <strong>KES ${fmt(rev)}</strong></span>`;
    const gv = $(`grev-${g}`);
    if (gv) { gv.textContent = `Revenue: KES ${fmt(rev)}`; gv.style.color = rev >= 0 ? 'var(--green)' : 'var(--red)'; }
  });
  
  const cashMov = d.cashMovements || [];
  const totalCashAdded = cashMov.filter(m => m.amount > 0).reduce((s,m) => s + m.amount, 0);
  const totalCashWithdrawn = Math.abs(cashMov.filter(m => m.amount < 0).reduce((s,m) => s + m.amount, 0));
  
  const tExp = (d.expenses || []).reduce((s,e) => s + N(e.amount), 0), ocash = N(d.openingCash);
  const net = ocash + tR + totalCashAdded - totalCashWithdrawn - tExp;
  const set = (id, v) => { const e = $(id); if (e) e.textContent = 'KES ' + fmt(v); };
  set('s-rev', tR); set('s-exp', tExp);
  const sn = $('s-net'); if (sn) { sn.textContent = 'KES ' + fmt(net); sn.className = 'mcval ' + (net >= 0 ? 'pos' : 'neg'); }
  set('eod-ocash', ocash); set('eod-topup', tT); set('eod-rev', tR); set('eod-exp', tExp); set('eod-net', net);
  doRecon();
  const shopAtCall = activeShop; clearTimeout(recalc._t);
  recalc._t = setTimeout(() => {
    saveInputs(); const d = S.shopData[shopAtCall];
    const has = d && (d.openingCash > 0 || d.expenses.length > 0 || GAMES.some(g => d.games[g] && (d.games[g].open > 0 || d.games[g].close > 0)));
    if (has) saveShopState(shopAtCall);
  }, 1500);
}

function doRecon() {
  const cEl = $('recon-cash'), mEl = $('recon-mpesa'), expEl = $('recon-expected'), diffEl = $('recon-diff'), resEl = $('recon-result');
  if (!expEl) return;
  const opening = N(S.shopData[activeShop] && S.shopData[activeShop].openingCash), cash = N(cEl ? cEl.value : 0), mpesa = N(mEl ? mEl.value : 0), d = S.shopData[activeShop];
  let gameRev = 0;
  GAMES.forEach(g => { const gd = d.games[g] || {}, topupsArr = gd.topups || [], nets = topupsArr.reduce((s,t) => s + N(t.amount), 0); gameRev += (N(gd.open) + nets) - N(gd.close); });
  
  const cashMov = d.cashMovements || [];
  const totalCashAdded = cashMov.filter(m => m.amount > 0).reduce((s,m) => s + m.amount, 0);
  const totalCashWithdrawn = Math.abs(cashMov.filter(m => m.amount < 0).reduce((s,m) => s + m.amount, 0));
  
  const expenses = (d.expenses || []).reduce((s,e) => s + N(e.amount), 0);
  const expected = opening + gameRev + totalCashAdded - totalCashWithdrawn - expenses, declared = cash + mpesa, diff = declared - expected, ok = Math.abs(diff) < 1;
  d.cashRecon = {opening, cash, mpesa, gameRev, cashAdded: totalCashAdded, cashWithdrawn: totalCashWithdrawn, expenses, expected, declared, diff, ok};
  if (expEl) expEl.textContent = 'KES ' + fmt(expected);
  const anyFilled = (cEl && cEl.value !== '') || (mEl && mEl.value !== '');
  if (!anyFilled) { if (diffEl) diffEl.textContent = 'Enter amounts to check'; if (resEl) resEl.innerHTML = ''; return; }
  if (diffEl && (cEl && cEl.value !== '' || mEl && mEl.value !== '')) {
    diffEl.textContent = ok ? '✅ Balanced' : diff > 0 ? '⚠️ +KES ' + fmt(diff) + ' over' : '⚠️ KES ' + fmt(Math.abs(diff)) + ' short';
    diffEl.style.color = ok ? 'var(--green)' : 'var(--red)';
  }
  if (!resEl) return;
  if ((!cEl || cEl.value === '') && (!mEl || mEl.value === '')) { resEl.innerHTML = ''; return; }
  resEl.innerHTML = `<div style="border:1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};border-radius:var(--radius2);overflow:hidden;"><div style="background:${ok ? 'var(--greenl)' : 'var(--redl)'};padding:14px 16px;display:flex;align-items:center;gap:12px;"><span style="font-size:32px;line-height:1;">${ok ? '✅' : '⚠️'}</span><div><div style="font-size:15px;font-weight:700;color:${ok ? 'var(--green)' : 'var(--red)'};">${ok ? 'Balanced — all money accounted for' : diff > 0 ? 'KES ' + fmt(diff) + ' OVER' : 'KES ' + fmt(Math.abs(diff)) + ' SHORT'}</div><div style="font-size:12px;color:var(--txt2);margin-top:3px;">Expected: <b>KES ${fmt(expected)}</b> · Declared: <b>KES ${fmt(declared)}</b></div></div></div></div>`;
}

// ✅ FIX: Improved addExp with shop check
function addExp() {
  ensureShopDataExists(activeShop);
  const beforeSnap = AuditLog.snapshot('expenses', S.shopData[activeShop]);
  S.shopData[activeShop].expenses.push({desc:'', amount:0});
  renderExpList();
  setTimeout(() => { const el = $('exp-desc-' + (S.shopData[activeShop].expenses.length - 1)); if (el) el.focus(); }, 100);
  saveShopState(activeShop);
  AuditLog.record('add', activeShop, 'expenses', beforeSnap, `Added new expense row (index ${S.shopData[activeShop].expenses.length - 1})`);
}

// ✅ FIX: Improved renderExpList with proper state management
function renderExpList() {
  const el = $('explist'); if (!el) return;
  const d = ensureShopDataExists(activeShop);
  const exps = d.expenses || [];
  el.innerHTML = '';
  exps.forEach((e, i) => {
    const row = document.createElement('div'); row.className = 'exprow';
    const d_input = document.createElement('input'); d_input.type = 'text'; d_input.placeholder = 'Description'; d_input.value = e.desc || ''; d_input.id = 'exp-desc-' + i;
    d_input.oninput  = () => { ensureShopDataExists(activeShop); S.shopData[activeShop].expenses[i].desc = d_input.value; clearTimeout(d_input._t); d_input._t = setTimeout(() => saveShopState(activeShop), 800); };
    d_input.onblur   = () => { ensureShopDataExists(activeShop); S.shopData[activeShop].expenses[i].desc = d_input.value; saveShopState(activeShop); };
    const a = document.createElement('input'); a.type = 'number'; a.placeholder = 'KES'; a.value = e.amount || ''; a.style.maxWidth = '110px';
    a.oninput = () => { if(a.value<0) a.value=0; ensureShopDataExists(activeShop); S.shopData[activeShop].expenses[i].amount = parseFloat(a.value) || 0; recalcDebounced(); autoSaveShopState(activeShop); };
    a.onblur  = () => { if(a.value<0)a.value=0; ensureShopDataExists(activeShop); S.shopData[activeShop].expenses[i].amount = parseFloat(a.value) || 0; saveShopState(activeShop); };
    const btn = document.createElement('button'); btn.className = 'delbtn'; btn.textContent = '✕'; btn.onclick = () => delExp(i);
    row.appendChild(d_input); row.appendChild(a); row.appendChild(btn); el.appendChild(row);
  });
}

function delExp(i) {
  ensureShopDataExists(activeShop);
  const beforeSnap = AuditLog.snapshot('expenses', S.shopData[activeShop]);
  const removed = S.shopData[activeShop].expenses[i];
  S.shopData[activeShop].expenses.splice(i, 1);
  renderExpList(); recalc(); saveShopState(activeShop);
  AuditLog.record('remove', activeShop, 'expenses',
    beforeSnap,
    `Deleted expense: "${removed ? removed.desc || 'no desc' : '?'}" KES ${removed ? fmt(N(removed.amount)) : '?'}`);
}

async function submitReport() {
  saveInputs();
  ensureShopDataExists(activeShop);
  const d = S.shopData[activeShop];
  
  // Validation before showing confirmation
  const ocash = N(d.openingCash);
  if (ocash <= 0) {
    alert('⚠️ Validation Error\n\nOpening Cash Float must be greater than zero.\nPlease enter a valid opening cash amount.');
    const inp = $('opening-cash-inp');
    if (inp) { inp.focus(); inp.style.borderColor = 'var(--red)'; setTimeout(() => inp.style.borderColor = '', 2000); }
    return;
  }
  
  // Validate at least one game has data
  let hasGameData = false;
  const invalidGames = [];
  
  GAMES.forEach(g => {
    const gd = d.games[g];
    const op = N(gd.open), cl = N(gd.close);
    
    // Check if game has any data entered
    if (op > 0 || cl > 0) hasGameData = true;
    
    // Validate no negative values
    if (op < 0) invalidGames.push(g.toUpperCase() + ' has negative opening float');
    if (cl < 0) invalidGames.push(g.toUpperCase() + ' has negative closing float');
  });
  
  if (!hasGameData) {
    alert('⚠️ Validation Error\n\nAt least one game must have opening or closing float data.\nPlease enter game data before submitting.');
    return;
  }
  
  if (invalidGames.length > 0) {
    alert('⚠️ Validation Error\n\nNegative values not allowed:\n\n' + invalidGames.join('\n') + '\n\nPlease correct these values.');
    return;
  }
  
  // Validate expenses
  const invalidExpenses = [];
  (d.expenses || []).forEach((e, i) => {
    const amt = N(e.amount);
    if (amt < 0) {
      invalidExpenses.push('Expense #' + (i + 1) + ' (' + (e.desc || 'No description') + ') has negative amount');
    }
  });
  
  if (invalidExpenses.length > 0) {
    alert('⚠️ Validation Error\n\nNegative expense amounts not allowed:\n\n' + invalidExpenses.join('\n') + '\n\nPlease correct these values.');
    return;
  }
  
  // All validation passed, show confirmation
  const ok = await confirmModal.show('Submit End of Day', 'Submit the report for ' + activeShop + '? This saves it to history.', '✅ Submit', 'var(--green)', '📋');
  if (!ok) return;
  
  const now = new Date();
  const gs = {}; let tO = 0, tT = 0, tW = 0, tR = 0;
  GAMES.forEach(g => {
    const gd = d.games[g]; const op = N(gd.open), cl = N(gd.close), ta = gd.topups || [];
    const adds = ta.filter(t => N(t.amount) > 0).reduce((s,t) => s + N(t.amount), 0);
    const withdraws = Math.abs(ta.filter(t => N(t.amount) < 0).reduce((s,t) => s + N(t.amount), 0));
    const eff = op + adds - withdraws, rev = eff - cl;
    gs[g] = {open:op, topups:[...ta], totalTopup:adds, totalWithdraw:withdraws, effective:eff, close:cl, revenue:rev};
    tO += op; tT += adds; tW += withdraws; tR += rev;
  });
  
  const cashMov = d.cashMovements || [];
  const totalCashAdded = cashMov.filter(m => m.amount > 0).reduce((s,m) => s + m.amount, 0);
  const totalCashWithdrawn = Math.abs(cashMov.filter(m => m.amount < 0).reduce((s,m) => s + m.amount, 0));
  
  const expenses = d.expenses.map(e => ({desc:e.desc||'', amount:N(e.amount)}));
  const tExp = expenses.reduce((s,e) => s + e.amount, 0), ocash_val = N(d.openingCash);
  const net = ocash_val + tR + totalCashAdded - totalCashWithdrawn - tExp;
  const dateStr = now.toLocaleDateString('en-KE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const timeStr = now.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const reportId = now.getTime();
  
  // Try to save to database, but continue even if it fails (offline mode)
  try { 
    const {error} = await db.from('reports').insert({
      id:reportId, shop:activeShop, date:dateStr, time:timeStr, by_name:sess.name, 
      games:gs, expenses, cash_movements: cashMov, cash_recon:d.cashRecon||null, 
      totals:{openingCash:ocash_val, topup:tT, cashAdded: totalCashAdded, cashWithdrawn: totalCashWithdrawn, revenue:tR, expenses:tExp, net}
    }); 
    if (error) throw error;
  } catch(e) {
    logError('submitReport: database save', e, {shop: activeShop, reportId});
    showWarning('⚠️ Report saved locally but could not sync to server. Will retry when connection is restored.');
  }

  await AuditLog.record('submit', activeShop, 'end-of-day',
    'daily state cleared',
    `Report #${reportId} by ${sess.name} | Net KES ${fmt(net)} | Revenue KES ${fmt(tR)} | Expenses KES ${fmt(tExp)} | Cash movements KES ${fmt(totalCashAdded - totalCashWithdrawn)}`
  );
  
  S.reports.unshift({id:reportId, shop:activeShop, date:dateStr, time:timeStr, by:sess.name, games:gs, expenses, cashMovements: cashMov, cashRecon:d.cashRecon||null, totals:{openingCash:ocash_val, topup:tT, cashAdded: totalCashAdded, cashWithdrawn: totalCashWithdrawn, revenue:tR, expenses:tExp, net}});
  clearTimeout(recalc._t);
  const _bg = {}; GAMES.forEach(g => { _bg[g] = {open:0, close:0, topups:[]}; });
  S.shopData[activeShop] = {games:_bg, expenses:[], openingCash:0, cashRecon:null, cashMovements:[], openedAt:null};
  await saveShopState(activeShop, true);
  pushNotif('✅ Report submitted', activeShop + ' · Net KES ' + fmt(net));
  _resetting = true;
  alert('✅ Report submitted!\nShop: ' + activeShop + '\nNet: KES ' + fmt(net));
  _resetting = false;
  renderFinance();
  if ($('pane-history') && $('pane-history').classList.contains('on')) renderHistory();
  setTimeout(() => {
    loadShopData(activeShop);
    const rc = $('recon-cash'), rm = $('recon-mpesa');
    const re = $('recon-expected'), rd = $('recon-diff'), rr = $('recon-result');
    if (rc) rc.value = '';
    if (rm) rm.value = '';
    if (re) re.textContent = 'KES 0';
    if (rd) { rd.textContent = 'Enter amounts to check'; rd.style.color = 'var(--txt3)'; }
    if (rr) rr.innerHTML = '';
  }, 80);
  checkAutoSummary();
}

function buildReport(r) {
  const S2 = '='.repeat(46) + '\n', D = '-'.repeat(46) + '\n'; let t = '';
  t += S2 + '       SWIFTSTAKE DAILY REPORT\n' + S2 + 'Shop: ' + (r.shop||'—') + '\nDate: ' + (r.date||'—') + '\nTime: ' + (r.time||'—') + '\nBy: ' + (r.by||'—') + '\n' + S2;
  let gO = 0, gT = 0, gC = 0, gR = 0;
  GAMES.forEach(g => {
    const gd = (r.games && r.games[g]) || {}, op = N(gd.open), tops = N(gd.totalTopup), eff = N(gd.effective)||(op+tops), cl = N(gd.close), rev = eff - cl;
    gO += op; gT += tops; gC += cl; gR += rev;
    t += '\n  ' + g.toUpperCase() + '\n' + D + '  Opening: KES ' + fmt(op) + '\n';
    if (tops) t += '  Top-ups: KES ' + fmt(tops) + '\n';
    t += '  Effective: KES ' + fmt(eff) + '\n  Closing: KES ' + fmt(cl) + '\n  Revenue: KES ' + fmt(rev) + '\n';
  });
  const ocash = N(r.totals && r.totals.openingCash), tExp = Array.isArray(r.expenses) ? r.expenses.reduce((s,e) => s + N(e.amount), 0) : 0, net = N(r.totals && r.totals.net);
  const cashAdd = N(r.totals && r.totals.cashAdded), cashWith = N(r.totals && r.totals.cashWithdrawn);
  t += '\n' + D + 'EXPENSES\n' + D;
  const exps = Array.isArray(r.expenses) ? r.expenses : [];
  if (exps.length) exps.forEach(e => { t += '  ' + (e.desc||'Expense') + ': KES ' + fmt(N(e.amount)) + '\n'; }); else t += '  None\n';
  t += '\n' + D + 'CASH MOVEMENTS\n' + D;
  if (cashAdd > 0) t += '  Cash/M-Pesa Added: +KES ' + fmt(cashAdd) + '\n';
  if (cashWith > 0) t += '  Cash/M-Pesa Withdrawn: −KES ' + fmt(cashWith) + '\n';
  if (!cashAdd && !cashWith) t += '  None\n';
  t += '\n' + S2 + 'SUMMARY\n' + S2 + '  Opening Float: KES ' + fmt(ocash) + '\n  Revenue:       KES ' + fmt(gR) + '\n  Expenses:      KES ' + fmt(tExp) + '\n' + (cashAdd || cashWith ? `  Cash Movement: ${cashAdd > 0 ? '+' : ''}KES ${fmt(cashAdd - cashWith)}\n` : '') + D + '  NET TOTAL:     KES ' + fmt(net) + '\n' + S2;
  return t;
}

function exportCurrent() {
  saveInputs(); 
  const d = S.shopData[activeShop]; 
  const now = new Date(); 
  const gs = {}; 
  let tR = 0;
  GAMES.forEach(g => { const gd = d.games[g]; const op = N(gd.open), cl = N(gd.close), tops = (gd.topups||[]).reduce((s,t) => s + N(t.amount), 0), eff = op + tops, rev = eff - cl; gs[g] = {open:op, topups:[...(gd.topups||[])], totalTopup:tops, effective:eff, close:cl, revenue:rev}; tR += rev; });
  const expenses = d.expenses.map(e => ({desc:e.desc||'', amount:N(e.amount)}));
  const tExp = expenses.reduce((s,e) => s + e.amount, 0), ocash = N(d.openingCash);
  
  const cashMov = d.cashMovements || [];
  const totalCashAdded = cashMov.filter(m => m.amount > 0).reduce((s,m) => s + m.amount, 0);
  const totalCashWithdrawn = Math.abs(cashMov.filter(m => m.amount < 0).reduce((s,m) => s + m.amount, 0));
  const netWithCash = ocash + tR + totalCashAdded - totalCashWithdrawn - tExp;
  
  const r = {shop:activeShop, date:now.toLocaleDateString('en-KE'), time:now.toLocaleTimeString('en-KE'), by:sess.name, games:gs, expenses, cashMovements: cashMov, cashRecon:d.cashRecon||null, totals:{openingCash:ocash, cashAdded: totalCashAdded, cashWithdrawn: totalCashWithdrawn, revenue:tR, expenses:tExp, net:netWithCash}};
  $('exptxt').textContent = buildReport(r); openModal('export-modal');
}

function exportHistReport(id) { const r = S.reports.find(r => r.id === id); if (!r) return; $('exptxt').textContent = buildReport(r); openModal('export-modal'); }

function copyExport() {
  const t = $('exptxt').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => alert('Copied!'));
  else { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('Copied!'); }
}
