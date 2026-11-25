const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldBlur, readBlurSetting } = require('../renderer/blur');

test('blurs only when the setting is on and the window has lost focus', () => {
  assert.equal(shouldBlur({ enabled: true, focused: false }), true);
  assert.equal(shouldBlur({ enabled: true, focused: true }), false);
  assert.equal(shouldBlur({ enabled: false, focused: false }), false);
  assert.equal(shouldBlur({ enabled: false, focused: true }), false);
});

test('the setting is on unless it was turned off', () => {
  assert.equal(readBlurSetting(null), true);
  assert.equal(readBlurSetting('1'), true);
  assert.equal(readBlurSetting('0'), false);
  assert.equal(readBlurSetting('garbage'), true);
});
