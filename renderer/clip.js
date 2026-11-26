// Selected page text as a note fragment: the text as a quote, then where it came from.
// Plain text only (escaped), so it passes PWRichText.sanitizeHtml unchanged; notes
// don't keep links, so the page's address is written out as text.
// UMD: window.PWClip / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWClip = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_CLIP = 20000;
  // Text content only (never attributes), escaped the way the browser serializes text,
  // so the sanitizer's output is byte-for-byte the same.
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
  const escape = (s) => String(s).replace(/[&<>]/g, (c) => ESC[c]);

  // example.com/path, without scheme, query or hash; the host alone for a home page.
  function shortUrl(url) {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return '';
      return u.hostname + (u.pathname === '/' ? '' : u.pathname);
    } catch { return ''; }
  }

  function clipHtml({ text, title, url }) {
    let t = String(text || '').replace(/\r\n?/g, '\n');
    if (!t.trim()) return '';
    if (t.length > MAX_CLIP) t = `${t.slice(0, MAX_CLIP)}…`;
    const source = [String(title || '').trim(), shortUrl(url)].filter(Boolean).join(' · ');
    const quote = `<blockquote>${escape(t).replace(/\n/g, '<br>')}</blockquote>`;
    return source ? `${quote}<div>— ${escape(source)}</div>` : quote;
  }

  // Which text to clip: the page's own selection (complete; Chromium may shorten the
  // menu's copy of a long one) only when it is the text that was right-clicked. Text
  // selected inside a frame isn't the page's selection, so the menu's copy is used.
  const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  function pickSelection(full, fromMenu) {
    const f = squash(full);
    const m = squash(fromMenu);
    return f && m && f.startsWith(m) ? full : fromMenu;
  }

  return { clipHtml, pickSelection, MAX_CLIP };
});
