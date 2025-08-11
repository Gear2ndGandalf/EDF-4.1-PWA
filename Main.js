// Main.js — turn buttons green when their class is 100% complete

function refreshProgress() {
  const map = [
    { key: 'rangerSave',    href: 'Ranger.html'    },
    { key: 'wingdiverSave', href: 'Wingdiver.html' },
    { key: 'airraiderSave', href: 'AirRaider.html' },
    { key: 'fencerSave',    href: 'Fencer.html'    },
  ];

  map.forEach(({ key, href }) => {
    const total = parseInt(localStorage.getItem(key + '_total') || '0', 10);
    const count = parseInt(localStorage.getItem(key + '_count') || '0', 10);
    const link = document.querySelector(`.button-list a[href="${href}"]`);
    if (!link) return;
    if (total > 0 && count >= total) link.classList.add('complete');
    else link.classList.remove('complete');
  });
}

// Light debounce
let rafId = null;
function scheduleRefresh() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => { rafId = null; refreshProgress(); });
}

document.addEventListener('DOMContentLoaded', refreshProgress);
window.addEventListener('focus', scheduleRefresh);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleRefresh();
});

// Reflect changes from other tabs
window.addEventListener('storage', (e) => {
  if (!e.key) return;
  if (/_count$/.test(e.key) || /_total$/.test(e.key)) scheduleRefresh();
});

// Register the service worker (relative path keeps it repo-root scoped on GH Pages)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(reg => console.log('Service Worker registered', reg))
      .catch(err => console.error('Service Worker registration failed', err));
  });
}