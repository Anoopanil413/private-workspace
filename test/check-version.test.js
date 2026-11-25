const test = require('node:test');
const assert = require('node:assert/strict');
const { checkVersion } = require('../scripts/check-version');

test('a v-tag matches the package version', () => {
  assert.equal(checkVersion('v1.2.3', '1.2.3').ok, true);
});

test('a full git ref (refs/tags/v1.2.3) matches too', () => {
  assert.equal(checkVersion('refs/tags/v1.2.3', '1.2.3').ok, true);
});

test('a tag for another version fails and names both versions', () => {
  const r = checkVersion('v1.2.4', '1.2.3');
  assert.equal(r.ok, false);
  assert.match(r.message, /1\.2\.4/);
  assert.match(r.message, /1\.2\.3/);
});

test('a tag without the leading v fails', () => {
  const r = checkVersion('1.2.3', '1.2.3');
  assert.equal(r.ok, false);
  assert.match(r.message, /v1\.2\.3/);
});

test('a missing tag fails', () => {
  assert.equal(checkVersion('', '1.2.3').ok, false);
  assert.equal(checkVersion(undefined, '1.2.3').ok, false);
});

test('a branch ref is not a tag', () => {
  assert.equal(checkVersion('refs/heads/v1.2.3', '1.2.3').ok, false);
});
