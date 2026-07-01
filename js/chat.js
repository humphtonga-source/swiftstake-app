// ── CHAT ──
const EMOJIS = {smileys:['😀','😂','🤣','😅','😊','😍','🥰','😎','🤩','😜','😤','😢','😭','🤯','🥳','😴','🤔','😬','🫡','😇'],hands:['👋','🤝','👍','👎','👏','🙌','✌️','🤞','🫶','💪','🙏','👀','🤷','🤦'],hearts:['❤️','🧡','💛','💚','💙','💜','🖤','💕','💞','💓','💗','💖'],misc:['🎉','🎊','🎈','🏆','💰','🤑','🎯','🔥','⚡','🌟','✨','🎁']};
const STICKERS = [{e:'😂',l:'LOL'},{e:'🔥',l:'Fire!'},{e:'💰',l:'Money!'},{e:'👑',l:'Boss'},{e:'🏆',l:'Winner'},{e:'🤑',l:'Paid!'},{e:'💪',l:"Let's go"},{e:'🎯',l:'On target'},{e:'🚀',l:'Rocket'},{e:'🥳',l:'Party!'}];
let activeChannel = 'general';
const channels = {general:[], announcements:[], kiawara:[], nyeri:[], gachatha:[], ai:[]};
let channelsLoaded = {};

async function loadChannelHistory(ch) {
  if (channelsLoaded[ch]) return;
  channelsLoaded[ch] = true;
  const {data} = await db.from('messages').select('*').eq('channel', ch).order('created_at').limit(50);
  if (data) channels[ch] = JSON.parse(JSON.stringify(data)).map(m => ({_dbid:m.id, author:m.author, text:m.text, isAdmin:m.is_admin, images:m.images||[], time:new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}));
}

function buildEGrid(cat) { const el = $('emojigrid'); if (!el) return; el.innerHTML = (EMOJIS[cat]||[]).map(e => `<button class="emojibtn" onclick="insertEmoji('${e}')">${e}</button>`).join(''); }
function showEcat(btn, cat) { document.querySelectorAll('.emojipanel button[onclick^="showEcat"]').forEach(b => b.style.opacity = '.5'); btn.style.opacity = '1'; buildEGrid(cat); }
function toggleEmoji(e) { e.stopPropagation(); const sp = $('stickerpanel'); if (sp) sp.classList.remove('on'); const ep = $('emojipanel'); if (ep) ep.classList.toggle('on'); }
function toggleSticker(e) { e.stopPropagation(); const ep = $('emojipanel'); if (ep) ep.classList.remove('on'); const sp = $('stickerpanel'); if (sp) sp.classList.toggle('on'); }
function insertEmoji(em) { const inp = $('msginp'); if (!inp) return; const s = inp.selectionStart; inp.value = inp.value.substring(0, s) + em + inp.value.substring(inp.selectionEnd); inp.selectionStart = inp.selectionEnd = s + em.length; inp.focus(); }
function buildSGrid() { const el = $('stkgrid'); if (!el) return; el.innerHTML = STICKERS.map((s,i) => `<div class="stkitem" onclick="sendSticker(${i})"><span class="se">${s.e}</span><span>${s.l}</span></div>`).join(''); }
async function sendSticker(i) { const sp = $('stickerpanel'); if (sp) sp.classList.remove('on'); const s = STICKERS[i]; const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); channels[activeChannel].push({author:sess.name, text:s.e+' '+s.l, time, isAdmin:sess.isAdmin, images:[]}); renderFeed(); await db.from('messages').insert({channel:activeChannel, author:sess.name, text:s.e+' '+s.l, is_admin:sess.isAdmin, images:[]}); }
document.addEventListener('click', () => { const ep = $('emojipanel'); if (ep) ep.classList.remove('on'); const sp = $('stickerpanel'); if (sp) sp.classList.remove('on'); });
function handlePhotos(inp) { Array.from(inp.files).forEach(f => { const r = new FileReader(); r.onload = ev => { pendImgs.push({url:ev.target.result}); renderImgStrip(); }; r.readAsDataURL(f); }); inp.value = ''; }
function renderImgStrip() { const el = $('imgstrip'); if (!el) return; if (!pendImgs.length) { el.style.display = 'none'; el.innerHTML = ''; return; } el.style.display = 'flex'; el.innerHTML = pendImgs.map((img,i) => `<div class="imgthumb"><img src="${img.url}"><button class="imgdel" onclick="removePendImg(${i})">✕</button></div>`).join(''); }
function removePendImg(i) { pendImgs.splice(i, 1); renderImgStrip(); }

