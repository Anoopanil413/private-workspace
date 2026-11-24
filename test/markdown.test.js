const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMarkdown } = require('../renderer/markdown');

test('escapes HTML so notes can never run script', () => {
  assert.equal(renderMarkdown('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
  assert.equal(renderMarkdown('<img src=x onerror="alert(1)">'), '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
});

test('headings level 1 to 3', () => {
  assert.equal(renderMarkdown('# Hi'), '<h1>Hi</h1>');
  assert.equal(renderMarkdown('### Small'), '<h3>Small</h3>');
});

test('bold and italic', () => {
  assert.equal(renderMarkdown('**b** and *i*'), '<p><strong>b</strong> and <em>i</em></p>');
});

test('unordered and ordered lists', () => {
  assert.equal(renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(renderMarkdown('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
});

test('inline code is escaped and not formatted', () => {
  assert.equal(renderMarkdown('`x<y`'), '<p><code>x&lt;y</code></p>');
  assert.equal(renderMarkdown('`**not bold**`'), '<p><code>**not bold**</code></p>');
});

test('links render as their text only, never as a link', () => {
  assert.equal(renderMarkdown('[t](javascript:alert(1))'), '<p>t</p>');
  assert.equal(renderMarkdown('see [site](https://example.com)'), '<p>see site</p>');
});

test('fenced code block keeps lines and escapes them', () => {
  assert.equal(renderMarkdown('```\na < b\n**x**\n```'), '<pre><code>a &lt; b\n**x**</code></pre>');
});

test('quote, paragraphs and line breaks', () => {
  assert.equal(renderMarkdown('> quoted'), '<blockquote>quoted</blockquote>');
  assert.equal(renderMarkdown('line 1\nline 2\n\nnext'), '<p>line 1<br>line 2</p><p>next</p>');
});

test('empty input renders nothing', () => {
  assert.equal(renderMarkdown(''), '');
});
