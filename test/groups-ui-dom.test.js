const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const url = (x) => `https://${x}.test/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The tab bar and the saved-groups UI in a DOM, with a stand-in for the encrypted store.
function setup({ saved = [], restored = Promise.resolve() } = {}) {
  const { window } = new JSDOM('<!doctype html><body><div id="strip"></div><div id="host"></div><button id="btn"></button><div id="pop" hidden></div></body>');
  global.window = window;
  global.document = window.document;
  global.confirm = () => true;
  global.self = { PWTabGroups: require('../renderer/tab-groups') };
  const { createTabs } = require('../renderer/tabs');
  const { createSavedGroups } = require('../renderer/groups-ui');
  const $ = (id) => window.document.getElementById(id);
  const tabs = createTabs({ strip: $('strip'), host: $('host'), homeUrl: 'https://home.test/' });
  const store = {
    data: { version: 1, groups: saved },
    saves: [],
    load: async () => store.data,
    save: async (d) => { store.saves.push(JSON.parse(JSON.stringify(d))); store.data = d; return { ok: true }; },
  };
  const ui = createSavedGroups({ button: $('btn'), pop: $('pop'), tabs, store, notify() {}, whenRestored: restored, saveDelay: 5 });
  return { tabs, store, ui };
}
test.afterEach(() => { delete global.window; delete global.document; delete global.confirm; delete global.self; });

const research = () => ({ id: 'sv1', name: 'Research', color: 'pink', tabs: ['a', 'b', 'c'].map((x) => ({ url: url(x), title: x })), updated: 1 });

test('restoring a linked group that the session cut short never shrinks its saved copy', async () => {
  let finish;
  const { tabs, store } = setup({ saved: [research()], restored: new Promise((r) => { finish = r; }) });
  // What the app's restore does: the session only kept a and b of "Research".
  const opened = ['a', 'b'].map((x) => tabs.open(url(x), { background: true, lazy: true, title: x }));
  tabs.createGroup(opened.map((t) => t.id), { name: 'Research', color: 'pink', savedId: 'sv1' });
  tabs.activate(opened[0].id);
  finish();
  await sleep(40);
  assert.equal(store.saves.length, 0, 'nothing written');
  assert.equal(store.data.groups[0].tabs.length, 3);
  assert.equal(tabs.groups()[0].savedId, null, 'the cut copy is no longer linked');
});

test('a restored linked group that matches its saved copy stays linked and keeps saving', async () => {
  const { tabs, store } = setup({ saved: [research()] });
  const opened = ['a', 'b', 'c'].map((x) => tabs.open(url(x), { background: true, lazy: true, title: x }));
  const g = tabs.createGroup(opened.map((t) => t.id), { name: 'Research', color: 'pink', savedId: 'sv1' });
  await sleep(20);
  assert.equal(tabs.groups()[0].savedId, 'sv1');
  tabs.updateGroup(g.id, { name: 'Research 2' });
  await sleep(40);
  assert.equal(store.data.groups[0].name, 'Research 2');
});

test('opening a saved group before the restore has finished does not make a second linked copy', async () => {
  let finish;
  const { tabs, ui } = setup({ saved: [research()], restored: new Promise((r) => { finish = r; }) });
  const opening = ui.openSaved('sv1'); // clicked very early
  const opened = ['a', 'b', 'c'].map((x) => tabs.open(url(x), { background: true, lazy: true, title: x }));
  tabs.createGroup(opened.map((t) => t.id), { name: 'Research', color: 'pink', savedId: 'sv1' });
  finish();
  await opening;
  assert.equal(tabs.groups().length, 1);
  assert.equal(tabs.list().length, 3);
});

test('closing a linked group keeps its saved copy whole', async () => {
  const { tabs, store, ui } = setup({ saved: [research()] });
  await ui.openSaved('sv1');
  tabs.closeGroup(tabs.groups()[0].id);
  await sleep(40);
  assert.equal(store.data.groups[0].tabs.length, 3);
});

test('a rename right before Ungroup still reaches the saved copy', async () => {
  const { tabs, store, ui } = setup({ saved: [research()] });
  await ui.openSaved('sv1');
  const g = tabs.groups()[0];
  tabs.updateGroup(g.id, { name: 'Renamed' });
  tabs.ungroup(g.id);
  await sleep(40);
  assert.equal(store.data.groups[0].name, 'Renamed');
  assert.equal(store.data.groups[0].tabs.length, 3);
});
