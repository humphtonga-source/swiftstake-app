// ── ASSETS & BALANCE SHEET (admin only) ──

function renderAssets() {
  const p = $('pane-assets'); if (!p) return;
  if (!sess.isAdmin) { p.innerHTML = '<div class="denied"><div class="dico">🔒</div><h3>Admin only</h3></div>'; return; }

  const totalBank = S.banks.reduce((s,b) => s + N(b.amount), 0);
  const totalEquipment = S.equipment.reduce((s,e) => s + N(e.cost), 0);
  const totalCompanyDebt = S.debts.reduce((s,d) => s + (N(d.amount) - N(d.paid||0)), 0);
  const totalShopDebt = S.shopDebts.reduce((s,d) => s + (N(d.amount) - N(d.paid||0)), 0);
  const assets = totalBank + totalEquipment;
  const liabilities = totalCompanyDebt + totalShopDebt;
  const netWorth = assets - liabilities;

  p.innerHTML = `<div class="ph"><div class="ph-icon">🏢</div><h2>Assets & Balance Sheet</h2></div>

  <div class="card" style="border:1px solid ${netWorth >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'};">
    <div class="cardtitle">📊 Balance Sheet</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div>
        <div style="font-size:11px;color:var(--txt3);font-weight:700;text-transform:uppercase;margin-bottom:8px;">Assets</div>
        <div class="bs-row"><span>Bank balances</span><span class="mono-fig">KES ${fmt(totalBank)}</span></div>
        <div class="bs-row"><span>Equipment (at cost)</span><span class="mono-fig">KES ${fmt(totalEquipment)}</span></div>
        <div class="bs-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:6px;font-weight:700;"><span>Total</span><span class="mono-fig pos">KES ${fmt(assets)}</span></div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--txt3);font-weight:700;text-transform:uppercase;margin-bottom:8px;">Liabilities</div>
        <div class="bs-row"><span>Company debts</span><span class="mono-fig">KES ${fmt(totalCompanyDebt)}</span></div>
        <div class="bs-row"><span>Shop debts</span><span class="mono-fig">KES ${fmt(totalShopDebt)}</span></div>
        <div class="bs-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:6px;font-weight:700;"><span>Total</span><span class="mono-fig neg">KES ${fmt(liabilities)}</span></div>
      </div>
    </div>
    <div style="background:${netWorth >= 0 ? 'var(--greenl)' : 'var(--redl)'};border-radius:var(--radius2);padding:14px;text-align:center;">
      <div style="font-size:11px;color:var(--txt3);text-transform:uppercase;font-weight:700;">Net Worth (Assets − Liabilities)</div>
      <div class="mono-fig" style="font-size:24px;font-weight:800;color:${netWorth >= 0 ? 'var(--green)' : 'var(--red)'};margin-top:4px;">KES ${fmt(netWorth)}</div>
    </div>
    <div style="font-size:11px;color:var(--txt3);margin-top:10px;">Doesn't yet include cash currently sitting in shop tills mid-day, or equipment depreciation - shown at original purchase cost.</div>
  </div>

  <div class="card">
    <div class="cardtitle">🏪 Shop Debts <span style="margin-left:auto;font-size:11px;color:var(--txt3);font-weight:400;">Separate from company-wide debts</span></div>
    <div style="font-size:12px;color:var(--txt3);margin-bottom:10px;">Debts tied to one specific shop - a local supplier tab, rent, or a loan for that location - not the wider business.</div>
    ${S.shopDebts.length ? S.shopDebts.map((d,i) => renderShopDebtCard(d, i)).join('') : '<div style="font-size:13px;color:var(--txt3);padding:8px 0;">No shop debts recorded.</div>'}
    <div class="addrow" style="grid-template-columns:1fr 1fr;">
      <input id="sd-name" placeholder="Creditor" type="text">
      <input id="sd-amt" placeholder="Amount (KES)" type="number" min="0">
      <select id="sd-shop" style="background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:6px;padding:8px;">${SHOPS.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
      <input id="sd-due" placeholder="Due date" type="text">
      <button onclick="addShopDebt()" style="grid-column:1/-1;">Add Shop Debt</button>
    </div>
  </div>

  <div class="card">
    <div class="cardtitle">🔧 Equipment & Machines</div>
    ${SHOPS.map(sh => {
      const items = S.equipment.filter(e => e.shop === sh);
      if (!items.length) return '';
      return `<div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px;">${sh}</div>
        ${items.map(e => renderEquipmentCard(e)).join('')}
      </div>`;
    }).join('') || '<div style="font-size:13px;color:var(--txt3);padding:8px 0;margin-bottom:10px;">No equipment recorded yet.</div>'}
    <div class="addrow" style="grid-template-columns:1fr 1fr;">
      <input id="eq-name" placeholder="e.g. Stellar Terminal #1" type="text">
      <input id="eq-cost" placeholder="Cost (KES)" type="number" min="0">
      <select id="eq-shop" style="background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:6px;padding:8px;">${SHOPS.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
      <select id="eq-interval" style="background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:6px;padding:8px;">
        <option value="">No service schedule</option>
        <option value="30">Monthly service</option>
        <option value="90">Every 3 months</option>
        <option value="180">Every 6 months</option>
        <option value="365">Yearly</option>
      </select>
      <button onclick="addEquipment()" style="grid-column:1/-1;">Add Equipment</button>
    </div>
  </div>`;
}

