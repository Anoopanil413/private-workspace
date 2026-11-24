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

test('popupOptions gives page pop-ups the neutral title and a locked-down sandbox', () => {
  const { popupOptions } = require('../lib/window-privacy');
  const opts = popupOptions({ partition: 'persist:private', preload: '/x/webview-preload.js' });
  assert.equal(opts.title, 'Private Workspace');
  assert.deepEqual(
    { ...opts.webPreferences },
    { partition: 'persist:private', preload: '/x/webview-preload.js', sandbox: true,
      contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: true },
  );
});
