// ── PLANNING ──
async function initPlanning() {
  if (!S.planTasks.daily.length) {
    const defs = [
      {period:'daily', text:'Count and verify opening float for all games', done:false, due_time:'08:00', priority:'high'},
      {period:'daily', text:'Submit end of day report before closing', done:false, due_time:'21:00', priority:'high'},
      {period:'weekly', text:'Review weekly revenue vs target', done:false, due_time:'', priority:'high'},
      {period:'monthly', text:'Achieve combined revenue target', done:false, due_time:'', priority:'high'}
    ];
    const {data} = await db.from('plan_tasks').insert(defs);
    if (data) JSON.parse(JSON.stringify(data)).forEach(t => { if (S.planTasks[t.period]) S.planTasks[t.period].push({id:t.id, text:t.text, done:t.done, due:t.due_time||'', pri:t.priority}); });
  }
}

function renderPlanning() {
  const p = $('pane-planning'); if (!p) return;
  if (!sess.perms.planning) { p.innerHTML = '<div class="denied"><div class="dico">🔒</div><h3>Planning restricted</h3></div>'; return; }
  const now = new Date();
  p.innerHTML = `<div class="ph"><div class="ph-icon">📅</div><h2>Planning</h2><div class="phr">${sess.isAdmin ? '<button class="sbtn" onclick="getAISugg()">🤖 AI Suggestions</button><button class="goldbtn" onclick="openProjModal()">+ New Project</button>' : ''}</div></div>
    <div class="plantabs"><button class="plantab act" onclick="switchPlan(this,'daily')">Daily</button><button class="plantab" onclick="switchPlan(this,'weekly')">Weekly</button><button class="plantab" onclick="switchPlan(this,'monthly')">Monthly</button><button class="plantab" onclick="switchPlan(this,'projects')">Projects</button></div>
    <div id="plan-daily" class="plansec act"><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-size:14px;font-weight:700;color:var(--txt);">Today's Tasks</span><span style="font-size:12px;color:var(--txt3);">${now.toLocaleDateString('en-KE',{weekday:'long',day:'numeric',month:'short'})}</span></div><div id="daily-list"></div><div class="addtaskform"><input type="text" id="daily-inp" placeholder="Add a daily task..."><input type="time" id="daily-time" style="max-width:100px;"><select id="daily-pri" style="max-width:90px;background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:var(--radius2);padding:8px;"><option value="high">🔴 High</option><option value="med" selected>🟡 Med</option><option value="low">🟢 Low</option></select><button onclick="addPTask('daily')">Add</button></div>${sess.isAdmin ? '<div id="ai-daily" class="aisugg" style="display:none;"></div>' : ''}</div></div>
    <div id="plan-weekly" class="plansec"><div class="card"><div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:12px;">This Week's Goals</div><div id="weekly-list"></div><div class="addtaskform"><input type="text" id="weekly-inp" placeholder="Add a weekly goal..."><input type="date" id="weekly-due" style="max-width:130px;"><select id="weekly-pri" style="max-width:90px;background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:var(--radius2);padding:8px;"><option value="high">🔴 High</option><option value="med" selected>🟡 Med</option><option value="low">🟢 Low</option></select><button onclick="addPTask('weekly')">Add</button></div></div></div>
    <div id="plan-monthly" class="plansec"><div class="card"><div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:12px;">Monthly Targets</div><div id="monthly-list"></div><div class="addtaskform"><input type="text" id="monthly-inp" placeholder="Add a monthly target..."><input type="date" id="monthly-due" style="max-width:130px;"><select id="monthly-pri" style="max-width:90px;background:var(--bg2);color:var(--txt);border:1px solid var(--border2);border-radius:var(--radius2);padding:8px;"><option value="high">🔴 High</option><option value="med" selected>🟡 Med</option><option value="low">🟢 Low</option></select><button onclick="addPTask('monthly')">Add</button></div></div></div>
    <div id="plan-projects" class="plansec"><div id="projlist"></div><div id="noproj" style="text-align:center;padding:40px;color:var(--txt3);font-size:14px;">No projects yet.${sess.isAdmin ? ' Create one above.' : ''}</div></div>`;
  renderPList('daily'); renderPList('weekly'); renderPList('monthly'); renderProjects();
}

function switchPlan(btn, sec) {
  document.querySelectorAll('.plantab').forEach(t => t.classList.remove('act')); btn.classList.add('act');
  document.querySelectorAll('.plansec').forEach(s => s.classList.remove('act')); const el = $('plan-' + sec); if (el) el.classList.add('act');
}

