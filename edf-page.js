// edf-page.js — shared builder for class pages
function createEDFPage({ title, categories, storageKey }) {
  const TOTAL_ALL = categories.reduce((s, c) => s + c.names.length, 0);
  localStorage.setItem(storageKey + '_total', String(TOTAL_ALL));

  const container = document.getElementById('categories-container');
  const saveBtn   = document.querySelector('.save-button');

  /* ---------- Smooth scroll helpers ---------- */
  const prefersNoMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  // Smooth-scroll a category header to the very top of the viewport.
  function scrollHeaderIntoView(headerEl, offset = 8) {
    if (!headerEl) return;
    if (prefersNoMotion) {
      const rect = headerEl.getBoundingClientRect();
      window.scrollTo(0, window.pageYOffset + rect.top - offset);
      return;
    }
    const rect = headerEl.getBoundingClientRect();
    const targetY = window.pageYOffset + rect.top - offset;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  // Smooth-scroll to a Y position and resolve when we're basically there
  function smoothScrollTo(topTarget) {
    if (prefersNoMotion) {
      window.scrollTo(0, topTarget);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const tolerance = 2; // px
      window.scrollTo({ top: topTarget, behavior: 'smooth' });
      function check() {
        if (Math.abs(window.scrollY - topTarget) <= tolerance) resolve();
        else requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    });
  }

  /* ---------- Save button state ---------- */
  function setSaveDisabled(disabled) {
    if (!saveBtn) return;
    saveBtn.classList.toggle('is-disabled', disabled);
    saveBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }
  function isSaveDisabled() { return !!saveBtn && saveBtn.classList.contains('is-disabled'); }

  // Signature of current checkbox state (stable across cats)
  let lastSavedSig = '';
  function computeSignature() {
    const parts = [];
    categories.forEach((cat, ci) => {
      const boxes = document.querySelectorAll(`.category:nth-child(${ci + 1}) input[type="checkbox"]`);
      let s = '';
      boxes.forEach(cb => { s += cb.checked ? '1' : '0'; });
      parts.push(s);
    });
    return parts.join('|');
  }
  function refreshDirty() {
    setSaveDisabled(computeSignature() === lastSavedSig);
  }

  /* ---------- Save (manual) ---------- */
  function saveList(showToast = true) {
    if (isSaveDisabled()) return;

    const data = {};
    categories.forEach((cat, ci) => {
      data[cat.id] = [];
      const boxes = document.querySelectorAll(`.category:nth-child(${ci + 1}) input[type="checkbox"]`);
      boxes.forEach((cb, i) => { if (cb.checked) data[cat.id].push(i); });
    });
    localStorage.setItem(storageKey, JSON.stringify(data));

    // persist saved (committed) count for Main page
    const savedChecked = document.querySelectorAll('#categories-container input[type="checkbox"]:checked').length;
    localStorage.setItem(storageKey + '_count', String(savedChecked));

    if (showToast) showSaveToast();

    lastSavedSig = computeSignature();
    setSaveDisabled(true);
  }
  window.saveList = saveList;

  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      if (isSaveDisabled()) { e.preventDefault(); e.stopPropagation(); return; }
      if (!saveBtn.getAttribute('onclick')) saveList();
    });
  }

  /* ---------- Build UI ---------- */
  categories.forEach(cat => {
    const wrap = document.createElement('div');
    wrap.className = 'category';

    const header = document.createElement('div');
    header.className = 'category-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'header-title';
    titleEl.textContent = cat.title;

    const countEl = document.createElement('span');
    countEl.className = 'header-count';
    countEl.textContent = `0/${cat.names.length}`;

    header.replaceChildren(titleEl, countEl);

    header.addEventListener('click', async () => {
      const body = wrap.querySelector('.category-items');
      const willOpen = body.style.display !== 'block';

      if (willOpen) {
        body.style.display = 'block';
        scrollHeaderIntoView(header);
      } else {
        // scroll first, then collapse to avoid jump
        await smoothScrollTo(0);
        body.style.display = 'none';
      }
    });

    const body = document.createElement('div');
    body.className = 'category-items';
    cat.names.forEach(name => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => {
        updateCount(cat.id, cat.names.length);
        updateGlobalCount();
        refreshSelectAllToggle();
        refreshDirty(); // enable/disable Save based on true diff
      });
      label.appendChild(cb);
      label.append(` ${name}`);
      body.appendChild(label);
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    container.appendChild(wrap);
  });

  /* ---------- Counters ---------- */
  function updateCount(id, total) {
    const idx = categories.findIndex(c => c.id === id);
    const catDiv = container.querySelector(`.category:nth-child(${idx + 1})`);
    const checked = catDiv.querySelectorAll('input[type="checkbox"]:checked').length;
    catDiv.querySelector('.header-count').textContent = `${checked}/${total}`;
  }
  window.updateCount = updateCount;

  function updateGlobalCount() {
    const el = document.getElementById('global-count');
    if (!el) return;
    const checked = document.querySelectorAll('#categories-container input[type="checkbox"]:checked').length;
    el.textContent = `${checked}/${TOTAL_ALL}`;
    el.classList.remove('low', 'medium', 'complete');
    if (checked >= TOTAL_ALL) el.classList.add('complete');
    else if (checked >= TOTAL_ALL / 2) el.classList.add('medium');
    else el.classList.add('low');
  }
  window.updateGlobalCount = updateGlobalCount;

  /* ---------- Toast ---------- */
  function showSaveToast() {
    const t = document.getElementById('toast');
    if (!t) return;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1500);
  }
  window.showSaveToast = showSaveToast;

  /* ---------- Select / Deselect All (next to counter) ---------- */
  injectSelectAllToggle();
  function injectSelectAllToggle() {
    const bar = document.querySelector('.title-counter');
    if (!bar) return;

    let tools = bar.querySelector('.bulk-tools');
    if (!tools) {
      tools = document.createElement('span');
      tools.className = 'bulk-tools';
      tools.innerHTML = `
        <label class="bulk-toggle">
          <input id="select-all-toggle" type="checkbox" />
          <span>Select all</span>
        </label>
      `;
      bar.appendChild(tools);
    }

    const toggle = tools.querySelector('#select-all-toggle');
    toggle.addEventListener('change', (e) => {
      setAllCheckboxes(e.target.checked);
      updateGlobalCount();
      categories.forEach(c => updateCount(c.id, c.names.length));
      refreshSelectAllToggle();
      refreshDirty();
    });
  }

  function setAllCheckboxes(state) {
    const boxes = document.querySelectorAll('#categories-container input[type="checkbox"]');
    boxes.forEach(cb => { cb.checked = state; });
  }

  function refreshSelectAllToggle() {
    const toggle = document.getElementById('select-all-toggle');
    if (!toggle) return;
    const boxes   = document.querySelectorAll('#categories-container input[type="checkbox"]');
    const checked = document.querySelectorAll('#categories-container input[type="checkbox"]:checked');
    toggle.checked = (boxes.length > 0 && checked.length === boxes.length);
    toggle.indeterminate = (checked.length > 0 && checked.length < boxes.length);
  }

  /* ---------- Load (establish saved baseline) ---------- */
  function loadList() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}

    categories.forEach((cat, ci) => {
      const saved = data[cat.id] || [];
      const boxes = document.querySelectorAll(`.category:nth-child(${ci + 1}) input[type="checkbox"]`);
      saved.forEach(i => { if (boxes[i]) boxes[i].checked = true; });
      updateCount(cat.id, cat.names.length);
    });

    updateGlobalCount();
    refreshSelectAllToggle();

    // keep Main in sync with authoritative totals & saved counts
    localStorage.setItem(storageKey + '_total', String(TOTAL_ALL));
    const savedChecked = document.querySelectorAll('#categories-container input[type="checkbox"]:checked').length;
    localStorage.setItem(storageKey + '_count', String(savedChecked));

    lastSavedSig = computeSignature();
    setSaveDisabled(true);
  }

  document.addEventListener('DOMContentLoaded', loadList);
}