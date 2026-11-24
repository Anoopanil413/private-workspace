const test = require('node:test');
const assert = require('node:assert/strict');
const { editorShortcut } = require('../renderer/rich-editor');

// KeyboardEvent-like: `code` is the physical key, so Ctrl+Shift+7 works on any layout.
const k = (code, mods = {}) => ({ code, key: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods });
const ctrl = (code, more = {}) => k(code, { ctrlKey: true, ...more });

test('editorShortcut maps the formatting shortcuts', () => {
  assert.equal(editorShortcut(ctrl('KeyB')), 'bold');
  assert.equal(editorShortcut(ctrl('KeyI')), 'italic');
  assert.equal(editorShortcut(ctrl('KeyU')), 'underline');
  assert.equal(editorShortcut(ctrl('KeyX', { shiftKey: true })), 'strikeThrough');
  assert.equal(editorShortcut(ctrl('Digit7', { shiftKey: true })), 'insertOrderedList');
  assert.equal(editorShortcut(ctrl('Digit8', { shiftKey: true })), 'insertUnorderedList');
  assert.equal(editorShortcut(ctrl('Digit9', { shiftKey: true })), 'checklist');
  assert.equal(editorShortcut(ctrl('KeyE')), 'code');
  assert.equal(editorShortcut(k('Tab', { key: 'Tab' })), 'indent');
  assert.equal(editorShortcut(k('Tab', { key: 'Tab', shiftKey: true })), 'outdent');
});

test('editorShortcut leaves other keys alone', () => {
  for (const e of [ctrl('KeyC'), ctrl('KeyV'), ctrl('KeyZ'), ctrl('KeyX'), ctrl('KeyB', { shiftKey: true }),
    k('KeyB'), ctrl('Digit7'), ctrl('Tab', { key: 'Tab' }), ctrl('KeyB', { altKey: true }), ctrl('KeyB', { metaKey: true })]) {
    assert.equal(editorShortcut(e), null, JSON.stringify(e));
  }
});
