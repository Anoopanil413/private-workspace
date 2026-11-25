const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// The tab bar in a DOM (jsdom: <webview> is just an element here).
function setup() {
  const { window } = new JSDOM('<!doctype html><body><div id="strip"></div><div id="host"></div></body>');
  global.document = window.document;
  global.self = { PWTabGroups: require('../renderer/tab-groups') };
  const { createTabs } = require('../renderer/tabs');
  const tabs = createTabs({ strip: window.document.getElementById('strip'), host: window.document.getElementById('host'), homeUrl: 'https://home.test/' });
  const names = () => [...window.document.getElementById('strip').children].map((e) =>
    e.classList.contains('bgroup') ? `[${(e.querySelector('.bgroup-name') || e.querySelector('input')).textContent || 'input'}]`
      : e.classList.contains('btab') ? e.querySelector('.btab-title').textContent : '+');
  return { window, tabs, names };
}
test.afterEach(() => { delete global.document; delete global.self; });

test('renaming a group survives the tab bar being redrawn (a tab opening meanwhile)', () => {
  const { window, tabs, names } = setup();
  const a = tabs.open('https://a.test/');
  tabs.open('https://b.test/');
  const g = tabs.createGroup([a.id]);
  tabs.startRename(g.id);
  const input = window.document.querySelector('.bgroup-input');
  assert.equal(window.document.activeElement, input);
  tabs.open('https://c.test/'); // redraws the bar
  tabs.updateGroup(g.id, { savedId: 'sv1' }); // and again
  assert.equal(window.document.activeElement, input, 'still editing the name');
  assert.deepEqual(names(), ['[input]', 'a.test', 'b.test', 'c.test', '+']);
  input.value = 'Bills';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
  assert.deepEqual(names(), ['[Bills]', 'a.test', 'b.test', 'c.test', '+']);
});

test('a group keeps its tabs together and a closed group leaves no chip behind', () => {
  const { tabs, names } = setup();
  const [a, b, c] = ['a', 'b', 'c'].map((x) => tabs.open(`https://${x}.test/`));
  const g = tabs.createGroup([a.id], { name: 'G' });
  tabs.addToGroup(c.id, g.id);
  assert.deepEqual(names(), ['[G]', 'a.test', 'c.test', 'b.test', '+']);
  tabs.closeGroup(g.id);
  assert.deepEqual(names(), ['b.test', '+']);
  assert.equal(tabs.active().id, b.id);
});
