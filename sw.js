/* Olla Gitana — service worker de los juegos.
   Estrategia: red primero para HTML/JS/CSS (para no servir versiones viejas),
   caché primero para imágenes/audio (pesan mucho y cambian poco). */
const CACHE = 'olla-juegos-v2';
const IMG_RE = /\.(png|jpe?g|webp|gif|mp3|m4a|ogg|woff2?)$/i;

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // fuera del sitio: no tocar (ranking, etc.)

  // API del ranking: nunca cachear
  if (url.pathname.includes('/api/')) return;

  if (IMG_RE.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const c = await caches.open(CACHE);
          c.put(req, res.clone());
        }
        return res;
      } catch (err) {
        return hit || Response.error();
      }
    })());
    return;
  }

  // HTML / JS / CSS: red primero, respaldo en caché si no hay red
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});

// Precarga al instalar: el módulo de logros y el menú, para que funcionen sin conexión
self.addEventListener('message', e => {
  if (e.data === 'precache-logros') {
    caches.open(CACHE).then(c => c.addAll(['logros.js', 'manifest.webmanifest']).catch(() => {}));
  }
});