function renderShopDebtCard(d, i) {
  const owed = N(d.amount), paid = N(d.paid || 0), remaining = owed - paid, pct = owed > 0 ? Math.round((paid / owed) * 100) : 0;
  const payments = Array.isArray(d.payments) ? d.payments : [];
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:12px;margin-bottom:10px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div><span class="bname">${d.name}</span><div class="bdue" style="font-size:11px;color:var(--txt3);margin-top:2px;">${d.shop} · Due: ${d.due_date||'Not set'}</div></div>
      <button class="rmbtn" style="font-size:11px;padding:4px 8px;" onclick="if(confirm('Delete this shop debt?')) removeShopDebt('${d.id}')">Delete</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;font-size:12px;">
      <div><span style="color:var(--txt3);">Original:</span><span style="font-weight:700;">KES ${fmt(owed)}</span></div>
      <div><span style="color:var(--txt3);">Paid:</span><span style="font-weight:700;color:var(--green);">KES ${fmt(paid)}</span></div>
      <div><span style="color:var(--txt3);">Remaining:</span><span style="font-weight:700;color:${remaining > 0 ? 'var(--red)' : 'var(--green)'};">KES ${fmt(remaining)}</span></div>
      <div><span style="color:var(--txt3);">Progress:</span><span style="font-weight:700;">${pct}%</span></div>
    </div>
    <div style="width:100%;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;width:${pct}%;background:var(--green);"></div></div>
    ${remaining > 0 ? `<div style="display:flex;gap:6px;">
      <input type="number" id="sd-payment-${i}" placeholder="Payment amount" min="1" max="${remaining}" style="flex:1;border:1px solid var(--border2);border-radius:4px;padding:6px;font-size:12px;outline:none;background:var(--bg3);color:var(--txt);">
      <button onclick="recordShopDebtPayment('${d.id}',${i})" style="padding:6px 12px;background:var(--green);color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">+ Pay</button>
    </div>` : '<div style="font-size:12px;color:var(--green);font-weight:700;padding:8px;background:rgba(34,197,94,0.1);border-radius:4px;text-align:center;">✅ Cleared</div>'}
  </div>`;
}

function renderEquipmentCard(e) {
  let serviceHtml = '';
  if (e.service_interval_days && e.last_service_date) {
    const last = new Date(e.last_service_date);
    const next = new Date(last.getTime() + N(e.service_interval_days) * 86400000);
    const overdue = next < new Date();
    serviceHtml = `<span style="font-size:11px;color:${overdue ? 'var(--red)' : 'var(--txt3)'};font-weight:${overdue ? '700' : '400'};">${overdue ? '⚠️ Service overdue since ' : 'Next service: '}${next.toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}</span>`;
  } else if (e.service_interval_days) {
    serviceHtml = `<span style="font-size:11px;color:var(--gold);">Not yet serviced - tap to log first service</span>`;
  }
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:12px;margin-bottom:8px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span class="bname">${e.name}</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="mono-fig" style="font-weight:700;">KES ${fmt(N(e.cost))}</span>
        <button onclick="removeEquipment('${e.id}')" style="background:none;border:none;color:var(--txt3);cursor:pointer;font-size:13px;">🗑️</button>
      </div>
    </div>
    <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;">
      <div>${serviceHtml}</div>
      ${e.service_interval_days ? `<button onclick="logServiceDone('${e.id}')" style="padding:4px 10px;background:var(--surface2);color:var(--txt2);border:1px solid var(--border2);border-radius:4px;font-size:11px;cursor:pointer;">✓ Log Service</button>` : ''}
    </div>
  </div>`;
}

