const test = require('node:test');
const assert = require('node:assert/strict');
const { matchShortcut, nextZoom } = require('../renderer/shortcuts');

// Electron before-input-event style input.
const key = (k, mods = {}) => ({ type: 'keyDown', key: k, control: false, shift: false, alt: false, meta: false, ...mods });
const ctrl = (k, more = {}) => key(k, { control: true, ...more });

test('matchShortcut maps tab shortcuts', () => {
  assert.equal(matchShortcut(ctrl('t')), 'new-tab');
  assert.equal(matchShortcut(ctrl('w')), 'close-tab');
  assert.equal(matchShortcut(ctrl('F4')), 'close-tab');
  assert.equal(matchShortcut(ctrl('T', { shift: true })), 'reopen-tab');
  assert.equal(matchShortcut(ctrl('Tab')), 'next-tab');
  assert.equal(matchShortcut(ctrl('PageDown')), 'next-tab');
  assert.equal(matchShortcut(ctrl('Tab', { shift: true })), 'prev-tab');
  assert.equal(matchShortcut(ctrl('PageUp')), 'prev-tab');
  assert.equal(matchShortcut(ctrl('1')), 'tab-1');
  assert.equal(matchShortcut(ctrl('8')), 'tab-8');
  assert.equal(matchShortcut(ctrl('9')), 'last-tab');
});

test('matchShortcut maps navigation shortcuts', () => {
  assert.equal(matchShortcut(ctrl('l')), 'focus-url');
  assert.equal(matchShortcut(key('d', { alt: true })), 'focus-url');
  assert.equal(matchShortcut(key('F6')), 'focus-url');
  assert.equal(matchShortcut(ctrl('r')), 'reload');
  assert.equal(matchShortcut(key('F5')), 'reload');
  assert.equal(matchShortcut(ctrl('R', { shift: true })), 'hard-reload');
  assert.equal(matchShortcut(ctrl('F5')), 'hard-reload');
  assert.equal(matchShortcut(key('F5', { shift: true })), 'hard-reload');
  assert.equal(matchShortcut(key('ArrowLeft', { alt: true })), 'back');
  assert.equal(matchShortcut(key('ArrowRight', { alt: true })), 'forward');
});

test('matchShortcut maps find, zoom and bookmark', () => {
  assert.equal(matchShortcut(ctrl('f')), 'find');
  assert.equal(matchShortcut(key('F3')), 'find-next');
  assert.equal(matchShortcut(key('F3', { shift: true })), 'find-prev');
  assert.equal(matchShortcut(ctrl('g')), 'find-next');
  assert.equal(matchShortcut(ctrl('G', { shift: true })), 'find-prev');
  assert.equal(matchShortcut(ctrl('=')), 'zoom-in');
  assert.equal(matchShortcut(ctrl('+', { shift: true })), 'zoom-in');
  assert.equal(matchShortcut(ctrl('-')), 'zoom-out');
  assert.equal(matchShortcut(ctrl('0')), 'zoom-reset');
  assert.equal(matchShortcut(ctrl('d')), 'bookmark');
});

test('matchShortcut works with Caps Lock on (upper-case keys without Shift)', () => {
  assert.equal(matchShortcut(ctrl('T')), 'new-tab');
  assert.equal(matchShortcut(ctrl('W')), 'close-tab');
});

test('matchShortcut ignores typing and editing keys', () => {
  for (const input of [key('a'), key('T', { shift: true }), ctrl('c'), ctrl('v'), ctrl('x'), ctrl('z'), ctrl('a'),
    ctrl('Backspace'), ctrl('b'), ctrl('i'), ctrl('u'), key('Tab'), key('Enter'), key('ArrowLeft')]) {
    assert.equal(matchShortcut(input), null, JSON.stringify(input));
  }
});

test('matchShortcut ignores AltGr (Ctrl+Alt) and Windows-key combinations', () => {
  assert.equal(matchShortcut(ctrl('t', { alt: true })), null);
  assert.equal(matchShortcut(ctrl('q', { alt: true })), null);
  assert.equal(matchShortcut(ctrl('t', { meta: true })), null);
});

test('matchShortcut ignores key-up events', () => {
  assert.equal(matchShortcut({ ...ctrl('t'), type: 'keyUp' }), null);
});

test('nextZoom steps through browser zoom levels and stops at the ends', () => {
  assert.equal(nextZoom(1, 1), 1.1);
  assert.equal(nextZoom(1.1, 1), 1.25);
  assert.equal(nextZoom(1, -1), 0.9);
  assert.equal(nextZoom(5, 1), 5);
  assert.equal(nextZoom(0.25, -1), 0.25);
  assert.equal(nextZoom(1.17, 1), 1.25); // between levels: go to the next one up
  assert.equal(nextZoom(1.17, -1), 1.1);
});

test('Ctrl+Shift+N toggles the notes side panel; Ctrl+N alone does nothing', () => {
  assert.equal(matchShortcut(ctrl('N', { shift: true })), 'toggle-notes');
  assert.equal(matchShortcut(ctrl('n')), null);
});
