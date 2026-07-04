// ── CHAT ──
const EMOJIS = {smileys:['😀','😂','🤣','😅','😊','😍','🥰','😎','🤩','😜','😤','😢','😭','🤯','🥳','😴','🤔','😬','🫡','😇'],hands:['👋','🤝','👍','👎','👏','🙌','✌️','🤞','🫶','💪','🙏','👀','🤷','🤦'],hearts:['❤️','🧡','💛','💚','💙','💜','🖤','💕','💞','💓','💗','💖'],misc:['🎉','🎊','🎈','🏆','💰','🤑','🎯','🔥','⚡','🌟','✨','🎁']};
const STICKERS = [{e:'😂',l:'LOL'},{e:'🔥',l:'Fire!'},{e:'💰',l:'Money!'},{e:'👑',l:'Boss'},{e:'🏆',l:'Winner'},{e:'🤑',l:'Paid!'},{e:'💪',l:"Let's go"},{e:'🎯',l:'On target'},{e:'🚀',l:'Rocket'},{e:'🥳',l:'Party!'}];
const QUICK_REACTIONS = ['👍','❤️','😂','😮','😢','🙏'];
let activeChannel = 'general';
let activeDmWith = null; // other person's name when in a DM, else null
let replyingTo = null; // {id, author, text}
const channels = {general:[], announcements:[], kiawara:[], nyeri:[], gachatha:[], ai:[]};
let channelsLoaded = {};
let staffDirectory = null;

function dmChannelKey(a, b) { return 'dm:' + [a, b].sort().join('|'); }

async function loadStaffDirectory() {
  if (staffDirectory) return staffDirectory;
  try {
    const {data, error} = await db.rpc('get_staff_directory', {});
    if (error) throw new Error(error.message);
    staffDirectory = (data || []).filter(s => s.name !== sess.name);
  } catch(e) { logError('loadStaffDirectory', e); staffDirectory = []; }
  return staffDirectory;
}

async function loadChannelHistory(ch) {
  if (channelsLoaded[ch]) return;
  channelsLoaded[ch] = true;
  const {data} = await db.from('messages').select('*').eq('channel', ch).order('created_at').limit(50);
  if (data) channels[ch] = JSON.parse(JSON.stringify(data)).map(m => ({
    _dbid: m.id, author: m.author, text: m.text, isAdmin: m.is_admin, images: m.images || [],
    replyToId: m.reply_to_id, reactions: m.reactions || {}, readBy: m.read_by || [],
    dmParticipants: m.dm_participants || null,
    time: new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
  }));
}

function buildEGrid(cat) { const el = $('emojigrid'); if (!el) return; el.innerHTML = (EMOJIS[cat]||[]).map(e => `<button class="emojibtn" onclick="insertEmoji('${e}')">${e}</button>`).join(''); }
function showEcat(btn, cat) { document.querySelectorAll('.emojipanel button[onclick^="showEcat"]').forEach(b => b.style.opacity = '.5'); btn.style.opacity = '1'; buildEGrid(cat); }
function toggleEmoji(e) { e.stopPropagation(); const sp = $('stickerpanel'); if (sp) sp.classList.remove('on'); const dp = $('dm-picker'); if (dp) dp.classList.remove('on'); const ep = $('emojipanel'); if (ep) ep.classList.toggle('on'); }
function toggleSticker(e) { e.stopPropagation(); const ep = $('emojipanel'); if (ep) ep.classList.remove('on'); const dp = $('dm-picker'); if (dp) dp.classList.remove('on'); const sp = $('stickerpanel'); if (sp) sp.classList.toggle('on'); }
function insertEmoji(em) { const inp = $('msginp'); if (!inp) return; const s = inp.selectionStart; inp.value = inp.value.substring(0, s) + em + inp.value.substring(inp.selectionEnd); inp.selectionStart = inp.selectionEnd = s + em.length; inp.focus(); }
function buildSGrid() { const el = $('stkgrid'); if (!el) return; el.innerHTML = STICKERS.map((s,i) => `<div class="stkitem" onclick="sendSticker(${i})"><span class="se">${s.e}</span><span>${s.l}</span></div>`).join(''); }
async function sendSticker(i) { const sp = $('stickerpanel'); if (sp) sp.classList.remove('on'); const s = STICKERS[i]; await sendMsg(s.e + ' ' + s.l); }
document.addEventListener('click', () => { const ep = $('emojipanel'); if (ep) ep.classList.remove('on'); const sp = $('stickerpanel'); if (sp) sp.classList.remove('on'); const dp = $('dm-picker'); if (dp) dp.classList.remove('on'); });
function handlePhotos(inp) { Array.from(inp.files).forEach(f => { const r = new FileReader(); r.onload = ev => { pendImgs.push({url:ev.target.result}); renderImgStrip(); }; r.readAsDataURL(f); }); inp.value = ''; }
function renderImgStrip() { const el = $('imgstrip'); if (!el) return; if (!pendImgs.length) { el.style.display = 'none'; el.innerHTML = ''; return; } el.style.display = 'flex'; el.innerHTML = pendImgs.map((img,i) => `<div class="imgthumb"><img src="${img.url}"><button class="imgdel" onclick="removePendImg(${i})">✕</button></div>`).join(''); }
function removePendImg(i) { pendImgs.splice(i, 1); renderImgStrip(); }