// ── Shop Debts CRUD ──
async function addShopDebt() {
  const name = $('sd-name').value.trim(), amt = N($('sd-amt').value), shop = $('sd-shop').value, due = $('sd-due').value.trim();
  if (!name || amt <= 0) { alert('Please enter a creditor name and amount.'); return; }
  try {
    const {data, error} = await db.from('shop_debts').insert({shop, name, amount: amt, paid: 0, payments: [], due_date: due || 'Not set'});
    if (error) throw new Error(error.message);
    if (data && data[0]) S.shopDebts.push(JSON.parse(JSON.stringify(data[0])));
    $('sd-name').value = ''; $('sd-amt').value = ''; $('sd-due').value = '';
    await AuditLog.record('add', shop, 'shop-debt', 'n/a', `Added "${name}" · KES ${fmt(amt)}`);
    renderAssets();
  } catch(e) { logError('addShopDebt', e); alert('⚠️ Could not add debt. Please try again.'); }
}

async function removeShopDebt(id) {
  const d = S.shopDebts.find(x => x.id === id); if (!d) return;
  try {
    const {error} = await db.from('shop_debts').eq('id', id).delete();
    if (error) throw new Error(error.message);
    S.shopDebts = S.shopDebts.filter(x => x.id !== id);
    await AuditLog.record('delete', d.shop, 'shop-debt', `"${d.name}" · KES ${fmt(N(d.amount))}`, `Deleted by ${sess.name}`);
    renderAssets();
  } catch(e) { logError('removeShopDebt', e); alert('⚠️ Could not delete. Please try again.'); }
}

async function recordShopDebtPayment(id, idx) {
  const inp = $('sd-payment-' + idx); if (!inp || !inp.value) return;
  const amt = N(inp.value), d = S.shopDebts[idx];
  if (amt <= 0 || amt > (N(d.amount) - N(d.paid||0))) { alert('Invalid payment amount'); return; }
  const newPaid = N(d.paid||0) + amt;
  const payment = {amount: amt, date: new Date().toLocaleDateString('en-KE',{month:'short',day:'numeric'})};
  const payments = [...(Array.isArray(d.payments) ? d.payments : []), payment];
  try {
    const {error} = await db.from('shop_debts').eq('id', d.id).update({paid: newPaid, payments});
    if (error) throw new Error(error.message);
    d.paid = newPaid; d.payments = payments;
    pushNotif('💳 Payment recorded', d.name + ': KES ' + fmt(amt));
    renderAssets();
  } catch(e) { logError('recordShopDebtPayment', e); alert('⚠️ Could not save payment. Please try again.'); }
}

// ── Equipment CRUD ──
async function addEquipment() {
  const name = $('eq-name').value.trim(), cost = N($('eq-cost').value), shop = $('eq-shop').value, interval = $('eq-interval').value;
  if (!name) { alert('Please enter equipment name.'); return; }
  try {
    const payload = {shop, name, cost, purchase_date: new Date().toISOString().slice(0,10)};
    if (interval) payload.service_interval_days = N(interval);
    const {data, error} = await db.from('equipment').insert(payload);
    if (error) throw new Error(error.message);
    if (data && data[0]) S.equipment.push(JSON.parse(JSON.stringify(data[0])));
    $('eq-name').value = ''; $('eq-cost').value = ''; $('eq-interval').value = '';
    await AuditLog.record('add', shop, 'equipment', 'n/a', `Added "${name}" · KES ${fmt(cost)}`);
    renderAssets();
  } catch(e) { logError('addEquipment', e); alert('⚠️ Could not add equipment. Please try again.'); }
}

async function removeEquipment(id) {
  const e = S.equipment.find(x => x.id === id); if (!e) return;
  if (!confirm(`Remove "${e.name}"?`)) return;
  try {
    const {error} = await db.from('equipment').eq('id', id).delete();
    if (error) throw new Error(error.message);
    S.equipment = S.equipment.filter(x => x.id !== id);
    await AuditLog.record('delete', e.shop, 'equipment', `"${e.name}" · KES ${fmt(N(e.cost))}`, `Deleted by ${sess.name}`);
    renderAssets();
  } catch(err) { logError('removeEquipment', err); alert('⚠️ Could not delete. Please try again.'); }
}

async function logServiceDone(id) {
  const e = S.equipment.find(x => x.id === id); if (!e) return;
  const today = new Date().toISOString().slice(0,10);
  try {
    const {error} = await db.from('equipment').eq('id', id).update({last_service_date: today});
    if (error) throw new Error(error.message);
    e.last_service_date = today;
    pushNotif('✅ Service logged', e.name);
    renderAssets();
  } catch(err) { logError('logServiceDone', err); alert('⚠️ Could not save. Please try again.'); }
}