function renderPList(p) {
  const el = $(p + '-list'); if (!el) return;
  const tasks = S.planTasks[p];
  if (!tasks || !tasks.length) { el.innerHTML = '<div style="padding:12px 0;font-size:13px;color:var(--txt3);">No tasks yet.</div>'; return; }
  const pm = {high:'pri-high', med:'pri-med', low:'pri-low'};
  el.innerHTML = tasks.map((t,i) => `<div class="ptitem"><div class="ptcb ${t.done ? 'done' : ''}" onclick="togglePTask('${p}',${i})">${t.done ? '✓' : ''}</div><span class="pttext ${t.done ? 'done' : ''}">${t.text}</span>${t.due ? `<span class="ptdue">⏰ ${t.due}</span>` : ''}<span class="${pm[t.pri] || 'pri-med'}">${t.pri || 'med'}</span><button class="ptdel" onclick="delPTask('${p}',${i})">✕</button></div>`).join('');
}

async function togglePTask(p, i) {
  S.planTasks[p][i].done = !S.planTasks[p][i].done;
  if (S.planTasks[p][i].id) await db.from('plan_tasks').update({done: S.planTasks[p][i].done}).eq('id', S.planTasks[p][i].id);
  renderPList(p); const el = $('pane-dashboard'); if (el && el.classList.contains('on')) renderDashboard();
}

async function delPTask(p, i) {
  const t = S.planTasks[p][i]; if (t.id) await db.from('plan_tasks').eq('id', t.id).delete();
  S.planTasks[p].splice(i, 1); renderPList(p);
}

async function addPTask(p) {
  const inp = $(p + '-inp'), dueEl = p === 'daily' ? $('daily-time') : $(p + '-due'), priEl = $(p + '-pri');
  const text = inp ? inp.value.trim() : ''; if (!text) return;
  const {data} = await db.from('plan_tasks').insert({period:p, text, done:false, due_time:dueEl ? dueEl.value : '', priority:priEl ? priEl.value : 'med'});
  if (data && data[0]) { const t = JSON.parse(JSON.stringify(data[0])); S.planTasks[p].push({id:t.id, text, done:false, due:dueEl ? dueEl.value : '', pri:priEl ? priEl.value : 'med'}); }
  if (inp) inp.value = ''; if (dueEl) dueEl.value = ''; renderPList(p); pushNotif('📅 Task added', text);
}

async function getAISugg() {
  if (!sess.isAdmin) return;
  const active = document.querySelector('.plantab.act')?.textContent.trim().toLowerCase() || 'daily';
  const sN = {}; SHOPS.forEach(s => sN[s] = 0); S.reports.forEach(r => sN[r.shop] = (sN[r.shop] || 0) + N(r.totals.net));
  const prompt = `Business advisor for SwiftStake Kenya betting shops (${SHOPS.join(', ')}; games: ${GAMES.join(', ')}). Net profits: ${SHOPS.map(s => s + ' KES ' + fmt(sN[s])).join(', ')}. Generate 3-4 practical ${active} tasks. Short numbered list, under 120 words.`;
  const el = $('ai-' + active); if (!el) return; el.style.display = 'block'; el.innerHTML = '🤖 Getting AI suggestions...';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'claude-sonnet-4-20250514', max_tokens:400, messages:[{role:'user', content:prompt}]})});
    const data = await res.json(); el.innerHTML = '<strong style="color:var(--blue);">🤖 AI Suggestions:</strong><br><br>' + (data.content?.[0]?.text || 'Could not generate.').replace(/\n/g, '<br>');
  } catch(e) { el.innerHTML = '⚠️ Connection error.'; }
}

function openProjModal() { if (!sess.isAdmin) return; openModal('proj-modal'); $('proj-start').value = new Date().toISOString().split('T')[0]; }

async function createProject() {
  const name = $('proj-name').value.trim(), shop = $('proj-shop').value, cashier = $('proj-cashier').value, desc = $('proj-desc').value.trim(), start = $('proj-start').value, end = $('proj-end').value, ms1 = $('proj-ms1').value.trim();
  if (!name) { alert('Enter a project name.'); return; } const id = Date.now();
  const proj = {id, name, shop, cashier, description:desc, start_date:start, end_date:end, created_by:sess.name, milestones:ms1 ? [{text:ms1, done:false, due:end}] : [], chat:[]};
  await db.from('projects').insert(proj);
  S.projects.unshift({id, name, shop, cashier, desc, start, end, createdBy:sess.name, milestones:proj.milestones, chat:[]});
  closeModal('proj-modal'); ['proj-name','proj-desc','proj-ms1'].forEach(x => { const e = $(x); if (e) e.value = ''; });
  switchPlan(document.querySelectorAll('.plantab')[3], 'projects'); renderProjects(); pushNotif('🗂️ Project created', name);
}

