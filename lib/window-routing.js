// Where a page's request to open a window goes.
//  'tab'   - target=_blank / Ctrl+click links: a new tab in the workspace.
//  'popup' - window.open() with features (sign-in pop-ups need window.opener) and
//            about:blank (its opener writes into it): a protected pop-up window.
//  'deny'  - anything else (mailto:, whatsapp:, file:, ...) would leave the workspace.
const WEB_URL = /^https?:\/\//i;
const TAB_DISPOSITIONS = new Set(['foreground-tab', 'background-tab']);

function routeWindowOpen({ url, disposition, frameName = '', postBody }) {
  if (url === 'about:blank') return 'popup';
  if (!WEB_URL.test(url)) return 'deny';
  // A tab can't carry a POST body, and a named window is how sites (often sign-in
  // helpers) keep a handle to what they opened; both need a real window.
  if (postBody) return 'popup';
  if (frameName && frameName !== '_blank') return 'popup';
  return TAB_DISPOSITIONS.has(disposition) ? 'tab' : 'popup';
}

module.exports = { routeWindowOpen };
