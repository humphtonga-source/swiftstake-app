// ── M-PESA PAGE ──
// Request payments via STK Push, watch results live, and (admin only)
// manage each shop's Daraja Go-Live status as real production tills
// come online one by one.

let _stkChannel = null;
let _mpesaActiveShop = null;

function renderMpesaPage() {
  const p = $('pane-mpesa'); if (!p) return;
  _mpesaActiveShop = sess.isAdmin ? (_mpesaActiveShop || activeShop || SHOPS[0]) : sess.shop;

  const cfg = S.mpesaShopConfig.find(c => c.shop === _mpesaActiveShop);
  const envBadge = cfg && cfg.environment === 'production'
    ? `<span class="tag tag-green">🟢 Live</span>`
    : `<span class="tag tag-gold">🧪 Sandbox</span>`;

  p.innerHTML = `<div class="ph"><div class="ph-icon">📱</div><h2>M-Pesa</h2></div>

  ${sess.isAdmin ? `<div class="csb" style="margin-bottom:14px;border-radius:var(--radius2);">
    ${SHOPS.map(sh => `<div class="chi ${sh === _mpesaActiveShop ? 'act' : ''}" onclick="switchMpesaShop('${sh}',this)">${sh}</div>`).join('')}
  </div>` : ''}

  <div class="card">
    <div class="cardtitle">📲 Request Payment ${envBadge}</div>
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      <input type="tel" id="stk-phone" placeholder="07XXXXXXXX" style="flex:1;border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:14px;outline:none;background:var(--bg3);color:var(--txt);">
      <input type="number" id="stk-amount" placeholder="Amount (KES)" min="1" style="flex:1;border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:14px;outline:none;background:var(--bg3);color:var(--txt);">
    </div>
    <button onclick="sendStkPush()" id="stk-send-btn" style="width:100%;padding:12px;background:var(--blue);color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">📲 Send Payment Prompt</button>
    <div id="stk-status"></div>
    <div id="stk-recent"></div>
  </div>

  ${sess.isAdmin ? renderDarajaConfigSection() : ''}`;

  renderStkRecent();
  ensureStkSubscription();
}

function switchMpesaShop(shop, el) {
  _mpesaActiveShop = shop;
  document.querySelectorAll('#pane-mpesa .chi').forEach(c => c.classList.remove('act'));
  if (el) el.classList.add('act');
  renderMpesaPage();
}

async function sendStkPush() {
  const phoneInp = $('stk-phone'), amtInp = $('stk-amount'), statusEl = $('stk-status'), btn = $('stk-send-btn');
  const phone = phoneInp ? phoneInp.value.trim() : '';
  const amount = N(amtInp ? amtInp.value : 0);

  if (!phone) { alert('Enter the customer\'s phone number.'); if (phoneInp) phoneInp.focus(); return; }
  if (amount <= 0) { alert('Enter a valid amount.'); if (amtInp) amtInp.focus(); return; }

  btn.disabled = true; btn.textContent = 'Sending...';
  if (statusEl) statusEl.innerHTML = '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const resp = await fetch(SUPABASE_URL + '/functions/v1/mpesa-stk-push', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + (sessToken || SUPABASE_KEY)},
      body: JSON.stringify({shop: _mpesaActiveShop, phone, amount, initiatedBy: sess.name}),
      signal: controller.signal
    });
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Could not send prompt');

    if (statusEl) statusEl.innerHTML = `<div class="stk-pending"><span class="stk-spinner"></span> Waiting for ${phone} to approve on their phone...</div>`;
    if (phoneInp) phoneInp.value = '';
    if (amtInp) amtInp.value = '';
  } catch(e) {
    const msg = e.name === 'AbortError' ? 'Timed out after 25s with no response - check the M-Pesa page again shortly, or try again.' : e.message;
    logError('sendStkPush', e);
    if (statusEl) statusEl.innerHTML = `<div class="stk-failed">⚠️ ${msg}</div>`;
  } finally {
    clearTimeout(timer);
    btn.disabled = false; btn.textContent = '📲 Send Payment Prompt';
  }
}

