const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSession, sessionFromTabs, MAX_TABS } = require('../renderer/session');

const tab = (url, title = '') => ({ url, title });
const gtab = (url, title = '', group = null) => ({ url, title, group });

test('validateSession keeps only web pages', () => {
  const s = validateSession({ version: 1, active: 0, tabs: [
    tab('https://a.test/'), tab('about:blank'), tab('file:///C:/x'), tab('javascript:alert(1)'), tab('http://b.test/'),
  ] });
  assert.deepEqual(s.tabs.map((t) => t.url), ['https://a.test/', 'http://b.test/']);
});

test('validateSession keeps at most 50 tabs and cuts long titles', () => {
  const many = Array.from({ length: 60 }, (_, i) => tab(`https://s${i}.test/`, 'x'.repeat(300)));
  const s = validateSession({ version: 1, active: 0, tabs: many });
  assert.equal(MAX_TABS, 50);
  assert.equal(s.tabs.length, 50);
  assert.equal(s.tabs[0].title.length, 200);
});

test('validateSession clamps the active tab into range', () => {
  assert.equal(validateSession({ version: 1, active: 7, tabs: [tab('https://a.test/')] }).active, 0);
  assert.equal(validateSession({ version: 1, active: -2, tabs: [tab('https://a.test/'), tab('https://b.test/')] }).active, 0);
  assert.equal(validateSession({ version: 1, active: 1, tabs: [tab('https://a.test/'), tab('https://b.test/')] }).active, 1);
});

test('validateSession turns garbage into an empty session', () => {
  for (const bad of [null, 'x', { tabs: 'no' }, { version: 3, tabs: [] }, { version: 1, tabs: [{ url: 5 }] }]) {
    assert.deepEqual(validateSession(bad), { version: 2, tabs: [], groups: [], active: 0 }, JSON.stringify(bad));
  }
});

test('sessionFromTabs keeps the active tab pointing at the same page when blank tabs before it are dropped', () => {
  const s = sessionFromTabs([tab('about:blank'), tab('https://a.test/', 'A'), tab('about:blank'), tab('https://b.test/', 'B')], 3);
  assert.deepEqual(s, { version: 2, tabs: [gtab('https://a.test/', 'A'), gtab('https://b.test/', 'B')], groups: [], active: 1 });
});

test('sessionFromTabs with a blank active tab points at the nearest earlier page', () => {
  const s = sessionFromTabs([tab('https://a.test/'), tab('about:blank')], 1);
  assert.equal(s.active, 0);
});

test('validateSession reads a version 1 file (no groups): every tab comes back ungrouped', () => {
  const s = validateSession({ version: 1, active: 1, tabs: [tab('https://a.test/', 'A'), tab('https://b.test/', 'B')] });
  assert.deepEqual(s, { version: 2, tabs: [gtab('https://a.test/', 'A'), gtab('https://b.test/', 'B')], groups: [], active: 1 });
});

test('validateSession v2 keeps groups, fixes bad indexes and colours, drops and renumbers unused groups', () => {
  const s = validateSession({
    version: 2, active: 0,
    groups: [
      { name: 'Unused', color: 'pink', collapsed: false, savedId: null },
      { name: '  Job hunt ', color: 'mauve', collapsed: true, savedId: 's1' },
      { name: '', color: 'green', collapsed: 'yes', savedId: 5 },
    ],
    tabs: [gtab('https://a.test/', 'A', 1), gtab('https://b.test/', 'B', 7), gtab('https://c.test/', 'C', 2), gtab('https://d.test/', 'D', 'x')],
  });
  assert.deepEqual(s.tabs.map((t) => t.group), [0, null, 1, null]);
  assert.deepEqual(s.groups, [
    { name: 'Job hunt', color: 'blue', collapsed: true, savedId: 's1' },
    { name: 'Group', color: 'green', collapsed: false, savedId: null },
  ]);
});

test('sessionFromTabs keeps groups (by index) and drops blank tabs without breaking them', () => {
  const groups = [{ id: 'g1', name: 'Bills', color: 'pink', collapsed: true, savedId: null }, { id: 'g2', name: 'Empty', color: 'blue', collapsed: false, savedId: null }];
  const s = sessionFromTabs([
    gtab('about:blank', '', 'g2'), gtab('https://a.test/', 'A', 'g1'), gtab('https://b.test/', 'B', 'g1'), gtab('https://c.test/', 'C'),
  ], 3, groups);
  assert.deepEqual(s.tabs, [gtab('https://a.test/', 'A', 0), gtab('https://b.test/', 'B', 0), gtab('https://c.test/', 'C', null)]);
  assert.deepEqual(s.groups, [{ name: 'Bills', color: 'pink', collapsed: true, savedId: null }]);
  assert.equal(s.active, 2);
});