function renderChatPane() {
  const p = $('pane-chat'); if (!p) return;
  const aiCh = sess.isAdmin ? `<div class="chi" id="ai-ch" onclick="switchCh(this,'ai','AI Assistant')">🤖 AI</div>` : '';
  const aiFoot = sess.isAdmin ? '<label class="aitogglelbl"><input type="checkbox" id="ai-mode" style="accent-color:var(--gold);"> Ask AI</label>' : '';
  p.innerHTML = `<div class="ph"><div class="ph-icon">💬</div><h2>Team Chat</h2></div>
    <div class="chatwrap">
      <div class="csb">
        <div class="chi act" onclick="switchCh(this,'general','All shops')">＃ general</div>
        <div class="chi" onclick="switchCh(this,'announcements','Management updates')">＃ updates</div>
        ${SHOPS.map(sh => `<div class="chi" onclick="switchCh(this,'${sh.toLowerCase()}','${sh} team')">＃ ${sh.toLowerCase()}</div>`).join('')}
        ${aiCh}
      </div>
      <div class="cmain">
        <div class="chead"><div class="chead-dot"></div><span id="ch-name">general</span><span class="cdesc" id="ch-desc">— All shops</span></div>
        <div class="mfeed" id="mfeed"></div>
        <div class="composer">
          <div class="imgstrip" id="imgstrip" style="display:none;"></div>
          <div class="cbox">
            <textarea class="cta" id="msginp" rows="2" placeholder="Message #general..."></textarea>
            <div class="cfooter">
              <button class="toolfbtn" onclick="toggleEmoji(event)">😀</button>
              <button class="toolfbtn" onclick="toggleSticker(event)">🎭</button>
              <button class="toolfbtn" onclick="$('photo-input').click()">📷</button>
              ${aiFoot}
              <button class="sendbtn" onclick="sendMsg()">Send ↑</button>
            </div>
          </div>
          <div class="comprel">
            <div class="emojipanel" id="emojipanel">
              <div style="display:flex;gap:3px;margin-bottom:6px;">
                <button class="emojibtn" onclick="showEcat(this,'smileys')" style="font-size:13px;opacity:.5;">😀</button>
                <button class="emojibtn" onclick="showEcat(this,'hands')" style="font-size:13px;opacity:.5;">👋</button>
                <button class="emojibtn" onclick="showEcat(this,'hearts')" style="font-size:13px;opacity:.5;">❤️</button>
                <button class="emojibtn" onclick="showEcat(this,'misc')" style="font-size:13px;opacity:.5;">🎉</button>
              </div>
              <div class="emojigrid" id="emojigrid"></div>
            </div>
            <div class="stickerpanel" id="stickerpanel">
              <div style="font-size:10px;font-weight:700;color:var(--txt3);margin-bottom:6px;text-transform:uppercase;">Quick Reactions</div>
              <div class="stkgrid" id="stkgrid"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  buildEGrid('smileys'); buildSGrid();
  loadChannelHistory('general').then(() => renderFeed());
  const mi = $('msginp'); if (mi) mi.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
}

async function switchCh(el, ch, desc) {
  document.querySelectorAll('.chi').forEach(c => c.classList.remove('act')); el.classList.add('act');
  activeChannel = ch; const cn = $('ch-name'); if (cn) cn.textContent = ch === 'ai' ? 'AI Assistant' : ch;
  const cd = $('ch-desc'); if (cd) cd.textContent = '— ' + desc;
  const mi = $('msginp'); if (mi) mi.placeholder = ch === 'ai' ? 'Ask SwiftStake AI...' : 'Message #' + ch + '...';
  const aim = $('ai-mode'); if (aim) aim.checked = ch === 'ai';
  await loadChannelHistory(ch); renderFeed();
}

function renderFeed() {
  const feed = $('mfeed'); if (!feed) return; const msgs = channels[activeChannel] || [];
  if (!msgs.length) {
    if (activeChannel === 'general') feed.innerHTML = `<div class="msg"><div class="av av-b">JK</div><div><div class="mmeta"><span class="mauth">Jane K. (Admin)</span><span class="mtime">Now</span></div><div class="annbl"><div class="annbl-t">Welcome to SwiftStake! 👋</div><div class="annbl-b">Count floats before opening. EOD reports due by 9 PM.</div></div></div></div>`;
    else if (activeChannel === 'ai') feed.innerHTML = `<div class="msg"><div class="av av-ai">AI</div><div><div class="mmeta"><span class="mauth">SwiftStake AI</span><span class="mtime">Now</span></div><div class="aibubble"><div class="mtxt">Hello! I'm your SwiftStake assistant. Ask me about performance, debts, or what to focus on today.</div></div></div></div>`;
    else feed.innerHTML = `<div style="text-align:center;padding:30px 20px;font-size:13px;color:var(--txt3);">No messages yet.</div>`;
    return;
  }
  feed.innerHTML = '';
  msgs.forEach(m => {
    const div = document.createElement('div'); div.className = 'msg';
    const isAI = m.author === 'SwiftStake AI'; const avc = isAI ? 'av-ai' : m.isAdmin ? 'av-b' : 'av-p';
    const init = isAI ? 'AI' : m.author.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    let inner = '';
    if (m.images && m.images.length) inner += m.images.map(src => `<img class="msgimg" src="${src}" onclick="openLightbox('${src}')">`).join('');
    if (m.text) inner += isAI ? `<div class="aibubble"><div class="mtxt">${m.text}</div></div>` : `<div class="mtxt">${m.text}</div>`;
    div.innerHTML = `<div class="av ${avc}">${init}</div><div><div class="mmeta"><span class="mauth">${m.author}</span><span class="mtime">${m.time}</span></div>${inner}</div>`;
    feed.appendChild(div);
  });
  feed.scrollTop = feed.scrollHeight;
}

