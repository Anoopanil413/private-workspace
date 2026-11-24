const test = require('node:test');
const assert = require('node:assert/strict');
const { nextActiveAfterClose, tabLabel, cycleIndex, indexForNumber, addressToUrl } = require('../renderer/tabs');

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

test('cycleIndex wraps both ways', () => {
  assert.equal(cycleIndex(3, 2, 1), 0);
  assert.equal(cycleIndex(3, 0, -1), 2);
  assert.equal(cycleIndex(3, 1, 1), 2);
});

test('indexForNumber: Ctrl+9 is the last tab; a number beyond the tab count is null', () => {
  assert.equal(indexForNumber(5, 1), 0);
  assert.equal(indexForNumber(5, 9), 4);
  assert.equal(indexForNumber(2, 3), null);
  assert.equal(indexForNumber(0, 9), null);
});

test('tabLabel calls a blank tab "New tab"', () => {
  assert.equal(tabLabel('', 'about:blank'), 'New tab');
});

test('addressToUrl opens sites, local addresses with ports, and searches everything else', () => {
  const search = (q) => 'https://duckduckgo.com/?q=' + encodeURIComponent(q);
  assert.equal(addressToUrl('example.com'), 'https://example.com');
  assert.equal(addressToUrl('mail.google.com/mail/u/0'), 'https://mail.google.com/mail/u/0');
  assert.equal(addressToUrl('https://x.test/a'), 'https://x.test/a');
  assert.equal(addressToUrl('HTTP://x.test'), 'HTTP://x.test');
  assert.equal(addressToUrl('localhost:3000'), 'http://localhost:3000');
  assert.equal(addressToUrl('localhost'), 'http://localhost');
  assert.equal(addressToUrl('127.0.0.1:8080/two'), 'http://127.0.0.1:8080/two');
  assert.equal(addressToUrl('192.168.1.10'), 'http://192.168.1.10');
  assert.equal(addressToUrl('example.com:8443/x'), 'https://example.com:8443/x');
  assert.equal(addressToUrl('how to boil eggs'), search('how to boil eggs'));
  assert.equal(addressToUrl('node.js'), 'https://node.js');
  assert.equal(addressToUrl('  '), null);
});
