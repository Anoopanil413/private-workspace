const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createNotesStore, validateNotes } = require('../lib/notes-store');

// Stand-in for Electron's safeStorage: reversible, and the stored bytes never
// contain the plain text.
function fakeCipher({ available = true } = {}) {
  return {
    isAvailable: () => available,
    encrypt: (s) => Buffer.from([...Buffer.from(s, 'utf8').toString('base64')].reverse().join(''), 'utf8'),
    decrypt: (b) => {
      const text = Buffer.from([...b.toString('utf8')].reverse().join(''), 'base64').toString('utf8');
      if (!text.startsWith('{')) throw new Error('Decryption failed');
      return text;
    },
  };
}

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-notes-'));
  return path.join(dir, 'notes.enc');
}

const sample = () => ({
  version: 1,
  notes: [{ id: 'a1', body: 'Call landlord re deposit', updated: 1700000000000 }],
});

test('save then load returns the same data', async () => {
  const store = createNotesStore({ file: tempFile(), cipher: fakeCipher() });
  await store.save(sample());
  const { data, warning } = await store.load();
  assert.deepEqual(data, sample());
  assert.equal(warning, null);
});

test('file on disk does not contain the note text', async () => {
  const file = tempFile();
  await createNotesStore({ file, cipher: fakeCipher() }).save(sample());
  assert.ok(!fs.readFileSync(file, 'utf8').includes('landlord'));
});

test('missing file loads as empty notes with no warning', async () => {
  const { data, warning } = await createNotesStore({ file: tempFile(), cipher: fakeCipher() }).load();
  assert.deepEqual(data, { version: 1, notes: [] });
  assert.equal(warning, null);
});

test('undecryptable file is moved aside, not overwritten, and load warns', async () => {
  const file = tempFile();
  fs.writeFileSync(file, 'garbage bytes from another account');
  const store = createNotesStore({ file, cipher: fakeCipher(), now: () => 1234 });
  const { data, warning } = await store.load();
  assert.deepEqual(data, { version: 1, notes: [] });
  assert.match(warning, /could not be read/);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync(`${file}.corrupt-1234`, 'utf8'), 'garbage bytes from another account');
});

test('load leaves the file alone when encryption is unavailable', async () => {
  const file = tempFile();
  fs.writeFileSync(file, 'encrypted bytes');
  const { data, warning } = await createNotesStore({ file, cipher: fakeCipher({ available: false }) }).load();
  assert.deepEqual(data, { version: 1, notes: [] });
  assert.match(warning, /Encryption is unavailable/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'encrypted bytes');
});

test('save throws and writes nothing when encryption is unavailable', async () => {
  const file = tempFile();
  const store = createNotesStore({ file, cipher: fakeCipher({ available: false }) });
  await assert.rejects(store.save(sample()), /Encryption unavailable/);
  assert.equal(fs.existsSync(file), false);
});

test('no .tmp file remains after save', async () => {
  const file = tempFile();
  await createNotesStore({ file, cipher: fakeCipher() }).save(sample());
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['notes.enc']);
});

test('overlapping saves end with the last data written', async () => {
  const file = tempFile();
  const store = createNotesStore({ file, cipher: fakeCipher() });
  const later = { version: 1, notes: [{ id: 'a1', body: 'second', updated: 2 }] };
  await Promise.all([store.save(sample()), store.save(later)]);
  assert.deepEqual((await store.load()).data, later);
});

test('validateNotes rejects a note without a string body', () => {
  assert.throws(() => validateNotes({ version: 1, notes: [{ id: 'a', body: 5, updated: 1 }] }), TypeError);
});

test('validateNotes rejects more than 2000 notes and oversized bodies', () => {
  const many = Array.from({ length: 2001 }, (_, i) => ({ id: String(i), body: '', updated: 1 }));
  assert.throws(() => validateNotes({ version: 1, notes: many }), TypeError);
  assert.throws(() => validateNotes({ version: 1, notes: [{ id: 'a', body: 'x'.repeat(1_000_001), updated: 1 }] }), TypeError);
});

test('validateNotes drops unknown fields', () => {
  const clean = validateNotes({ version: 1, extra: true, notes: [{ id: 'a', body: 'b', updated: 1, html: '<b>' }] });
  assert.deepEqual(clean, { version: 1, notes: [{ id: 'a', body: 'b', updated: 1 }] });
});

test('whenIdle resolves only after pending saves are written', async () => {
  const file = tempFile();
  const store = createNotesStore({ file, cipher: fakeCipher() });
  store.save(sample());
  await store.whenIdle();
  assert.ok(fs.existsSync(file));
});

test('validateNotes keeps format "html" and drops other format values', () => {
  const clean = validateNotes({ version: 1, notes: [
    { id: 'a', body: '<p>x</p>', updated: 1, format: 'html' },
    { id: 'b', body: 'y', updated: 1, format: 'evil' },
  ] });
  assert.deepEqual(clean.notes, [
    { id: 'a', body: '<p>x</p>', updated: 1, format: 'html' },
    { id: 'b', body: 'y', updated: 1 },
  ]);
});
