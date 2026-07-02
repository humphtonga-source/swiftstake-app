// ── DATABASE CLIENT ──
function xhrRequest(method, url, headers, body) {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    Object.entries(headers).forEach(([k,v]) => xhr.setRequestHeader(k, v));
    xhr.onload = function() {
      let d = null;
      try { d = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch(e) {}
      if (xhr.status >= 200 && xhr.status < 300)
        resolve({data: Array.isArray(d) ? d : (d ? [d] : []), error: null});
      else
        resolve({data: null, error: {message: (d && (d.message || d.hint || d.error)) || 'HTTP ' + xhr.status}});
    };
    xhr.onerror  = () => resolve({data:null, error:{message:'Network error'}});
    xhr.ontimeout= () => resolve({data:null, error:{message:'Timeout'}});
    xhr.timeout = 15000;
    xhr.send(body !== undefined ? JSON.stringify(body) : null);
  });
}

function authHeaders() {
  // When sessToken is set (login Edge Function is configured and this
  // person is signed in), send their real per-user JWT so RLS can see
  // who's asking. Otherwise fall back to the publishable key exactly as
  // before - this must never be the thing that breaks a login.
  const bearer = sessToken || SUPABASE_KEY;
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + bearer,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

function dbReq(method, table, qs, body, extra) {
  return xhrRequest(method, SUPABASE_URL + '/rest/v1/' + table + (qs ? '?' + qs : ''),
    Object.assign({}, authHeaders(), extra || {}), body);
}

function buildChain(table, filters, cols, orders, lim) {
  const obj = {
    select(c) { return buildChain(table, [...filters], c||'*', orders, lim); },
    eq(col, val) {
      const nf = [...filters, col + '=eq.' + encodeURIComponent(String(val))];
      const ch = buildChain(table, nf, cols, orders, lim);
      ch.update = body => dbReq('PATCH', table, nf.join('&'), body, {'Prefer':'return=representation'});
      ch.delete = () => dbReq('DELETE', table, nf.join('&'));
      return ch;
    },
    order(col, opts) { return buildChain(table, [...filters], cols, [...orders, col + '.' + (opts && opts.ascending === false ? 'desc' : 'asc')], lim); },
    limit(n) { return buildChain(table, [...filters], cols, orders, n); },
    update(body) { return dbReq('PATCH', table, filters.join('&'), body, {'Prefer':'return=representation'}); },
    delete() { return dbReq('DELETE', table, filters.join('&')); },
    then(res, rej) {
      const p = ['select=' + encodeURIComponent(cols||'*'), ...filters];
      if (orders.length) p.push('order=' + orders.join(','));
      if (lim) p.push('limit=' + lim);
      dbReq('GET', table, p.join('&')).then(res).catch(rej);
    }
  };
  return obj;
}

const db = {
  from(table) {
    return {
      select(c) { return buildChain(table, [], c||'*', [], null); },
      eq(col, val) {
        const f = col + '=eq.' + encodeURIComponent(String(val));
        return {
          select(c) { return buildChain(table, [f], c||'*', [], null); },
          limit(n)  { return buildChain(table, [f], '*', [], n); },
          async update(body) { return dbReq('PATCH', table, f, body, {'Prefer':'return=representation'}); },
          async delete()     { return dbReq('DELETE', table, f); },
          then(res, rej)     { dbReq('GET', table, 'select=*&' + f).then(res).catch(rej); }
        };
      },
      async insert(body) {
        const p = Array.isArray(body) ? body : [body];
        return dbReq('POST', table, '', p.length === 1 ? p[0] : p, {'Prefer':'return=representation'});
      },
      async upsert(body, opts) {
        const p = Array.isArray(body) ? body : [body];
        const qs = opts && opts.onConflict ? 'on_conflict=' + encodeURIComponent(opts.onConflict) : '';
        return dbReq('POST', table, qs, p.length === 1 ? p[0] : p, {'Prefer':'resolution=merge-duplicates,return=representation'});
      }
    };
  },
  channel(n)        { return _rdb.channel(n); },
  removeChannel(ch) { try { _rdb.removeChannel(ch); } catch(e) {} }
};

const _rdb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}
});
