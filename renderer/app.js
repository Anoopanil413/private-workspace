// Host page script (was inline in index.html). Talks to the main process only through
// window.workspace (preload.js).
(function () {
  // ---- tabs ----
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    const p = t.dataset.panel;
    document.querySelectorAll('.panel').forEach(x => x.classList.toggle('active', x.id === 'panel-' + p));
    // The notes editor lives beside the page or on the Notes screen (renderer/side-notes.js).
    if (sideNotes) sideNotes.sync();
  }));
  let sideNotes = null;

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
  // Stacked, so one message never hides another; warnings stay until dismissed.
  const notices = PWNotices.createNotices(document.getElementById('notice'));
  const showNotice = (text, opts) => notices.show(text, opts);
  window.workspace.onNotice(showNotice);

  // ---- blur when another app has focus (renderer/blur.js) ----
  PWBlur.createBlurGuard({
    body: document.body,
    button: document.getElementById('blur-toggle'),
    onWindowFocus: window.workspace.onWindowFocus,
  });

  // ---- browser (tabs) ----
  const HOME = 'https://duckduckgo.com';
  const url = document.getElementById('url');
  const tabs = PWTabs.createTabs({
    strip: document.getElementById('browser-tabs'),
    host: document.getElementById('webviews'),
    homeUrl: HOME,
    onNewTab: () => newTab(),
    onTabMenu: (tab, x, y) => showTabMenu(tab, x, y),
    onGroupMenu: (group, x, y) => showGroupMenu(group, x, y),
  });
  const isBlank = (u) => !u || u === PWTabs.NEW_TAB_URL;
  const toUrl = PWTabs.addressToUrl;
  // Opens in the active tab (or a new one when there is none).
  const navigate = (s) => {
    const u = toUrl(s);
    if (!u) return;
    const tab = tabs.active();
    if (tab) {
      tab.webview.src = u;
      // Record where the tab is going straight away, so closing the app before the
      // page starts loading still saves it in the session.
      tab.url = u;
      tabs.touched();
    } else {
      tabs.open(u);
    }
  };
  // Webview methods throw until the page has attached; ignore clicks that early.
  const onActive = (fn) => () => { const t = tabs.active(); if (t) { try { fn(t.webview); } catch {} } };
  // After going somewhere, typing goes to the page (as in Chrome).
  const navigateAndFocus = (s) => { navigate(s); const t = tabs.active(); if (t && toUrl(s)) t.webview.focus(); };
  document.getElementById('go').addEventListener('click', () => navigateAndFocus(url.value));
  url.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigateAndFocus(url.value);
    if (e.key === 'Escape') { // undo what was typed
      const t = tabs.active();
      url.value = t && !isBlank(t.url) ? t.url : '';
      url.select();
    }
  });
  url.addEventListener('focus', () => url.select());
  document.getElementById('back').addEventListener('click', onActive(w => w.canGoBack() && w.goBack()));
  document.getElementById('fwd').addEventListener('click', onActive(w => w.canGoForward() && w.goForward()));
  document.getElementById('reload').addEventListener('click', onActive(w => w.reload()));
  const bookmarks = PWBookmarks.createBookmarksBar({
    bar: document.getElementById('bookmarks'),
    star: document.getElementById('star'),
    getCurrent: () => { const t = tabs.active(); return t ? { title: t.title, url: t.url } : null; },
    onOpen: navigate,
  });
  const darkButton = PWDarkUI.createDarkButton({
    button: document.getElementById('dark-btn'),
    pop: document.getElementById('dark-pop'),
    dark: window.workspace.dark,
    getActive: () => tabs.active(),
  });
  const shieldBadge = PWAdblockUI.createAdblockBadge({
    badge: document.getElementById('ab-badge'),
    countEl: document.getElementById('ab-count'),
    pop: document.getElementById('ab-pop'),
    adblock: window.workspace.adblock,
    getActive: () => tabs.active(),
  });
  tabs.onChange(t => {
    if (document.activeElement !== url) url.value = t && !isBlank(t.url) ? t.url : '';
    bookmarks.refresh();
    shieldBadge.refresh();
    darkButton.refresh();
    if (t !== findTab) closeFind();
    paintZoom();
  });

  // ---- keyboard shortcuts (renderer/shortcuts.js) ----
  const browserPanel = document.getElementById('panel-browser');
  const browserShown = () => browserPanel.classList.contains('active');

  // Ctrl+T / "+": a blank tab, with the cursor in the address bar ready to type.
  function newTab() {
    if (!browserShown()) document.querySelector('.tab[data-panel="browser"]').click();
    tabs.open(PWTabs.NEW_TAB_URL);
    url.value = '';
    focusUrl();
  }

  // Focus the address bar. When the key came from inside a page, that page still holds
  // focus for this turn, so focus again right after.
  function focusUrl() {
    url.focus();
    url.select();
    setTimeout(() => { url.focus(); url.select(); }, 0);
  }

  // After closing a tab, typing goes to the page now shown (as in Chrome).
  function focusPage() {
    const t = tabs.active();
    if (!t) return;
    url.value = isBlank(t.url) ? '' : t.url;
    if (isBlank(t.url)) focusUrl(); else t.webview.focus();
  }

  // Tabs hidden in a collapsed group are skipped.
  function switchBy(delta) {
    const list = tabs.visible();
    const i = list.indexOf(tabs.active());
    if (list.length > 1) tabs.activate(list[PWTabs.cycleIndex(list.length, i, delta)].id);
  }

  function switchTo(n) {
    const list = tabs.visible();
    const i = PWTabs.indexForNumber(list.length, n);
    if (i !== null) tabs.activate(list[i].id);
  }

  // Returns true when the action was handled (so the key press is consumed).
  function runAction(action) {
    if (action === 'new-tab') { newTab(); return true; }
    if (action === 'toggle-notes') { toggleSideNotes(); return true; }
    // Everything else only while the browser is shown; Notes keeps its own keys.
    if (!browserShown()) return false;
    const t = tabs.active();
    const w = t && t.webview;
    const safely = (fn) => { try { fn(); } catch { /* page not attached yet */ } };
    switch (action) {
      case 'close-tab': if (t) { tabs.close(t.id); focusPage(); } break;
      case 'reopen-tab': tabs.reopen(); break;
      case 'next-tab': switchBy(1); break;
      case 'prev-tab': switchBy(-1); break;
      case 'last-tab': switchTo(9); break;
      case 'focus-url': focusUrl(); break;
      case 'reload': safely(() => w.reload()); break;
      case 'hard-reload': safely(() => w.reloadIgnoringCache()); break;
      case 'back': safely(() => w.canGoBack() && w.goBack()); break;
      case 'forward': safely(() => w.canGoForward() && w.goForward()); break;
      case 'find': openFind(); break;
      case 'find-next': findStep(true); break;
      case 'find-prev': findStep(false); break;
      case 'zoom-in': safely(() => w.setZoomFactor(PWShortcuts.nextZoom(w.getZoomFactor(), 1))); paintZoom(); break;
      case 'zoom-out': safely(() => w.setZoomFactor(PWShortcuts.nextZoom(w.getZoomFactor(), -1))); paintZoom(); break;
      case 'zoom-reset': safely(() => w.setZoomFactor(1)); paintZoom(); break;
      case 'bookmark': document.getElementById('star').click(); break;
      default:
        if (/^tab-[1-8]$/.test(action)) { switchTo(Number(action.slice(4))); break; }
        return false;
    }
    return true;
  }

  // Keys pressed in the host page (address bar, tab strip, ...).
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return; // the notes editor already used this key (Ctrl+B …)
    const action = PWShortcuts.matchShortcut(PWShortcuts.fromKeyboardEvent(e));
    if (action && runAction(action)) e.preventDefault();
  });
  // Keys pressed inside a web page, forwarded by the main process; mouse back/forward.
  window.workspace.onShortcut(({ action }) => runAction(action));

  // ---- zoom indicator ----
  const zoomBadge = document.getElementById('zoom-badge');
  function paintZoom() {
    const t = tabs.active();
    let factor = 1;
    try { factor = t ? t.webview.getZoomFactor() : 1; } catch {}
    zoomBadge.hidden = Math.abs(factor - 1) < 0.001;
    zoomBadge.textContent = `${Math.round(factor * 100)}%`;
  }
  zoomBadge.addEventListener('click', () => runAction('zoom-reset'));

  // ---- find in page ----
  const findbar = document.getElementById('findbar');
  const findInput = document.getElementById('find-input');
  const findCount = document.getElementById('find-count');
  let findTab = null;
  const hooked = new WeakSet();

  function openFind() {
    const t = tabs.active();
    if (!t) return;
    findTab = t;
    if (!hooked.has(t.webview)) {
      hooked.add(t.webview);
      t.webview.addEventListener('found-in-page', (e) => {
        if (findTab && e.target === findTab.webview) findCount.textContent = `${e.result.activeMatchOrdinal || 0}/${e.result.matches || 0}`;
      });
    }
    findbar.hidden = false;
    findInput.focus();
    findInput.select();
  }

  function findStep(forward) {
    if (findbar.hidden) { openFind(); if (!findInput.value) return; }
    const text = findInput.value;
    if (!text || !findTab) return;
    try { findTab.webview.findInPage(text, { forward, findNext: false }); } catch {}
  }

  function closeFind() {
    if (findbar.hidden) return;
    findbar.hidden = true;
    findCount.textContent = '';
    try { findTab && findTab.webview.stopFindInPage('clearSelection'); } catch {}
    findTab = null;
  }

  findInput.addEventListener('input', () => {
    const text = findInput.value;
    if (!findTab) return;
    try {
      if (text) findTab.webview.findInPage(text, { findNext: true });
      else { findTab.webview.stopFindInPage('clearSelection'); findCount.textContent = ''; }
    } catch {}
  });
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); findStep(!e.shiftKey); }
    if (e.key === 'Escape') { e.preventDefault(); const t = findTab; closeFind(); if (t) t.webview.focus(); }
  });
  document.getElementById('find-next').addEventListener('click', () => findStep(true));
  document.getElementById('find-prev').addEventListener('click', () => findStep(false));
  document.getElementById('find-close').addEventListener('click', closeFind);
  // target=_blank / Ctrl+click links from pages arrive here (see lib/window-routing.js).
  window.workspace.onOpenTab(({ url: u, background }) => {
    if (/^https?:\/\//i.test(u)) tabs.open(u, { background });
  });
  // ---- restore last time's tabs; keep the saved list up to date (renderer/session.js) ----
  let restoring = true;
  let sessionTimer = null;
  function saveSessionNow() {
    clearTimeout(sessionTimer);
    sessionTimer = null;
    const { tabs: list, activeIndex, groups } = tabs.snapshot();
    window.workspace.session.save(PWSession.sessionFromTabs(list, activeIndex, groups));
  }
  tabs.onListChange(() => {
    if (restoring) return;
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(saveSessionNow, 1000);
  });
  // Closing right after a change: send it now (the main process waits for the write).
  window.addEventListener('beforeunload', () => { if (sessionTimer) saveSessionNow(); });

  (async () => {
    let saved = PWSession.emptySession();
    try { saved = PWSession.validateSession(await window.workspace.session.load()); } catch {}
    if (saved.tabs.length) {
      // Only the active tab loads now; the others load when first clicked.
      const opened = saved.tabs.map((t) => tabs.open(t.url, { background: true, lazy: true, title: t.title }));
      saved.groups.forEach((g, i) => {
        const ids = opened.filter((_, k) => saved.tabs[k].group === i).map((t) => t.id);
        tabs.createGroup(ids, g);
      });
      tabs.activate(opened[saved.active].id);
      const n = saved.tabs.length;
      showNotice(`Restored ${n} tab${n === 1 ? '' : 's'} from last time.`);
    } else {
      tabs.open(HOME);
    }
    restoring = false;
  })();

  // ---- notes (encrypted on disk by the main process) ----
  const notesUI = PWNotesUI.createNotesUI({
    root: document.getElementById('panel-notes'),
    store: window.workspace.notes,
    onNotice: showNotice,
  });

  // ---- notes beside the page (renderer/side-notes.js) ----
  const byId = (id) => document.getElementById(id);
  sideNotes = PWSideNotes.createSideNotes({
    area: byId('browser-area'),
    panel: byId('side-notes'),
    divider: byId('side-divider'),
    body: byId('side-body'),
    pickBtn: byId('side-pick'),
    titleEl: byId('side-title'),
    newBtn: byId('side-new'),
    closeBtn: byId('side-close'),
    button: byId('side-notes-btn'),
    shield: byId('drag-shield'),
    notesUI,
    isBrowserShown: () => browserShown(),
  });
  // ---- right-click on selected page text: copy, or add it to a note (renderer/clip.js) ----
  const ctxMenu = PWContextMenu.createMenu(byId('ctx-menu'));
  tabs.onChange(() => ctxMenu.hide());
  const noteBeside = () => (sideNotes.isOpen() && browserShown() ? notesUI.activeNote() : null);
  // The page's selection, in full: Chromium shortens the menu's copy of long selections.
  // Falls back to that copy (text selected inside a frame isn't the page's selection).
  async function selectedText(tab, fromMenu) {
    let full = '';
    try { full = String(await tab.webview.executeJavaScript('String(getSelection())')); } catch {}
    return full.trim() && full.length >= fromMenu.length ? full : fromMenu;
  }
  async function onMenuPick(item, tab, params) {
    if (item.action === 'copy') { try { tab.webview.copy(); } catch {} return; }
    if (item.action !== 'add') return;
    const html = PWClip.clipHtml({ text: await selectedText(tab, params.selectionText), title: tab.title, url: tab.url });
    if (!html) return;
    const note = await notesUI.append(item.noteId, html);
    const shown = noteBeside();
    showNotice(`Added to "${note.title}".`, shown && shown.id === note.id ? {} : {
      action: { label: 'Show', onClick: () => showNoteBeside(note.id) },
    });
  }
  function showNoteBeside(id) {
    notesUI.open(id);
    if (!sideNotes.isOpen()) sideNotes.toggle();
    if (!browserShown()) document.querySelector('.tab[data-panel="browser"]').click();
  }
  // <webview> events don't bubble: listen while they travel down (capture).
  byId('webviews').addEventListener('context-menu', (e) => {
    const tab = tabs.list().find((t) => t.webview === e.target);
    const params = e.params;
    if (!tab || !params) return;
    const items = PWContextMenu.selectionMenu({ selectionText: params.selectionText, sideNote: noteBeside(), recent: notesUI.recent(6) });
    if (!items.length) return;
    // x, y are already in the window's coordinates (measured), not the page's.
    ctxMenu.show(items, params.x, params.y, (item) => onMenuPick(item, tab, params));
  }, true);

  // ---- tab groups (renderer/tab-groups.js): right-click a tab or a group's chip ----
  const G = PWTabGroups;
  const capital = (s) => s[0].toUpperCase() + s.slice(1);
  function showTabMenu(tab, x, y) {
    const others = tabs.groups().filter((g) => g.id !== tab.group);
    const items = [{ label: 'Add to new group', action: 'new-group' }];
    if (others.length) {
      items.push({ label: 'Add to group', items: others.map((g) => ({ label: g.name, action: 'to-group', groupId: g.id, color: G.colorHex(g.color) })) });
    }
    if (tab.group) items.push({ label: 'Remove from group', action: 'ungroup-tab' });
    items.push({ separator: true }, { label: 'Close tab', action: 'close-tab' });
    ctxMenu.show(items, x, y, (item) => {
      if (item.action === 'new-group') { const g = tabs.createGroup([tab.id]); if (g) tabs.startRename(g.id); }
      if (item.action === 'to-group') tabs.addToGroup(tab.id, item.groupId);
      if (item.action === 'ungroup-tab') tabs.ungroupTab(tab.id);
      if (item.action === 'close-tab') tabs.close(tab.id);
    });
  }
  function showGroupMenu(group, x, y) {
    const items = [
      { label: 'Rename…', action: 'rename' },
      { label: 'Colour', items: G.GROUP_COLORS.map((c) => ({ label: capital(c.name) + (c.name === group.color ? ' ✓' : ''), action: 'color', value: c.name, color: c.hex })) },
      { label: group.collapsed ? 'Expand' : 'Collapse', action: 'toggle' },
      { separator: true },
      { label: 'Ungroup', action: 'ungroup' },
      { label: 'Close group', action: 'close-group' },
    ];
    ctxMenu.show(items, x, y, (item) => {
      if (item.action === 'rename') tabs.startRename(group.id);
      if (item.action === 'color') tabs.updateGroup(group.id, { color: item.value });
      if (item.action === 'toggle') tabs.updateGroup(group.id, { collapsed: !group.collapsed });
      if (item.action === 'ungroup') tabs.ungroup(group.id);
      if (item.action === 'close-group') tabs.closeGroup(group.id);
    });
  }

  // Ctrl+Shift+N: from the Notes screen it goes to the browser with the note beside it.
  function toggleSideNotes() {
    if (!browserShown()) {
      if (!sideNotes.isOpen()) sideNotes.toggle();
      document.querySelector('.tab[data-panel="browser"]').click();
      notesUI.focus();
      return;
    }
    sideNotes.toggle();
  }

  // ---- updates (lib/updater.js): a downloaded version installs on quit, or now ----
  window.workspace.onUpdateReady(({ version }) => {
    showNotice(`Version ${version} is ready. It installs when you close the app.`, {
      sticky: true,
      action: {
        label: 'Restart now',
        onClick: async () => {
          // Save the last note edit and the open tabs before the installer closes the app.
          await notesUI.flush();
          saveSessionNow();
          const started = await window.workspace.installUpdate();
          if (!started) showNotice('Could not start the update. It will install when you close the app.');
        },
      },
    });
  });
})();
