// ── CARD DRAW TRACKER ──
// Tracks a provider-funded card draw (Stellar currently) as a
// RECEIVABLE owed back by the provider - deliberately kept out of
// float topups, cash movements, and expenses so it can never distort
// the day's float cost or net profit calculations. The actual
// gameplay outcome from players wagering this money still flows
// through the normal game numbers untouched - only the injection
// itself and its reimbursement live here.

const DRAW_DENOMS = [
  {value: 20,  count: 13},
  {value: 30,  count: 12},
  {value: 50,  count: 15},
  {value: 70,  count: 9},
  {value: 100, count: 10},
  {value: 150, count: 6},
  {value: 200, count: 3},
  {value: 250, count: 2}
];
const DRAW_TOTAL_BUDGET = DRAW_DENOMS.reduce((s,d) => s + d.value * d.count, 0); // 5000
const DRAW_TOTAL_CARDS  = DRAW_DENOMS.reduce((s,d) => s + d.count, 0);          // 70

let _drawActiveShop = null;
let _currentDraw = null;

async function renderDrawPage() {
  const p = $('pane-draw'); if (!p) return;
  _drawActiveShop = sess.isAdmin ? (_drawActiveShop || activeShop || SHOPS[0]) : sess.shop;

  p.innerHTML = `<div class="ph"><div class="ph-icon">🎟️</div><h2>Card Draw</h2></div>
  ${sess.isAdmin ? `<div class="csb" style="margin-bottom:14px;border-radius:var(--radius2);">
    ${SHOPS.map(sh => `<div class="chi ${sh === _drawActiveShop ? 'act' : ''}" onclick="switchDrawShop('${sh}',this)">${sh}</div>`).join('')}
  </div>` : ''}
  <div class="ibar" style="margin-bottom:14px;">This card money is Stellar's, not the shop's - it's tracked as a receivable here and never touches float cost, expenses, or cash movements.</div>
  <div id="draw-content" class="loading">Loading…</div>`;

  await loadDrawState();
}

function switchDrawShop(shop, el) {
  _drawActiveShop = shop;
  document.querySelectorAll('#pane-draw .chi').forEach(c => c.classList.remove('act'));
  if (el) el.classList.add('act');
  loadDrawState();
}

async function loadDrawState() {
  const el = $('draw-content'); if (!el) return;
  el.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const {data, error} = await db.from('draw_promos').select('*').eq('shop', _drawActiveShop).eq('status', 'open').order('opened_at', {ascending:false}).limit(1);
    if (error) throw error;
    _currentDraw = (data && data[0]) || null;
    renderDrawContent();
    renderDrawHistory();
  } catch(e) {
    logError('loadDrawState', e, {shop: _drawActiveShop});
    el.innerHTML = '<div class="empty">⚠️ Could not load draw data.</div>';
  }
}

