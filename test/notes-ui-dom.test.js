const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// The real Notes screen markup from index.html.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const panel = html.slice(html.indexOf('<div class="panel" id="panel-notes">'), html.indexOf('<div id="ctx-menu"'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GLOBALS = ['window', 'document', 'localStorage', 'NodeFilter', 'self', 'PWRichText', 'PWNotes', 'PWMarkdown', 'PWRichEditor'];

function setup(store) {
  const { window } = new JSDOM(`<!doctype html><body>${panel}</body>`, { url: 'https://app.test/' });
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  global.NodeFilter = window.NodeFilter;
  global.self = global;
  global.PWRichText = require('../renderer/rich-text');
  global.PWNotes = require('../renderer/notes-model');
  global.PWMarkdown = require('../renderer/markdown');
  global.PWRichEditor = require('../renderer/rich-editor');
  const { createNotesUI } = require('../renderer/notes-ui');
  return { window, ui: createNotesUI({ root: window.document.getElementById('panel-notes'), store, onNotice() {} }) };
}
test.afterEach(() => { for (const k of GLOBALS) delete global[k]; });

test('append reports a failed save instead of claiming the text was added', async () => {
  const store = { load: async () => ({ data: { version: 1, notes: [] } }), save: async () => ({ ok: false, error: 'Note too large' }) };
  const { ui } = setup(store);
  const r = await ui.append(null, '<blockquote>x</blockquote>');
  assert.equal(r.ok, false);
  assert.match(r.error, /too large/);
});

test('after notes failed to open, nothing can overwrite them: no append, no new note', async () => {
  const saves = [];
  const store = { load: async () => { throw new Error('EBUSY: file is locked'); }, save: async (d) => { saves.push(d); return { ok: true }; } };
  const { window, ui } = setup(store);
  const r = await ui.append(null, '<blockquote>x</blockquote>');
  assert.equal(r.ok, false);
  ui.addNote();
  window.document.getElementById('notes-new').click();
  await sleep(10);
  assert.equal(saves.length, 0);
});

test('append to a note that is not open adds the text and saves', async () => {
  const saves = [];
  const notes = [{ id: 'n1', body: '<div>one</div>', updated: 2, format: 'html' }, { id: 'n2', body: '<div>two</div>', updated: 1, format: 'html' }];
  const store = { load: async () => ({ data: { version: 1, notes } }), save: async (d) => { saves.push(d); return { ok: true }; } };
  const { ui } = setup(store);
  const r = await ui.append('n2', '<blockquote>x</blockquote>');
  assert.equal(r.ok, true);
  assert.equal(r.id, 'n2');
  assert.equal(saves.at(-1).notes.find((n) => n.id === 'n2').body, '<div>two</div><blockquote>x</blockquote>');
});
