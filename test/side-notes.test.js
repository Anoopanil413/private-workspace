const test = require('node:test');
const assert = require('node:assert/strict');
const { clampSideWidth } = require('../renderer/side-notes');

test('clampSideWidth keeps the wanted width when it fits', () => {
  assert.equal(clampSideWidth(360, 1200), 360);
});

test('clampSideWidth never goes below 260 px', () => {
  assert.equal(clampSideWidth(100, 1200), 260);
});

test('clampSideWidth caps the panel at 60 % of the browser area', () => {
  assert.equal(clampSideWidth(900, 1200), 720);
});

test('clampSideWidth leaves the page at least 320 px', () => {
  assert.equal(clampSideWidth(500, 700), 380);
});

test('clampSideWidth hides the panel when the browser area is under 580 px', () => {
  assert.equal(clampSideWidth(360, 579), 0);
});

test('with no room for the panel, it does not count as shown: 📝 not pressed, no "Add to" that note', () => {
  const { JSDOM } = require('jsdom');
  const { window } = new JSDOM(`<!doctype html><body><div id="area"><aside id="panel" hidden><div id="div"></div>
    <button id="pick"><span id="title"></span></button><button id="new"></button><button id="close"></button><div id="body"></div></aside>
    <div id="shield" hidden></div></div><button id="btn"></button></body>`, { url: 'https://app.test/' });
  global.window = window; global.document = window.document; global.localStorage = window.localStorage;
  try {
    const { createSideNotes } = require('../renderer/side-notes');
    const $ = (id) => window.document.getElementById(id);
    let width = 1200;
    Object.defineProperty($('area'), 'clientWidth', { get: () => width });
    const notices = [];
    const notesUI = { mountInto() {}, activeNote: () => ({ id: 'n1', title: 'T' }), focus() {}, focusSearch() {}, addNote() {}, onListChange() {} };
    const side = createSideNotes({ area: $('area'), panel: $('panel'), divider: $('div'), body: $('body'), pickBtn: $('pick'), titleEl: $('title'),
      newBtn: $('new'), closeBtn: $('close'), button: $('btn'), shield: $('shield'), notesUI, isBrowserShown: () => true, onNotice: (t) => notices.push(t) });
    side.toggle();
    assert.equal(side.isShown(), true);
    assert.equal($('btn').getAttribute('aria-pressed'), 'true');
    width = 500;
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(side.isShown(), false);
    assert.equal($('btn').getAttribute('aria-pressed'), 'false');
    $('btn').click(); // asks for room instead of silently closing
    assert.equal(side.isOpen(), true);
    assert.match(notices[0], /wider/);
    width = 1200;
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(side.isShown(), true);
  } finally {
    delete global.window; delete global.document; delete global.localStorage;
  }
});

test('clampSideWidth survives a missing or broken saved width', () => {
  assert.equal(clampSideWidth(NaN, 1200), 360);
  assert.equal(clampSideWidth(undefined, 1200), 360);
});