function renderDrawContent() {
  const el = $('draw-content'); if (!el) return;
  if (!_currentDraw) {
    el.innerHTML = `<div class="card" style="text-align:center;">
      <div style="font-size:13px;color:var(--txt3);margin-bottom:12px;">No open draw for ${_drawActiveShop} right now.</div>
      <button class="goldbtn" onclick="startDraw()">🎟️ Start This Week's Draw</button>
    </div>`;
    return;
  }

  const given = _currentDraw.given || {};
  const totalGiven = N(_currentDraw.total_given);
  const cardsGiven = N(_currentDraw.cards_given);
  const remaining = DRAW_TOTAL_BUDGET - totalGiven;
  const allGiven = cardsGiven >= DRAW_TOTAL_CARDS;

  el.innerHTML = `
    <div class="card" style="border-color:rgba(245,158,11,0.3);margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--txt2);margin-bottom:6px;">
        <span>Given: <b style="color:var(--txt);">KES ${fmt(totalGiven)}</b></span>
        <span>Remaining: <b style="color:${remaining > 0 ? 'var(--green)' : 'var(--txt3)'};">KES ${fmt(remaining)}</b></span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--txt2);">
        <span>Cards given: <b style="color:var(--txt);">${cardsGiven} / ${DRAW_TOTAL_CARDS}</b></span>
        <span>Cards left: <b style="color:var(--txt);">${DRAW_TOTAL_CARDS - cardsGiven}</b></span>
      </div>
      ${allGiven ? '<div style="margin-top:8px;font-size:12px;color:var(--green);font-weight:700;">✅ All cards given out</div>' : ''}
    </div>
    <div class="cards" style="grid-template-columns:1fr 1fr;">
      ${DRAW_DENOMS.map(d => {
        const g = N(given[d.value]);
        const left = d.count - g;
        return `<div class="card" style="padding:12px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:var(--gold);">KES ${d.value}</div>
          <div style="font-size:12px;color:var(--txt3);margin:4px 0 10px;">${g} of ${d.count} given</div>
          <div style="display:flex;gap:6px;">
            <button onclick="adjustDrawCard(${d.value},-1)" ${g <= 0 ? 'disabled' : ''} style="flex:1;padding:8px;border:1px solid var(--border2);border-radius:6px;background:transparent;color:var(--txt2);font-size:14px;cursor:pointer;">−</button>
            <button onclick="adjustDrawCard(${d.value},1)" ${left <= 0 ? 'disabled' : ''} style="flex:2;padding:8px;border:none;border-radius:6px;background:var(--green);color:#fff;font-weight:700;cursor:pointer;">Give (${left} left)</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <button class="submitbtn" style="margin-top:14px;" onclick="closeDraw()">✅ Close This Week's Draw</button>
    <div id="draw-history"></div>
  `;
}

async function startDraw() {
  const ok = await confirmModal.show('🎟️ Start Draw', 'Start a new card draw for ' + _drawActiveShop + '? This creates a fresh 70-card set worth KES ' + fmt(DRAW_TOTAL_BUDGET) + '.', '🎟️ Start', 'var(--gold)', '🎟️');
  if (!ok) return;
  const payload = {
    shop: _drawActiveShop, provider: 'stellar', total_budget: DRAW_TOTAL_BUDGET,
    denominations: DRAW_DENOMS, given: {}, total_given: 0, cards_given: 0, cards_total: DRAW_TOTAL_CARDS,
    status: 'open', opened_by: sess.name, opened_at: new Date().toISOString()
  };
  try {
    const {error} = await db.from('draw_promos').insert(payload);
    if (error) throw error;
    await AuditLog.record('add', _drawActiveShop, 'draw-promo', 'none', `Started new draw by ${sess.name} · KES ${fmt(DRAW_TOTAL_BUDGET)} across ${DRAW_TOTAL_CARDS} cards`);
    pushNotif('🎟️ Draw started', _drawActiveShop);
    loadDrawState();
  } catch(e) {
    logError('startDraw', e, {shop: _drawActiveShop});
    alert('⚠️ Could not start draw. Please try again.');
  }
}

async function adjustDrawCard(value, delta) {
  if (!_currentDraw) return;
  const denom = DRAW_DENOMS.find(d => d.value === value);
  if (!denom) return;
  const given = Object.assign({}, _currentDraw.given || {});
  const newCount = N(given[value]) + delta;
  if (newCount < 0 || newCount > denom.count) return;
  given[value] = newCount;
  const totalGiven = DRAW_DENOMS.reduce((s,d) => s + N(given[d.value]) * d.value, 0);
  const cardsGiven = DRAW_DENOMS.reduce((s,d) => s + N(given[d.value]), 0);

  // Optimistic UI update so the cashier isn't waiting on the network
  // for every single card
  _currentDraw.given = given; _currentDraw.total_given = totalGiven; _currentDraw.cards_given = cardsGiven;
  renderDrawContent();

  try {
    const {error} = await db.from('draw_promos').eq('id', _currentDraw.id).update({given, total_given: totalGiven, cards_given: cardsGiven});
    if (error) throw error;
  } catch(e) {
    logError('adjustDrawCard', e, {shop: _drawActiveShop, value, delta});
    showWarning('⚠️ Could not sync card count - try again, or check your connection.');
  }
}

async function closeDraw() {
  if (!_currentDraw) return;
  const ok = await confirmModal.show('✅ Close Draw',
    `Close this draw?\n\nTotal given: KES ${fmt(_currentDraw.total_given)}\nCards given: ${_currentDraw.cards_given}/${DRAW_TOTAL_CARDS}\n\nThis records the amount owed back by Stellar - it will not appear in today's expenses or float cost.`,
    '✅ Close & Record', 'var(--green)', '🎟️');
  if (!ok) return;
  try {
    const {error} = await db.from('draw_promos').eq('id', _currentDraw.id).update({status: 'closed', closed_by: sess.name, closed_at: new Date().toISOString()});
    if (error) throw error;
    await AuditLog.record('submit', _drawActiveShop, 'draw-promo', 'open',
      `Draw closed by ${sess.name} | KES ${fmt(_currentDraw.total_given)} given (${_currentDraw.cards_given}/${DRAW_TOTAL_CARDS} cards) | Owed back by ${_currentDraw.provider}`);
    pushNotif('🎟️ Draw closed', _drawActiveShop + ' · KES ' + fmt(_currentDraw.total_given) + ' owed back');
    _currentDraw = null;
    loadDrawState();
  } catch(e) {
    logError('closeDraw', e, {shop: _drawActiveShop});
    alert('⚠️ Could not close draw. Please try again.');
  }
}

