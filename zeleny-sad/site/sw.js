/* Service worker for «Зелёный сад». Generated at build time from src/sw/sw-template.js. */
const VERSION = 'e554d4539ca9';
const CACHE = 'green-garden-' + VERSION;
const PRECACHE = [
  "./",
  "./assets/index-Bt3BlhU_.js",
  "./assets/index-dQly2xD5.css",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./icons/maskable-512.png",
  "./manifest.webmanifest",
  "./voice/voice.json"
];
// Listik's recorded voice: one big file, kept in its own cache across game updates, so a new
// version of the game does not download it again. Only a new recording (new file name) replaces it.
const VOICE_CACHE = 'gg-voice';
const VOICE_PACKS = ["pack-6c637b595cb4.txt","pack-81b729d705f0.txt"];

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
      const voice = await caches.open(VOICE_CACHE);
      for (const req of await voice.keys()) {
        if (!VOICE_PACKS.some((name) => req.url.endsWith('/' + name))) await voice.delete(req);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

const isHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // The play journal goes straight to the network and is never cached.
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.includes('/voice/pack-')) {
    event.respondWith(
      caches.open(VOICE_CACHE).then(async (cache) => {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        const res = await fetch(req);
        // Never keep a page (the server's fallback) under a voice pack name, and a full disk
        // must not turn a good answer from the server into an error.
        if (res.ok && res.type === 'basic' && !isHtml(res)) {
          try {
            await cache.put(req, res.clone());
          } catch {
            /* no room: play from the network this time */
          }
        }
        return res;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    // The app is a single page: always answer navigations from the precached shell.
    event.respondWith(
      caches
        .open(CACHE)
        // The page is precached as «./» (the scope itself); «./index.html» is kept as a fallback name.
        .then((c) => c.match(self.registration.scope).then((r) => r || c.match(new URL('./index.html', self.registration.scope).href)))
        .then((cached) => cached || fetch(req)),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic' && (!isHtml(res) || url.pathname.endsWith('.html'))) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }),
  );
});
