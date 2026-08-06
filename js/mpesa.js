// ── M-PESA: REQUEST PAYMENT (STK PUSH) ──
// Lets a cashier prompt a customer's phone directly for payment, and
// watches for Safaricom's result live via realtime - no polling, no
// manual refresh needed to see whether the customer paid.

let _stkChannel = null;
let _stkOpen = false;

function renderMpesaWidget() {
  const el = $('mpesa-request-widget');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <div class="cardtitle" style="cursor:pointer;" onclick="toggleMpesaWidget()">
        📱 Request M-Pesa Payment
        <span style="margin-left:auto;font-size:12px;color:var(--txt3);">${_stkOpen ? '▴' : '▾'}</span>
      </div>
      <div id="mpesa-widget-body" style="display:${_stkOpen ? 'block' : 'none'};">
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="tel" id="stk-phone" placeholder="07XXXXXXXX" style="flex:1;border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:14px;outline:none;background:var(--bg3);color:var(--txt);">
          <input type="number" id="stk-amount" placeholder="Amount (KES)" min="1" style="flex:1;border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:14px;outline:none;background:var(--bg3);color:var(--txt);">
        </div>
        <button onclick="sendStkPush()" id="stk-send-btn" style="width:100%;padding:12px;background:var(--blue);color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">📲 Send Payment Prompt</button>
        <div id="stk-status"></div>
        <div id="stk-recent"></div>
      </div>
    </div>`;
  renderStkRecent();
}

function toggleMpesaWidget() {
  _stkOpen = !_stkOpen;
  const body = $('mpesa-widget-body');
  if (body) body.style.display = _stkOpen ? 'block' : 'none';
  const arrow = document.querySelector('#mpesa-request-widget .cardtitle span');
  if (arrow) arrow.textContent = _stkOpen ? '▴' : '▾';
}

async function sendStkPush() {
  const phoneInp = $('stk-phone'), amtInp = $('stk-amount'), statusEl = $('stk-status'), btn = $('stk-send-btn');
  const phone = phoneInp ? phoneInp.value.trim() : '';
  const amount = N(amtInp ? amtInp.value : 0);

  if (!phone) { alert('Enter the customer\'s phone number.'); if (phoneInp) phoneInp.focus(); return; }
  if (amount <= 0) { alert('Enter a valid amount.'); if (amtInp) amtInp.focus(); return; }

  btn.disabled = true; btn.textContent = 'Sending...';
  if (statusEl) statusEl.innerHTML = '';

  try {
    const resp = await fetch(SUPABASE_URL + '/functions/v1/mpesa-stk-push', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + (sessToken || SUPABASE_KEY)},
      body: JSON.stringify({shop: activeShop, phone, amount, initiatedBy: sess.name})
    });
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Could not send prompt');

    if (statusEl) statusEl.innerHTML = `<div class="stk-pending"><span class="stk-spinner"></span> Waiting for ${phone} to approve on their phone...</div>`;
    if (phoneInp) phoneInp.value = '';
    if (amtInp) amtInp.value = '';
    ensureStkSubscription();
  } catch(e) {
    logError('sendStkPush', e);
    if (statusEl) statusEl.innerHTML = `<div class="stk-failed">⚠️ ${e.message}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = '📲 Send Payment Prompt';
  }
}

// Live-updates the status the moment Safaricom's callback arrives,
// and the small "recent requests" list - no manual refresh needed.
function ensureStkSubscription() {
  if (_stkChannel) return;
  _stkChannel = db.channel('stk-transactions')
    .on('postgres_changes', {event: '*', schema: 'public', table: 'mpesa_stk_transactions'}, payload => {
      const row = payload.new;
      if (!row || row.shop !== activeShop) return;
      const statusEl = $('stk-status');
      if (statusEl && row.status !== 'pending') {
        if (row.status === 'success') {
          statusEl.innerHTML = `<div class="stk-success">✅ Paid! KES ${fmt(N(row.amount))} · Receipt: ${row.mpesa_receipt || '—'}</div>`;
          pushNotif('✅ M-Pesa payment received', `KES ${fmt(N(row.amount))} · ${row.phone}`);
        } else {
          statusEl.innerHTML = `<div class="stk-failed">❌ ${row.status === 'cancelled' ? 'Customer cancelled' : 'Payment failed'}${row.result_desc ? ': ' + row.result_desc : ''}</div>`;
        }
      }
      renderStkRecent();
    })
    .subscribe();
}

async function renderStkRecent() {
  const el = $('stk-recent');
  if (!el) return;
  try {
    const {data, error} = await db.from('mpesa_stk_transactions').select('*').eq('shop', activeShop).order('created_at', {ascending: false}).limit(5);
    if (error) throw new Error(error.message);
    if (!data || !data.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:11px;color:var(--txt3);font-weight:700;text-transform:uppercase;margin-bottom:6px;">Recent Requests</div>
      ${data.map(t => {
        const icon = t.status === 'success' ? '✅' : t.status === 'pending' ? '⏳' : '❌';
        const color = t.status === 'success' ? 'var(--green)' : t.status === 'pending' ? 'var(--gold)' : 'var(--red)';
        return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--txt2);padding:4px 0;">
          <span>${icon} ${t.phone}</span>
          <span class="mono-fig" style="color:${color};">KES ${fmt(N(t.amount))}</span>
        </div>`;
      }).join('')}
    </div>`;
  } catch(e) { logError('renderStkRecent', e); }
}
