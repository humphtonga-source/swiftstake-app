const CACHE_NAME = 'swiftstake-v1';
const ASSETS = [
  '/swiftstak-app/',
  '/swiftstak-app/index.html',
  '/swiftstak-app/css/styles.css',
  '/swiftstak-app/js/config.js',
  '/swiftstak-app/js/db.js',
  '/swiftstak-app/js/auth.js',
  '/swiftstak-app/js/ui.js',
  '/swiftstak-app/js/dashboard.js',
  '/swiftstak-app/js/finance.js',
  '/swiftstak-app/js/analytics.js',
  '/swiftstak-app/js/planning.js',
  '/swiftstak-app/js/settings.js',
  '/swiftstak-app/js/audit.js',
  '/swiftstak-app/js/chat.js',
  '/swiftstak-app/js/realtime.js',
  '/swiftstak-app/js/history.js',
  '/swiftstak-app/icons/icon-192x192.png',
  '/swiftstak-app/icons/icon-512x512.png'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache new requests dynamically
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('/swiftstak-app/index.html');
        }
      });
    })
  );
});
