// service-worker.js
// ----------------------------------------------------
// PWA cache with app-shell precache + runtime caching
// ----------------------------------------------------
const CACHE_VERSION = 'edf-cache-v4'; // ← bump when you deploy changes

const APP_SHELL = [
  './',                        // root
  './Main.html',
  './Ranger.html',
  './Wingdiver.html',
  './AirRaider.html',
  './Fencer.html',

  // CSS / JS
  './Main.css',               // ← was missing
  './edf.css',
  './Main.js',
  './edf-page.js',

  // PWA meta
  './manifest.webmanifest',
  './service-worker.js',

  // Fonts / media
  './perfect-future.ttf',
  './EDF_Logo.gif',

  // Icons
  './icons/icon-180.png',     // ← add if you linked it in <head>
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Utility
const isSameOrigin = (url) => (new URL(url, self.location.href)).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategy:
// - HTML navigations: cache-first; if offline and miss → Main.html
// - Static assets (css/js/font/image): cache-first; if miss, fetch+cache
// - Other requests: cache then network
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  // Navigations / HTML
  if (req.mode === 'navigate' || (req.destination === '' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Same-origin static assets
  if (isSameOrigin(req.url)) {
    const dest = req.destination; // 'style' | 'script' | 'font' | 'image' | ...
    if (['style', 'script', 'font', 'image'].includes(dest)) {
      event.respondWith(cacheFirst(req));
      return;
    }
  }

  // Default
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req))
  );
});

async function handleNavigation(req) {
  const cache = await caches.open(CACHE_VERSION);

  // 1) Cache first
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;

  // 2) Network, then cache
  try {
    const res = await fetch(req);
    if (res.ok && isSameOrigin(req.url)) cache.put(req, res.clone());
    return res;
  } catch {
    // 3) Offline fallback
    const fallback = await cache.match('./Main.html');
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

  const res = await fetch(req);
  if (res.ok && isSameOrigin(req.url)) cache.put(req, res.clone());
  return res;
}

// Optional: allow pages to ask the SW to activate immediately after update
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});