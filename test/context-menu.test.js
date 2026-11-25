const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { selectionMenu, createMenu } = require('../renderer/context-menu');

const recent = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `n${n}`, title: `Note ${n}` }));
const real = (items) => items.filter((i) => !i.separator);

test('selectionMenu is empty without selected text', () => {
  assert.deepEqual(selectionMenu({ selectionText: '', sideNote: null, recent }), []);
  assert.deepEqual(selectionMenu({ selectionText: '   ', sideNote: null, recent }), []);
});

test('selectionMenu: Copy, then Add to note with the 5 newest notes and a new note', () => {
  const items = real(selectionMenu({ selectionText: 'hi', sideNote: null, recent }));
  assert.equal(items[0].label, 'Copy');
  assert.equal(items[0].action, 'copy');
  assert.equal(items[1].label, 'Add to note');
  const sub = real(items[1].items);
  assert.deepEqual(sub.map((i) => i.noteId), ['n1', 'n2', 'n3', 'n4', 'n5', null]);
  assert.equal(sub[5].label, '＋ New note');
  assert.ok(sub.every((i) => i.action === 'add'));
});

test('selectionMenu puts the note open beside the page first, and does not list it twice', () => {
  const items = real(selectionMenu({ selectionText: 'hi', sideNote: { id: 'n2', title: 'Note 2' }, recent }));
  assert.equal(items[1].label, 'Add to "Note 2"');
  assert.equal(items[1].noteId, 'n2');
  assert.equal(items[1].action, 'add');
  const sub = real(items[2].items);
  assert.deepEqual(sub.map((i) => i.noteId), ['n1', 'n3', 'n4', 'n5', 'n6', null]);
});

test('selectionMenu shortens long note titles', () => {
  const items = real(selectionMenu({ selectionText: 'hi', sideNote: { id: 'x', title: 'y'.repeat(80) }, recent: [] }));
  assert.ok(items[1].label.length <= 50);
  assert.ok(items[1].label.endsWith('…"'));
});

test('createMenu shows items, picks with a click or Enter, and closes with Escape', () => {
  const { window } = new JSDOM('<!doctype html><body><div id="m" hidden></div></body>');
  const root = window.document.getElementById('m');
  const menu = createMenu(root);
  const picked = [];
  const items = [{ label: 'Copy', action: 'copy' }, { separator: true }, { label: 'More', items: [{ label: 'Deep', action: 'deep' }] }];
  menu.show(items, 10, 20, (item) => picked.push(item.action));
  assert.equal(root.hidden, false);
  const buttons = [...root.querySelectorAll('button')];
  assert.deepEqual(buttons.map((b) => b.textContent.replace(/\s*▸$/, '')), ['Copy', 'More', 'Deep']);
  buttons[0].click();
  assert.deepEqual(picked, ['copy']);
  assert.equal(root.hidden, true, 'a pick closes the menu');

  menu.show(items, 10, 20, (item) => picked.push(item.action));
  root.querySelectorAll('button')[2].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.deepEqual(picked, ['copy', 'deep']);

  menu.show(items, 10, 20, () => picked.push('x'));
  root.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(root.hidden, true);
  assert.deepEqual(picked, ['copy', 'deep']);
});
