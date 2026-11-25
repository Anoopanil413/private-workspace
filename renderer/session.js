// The saved browser session (open tabs) and its rules, shared by the main process
// (validation before saving) and the page (building it from the tabs).
// Session = { version: 1, tabs: [{ url, title }], active: number }
// UMD: window.PWSession / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWSession = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_TABS = 50;
  const MAX_TITLE = 200;
  const isWeb = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);
  const emptySession = () => ({ version: 1, tabs: [], active: 0 });

  function validateSession(x) {
    if (!x || typeof x !== 'object' || x.version !== 1 || !Array.isArray(x.tabs)) return emptySession();
    const tabs = x.tabs
      .filter((t) => t && isWeb(t.url))
      .slice(0, MAX_TABS)
      .map((t) => ({ url: t.url, title: typeof t.title === 'string' ? t.title.slice(0, MAX_TITLE) : '' }));
    if (!tabs.length) return emptySession();
    const active = Number.isInteger(x.active) && x.active >= 0 && x.active < tabs.length ? x.active : 0;
    return { version: 1, tabs, active };
  }

  // From the tab strip: blank and non-web tabs are left out, and `active` still points
  // at the same page (or the nearest page before it, when the active tab is blank).
  function sessionFromTabs(tabs, activeIndex) {
    const kept = [];
    let active = 0;
    tabs.forEach((t, i) => {
      if (!isWeb(t.url)) return;
      if (i <= activeIndex) active = kept.length;
      kept.push({ url: t.url, title: t.title || '' });
    });
    return validateSession({ version: 1, tabs: kept, active });
  }

  return { validateSession, sessionFromTabs, emptySession, MAX_TABS };
});
