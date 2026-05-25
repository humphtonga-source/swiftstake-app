// ── REALTIME SUBSCRIPTIONS ──
function subscribeToChat() {
  if (realtimeSub) db.removeChannel(realtimeSub);
  realtimeSub = db.channel('messages-channel')
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'messages'}, payload => {
      const m = payload.new, ch = m.channel;
      if (!channels[ch]) channels[ch] = [];
      if (!channels[ch].find(x => x._dbid === m.id)) {
        channels[ch].push({
          _dbid: m.id, author: m.author, text: m.text, isAdmin: m.is_admin,
          images: m.images || [],
          time: new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        });
        if (ch === activeChannel) renderFeed();
        else pushNotif('💬 New message in #' + ch, (m.author || '') + (m.text ? ' — ' + m.text.substring(0, 40) : ''));
      }
    })
    .subscribe();
}

function subscribeToDataChanges() {
  if (realtimeDataSub) db.removeChannel(realtimeDataSub);
  realtimeDataSub = _rdb.channel('data-changes')
    .on('postgres_changes', {event:'*', schema:'public', table:'shop_state'}, payload => {
      const row = payload.new || payload.old;
      if (!row || !row.shop) return;
      const sh = row.shop;

      if (payload.eventType === 'DELETE') {
        if (S.shopData[sh]) {
          S.shopData[sh] = {games:{}, expenses:[], openingCash:0, cashRecon:null, cashMovements:[], openedAt:null};
          GAMES.forEach(g => { S.shopData[sh].games[g] = {open:0, close:0, topups:[]}; });
        }
        return;
      }

      const r = payload.new;
      if (!S.shopData[sh]) S.shopData[sh] = {games:{}, expenses:[], openingCash:0, cashRecon:null, cashMovements:[], openedAt:null};
      S.shopData[sh].games        = r.games && Object.keys(r.games).length ? r.games : S.shopData[sh].games;
      S.shopData[sh].expenses     = Array.isArray(r.expenses) ? r.expenses : S.shopData[sh].expenses;
      S.shopData[sh].openingCash  = r.opening_cash  != null ? r.opening_cash  : S.shopData[sh].openingCash;
      S.shopData[sh].cashRecon    = r.cash_recon    != null ? r.cash_recon    : S.shopData[sh].cashRecon;
      S.shopData[sh].cashMovements= Array.isArray(r.cash_movements) ? r.cash_movements : S.shopData[sh].cashMovements;
      S.shopData[sh].openedAt     = r.opened_at     != null ? r.opened_at     : S.shopData[sh].openedAt;

      if (r.games) Object.keys(r.games).forEach(g => { if (!GAMES.includes(g)) GAMES.push(g); });

      const financeOpen = $('pane-finance') && $('pane-finance').classList.contains('on');

      if (sess.isAdmin && financeOpen && activeShop === sh) {
        const _ft = document.activeElement;
        const _typing = _ft && _ft.tagName === 'INPUT' && financeOpen;
        if (!_typing) { refreshShopData(sh).then(() => loadShopData(sh)); }
      }

      // Cashier: refresh cash movement log live when admin adds/removes a movement for their shop
      if (!sess.isAdmin && sess.shop === sh && financeOpen) {
        renderCashMovLog();
        updateCashMovEOD();
        const _focused = document.activeElement;
        const _isTyping = _focused && _focused.tagName === 'INPUT' && $("pane-finance") && $("pane-finance").classList.contains("on");
        if (!_isTyping) recalc();
        // Flash the section so cashier notices the update
        const card = $('cashmov-log');
        if (card) {
          card.style.transition = 'background 0.4s';
          card.style.background = 'rgba(34,197,94,0.12)';
          setTimeout(() => { card.style.background = ''; }, 1200);
        }
        const _cmKey='_lastCMNotif_'+sh,_now2=Date.now(); if(!window[_cmKey]||_now2-window[_cmKey]>120000){window[_cmKey]=_now2; pushNotif('💵 Cash movement updated','Admin updated '+sh+' cash');}
      }

      if (sess.isAdmin && $('pane-dashboard') && $('pane-dashboard').classList.contains('on'))
        renderDashboard();

      const nKey = '_lastDataNotif_' + sh, now = Date.now();
      if (sess.isAdmin && (!window[nKey] || now - window[nKey] > 300000)) {
        window[nKey] = now;
        pushNotif('🔄 ' + sh + ' updated', 'Live data received from cashier');
      }
    })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'reports'}, payload => {
      const r = payload.new; if (!r) return;
      const mapped = {id:r.id, shop:r.shop, date:r.date, time:r.time, by:r.by_name, games:r.games||{}, expenses:r.expenses||[], cashRecon:r.cash_recon, totals:r.totals||{}};
      if (!S.reports.find(x => x.id === r.id)) S.reports.unshift(mapped);
      if (sess.isAdmin) {
        if ($('pane-dashboard') && $('pane-dashboard').classList.contains('on')) renderDashboard();
        if ($('pane-analytics') && $('pane-analytics').classList.contains('on')) setupAnalytics();
        if ($('pane-history')   && $('pane-history').classList.contains('on'))   renderHistory();
        pushNotif('📋 New report — ' + r.shop, 'Net KES ' + (r.totals && r.totals.net != null ? fmt(r.totals.net) : '—'));
      }
    })
    .subscribe();
}
