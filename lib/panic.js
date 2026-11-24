// Panic key: hide every window of the app at once (hidden windows leave the taskbar
// and Alt+Tab too), and bring back exactly those windows on the next press.
function createPanic(getWindows) {
  let hidden = false;
  const hiddenByUs = new Set();
  const alive = (win) => win && !win.isDestroyed();

  function hide(win) {
    hiddenByUs.add(win);
    win.hide();
  }

  function toggle() {
    if (!hidden) {
      hidden = true;
      for (const win of getWindows()) if (alive(win) && win.isVisible()) hide(win);
    } else {
      hidden = false;
      let last = null;
      for (const win of hiddenByUs) {
        if (!alive(win)) continue;
        win.show();
        last = win;
      }
      hiddenByUs.clear();
      if (last) last.focus();
    }
    return hidden;
  }

  // A window created while hidden (e.g. a page's pop-up) is hidden too. Pop-ups show
  // themselves right after creation, so undo that first show as well.
  function adopt(win) {
    if (!hidden || !alive(win)) return;
    hide(win);
    win.once('show', () => { if (hidden && alive(win)) win.hide(); });
  }

  return { toggle, adopt, isHidden: () => hidden };
}

module.exports = { createPanic };
