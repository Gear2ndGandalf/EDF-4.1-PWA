// Main.js — turn buttons green when complete + Export/Import all progress

const STORAGE_MAP = [
  { key: 'rangerSave',    href: 'Ranger.html'    },
  { key: 'wingdiverSave', href: 'Wingdiver.html' },
  { key: 'airraiderSave', href: 'AirRaider.html' },
  { key: 'fencerSave',    href: 'Fencer.html'    },
];

function refreshProgress() {
  STORAGE_MAP.forEach(({ key, href }) => {
    const total = parseInt(localStorage.getItem(key + '_total') || '0', 10);
    const count = parseInt(localStorage.getItem(key + '_count') || '0', 10);
    const link = document.querySelector(`.button-list a[href="${href}"]`);
    if (!link) return;
    if (total > 0 && count >= total) link.classList.add('complete');
    else link.classList.remove('complete');
  });
}

// ------- Export / Import (global) -------
function buildExportPayload() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {}
  };
  STORAGE_MAP.forEach(({ key }) => {
    // Saves (checkbox indices per category)
    payload.data[key] = safeParse(localStorage.getItem(key)) || {};
    // Counters for Main buttons
    payload.data[key + '_count'] = localStorage.getItem(key + '_count') || '0';
    payload.data[key + '_total'] = localStorage.getItem(key + '_total') || '0';
  });
  return payload;
}

function exportAllProgress() {
  const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'edf-progress.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
        if (obj.data[key])   localStorage.setItem(key, JSON.stringify(obj.data[key]));
        if (obj.data[key+'_count'] != null) localStorage.setItem(key + '_count', String(obj.data[key+'_count']));
        if (obj.data[key+'_total'] != null) localStorage.setItem(key + '_total', String(obj.data[key+'_total']));
      });
      // Refresh the index buttons immediately
      refreshProgress();
      alert('Progress imported! If any class pages are open, refresh them to reflect changes.');
    } catch (e) {
      alert('Import failed: ' + (e?.message || e));
    }
  };
  reader.readAsText(file);
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// ------- Events / lifecycle -------
let rafId = null;
function scheduleRefresh() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => { rafId = null; refreshProgress(); });
}

document.addEventListener('DOMContentLoaded', () => {
  refreshProgress();

  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const fileInput = document.getElementById('import-file');

  if (exportBtn) exportBtn.addEventListener('click', exportAllProgress);
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importAllProgressFromFile(file);
      e.target.value = ''; // allow selecting the same file again later
    });
  }
});

// When you return to the window / tab, or another tab updates localStorage
window.addEventListener('focus', scheduleRefresh);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleRefresh();
});
window.addEventListener('storage', (e) => {
  if (!e.key) return;
  if (/_count$/.test(e.key) || /_total$/.test(e.key)) scheduleRefresh();
});

// (Your SW registration can remain in the HTML, or you can move it here)
