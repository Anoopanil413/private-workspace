const test = require('node:test');
const assert = require('node:assert/strict');
const { clampSideWidth } = require('../renderer/side-notes');

test('clampSideWidth keeps the wanted width when it fits', () => {
  assert.equal(clampSideWidth(360, 1200), 360);
});

test('clampSideWidth never goes below 260 px', () => {
  assert.equal(clampSideWidth(100, 1200), 260);
});

test('clampSideWidth caps the panel at 60 % of the browser area', () => {
  assert.equal(clampSideWidth(900, 1200), 720);
});

test('clampSideWidth leaves the page at least 320 px', () => {
  assert.equal(clampSideWidth(500, 700), 380);
});

test('clampSideWidth hides the panel when the browser area is under 580 px', () => {
  assert.equal(clampSideWidth(360, 579), 0);
});

test('clampSideWidth survives a missing or broken saved width', () => {
  assert.equal(clampSideWidth(NaN, 1200), 360);
  assert.equal(clampSideWidth(undefined, 1200), 360);
});
