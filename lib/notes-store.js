// Notes saved to one file, encrypted with a cipher supplied by the caller (in the app:
// Electron safeStorage, i.e. Windows DPAPI, tied to the signed-in Windows account).
//
// NotesData = { version: 1, notes: [{ id: string, body: string, updated: number, format?: 'html' }] }
// body is sanitized HTML when format is 'html', Markdown text otherwise (notes from older versions).
const fs = require('fs');

const MAX_NOTES = 2000;
const MAX_BODY = 1_000_000;

const emptyNotes = () => ({ version: 1, notes: [] });

// Returns a clean copy holding only the known fields; throws TypeError on a bad shape.
function validateNotes(data) {
  if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.notes)) {
    throw new TypeError('Notes must be { version: 1, notes: [] }');
  }
  if (data.notes.length > MAX_NOTES) throw new TypeError(`At most ${MAX_NOTES} notes are allowed`);
  return {
    version: 1,
    notes: data.notes.map((n, i) => {
      if (!n || typeof n.id !== 'string' || !n.id) throw new TypeError(`Note ${i} has no id`);
      if (typeof n.body !== 'string') throw new TypeError(`Note ${i} has no text`);
      if (n.body.length > MAX_BODY) throw new TypeError(`Note ${i} is too long`);
      if (!Number.isFinite(n.updated)) throw new TypeError(`Note ${i} has no time`);
      const note = { id: n.id, body: n.body, updated: n.updated };
      if (n.format === 'html') note.format = 'html'; // rich text; otherwise Markdown (older notes)
      return note;
    }),
  };
}

function createNotesStore({ file, cipher, now = Date.now }) {
  // Saves run one after another so two writes never share the .tmp file.
  let queue = Promise.resolve();

  async function load() {
    let bytes;
    try {
      bytes = await fs.promises.readFile(file);
    } catch (err) {
      if (err.code === 'ENOENT') return { data: emptyNotes(), warning: null };
      throw err;
    }
    if (!cipher.isAvailable()) {
      return { data: emptyNotes(), warning: 'Encryption is unavailable, so your notes cannot be opened right now.' };
    }
    try {
      return { data: validateNotes(JSON.parse(cipher.decrypt(bytes))), warning: null };
    } catch {
      // Never overwrite notes we cannot read (another Windows account, corruption):
      // move them aside and start empty.
      const aside = `${file}.corrupt-${now()}`;
      await fs.promises.rename(file, aside);
      return { data: emptyNotes(), warning: `Your saved notes could not be read and were moved to ${aside}.` };
    }
  }

  function save(data) {
    const run = queue.then(async () => {
      const clean = validateNotes(data);
      if (!cipher.isAvailable()) throw new Error('Encryption unavailable: notes were not saved.');
      const tmp = `${file}.tmp`;
      await fs.promises.writeFile(tmp, cipher.encrypt(JSON.stringify(clean)));
      await fs.promises.rename(tmp, file);
    });
    queue = run.catch(() => {});
    return run;
  }

  // Resolves once every save started so far has finished (used before quitting).
  const whenIdle = () => queue;

  return { load, save, whenIdle };
}

module.exports = { createNotesStore, validateNotes, emptyNotes };
