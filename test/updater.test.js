const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater } = require('../lib/updater');

// Stand-in for electron-updater's autoUpdater.
function fakeAutoUpdater({ failChecks = false } = {}) {
  const au = new EventEmitter();
  au.checks = 0;
  au.installs = [];
  au.feed = null;
  au.checkForUpdates = async () => { au.checks++; if (failChecks) throw new Error('net::ERR_INTERNET_DISCONNECTED'); return null; };
  au.quitAndInstall = (silent, runAfter) => au.installs.push([silent, runAfter]);
  au.setFeedURL = (feed) => { au.feed = feed; };
  return au;
}

function fakeTimers() {
  const timers = [];
  return { timers, setInterval: (fn, ms) => { timers.push({ fn, ms }); return { unref() {} }; } };
}

const flush = () => new Promise((r) => setImmediate(r));

test('start does nothing in development (not packaged)', async () => {
  const au = fakeAutoUpdater();
  const t = fakeTimers();
  const started = createUpdater({ autoUpdater: au, isPackaged: false, onReady() {}, setInterval: t.setInterval }).start();
  await flush();
  assert.equal(started, false);
  assert.equal(au.checks, 0);
  assert.equal(t.timers.length, 0);
});

test('start enables background download and install-on-quit, checks now and every 6 hours', async () => {
  const au = fakeAutoUpdater();
  const t = fakeTimers();
  assert.equal(createUpdater({ autoUpdater: au, isPackaged: true, onReady() {}, setInterval: t.setInterval }).start(), true);
  await flush();
  assert.equal(au.autoDownload, true);
  assert.equal(au.autoInstallOnAppQuit, true);
  assert.equal(au.disableWebInstaller, true);
  assert.equal(au.allowDowngrade, false);
  assert.equal(au.checks, 1);
  assert.equal(t.timers.length, 1);
  assert.equal(t.timers[0].ms, 6 * 3600 * 1000);
  t.timers[0].fn();
  await flush();
  assert.equal(au.checks, 2);
});

test('a failed check (offline) is logged, not reported, and later checks still run', async () => {
  const au = fakeAutoUpdater({ failChecks: true });
  const t = fakeTimers();
  const logs = [];
  let ready = 0;
  createUpdater({ autoUpdater: au, isPackaged: true, onReady: () => ready++, log: (m) => logs.push(m), setInterval: t.setInterval }).start();
  await flush();
  au.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED')); // must not throw (unhandled 'error')
  t.timers[0].fn();
  await flush();
  assert.equal(au.checks, 2);
  assert.equal(ready, 0);
  assert.ok(logs.some((l) => /ERR_INTERNET_DISCONNECTED/.test(l)));
});

test('update-downloaded reports the version once', async () => {
  const au = fakeAutoUpdater();
  const versions = [];
  createUpdater({ autoUpdater: au, isPackaged: true, onReady: (v) => versions.push(v), setInterval: fakeTimers().setInterval }).start();
  au.emit('update-downloaded', { version: '1.2.0' });
  au.emit('update-downloaded', { version: '1.2.0' });
  au.emit('update-downloaded', { version: '1.3.0' });
  assert.deepEqual(versions, ['1.2.0', '1.3.0']);
});

test('install quits and installs silently, then starts the app again', () => {
  const au = fakeAutoUpdater();
  createUpdater({ autoUpdater: au, isPackaged: true, onReady() {}, setInterval: fakeTimers().setInterval }).install();
  assert.deepEqual(au.installs, [[true, true]]);
});

test('a test feed (development only) points the updater at that URL', async () => {
  const au = fakeAutoUpdater();
  const started = createUpdater({
    autoUpdater: au, isPackaged: false, testFeedUrl: 'http://127.0.0.1:9/feed', onReady() {}, setInterval: fakeTimers().setInterval,
  }).start();
  await flush();
  assert.equal(started, true);
  assert.equal(au.forceDevUpdateConfig, true);
  assert.deepEqual(au.feed, { provider: 'generic', url: 'http://127.0.0.1:9/feed' });
  assert.equal(au.checks, 1);
});

test('a test feed is ignored in the installed app', async () => {
  const au = fakeAutoUpdater();
  createUpdater({ autoUpdater: au, isPackaged: true, testFeedUrl: 'http://evil.test/', onReady() {}, setInterval: fakeTimers().setInterval }).start();
  await flush();
  assert.equal(au.feed, null);
});