async function toggleDmPicker(e) {
  e.stopPropagation();
  const ep = $('emojipanel'); if (ep) ep.classList.remove('on');
  const sp = $('stickerpanel'); if (sp) sp.classList.remove('on');
  const dp = $('dm-picker'); if (!dp) return;
  const opening = !dp.classList.contains('on');
  dp.classList.toggle('on');
  if (opening) {
    dp.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--txt3);">Loading...</div>';
    const list = await loadStaffDirectory();
    dp.innerHTML = list.length ? list.map(s => `<div class="dm-picker-item" onclick="openDm('${s.name.replace(/'/g,"\\'")}')">
      <div class="av av-p" style="width:26px;height:26px;font-size:11px;">${s.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</div>
      <div><div style="font-size:13px;font-weight:600;color:var(--txt);">${s.name}</div><div style="font-size:11px;color:var(--txt3);">${s.shop}</div></div>
    </div>`).join('') : '<div style="padding:10px;font-size:12px;color:var(--txt3);">No one else to message yet.</div>';
  }
}

async function openDm(otherName) {
  const dp = $('dm-picker'); if (dp) dp.classList.remove('on');
  document.querySelectorAll('.chi').forEach(c => c.classList.remove('act'));
  const dmTab = $('dm-tab'); if (dmTab) dmTab.classList.add('act');
  activeDmWith = otherName;
  activeChannel = dmChannelKey(sess.name, otherName);
  cancelReply();
  const cn = $('ch-name'); if (cn) cn.textContent = otherName;
  const cd = $('ch-desc'); if (cd) cd.textContent = '— Direct message';
  const mi = $('msginp'); if (mi) mi.placeholder = 'Message ' + otherName + '...';
  const aim = $('ai-mode'); if (aim) aim.checked = false;
  await loadChannelHistory(activeChannel);
  renderFeed();
  markChannelRead(activeChannel);
}

