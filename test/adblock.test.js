const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FiltersEngine } = require('@ghostery/adblocker');
const { shouldBlock, createAdblock } = require('../lib/adblock');

const engine = () => FiltersEngine.parse('||ads.example.com^');
const PAGE = 'https://news.test/article';

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-adblock-'));
  return { cacheFile: path.join(dir, 'adblock-engine.bin'), allowFile: path.join(dir, 'adblock-allow.json') };
}

// Stand-in for an Electron session: records the onBeforeRequest listener.
function fakeSession() {
  const ses = { listener: null };
  ses.webRequest = { onBeforeRequest: (fn) => { ses.listener = fn; } };
  ses.request = (details) => new Promise((resolve) => ses.listener(details, resolve));
  return ses;
}

const adRequest = (webContentsId = 7) => ({
  url: 'https://ads.example.com/x.js', resourceType: 'script', webContentsId,
  webContents: { getURL: () => PAGE },
});

test('blocks a script from ads.example.com on https://news.test/', () => {
  assert.equal(shouldBlock(engine(), { url: 'https://ads.example.com/x.js', resourceType: 'script', pageUrl: PAGE }, new Set()), true);
});

test('does not block when news.test is allowed', () => {
  assert.equal(shouldBlock(engine(), { url: 'https://ads.example.com/x.js', resourceType: 'script', pageUrl: PAGE }, new Set(['news.test'])), false);
});

test('never blocks a mainFrame request', () => {
  assert.equal(shouldBlock(engine(), { url: 'https://ads.example.com/', resourceType: 'mainFrame', pageUrl: '' }, new Set()), false);
});

test('does not block first-party https://news.test/app.js', () => {
  assert.equal(shouldBlock(engine(), { url: 'https://news.test/app.js', resourceType: 'script', pageUrl: PAGE }, new Set()), false);
});

test('start resolves false when fetch rejects and there is no cache, and installs no blocker', async () => {
  const ses = fakeSession();
  const ab = createAdblock({ ...tempPaths(), fetch: () => Promise.reject(new Error('offline')) });
  assert.equal(await ab.start(ses, () => {}), false);
  assert.equal(ses.listener, null);
});

test('start loads from a fresh cacheFile without calling fetch, then blocks and reports the page', async () => {
  const paths = tempPaths();
  fs.writeFileSync(paths.cacheFile, engine().serialize());
  let fetched = 0;
  const ses = fakeSession();
  const blocked = [];
  const ab = createAdblock({ ...paths, fetch: () => { fetched++; return Promise.reject(new Error('no')); } });
  assert.equal(await ab.start(ses, (id) => blocked.push(id)), true);
  assert.equal(fetched, 0);
  assert.deepEqual(await ses.request(adRequest(7)), { cancel: true });
  assert.deepEqual(blocked, [7]);
  assert.deepEqual(await ses.request({ ...adRequest(), url: 'https://news.test/app.js' }), { cancel: false });
});

test('a stale cache is still used while a refresh is attempted in the background', async () => {
  const paths = tempPaths();
  fs.writeFileSync(paths.cacheFile, engine().serialize());
  const eightDaysLater = () => Date.now() + 8 * 24 * 3600 * 1000;
  let fetched = 0;
  const ab = createAdblock({ ...paths, now: eightDaysLater, fetch: () => { fetched++; return Promise.reject(new Error('offline')); } });
  assert.equal(await ab.start(fakeSession(), () => {}), true);
  await new Promise((r) => setImmediate(r));
  assert.ok(fetched > 0);
});

test('setAllowed persists to allowFile and a new instance reads it back', async () => {
  const paths = tempPaths();
  fs.writeFileSync(paths.cacheFile, engine().serialize());
  const ab = createAdblock({ ...paths, fetch: () => Promise.reject(new Error('no')) });
  await ab.start(fakeSession(), () => {});
  await ab.setAllowed('news.test', true);
  assert.equal(ab.isAllowed('news.test'), true);

  const ses = fakeSession();
  const again = createAdblock({ ...paths, fetch: () => Promise.reject(new Error('no')) });
  await again.start(ses, () => {});
  assert.equal(again.isAllowed('news.test'), true);
  assert.deepEqual(await ses.request(adRequest()), { cancel: false });

  await again.setAllowed('news.test', false);
  assert.deepEqual(await ses.request(adRequest()), { cancel: true });
});
