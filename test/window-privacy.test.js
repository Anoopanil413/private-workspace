const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { lockTitle } = require('../lib/window-privacy');

function fakeWindow() {
  const win = new EventEmitter();
  win.title = 'Inbox (3) – Gmail';
  win.setTitle = (t) => { win.title = t; };
  return win;
}

test('lockTitle sets the neutral title and blocks page title updates', () => {
  const win = fakeWindow();
  lockTitle(win);
  assert.equal(win.title, 'Private Workspace');
  let prevented = false;
  win.emit('page-title-updated', { preventDefault: () => { prevented = true; } }, 'Inbox (3) – Gmail');
  assert.ok(prevented);
  assert.equal(win.title, 'Private Workspace');
});
