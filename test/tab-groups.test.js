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
