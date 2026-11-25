const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSession, sessionFromTabs, MAX_TABS } = require('../renderer/session');

const tab = (url, title = '') => ({ url, title });

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
  for (const bad of [null, 'x', { tabs: 'no' }, { version: 2, tabs: [] }, { version: 1, tabs: [{ url: 5 }] }]) {
    assert.deepEqual(validateSession(bad), { version: 1, tabs: [], active: 0 }, JSON.stringify(bad));
  }
});

test('sessionFromTabs keeps the active tab pointing at the same page when blank tabs before it are dropped', () => {
  const s = sessionFromTabs([tab('about:blank'), tab('https://a.test/', 'A'), tab('about:blank'), tab('https://b.test/', 'B')], 3);
  assert.deepEqual(s, { version: 1, tabs: [tab('https://a.test/', 'A'), tab('https://b.test/', 'B')], active: 1 });
});

test('sessionFromTabs with a blank active tab points at the nearest earlier page', () => {
  const s = sessionFromTabs([tab('https://a.test/'), tab('about:blank')], 1);
  assert.equal(s.active, 0);
});
