// Dark mode for websites, per site.
//   system - leave the page alone (default)
//   dark   - ask the site for its own dark theme (prefers-color-scheme: dark)
//   force  - also turn on Chromium's automatic dark mode, for sites without one
// Applied per tab by the main process through the DevTools protocol (cdpCommandsFor).
// DarkPrefs = { version: 1, default: Mode, sites: { [host]: Mode } }
const MODES = new Set(['system', 'dark', 'force']);
const MAX_SITES = 1000;
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

const emptyDarkPrefs = () => ({ version: 1, default: 'system', sites: {} });
const isHost = (h) => typeof h === 'string' && h.length <= 253 && HOST.test(h);

function validateDarkPrefs(x) {
  if (!x || typeof x !== 'object' || x.version !== 1) return emptyDarkPrefs();
  const sites = {};
  if (x.sites && typeof x.sites === 'object') {
    for (const [host, mode] of Object.entries(x.sites)) {
      if (Object.keys(sites).length >= MAX_SITES) break;
      if (isHost(host) && MODES.has(mode)) sites[host.toLowerCase()] = mode;
    }
  }
  return { version: 1, default: MODES.has(x.default) ? x.default : 'system', sites };
}

function hostOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
}

function darkModeFor(prefs, url) {
  const host = hostOf(url);
  if (!host) return 'system';
  return prefs.sites[host] || prefs.default;
}

const DARK_MEDIA = ['Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }];
function cdpCommandsFor(mode) {
  if (mode === 'force') return [DARK_MEDIA, ['Emulation.setAutoDarkModeOverride', { enabled: true }]];
  if (mode === 'dark') return [DARK_MEDIA, ['Emulation.setAutoDarkModeOverride', {}]];
  return [['Emulation.setEmulatedMedia', { features: [] }], ['Emulation.setAutoDarkModeOverride', {}]];
}

// A site set to the default needs no entry of its own.
function setSiteMode(prefs, host, mode) {
  if (!isHost(host) || !MODES.has(mode)) return prefs;
  const sites = { ...prefs.sites };
  if (mode === prefs.default) delete sites[host.toLowerCase()];
  else sites[host.toLowerCase()] = mode;
  return { ...prefs, sites };
}

function setDefaultMode(prefs, mode) {
  if (!MODES.has(mode)) return prefs;
  const sites = Object.fromEntries(Object.entries(prefs.sites).filter(([, m]) => m !== mode));
  return { ...prefs, default: mode, sites };
}

module.exports = {
  validateDarkPrefs, darkModeFor, cdpCommandsFor, setSiteMode, setDefaultMode, emptyDarkPrefs, hostOf,
};
