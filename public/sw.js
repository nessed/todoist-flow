// Basic service worker to enable PWA installation

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    // Optionally, pre-cache assets here
    // event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
    self.skipWaiting(); // Activate worker immediately
  });
  
  self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    // Optionally, clean up old caches here
    event.waitUntil(self.clients.claim()); // Take control of pages immediately
  });
  
  self.addEventListener('fetch', (event) => {
    // Basic fetch handler (network first, then potentially cache)
    // For a minimal installable PWA, you might not even need a fetch listener,
    // but it's good practice to include one.
    // console.log('Service Worker: Fetching', event.request.url);
    event.respondWith(fetch(event.request)); // Just pass through requests
  });