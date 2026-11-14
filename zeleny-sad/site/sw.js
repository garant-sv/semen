/* Service worker for «Зелёный сад». Generated at build time from src/sw/sw-template.js. */
const VERSION = 'fdbf51a706ba';
const CACHE = 'green-garden-' + VERSION;
const PRECACHE = [
  "./",
  "./assets/index-DCP0F16V.css",
  "./assets/index-DoMjmVkm.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./icons/maskable-512.png",
  "./manifest.webmanifest"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('green-garden-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // The play journal goes straight to the network and is never cached.
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    // The app is a single page: always answer navigations from the precached shell.
    event.respondWith(
      caches
        .open(CACHE)
        .then((c) => c.match(new URL('./index.html', self.registration.scope).href))
        .then((cached) => cached || fetch(req)),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }),
  );
});
