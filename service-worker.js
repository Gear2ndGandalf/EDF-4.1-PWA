// service-worker.js
// ----------------------------------------------------
// PWA cache with app-shell precache + runtime caching
// ----------------------------------------------------
const CACHE_VERSION = 'edf-cache-v4'; // bump to deploy updates

// List your actual files here (use index.html)
const APP_SHELL_REL = [
  './',                  // root
  './index.html',        // was Main.html
  './Ranger.html',
  './Wingdiver.html',
  './AirRaider.html',
  './Fencer.html',
  './edf.css',
  './Main.css',
  './Main.js',
  './edf-page.js',
  './manifest.webmanifest',
  './perfect-future.ttf',
  './EDF_Logo.gif',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Turn relative paths into absolute URLs under this SW's scope
const APP_SHELL = APP_SHELL_REL.map(p => new URL(p, self.location).toString());

const isSameOrigin = (url) => (new URL(url, self.location.href)).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategy:
// - Navigations: cache-first, network fallback; offline -> index.html
// - Same-origin static assets (css/js/font/img): cache-first
// - Default: cache, then network
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigations (address bar, link to .html, etc.)
  if (req.mode === 'navigate' ||
      (req.destination === '' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Same-origin static
  if (isSameOrigin(req.url)) {
    const dest = req.destination;
    if (['style', 'script', 'font', 'image'].includes(dest)) {
      event.respondWith(cacheFirst(req));
      return;
    }
  }

  // Default
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => cached || fetch(req))
  );
});

async function handleNavigation(req) {
  const cache = await caches.open(CACHE_VERSION);

  // Try cache first
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;

  // Then network, and cache it
  try {
    const res = await fetch(req);
    if (res.ok && isSameOrigin(req.url)) cache.put(req, res.clone());
    return res;
  } catch {
    // Offline fallback to index.html
    const fallback = await cache.match(new URL('./index.html', self.location).toString());
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

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
