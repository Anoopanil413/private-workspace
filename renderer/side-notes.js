// Notes beside the page: a panel to the right of the web pages that holds the notes
// editor. There is only one editor; opening the panel moves it here from the Notes
// screen (notesUI.mountInto) and closing the panel moves it back.
// Layout only (open + width) is remembered in localStorage; note content never is.
// UMD: window.PWSideNotes / module.exports (clampSideWidth is tested under Node).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWSideNotes = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN_WIDTH = 260;
  const MAX_SHARE = 0.6;
  const PAGE_MIN = 320;
  const DEFAULT_WIDTH = 360;
  const KEY = 'side-notes';

  // The panel's width for a wanted width and the browser area's width; 0 = no room.
  function clampSideWidth(want, total) {
    if (!(total >= MIN_WIDTH + PAGE_MIN)) return 0;
    const w = Number.isFinite(want) ? want : DEFAULT_WIDTH;
    const max = Math.min(Math.floor(total * MAX_SHARE), total - PAGE_MIN);
    return Math.max(MIN_WIDTH, Math.min(w, max));
  }

  function readPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { open: p.open === true, width: Number(p.width) || DEFAULT_WIDTH };
    } catch { return { open: false, width: DEFAULT_WIDTH }; }
  }
  function writePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }

  // area: the element holding the pages and the panel side by side.
  // isBrowserShown(): whether the Browser screen is showing (the editor lives on the
  // Notes screen while that one is shown).
  function createSideNotes({ area, panel, divider, body, pickBtn, titleEl, newBtn, closeBtn, button, shield, notesUI, isBrowserShown, onNotice = () => {} }) {
    const prefs = readPrefs();
    let open = prefs.open;
    let width = prefs.width;
    let mounted = false;

    const save = () => writePrefs({ open, width });

    const hasRoom = () => clampSideWidth(width, area.clientWidth) > 0;
    // Open, on the Browser screen, and the window wide enough.
    const isShown = () => open && isBrowserShown() && hasRoom();

    function layout() {
      const w = clampSideWidth(width, area.clientWidth);
      panel.style.width = `${w}px`;
      panel.classList.toggle('no-room', w === 0);
      button.setAttribute('aria-pressed', String(isShown()));
    }

    function paintTitle() {
      const note = notesUI.activeNote();
      titleEl.textContent = note ? note.title : 'Note';
    }

    function closePicker() {
      if (!panel.classList.contains('picker-open')) return;
      panel.classList.remove('picker-open');
      pickBtn.setAttribute('aria-expanded', 'false');
    }

    // Puts the editor where it belongs for the current screen and setting.
    function sync() {
      const here = open && isBrowserShown();
      panel.hidden = !here;
      button.setAttribute('aria-pressed', String(isShown()));
      if (here && !mounted) { notesUI.mountInto(body); mounted = true; }
      if (!here && mounted) { closePicker(); notesUI.mountInto(null); mounted = false; }
      if (here) { layout(); paintTitle(); }
    }

    function setOpen(next, { focus = next } = {}) {
      open = next;
      save();
      sync();
      if (open && focus && mounted) notesUI.focus();
    }

    const noRoom = () => onNotice('Make the window wider to have notes beside the page.');
    function toggle() {
      // Open but hidden for lack of room: say so instead of closing it unseen.
      if (open && isBrowserShown() && !hasRoom()) { noRoom(); return; }
      setOpen(!open);
      if (open && isBrowserShown() && !hasRoom()) noRoom();
    }

    // ---- resizing: while dragging, a shield covers the pages so they don't eat the mouse
    divider.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      shield.hidden = false;
      const right = area.getBoundingClientRect().right;
      const move = (ev) => {
        width = clampSideWidth(right - ev.clientX, area.clientWidth) || width;
        layout();
      };
      const up = () => {
        shield.hidden = true;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        save();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    window.addEventListener('resize', () => { if (!panel.hidden) layout(); });
    // Clicking into the page (or anywhere else) closes the note picker: clicks inside a
    // page never reach this document, but the focus leaving the picker does. A press on
    // the picker's own empty space (no focus target) doesn't count.
    const inPicker = (el) => !!el && (pickBtn.contains(el) || !!(el.closest && el.closest('.notes-side')));
    let pressing = false;
    panel.addEventListener('pointerdown', (e) => { pressing = inPicker(e.target); });
    window.addEventListener('pointerup', () => { pressing = false; });
    panel.addEventListener('focusout', () => {
      setTimeout(() => { if (!pressing && !inPicker(document.activeElement)) closePicker(); }, 0);
    });

    // ---- header: note picker, new note, close
    pickBtn.addEventListener('click', () => {
      const on = panel.classList.toggle('picker-open');
      pickBtn.setAttribute('aria-expanded', String(on));
      if (on) notesUI.focusSearch();
    });
    // Picking a note from the list closes the picker.
    body.addEventListener('click', (e) => { if (e.target.closest('.note-item')) { closePicker(); notesUI.focus(); } });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('picker-open')) { closePicker(); notesUI.focus(); } });
    document.addEventListener('pointerdown', (e) => { if (!pickBtn.contains(e.target) && !e.target.closest('.notes-side')) closePicker(); });
    newBtn.addEventListener('click', () => { closePicker(); notesUI.addNote(); });
    closeBtn.addEventListener('click', () => setOpen(false));
    button.addEventListener('click', toggle);
    notesUI.onListChange(() => { if (mounted) paintTitle(); });

    sync();
    return { toggle, isOpen: () => open, isShown, sync };
  }

  return { clampSideWidth, createSideNotes, MIN_WIDTH, PAGE_MIN };
});
