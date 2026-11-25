// Where the app keeps its data. Electron names the folder after the display name
// ("Private Workspace"), but notes, tabs and settings have always lived in
// %APPDATA%\private-workspace, so the default folder is moved back there. A folder
// someone chose on purpose (tests, --user-data-dir) is left alone.
const path = require('path');

const DATA_FOLDER = 'private-workspace';

// Returns the folder to switch to, or null to keep the current one.
function userDataToUse({ current, appData, appName }) {
  const p = path.win32;
  const same = (a, b) => p.normalize(a).toLowerCase() === p.normalize(b).toLowerCase();
  const wanted = p.join(appData, DATA_FOLDER);
  if (same(current, wanted)) return null;
  return same(current, p.join(appData, appName)) ? wanted : null;
}

module.exports = { userDataToUse, DATA_FOLDER };