function renderChatPane() {
  const p = $('pane-chat'); if (!p) return;
  const aiCh = sess.isAdmin ? `<div class="chi" id="ai-ch" onclick="switchCh(this,'ai','AI Assistant')">🤖 AI</div>` : '';
  const aiFoot = sess.isAdmin ? '<label class="aitogglelbl"><input type="checkbox" id="ai-mode" style="accent-color:var(--gold);"> Ask AI</label>' : '';
  const pushBtnHtml = (typeof Notification !== 'undefined' && Notification.permission !== 'granted') ? `<div id="push-prompt" class="ibar" style="cursor:pointer;display:flex;align-items:center;gap:8px;" onclick="enablePushClick()">
      <span>🔔</span><span style="flex:1;">Turn on notifications so you don't miss messages when the app is closed</span><span style="font-weight:700;color:var(--gold);">Enable →</span>
    </div>` : '';
  p.innerHTML = `<div class="ph"><div class="ph-icon">💬</div><h2>Team Chat</h2></div>
    ${pushBtnHtml}
    <div class="chatwrap">
      <div class="csb">
        <div class="chi act" onclick="switchCh(this,'general','All shops')">＃ general</div>
        <div class="chi" onclick="switchCh(this,'announcements','Management updates')">＃ updates</div>
        ${SHOPS.map(sh => `<div class="chi" onclick="switchCh(this,'${sh.toLowerCase()}','${sh} team')">＃ ${sh.toLowerCase()}</div>`).join('')}
        <div class="chi" id="dm-tab" onclick="toggleDmPicker(event)">💬 Direct</div>
        ${aiCh}
      </div>
      <div class="cmain">
        <div class="chead"><div class="chead-dot"></div><span id="ch-name">general</span><span class="cdesc" id="ch-desc">— All shops</span></div>
        <div class="mfeed" id="mfeed"></div>
        <div class="composer">
          <div id="reply-preview" style="display:none;"></div>
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
            <div class="dm-picker" id="dm-picker" onclick="event.stopPropagation()"></div>
          </div>
        </div>
      </div>
    </div>`;
  buildEGrid('smileys'); buildSGrid();
  loadChannelHistory('general').then(() => { renderFeed(); markChannelRead('general'); });
  const mi = $('msginp'); if (mi) mi.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
}

async function enablePushClick() {
  const btn = $('push-prompt');
  if (btn) btn.textContent = 'Enabling...';
  const ok = await enablePushNotifications();
  if (ok) { const el = $('push-prompt'); if (el) el.remove(); }
  else renderChatPane();
}

async function switchCh(el, ch, desc) {
  document.querySelectorAll('.chi').forEach(c => c.classList.remove('act')); el.classList.add('act');
  activeChannel = ch; activeDmWith = null; cancelReply();
  const cn = $('ch-name'); if (cn) cn.textContent = ch === 'ai' ? 'AI Assistant' : ch;
  const cd = $('ch-desc'); if (cd) cd.textContent = '— ' + desc;
  const mi = $('msginp'); if (mi) mi.placeholder = ch === 'ai' ? 'Ask SwiftStake AI...' : 'Message #' + ch + '...';
  const aim = $('ai-mode'); if (aim) aim.checked = ch === 'ai';
  await loadChannelHistory(ch); renderFeed(); markChannelRead(ch);
}

function startReply(dbid, author, text) {
  replyingTo = {id: dbid, author, text: (text||'').substring(0, 80)};
  const rp = $('reply-preview'); if (!rp) return;
  rp.style.display = 'flex';
  rp.innerHTML = `<div style="flex:1;overflow:hidden;"><div style="font-size:11px;font-weight:700;color:var(--gold);">Replying to ${author}</div><div style="font-size:12px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(text||'')}</div></div><button onclick="cancelReply()" style="background:none;border:none;color:var(--txt3);font-size:16px;cursor:pointer;padding:0 6px;">✕</button>`;
  const mi = $('msginp'); if (mi) mi.focus();
}
function cancelReply() { replyingTo = null; const rp = $('reply-preview'); if (rp) { rp.style.display = 'none'; rp.innerHTML = ''; } }

async function toggleReaction(dbid, emoji) {
  const msgs = channels[activeChannel] || [];
  const m = msgs.find(x => x._dbid === dbid);
  if (!m || !dbid) return;
  const reactions = m.reactions || {};
  const list = reactions[emoji] || [];
  const idx = list.indexOf(sess.name);
  if (idx >= 0) list.splice(idx, 1); else list.push(sess.name);
  if (list.length) reactions[emoji] = list; else delete reactions[emoji];
  m.reactions = reactions;
  renderFeed();
  try { await db.from('messages').eq('id', dbid).update({reactions}); } catch(e) { logError('toggleReaction', e); }
}

