// Pure notes logic for the host page. UMD: window.PWNotes in the page, module.exports
// under Node (tests). Data shape: see lib/notes-store.js.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWNotes = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const makeId = () => crypto.randomUUID();

  // Notes used to be one plain-text localStorage value. Returns the data with that
  // text as the first note, or null when there is nothing to move.
  function migrateLegacy(data, legacyText, now, makeIdFn) {
    if (data.notes.length || !legacyText || !legacyText.trim()) return null;
    return { version: 1, notes: [{ id: makeIdFn(), body: legacyText, updated: now }] };
  }

  function noteTitle(note) {
    const line = note.body.split('\n').find((l) => l.trim()) || '';
    return line.replace(/^\s*#+\s*/, '').trim().slice(0, 60) || 'Untitled';
  }

  function filterNotes(notes, query) {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes.slice();
  }

  const sortByUpdated = (notes) => notes.slice().sort((a, b) => b.updated - a.updated);

  const createNote = (now, makeIdFn) => ({ id: makeIdFn(), body: '', updated: now });

  function formatWhen(ts, now) {
    const ago = now - ts;
    if (ago < 60_000) return 'Just now';
    if (ago < 3_600_000) return `${Math.floor(ago / 60_000)} min ago`;
    const day = (t) => new Date(t).setHours(0, 0, 0, 0);
    const days = Math.round((day(now) - day(ts)) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: 'short' });
    return new Date(ts).toLocaleDateString();
  }

  return { makeId, migrateLegacy, noteTitle, filterNotes, sortByUpdated, createNote, formatWhen };
});
