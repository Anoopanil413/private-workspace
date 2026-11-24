const test = require('node:test');
const assert = require('node:assert/strict');
const { routeWindowOpen } = require('../lib/window-routing');

test('routeWindowOpen sends target=_blank and Ctrl+click links to tabs', () => {
  assert.equal(routeWindowOpen({ url: 'https://example.com/a', disposition: 'foreground-tab' }), 'tab');
  assert.equal(routeWindowOpen({ url: 'https://example.com/a', disposition: 'background-tab' }), 'tab');
});

test('routeWindowOpen keeps window.open with features as a popup (sign-in windows need window.opener)', () => {
  assert.equal(routeWindowOpen({ url: 'https://accounts.google.com/o/oauth2/auth', disposition: 'new-window' }), 'popup');
  assert.equal(routeWindowOpen({ url: 'https://example.com', disposition: 'other' }), 'popup');
});

test('about:blank always opens as a popup, since its opener writes into it', () => {
  assert.equal(routeWindowOpen({ url: 'about:blank', disposition: 'foreground-tab' }), 'popup');
});

test('routeWindowOpen denies links that would open another app', () => {
  assert.equal(routeWindowOpen({ url: 'mailto:a@b.c', disposition: 'foreground-tab' }), 'deny');
  assert.equal(routeWindowOpen({ url: 'whatsapp://send?text=hi', disposition: 'new-window' }), 'deny');
  assert.equal(routeWindowOpen({ url: 'file:///C:/Windows/win.ini', disposition: 'foreground-tab' }), 'deny');
});

test('a form posting to a new window stays a popup so the POST body is kept', () => {
  assert.equal(routeWindowOpen({ url: 'https://bank.test/sso', disposition: 'foreground-tab', postBody: { data: [] } }), 'popup');
});

test('window.open into a named window stays a popup; _blank and unnamed go to a tab', () => {
  assert.equal(routeWindowOpen({ url: 'https://idp.test/auth', disposition: 'foreground-tab', frameName: 'auth' }), 'popup');
  assert.equal(routeWindowOpen({ url: 'https://example.com', disposition: 'foreground-tab', frameName: '_blank' }), 'tab');
  assert.equal(routeWindowOpen({ url: 'https://example.com', disposition: 'foreground-tab', frameName: '' }), 'tab');
});
