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

  return { GROUP_COLORS, NAME_MAX, isColor, colorHex, nextColor, nextGroupName, cleanName, insertIndex };
});
