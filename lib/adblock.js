// Ad and tracker blocking for the private session: network requests only (no page
// element hiding), through our own onBeforeRequest so a per-site allowlist works.
// Lists: Ghostery's prebuilt ads + tracking engine, cached on disk for 7 days.
const fs = require('fs');
const { FiltersEngine, Request } = require('@ghostery/adblocker');

const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

// Electron webRequest resourceType -> WebExtension request type the engine expects.
const TYPES = {
  mainFrame: 'main_frame', subFrame: 'sub_frame', stylesheet: 'stylesheet', script: 'script',
  image: 'image', font: 'font', object: 'object', xhr: 'xmlhttprequest', ping: 'ping',
  cspReport: 'csp_report', media: 'media', webSocket: 'websocket', other: 'other',
};

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function shouldBlock(engine, { url, resourceType, pageUrl }, allowHosts) {
  if (resourceType === 'mainFrame') return false;
  if (allowHosts.has(hostOf(pageUrl))) return false;
  const request = Request.fromRawDetails({ url, type: TYPES[resourceType] || 'other', sourceUrl: pageUrl || url });
  return engine.match(request).match;
}

function createAdblock({ cacheFile, allowFile, fetch: fetchImpl, now = Date.now }) {
  let engine = null;
  let allowHosts = new Set();

  async function readAllowlist() {
    try {
      const list = JSON.parse(await fs.promises.readFile(allowFile, 'utf8'));
      if (Array.isArray(list)) allowHosts = new Set(list.filter((h) => typeof h === 'string'));
    } catch { /* none saved yet */ }
  }

  async function readCache() {
    try {
      const [bytes, stat] = await Promise.all([fs.promises.readFile(cacheFile), fs.promises.stat(cacheFile)]);
      return { engine: FiltersEngine.deserialize(new Uint8Array(bytes)), stale: now() - stat.mtimeMs > MAX_AGE_MS };
    } catch {
      return null;
    }
  }

  async function download() {
    const fresh = await FiltersEngine.fromPrebuiltAdsAndTracking(fetchImpl);
    // Write then rename, so a crash never leaves a half-written cache behind.
    const tmp = `${cacheFile}.tmp`;
    await fs.promises.writeFile(tmp, fresh.serialize());
    await fs.promises.rename(tmp, cacheFile);
    return fresh;
  }

  async function start(session, onBlocked) {
    await readAllowlist();
    const cached = await readCache();
    if (cached) {
      engine = cached.engine;
      if (cached.stale) download().then((e) => { engine = e; }, () => { /* keep the old lists */ });
    } else {
      try { engine = await download(); } catch { return false; }
    }

    session.webRequest.onBeforeRequest((details, callback) => {
      let cancel = false;
      try {
        const pageUrl = details.webContents && !details.webContents.isDestroyed?.()
          ? details.webContents.getURL() : (details.referrer || '');
        cancel = shouldBlock(engine, { url: details.url, resourceType: details.resourceType, pageUrl }, allowHosts);
      } catch { cancel = false; }
      if (cancel && details.webContentsId != null) onBlocked(details.webContentsId);
      callback({ cancel });
    });
    return true;
  }

  async function setAllowed(host, allowed) {
    if (typeof host !== 'string' || !host) return;
    if (allowed) allowHosts.add(host); else allowHosts.delete(host);
    await fs.promises.writeFile(allowFile, JSON.stringify([...allowHosts]));
  }

  return { start, setAllowed, isAllowed: (host) => allowHosts.has(host), isRunning: () => engine !== null };
}

module.exports = { shouldBlock, createAdblock, hostOf };
