// TaskFlow service worker — minimal & safe.
// Network-first for page navigations with an offline HTML fallback; everything
// else passes through. We intentionally do NOT cache JS/CSS/API responses to
// avoid serving stale builds or private data.
const CACHE = 'taskflow-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put('/__shell', fresh.clone());
      return fresh;
    } catch {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('/__shell');
      return cached || Response.error();
    }
  })());
});