async function renderDrawHistory() {
  try {
    const {data, error} = await db.from('draw_promos').select('*').eq('shop', _drawActiveShop).eq('status', 'closed').order('closed_at', {ascending:false}).limit(10);
    if (error) throw error;
    const histEl = $('draw-history');
    if (!histEl) return;
    if (!data || !data.length) { histEl.innerHTML = ''; return; }
    histEl.innerHTML = `<div class="section-title" style="margin:20px 0 10px;font-size:14px;font-weight:700;color:var(--txt2);">Past Draws</div>` +
      data.map(d => {
        const reimbBadge = d.reimbursement_status === 'received'
          ? `<span class="tag tag-green">✅ Reimbursed</span>`
          : `<span class="tag tag-gold">⏳ Pending from ${d.provider}</span>`;
        return `<div class="card" style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-size:13px;color:var(--txt2);">${new Date(d.closed_at).toLocaleDateString('en-KE',{day:'numeric',month:'short'})} · KES ${fmt(d.total_given)} · ${d.cards_given} cards</span>
            ${reimbBadge}
          </div>
          ${sess.isAdmin && d.reimbursement_status !== 'received' ? `<button onclick="markDrawReimbursed(${d.id})" style="margin-top:8px;width:100%;padding:7px;border:1px solid var(--border2);border-radius:6px;background:transparent;color:var(--green);font-size:12px;font-weight:700;cursor:pointer;">Mark Reimbursement Received</button>` : ''}
        </div>`;
      }).join('');
  } catch(e) {
    logError('renderDrawHistory', e, {shop: _drawActiveShop});
  }
}

async function markDrawReimbursed(id) {
  const ok = await confirmModal.show('Mark Reimbursed', 'Confirm the provider has paid this draw amount back?', '✅ Confirm', 'var(--green)', '💰');
  if (!ok) return;
  try {
    const {error} = await db.from('draw_promos').eq('id', id).update({reimbursement_status: 'received', reimbursement_at: new Date().toISOString()});
    if (error) throw error;
    await AuditLog.record('update', _drawActiveShop, 'draw-promo', 'pending', `Reimbursement marked received by ${sess.name}`);
    loadDrawState();
  } catch(e) {
    logError('markDrawReimbursed', e, {id});
    alert('⚠️ Could not update. Please try again.');
  }
}
