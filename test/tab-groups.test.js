const test = require('node:test');
const assert = require('node:assert/strict');
const { GROUP_COLORS, nextColor, nextGroupName, cleanName, insertIndex, colorHex } = require('../renderer/tab-groups');

test('GROUP_COLORS are the 8 colours in order', () => {
  assert.deepEqual(GROUP_COLORS.map((c) => `${c.name} ${c.hex}`), [
    'blue #60a5fa', 'pink #f472b6', 'yellow #fbbf24', 'green #34d399',
    'purple #a78bfa', 'red #f87171', 'cyan #22d3ee', 'grey #9ca3af',
  ]);
  assert.equal(colorHex('green'), '#34d399');
  assert.equal(colorHex('nope'), '#60a5fa');
});

test('nextColor takes the first colour no open group uses', () => {
  assert.equal(nextColor([]), 'blue');
  assert.equal(nextColor(['blue', 'pink']), 'yellow');
  assert.equal(nextColor(GROUP_COLORS.map((c) => c.name)), 'blue');
});

test('nextGroupName uses the lowest free number', () => {
  assert.equal(nextGroupName([]), 'Group 1');
  assert.equal(nextGroupName(['Group 1', 'Group 3']), 'Group 2');
  assert.equal(nextGroupName(['Job hunt']), 'Group 1');
});

test('cleanName trims, refuses blanks and cuts at 40 characters', () => {
  assert.equal(cleanName('  Job hunt  '), 'Job hunt');
  assert.equal(cleanName('  '), null);
  assert.equal(cleanName(undefined), null);
  assert.equal(cleanName('x'.repeat(50)), 'x'.repeat(40));
});

test('insertIndex puts a tab joining a group after the group\'s last tab', () => {
  assert.equal(insertIndex([{ id: 'a', group: 'g' }, { id: 'b', group: 'g' }, { id: 'c', group: null }], 'g'), 2);
  assert.equal(insertIndex([{ id: 'a', group: null }, { id: 'b', group: 'g' }], 'g'), 2);
  assert.equal(insertIndex([{ id: 'a', group: null }], 'g'), 1, 'unknown group: at the end');
});

const { validateSaved, savedUpdateFor, findOpenGroup, MAX_SAVED } = require('../renderer/tab-groups');
const web = (n) => ({ url: `https://s${n}.test/`, title: `S${n}` });
const saved = (over = {}) => ({ id: 'sv1', name: 'Bills', color: 'pink', tabs: [web(1), web(2)], updated: 1, ...over });

test('validateSaved turns garbage into an empty list', () => {
  for (const bad of [null, 'x', {}, { version: 2, groups: [] }, { version: 1, groups: 'no' }]) {
    assert.deepEqual(validateSaved(bad), { version: 1, groups: [] }, JSON.stringify(bad));
  }
});

test('validateSaved keeps web tabs only, drops groups with none, fixes names and colours', () => {
  const v = validateSaved({ version: 1, groups: [
    saved({ name: '  Bills  ', color: 'mauve', tabs: [web(1), { url: 'about:blank', title: '' }, { url: 'javascript:alert(1)' }] }),
    saved({ id: 'sv2', tabs: [{ url: 'file:///C:/x', title: '' }] }),
    saved({ id: 'sv3', name: '', tabs: [web(3)] }),
    { id: 5, name: 'Bad id', color: 'blue', tabs: [web(4)], updated: 1 },
  ] });
  assert.deepEqual(v.groups.map((g) => g.id), ['sv1', 'sv3']);
  assert.deepEqual(v.groups[0], { id: 'sv1', name: 'Bills', color: 'blue', tabs: [web(1)], updated: 1 });
  assert.equal(v.groups[1].name, 'Group');
});

test('validateSaved keeps at most 50 groups of at most 50 tabs', () => {
  const many = Array.from({ length: 60 }, (_, i) => saved({ id: `g${i}`, tabs: Array.from({ length: 60 }, (_, k) => web(k)) }));
  const v = validateSaved({ version: 1, groups: many });
  assert.equal(MAX_SAVED, 50);
  assert.equal(v.groups.length, 50);
  assert.equal(v.groups[0].tabs.length, 50);
});

test('savedUpdateFor: an empty or blank-only group is never saved', () => {
  assert.equal(savedUpdateFor(saved(), { name: 'Bills', color: 'pink', tabs: [] }, 9), null);
  assert.equal(savedUpdateFor(saved(), { name: 'Bills', color: 'pink', tabs: [{ url: 'about:blank', title: '' }] }, 9), null);
});

test('savedUpdateFor: nothing changed means no write', () => {
  assert.equal(savedUpdateFor(saved(), { name: 'Bills', color: 'pink', tabs: [web(1), web(2)] }, 9), null);
});

test('savedUpdateFor follows the open group: tabs (blank ones dropped), name and colour', () => {
  const u = savedUpdateFor(saved(), { name: 'Bills 2', color: 'green', tabs: [web(2), { url: 'about:blank', title: '' }, web(3)] }, 9);
  assert.deepEqual(u, { id: 'sv1', name: 'Bills 2', color: 'green', tabs: [web(2), web(3)], updated: 9 });
});

test('findOpenGroup finds the open copy of a saved group', () => {
  const open = [{ id: 'g1', savedId: null }, { id: 'g2', savedId: 'sv1' }];
  assert.equal(findOpenGroup(open, 'sv1').id, 'g2');
  assert.equal(findOpenGroup(open, 'nope'), null);
  assert.equal(findOpenGroup(open, null), null);
});
