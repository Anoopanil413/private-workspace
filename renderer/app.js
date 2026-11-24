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

  // ---- browser ----
  const wv = document.getElementById('wv');
  const url = document.getElementById('url');
  const toUrl = (s) => {
    s = s.trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s)) return 'https://' + s;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(s);
  };
  const navigate = (s) => { const u = toUrl(s); if (u) wv.src = u; };
  document.getElementById('go').addEventListener('click', () => navigate(url.value));
  url.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(url.value); });
  document.getElementById('back').addEventListener('click', () => wv.canGoBack() && wv.goBack());
  document.getElementById('fwd').addEventListener('click', () => wv.canGoForward() && wv.goForward());
  document.getElementById('reload').addEventListener('click', () => wv.reload());
  wv.addEventListener('did-navigate', e => { url.value = e.url; });
  wv.addEventListener('did-navigate-in-page', e => { url.value = e.url; });
  document.querySelectorAll('.shortcuts a').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); wv.src = a.dataset.url; }));

  // ---- notes (encrypted on disk by the main process) ----
  PWNotesUI.createNotesUI({
    root: document.getElementById('panel-notes'),
    store: window.workspace.notes,
    onNotice: showNotice,
  });
})();
