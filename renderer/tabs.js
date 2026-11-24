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

  const NEW_TAB_URL = 'about:blank';
  const MAX_CLOSED = 20;

  // What the address bar opens: a URL as typed, a host (with optional :port and path),
  // or a DuckDuckGo search. Local addresses (localhost, IPv4) use http, like browsers.
  const SEARCH = 'https://duckduckgo.com/?q=';
  function addressToUrl(input) {
    const s = String(input).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    const m = /^([\w-]+(?:\.[\w-]+)*)(:\d{1,5})?(\/\S*)?$/.exec(s);
    if (m) {
      const host = m[1];
      const local = host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
      if (local) return `http://${s}`;
      if (host.includes('.')) return `https://${s}`;
    }
    return SEARCH + encodeURIComponent(s);
  }

  // Next/previous tab, wrapping around at the ends.
  const cycleIndex = (length, index, delta) => (index + delta + length) % length;

  // Ctrl+1..8 -> that tab if it exists; Ctrl+9 -> the last tab.
  function indexForNumber(length, n) {
    if (!length) return null;
    if (n === 9) return length - 1;
    return n - 1 < length ? n - 1 : null;
  }

  function tabLabel(title, url) {
    if (title) return title;
    try { return new URL(url).hostname || 'New tab'; } catch { return 'New tab'; }
  }

  // onNewTab: called for the "+" button (the app opens a blank tab and focuses the
  // address bar, same as Ctrl+T).
  function createTabs({ strip, host, homeUrl, onNewTab }) {
    const tabs = [];
    const closed = []; // URLs of closed tabs, newest last (Ctrl+Shift+T)
    let activeId = null;
    let seq = 0;
    const listeners = [];

    const find = (id) => tabs.find((t) => t.id === id) || null;
    const active = () => find(activeId);
    const emit = () => { const t = active(); listeners.forEach((fn) => fn(t)); };

    const addBtn = document.createElement('button');
    addBtn.className = 'btab-add';
    addBtn.title = 'New tab (Ctrl+T)';
    addBtn.textContent = '＋';
    addBtn.addEventListener('click', () => (onNewTab ? onNewTab() : open(NEW_TAB_URL)));
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
      if (/^https?:\/\//i.test(tab.url)) {
        closed.push(tab.url);
        if (closed.length > MAX_CLOSED) closed.shift();
      }
      tabs.splice(tabs.indexOf(tab), 1);
      tab.el.remove();
      tab.webview.remove();
      if (next) activate(next);
      else { activeId = null; if (onNewTab) onNewTab(); else open(homeUrl); }
    }

    return {
      open,
      close,
      activate,
      active,
      list: () => tabs.slice(),
      reopen: () => (closed.length ? open(closed.pop()) : null),
      onChange: (fn) => { listeners.push(fn); },
    };
  }

  return { createTabs, nextActiveAfterClose, tabLabel, cycleIndex, indexForNumber, addressToUrl, NEW_TAB_URL };
});
