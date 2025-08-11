// service-worker.js
// ----------------------------------------------------
// Full pre-cache of app shell + cache-first runtime
// ----------------------------------------------------
const CACHE_VERSION = 'edf-precache-v16'; // ⬅️ bump this when you change any file below

// Everything the app needs to run fully offline.
// Keep this list in sync with your repo contents.
const PRECACHE_URLS = [
  // HTML
  './',
  './index.html',
  './Ranger.html',
  './Wingdiver.html',
  './AirRaider.html',
  './Fencer.html',

  // CSS
  './Main.css',
  './edf.css',

  // JS
  './Main.js',
  './edf-page.js',

  // PWA
  './manifest.webmanifest',

  // Fonts / Media
  './perfect-future.ttf',
  './EDF_Logo.gif',

  // Icons
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

// Utility: same-origin check
const isSameOrigin = (url) => (new URL(url, self.location.href)).origin === self.location.origin;

// Install: cache everything up front
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handling
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET requests
  if (req.method !== 'GET') return;

  // Handle navigations (address bar, link taps, Home Screen launches)
  if (req.mode === 'navigate' || (req.destination === '' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Same-origin static assets: cache-first
  if (isSameOrigin(req.url)) {
    const dest = req.destination; // 'style' | 'script' | 'font' | 'image' | ...
    if (['style', 'script', 'font', 'image'].includes(dest)) {
      event.respondWith(cacheFirst(req));
      return;
    }
  }

  // Default: try cache, then network
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req))
  );
});

async function handleNavigation(req) {
  const cache = await caches.open(CACHE_VERSION);

  // 1) Try cache first (offline instantly)
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;

  // 2) Not in cache? Try network and cache it for next time
  try {
    const res = await fetch(req);
    if (res.ok && isSameOrigin(req.url)) cache.put(req, res.clone());
    return res;
  } catch (_) {
    // 3) Offline fallback to the app shell (index.html)
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
    return new Response('<h1>Offline</h1><p>Please reconnect.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok && isSameOrigin(req.url)) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // If it wasn’t in cache and network failed, bubble the error
    throw err;
  }
}

// Optional: allow pages to trigger immediate SW activation after an update
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
