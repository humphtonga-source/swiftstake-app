// ── BANKING ──
function renderBanking() {
  const p = $('pane-banking'); if (!p) return;
  const tB = S.banks.reduce((s,b) => s + N(b.amount), 0), tD = S.debts.reduce((s,d) => s + (N(d.amount) - N(d.paid || 0)), 0), net = tB - tD;
  const pendingDeposits = (S.mpesaDeposits || []).filter(d => d.status === 'pending');
  const confirmedDeposits = (S.mpesaDeposits || []).filter(d => d.status === 'confirmed');
  
  p.innerHTML = `<div class="ph"><div class="ph-icon">🏦</div><h2>Banking & Debts</h2></div>
    <div class="metrics">
      <div class="mc"><div class="mclbl">Bank Balance</div><div class="mcval pos">KES ${fmt(tB)}</div></div>
      <div class="mc"><div class="mclbl">Outstanding Debts</div><div class="mcval neg">KES ${fmt(tD)}</div></div>
      <div class="mc"><div class="mclbl">Net Position</div><div class="mcval ${net >= 0 ? 'pos' : 'neg'}">KES ${fmt(net)}</div></div>
      <div class="mc"><div class="mclbl">Active Debts</div><div class="mcval">${S.debts.filter(d => N(d.amount) - N(d.paid||0) > 0).length}</div></div>
    </div>
    
    ${sess.isAdmin && pendingDeposits.length ? `<div class="card" style="background:var(--bluel);border:1px solid rgba(59,130,246,0.2);margin-bottom:14px;">
      <div class="cardtitle" style="color:var(--blue);">📱 Pending M-Pesa Deposits (${pendingDeposits.length})</div>
      ${pendingDeposits.map(d => `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div><span class="bname">${d.shop}</span><div class="bdue" style="font-size:11px;color:var(--txt3);margin-top:2px;">Ref: ${d.reference}</div></div>
          <span style="font-weight:700;color:var(--blue);">KES ${fmt(d.amount)}</span>
        </div>
        <div style="font-size:11px;color:var(--txt3);margin-bottom:8px;">By: ${d.created_by} · ${new Date(d.created_at).toLocaleString('en-KE')}</div>
        <div style="display:flex;gap:6px;">
          <input type="number" id="deposit-conf-${d.id}" placeholder="Amount received (KES)" value="${d.amount}" style="flex:1;border:1px solid var(--border2);border-radius:4px;padding:6px;font-size:12px;outline:none;background:var(--bg3);color:var(--txt);">
          <button onclick="confirmMpesaDeposit('${d.id}',${d.id})" style="padding:6px 12px;background:var(--green);color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">✅ Confirm</button>
        </div>
      </div>`).join('')}
    </div>` : ''}
    
    <div class="card"><div class="cardtitle">🏦 Bank Accounts</div>${S.banks.length ? S.banks.map((b,i) => `<div class="bitem"><span class="bname">${b.name}</span><span class="bpos">KES ${fmt(b.amount)}</span><button class="rmbtn" onclick="removeBank('${b.id||i}')">Remove</button></div>`).join('') : '<div style="font-size:13px;color:var(--txt3);padding:8px 0;">No accounts added yet.</div>'}<div class="addrow"><input id="bank-name" placeholder="Account name" type="text"><input id="bank-amt" placeholder="Balance (KES)" type="number" min="0"><button onclick="addBank()">Add Account</button></div></div>
    
    <div class="card"><div class="cardtitle">💸 Debts & Loans</div>${S.debts.length ? S.debts.map((d,i) => {
      const owed = N(d.amount), paid = N(d.paid || 0), remaining = owed - paid, pct = Math.round((paid / owed) * 100);
      const payments = Array.isArray(d.payments) ? d.payments : [];
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div><span class="bname">${d.name}</span><div class="bdue" style="font-size:11px;color:var(--txt3);margin-top:2px;">Due: ${d.due_date||'Not set'}</div></div>
          <button class="rmbtn" style="font-size:11px;padding:4px 8px;" onclick="if(confirm('Delete this debt?')) removeDebt('${d.id||i}')">Delete</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;font-size:12px;">
          <div><span style="color:var(--txt3);">Original:</span><span style="font-weight:700;">KES ${fmt(owed)}</span></div>
          <div><span style="color:var(--txt3);">Paid:</span><span style="font-weight:700;color:var(--green);">KES ${fmt(paid)}</span></div>
          <div><span style="color:var(--txt3);">Remaining:</span><span style="font-weight:700;color:${remaining > 0 ? 'var(--red)' : 'var(--green)'};">KES ${fmt(remaining)}</span></div>
          <div><span style="color:var(--txt3);">Progress:</span><span style="font-weight:700;">${pct}%</span></div>
        </div>
        <div style="width:100%;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;width:${pct}%;background:var(--green);"></div></div>
        ${remaining > 0 ? `<div style="display:flex;gap:6px;margin-bottom:8px;">
          <input type="number" id="payment-${i}" placeholder="Payment amount" min="1" max="${remaining}" style="flex:1;border:1px solid var(--border2);border-radius:4px;padding:6px;font-size:12px;outline:none;background:var(--bg3);color:var(--txt);">
          <button onclick="recordPayment('${d.id||i}',${i})" style="padding:6px 12px;background:var(--green);color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">+ Pay</button>
        </div>` : '<div style="font-size:12px;color:var(--green);font-weight:700;padding:8px;background:rgba(34,197,94,0.1);border-radius:4px;text-align:center;">✅ Debt Cleared</div>'}
        ${payments.length ? `<div style="font-size:11px;color:var(--txt3);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">Payment history:<div style="margin-top:4px;">${payments.map(p => `<div style="display:flex;justify-content:space-between;color:var(--txt2);margin:2px 0;"><span>${p.date||'—'}</span><span style="color:var(--green);">+KES ${fmt(p.amount)}</span></div>`).join('')}</div></div>` : ''}
      </div>`;
    }).join('') : '<div style="font-size:13px;color:var(--txt3);padding:8px 0;">No debts recorded.</div>'}<div class="addrow" style="grid-template-columns:1fr 1fr;"><input id="debt-name" placeholder="Creditor" type="text"><input id="debt-amt" placeholder="Amount (KES)" type="number" min="0"><input id="debt-due" placeholder="Due date" type="text" style="grid-column:1/-1;"><button onclick="addDebt()" style="grid-column:1/-1;">Add Debt</button></div></div>`;
}
async function addBank()   { const n = $('bank-name').value.trim(), a = N($('bank-amt').value); if (!n) return; const {data} = await db.from('banks').insert({name:n, amount:a}); if (data && data[0]) S.banks.push(JSON.parse(JSON.stringify(data[0]))); renderBanking(); }
async function removeBank(id) { await db.from('banks').eq('id', id).delete(); S.banks = S.banks.filter(b => b.id != id); renderBanking(); }
async function addDebt()   { const n = $('debt-name').value.trim(), a = N($('debt-amt').value), d = $('debt-due').value.trim(); if (!n || a <= 0) return; const {data} = await db.from('debts').insert({name:n, amount:a, paid:0, due_date:d||'Not set', payments:[]}); if (data && data[0]) S.debts.push(JSON.parse(JSON.stringify(data[0]))); $('debt-name').value = ''; $('debt-amt').value = ''; $('debt-due').value = ''; renderBanking(); }
async function removeDebt(id) { await db.from('debts').eq('id', id).delete(); S.debts = S.debts.filter(d => d.id != id); renderBanking(); }
async function recordPayment(debtId, idx) {
  const inp = $('payment-' + idx); if (!inp || !inp.value) return;
  const amt = N(inp.value), d = S.debts[idx];
  if (amt <= 0 || amt > (N(d.amount) - N(d.paid||0))) { alert('Invalid payment amount'); return; }
  const ok = await confirmModal.show('Record Payment', `Record KES ${fmt(amt)} payment to ${d.name}?`, '✅ Confirm', 'var(--green)', '💳');
  if (!ok) return;
  const newPaid = N(d.paid||0) + amt;
  const now = new Date();
  const payment = {amount: amt, date: now.toLocaleDateString('en-KE',{month:'short',day:'numeric'})};
  if (!Array.isArray(d.payments)) d.payments = [];
  d.payments.push(payment);
  d.paid = newPaid;
  await db.from('debts').eq('id', debtId).update({paid: newPaid, payments: d.payments});
  pushNotif('💳 Payment recorded', d.name + ': KES ' + fmt(amt));
  renderBanking();
}

// ── ROADMAP ──
function renderRoadmap() {
  const p = $('pane-roadmap'); if (!p) return;
  let html = '<div class="ph"><div class="ph-icon">🗺️</div><h2>Roadmap</h2><div class="phr"><button class="goldbtn" onclick="addQuarter()">+ Add Quarter</button></div></div>';
  if (!S.roadmap.length) { html += '<div style="text-align:center;padding:60px;color:var(--txt3);">No quarters yet.</div>'; p.innerHTML = html; return; }
  S.roadmap.forEach((q, qi) => {
    const done = q.tasks.filter(t => t.done).length, total = q.tasks.length, pct = total ? Math.round(done / total * 100) : 0;
    html += `<div class="qcard"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;"><span class="qlbl ${q.cls}">${q.label}</span><span class="qtitle">${q.title}</span><span class="qdate">${q.date}</span><span style="font-size:12px;color:var(--txt3);margin-left:4px;">${done}/${total} done</span></div><div class="progbar" style="margin-bottom:14px;"><div class="progfill" style="width:${pct}%"></div></div><div>${q.tasks.map((t,ti) => `<div class="titem" onclick="toggleTask(${qi},${ti})"><div class="tcb ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</div><span class="ttext ${t.done ? 'done' : ''}">${t.text}</span><span class="tdue">${t.due}</span></div>`).join('')}</div><div class="addtaskrow"><input type="text" placeholder="Add task..." id="ti-${qi}" onkeydown="if(event.key==='Enter')addTask(${qi})"><input type="text" placeholder="Due" style="max-width:80px;" id="td-${qi}"><button onclick="addTask(${qi})">Add</button></div></div>`;
  });
  p.innerHTML = html;
}
async function toggleTask(qi, ti) { S.roadmap[qi].tasks[ti].done = !S.roadmap[qi].tasks[ti].done; await db.from('roadmap').eq('id', S.roadmap[qi].id).update({tasks:S.roadmap[qi].tasks}); renderRoadmap(); }
async function addTask(qi) { const inp = $('ti-' + qi), due = $('td-' + qi), txt = inp.value.trim(); if (!txt) return; S.roadmap[qi].tasks.push({text:txt, done:false, due:due.value||'—'}); await db.from('roadmap').eq('id', S.roadmap[qi].id).update({tasks:S.roadmap[qi].tasks}); inp.value = ''; due.value = ''; renderRoadmap(); }
async function addQuarter() { const qs = ['Q1','Q2','Q3','Q4'], cs = ['q1','q2','q3','q4'], n = S.roadmap.length; const nQ = {id:Date.now(), label:qs[n%4], cls:cs[n%4], title:'New Quarter', date:'Set dates here', tasks:[], sort_order:n}; await db.from('roadmap').insert(nQ); S.roadmap.push(nQ); renderRoadmap(); }

