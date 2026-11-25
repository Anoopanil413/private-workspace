const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { userDataToUse, DATA_FOLDER } = require('../lib/paths');

const appData = 'C:\\Users\\me\\AppData\\Roaming';

test('the default folder for the display name is moved to the original private-workspace folder', () => {
  assert.equal(DATA_FOLDER, 'private-workspace');
  assert.equal(
    userDataToUse({ current: path.win32.join(appData, 'Private Workspace'), appData, appName: 'Private Workspace' }),
    path.win32.join(appData, 'private-workspace'));
});

test('Windows paths compare without case', () => {
  assert.equal(
    userDataToUse({ current: 'c:\\users\\me\\appdata\\roaming\\private workspace', appData, appName: 'Private Workspace' }),
    path.win32.join(appData, 'private-workspace'));
});

test('a folder chosen by someone else (tests, --user-data-dir) is left alone', () => {
  assert.equal(userDataToUse({ current: 'D:\\tmp\\pw-smoke-1', appData, appName: 'Private Workspace' }), null);
});

test('nothing to do when it is already the private-workspace folder', () => {
  assert.equal(userDataToUse({ current: path.win32.join(appData, 'private-workspace'), appData, appName: 'private-workspace' }), null);
});
