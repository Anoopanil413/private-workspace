// Tab group rules shared by the tab bar, the session and the saved groups.
// UMD: window.PWTabGroups / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWTabGroups = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const GROUP_COLORS = [
    { name: 'blue', hex: '#60a5fa' }, { name: 'pink', hex: '#f472b6' }, { name: 'yellow', hex: '#fbbf24' },
    { name: 'green', hex: '#34d399' }, { name: 'purple', hex: '#a78bfa' }, { name: 'red', hex: '#f87171' },
    { name: 'cyan', hex: '#22d3ee' }, { name: 'grey', hex: '#9ca3af' },
  ];
  const NAME_MAX = 40;

  const isColor = (name) => GROUP_COLORS.some((c) => c.name === name);
  const colorHex = (name) => (GROUP_COLORS.find((c) => c.name === name) || GROUP_COLORS[0]).hex;

  // The first colour no open group uses; blue again once all 8 are taken.
  function nextColor(usedNames) {
    const free = GROUP_COLORS.find((c) => !usedNames.includes(c.name));
    return (free || GROUP_COLORS[0]).name;
  }

  function nextGroupName(usedNames) {
    for (let n = 1; ; n++) if (!usedNames.includes(`Group ${n}`)) return `Group ${n}`;
  }

  function cleanName(s) {
    const t = typeof s === 'string' ? s.trim().slice(0, NAME_MAX).trim() : '';
    return t || null;
  }

  // Where a tab joining a group goes in the tab order: after the group's last tab
  // (a group's tabs always sit together). order: [{ id, group }], without that tab.
  function insertIndex(order, groupId) {
    let last = -1;
    order.forEach((t, i) => { if (t.group === groupId) last = i; });
    return last === -1 ? order.length : last + 1;
  }

  // ---- saved groups (groups.enc): { version: 1, groups: [Saved] }
  // Saved = { id, name, color, tabs: [{ url, title }], updated }
  const MAX_SAVED = 50;
  const MAX_TABS = 50;
  const MAX_TITLE = 200;
  const MAX_ID = 64;
  const isWeb = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);
  const emptySaved = () => ({ version: 1, groups: [] });

  const cleanTabs = (list) => (Array.isArray(list) ? list : [])
    .filter((t) => t && isWeb(t.url))
    .slice(0, MAX_TABS)
    .map((t) => ({ url: t.url, title: typeof t.title === 'string' ? t.title.slice(0, MAX_TITLE) : '' }));

  function validateSaved(x) {
    if (!x || typeof x !== 'object' || x.version !== 1 || !Array.isArray(x.groups)) return emptySaved();
    const groups = [];
    for (const g of x.groups) {
      if (groups.length >= MAX_SAVED) break;
      if (!g || typeof g.id !== 'string' || !g.id || g.id.length > MAX_ID) continue;
      const tabs = cleanTabs(g.tabs);
      if (!tabs.length) continue;
      groups.push({
        id: g.id,
        name: cleanName(g.name) || 'Group',
        color: isColor(g.color) ? g.color : 'blue',
        tabs,
        updated: Number.isFinite(g.updated) ? g.updated : 0,
      });
    }
    return { version: 1, groups };
  }

  // The saved copy after its open group changed (live = { name, color, tabs }), or null
  // when there's nothing to write: no change, or no pages left (never save it empty).
  function savedUpdateFor(saved, live, now) {
    const tabs = cleanTabs(live.tabs);
    if (!tabs.length) return null;
    const name = cleanName(live.name) || saved.name;
    const color = isColor(live.color) ? live.color : saved.color;
    const same = name === saved.name && color === saved.color && tabs.length === saved.tabs.length
      && tabs.every((t, i) => t.url === saved.tabs[i].url && t.title === saved.tabs[i].title);
    return same ? null : { ...saved, name, color, tabs, updated: now };
  }

  const findOpenGroup = (groups, savedId) => (savedId && groups.find((g) => g.savedId === savedId)) || null;

  return {
    GROUP_COLORS, NAME_MAX, isColor, colorHex, nextColor, nextGroupName, cleanName, insertIndex,
    MAX_SAVED, validateSaved, emptySaved, savedUpdateFor, findOpenGroup, cleanTabs,
  };
});
