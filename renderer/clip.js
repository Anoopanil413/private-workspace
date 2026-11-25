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

  return { clipHtml, MAX_CLIP };
});
