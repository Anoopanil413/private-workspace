// Where a page's request to open a window goes.
//  'tab'   - target=_blank / Ctrl+click links: a new tab in the workspace.
//  'popup' - window.open() with features (sign-in pop-ups need window.opener) and
//            about:blank (its opener writes into it): a protected pop-up window.
//  'deny'  - anything else (mailto:, whatsapp:, file:, ...) would leave the workspace.
const WEB_URL = /^https?:\/\//i;
const TAB_DISPOSITIONS = new Set(['foreground-tab', 'background-tab']);

function routeWindowOpen({ url, disposition }) {
  if (url === 'about:blank') return 'popup';
  if (!WEB_URL.test(url)) return 'deny';
  return TAB_DISPOSITIONS.has(disposition) ? 'tab' : 'popup';
}

module.exports = { routeWindowOpen };