// ── TURNOVER ──
function filterByPeriod(period) {
  const now = new Date();
  return S.reports.filter(r => {
    const d = new Date(r.id);
    if (period === 'daily')   return d.toDateString() === now.toDateString();
    if (period === 'weekly')  { const m = new Date(now); m.setDate(now.getDate() - now.getDay() + 1); m.setHours(0,0,0,0); return d >= m; }
    if (period === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });
}

function renderTurnover(period) {
  const p = $('pane-turnover'); if (!p) return;
  activeTurnoverPeriod = period; const rpts = filterByPeriod(period); const pl = {daily:'Today', weekly:'This Week', monthly:'This Month'}[period];
  const stats = {}; GAMES.forEach(g => { stats[g] = {revenue:0, effective:0}; });
  rpts.forEach(r => GAMES.forEach(g => { const gd = r.games[g] || {}; stats[g].revenue += N(gd.revenue); stats[g].effective += N(gd.effective); }));
  const totalRev = GAMES.reduce((s,g) => s + stats[g].revenue, 0);
  const best = GAMES.length ? GAMES.reduce((a,b) => stats[a].revenue > stats[b].revenue ? a : b) : null;
  const gcls = {stellar:'gb-s', pilot:'gb-p', spin:'gb-sp'};
  let html = `<div class="ph"><div class="ph-icon">🎰</div><h2>Game Turnover</h2><div class="phr"><div class="toperiod">${['daily','weekly','monthly'].map(t => `<button class="stab${t === period ? ' act' : ''}" onclick="renderTurnover('${t}')">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}</div><button class="goldbtn" onclick="getGameAI()">🤖 Analyse</button></div></div>`;
  if (!rpts.length) { html += `<div class="ibar">📭 No reports for ${pl}.</div>`; p.innerHTML = html; return; }
  html += `<div class="metrics"><div class="mc"><div class="mclbl">Total Revenue (${pl})</div><div class="mcval pos">KES ${fmt(totalRev)}</div></div><div class="mc"><div class="mclbl">Best Game</div><div class="mcval" style="font-size:15px;">${best ? best.charAt(0).toUpperCase() + best.slice(1) : '—'}</div></div></div>`;
  GAMES.forEach(g => {
    const st = stats[g], rtp = st.effective > 0 ? ((st.effective - st.revenue) / st.effective * 100) : 0, margin = st.effective > 0 ? (st.revenue / st.effective * 100) : 0, share = totalRev > 0 ? (st.revenue / totalRev * 100) : 0;
    html += `<div class="card"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><span class="gbadge ${gcls[g]||'gb-custom'}">${g.toUpperCase()}</span><span style="font-size:15px;font-weight:700;color:var(--txt);">${g.charAt(0).toUpperCase() + g.slice(1)}</span><span style="margin-left:auto;font-weight:700;color:var(--green);font-size:15px;">KES ${fmt(st.revenue)}</span></div><div class="togrid"><div class="mc"><div class="mclbl">Effective Float</div><div class="mcval" style="font-size:15px;">KES ${fmt(st.effective)}</div></div><div class="mc" style="background:var(--greenl);border-color:rgba(34,197,94,0.2);"><div class="mclbl">House Margin</div><div class="mcval" style="font-size:15px;color:var(--green);">${margin.toFixed(1)}%</div></div></div><div class="progbar" style="margin-top:10px;"><div class="progfill" style="width:${Math.min(share,100)}%;"></div></div><div style="font-size:11px;color:var(--txt3);margin-top:6px;">${share.toFixed(1)}% of total · RTP: ${rtp.toFixed(1)}%</div></div>`;
  });
  html += `<div class="card" id="game-ai-box" style="display:none;"><div class="cardtitle">🤖 AI Game Analysis</div><div id="game-ai-result" style="font-size:13px;color:var(--txt2);line-height:1.7;white-space:pre-wrap;"></div></div>`;
  p.innerHTML = html;
}

async function getGameAI() {
  if (!sess.isAdmin) return; const box = $('game-ai-box'), res = $('game-ai-result'); if (!box || !res) return; box.style.display = 'block'; res.textContent = '🤖 Analysing...';
  const stats = {}; GAMES.forEach(g => { stats[g] = {revenue:0, effective:0}; }); S.reports.forEach(r => GAMES.forEach(g => { const gd = r.games[g] || {}; stats[g].revenue += N(gd.revenue); stats[g].effective += N(gd.effective); }));
  const prompt = `Betting analyst for SwiftStake Kenya (shops: ${SHOPS.join(', ')}; games: ${GAMES.join(', ')}).\nGAME DATA: ${GAMES.map(g => { const s = stats[g], rtp = s.effective > 0 ? ((s.effective - s.revenue) / s.effective * 100) : 0, margin = s.effective > 0 ? (s.revenue / s.effective * 100) : 0; return `${g.toUpperCase()}: Revenue KES ${fmt(s.revenue)}, Margin ${margin.toFixed(1)}%, RTP ${rtp.toFixed(1)}%`; }).join('; ')}\nProvide: 1) Best game 2) RTP health 3) Recommendations. Under 200 words.`;
  try { const resp = await fetch('https://api.anthropic.com/v1/messages', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'claude-sonnet-4-20250514', max_tokens:800, messages:[{role:'user', content:prompt}]})}); const data = await resp.json(); res.textContent = data.content?.[0]?.text || 'Could not generate.'; } catch(e) { res.textContent = '⚠️ Connection error.'; }
}

// ── AI SUMMARY ──
function initSummaryPage() {
  const p = $('pane-aisummary'); if (!p) return;
  p.innerHTML = `<div class="ph"><div class="ph-icon">🤖</div><h2>AI Business Summary</h2></div>
    <div class="ibar">AI reads all submitted reports and generates a detailed business summary.</div>
    <div class="sumperiod">${['daily','weekly','monthly','quad'].map(t => `<button class="stab${t === activeSummaryPeriod ? ' act' : ''}" id="sum-btn-${t}" onclick="switchSummary('${t}',this)">${{daily:'Daily',weekly:'Weekly',monthly:'Monthly',quad:'4-Month'}[t]}</button>`).join('')}</div>
    <div style="text-align:center;margin-bottom:18px;"><button class="goldbtn" style="padding:13px 28px;font-size:15px;" onclick="generateSummary()">✨ Generate Summary</button></div>
    <div id="summary-box" style="display:none;" class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;"><span style="font-size:15px;font-weight:700;color:var(--txt);" id="summary-title">Summary</span><button class="sbtn" onclick="copySummary()">📋 Copy</button></div><div id="summary-result" style="font-size:13px;color:var(--txt2);line-height:1.8;white-space:pre-wrap;"></div></div>
    <div id="summary-history"></div>`;
  renderSummaryHistory();
}

function switchSummary(period, btn) {
  activeSummaryPeriod = period;
  ['daily','weekly','monthly','quad'].forEach(t => { const b = $('sum-btn-' + t); if (b) b.classList.remove('act'); }); if (btn) btn.classList.add('act');
  const box = $('summary-box'); if (box) box.style.display = 'none';
}

async function generateSummary() {
  if (!sess.isAdmin) return; const box = $('summary-box'), res = $('summary-result'), title = $('summary-title'); if (!box || !res) return;
  box.style.display = 'block'; res.textContent = '✨ Generating...';
  const period = activeSummaryPeriod, pl = {daily:'Daily', weekly:'Weekly', monthly:'Monthly', quad:'4-Month'}[period];
  if (title) title.textContent = pl + ' Summary — ' + new Date().toLocaleDateString('en-KE');
  let rpts = S.reports;
  if (period === 'daily') rpts = filterByPeriod('daily'); else if (period === 'weekly') rpts = filterByPeriod('weekly'); else if (period === 'monthly') rpts = filterByPeriod('monthly'); else if (period === 'quad') { const cut = new Date(); cut.setMonth(cut.getMonth() - 4); rpts = rpts.filter(r => new Date(r.id) >= cut); }
  if (!rpts.length) { res.textContent = 'No reports found for this period.'; return; }
  const sN = {}; SHOPS.forEach(s => sN[s] = 0); rpts.forEach(r => sN[r.shop] = (sN[r.shop] || 0) + N(r.totals.net));
  const gN = {}; GAMES.forEach(g => gN[g] = 0); rpts.forEach(r => GAMES.forEach(g => gN[g] += N(r.games[g]?.revenue || 0)));
  const tRev = rpts.reduce((s,r) => s + N(r.totals.revenue), 0), tNet = rpts.reduce((s,r) => s + N(r.totals.net), 0), tExp = rpts.reduce((s,r) => s + N(r.totals.expenses), 0);
  const tD = S.debts.reduce((s,d) => s + N(d.amount), 0), tB = S.banks.reduce((s,b) => s + N(b.amount), 0);
  const prompt = `Senior analyst for SwiftStake Kenya (shops: ${SHOPS.join(', ')}; games: ${GAMES.join(', ')}).\n\n${pl.toUpperCase()} (${rpts.length} reports):\nRevenue: KES ${fmt(tRev)} | Expenses: KES ${fmt(tExp)} | Net: KES ${fmt(tNet)}\nShops: ${SHOPS.map(s => s + ' KES ' + fmt(sN[s])).join(', ')}\nGames: ${GAMES.map(g => g + ' KES ' + fmt(gN[g])).join(', ')}\nBank: KES ${fmt(tB)} | Debts: KES ${fmt(tD)}\n\nWrite summary: 1) Performance verdict 2) Shop analysis 3) Game performance 4) Financial health 5) Recommendations. 350-450 words.`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'claude-sonnet-4-20250514', max_tokens:1500, messages:[{role:'user', content:prompt}]})});
    const data = await resp.json(); const text = data.content?.[0]?.text || 'Could not generate.';
    if (res) res.textContent = text;
    const dateStr = new Date().toLocaleDateString('en-KE');
    await db.from('ai_summaries').insert({period:pl, date:dateStr, text, report_count:rpts.length});
    savedSummaries.unshift({period:pl, date:dateStr, text, reports:rpts.length}); renderSummaryHistory();
  } catch(e) { if (res) res.textContent = '⚠️ Connection error.'; }
}

function copySummary() { const t = $('summary-result')?.textContent; if (t && navigator.clipboard) navigator.clipboard.writeText(t).then(() => alert('Copied!')); }
function renderSummaryHistory() { const el = $('summary-history'); if (!el) return; if (!savedSummaries.length) { el.innerHTML = ''; return; } el.innerHTML = '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:12px;">📚 Previous Summaries</div>' + savedSummaries.map((s,i) => `<div class="card" style="margin-bottom:10px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;"><span class="tag tag-blue">${s.period}</span><span style="font-size:12px;color:var(--txt3);">${s.date} · ${s.reports} reports</span><button class="sbtn" style="margin-left:auto;font-size:12px;" onclick="toggleSumHist(${i})">View</button></div><div id="sh-${i}" style="display:none;font-size:13px;color:var(--txt2);line-height:1.7;white-space:pre-wrap;margin-top:8px;">${s.text}</div></div>`).join(''); }
function toggleSumHist(i) { const el = $('sh-' + i); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function checkAutoSummary() { const today = new Date().toDateString(); const todayRpts = S.reports.filter(r => new Date(r.id).toDateString() === today); const covered = new Set(todayRpts.map(r => r.shop)); if (covered.size >= SHOPS.length) { pushNotif('📊 All shops submitted!', 'Auto-generating daily AI summary...'); activeSummaryPeriod = 'daily'; setTimeout(() => { if (sess.isAdmin) generateSummary(); }, 1500); } }

// ── SETTINGS ──
function buildStaffTable() {
  if (!S.staff.length) return '<div style="font-size:13px;color:var(--txt3);padding:8px 0;">No staff added yet.</div>';
  let tbl = '<div style="overflow-x:auto;"><table class="stftbl"><thead><tr><th>Name</th><th>Shop</th><th>Role</th><th>Chat</th><th>Finance</th><th>Analytics</th><th>History</th><th>Planning</th><th></th></tr></thead><tbody>';
  S.staff.forEach((s,i) => {
    const pr = s.perms || {}, dis = s.role === 'admin' ? 'disabled' : '';
    const cb = k => `<td style="text-align:center;"><label class="perm-toggle ${dis ? 'perm-toggle-disabled' : ''}"><input type="checkbox" ${pr[k] ? 'checked' : ''} onchange="togglePerm(${i},'${k}',this.checked)" ${dis}><span class="perm-toggle-track"><span class="perm-toggle-thumb"></span></span></label></td>`;
    tbl += `<tr><td style="color:var(--txt);font-weight:600;">${s.name}</td><td><span class="tag tag-gold">${s.shop}</span></td><td><span class="tag ${s.role === 'admin' ? 'tag-blue' : 'tag-green'}">${s.role}</span></td>${cb('chat')}${cb('finance')}${cb('analytics')}${cb('history')}${cb('planning')}<td>${sess.name !== s.name ? `<button class="rmbtn" onclick="removeStaff(${i})">Remove</button>` : '<span style="font-size:10px;color:var(--txt3);">You</span>'}</td></tr>`;
  });
  tbl += '</tbody></table></div>'; return tbl;
}

function buildShopOptions() { return SHOPS.map(s => `<option value="${s}">${s}</option>`).join(''); }
function buildShopList() {
  if (!S.shops || !S.shops.length) return '<div style="font-size:13px;color:var(--txt3);padding:8px 0;">No shops found.</div>';
  return S.shops.map((sh,i) => `<div class="shoprow" id="shoprow-${i}"><span class="shoprow-name" id="shopname-display-${i}">${sh.name}</span><input class="shop-edit-inp" id="shopname-inp-${i}" value="${sh.name}" style="display:none;" maxlength="40"><div class="shop-action-btns"><button class="editshopbtn" id="edit-btn-${i}" onclick="startEditShop(${i})">✏️ Edit</button><button class="saveshopbtn" id="save-btn-${i}" onclick="saveShopName(${i})" style="display:none;">💾 Save</button><button class="delshopbtn" onclick="deleteShop(${i})">🗑️</button></div></div>`).join('');
}

function startEditShop(i) { $('shopname-display-' + i).style.display = 'none'; $('shopname-inp-' + i).style.display = ''; $('shopname-inp-' + i).focus(); $('edit-btn-' + i).style.display = 'none'; $('save-btn-' + i).style.display = ''; }

function renderSettings() {
  const p = $('pane-settings'); if (!p) return;
  const shopHtml = sess.isAdmin ? `<div class="card" style="margin-bottom:14px;"><div class="cardtitle">🏪 Shop Management</div><div id="shop-list-wrap">${buildShopList()}</div><div class="addshoprow"><input id="new-shop-name" placeholder="New shop name" type="text" maxlength="40"><button onclick="addShop()">+ Create</button></div><div id="shopmsg" style="margin-top:8px;font-size:13px;"></div></div>` : '';
  
  const cashThresholdHtml = sess.isAdmin ? `<div class="card" style="margin-bottom:14px;"><div class="cardtitle">💰 Cash Float Thresholds (M-Pesa Deposits)</div>
    <div style="font-size:12px;color:var(--txt3);margin-bottom:12px;">Set minimum cash to keep in shop. Excess is auto-calculated for M-Pesa deposit.</div>
    <div style="display:grid;gap:10px;">${(S.shops || []).map((sh, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg2);border-radius:var(--radius2);border:1px solid var(--border);">
        <span style="font-weight:700;flex:1;">${sh.name}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:13px;color:var(--txt3);">KES</span>
          <input type="number" id="threshold-${sh.name}" value="${(S.cashThresholds && S.cashThresholds[sh.name]) || 5000}" min="1000" max="50000" style="width:100px;border:1px solid var(--border2);border-radius:4px;padding:6px;font-size:14px;outline:none;background:var(--bg3);color:var(--txt);">
          <button onclick="saveCashThreshold('${sh.name}')" style="padding:6px 12px;background:var(--green);color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">Save</button>
        </div>
      </div>
    `).join('')}</div>
    <div id="thresholdmsg" style="margin-top:8px;font-size:13px;"></div>
  </div>` : '';
  
  p.innerHTML = `<div class="ph"><div class="ph-icon">⚙️</div><h2>Settings</h2></div>
    ${shopHtml}
    ${cashThresholdHtml}
    <div class="card" style="margin-bottom:14px;"><div class="cardtitle">👥 Staff & Permissions</div><div id="staff-tbl-wrap">${buildStaffTable()}</div>
      <div class="addstaffgrid">
        <input id="auth-name" placeholder="Full name" type="text">
        <select id="auth-shop" style="background:var(--bg2);color:var(--txt);">${buildShopOptions()}<option value="All">All shops</option></select>
        <input id="auth-pin" placeholder="PIN (4 digits)" type="password" maxlength="4" inputmode="numeric">
        <select id="auth-role" style="background:var(--bg2);color:var(--txt);"><option value="cashier">Cashier</option><option value="admin">Admin</option></select>
        <button onclick="addStaff()">Add Staff Member</button>
      </div>
      <div id="staffmsg" style="margin-top:8px;font-size:13px;"></div>
    </div>
    <div class="card"><div class="cardtitle">🔑 Change Your PIN</div>
      <div style="display:grid;gap:10px;max-width:300px;margin-bottom:14px;">
        <div><label class="fl-lbl">Current PIN</label><input type="password" class="fl-inp" id="cur-pin" maxlength="4" inputmode="numeric"></div>
        <div><label class="fl-lbl">New PIN</label><input type="password" class="fl-inp" id="new-pin" maxlength="4" inputmode="numeric"></div>
        <div><label class="fl-lbl">Confirm PIN</label><input type="password" class="fl-inp" id="conf-pin" maxlength="4" inputmode="numeric"></div>
      </div>
      <button class="bluebtn" onclick="changePin()">Save PIN</button>
      <div id="pinmsg" style="margin-top:8px;font-size:13px;"></div>
    </div>`;
}

async function saveShopName(i) { const inp = $('shopname-inp-' + i); if (!inp) return; const newName = inp.value.trim(), oldName = S.shops[i].name; if (!newName) { alert('Shop name cannot be empty.'); return; } if (newName === oldName) { $('shopname-display-' + i).style.display = ''; $('shopname-inp-' + i).style.display = 'none'; $('edit-btn-' + i).style.display = ''; $('save-btn-' + i).style.display = 'none'; return; } if (SHOPS.includes(newName)) { alert('A shop with that name already exists.'); return; } const msg = $('shopmsg'); if (msg) { msg.textContent = '⏳ Saving...'; msg.className = ''; } try { await db.from('shops').eq('id', S.shops[i].id).update({name:newName}); await db.from('shop_state').eq('shop', oldName).update({shop:newName}); S.shops[i].name = newName; const idx = SHOPS.indexOf(oldName); if (idx > -1) SHOPS[idx] = newName; if (S.shopData[oldName]) { S.shopData[newName] = S.shopData[oldName]; delete S.shopData[oldName]; } if (activeShop === oldName) activeShop = newName; if (msg) { msg.textContent = '✅ Renamed to ' + newName; msg.className = 'succ'; } renderSettings(); setTimeout(() => { const m = $('shopmsg'); if (m) m.textContent = ''; }, 3500); } catch(e) { if (msg) { msg.textContent = '❌ Error renaming.'; msg.className = 'fail'; } } }
async function addShop() { const inp = $('new-shop-name'), msg = $('shopmsg'), name = inp ? inp.value.trim() : ''; if (!name) { if (msg) { msg.textContent = '⚠️ Enter a shop name.'; msg.className = 'fail'; } return; } if (SHOPS.map(s => s.toLowerCase()).includes(name.toLowerCase())) { if (msg) { msg.textContent = '⚠️ Shop already exists.'; msg.className = 'fail'; } return; } if (msg) { msg.textContent = '⏳ Creating...'; msg.className = ''; } try { const {error} = await db.from('shops').insert({name}); if (error) throw new Error(error.message); const {data:f} = await db.from('shops').select('id,name').eq('name', name).limit(1); const ns = f && f[0] ? JSON.parse(JSON.stringify(f[0])) : {id:Date.now(), name}; S.shops.push(ns); SHOPS.push(name); S.shopData[name] = {games:{stellar:{open:0,close:0,topups:[]},pilot:{open:0,close:0,topups:[]},spin:{open:0,close:0,topups:[]}}, expenses:[], openingCash:0, cashRecon:null}; await db.from('shop_state').insert({shop:name, games:{stellar:{open:0,close:0,topups:[]},pilot:{open:0,close:0,topups:[]},spin:{open:0,close:0,topups:[]}}, expenses:[], opening_cash:0, cash_recon:null, cash_movements:[], updated_at:new Date().toISOString()}); if (inp) inp.value = ''; if (msg) { msg.textContent = '✅ "' + name + '" created!'; msg.className = 'succ'; } renderSettings(); setTimeout(() => { const m = $('shopmsg'); if (m) m.textContent = ''; }, 3500); } catch(e) { if (msg) { msg.textContent = '❌ ' + e.message; msg.className = 'fail'; } } }
async function deleteShop(i) { const sh = S.shops[i]; if (!sh) return; const ok = await confirmModal.show('Delete Shop', 'Delete "' + sh.name + '"? Historical reports are kept.', '🗑️ Delete', 'var(--red)', '⚠️'); if (!ok) return; const msg = $('shopmsg'); if (msg) { msg.textContent = '⏳ Deleting...'; msg.className = ''; } try { await db.from('shops').eq('id', sh.id).delete(); await db.from('shop_state').eq('shop', sh.name).delete(); S.shops.splice(i, 1); const idx = SHOPS.indexOf(sh.name); if (idx > -1) SHOPS.splice(idx, 1); delete S.shopData[sh.name]; if (activeShop === sh.name) activeShop = SHOPS[0] || ''; if (msg) { msg.textContent = '✅ Deleted.'; msg.className = 'succ'; } renderSettings(); setTimeout(() => { const m = $('shopmsg'); if (m) m.textContent = ''; }, 3500); } catch(e) { if (msg) { msg.textContent = '❌ ' + e.message; msg.className = 'fail'; } } }
async function togglePerm(i, k, v) {
  S.staff[i].perms[k] = v;
  const s = S.staff[i];
  if (!s.id) return;
  try {
    const {error} = await db.from('staff').eq('id', s.id).update({perms:s.perms});
    if (error) throw new Error(error.message);
  } catch(e) {
    logError('togglePerm', e, {staff: s.name, perm: k});
    alert('⚠️ Could not save permission change for ' + s.name + '. Please check your connection and try again.');
    S.staff[i].perms[k] = !v; // revert local state since save failed
    renderSettings();
  }
}
async function addStaff() { const nEl = $('auth-name'), sEl = $('auth-shop'), pEl = $('auth-pin'), rEl = $('auth-role'), msg = $('staffmsg'); if (!msg) return; const name = nEl ? nEl.value.trim() : '', shop = sEl ? sEl.value : (SHOPS[0]||'Kiawara'), pin = pEl ? pEl.value.trim() : '', role = rEl ? rEl.value : 'cashier'; if (!name) { msg.textContent = '⚠️ Please enter a full name.'; msg.className = 'fail'; return; } if (!/^\d{4}$/.test(pin)) { msg.textContent = '⚠️ PIN must be exactly 4 digits.'; msg.className = 'fail'; return; } if (S.staff.find(s => s.pin === pin)) { msg.textContent = '⚠️ That PIN is already in use.'; msg.className = 'fail'; return; } msg.textContent = '⏳ Saving...'; msg.className = ''; const perms = role === 'admin' ? {...ADMINPERMS} : {...DEFPERMS}; try { const {error} = await db.from('staff').insert({name, shop, pin, role, perms}); if (error) throw new Error(error.message); const {data:f} = await db.from('staff').select('id,name,shop,pin,role,perms').eq('name', name).eq('pin', pin).limit(1); const fm = f && f[0] ? JSON.parse(JSON.stringify(f[0])) : null; S.staff.push(fm ? {id:fm.id, name:String(fm.name), shop:String(fm.shop), pin:String(fm.pin), role:String(fm.role), perms:{...fm.perms}} : {name, shop, pin, role, perms:{...perms}}); if (nEl) nEl.value = ''; if (pEl) pEl.value = ''; renderSettings(); const nm = $('staffmsg'); if (nm) { nm.textContent = '✅ ' + name + ' added!'; nm.className = 'succ'; } setupNav(); setTimeout(() => { const m = $('staffmsg'); if (m) m.textContent = ''; }, 4000); } catch(e) { msg.textContent = '❌ ' + e.message; msg.className = 'fail'; } }
async function removeStaff(i) { const s = S.staff[i]; if (!s) return; const ok = await confirmModal.show('Remove Staff', 'Remove ' + s.name + '?', '🗑️ Remove', 'var(--red)', '👤'); if (!ok) return; try { if (s.id) { const {error} = await db.from('staff').eq('id', s.id).delete(); if (error) throw new Error(error.message); } else await db.from('staff').eq('name', s.name).delete(); S.staff.splice(i, 1); renderSettings(); pushNotif('🗑️ Staff removed', s.name + ' removed.'); } catch(e) { alert('Could not remove: ' + (e.message || 'Error')); } }
async function changePin() { const cur = $('cur-pin').value, nw = $('new-pin').value, cf = $('conf-pin').value; const msg = $('pinmsg'), me = S.staff.find(s => s.name === sess.name); if (!me || cur !== me.pin) { msg.textContent = 'Current PIN incorrect.'; msg.className = 'fail'; return; } if (!/^\d{4}$/.test(nw)) { msg.textContent = 'Must be 4 digits.'; msg.className = 'fail'; return; } if (nw !== cf) { msg.textContent = 'PINs do not match.'; msg.className = 'fail'; return; } me.pin = nw; if (me.id) await db.from('staff').eq('id', me.id).update({pin:nw}); msg.textContent = 'PIN updated!'; msg.className = 'succ'; ['cur-pin','new-pin','conf-pin'].forEach(id => { const e = $(id); if (e) e.value = ''; }); }

async function saveCashThreshold(shop) {
  const inp = $(`threshold-${shop}`);
  if (!inp) return;
  const val = N(inp.value);
  if (val < 1000) { alert('Minimum threshold is KES 1,000'); return; }
  if (val > 50000) { alert('Maximum threshold is KES 50,000'); return; }
  
  if (!S.cashThresholds) S.cashThresholds = {};
  S.cashThresholds[shop] = val;
  
  // Save to localStorage for now (you can sync to DB later)
  localStorage.setItem('swiftstake_cashThresholds', JSON.stringify(S.cashThresholds));
  
  const msg = $('thresholdmsg');
  if (msg) {
    msg.textContent = `✅ ${shop} threshold set to KES ${fmt(val)}`;
    msg.style.color = 'var(--green)';
    setTimeout(() => { msg.textContent = ''; }, 3000);
  }
}

async function confirmMpesaDeposit(depId, idx) {
  const inp = $(`deposit-conf-${depId}`);
  if (!inp) return;
  const amt = N(inp.value);
  const dep = S.mpesaDeposits.find(d => d.id == depId);
  if (!dep) return;
  if (amt <= 0) { alert('Invalid amount'); return; }
  
  const ok = await confirmModal.show('Confirm M-Pesa Deposit', `Confirm KES ${fmt(amt)} received for ${dep.shop}?\n\nRef: ${dep.reference}`, '✅ Confirm', 'var(--green)', '💳');
  if (!ok) return;
  
  dep.status = 'confirmed';
  dep.confirmed_at = new Date().toISOString();
  dep.confirmed_by = sess.name;
  
  // Update database
  try {
    const {error} = await db.from('mpesa_deposits').eq('id', depId).update({status: 'confirmed', confirmed_at: dep.confirmed_at, confirmed_by: sess.name});
    if (error) throw error;
  } catch(e) {
    logError('confirmMpesaDeposit', e, {depositId: depId, amount: amt});
  }
  
  // Add to shop bank account
  const existingBank = S.banks.find(b => b.shop === dep.shop);
  if (existingBank) {
    existingBank.amount = N(existingBank.amount) + amt;
    try {
      await db.from('banks').eq('id', existingBank.id).update({amount: existingBank.amount});
    } catch(e) {
      logError('confirmMpesaDeposit - updateBank', e);
    }
  } else {
    // Create new bank account for shop
    const newBank = {shop: dep.shop, name: dep.shop + ' Bank', amount: amt};
    const {data} = await db.from('banks').insert(newBank);
    if (data && data[0]) S.banks.push(JSON.parse(JSON.stringify(data[0])));
  }
  
  pushNotif('✅ Deposit confirmed', `${dep.shop}: KES ${fmt(amt)}`);
  updateBankingNavBadge();
  await AuditLog.record('confirm', dep.shop, 'mpesa-deposit', 'M-Pesa deposit confirmed', `KES ${fmt(amt)} · Ref: ${dep.reference} · Bank updated`);
  renderBanking();
}
