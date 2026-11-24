// Rich-text notes helpers, shared by the page, the main process and the tests.
// UMD: window.PWRichText / module.exports.
//
// Note bodies with format 'html' may only contain the allow-listed markup below.
// sanitizeHtml rebuilds any HTML from scratch with that allow-list; it is the only
// thing whose output may be assigned to innerHTML.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWRichText = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const ALLOWED = new Set([
    'p', 'div', 'br', 'h1', 'h2', 'h3', 'blockquote', 'pre',
    'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code',
  ]);
  // Removed together with everything inside them.
  const DROP = new Set([
    'script', 'style', 'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'svg', 'math',
    'img', 'picture', 'video', 'audio', 'canvas', 'head', 'title', 'meta', 'link', 'noscript',
    'input', 'button', 'select', 'option', 'textarea',
  ]);

  // Bold/italic/underline/strike expressed as inline CSS (the style itself is never kept).
  function styleFormatting(el) {
    const s = el.style || {};
    const weight = String(s.fontWeight || '').toLowerCase();
    const num = Number(weight);
    const decoration = `${s.textDecoration || ''} ${s.textDecorationLine || ''}`;
    return {
      bold: weight === 'bold' || weight === 'bolder' || num >= 600,
      notBold: weight === 'normal' || weight === 'lighter' || (num > 0 && num < 600),
      italic: s.fontStyle === 'italic' || s.fontStyle === 'oblique',
      underline: /underline/.test(decoration),
      strike: /line-through/.test(decoration),
    };
  }

  function sanitizeHtml(html, doc = typeof document !== 'undefined' ? document : null) {
    // Template content is inert: nothing in it runs or loads while we read it.
    const source = doc.createElement('template');
    source.innerHTML = String(html);
    const out = doc.createElement('div');

    (function copy(from, to) {
      for (const node of from.childNodes) {
        if (node.nodeType === 3) { to.append(doc.createTextNode(node.data)); continue; }
        if (node.nodeType !== 1) continue;
        let tag = node.localName;
        if (DROP.has(tag)) continue;
        const fmt = styleFormatting(node);
        // Google Docs wraps pastes in <b style="font-weight:normal">: not bold.
        if ((tag === 'b' || tag === 'strong') && fmt.notBold) tag = 'span';

        let target = to;
        if (ALLOWED.has(tag)) {
          const el = doc.createElement(tag);
          if (tag === 'ul' && node.getAttribute('data-type') === 'checklist') el.setAttribute('data-type', 'checklist');
          if (tag === 'li' && node.hasAttribute('data-checked')) {
            el.setAttribute('data-checked', node.getAttribute('data-checked') === 'true' ? 'true' : 'false');
          }
          to.append(el);
          target = el;
        } // else: unwrap, keep the children

        // Formatting given by inline styles (Word, Google Docs) becomes real tags.
        for (const [wanted, on] of [['b', fmt.bold], ['i', fmt.italic], ['u', fmt.underline], ['s', fmt.strike]]) {
          if (!on || tag === wanted) continue;
          const wrap = doc.createElement(wanted);
          target.append(wrap);
          target = wrap;
        }
        copy(node, target);
      }
    })(source.content, out);

    return out.innerHTML;
  }

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function decode(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return code === 160 ? ' ' : String.fromCodePoint(code);
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }

  const BLOCKS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'li', 'ul', 'ol']);

  // Plain text of a note body (no DOM needed, so the main process can use it too).
  function htmlToText(html) {
    const lines = [];
    const lists = [];
    let line = '';
    const flush = () => { if (line.trim()) lines.push(line); line = ''; };

    const tokens = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
    let m;
    while ((m = tokens.exec(String(html)))) {
      if (m[4] !== undefined) { line += decode(m[4]); continue; }
      const closing = m[1] === '/';
      const tag = m[2].toLowerCase();
      const attrs = m[3];
      if (tag === 'br') { lines.push(line); line = ''; continue; }
      if (!BLOCKS.has(tag)) continue;
      flush();
      if (closing) {
        if (tag === 'ul' || tag === 'ol') lists.pop();
        continue;
      }
      if (tag === 'ul') lists.push({ type: /data-type\s*=\s*"checklist"/.test(attrs) ? 'check' : 'ul' });
      else if (tag === 'ol') lists.push({ type: 'ol', n: 0 });
      else if (tag === 'li') {
        const list = lists[lists.length - 1] || { type: 'ul' };
        const indent = '  '.repeat(Math.max(0, lists.length - 1));
        const mark = list.type === 'ol' ? `${++list.n}. `
          : list.type === 'check' ? (/data-checked\s*=\s*"true"/.test(attrs) ? '[x] ' : '[ ] ')
          : '- ';
        line = indent + mark;
      }
    }
    flush();
    return lines.join('\n').replace(/\s+$/, '');
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

  function textToHtml(text) {
    return String(text).replace(/\r\n?/g, '\n').split('\n')
      .map((l) => (l ? `<p>${escape(l)}</p>` : '<p><br></p>')).join('');
  }

  // Old notes are Markdown; convert each one to rich text once.
  function toRichNotes(data, markdownToHtml) {
    return {
      version: 1,
      notes: data.notes.map((n) => (n.format === 'html' ? n : { ...n, body: markdownToHtml(n.body), format: 'html' })),
    };
  }

  return { sanitizeHtml, htmlToText, textToHtml, toRichNotes };
});
