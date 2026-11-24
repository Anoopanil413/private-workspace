// Small, safe Markdown subset for the notes preview. Everything is HTML-escaped
// before any formatting, and links render as plain text (no <a>), so a note can
// never inject markup or navigate the host page. UMD: window.PWMarkdown / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWMarkdown = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

  function inline(text) {
    const codes = [];
    // NUL is used as a placeholder marker, so it may not appear in the text itself.
    let s = text.replace(/\u0000/g, '').replace(/`([^`]+)`/g, (_m, code) => {
      codes.push(`<code>${escape(code)}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = escape(s)
      .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => codes[Number(i)]);
  }

  const LIST = { ul: /^\s*[-*+]\s+(.*)$/, ol: /^\s*\d+[.)]\s+(.*)$/ };

  function renderMarkdown(src) {
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (/^```/.test(line)) {
        const body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
        i++; // closing fence (or end of text)
        out.push(`<pre><code>${escape(body.join('\n'))}</code></pre>`);
        continue;
      }

      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        const n = heading[1].length;
        out.push(`<h${n}>${inline(heading[2].trim())}</h${n}>`);
        i++;
        continue;
      }

      const listType = LIST.ul.test(line) ? 'ul' : LIST.ol.test(line) ? 'ol' : null;
      if (listType) {
        const items = [];
        let m;
        while (i < lines.length && (m = LIST[listType].exec(lines[i]))) { items.push(`<li>${inline(m[1])}</li>`); i++; }
        out.push(`<${listType}>${items.join('')}</${listType}>`);
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quoted = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) quoted.push(inline(lines[i++].replace(/^>\s?/, '')));
        out.push(`<blockquote>${quoted.join('<br>')}</blockquote>`);
        continue;
      }

      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>)/.test(lines[i])
             && !LIST.ul.test(lines[i]) && !LIST.ol.test(lines[i])) {
        para.push(inline(lines[i++]));
      }
      out.push(`<p>${para.join('<br>')}</p>`);
    }
    return out.join('');
  }

  return { renderMarkdown };
});
