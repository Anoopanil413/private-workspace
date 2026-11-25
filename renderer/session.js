// The saved browser session (open tabs and their groups) and its rules, shared by the
// main process (validation before saving) and the page (building it from the tabs).
// Session = { version: 2, tabs: [{ url, title, group }], groups: [{ name, color, collapsed, savedId }], active }
// `group` is an index into `groups` or null. Version 1 files (no groups) still load.
// UMD: window.PWSession / module.exports. Needs PWTabGroups (renderer/tab-groups.js).
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./tab-groups') : root.PWTabGroups);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWSession = api;
})(typeof self !== 'undefined' ? self : this, function (G) {
  const MAX_TABS = 50;
  const MAX_TITLE = 200;
  const MAX_ID = 64;
  const isWeb = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);
  const emptySession = () => ({ version: 2, tabs: [], groups: [], active: 0 });

  const cleanGroup = (g) => ({
    name: G.cleanName(g && g.name) || 'Group',
    color: G.isColor(g && g.color) ? g.color : 'blue',
    collapsed: (g && g.collapsed) === true,
    savedId: g && typeof g.savedId === 'string' && g.savedId && g.savedId.length <= MAX_ID ? g.savedId : null,
  });

  function validateSession(x) {
    if (!x || typeof x !== 'object' || !Array.isArray(x.tabs) || (x.version !== 1 && x.version !== 2)) return emptySession();
    const groupsIn = x.version === 2 && Array.isArray(x.groups) ? x.groups : [];
    const kept = x.tabs.filter((t) => t && isWeb(t.url)).slice(0, MAX_TABS);
    if (!kept.length) return emptySession();
    // Only groups a kept tab points at survive, renumbered in order of first use.
    const remap = new Map();
    const groups = [];
    const tabs = kept.map((t) => {
      let group = null;
      if (Number.isInteger(t.group) && t.group >= 0 && t.group < groupsIn.length) {
        if (!remap.has(t.group)) { remap.set(t.group, groups.length); groups.push(cleanGroup(groupsIn[t.group])); }
        group = remap.get(t.group);
      }
      return { url: t.url, title: typeof t.title === 'string' ? t.title.slice(0, MAX_TITLE) : '', group };
    });
    const active = Number.isInteger(x.active) && x.active >= 0 && x.active < tabs.length ? x.active : 0;
    return { version: 2, tabs, groups, active };
  }

  // From the tab strip: tabs carry their group's id; `groups` are the open groups
  // ({ id, name, color, collapsed, savedId }). Blank and non-web tabs are left out, and
  // `active` still points at the same page (or the nearest page before it).
  function sessionFromTabs(tabs, activeIndex, groups = []) {
    const index = new Map(groups.map((g, i) => [g.id, i]));
    const kept = [];
    let active = 0;
    tabs.forEach((t, i) => {
      if (!isWeb(t.url)) return;
      if (i <= activeIndex) active = kept.length;
      kept.push({ url: t.url, title: t.title || '', group: index.has(t.group) ? index.get(t.group) : null });
    });
    return validateSession({ version: 2, tabs: kept, groups, active });
  }

  return { validateSession, sessionFromTabs, emptySession, MAX_TABS };
});
