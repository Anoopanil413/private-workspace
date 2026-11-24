const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  encryptExport, decryptExport, toText, mergeNotes, uniqueFile, textToNotes,
} = require('../lib/notes-export');

const data = () => ({
  version: 1,
  notes: [
    { id: 'a', body: '# Interview prep\nsalary 18', updated: 2 },
    { id: 'b', body: 'Shopping', updated: 1 },
  ],
});
const PASSWORD = 'correct horse';
let counter = 0;
const nextId = () => `new-${++counter}`;

test('encrypt then decrypt round-trips the data', async () => {
  const buf = await encryptExport(data(), PASSWORD);
  assert.ok(!buf.toString('utf8').includes('Interview'));
  assert.deepEqual(await decryptExport(buf, PASSWORD), data());
});

test('wrong password rejects with code BAD_PASSWORD', async () => {
  const buf = await encryptExport(data(), PASSWORD);
  await assert.rejects(decryptExport(buf, 'wrong password'), { code: 'BAD_PASSWORD' });
});

test('a changed byte in the ciphertext rejects with BAD_PASSWORD', async () => {
  const file = JSON.parse((await encryptExport(data(), PASSWORD)).toString('utf8'));
  const ct = Buffer.from(file.ct, 'base64');
  ct[0] ^= 0xff;
  file.ct = ct.toString('base64');
  await assert.rejects(decryptExport(Buffer.from(JSON.stringify(file)), PASSWORD), { code: 'BAD_PASSWORD' });
});

test('garbage input rejects with BAD_FORMAT', async () => {
  await assert.rejects(decryptExport(Buffer.from('not json at all'), PASSWORD), { code: 'BAD_FORMAT' });
  await assert.rejects(decryptExport(Buffer.from('{"format":"other"}'), PASSWORD), { code: 'BAD_FORMAT' });
});

test('absurd scrypt cost in the file rejects with BAD_FORMAT instead of hanging', async () => {
  const file = JSON.parse((await encryptExport(data(), PASSWORD)).toString('utf8'));
  file.kdf.N = 2 ** 30;
  await assert.rejects(decryptExport(Buffer.from(JSON.stringify(file)), PASSWORD), { code: 'BAD_FORMAT' });
});

test('a password of 7 characters rejects with WEAK_PASSWORD', async () => {
  await assert.rejects(encryptExport(data(), '1234567'), { code: 'WEAK_PASSWORD' });
});

test('toText joins note bodies with a separator line', () => {
  assert.equal(toText(data()), '# Interview prep\nsalary 18\n\n---\n\nShopping');
});

test('mergeNotes skips identical notes, re-ids conflicting ones and counts added', () => {
  const existing = data();
  const incoming = [
    { id: 'a', body: '# Interview prep\nsalary 18', updated: 2 }, // identical: skipped
    { id: 'b', body: 'Shopping list v2', updated: 5 },           // id clash: new id
    { id: 'c', body: 'Brand new', updated: 6 },                   // added as is
  ];
  const { data: merged, added } = mergeNotes(existing, incoming, () => 'fresh');
  assert.equal(added, 2);
  assert.deepEqual(merged.notes.map((n) => n.id), ['a', 'b', 'fresh', 'c']);
  assert.equal(merged.notes[2].body, 'Shopping list v2');
});

test('mergeNotes skips a note whose text already exists under another id', () => {
  const { added } = mergeNotes(data(), [{ id: 'zzz', body: 'Shopping', updated: 9 }], nextId);
  assert.equal(added, 0);
});

test('textToNotes makes one note per non-empty file', () => {
  const notes = textToNotes([{ name: 'a.md', text: '# A' }, { name: 'empty.txt', text: '  \n' }], 7, () => 'id-x');
  assert.deepEqual(notes, [{ id: 'id-x', body: '# A', updated: 7 }]);
});

test('uniqueFile picks "notes (1).pwnotes" when "notes.pwnotes" exists', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-export-'));
  assert.equal(await uniqueFile(dir, 'notes', 'pwnotes'), path.join(dir, 'notes.pwnotes'));
  fs.writeFileSync(path.join(dir, 'notes.pwnotes'), '');
  assert.equal(await uniqueFile(dir, 'notes', 'pwnotes'), path.join(dir, 'notes (1).pwnotes'));
});
