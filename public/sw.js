// Minimal app-shell caching with offline fallback and update flow
const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `doneglow-shell-${CACHE_VERSION}`;
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Icons are small and stable
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  // Allow new SW to take control when asked
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('doneglow-shell-') && key !== APP_SHELL_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Network-first for navigations with offline fallback to index.html
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isNavigation = req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        const cached = await cache.match('/index.html');
        return cached || Response.error();
      })
    );
    return;
  }

  // For other requests, try network, fall back to cache if present
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        return res;
      } catch (_) {
        const cache = await caches.open(APP_SHELL_CACHE);
        const cached = await cache.match(req);
        return cached || Promise.reject(_);
      }
    })()
  );
});

// Listen for client message to skip waiting (triggered on update confirmation)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
