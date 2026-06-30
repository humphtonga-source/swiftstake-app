// ── CONFIG & SHARED STATE ──
const SUPABASE_URL = 'https://inlafchehdzjiesetvvr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA4igGd_AjqTR2NW5GJhsQ_mzC1aaAu';

let SHOPS = ['Kiawara','Nyeri','Gachatha'];
let GAMES = ['stellar','pilot','spin'];
const COLORS = ['#3b82f6','#f59e0b','#22c55e','#a855f7','#ef4444'];
const DEFPERMS  = {chat:true,finance:true,analytics:true,history:true,planning:true};
const ADMINPERMS = {chat:true,finance:true,analytics:true,history:true,planning:true,banking:true,roadmap:true,settings:true,turnover:true,aisummary:true};

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
  staff:[], shops:[], reports:[], shopData:{}, banks:[], debts:[], cashThresholds:{},
  planTasks:{daily:[],weekly:[],monthly:[]}, projects:[], notifs:[], roadmap:[]
};
let sess = {role:'cashier', name:'', shop:'', perms:{}, isAdmin:false};
let activeShop = 'Kiawara';
let selRole_ = 'cashier';
let chartObjs = {};
let pendImgs = [];
let activeSummaryPeriod = 'daily';
let activeTurnoverPeriod = 'daily';
let savedSummaries = [];
let realtimeSub = null;
let realtimeDataSub = null;