function renderProjects() {
  const el = $('projlist'), nm = $('noproj'); if (!el) return;
  const vis = S.projects.filter(p => sess.isAdmin || (p.shop === sess.shop && (!p.cashier || p.cashier === sess.name)));
  if (nm) nm.style.display = vis.length ? 'none' : 'block'; el.innerHTML = '';
  vis.forEach(p => {
    const done = p.milestones.filter(m => m.done).length, total = p.milestones.length, pct = total ? Math.round(done / total * 100) : 0;
    const div = document.createElement('div'); div.className = 'projcard';
    div.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;flex-wrap:wrap;"><div style="flex:1;"><div class="projtitle">${p.name}</div>${p.desc ? `<div style="font-size:12px;color:var(--txt2);margin-top:3px;">${p.desc}</div>` : ''}</div><span class="tag tag-gold">${p.shop}</span>${p.cashier ? `<span class="tag tag-blue">${p.cashier}</span>` : ''}</div>
      <div class="projmeta"><span>📅 ${p.start || '—'} → ${p.end || '—'}</span><span>✅ ${done}/${total}</span><span>👤 ${p.createdBy}</span></div>
      <div class="progbar" style="margin-bottom:12px;"><div class="progfill" style="width:${pct}%"></div></div>
      <div>${p.milestones.map((m,mi) => `<div class="msitem" onclick="toggleMS(${p.id},${mi})"><div class="msdot ${m.done ? 'done' : ''}">${m.done ? '✓' : ''}</div><span class="mstext ${m.done ? 'done' : ''}">${m.text}</span><span class="msdue">${m.due}</span></div>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">${sess.isAdmin ? `<button class="sbtn" onclick="addMS(${p.id})">+ Milestone</button>` : ''}<button class="sbtn" onclick="toggleProjChat(${p.id})">💬 Chat ${p.chat.length ? '(' + p.chat.length + ')' : ''}</button>${sess.isAdmin ? `<button class="redbtn" onclick="deleteProj(${p.id})">Delete</button>` : ''}</div>
      <div class="projchat" id="pchat-${p.id}" style="display:none;"><div class="projchatfeed" id="pcf-${p.id}">${p.chat.map(m => `<div class="projchatmsg"><span class="pa">${m.author}</span><span style="font-size:11px;color:var(--txt3);margin-left:6px;">${m.time}</span><div class="pt">${m.text}</div></div>`).join('')}</div><div class="projcomp"><input type="text" id="pci-${p.id}" placeholder="Message..." onkeydown="if(event.key==='Enter')sendProjMsg(${p.id})"><button onclick="sendProjMsg(${p.id})">Send</button></div></div>`;
    el.appendChild(div);
  });
}

async function toggleMS(pid, mi) { const p = S.projects.find(x => x.id === pid); if (!p) return; p.milestones[mi].done = !p.milestones[mi].done; await db.from('projects').update({milestones:p.milestones}).eq('id', pid); if (p.milestones[mi].done) pushNotif('✅ Milestone done!', p.milestones[mi].text); renderProjects(); }
async function addMS(pid) { const t = prompt('Milestone:'); if (!t) return; const d = prompt('Due date (optional):'); const p = S.projects.find(x => x.id === pid); if (!p) return; p.milestones.push({text:t, done:false, due:d||''}); await db.from('projects').update({milestones:p.milestones}).eq('id', pid); renderProjects(); }
async function deleteProj(pid) { if (confirm('Delete project?')) { await db.from('projects').eq('id', pid).delete(); S.projects = S.projects.filter(p => p.id !== pid); renderProjects(); } }
function toggleProjChat(pid) { const el = $('pchat-' + pid); if (el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; if (el.style.display === 'block') { const f = $('pcf-' + pid); if (f) f.scrollTop = f.scrollHeight; } } }
async function sendProjMsg(pid) { const inp = $('pci-' + pid); const txt = inp.value.trim(); if (!txt) return; const p = S.projects.find(x => x.id === pid); if (!p) return; p.chat.push({author:sess.name, text:txt, time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}); await db.from('projects').update({chat:p.chat}).eq('id', pid); inp.value = ''; renderProjects(); setTimeout(() => { const el = $('pchat-' + pid); if (el) el.style.display = 'block'; const f = $('pcf-' + pid); if (f) f.scrollTop = f.scrollHeight; }, 50); }