function ensureStkSubscription() {
  if (_stkChannel) return;
  _stkChannel = db.channel('stk-transactions')
    .on('postgres_changes', {event: '*', schema: 'public', table: 'mpesa_stk_transactions'}, payload => {
      const row = payload.new;
      if (!row || row.shop !== _mpesaActiveShop) return;
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
    const {data, error} = await db.from('mpesa_stk_transactions').select('*').eq('shop', _mpesaActiveShop).order('created_at', {ascending: false}).limit(5);
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

// ── ADMIN: DARAJA CONFIG PER SHOP ──
function renderDarajaConfigSection() {
  return `<div class="card">
    <div class="cardtitle">⚙️ Daraja Configuration <span style="margin-left:auto;font-size:11px;color:var(--txt3);font-weight:400;">Per-shop Go-Live status</span></div>
    <div style="font-size:12px;color:var(--txt3);margin-bottom:12px;">Each shop needs its own production app on the Daraja portal. Until a shop is switched to Production here, it uses the shared sandbox for testing.</div>
    ${SHOPS.map(sh => {
      const cfg = S.mpesaShopConfig.find(c => c.shop === sh) || {shop: sh, environment: 'sandbox', shortcode: '', transaction_type: 'CustomerBuyGoodsOnline', go_live_status: 'not_started'};
      const isLive = cfg.environment === 'production';
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span class="bname">${sh}</span>
          <span class="tag ${isLive ? 'tag-green' : 'tag-gold'}">${isLive ? '🟢 Production' : '🧪 Sandbox'}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <input type="text" id="cfg-shortcode-${sh}" placeholder="Till number" value="${cfg.shortcode || ''}" style="border:1px solid var(--border2);border-radius:4px;padding:7px;font-size:12px;outline:none;background:var(--bg3);color:var(--txt);">
          <select id="cfg-env-${sh}" style="border:1px solid var(--border2);border-radius:4px;padding:7px;font-size:12px;outline:none;background:var(--bg3);color:var(--txt);">
            <option value="sandbox" ${!isLive ? 'selected' : ''}>Sandbox</option>
            <option value="production" ${isLive ? 'selected' : ''}>Production</option>
          </select>
        </div>
        <button onclick="saveDarajaConfig('${sh}')" style="width:100%;padding:7px;background:var(--surface2);color:var(--txt);border:1px solid var(--border2);border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">Save</button>
        ${isLive ? `<div style="font-size:11px;color:var(--txt3);margin-top:8px;">Reads secrets named <code>MPESA_${sh.toUpperCase()}_CONSUMER_KEY</code>, <code>MPESA_${sh.toUpperCase()}_CONSUMER_SECRET</code>, <code>MPESA_${sh.toUpperCase()}_PASSKEY</code> - set these in Edge Functions → Secrets before switching this to Production.</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

async function saveDarajaConfig(shop) {
  const shortcodeInp = $(`cfg-shortcode-${shop}`), envSel = $(`cfg-env-${shop}`);
  const shortcode = shortcodeInp ? shortcodeInp.value.trim() : '';
  const environment = envSel ? envSel.value : 'sandbox';

  if (environment === 'production' && !shortcode) {
    alert('Enter the till/shortcode number before switching to Production.');
    return;
  }

  try {
    const payload = {
      shop, shortcode: shortcode || null, environment,
      transaction_type: 'CustomerBuyGoodsOnline',
      go_live_status: environment === 'production' ? 'live' : 'not_started',
      updated_by: sess.name, updated_at: new Date().toISOString()
    };
    const {error} = await db.from('mpesa_shop_config').upsert(payload, {onConflict: 'shop'});
    if (error) throw new Error(error.message);

    const existing = S.mpesaShopConfig.find(c => c.shop === shop);
    if (existing) Object.assign(existing, payload); else S.mpesaShopConfig.push(payload);

    await AuditLog.record('update', shop, 'mpesa-config', 'n/a', `Set to ${environment}${shortcode ? ' · Till ' + shortcode : ''} by ${sess.name}`);
    pushNotif('✅ Daraja config saved', `${shop}: ${environment}`);
    renderMpesaPage();
  } catch(e) {
    logError('saveDarajaConfig', e, {shop});
    alert('⚠️ Could not save. Please try again.');
  }
}
