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
  // address bar, same as Ctrl+T). onTabMenu(tab, x, y) / onGroupMenu(group, x, y):
  // right-click on a tab / on a group's chip.
  function createTabs({ strip, host, homeUrl, onNewTab, onTabMenu, onGroupMenu }) {
    const G = self.PWTabGroups;
    let tabs = [];
    let groups = []; // { id, name, color, collapsed, savedId, chip, nameEl, countEl }
    const closed = []; // URLs of closed tabs, newest last (Ctrl+Shift+T)
    let activeId = null;
    let seq = 0;
    let groupSeq = 0;
    const listeners = [];
    const listListeners = [];
    const groupListeners = [];
    const listChanged = () => listListeners.forEach((fn) => fn());

    const find = (id) => tabs.find((t) => t.id === id) || null;
    const findGroup = (id) => groups.find((g) => g.id === id) || null;
    const active = () => find(activeId);
    const emit = () => { const t = active(); listeners.forEach((fn) => fn(t)); };
    const isHidden = (t) => { const g = t.group && findGroup(t.group); return !!g && g.collapsed; };
    const visible = () => tabs.filter((t) => !isHidden(t));
    const publicGroup = (g) => ({ id: g.id, name: g.name, color: g.color, collapsed: g.collapsed, savedId: g.savedId });
    const tabsOf = (groupId) => tabs.filter((t) => t.group === groupId);
    const tellGroup = (g, list) => groupListeners.forEach((fn) => fn(publicGroup(g), list));
    // Something about a group changed (its tabs, their pages, its name …). While a
    // whole group is being closed it only reports once, when it's gone.
    let muted = null;
    function groupChanged(groupId) {
      if (groupId === muted) return;
      const g = findGroup(groupId);
      if (g) tellGroup(g, tabsOf(groupId).map((t) => ({ url: t.url, title: t.title })));
    }
    // A group that no longer exists reports no tabs.
    function dropGroup(g) {
      groups = groups.filter((x) => x !== g);
      tellGroup(g, []);
    }
    function removeGroupIfEmpty(groupId) {
      const g = findGroup(groupId);
      if (g && !tabsOf(groupId).length) dropGroup(g);
    }

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

    function paintGroup(g) {
      g.chip.style.setProperty('--g', G.colorHex(g.color));
      g.nameEl.textContent = g.name;
      g.countEl.textContent = g.collapsed ? `▸ ${tabsOf(g.id).length}` : '';
      g.chip.classList.toggle('collapsed', g.collapsed);
      g.chip.setAttribute('aria-expanded', String(!g.collapsed));
      g.chip.title = `${g.name}: click to ${g.collapsed ? 'expand' : 'collapse'}, right-click for options`;
    }

    // Puts the strip's elements in tab order, each group's chip before its first tab.
    // Only elements out of place are moved: moving a chip whose name is being edited
    // would take the focus away (and end the edit). A layout asked for while one is
    // running (from that focus change) runs right after it.
    let laying = false;
    let again = false;
    function layout() {
      if (laying) { again = true; return; }
      laying = true;
      try {
        do { again = false; placeAll(); } while (again);
      } finally {
        laying = false;
      }
    }
    function placeAll() {
      const els = [];
      let prev = null;
      for (const t of tabs) {
        const g = t.group && findGroup(t.group);
        if (g && t.group !== prev) els.push(g.chip);
        prev = t.group;
        t.el.classList.toggle('in-group', !!g);
        if (g) t.el.style.setProperty('--g', G.colorHex(g.color)); else t.el.style.removeProperty('--g');
        t.el.hidden = !!g && g.collapsed;
        els.push(t.el);
      }
      for (const g of groups) paintGroup(g);
      let at = strip.firstChild;
      for (const el of [...els, addBtn]) {
        if (el === at) { at = at.nextSibling; continue; }
        strip.insertBefore(el, at);
      }
      while (at) { const next = at.nextSibling; at.remove(); at = next; }
    }

    // lazy: the page only loads when the tab is first shown (restored tabs); until
    // then the tab shows `title`.
    function open(url, { background = false, lazy = false, title = '' } = {}) {
      const id = `t${++seq}`;
      const webview = document.createElement('webview');
      webview.setAttribute('partition', PARTITION);
      webview.setAttribute('allowpopups', '');
      if (!lazy) webview.setAttribute('src', url);

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

      const tab = { id, webview, el, labelEl, title: lazy ? title : '', url, pending: lazy ? url : null, group: null };
      tabs.push(tab);
      host.append(webview);
      paint(tab);
      layout();

      el.addEventListener('click', (e) => { if (e.target !== closeBtn) activate(id); });
      el.addEventListener('auxclick', (e) => { if (e.button === 1) close(id); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (onTabMenu) onTabMenu(tab, e.clientX, e.clientY); });
      closeBtn.addEventListener('click', () => close(id));

      const changed = () => { paint(tab); if (id === activeId) emit(); listChanged(); if (tab.group) groupChanged(tab.group); };
      webview.addEventListener('page-title-updated', (e) => { tab.title = e.title; changed(); });
      webview.addEventListener('did-navigate', (e) => { tab.url = e.url; tab.title = ''; changed(); });
      webview.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) { tab.url = e.url; changed(); } });

      // A lazy (restored) tab never activates by itself: that would load it.
      if (!background || (!activeId && !lazy)) activate(id);
      else listChanged();
      return tab;
    }

    function activate(id) {
      const tab = find(id);
      if (!tab) return;
      // Showing a tab of a collapsed group opens the group.
      const g = tab.group && findGroup(tab.group);
      if (g && g.collapsed) { g.collapsed = false; layout(); }
      if (tab.pending) { tab.webview.setAttribute('src', tab.pending); tab.pending = null; }
      activeId = id;
      for (const t of tabs) {
        const on = t.id === id;
        t.el.classList.toggle('active', on);
        t.el.setAttribute('aria-selected', String(on));
        t.webview.classList.toggle('active', on);
      }
      emit();
      listChanged();
    }

    // The visible tab to show instead of `id` (being closed or hidden), not one of `hiding`.
    function neighbourOf(id, hiding = []) {
      const ids = tabs.filter((t) => t.id === id || (!isHidden(t) && !hiding.includes(t))).map((t) => t.id);
      return nextActiveAfterClose(ids, id, id);
    }

    function close(id) {
      const tab = find(id);
      if (!tab) return;
      const next = id === activeId ? neighbourOf(id) : activeId;
      if (/^https?:\/\//i.test(tab.url)) {
        closed.push(tab.url);
        if (closed.length > MAX_CLOSED) closed.shift();
      }
      tabs = tabs.filter((t) => t !== tab);
      tab.el.remove();
      tab.webview.remove();
      if (tab.group) { groupChanged(tab.group); removeGroupIfEmpty(tab.group); }
      layout();
      if (next) activate(next);
      else if (tabs.length) activate(tabs[0].id); // only tabs of collapsed groups are left
      else { activeId = null; if (onNewTab) onNewTab(); else open(homeUrl); }
      listChanged();
    }

    // Moves `list` (keeping its order) to position `at` of the order without them.
    function moveTabs(list, at) {
      const rest = tabs.filter((t) => !list.includes(t));
      rest.splice(at, 0, ...list);
      tabs = rest;
    }

    // ---- groups ----
    function makeChip(g) {
      const chip = document.createElement('div');
      chip.className = 'bgroup';
      chip.setAttribute('role', 'button');
      chip.tabIndex = 0;
      const dot = document.createElement('span');
      dot.className = 'bgroup-dot';
      g.nameEl = document.createElement('span');
      g.nameEl.className = 'bgroup-name';
      g.countEl = document.createElement('span');
      g.countEl.className = 'bgroup-count';
      chip.append(dot, g.nameEl, g.countEl);
      chip.addEventListener('click', () => { if (!chip.querySelector('input')) updateGroup(g.id, { collapsed: !g.collapsed }); });
      chip.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === chip) { e.preventDefault(); chip.click(); } });
      chip.addEventListener('contextmenu', (e) => { e.preventDefault(); if (onGroupMenu) onGroupMenu(publicGroup(g), e.clientX, e.clientY); });
      g.chip = chip;
    }

    function createGroup(tabIds, { name, color, collapsed = false, savedId = null } = {}) {
      const list = tabs.filter((t) => tabIds.includes(t.id));
      if (!list.length) return null;
      const old = [...new Set(list.map((t) => t.group).filter(Boolean))];
      const g = {
        id: `g${++groupSeq}`,
        name: G.cleanName(name) || G.nextGroupName(groups.map((x) => x.name)),
        color: G.isColor(color) ? color : G.nextColor(groups.map((x) => x.color)),
        collapsed: false,
        savedId: savedId || null,
      };
      makeChip(g);
      groups.push(g);
      // The group goes where its first tab was; if that tab was in a group, right after
      // that group, so both groups' tabs stay together.
      const first = tabs.indexOf(list[0]);
      const rest = tabs.filter((t) => !list.includes(t));
      moveTabs(list, list[0].group
        ? G.insertIndex(rest, list[0].group)
        : first - tabs.slice(0, first).filter((t) => list.includes(t)).length);
      for (const t of list) t.group = g.id;
      for (const o of old) { groupChanged(o); removeGroupIfEmpty(o); }
      layout();
      if (collapsed) updateGroup(g.id, { collapsed: true });
      groupChanged(g.id);
      listChanged();
      return publicGroup(g);
    }

    function addToGroup(tabId, groupId) {
      const tab = find(tabId);
      if (!tab || !findGroup(groupId) || tab.group === groupId) return;
      const old = tab.group;
      moveTabs([tab], G.insertIndex(tabs.filter((t) => t !== tab), groupId));
      tab.group = groupId;
      // The shown tab never hides in a collapsed group.
      const g = findGroup(groupId);
      if (tabId === activeId && g.collapsed) g.collapsed = false;
      if (old) { groupChanged(old); removeGroupIfEmpty(old); }
      layout();
      groupChanged(groupId);
      listChanged();
    }

    function ungroupTab(tabId) {
      const tab = find(tabId);
      if (!tab || !tab.group) return;
      const old = tab.group;
      // Just after the group, so the group's tabs stay together.
      moveTabs([tab], G.insertIndex(tabs.filter((t) => t !== tab), old));
      tab.group = null;
      groupChanged(old);
      removeGroupIfEmpty(old);
      layout();
      listChanged();
    }

    function updateGroup(groupId, patch) {
      const g = findGroup(groupId);
      if (!g) return;
      if ('name' in patch) g.name = G.cleanName(patch.name) || g.name;
      if ('color' in patch && G.isColor(patch.color)) g.color = patch.color;
      if ('savedId' in patch) g.savedId = patch.savedId || null;
      if ('collapsed' in patch) {
        const collapse = !!patch.collapsed;
        const a = active();
        // Hiding the shown tab: show the nearest tab outside the group first.
        const next = collapse && a && a.group === groupId ? neighbourOf(a.id, tabsOf(groupId)) : undefined;
        g.collapsed = collapse;
        layout();
        if (next !== undefined) {
          if (next && find(next).group !== groupId) activate(next);
          else if (onNewTab) onNewTab(); else open(homeUrl);
        }
      }
      layout();
      groupChanged(groupId);
      listChanged();
    }

    function ungroup(groupId) {
      const g = findGroup(groupId);
      if (!g) return;
      for (const t of tabsOf(groupId)) t.group = null;
      dropGroup(g);
      layout();
      listChanged();
    }

    function closeGroup(groupId) {
      const list = tabsOf(groupId);
      const a = active();
      // Step off the group first, so closing its tabs doesn't load the others one by one.
      if (a && list.includes(a)) {
        const next = neighbourOf(a.id, list);
        if (next && next !== a.id) activate(next);
        else if (onNewTab) onNewTab(); else open(homeUrl);
      }
      muted = groupId;
      try { for (const t of list) close(t.id); } finally { muted = null; }
    }

    // Inline rename on the chip: Enter or leaving keeps it, Esc cancels.
    function startRename(groupId) {
      const g = findGroup(groupId);
      if (!g || g.chip.querySelector('input')) return;
      const input = document.createElement('input');
      input.className = 'bgroup-input';
      input.value = g.name;
      input.maxLength = G.NAME_MAX;
      input.setAttribute('aria-label', 'Group name');
      g.nameEl.replaceWith(input);
      let done = false;
      const finish = (keep) => {
        if (done) return;
        done = true;
        input.replaceWith(g.nameEl);
        if (keep) updateGroup(groupId, { name: input.value });
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation(); // typing a name is not a browser shortcut
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
      input.addEventListener('click', (e) => e.stopPropagation());
      input.focus();
      input.select();
    }

    // The tabs as { url, title, group } plus the active index and the open groups, for
    // saving the session.
    const snapshot = () => ({
      tabs: tabs.map((t) => ({ url: t.url, title: t.title, group: t.group })),
      activeIndex: tabs.indexOf(active()),
      groups: groups.map(publicGroup),
    });

    return {
      open,
      close,
      activate,
      active,
      snapshot,
      list: () => tabs.slice(),
      // Tabs not hidden in a collapsed group: what Ctrl+Tab and Ctrl+1…9 go through.
      visible,
      reopen: () => (closed.length ? open(closed.pop()) : null),
      onChange: (fn) => { listeners.push(fn); },
      // Any change worth saving: a tab opened, closed, switched, navigated or renamed.
      onListChange: (fn) => { listListeners.push(fn); },
      // For changes made from outside (a tab's url set before its page loads).
      touched: () => { const t = active(); if (t && t.group) groupChanged(t.group); listChanged(); },
      groups: () => groups.map(publicGroup),
      groupTabs: (groupId) => tabsOf(groupId),
      createGroup,
      addToGroup,
      ungroupTab,
      updateGroup,
      ungroup,
      closeGroup,
      startRename,
      // fn(group, tabs: [{ url, title }]) whenever a group or its tabs change; a group
      // that no longer exists reports no tabs.
      onGroupChange: (fn) => { groupListeners.push(fn); },
    };
  }

  return { createTabs, nextActiveAfterClose, tabLabel, cycleIndex, indexForNumber, addressToUrl, NEW_TAB_URL };
});
