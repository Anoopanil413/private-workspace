const test = require('node:test');
const assert = require('node:assert/strict');
const { nextActiveAfterClose, tabLabel } = require('../renderer/tabs');

test('closing the active tab activates the tab on its right', () => {
  assert.equal(nextActiveAfterClose(['a', 'b', 'c'], 'b', 'b'), 'c');
});

test('closing the active last tab activates the tab on its left', () => {
  assert.equal(nextActiveAfterClose(['a', 'b', 'c'], 'c', 'c'), 'b');
});

test('closing the only tab leaves nothing active', () => {
  assert.equal(nextActiveAfterClose(['a'], 'a', 'a'), null);
});

test('closing a background tab keeps the active one', () => {
  assert.equal(nextActiveAfterClose(['a', 'b', 'c'], 'a', 'c'), 'c');
});

test('tabLabel prefers the page title, then the host name, then "New tab"', () => {
  assert.equal(tabLabel('Inbox (3)', 'https://mail.google.com/x'), 'Inbox (3)');
  assert.equal(tabLabel('', 'https://mail.google.com/x'), 'mail.google.com');
  assert.equal(tabLabel('', ''), 'New tab');
});
