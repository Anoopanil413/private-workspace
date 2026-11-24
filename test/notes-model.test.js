const test = require('node:test');
const assert = require('node:assert/strict');
const {
  migrateLegacy, makeId, noteTitle, filterNotes, createNote, sortByUpdated, formatWhen,
} = require('../renderer/notes-model');

const empty = () => ({ version: 1, notes: [] });

test('migrateLegacy turns old text into the first note when the store is empty', () => {
  const result = migrateLegacy(empty(), 'old notes\nline 2', 42, () => 'id-1');
  assert.deepEqual(result, { version: 1, notes: [{ id: 'id-1', body: 'old notes\nline 2', updated: 42 }] });
});

test('migrateLegacy returns null when the store already has notes', () => {
  const data = { version: 1, notes: [{ id: 'x', body: 'kept', updated: 1 }] };
  assert.equal(migrateLegacy(data, 'old notes', 42, () => 'id-1'), null);
});

test('migrateLegacy returns null for missing, empty or whitespace-only old text', () => {
  for (const legacy of [null, '', '  \n\t ']) {
    assert.equal(migrateLegacy(empty(), legacy, 42, () => 'id-1'), null);
  }
});

test('makeId returns a different non-empty string each call', () => {
  const a = makeId();
  assert.equal(typeof a, 'string');
  assert.ok(a.length > 0);
  assert.notEqual(a, makeId());
});

test('noteTitle uses the first non-empty line without heading marks', () => {
  assert.equal(noteTitle({ body: '\n\n## Interview prep\nmore' }), 'Interview prep');
});

test('noteTitle is Untitled for an empty note and cut to 60 characters', () => {
  assert.equal(noteTitle({ body: '   \n ' }), 'Untitled');
  assert.equal(noteTitle({ body: 'x'.repeat(80) }).length, 60);
});

test('filterNotes matches the body case-insensitively; empty query returns all', () => {
  const notes = [{ id: 'a', body: 'Salary range', updated: 1 }, { id: 'b', body: 'Shopping', updated: 2 }];
  assert.deepEqual(filterNotes(notes, 'SALARY').map((n) => n.id), ['a']);
  assert.deepEqual(filterNotes(notes, '  ').map((n) => n.id), ['a', 'b']);
});

test('sortByUpdated puts the newest first without changing its input', () => {
  const notes = [{ id: 'old', body: '', updated: 1 }, { id: 'new', body: '', updated: 9 }];
  assert.deepEqual(sortByUpdated(notes).map((n) => n.id), ['new', 'old']);
  assert.deepEqual(notes.map((n) => n.id), ['old', 'new']);
});

test('createNote makes an empty note stamped with the given time', () => {
  assert.deepEqual(createNote(5, () => 'id-9'), { id: 'id-9', body: '', updated: 5 });
});

test('formatWhen gives short relative times', () => {
  const now = new Date(2026, 10, 24, 12, 0).getTime();
  assert.equal(formatWhen(now - 20_000, now), 'Just now');
  assert.equal(formatWhen(now - 5 * 60_000, now), '5 min ago');
  assert.equal(formatWhen(new Date(2026, 10, 24, 9, 5).getTime(), now), 'Today');
  assert.equal(formatWhen(new Date(2026, 10, 23, 18, 0).getTime(), now), 'Yesterday');
});

test('noteTitle and filterNotes use the text of html notes, not the tags', () => {
  const html = { id: 'h', body: '<h1>Interview <strong>prep</strong></h1><p>salary</p>', updated: 1, format: 'html' };
  assert.equal(noteTitle(html), 'Interview prep');
  assert.deepEqual(filterNotes([html], 'strong'), []);
  assert.deepEqual(filterNotes([html], 'interview prep').map((n) => n.id), ['h']);
});
