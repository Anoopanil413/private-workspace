const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_BOOKMARKS, loadBookmarks, addBookmark, removeBookmark, moveBookmark, isBookmarked,
} = require('../renderer/bookmarks');

const list = () => [
  { title: 'Gmail', url: 'https://mail.google.com' },
  { title: 'Drive', url: 'https://drive.google.com' },
  { title: 'Search', url: 'https://duckduckgo.com' },
];

test('defaults are the five original quick-open links', () => {
  assert.deepEqual(DEFAULT_BOOKMARKS.map((b) => b.title), ['Gmail', 'Outlook', 'WhatsApp', 'Drive', 'Search']);
});

test('loadBookmarks returns defaults for null and for invalid JSON', () => {
  assert.deepEqual(loadBookmarks(null), DEFAULT_BOOKMARKS);
  assert.deepEqual(loadBookmarks('{not json'), DEFAULT_BOOKMARKS);
  assert.deepEqual(loadBookmarks('{"a":1}'), DEFAULT_BOOKMARKS);
});

test('loadBookmarks keeps an empty saved list (the user removed them all)', () => {
  assert.deepEqual(loadBookmarks('[]'), []);
});

test('loadBookmarks drops entries whose url is not http(s)', () => {
  const raw = JSON.stringify([{ title: 'ok', url: 'https://a.com' }, { title: 'bad', url: 'javascript:alert(1)' }, { url: 5 }]);
  assert.deepEqual(loadBookmarks(raw), [{ title: 'ok', url: 'https://a.com' }]);
});

test('addBookmark appends and ignores a url already present', () => {
  const added = addBookmark(list(), { title: 'Slack', url: 'https://app.slack.com/client' });
  assert.equal(added.length, 4);
  assert.equal(added[3].title, 'Slack');
  assert.equal(addBookmark(list(), { title: 'Again', url: 'https://drive.google.com' }).length, 3);
});

test('addBookmark trims the title to 40 characters and falls back to the host name', () => {
  assert.equal(addBookmark([], { title: 'x'.repeat(50), url: 'https://a.com' })[0].title.length, 40);
  assert.equal(addBookmark([], { title: '   ', url: 'https://news.example.com/a' })[0].title, 'news.example.com');
});

test('addBookmark rejects non-web urls and returns the list unchanged', () => {
  const before = list();
  assert.deepEqual(addBookmark(before, { title: 'x', url: 'javascript:alert(1)' }), before);
  assert.deepEqual(addBookmark(before, { title: 'x', url: 'file:///C:/x' }), before);
});

test('removeBookmark removes by url and does not change its input', () => {
  const before = list();
  assert.deepEqual(removeBookmark(before, 'https://drive.google.com').map((b) => b.title), ['Gmail', 'Search']);
  assert.equal(before.length, 3);
});

test('moveBookmark(list, 0, 2) moves the first item to index 2', () => {
  assert.deepEqual(moveBookmark(list(), 0, 2).map((b) => b.title), ['Drive', 'Search', 'Gmail']);
  assert.deepEqual(moveBookmark(list(), 2, 0).map((b) => b.title), ['Search', 'Gmail', 'Drive']);
});

test('isBookmarked matches the url exactly', () => {
  assert.equal(isBookmarked(list(), 'https://drive.google.com'), true);
  assert.equal(isBookmarked(list(), 'https://drive.google.com/x'), false);
});

test('isBookmarked and addBookmark treat "https://site.com" and "https://site.com/" as the same page', () => {
  assert.equal(isBookmarked(list(), 'https://duckduckgo.com/'), true);
  assert.equal(addBookmark(list(), { title: 'x', url: 'https://duckduckgo.com/' }).length, 3);
  assert.deepEqual(removeBookmark(list(), 'https://duckduckgo.com/').map((b) => b.title), ['Gmail', 'Drive']);
});
