/* Service worker for «Зелёный сад». Generated at build time from src/sw/sw-template.js. */
const VERSION = '17ff4b3df6d1';
const CACHE = 'green-garden-' + VERSION;
const PRECACHE = [
  "./",
  "./assets/index-BfOsvgBj.css",
  "./assets/index-CwiUgcjX.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./icons/maskable-512.png",
  "./manifest.webmanifest"
];
// Listik's recorded voice: one big file, kept in its own cache across game updates, so a new
// version of the game does not download it again. Only a new recording (new file name) replaces it.
const VOICE_CACHE = 'gg-voice';
const VOICE_PACKS = ["pack-6c637b595cb4.txt","pack-81b729d705f0.txt"];
// voice.json with its content hash: a new recording gets a new key, the old one is removed.
const VOICE_INDEX = "voice.json?v=30b466a7fcc0";

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
        if (!VOICE_PACKS.some((name) => req.url.endsWith('/' + name)) && !(VOICE_INDEX && req.url.endsWith('/' + VOICE_INDEX))) await voice.delete(req);
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

  if (url.pathname.endsWith('/voice/voice.json') && VOICE_INDEX) {
    const key = new URL('./voice/' + VOICE_INDEX, self.registration.scope).href;
    event.respondWith(
      caches.open(VOICE_CACHE).then(async (cache) => {
        const cached = await cache.match(key);
        if (cached) return cached;
        const res = await fetch(req.url, { cache: 'no-cache' });
        if (res.ok && res.type === 'basic' && !isHtml(res)) {
          try {
            await cache.put(key, res.clone());
          } catch {
            /* no room */
          }
        }
        return res;
      }),
    );
    return;
  }

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
