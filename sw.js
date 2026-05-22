const CACHE_NAME = 'swiftstake-v2';
const ASSETS = [
  '/swiftstake-app/',
  '/swiftstake-app/index.html',
  '/swiftstake-app/css/styles.css',
  '/swiftstake-app/js/config.js',
  '/swiftstake-app/js/db.js',
  '/swiftstake-app/js/auth.js',
  '/swiftstake-app/js/ui.js',
  '/swiftstake-app/js/dashboard.js',
  '/swiftstake-app/js/finance.js',
  '/swiftstake-app/js/analytics.js',
  '/swiftstake-app/js/planning.js',
  '/swiftstake-app/js/settings.js',
  '/swiftstake-app/js/audit.js',
  '/swiftstake-app/js/chat.js',
  '/swiftstake-app/js/realtime.js',
  '/swiftstake-app/js/history.js',
  '/swiftstake-app/icons/icon-192x192.png',
  '/swiftstake-app/icons/icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('/swiftstake-app/index.html');
        }
      });
    })
  );
});
