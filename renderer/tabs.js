// Browser tabs: one <webview> per tab, all in the private partition, only the active
// one visible. UMD: window.PWTabs in the page; module.exports (pure helpers) for tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWTabs = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PARTITION = 'persist:private';

  // Which tab becomes active after closing one: the right neighbour, else the left.
  function nextActiveAfterClose(ids, closingId, activeId) {
    if (closingId !== activeId) return activeId;
    const i = ids.indexOf(closingId);
    return ids[i + 1] ?? ids[i - 1] ?? null;
  }

  function tabLabel(title, url) {
    if (title) return title;
    try { return new URL(url).hostname || 'New tab'; } catch { return 'New tab'; }
  }

  function createTabs({ strip, host, homeUrl }) {
    const tabs = [];
    let activeId = null;
    let seq = 0;
    const listeners = [];

    const find = (id) => tabs.find((t) => t.id === id) || null;
    const active = () => find(activeId);
    const emit = () => { const t = active(); listeners.forEach((fn) => fn(t)); };

    const addBtn = document.createElement('button');
    addBtn.className = 'btab-add';
    addBtn.title = 'New tab';
    addBtn.textContent = '＋';
    addBtn.addEventListener('click', () => open(homeUrl));
    strip.append(addBtn);

    function paint(tab) {
      tab.labelEl.textContent = tabLabel(tab.title, tab.url);
      tab.el.title = tab.labelEl.textContent;
    }

    function open(url, { background = false } = {}) {
      const id = `t${++seq}`;
      const webview = document.createElement('webview');
      webview.setAttribute('partition', PARTITION);
      webview.setAttribute('allowpopups', '');
      webview.setAttribute('src', url);

      const el = document.createElement('div');
      el.className = 'btab';
      el.setAttribute('role', 'tab');
      const labelEl = document.createElement('span');
      labelEl.className = 'btab-title';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btab-x';
      closeBtn.title = 'Close tab';
      closeBtn.textContent = '×';
      el.append(labelEl, closeBtn);

      const tab = { id, webview, el, labelEl, title: '', url };
      tabs.push(tab);
      strip.insertBefore(el, addBtn);
      host.append(webview);
      paint(tab);

      el.addEventListener('click', (e) => { if (e.target !== closeBtn) activate(id); });
      el.addEventListener('auxclick', (e) => { if (e.button === 1) close(id); });
      closeBtn.addEventListener('click', () => close(id));

      const changed = () => { paint(tab); if (id === activeId) emit(); };
      webview.addEventListener('page-title-updated', (e) => { tab.title = e.title; changed(); });
      webview.addEventListener('did-navigate', (e) => { tab.url = e.url; tab.title = ''; changed(); });
      webview.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) { tab.url = e.url; changed(); } });

      if (!background || !activeId) activate(id);
      return tab;
    }

    function activate(id) {
      if (!find(id)) return;
      activeId = id;
      for (const t of tabs) {
        const on = t.id === id;
        t.el.classList.toggle('active', on);
        t.el.setAttribute('aria-selected', String(on));
        t.webview.classList.toggle('active', on);
      }
      emit();
    }

    function close(id) {
      const tab = find(id);
      if (!tab) return;
      const next = nextActiveAfterClose(tabs.map((t) => t.id), id, activeId);
      tabs.splice(tabs.indexOf(tab), 1);
      tab.el.remove();
      tab.webview.remove();
      if (next) activate(next);
      else { activeId = null; open(homeUrl); }
    }

    return {
      open,
      close,
      activate,
      active,
      onChange: (fn) => { listeners.push(fn); },
    };
  }

  return { createTabs, nextActiveAfterClose, tabLabel };
});
