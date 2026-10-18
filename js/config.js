// ── CONFIG & SHARED STATE ──
const SUPABASE_URL = 'https://inlafchehdzjiesetvvr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA4igGd_AjqTR2NW5GJhsQ_mzC1aaAu';

// Filled from the database at startup (see bootApp). Deliberately empty - a
// hardcoded list of shop names goes stale the moment a shop is renamed, and
// then silently saves data under the old name.
let SHOPS = [];
let GAMES = ['stellar','pilot','spin'];
const COLORS = ['#3b82f6','#f59e0b','#22c55e','#a855f7','#ef4444'];
const DEFPERMS  = {chat:true,finance:true,analytics:true,history:true,planning:true};
const ADMINPERMS = {chat:true,finance:true,analytics:true,history:true,planning:true,banking:true,roadmap:true,settings:true,turnover:true,aisummary:true};
// A manager's perms are the same as a cashier's for their own work - what
// makes them a manager is the role itself plus their `shops` allocation
// (checked directly via sess.role/sess.shops), not an extra perms flag.
const MANAGERPERMS = {chat:true,finance:true,analytics:true,history:true,planning:true};

const $ = id => document.getElementById(id);
const N = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt = v => Math.round(N(v)).toLocaleString('en-KE');

// Error handling utilities
const logError = (context, error, details = {}) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${context}:`, error);
  if (Object.keys(details).length > 0) {
    console.error('Details:', details);
  }
  // Store errors for potential debugging
  if (!window._errorLog) window._errorLog = [];
  window._errorLog.push({timestamp, context, error: error.message || error, details});
  // Keep only last 50 errors
  if (window._errorLog.length > 50) window._errorLog.shift();
};

const showError = (message, details = '') => {
  const fullMessage = details ? `${message}\n\n${details}` : message;
  alert('❌ Error\n\n' + fullMessage);
};

const showWarning = (message) => {
  console.warn('[WARNING]', message);
  // Could add UI notification here if desired
};

// View error log in console for debugging
const viewErrorLog = () => {
  if (!window._errorLog || window._errorLog.length === 0) {
    console.log('No errors logged.');
    return;
  }
  console.table(window._errorLog);
  console.log(`Total errors: ${window._errorLog.length}`);
};

// Export error log as text for support/debugging
const exportErrorLog = () => {
  if (!window._errorLog || window._errorLog.length === 0) {
    return 'No errors logged.';
  }
  let text = '=== SwiftStake Error Log ===\n\n';
  window._errorLog.forEach((log, i) => {
    text += `[${i + 1}] ${log.timestamp}\n`;
    text += `Context: ${log.context}\n`;
    text += `Error: ${log.error}\n`;
    if (Object.keys(log.details).length > 0) {
      text += `Details: ${JSON.stringify(log.details)}\n`;
    }
    text += '\n';
  });
  return text;
};

let S = {
  staff:[], shops:[], reports:[], shopData:{}, banks:[], debts:[], cashThresholds:{}, mpesaDeposits:[], bankWithdrawals:[], monthlyArchives:[], shopDebts:[], equipment:[], mpesaShopConfig:[],
  planTasks:{daily:[],weekly:[],monthly:[]}, projects:[], notifs:[], roadmap:[]
};

// Calls Claude through the ai-proxy Supabase Edge Function rather than
// api.anthropic.com directly. A browser can never safely hold an
// Anthropic API key, and api.anthropic.com blocks direct calls from web
// pages anyway (CORS) - the proxy holds the key server-side as a
// Supabase secret and forwards the request.
// Returns the response text, or throws with a readable message on failure.
async function askAI(prompt, opts) {
  opts = opts || {};
  const resp = await fetch(SUPABASE_URL + '/functions/v1/ai-proxy', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'apikey': SUPABASE_KEY},
    body: JSON.stringify({
      prompt: prompt,
      system: opts.system,
      max_tokens: opts.max_tokens || 800,
    })
  });
  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(data.error || ('AI request failed (' + resp.status + ')'));
  }
  return data.text || '';
}
let sess = {role:'cashier', name:'', shop:'', perms:{}, isAdmin:false};
// Per-user JWT from the login Edge Function, once that's configured.
// Null means "not using it yet" - every request safely falls back to
// the shared publishable key, exactly as the app has always worked.
let sessToken = null;
let activeShop = 'Kiawara';
let selRole_ = 'cashier';
let chartObjs = {};
let pendImgs = [];
let activeSummaryPeriod = 'daily';
let activeTurnoverPeriod = 'daily';
let savedSummaries = [];
let realtimeSub = null;
let realtimeDataSub = null;


// ── BUILD VERSION + DEVICE ID ──
// Shown small in the corner of the screen and stamped on every shop save, so
// we can tell which code a phone is really running and which device wrote
// which record. Bump APP_VERSION whenever a fix is pushed.
const APP_VERSION = '2026-10-16.2';
const DEVICE_ID = (function() {
  try {
    let id = localStorage.getItem('swiftstake_device_id');
    if (!id) { id = Math.random().toString(36).slice(2, 6).toUpperCase(); localStorage.setItem('swiftstake_device_id', id); }
    return id;
  } catch(e) { return 'NOID'; }
})();
(function() {
  function show() {
    if (document.getElementById('ver-tag')) return;
    const d = document.createElement('div');
    d.id = 'ver-tag';
    d.textContent = 'v' + APP_VERSION + ' · ' + DEVICE_ID;
    d.style.cssText = 'position:fixed;right:6px;bottom:3px;font-size:9px;opacity:.55;color:#9aa;z-index:99999;pointer-events:none;font-family:monospace;';
    document.body.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
