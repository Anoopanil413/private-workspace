// Saved tab groups: the 🗂 menu (open, delete, save the open tabs as a group) and the
// link between an open group and its saved copy. A linked group's changes (tabs, name,
// colour) are saved again 1 s after the last one; closing the group keeps the copy.
// Stored encrypted by the main process (groups.enc). Needs PWTabGroups.
// UMD: window.PWGroupsUI.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWGroupsUI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const SAVE_DELAY = 1000;

  function createSavedGroups({ button, pop, tabs, store, notify, makeId = () => crypto.randomUUID() }) {
    const G = self.PWTabGroups;
    let data = G.emptySaved();
    const timers = new Map(); // savedId -> timeout
    const pending = new Map(); // savedId -> latest { name, color, tabs } of its open group

    const find = (id) => data.groups.find((g) => g.id === id) || null;
    const openCopy = (savedId) => G.findOpenGroup(tabs.groups(), savedId);
    const webTabsOf = (groupId) => G.cleanTabs(tabs.groupTabs(groupId).map((t) => ({ url: t.url, title: t.title })));

    async function persist() {
      let result = null;
      try { result = await store.save(data); } catch (err) { result = { ok: false, error: err.message }; }
      if (!result || !result.ok) notify(`Could not save your tab groups: ${(result && result.error) || 'unknown error'}`);
      return result;
    }

    // Open groups linked to a saved group that no longer exists are unlinked.
    function unlinkMissing() {
      for (const g of tabs.groups()) if (g.savedId && !find(g.savedId)) tabs.updateGroup(g.id, { savedId: null });
    }

    const ready = Promise.resolve()
      .then(() => store.load())
      .then((d) => { data = G.validateSaved(d); })
      .catch(() => {})
      .then(unlinkMissing);

    function flushOne(savedId) {
      clearTimeout(timers.get(savedId));
      timers.delete(savedId);
      const live = pending.get(savedId);
      pending.delete(savedId);
      const saved = find(savedId);
      if (!live) return;
      if (!saved) { unlinkMissing(); return; }
      const updated = G.savedUpdateFor(saved, live, Date.now());
      if (!updated) return;
      data = { version: 1, groups: data.groups.map((g) => (g.id === savedId ? updated : g)) };
      persist();
    }

    tabs.onGroupChange((group, list) => {
      if (!group.savedId) return;
      const id = group.savedId;
      pending.set(id, { name: group.name, color: group.color, tabs: list });
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => ready.then(() => flushOne(id)), SAVE_DELAY));
    });
    // Closing right after a change: send it now (the main process waits for the write).
    window.addEventListener('beforeunload', () => { for (const id of [...timers.keys()]) flushOne(id); });

    async function saveGroup(groupId) {
      await ready;
      const g = tabs.groups().find((x) => x.id === groupId);
      if (!g || g.savedId) return;
      const list = webTabsOf(groupId);
      if (!list.length) { notify('Nothing to save yet: open a page in this group first.'); return; }
      if (data.groups.length >= G.MAX_SAVED) { notify(`You have ${G.MAX_SAVED} saved groups. Delete one from 🗂 first.`); return; }
      const saved = { id: makeId(), name: g.name, color: g.color, tabs: list, updated: Date.now() };
      data = { version: 1, groups: [saved, ...data.groups] };
      // Link first, so a change made while this is being written (a rename) follows it.
      tabs.updateGroup(groupId, { savedId: saved.id });
      const result = await persist();
      if (!result || !result.ok) {
        data = { version: 1, groups: data.groups.filter((x) => x.id !== saved.id) };
        unlinkMissing();
        return;
      }
      notify(`Saved "${g.name}". Reopen it any time from 🗂.`);
    }

    function stopSaving(groupId) {
      const g = tabs.groups().find((x) => x.id === groupId);
      if (!g || !g.savedId) return;
      flushOne(g.savedId); // keep its latest state
      tabs.updateGroup(groupId, { savedId: null });
      notify(`"${g.name}" is no longer saved automatically. Its saved copy stays in 🗂.`);
    }

    // Every ungrouped page becomes one new group, saved; then you can name it.
    async function saveOpenTabs() {
      const loose = tabs.list().filter((t) => !t.group && /^https?:\/\//i.test(t.url));
      if (!loose.length) { notify('Every open page is already in a group.'); return; }
      const g = tabs.createGroup(loose.map((t) => t.id));
      if (!g) return;
      const saving = saveGroup(g.id);
      tabs.startRename(g.id);
      await saving;
    }

    function openSaved(savedId) {
      const saved = find(savedId);
      if (!saved) return;
      const open = openCopy(savedId);
      if (open) { // already open: go to it
        tabs.activate(tabs.groupTabs(open.id)[0].id);
        return;
      }
      const opened = saved.tabs.map((t) => tabs.open(t.url, { background: true, lazy: true, title: t.title }));
      tabs.createGroup(opened.map((t) => t.id), { name: saved.name, color: saved.color, savedId });
      tabs.activate(opened[0].id);
    }

    async function deleteSaved(savedId) {
      const saved = find(savedId);
      if (!saved || !confirm(`Delete saved group "${saved.name}"? Its tabs stay open if they are.`)) return;
      clearTimeout(timers.get(savedId));
      timers.delete(savedId);
      pending.delete(savedId);
      data = { version: 1, groups: data.groups.filter((g) => g.id !== savedId) };
      await persist();
      const open = openCopy(savedId);
      if (open) tabs.updateGroup(open.id, { savedId: null });
    }

    // ---- the 🗂 pop-over ----
    function closePop() { pop.hidden = true; button.setAttribute('aria-expanded', 'false'); }

    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function render() {
      pop.replaceChildren(el('b', '', 'Saved tab groups'));
      if (!data.groups.length) {
        pop.append(el('span', 'ab-sub', 'None yet. Right-click a group\'s chip → Save group, or save the open tabs below.'));
      }
      for (const saved of data.groups) {
        const row = el('div', 'sg-row');
        const dot = el('span', 'sg-dot');
        dot.style.background = G.colorHex(saved.color);
        const open = openCopy(saved.id);
        const n = saved.tabs.length;
        const info = el('span', 'sg-info');
        info.append(el('span', 'sg-name', saved.name), el('small', '', `${n} tab${n === 1 ? '' : 's'}${open ? ' · open now' : ''}`));
        const openBtn = el('button', 'sg-open', open ? 'Show' : 'Open');
        openBtn.title = open ? 'Go to this group' : `Open its ${n} tab${n === 1 ? '' : 's'}`;
        openBtn.addEventListener('click', () => { closePop(); openSaved(saved.id); });
        const del = el('button', 'sg-del', '🗑');
        del.title = 'Delete this saved group';
        del.setAttribute('aria-label', `Delete saved group ${saved.name}`);
        del.addEventListener('click', async () => { await deleteSaved(saved.id); if (!pop.hidden) render(); });
        row.append(dot, info, openBtn, del);
        pop.append(row);
      }
      const loose = tabs.list().some((t) => !t.group && /^https?:\/\//i.test(t.url));
      const saveAll = el('button', 'sg-save-all', '＋ Save open tabs as a group');
      saveAll.disabled = !loose;
      saveAll.title = loose ? 'Puts every page that isn\'t in a group into a new saved group' : 'Every open page is already in a group';
      saveAll.addEventListener('click', () => { closePop(); saveOpenTabs(); });
      pop.append(saveAll);
    }

    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!pop.hidden) { closePop(); return; }
      await ready;
      render();
      pop.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', closePop);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });

    return { saveGroup, stopSaving, openSaved, saveOpenTabs, ready };
  }

  return { createSavedGroups };
});
