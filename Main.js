// Main.js — index page logic
// - Turns class buttons green when 100% complete
// - Exports / imports all progress (localStorage)

// ------- Constants -------
const STORAGE_MAP = Object.freeze([
  { key: 'rangerSave',    href: 'Ranger.html'    },
  { key: 'wingdiverSave', href: 'Wingdiver.html' },
  { key: 'airraiderSave', href: 'AirRaider.html' },
  { key: 'fencerSave',    href: 'Fencer.html'    },
]);

// ------- Helpers -------
const $ = (sel, root = document) => root.querySelector(sel);
const getInt = (k, d = 0) => parseInt(localStorage.getItem(k) ?? String(d), 10);
const safeParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

// ------- Progress UI (green buttons) -------
function refreshProgress() {
  STORAGE_MAP.forEach(({ key, href }) => {
    const total = getInt(`${key}_total`, 0);
    const count = getInt(`${key}_count`, 0);
    const link  = $(`.button-list a[href="${href}"]`);
    if (!link) return;
    if (total > 0 && count >= total) link.classList.add('complete');
    else link.classList.remove('complete');
  });
}

// Small rAF debounce so multiple triggers coalesce into one paint.
let rafId = null;
function scheduleRefresh() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => { rafId = null; refreshProgress(); });
}

// ------- Export / Import (global) -------
function buildExportPayload() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), data: {} };
  STORAGE_MAP.forEach(({ key }) => {
    payload.data[key]           = safeParse(localStorage.getItem(key)) || {};
    payload.data[`${key}_count`] = localStorage.getItem(`${key}_count`) ?? '0';
    payload.data[`${key}_total`] = localStorage.getItem(`${key}_total`) ?? '0';
  });
  return payload;
}

function exportAllProgress() {
  const payload = JSON.stringify(buildExportPayload(), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const file = new File([blob], 'edf-progress.json', { type: 'application/json' });

  // Prefer the Web Share API with files (works well on iOS, including Opera GX)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      files: [file],
      title: 'EDF 4.1 Progress Backup',
      text: 'Your EDF 4.1 progress backup file.',
    }).catch(() => {
      // If the user cancels share, do nothing
    });
    return;
  }

  // Fallback: programmatic download (works on desktop + most non-iOS browsers)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'edf-progress.json';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  try { URL.revokeObjectURL(url); } catch {}
}

function importAllProgressFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || obj.version !== 1 || typeof obj.data !== 'object') {
        throw new Error('Invalid backup file format.');
      }
      STORAGE_MAP.forEach(({ key }) => {
        if (obj.data[key] != null)           localStorage.setItem(key, JSON.stringify(obj.data[key]));
        if (obj.data[`${key}_count`] != null) localStorage.setItem(`${key}_count`, String(obj.data[`${key}_count`]));
        if (obj.data[`${key}_total`] != null) localStorage.setItem(`${key}_total`, String(obj.data[`${key}_total`]));
      });
      refreshProgress();
      alert('Progress imported! If a class page is open, refresh it to see changes.');
    } catch (e) {
      alert('Import failed: ' + (e?.message || e));
    }
  };
  reader.readAsText(file);
}

// ------- Init -------
document.addEventListener('DOMContentLoaded', () => {
  refreshProgress();

  const exportBtn = $('#export-btn');
  const importBtn = $('#import-btn');
  const fileInput = $('#import-file');

  if (exportBtn) exportBtn.addEventListener('click', exportAllProgress);

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importAllProgressFromFile(file);
      e.target.value = ''; // allow re-selecting the same file later
    });
  }
});

// ------- Cross-tab & visibility updates -------
window.addEventListener('focus', scheduleRefresh);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleRefresh();
});
window.addEventListener('storage', (e) => {
  if (!e.key) return;
  if (/_count$/.test(e.key) || /_total$/.test(e.key)) scheduleRefresh();
});

// Note: Service Worker registration lives in index.html on purpose to avoid double registration.