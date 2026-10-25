// Whiskytix Offline-First Door Scanner Service Worker
const CACHE_NAME = 'whiskytix-scanner-pwa-v1';
const CORE_SHELL_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_SHELL_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Offline fallback for /api/scanner/manifest when venue WiFi drops
  if (url.pathname.startsWith('/api/scanner/manifest')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ success: false, offline: true, tickets: [] }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // Do not intercept other API routes
  if (url.pathname.startsWith('/api/')) return;

  // 2. Cache static assets (/assets/*, fonts, icons) with network-first + cache fallback
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || Response.error();
        })
    );
    return;
  }

  // 3. SPA navigation routes (/scan, /admin/festival/*/scan, etc.) -> network first, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return res;
        })
        .catch(async () => {
          const cachedIndex = (await caches.match('/index.html')) || (await caches.match('/'));
          return cachedIndex || Response.error();
        })
    );
  }
});
