// Window titles appear in the taskbar and Alt+Tab, which ARE captured during screen
// sharing even when the window's contents are not. Pages would otherwise put things
// like "Inbox (3) – you@gmail.com" there, so every window keeps a neutral title.
const NEUTRAL_TITLE = 'Private Workspace';

function lockTitle(win, title = NEUTRAL_TITLE) {
  win.setTitle(title);
  win.on('page-title-updated', (e) => e.preventDefault());
}

// Options for windows that pages open (window.open with features): same private
// session, no Node, sandboxed, and the neutral title from the very start (Electron
// otherwise names the window after the app, overriding a title set on creation).
function popupOptions({ partition, preload }) {
  return {
    title: NEUTRAL_TITLE,
    width: 1000,
    height: 720,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      partition, preload, sandbox: true, contextIsolation: true, nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
    },
  };
}

module.exports = { lockTitle, popupOptions, NEUTRAL_TITLE };
