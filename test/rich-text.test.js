const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { sanitizeHtml, htmlToText, textToHtml, toRichNotes } = require('../renderer/rich-text');
const { renderMarkdown } = require('../renderer/markdown');

const doc = new JSDOM('<!doctype html><body></body>').window.document;
const clean = (html) => sanitizeHtml(html, doc);

test('sanitizeHtml keeps allowed formatting', () => {
  const html = '<p><b>a</b> <u>b</u> <s>c</s> <code>d</code> <i>e</i> <strong>f</strong> <em>g</em></p>';
  assert.equal(clean(html), html);
  assert.equal(clean('<ol><li>one</li></ol><ul><li>two<ul><li>nested</li></ul></li></ul>'),
    '<ol><li>one</li></ol><ul><li>two<ul><li>nested</li></ul></li></ul>');
  assert.equal(clean('<h1>T</h1><blockquote>q</blockquote><pre>x</pre><div>d<br></div>'),
    '<h1>T</h1><blockquote>q</blockquote><pre>x</pre><div>d<br></div>');
});

test('sanitizeHtml drops script/img/svg/iframe with their content and strips event and style attributes', () => {
  const evil = '<p onclick="x" style="color:red">hi<img src=x onerror=alert(1)><script>alert(1)</script>'
    + '<svg><a href="javascript:1">s</a></svg><iframe src="https://x"></iframe><style>p{}</style></p>';
  assert.equal(clean(evil), '<p>hi</p>');
});

test('sanitizeHtml unwraps unknown tags but keeps their (escaped) text', () => {
  assert.equal(clean('<span style="font:x"><a href="https://x">link</a></span>'), 'link');
  assert.equal(clean('<font color=red>a &lt;b&gt;</font>'), 'a &lt;b&gt;');
  assert.equal(clean('<table><tr><td>cell</td></tr></table>'), 'cell');
});

test('sanitizeHtml keeps checklist attributes only on ul/li, with fixed values', () => {
  assert.equal(
    clean('<ul data-type="checklist" class="x"><li data-checked="true" id="y">done</li><li data-checked="nope">todo</li></ul>'),
    '<ul data-type="checklist"><li data-checked="true">done</li><li data-checked="false">todo</li></ul>');
  assert.equal(clean('<p data-type="checklist" data-checked="true">p</p>'), '<p>p</p>');
  assert.equal(clean('<ul data-type="evil"><li>x</li></ul>'), '<ul><li>x</li></ul>');
});

test('sanitizeHtml handles empty and plain-text input', () => {
  assert.equal(clean(''), '');
  assert.equal(clean('just text'), 'just text');
});

test('htmlToText renders paragraphs, lists, checklists, nesting and entities', () => {
  const html = '<h1>Plan</h1><p>A &amp; B&nbsp;&lt;ok&gt; &#169;</p>'
    + '<ol><li>first</li><li>second</li></ol>'
    + '<ul><li>top<ul><li>inner</li></ul></li></ul>'
    + '<ul data-type="checklist"><li data-checked="true">done</li><li data-checked="false">todo</li></ul>'
    + '<p>line<br>break</p>';
  assert.equal(htmlToText(html),
    'Plan\nA & B <ok> ©\n1. first\n2. second\n- top\n  - inner\n[x] done\n[ ] todo\nline\nbreak');
});

test('htmlToText of an empty note is empty', () => {
  assert.equal(htmlToText(''), '');
  assert.equal(htmlToText('<p><br></p>'), '');
});

test('textToHtml escapes and keeps lines', () => {
  assert.equal(textToHtml('a <b>\n\nc & d'), '<p>a &lt;b&gt;</p><p><br></p><p>c &amp; d</p>');
});

test('toRichNotes converts markdown notes once and leaves html notes alone', () => {
  const data = {
    version: 1,
    notes: [
      { id: 'md', body: '# Title\n- **x**', updated: 1 },
      { id: 'html', body: '<p><u>kept</u></p>', updated: 2, format: 'html' },
    ],
  };
  const md = (s) => clean(renderMarkdown(s));
  const out = toRichNotes(data, md);
  assert.deepEqual(out.notes[0], { id: 'md', body: '<h1>Title</h1><ul><li><strong>x</strong></li></ul>', updated: 1, format: 'html' });
  assert.deepEqual(out.notes[1], data.notes[1]);
  assert.deepEqual(toRichNotes(out, md), out);
});

test('pasted styles become tags: bold/italic/underline/strike spans keep their formatting', () => {
  assert.equal(clean('<span style="font-weight:700">B</span><span style="font-style:italic">I</span>'
    + '<span style="text-decoration:underline">U</span><span style="text-decoration:line-through">S</span>'),
  '<b>B</b><i>I</i><u>U</u><s>S</s>');
  assert.equal(clean('<span style="font-weight:bold;font-style:italic">BI</span>'), '<b><i>BI</i></b>');
});

test('a <b> whose style says font-weight normal (Google Docs paste wrapper) is not bold', () => {
  assert.equal(clean('<b style="font-weight:normal;" id="docs-internal-guid-1"><p>Para</p></b>'), '<p>Para</p>');
  assert.equal(clean('<strong style="font-weight:400">x</strong>'), 'x');
});

test('line-break whitespace between blocks (pasted HTML formatting) is dropped; spaces between words are kept', () => {
  assert.equal(clean('\r\n<p>a</p>\n\n<p>b</p>\r\n'), '<p>a</p><p>b</p>');
  assert.equal(clean('<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(clean('<p><b>a</b> <i>b</i></p>'), '<p><b>a</b> <i>b</i></p>');
  assert.equal(clean('<pre>x\n\ny</pre>'), '<pre>x\n\ny</pre>');
  assert.equal(clean('<p>line one\nline two</p>'), '<p>line one\nline two</p>');
});

test('a line break between two inline words becomes a space, not nothing', () => {
  assert.equal(clean('<p><b>a</b>\n<i>b</i></p>'), '<p><b>a</b> <i>b</i></p>');
});
