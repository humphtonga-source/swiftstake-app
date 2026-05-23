const CACHE_NAME = 'swiftstake-v3';
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

// Install
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        if (e.request.mode === 'navigate')
          return caches.match('/swiftstake-app/index.html');
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', e => {
  if (!e.data) return;
  
  let data;
  try { data = e.data.json(); } 
  catch { data = { title: 'SwiftStake', body: e.data.text() }; }

  const options = {
    body: data.body || '',
    icon: '/swiftstake-app/icons/icon-192x192.png',
    badge: '/swiftstake-app/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/swiftstake-app/' },
    actions: data.actions || [],
    tag: data.tag || 'swiftstake',
    renotify: true
  };

  e.waitUntil(
    self.registration.showNotification(data.title || 'SwiftStake', options)
  );
});

// Click on notification → open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/swiftstake-app/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('swiftstake-app') && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
