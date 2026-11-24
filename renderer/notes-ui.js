// Notes screen: list + search, editor, Markdown preview. Saves the whole NotesData
// (see lib/notes-store.js) through the encrypted store 400 ms after the last edit.
// Needs PWNotes (notes-model.js) and PWMarkdown (markdown.js). UMD: window.PWNotesUI.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWNotesUI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LEGACY_KEY = 'private-notes';
  const PREVIEW_KEY = 'notes-preview';
  const SAVE_DELAY = 400;

  function createNotesUI({ root, store, onNotice }) {
    const N = PWNotes;
    const $ = (sel) => root.querySelector(sel);
    const editor = $('#notes');
    const preview = $('#notes-preview');
    const list = $('#notes-list');
    const search = $('#notes-search');
    const status = $('#notes-status');
    const previewBtn = $('#notes-preview-toggle');
    const deleteBtn = $('#notes-delete');
    const newBtn = $('#notes-new');

    let data = { version: 1, notes: [] };
    let activeId = null;
    let saveTimer = null;

    const active = () => data.notes.find((n) => n.id === activeId) || null;
    const store_ = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
    const read_ = (key) => { try { return localStorage.getItem(key); } catch { return null; } };

    async function saveNow() {
      clearTimeout(saveTimer);
      saveTimer = null;
      const result = await store.save(data);
      status.textContent = result && result.ok
        ? 'Saved, encrypted · ' + new Date().toLocaleTimeString()
        : 'Could not save: ' + ((result && result.error) || 'unknown error');
      return result;
    }

    function scheduleSave() {
      status.textContent = 'Saving…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, SAVE_DELAY);
    }

    // Saves a pending edit right away (before export, and when the window closes).
    async function flush() {
      if (saveTimer) await saveNow();
    }

    function renderList() {
      const now = Date.now();
      const shown = N.filterNotes(N.sortByUpdated(data.notes), search.value);
      list.replaceChildren(...shown.map((note) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = 'note-item' + (note.id === activeId ? ' active' : '');
        const t = document.createElement('span');
        t.className = 't';
        t.textContent = N.noteTitle(note);
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = N.formatWhen(note.updated, now);
        btn.append(t, w);
        btn.addEventListener('click', () => select(note.id));
        li.append(btn);
        return li;
      }));
      if (!shown.length) {
        const li = document.createElement('li');
        li.className = 'notes-empty';
        li.textContent = search.value.trim() ? 'No notes match.' : 'No notes yet.';
        list.append(li);
      }
    }

    function renderPreview() {
      if (preview.hidden) return;
      const note = active();
      // renderMarkdown escapes all text and emits only a fixed set of tags.
      preview.innerHTML = note ? PWMarkdown.renderMarkdown(note.body) : '';
    }

    function select(id) {
      activeId = id;
      const note = active();
      editor.value = note ? note.body : '';
      renderList();
      renderPreview();
    }

    function setPreview(on) {
      preview.hidden = !on;
      previewBtn.setAttribute('aria-pressed', String(on));
      store_(PREVIEW_KEY, on ? '1' : '0');
      renderPreview();
    }

    function addNote() {
      const note = N.createNote(Date.now(), N.makeId);
      data = { version: 1, notes: [note, ...data.notes] };
      search.value = '';
      select(note.id);
      editor.focus();
      saveNow();
    }

    editor.addEventListener('input', () => {
      if (!active()) {
        const note = N.createNote(Date.now(), N.makeId);
        data = { version: 1, notes: [note, ...data.notes] };
        activeId = note.id;
      }
      const now = Date.now();
      data = { version: 1, notes: data.notes.map((n) => (n.id === activeId ? { ...n, body: editor.value, updated: now } : n)) };
      renderList();
      renderPreview();
      scheduleSave();
    });

    deleteBtn.addEventListener('click', () => {
      const note = active();
      if (!note) return;
      if (note.body.trim() && !confirm(`Delete "${N.noteTitle(note)}"? This cannot be undone.`)) return;
      data = { version: 1, notes: data.notes.filter((n) => n.id !== note.id) };
      if (!data.notes.length) data.notes.push(N.createNote(Date.now(), N.makeId));
      select(N.sortByUpdated(data.notes)[0].id);
      saveNow();
    });

    newBtn.addEventListener('click', addNote);
    search.addEventListener('input', renderList);
    previewBtn.addEventListener('click', () => setPreview(preview.hidden));
    // Best effort: send the pending edit before the window goes away; the main process
    // waits for running saves before quitting.
    window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });

    // ---- export / import (files go through the main process; see lib/notes-export.js) ----
    const MIN_PASSWORD = 8;
    const dlg = $('#notes-dialog');
    const dlgTitle = $('#nd-title');
    const dlgSub = $('#nd-sub');
    const kindBox = $('#nd-kind');
    const passRow = $('#nd-pass-row');
    const confirmRow = $('#nd-confirm-row');
    const pass = $('#nd-pass');
    const confirmPass = $('#nd-confirm');
    const dlgError = $('#nd-error');
    const okBtn = $('#nd-ok');
    let mode = null; // 'export' | 'import'
    let importToken = null;

    const exportKind = () => root.querySelector('input[name="nd-kind"]:checked').value;

    function layoutDialog() {
      const needsPassword = mode === 'import' || exportKind() === 'pwnotes';
      kindBox.hidden = mode !== 'export';
      passRow.hidden = !needsPassword;
      confirmRow.hidden = !(mode === 'export' && needsPassword);
      pass.autocomplete = mode === 'export' ? 'new-password' : 'current-password';
    }

    function openDialog(nextMode, subtitle) {
      mode = nextMode;
      dlgTitle.textContent = mode === 'export' ? 'Export notes' : 'Import notes';
      dlgSub.textContent = subtitle || '';
      okBtn.textContent = mode === 'export' ? 'Export' : 'Import';
      pass.value = confirmPass.value = dlgError.textContent = '';
      layoutDialog();
      dlg.showModal();
      if (!passRow.hidden) pass.focus();
    }

    function closeDialog() {
      pass.value = confirmPass.value = '';
      importToken = null;
      if (dlg.open) dlg.close();
    }

    function applyImport(result) {
      data = result.data;
      select(active() ? activeId : N.sortByUpdated(data.notes)[0].id);
      status.textContent = 'Saved, encrypted · ' + new Date().toLocaleTimeString();
      onNotice(result.added
        ? `Imported ${result.added} note${result.added === 1 ? '' : 's'}.`
        : 'Nothing new to import: those notes are already here.');
    }

    async function confirmDialog() {
      dlgError.textContent = '';
      okBtn.disabled = true;
      try {
        if (mode === 'export') {
          const kind = exportKind();
          if (kind === 'pwnotes') {
            if (pass.value.length < MIN_PASSWORD) { dlgError.textContent = `Use at least ${MIN_PASSWORD} characters.`; return; }
            if (pass.value !== confirmPass.value) { dlgError.textContent = 'The passwords do not match.'; return; }
          }
          await flush();
          const result = await store.exportNotes({ kind, password: kind === 'pwnotes' ? pass.value : undefined });
          if (result && result.ok) closeDialog();
          else dlgError.textContent = (result && result.error) || 'Export failed.';
        } else {
          const result = await store.importNotes({ token: importToken, password: pass.value });
          if (result && result.ok) { closeDialog(); applyImport(result); return; }
          if (result && result.code === 'BAD_PASSWORD') { dlgError.textContent = 'Wrong password or damaged file.'; pass.select(); return; }
          closeDialog();
          onNotice('Import failed: ' + ((result && result.error) || 'unknown error'));
        }
      } finally {
        okBtn.disabled = false;
      }
    }

    async function startImport() {
      await flush();
      const picked = await store.pickImport();
      if (!picked) return;
      if (picked.kind === 'pwnotes') {
        importToken = picked.token;
        openDialog('import', `Enter the password for ${picked.name}.`);
        return;
      }
      const result = await store.importNotes({ token: picked.token });
      if (result && result.ok) applyImport(result);
      else onNotice('Import failed: ' + ((result && result.error) || 'unknown error'));
    }

    $('#notes-export').addEventListener('click', () => openDialog('export'));
    $('#notes-import').addEventListener('click', startImport);
    $('#nd-cancel').addEventListener('click', closeDialog);
    dlg.addEventListener('close', () => { pass.value = confirmPass.value = ''; });
    okBtn.addEventListener('click', confirmDialog);
    kindBox.addEventListener('change', layoutDialog);
    for (const input of [pass, confirmPass]) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmDialog(); } });
    }

    async function init() {
      editor.disabled = true;
      status.textContent = 'Opening notes…';
      setPreview(read_(PREVIEW_KEY) === '1');
      try {
        const loaded = await store.load();
        data = loaded.data;
        if (loaded.warning) onNotice(loaded.warning, { sticky: true });

        // Move the old plain-text note into the encrypted store; delete the old copy
        // only once the encrypted save has succeeded.
        const migrated = N.migrateLegacy(data, read_(LEGACY_KEY), Date.now(), N.makeId);
        if (migrated) {
          data = migrated;
          const result = await saveNow();
          if (result && result.ok) { try { localStorage.removeItem(LEGACY_KEY); } catch {} }
        } else {
          status.textContent = 'Saved, encrypted.';
        }
        if (!data.notes.length) data = { version: 1, notes: [N.createNote(Date.now(), N.makeId)] };
        select(N.sortByUpdated(data.notes)[0].id);
        editor.disabled = false;
        // Also keep the warning where the user looks for their notes.
        if (loaded.warning) status.textContent = loaded.warning;
      } catch (err) {
        status.textContent = 'Could not open notes: ' + err.message;
      }
    }

    init();
    return { flush };
  }

  return { createNotesUI };
});
