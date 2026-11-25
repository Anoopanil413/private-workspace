const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { clipHtml, MAX_CLIP } = require('../renderer/clip');
const { sanitizeHtml } = require('../renderer/rich-text');

const doc = new JSDOM('<!doctype html><body></body>').window.document;

test('clipHtml quotes the text and names the page it came from', () => {
  assert.equal(
    clipHtml({ text: 'Interviews are on 3 Dec.', title: 'Jobs', url: 'https://careers.example.com/a' }),
    '<blockquote>Interviews are on 3 Dec.</blockquote><div>— Jobs · careers.example.com/a</div>',
  );
});

test('clipHtml shows only the host for a home page, drops query and hash, and skips a missing title', () => {
  assert.equal(
    clipHtml({ text: 'x', title: '', url: 'https://example.com/?utm=1#top' }),
    '<blockquote>x</blockquote><div>— example.com</div>',
  );
  assert.equal(clipHtml({ text: 'x', title: 'T', url: 'not a url' }), '<blockquote>x</blockquote><div>— T</div>');
});

test('clipHtml keeps line breaks', () => {
  assert.equal(clipHtml({ text: 'one\r\ntwo\nthree', title: 'T', url: 'https://e.com/' }),
    '<blockquote>one<br>two<br>three</blockquote><div>— T · e.com</div>');
});

test('clipHtml escapes text that looks like HTML, and the sanitizer keeps it as is', () => {
  const html = clipHtml({ text: '<img src=x onerror=alert(1)> & "q"', title: '<b>T</b>', url: 'https://e.com/p' });
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; '));
  assert.equal(sanitizeHtml(html, doc), html);
});

test('clipHtml cuts very long selections', () => {
  const html = clipHtml({ text: 'a'.repeat(25000), title: 'T', url: 'https://e.com/' });
  assert.equal(MAX_CLIP, 20000);
  assert.ok(html.startsWith(`<blockquote>${'a'.repeat(20000)}…</blockquote>`));
});

test('clipHtml gives nothing for an empty selection', () => {
  assert.equal(clipHtml({ text: '', title: 'T', url: 'https://e.com/' }), '');
  assert.equal(clipHtml({ text: '  \n ', title: 'T', url: 'https://e.com/' }), '');
});
