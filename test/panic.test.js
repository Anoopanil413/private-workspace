const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createPanic } = require('../lib/panic');

function fakeWindow({ visible = true, destroyed = false } = {}) {
  const win = new EventEmitter();
  win.visible = visible;
  win.focused = false;
  win.isDestroyed = () => destroyed;
  win.isVisible = () => win.visible;
  win.hide = () => { if (destroyed) throw new Error('destroyed'); win.visible = false; };
  win.show = () => { if (destroyed) throw new Error('destroyed'); win.visible = true; win.emit('show'); };
  win.focus = () => { win.focused = true; };
  return win;
}

test('toggle hides every visible window and returns true', () => {
  const a = fakeWindow();
  const b = fakeWindow();
  const panic = createPanic(() => [a, b]);
  assert.equal(panic.toggle(), true);
  assert.equal(panic.isHidden(), true);
  assert.equal(a.visible, false);
  assert.equal(b.visible, false);
});

test('second toggle shows only the windows it hid', () => {
  const shown = fakeWindow();
  const alreadyHidden = fakeWindow({ visible: false });
  const panic = createPanic(() => [shown, alreadyHidden]);
  panic.toggle();
  assert.equal(panic.toggle(), false);
  assert.equal(panic.isHidden(), false);
  assert.equal(shown.visible, true);
  assert.equal(shown.focused, true);
  assert.equal(alreadyHidden.visible, false);
});

test('destroyed windows are skipped', () => {
  const dead = fakeWindow({ destroyed: true });
  const live = fakeWindow();
  const panic = createPanic(() => [dead, live]);
  assert.doesNotThrow(() => panic.toggle());
  assert.equal(live.visible, false);
  assert.doesNotThrow(() => panic.toggle());
  assert.equal(live.visible, true);
});

test('adopt hides a window created while hidden and restores it on the next toggle', () => {
  const main = fakeWindow();
  const panic = createPanic(() => [main]);
  panic.toggle();
  const popup = fakeWindow();
  panic.adopt(popup);
  assert.equal(popup.visible, false);
  // Pop-ups show themselves after creation; that first show must be undone.
  popup.show();
  assert.equal(popup.visible, false);
  panic.toggle();
  assert.equal(popup.visible, true);
  assert.equal(main.visible, true);
});

test('adopt does nothing while not hidden', () => {
  const panic = createPanic(() => []);
  const popup = fakeWindow();
  panic.adopt(popup);
  assert.equal(popup.visible, true);
  popup.show();
  assert.equal(popup.visible, true);
});

test('reveal restores hidden windows and does nothing when not hidden', () => {
  const win = fakeWindow();
  const panic = createPanic(() => [win]);
  panic.reveal();
  assert.equal(win.visible, true);
  assert.equal(panic.isHidden(), false);
  panic.toggle();
  panic.reveal();
  assert.equal(win.visible, true);
  assert.equal(panic.isHidden(), false);
});