async function sendMsg() {
  const inp = $('msginp'); if (!inp) return; const txt = inp.value.trim(); if (!txt && !pendImgs.length) return;
  const aim = $('ai-mode'); const isAI = sess.isAdmin && aim && aim.checked || activeChannel === 'ai';
  if (isAI && !sess.isAdmin) { alert('AI is available to administrators only.'); return; }
  const ch = activeChannel === 'ai' ? 'ai' : activeChannel; const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); const imgUrls = pendImgs.map(i => i.url);
  const localMsg = {author:sess.name, text:txt, time, isAdmin:sess.isAdmin, images:imgUrls}; channels[ch].push(localMsg); pendImgs = []; renderImgStrip(); inp.value = ''; renderFeed();
  if (!isAI) { const {data} = await db.from('messages').insert({channel:ch, author:sess.name, text:txt, is_admin:sess.isAdmin, images:imgUrls}); if (data && data[0]) localMsg._dbid = JSON.parse(JSON.stringify(data[0])).id; }
  else await callAI(txt, ch);
}

async function callAI(q, ch) {
  const feed = $('mfeed'); if (!feed) return;
  const typing = document.createElement('div'); typing.className = 'typing'; typing.textContent = 'SwiftStake AI is thinking...'; feed.appendChild(typing); feed.scrollTop = feed.scrollHeight;
  const sN = {}; SHOPS.forEach(s => sN[s] = 0); S.reports.forEach(r => sN[r.shop] = (sN[r.shop] || 0) + N(r.totals.net));
  const tD = S.debts.reduce((s,d) => s + N(d.amount), 0), tB = S.banks.reduce((s,b) => s + N(b.amount), 0);
  const ctx = `You are SwiftStake AI for a Kenyan betting chain (shops: ${SHOPS.join(', ')}; games: ${GAMES.join(', ')}). Net profits: ${SHOPS.map(s => s + ' KES ' + fmt(sN[s])).join(', ')}. Bank: KES ${fmt(tB)}. Debts: KES ${fmt(tD)}. Reports: ${S.reports.length}. Be concise, under 200 words.`;
  try {
    const reply = await askAI(q, {system: ctx, max_tokens: 1000});
    try { feed.removeChild(typing); } catch(e) {}
    channels[ch].push({author:'SwiftStake AI', text:reply || 'Sorry, try again.', time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), isAdmin:false, images:[]});
    renderFeed(); await db.from('messages').insert({channel:ch, author:'SwiftStake AI', text:reply, is_admin:false, images:[]});
  } catch(e) {
    logError('callAI', e);
    try { feed.removeChild(typing); } catch(err) {}
    channels[ch].push({author:'SwiftStake AI', text:'⚠️ ' + (e.message || 'Connection error. Try again.'), time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), isAdmin:false, images:[]});
    renderFeed();
  }
}
