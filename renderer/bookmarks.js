// Editable quick-open bookmarks: pure list helpers (tested under Node) plus the bar UI.
// Bookmark = { title: string, url: string }. Every helper returns a new array.
// UMD: window.PWBookmarks / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWBookmarks = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const STORAGE_KEY = 'bookmarks';
  const MAX_TITLE = 40;
  const DEFAULT_BOOKMARKS = [
    { title: 'Gmail', url: 'https://mail.google.com' },
    { title: 'Outlook', url: 'https://outlook.live.com' },
    { title: 'WhatsApp', url: 'https://web.whatsapp.com' },
    { title: 'Drive', url: 'https://drive.google.com' },
    { title: 'Search', url: 'https://duckduckgo.com' },
  ];

  // "https://site.com" and "https://site.com/" are the same page.
  function normalize(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
    } catch { return null; }
  }

  const copyDefaults = () => DEFAULT_BOOKMARKS.map((b) => ({ ...b }));

  function loadBookmarks(raw) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return copyDefaults(); }
    if (!Array.isArray(parsed)) return copyDefaults();
    return parsed
      .filter((b) => b && typeof b.url === 'string' && normalize(b.url) && typeof b.title === 'string')
      .map((b) => ({ title: b.title.slice(0, MAX_TITLE), url: b.url }));
  }

  const isBookmarked = (list, url) => {
    const key = normalize(url);
    return key !== null && list.some((b) => normalize(b.url) === key);
  };

  function addBookmark(list, { title, url }) {
    const key = normalize(url);
    if (!key || isBookmarked(list, url)) return list;
    const name = String(title || '').trim() || new URL(key).hostname;
    return [...list, { title: name.slice(0, MAX_TITLE), url }];
  }

  const removeBookmark = (list, url) => list.filter((b) => normalize(b.url) !== normalize(url));

  function moveBookmark(list, from, to) {
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  // The quick-open bar: chips that open in the active tab, × to remove, drag to
  // reorder, and a star button that adds/removes the current page.
  function createBookmarksBar({ bar, star, getCurrent, onOpen }) {
    let list;
    try { list = loadBookmarks(localStorage.getItem(STORAGE_KEY)); } catch { list = copyDefaults(); }
    let dragFrom = null;

    function persist() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
    }

    function paintStar() {
      const cur = getCurrent();
      const on = !!cur && isBookmarked(list, cur.url);
      star.textContent = on ? '★' : '☆';
      star.title = on ? 'Remove this page from quick open' : 'Add this page to quick open';
      star.setAttribute('aria-pressed', String(on));
      star.disabled = !cur || !normalize(cur.url);
    }

    function render() {
      const label = document.createElement('span');
      label.textContent = 'Quick open:';
      const chips = list.map((b, i) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.draggable = true;
        chip.title = b.url;
        const open = document.createElement('a');
        open.href = '#';
        open.textContent = b.title;
        open.addEventListener('click', (e) => { e.preventDefault(); onOpen(b.url); });
        const x = document.createElement('button');
        x.className = 'chip-x';
        x.title = `Remove ${b.title}`;
        x.textContent = '×';
        x.addEventListener('click', () => update(removeBookmark(list, b.url)));
        chip.append(open, x);
        chip.addEventListener('dragstart', (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; chip.classList.add('dragging'); });
        chip.addEventListener('dragend', () => { dragFrom = null; chip.classList.remove('dragging'); });
        chip.addEventListener('dragover', (e) => { if (dragFrom !== null) { e.preventDefault(); chip.classList.add('drop'); } });
        chip.addEventListener('dragleave', () => chip.classList.remove('drop'));
        chip.addEventListener('drop', (e) => {
          e.preventDefault();
          chip.classList.remove('drop');
          if (dragFrom !== null && dragFrom !== i) update(moveBookmark(list, dragFrom, i));
        });
        return chip;
      });
      const nodes = [label, ...chips];
      if (!list.length) {
        const hint = document.createElement('span');
        hint.className = 'chip-hint';
        hint.textContent = 'Press ☆ to add the current page.';
        nodes.push(hint);
      }
      bar.replaceChildren(...nodes);
      paintStar();
    }

    function update(next) {
      list = next;
      persist();
      render();
    }

    star.addEventListener('click', () => {
      const cur = getCurrent();
      if (!cur) return;
      update(isBookmarked(list, cur.url) ? removeBookmark(list, cur.url) : addBookmark(list, cur));
    });

    render();
    return { refresh: paintStar };
  }

  return {
    DEFAULT_BOOKMARKS, loadBookmarks, addBookmark, removeBookmark, moveBookmark, isBookmarked, createBookmarksBar,
  };
});
