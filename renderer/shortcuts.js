// Browser keyboard shortcuts: key press -> action name. Shared by the main process
// (keys pressed inside a web page) and the host page. UMD: window.PWShortcuts.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWShortcuts = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Ctrl + key. Entries with `shift` need Shift exactly as given; others ignore Shift
  // only where noted ('+' needs Shift on most layouts).
  const CTRL = [
    { key: 't', shift: false, action: 'new-tab' },
    { key: 't', shift: true, action: 'reopen-tab' },
    { key: 'w', shift: false, action: 'close-tab' },
    { key: 'F4', shift: false, action: 'close-tab' },
    { key: 'Tab', shift: false, action: 'next-tab' },
    { key: 'Tab', shift: true, action: 'prev-tab' },
    { key: 'PageDown', shift: false, action: 'next-tab' },
    { key: 'PageUp', shift: false, action: 'prev-tab' },
    { key: 'l', shift: false, action: 'focus-url' },
    { key: 'r', shift: false, action: 'reload' },
    { key: 'r', shift: true, action: 'hard-reload' },
    { key: 'F5', shift: false, action: 'hard-reload' },
    { key: 'f', shift: false, action: 'find' },
    { key: 'g', shift: false, action: 'find-next' },
    { key: 'g', shift: true, action: 'find-prev' },
    { key: '=', shift: false, action: 'zoom-in' },
    { key: '+', action: 'zoom-in' },
    { key: '-', shift: false, action: 'zoom-out' },
    { key: '0', shift: false, action: 'zoom-reset' },
    { key: 'd', shift: false, action: 'bookmark' },
    { key: 'n', shift: true, action: 'toggle-notes' },
  ];
  const ALT = { d: 'focus-url', ArrowLeft: 'back', ArrowRight: 'forward' };
  const PLAIN = { F6: 'focus-url', F5: 'reload', F3: 'find-next' };
  const SHIFT = { F5: 'hard-reload', F3: 'find-prev' };

  function matchShortcut(input) {
    if (!input || (input.type && input.type !== 'keyDown')) return null;
    const { control, shift, alt, meta } = input;
    if (meta) return null;
    // Letters compare case-insensitively (Caps Lock); named keys as they are.
    const key = input.key && input.key.length === 1 ? input.key.toLowerCase() : input.key;

    if (control) {
      if (alt) return null; // Ctrl+Alt is AltGr: typing a character, not a shortcut
      if (/^[1-8]$/.test(key) && !shift) return `tab-${key}`;
      if (key === '9' && !shift) return 'last-tab';
      const hit = CTRL.find((s) => s.key === key && (s.shift === undefined || s.shift === shift));
      return hit ? hit.action : null;
    }
    if (alt) return !shift ? ALT[key] || null : null;
    if (shift) return SHIFT[key] || null;
    return PLAIN[key] || null;
  }

  // Chrome's zoom levels. Small float error (1.0999…) counts as being on a level.
  const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
  function nextZoom(current, direction) {
    const eps = 0.001;
    if (direction > 0) return ZOOM_LEVELS.find((z) => z > current + eps) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    return [...ZOOM_LEVELS].reverse().find((z) => z < current - eps) ?? ZOOM_LEVELS[0];
  }

  const fromKeyboardEvent = (e) => ({
    type: 'keyDown', key: e.key, control: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey,
  });

  return { matchShortcut, fromKeyboardEvent, nextZoom };
});
