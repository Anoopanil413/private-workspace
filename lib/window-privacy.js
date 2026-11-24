// Window titles appear in the taskbar and Alt+Tab, which ARE captured during screen
// sharing even when the window's contents are not. Pages would otherwise put things
// like "Inbox (3) – you@gmail.com" there, so every window keeps a neutral title.
const NEUTRAL_TITLE = 'Private Workspace';

function lockTitle(win, title = NEUTRAL_TITLE) {
  win.setTitle(title);
  win.on('page-title-updated', (e) => e.preventDefault());
}

module.exports = { lockTitle, NEUTRAL_TITLE };
