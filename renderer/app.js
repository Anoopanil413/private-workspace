// Host page script (was inline in index.html). Talks to the main process only through
// window.workspace (preload.js).
(function () {
  // ---- tabs ----
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    const p = t.dataset.panel;
    document.querySelectorAll('.panel').forEach(x => x.classList.toggle('active', x.id === 'panel-' + p));
  }));

  // ---- protection toggle ----
  const shield = document.getElementById('shield');
  const shieldText = document.getElementById('shield-text');
  const toggleBtn = document.getElementById('toggle');
  const banner = document.getElementById('banner');
  function paint(on) {
    shield.className = 'shield ' + (on ? 'on' : 'off');
    shieldText.textContent = on ? 'Hidden from screen capture' : 'Visible to screen capture';
    toggleBtn.textContent = on ? 'Turn off' : 'Turn on';
    banner.classList.toggle('show', !on);
  }
  toggleBtn.addEventListener('click', async () => paint(await window.workspace.toggleProtection()));
  window.workspace.getProtection().then(paint);

  // ---- notices from the main process (blocked links, downloads) ----
  const notice = document.getElementById('notice');
  let noticeTimer;
  function showNotice(msg) {
    notice.textContent = msg;
    notice.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove('show'), 8000);
  }
  window.workspace.onNotice(showNotice);

  // ---- browser (tabs) ----
  const HOME = 'https://duckduckgo.com';
  const url = document.getElementById('url');
  const tabs = PWTabs.createTabs({
    strip: document.getElementById('browser-tabs'),
    host: document.getElementById('webviews'),
    homeUrl: HOME,
  });
  const toUrl = (s) => {
    s = s.trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s)) return 'https://' + s;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(s);
  };
  // Opens in the active tab (or a new one when there is none).
  const navigate = (s) => {
    const u = toUrl(s);
    if (!u) return;
    const tab = tabs.active();
    if (tab) tab.webview.src = u; else tabs.open(u);
  };
  // Webview methods throw until the page has attached; ignore clicks that early.
  const onActive = (fn) => () => { const t = tabs.active(); if (t) { try { fn(t.webview); } catch {} } };
  document.getElementById('go').addEventListener('click', () => navigate(url.value));
  url.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(url.value); });
  document.getElementById('back').addEventListener('click', onActive(w => w.canGoBack() && w.goBack()));
  document.getElementById('fwd').addEventListener('click', onActive(w => w.canGoForward() && w.goForward()));
  document.getElementById('reload').addEventListener('click', onActive(w => w.reload()));
  tabs.onChange(t => { if (document.activeElement !== url) url.value = t ? t.url : ''; });
  document.querySelectorAll('.shortcuts a').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.url); }));
  // target=_blank / Ctrl+click links from pages arrive here (see lib/window-routing.js).
  window.workspace.onOpenTab(({ url: u, background }) => {
    if (/^https?:\/\//i.test(u)) tabs.open(u, { background });
  });
  tabs.open(HOME);

  // ---- notes (encrypted on disk by the main process) ----
  PWNotesUI.createNotesUI({
    root: document.getElementById('panel-notes'),
    store: window.workspace.notes,
    onNotice: showNotice,
  });
})();