async function markChannelRead(ch) {
  const msgs = channels[ch] || [];
  const toMark = msgs.filter(m => m.author !== sess.name && m._dbid && !(m.readBy||[]).includes(sess.name));
  for (const m of toMark) {
    m.readBy = [...(m.readBy||[]), sess.name];
    try { await db.from('messages').eq('id', m._dbid).update({read_by: m.readBy}); } catch(e) { logError('markChannelRead', e); }
  }
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderFeed() {
  const feed = $('mfeed'); if (!feed) return; const msgs = channels[activeChannel] || [];
  if (!msgs.length) {
    if (activeChannel === 'general') feed.innerHTML = `<div class="msg"><div class="av av-b">JK</div><div><div class="mmeta"><span class="mauth">Jane K. (Admin)</span><span class="mtime">Now</span></div><div class="annbl"><div class="annbl-t">Welcome to SwiftStake! 👋</div><div class="annbl-b">Count floats before opening. EOD reports due by 9 PM.</div></div></div></div>`;
    else if (activeChannel === 'ai') feed.innerHTML = `<div class="msg"><div class="av av-ai">AI</div><div><div class="mmeta"><span class="mauth">SwiftStake AI</span><span class="mtime">Now</span></div><div class="aibubble"><div class="mtxt">Hello! I'm your SwiftStake assistant. Ask me about performance, debts, or what to focus on today.</div></div></div></div>`;
    else if (activeDmWith) feed.innerHTML = `<div style="text-align:center;padding:30px 20px;font-size:13px;color:var(--txt3);">No messages yet. Say hello to ${activeDmWith}!</div>`;
    else feed.innerHTML = `<div style="text-align:center;padding:30px 20px;font-size:13px;color:var(--txt3);">No messages yet.</div>`;
    return;
  }
  feed.innerHTML = '';
  msgs.forEach(m => {
    const div = document.createElement('div'); div.className = 'msg';
    const isAI = m.author === 'SwiftStake AI'; const isMine = m.author === sess.name;
    const avc = isAI ? 'av-ai' : m.isAdmin ? 'av-b' : 'av-p';
    const init = isAI ? 'AI' : m.author.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    let inner = '';

    if (m.replyToId) {
      const orig = msgs.find(x => x._dbid === m.replyToId);
      if (orig) inner += `<div class="reply-quote"><span style="font-weight:700;color:var(--gold);">${orig.author}</span> ${escapeHtml((orig.text||'').substring(0,60))}</div>`;
    }
    if (m.images && m.images.length) inner += m.images.map(src => `<img class="msgimg" src="${src}" onclick="openLightbox('${src}')">`).join('');
    if (m.text) inner += isAI ? `<div class="aibubble"><div class="mtxt">${m.text}</div></div>` : `<div class="mtxt">${escapeHtml(m.text)}</div>`;

    const reactionKeys = Object.keys(m.reactions || {});
    const reactionsHtml = reactionKeys.length ? `<div class="reaction-row">${reactionKeys.map(em => {
      const mine = (m.reactions[em]||[]).includes(sess.name);
      return `<button class="reaction-pill ${mine?'mine':''}" onclick="toggleReaction('${m._dbid}','${em}')">${em} ${m.reactions[em].length}</button>`;
    }).join('')}</div>` : '';

    const msgActionsHtml = !isAI && m._dbid ? `<div class="msg-actions">
      <button onclick="startReply('${m._dbid}','${m.author.replace(/'/g,"\\'")}',${JSON.stringify(m.text||'').replace(/"/g,'&quot;')})" title="Reply">↩</button>
      <button onclick="this.parentElement.classList.toggle('react-open')" title="React">😊</button>
      <div class="quick-react-pop">${QUICK_REACTIONS.map(em => `<button onclick="toggleReaction('${m._dbid}','${em}');this.closest('.msg-actions').classList.remove('react-open')">${em}</button>`).join('')}</div>
    </div>` : '';

    const seenHtml = isMine && m._dbid ? (() => {
      const others = (m.readBy||[]).filter(n => n !== sess.name);
      if (!others.length) return '<span class="seen-tick">✓ Sent</span>';
      return `<span class="seen-tick seen">✓✓ Seen${activeDmWith ? '' : ' by ' + others.length}</span>`;
    })() : '';

    div.innerHTML = `<div class="av ${avc}">${init}</div><div style="flex:1;min-width:0;">
      <div class="mmeta"><span class="mauth">${m.author}</span><span class="mtime">${m.time}</span></div>
      ${inner}
      ${reactionsHtml}
      ${seenHtml}
      ${msgActionsHtml}
    </div>`;
    feed.appendChild(div);
  });
  feed.scrollTop = feed.scrollHeight;
}

async function sendMsg(forcedText) {
  const inp = $('msginp');
  const txt = forcedText !== undefined ? forcedText : (inp ? inp.value.trim() : '');
  if (!txt && !pendImgs.length) return;
  const aim = $('ai-mode'); const isAI = sess.isAdmin && aim && aim.checked && !activeDmWith || activeChannel === 'ai';
  if (isAI && !sess.isAdmin) { alert('AI is available to administrators only.'); return; }

  const ch = activeChannel; const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); const imgUrls = pendImgs.map(i => i.url);
  const dmParticipants = activeDmWith ? [sess.name, activeDmWith].sort() : null;
  const replySnapshot = replyingTo;

  const localMsg = {author:sess.name, text:txt, time, isAdmin:sess.isAdmin, images:imgUrls, replyToId: replySnapshot ? replySnapshot.id : null, reactions:{}, readBy:[], dmParticipants};
  if (!channels[ch]) channels[ch] = [];
  channels[ch].push(localMsg); pendImgs = []; renderImgStrip(); if (inp) inp.value = ''; cancelReply(); renderFeed();

  if (!isAI) {
    try {
      const {data} = await db.from('messages').insert({
        channel: ch, author: sess.name, text: txt, is_admin: sess.isAdmin, images: imgUrls,
        reply_to_id: replySnapshot ? replySnapshot.id : null, dm_participants: dmParticipants
      });
      if (data && data[0]) localMsg._dbid = JSON.parse(JSON.stringify(data[0])).id;
      notifyForMessage(ch, dmParticipants, txt, imgUrls.length > 0);
    } catch(e) { logError('sendMsg', e); }
  } else {
    await callAI(txt, ch);
  }
}

