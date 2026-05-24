// ── Auto Quartett – Service Worker ────────────────────────────────────────────
// CACHE_NAME hochzählen (v2, v3 …) wenn Daten/Code sich ändern und alle
// Nutzer die neue Version bekommen sollen.
const CACHE_NAME = 'autoquartett-v2';

const PRECACHE = [
  '/AutoQuartett/',
  '/AutoQuartett/index.html',
  '/AutoQuartett/style.css',
  '/AutoQuartett/app.js',
  '/AutoQuartett/cars.json',
  '/AutoQuartett/manifest.json',
  '/AutoQuartett/favicon.ico',
  '/AutoQuartett/images/icon-180.png',
  '/AutoQuartett/images/icon-512.png',
];

// ── Install: Core-Dateien vorab cachen ───────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
    // Kein skipWaiting() – neue Version wartet auf Benutzer-Bestätigung
  );
});

// ── Activate: alten Cache löschen, Clients übernehmen ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First + dynamisches Cachen (Bilder etc.) ────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const netFetch = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || netFetch;
    })
  );
});

// ── Message: SKIP_WAITING auf Benutzer-Anfrage ────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
