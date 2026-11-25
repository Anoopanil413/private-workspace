const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateDarkPrefs, darkModeFor, cdpCommandsFor, setSiteMode, setDefaultMode, emptyDarkPrefs,
} = require('../lib/dark-mode');

const prefs = (over = {}) => ({ version: 1, default: 'system', sites: {}, ...over });

test('validateDarkPrefs keeps valid modes and hosts, and drops the rest', () => {
  const v = validateDarkPrefs({ version: 1, default: 'force', sites: {
    'news.test': 'dark', 'localhost': 'force', 'bad host!': 'dark', 'x.test': 'purple', '127.0.0.1': 'system',
  } });
  assert.deepEqual(v, { version: 1, default: 'force', sites: { 'news.test': 'dark', localhost: 'force', '127.0.0.1': 'system' } });
});

test('validateDarkPrefs turns garbage into the defaults and keeps at most 1000 sites', () => {
  for (const bad of [null, 'x', { version: 2 }, { version: 1, default: 'weird', sites: 'no' }]) {
    assert.deepEqual(validateDarkPrefs(bad), emptyDarkPrefs(), JSON.stringify(bad));
  }
  const many = Object.fromEntries(Array.from({ length: 1200 }, (_, i) => [`s${i}.test`, 'dark']));
  assert.equal(Object.keys(validateDarkPrefs({ version: 1, default: 'system', sites: many }).sites).length, 1000);
});

test('darkModeFor uses the site setting, then the default; non-web pages are never changed', () => {
  const p = prefs({ default: 'dark', sites: { 'news.test': 'force', 'plain.test': 'system' } });
  assert.equal(darkModeFor(p, 'https://news.test/article'), 'force');
  assert.equal(darkModeFor(p, 'https://plain.test/'), 'system');
  assert.equal(darkModeFor(p, 'https://other.test/'), 'dark');
  assert.equal(darkModeFor(p, 'about:blank'), 'system');
  assert.equal(darkModeFor(p, 'not a url'), 'system');
});

test('cdpCommandsFor: system clears both overrides', () => {
  assert.deepEqual(cdpCommandsFor('system'), [
    ['Emulation.setEmulatedMedia', { features: [] }],
    ['Emulation.setAutoDarkModeOverride', {}],
  ]);
});

test("cdpCommandsFor: dark asks for the site's dark theme only", () => {
  assert.deepEqual(cdpCommandsFor('dark'), [
    ['Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }],
    ['Emulation.setAutoDarkModeOverride', {}],
  ]);
});

test('cdpCommandsFor: force also turns on automatic dark mode', () => {
  assert.deepEqual(cdpCommandsFor('force'), [
    ['Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }],
    ['Emulation.setAutoDarkModeOverride', { enabled: true }],
  ]);
});

test('setSiteMode stores a choice, and choosing the default removes the entry', () => {
  let p = setSiteMode(prefs(), 'news.test', 'force');
  assert.deepEqual(p.sites, { 'news.test': 'force' });
  p = setSiteMode(p, 'news.test', 'system');
  assert.deepEqual(p.sites, {});
});

test('setSiteMode ignores bad hosts and modes; neither function changes its input', () => {
  const p = prefs();
  assert.deepEqual(setSiteMode(p, 'bad host!', 'dark'), p);
  assert.deepEqual(setSiteMode(p, 'ok.test', 'purple'), p);
  setSiteMode(p, 'ok.test', 'dark');
  assert.deepEqual(p.sites, {});
});

test('setDefaultMode sets the default and drops site entries that now equal it', () => {
  const p = setDefaultMode(prefs({ sites: { 'a.test': 'dark', 'b.test': 'force' } }), 'dark');
  assert.equal(p.default, 'dark');
  assert.deepEqual(p.sites, { 'b.test': 'force' });
});