function notifyForMessage(ch, dmParticipants, txt, hasImage) {
  const preview = txt || (hasImage ? '📷 Photo' : 'New message');
  if (dmParticipants) {
    const other = dmParticipants.find(n => n !== sess.name);
    if (other) sendPushToPerson(other, sess.name, preview, 'dm-' + ch, '/');
    return;
  }
  if (ch === 'general' || ch === 'announcements') {
    sendPushToAll(sess.name + ' — #' + ch, preview, ch, '/', sess.name);
    return;
  }
  const shopProper = SHOPS.find(s => s.toLowerCase() === ch);
  if (shopProper) sendPushToShop(shopProper, sess.name + ' — #' + ch, preview, ch, sess.name);
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
    channels[ch].push({author:'SwiftStake AI', text:reply || 'Sorry, try again.', time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), isAdmin:false, images:[], reactions:{}, readBy:[]});
    renderFeed(); await db.from('messages').insert({channel:ch, author:'SwiftStake AI', text:reply, is_admin:false, images:[]});
  } catch(e) {
    logError('callAI', e);
    try { feed.removeChild(typing); } catch(err) {}
    channels[ch].push({author:'SwiftStake AI', text:'⚠️ ' + (e.message || 'Connection error. Try again.'), time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), isAdmin:false, images:[], reactions:{}, readBy:[]});
    renderFeed();
  }
}
