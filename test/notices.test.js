const test = require('node:test');
const assert = require('node:assert/strict');
const { addNotice, removeNotice, MAX_NOTICES } = require('../renderer/notices');

let n = 0;
const id = () => `n${++n}`;

test('notices stack instead of replacing each other', () => {
  let list = addNotice([], { text: 'Pop-up protection failed', sticky: true }, id);
  list = addNotice(list, { text: 'Ad blocking is off' }, id);
  assert.deepEqual(list.map((x) => x.text), ['Pop-up protection failed', 'Ad blocking is off']);
  assert.equal(list[0].sticky, true);
  assert.equal(list[1].sticky, false);
});

test('the same text again is not shown twice, it moves to the end', () => {
  let list = addNotice([], { text: 'A' }, id);
  list = addNotice(list, { text: 'B' }, id);
  list = addNotice(list, { text: 'A' }, id);
  assert.deepEqual(list.map((x) => x.text), ['B', 'A']);
});

test('over the limit, the oldest non-sticky notice goes first and sticky warnings stay', () => {
  let list = addNotice([], { text: 'warning', sticky: true }, id);
  for (let i = 0; i < MAX_NOTICES + 2; i++) list = addNotice(list, { text: `info ${i}` }, id);
  assert.equal(list.length, MAX_NOTICES);
  assert.equal(list[0].text, 'warning');
  assert.equal(list[list.length - 1].text, `info ${MAX_NOTICES + 1}`);
});

test('removeNotice removes by id', () => {
  const list = addNotice(addNotice([], { text: 'A' }, () => 'a'), { text: 'B' }, () => 'b');
  assert.deepEqual(removeNotice(list, 'a').map((x) => x.text), ['B']);
});
