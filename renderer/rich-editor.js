// Rich-text editor for notes: a contenteditable element plus a formatting toolbar.
// Commands go through document.execCommand where possible so Ctrl+Z undo keeps working.
// All HTML that enters (stored notes, paste, drop) passes PWRichText.sanitizeHtml.
// UMD: window.PWRichEditor / module.exports (editorShortcut is tested under Node).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWRichEditor = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Uses the physical key (e.code) so Ctrl+Shift+7 works on every keyboard layout.
  function editorShortcut(e) {
    if (e.altKey || e.metaKey) return null;
    if (e.code === 'Tab' && !e.ctrlKey) return e.shiftKey ? 'outdent' : 'indent';
    if (!e.ctrlKey) return null;
    if (!e.shiftKey) return { KeyB: 'bold', KeyI: 'italic', KeyU: 'underline', KeyE: 'code' }[e.code] || null;
    return {
      KeyX: 'strikeThrough', Digit7: 'insertOrderedList', Digit8: 'insertUnorderedList', Digit9: 'checklist',
    }[e.code] || null;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);
  const CHECKLIST = 'ul[data-type="checklist"]';

  function createRichEditor({ editor, toolbar, onChange }) {
    const RT = self.PWRichText;
    const sel = () => window.getSelection();
    let plainPaste = false;
    let dragFromEditor = false;

    // <div> lines: Chromium nests lists inside <p> (<p><ol>…</ol></p>) but not inside <div>.
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch {}

    const inEditor = (node) => !!node && editor.contains(node);
    const caretNode = () => { const s = sel(); return s.rangeCount && inEditor(s.anchorNode) ? s.anchorNode : null; };
    function closest(node, selector) {
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      const hit = el && el.closest(selector);
      return hit && editor.contains(hit) ? hit : null;
    }
    const currentList = () => closest(caretNode(), 'ul, ol');

    function exec(cmd, value) {
      if (!caretNode()) editor.focus();
      document.execCommand(cmd, false, value);
    }

    // insertHTML can carry inline styles over from the page; the saved copy is
    // sanitized anyway, this keeps what's on screen the same as what's saved.
    function scrub() {
      for (const el of editor.querySelectorAll('[style], [class], [id]')) {
        el.removeAttribute('style'); el.removeAttribute('class'); el.removeAttribute('id');
      }
    }

    // Selection as character offsets into the editor's text, so it can be put back
    // after commands that rebuild the DOM (Chromium's list commands move the caret
    // to the start of the line).
    function textOffsets() {
      const s = sel();
      if (!s.rangeCount || !inEditor(s.anchorNode)) return null;
      const r = s.getRangeAt(0);
      const upTo = (node, offset) => { const a = document.createRange(); a.selectNodeContents(editor); a.setEnd(node, offset); return a.toString().length; };
      return { start: upTo(r.startContainer, r.startOffset), end: upTo(r.endContainer, r.endOffset) };
    }

    function restoreOffsets(pos) {
      if (!pos) return;
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      const r = document.createRange();
      let seen = 0;
      let startSet = false;
      let last = null;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        last = n;
        const len = n.data.length;
        if (!startSet && pos.start <= seen + len) { r.setStart(n, pos.start - seen); startSet = true; }
        if (startSet && pos.end <= seen + len) { r.setEnd(n, pos.end - seen); sel().removeAllRanges(); sel().addRange(r); return; }
        seen += len;
      }
      if (last) { r.setStart(last, last.data.length); r.collapse(true); sel().removeAllRanges(); sel().addRange(r); }
    }

    // Chromium can leave a list wrapped in the paragraph it came from (<p><ol>…</ol></p>).
    function unwrapListParagraphs() {
      for (const p of editor.querySelectorAll('p')) {
        const kids = [...p.childNodes].filter((n) => !(n.nodeType === 3 && !n.data.trim()));
        if (kids.length && kids.every((n) => n.nodeName === 'OL' || n.nodeName === 'UL')) p.replaceWith(...p.childNodes);
      }
    }

    // Run a list command keeping the caret (and selection) where it was.
    function keepingCaret(fn) {
      const pos = textOffsets();
      fn();
      unwrapListParagraphs();
      restoreOffsets(pos);
    }

    function refreshPlaceholder() {
      editor.classList.toggle('is-empty', !editor.textContent.trim() && !editor.querySelector('li, pre, code'));
    }

    function paintState() {
      if (!toolbar) return;
      const node = caretNode();
      const list = currentList();
      const q = (cmd) => { try { return document.queryCommandState(cmd); } catch { return false; } };
      const isChecklist = !!list && list.matches(CHECKLIST);
      const state = {
        bold: q('bold'), italic: q('italic'), underline: q('underline'), strikeThrough: q('strikeThrough'),
        insertOrderedList: !!list && list.tagName === 'OL',
        insertUnorderedList: !!list && list.tagName === 'UL' && !isChecklist,
        checklist: isChecklist,
        code: !!closest(node, 'code'),
      };
      for (const b of toolbar.querySelectorAll('[data-cmd]')) b.setAttribute('aria-pressed', String(!!state[b.dataset.cmd]));
    }

    function changed() {
      refreshPlaceholder();
      paintState();
      onChange();
    }

    function toggleChecklist() {
      const list = currentList();
      if (list && list.matches(CHECKLIST)) { exec('insertUnorderedList'); return; } // checklist off
      if (list && list.tagName === 'UL') { list.setAttribute('data-type', 'checklist'); return; }
      exec('insertUnorderedList'); // new list, or numbered -> bullets
      const ul = currentList();
      if (ul && ul.tagName === 'UL') ul.setAttribute('data-type', 'checklist');
    }

    function bulletList() {
      const list = currentList();
      if (list && list.matches(CHECKLIST)) { // checklist -> plain bullets
        list.removeAttribute('data-type');
        for (const li of list.querySelectorAll(':scope > li')) li.removeAttribute('data-checked');
        return;
      }
      exec('insertUnorderedList');
    }

    function indent(fromKey) {
      const list = currentList();
      if (!list) { // outside a list: Tab types a tab; the button indents the paragraph
        if (fromKey) exec('insertText', '\t'); else exec('indent');
        return;
      }
      const wasChecklist = list.matches(CHECKLIST);
      exec('indent');
      const nested = currentList();
      if (wasChecklist && nested && nested.tagName === 'UL') nested.setAttribute('data-type', 'checklist');
    }

    function toggleCode() {
      const code = closest(caretNode(), 'code');
      if (code) { // unwrap, caret after the text
        const text = document.createTextNode(code.textContent);
        code.replaceWith(text);
        const r = document.createRange();
        r.setStart(text, text.length);
        r.collapse(true);
        sel().removeAllRanges();
        sel().addRange(r);
        return;
      }
      const picked = sel().toString();
      if (picked) { exec('insertHTML', `<code>${escape(picked)}</code>`); return; }
      // Nothing selected: add an empty code box with "code" selected, so typing
      // replaces it. (Chromium's insertHTML turns a lone <code> into a <span>.)
      if (!caretNode()) editor.focus();
      const s = sel();
      if (!s.rangeCount) return;
      const box = document.createElement('code');
      box.textContent = 'code';
      s.getRangeAt(0).insertNode(box);
      const r = document.createRange();
      r.selectNodeContents(box);
      s.removeAllRanges();
      s.addRange(r);
    }

    function run(cmd, { fromKey = false } = {}) {
      switch (cmd) {
        case 'bold': case 'italic': case 'underline': case 'strikeThrough':
          exec(cmd); break;
        case 'insertOrderedList': case 'outdent': keepingCaret(() => exec(cmd)); break;
        case 'insertUnorderedList': keepingCaret(bulletList); break;
        case 'checklist': keepingCaret(toggleChecklist); break;
        case 'indent': if (currentList()) keepingCaret(() => indent(fromKey)); else indent(fromKey); break;
        case 'code': toggleCode(); break;
        default: return;
      }
      scrub();
      changed();
    }

    // ---- toolbar: keep the selection in the editor while clicking buttons ----
    if (toolbar) {
      toolbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
      toolbar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cmd]');
        if (b && !b.disabled) run(b.dataset.cmd);
      });
    }

    editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') plainPaste = true;
      const cmd = editorShortcut(e);
      if (!cmd) return;
      e.preventDefault();
      run(cmd, { fromKey: true });
    });

    editor.addEventListener('input', (e) => {
      // A new checklist item made with Enter starts unticked.
      if (e.inputType === 'insertParagraph') {
        const li = closest(caretNode(), `${CHECKLIST} > li`);
        if (li && !li.textContent.trim()) li.removeAttribute('data-checked');
      }
      changed();
    });

    // Tick / untick: a click on the box drawn to the left of a checklist item.
    editor.addEventListener('mousedown', (e) => {
      const li = e.target.closest && e.target.closest(`${CHECKLIST} > li`);
      if (!li || !editor.contains(li) || e.clientX >= li.getBoundingClientRect().left) return;
      e.preventDefault();
      li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
      changed();
    });

    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (html && !plainPaste) exec('insertHTML', RT.sanitizeHtml(html));
      else if (text) exec('insertText', text);
      plainPaste = false;
      scrub();
      changed();
    });

    // Drops from outside go through the sanitizer; files and images are ignored.
    // Moving a selection within the editor is left to the browser.
    editor.addEventListener('dragstart', () => { dragFromEditor = true; });
    editor.addEventListener('dragend', () => { dragFromEditor = false; });
    editor.addEventListener('drop', (e) => {
      if (dragFromEditor) return;
      e.preventDefault();
      const html = e.dataTransfer.getData('text/html');
      const text = e.dataTransfer.getData('text/plain');
      if (!html && !text) return;
      const r = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) { sel().removeAllRanges(); sel().addRange(r); }
      if (html) exec('insertHTML', RT.sanitizeHtml(html)); else exec('insertText', text);
      scrub();
      changed();
    });

    document.addEventListener('selectionchange', () => { if (caretNode()) paintState(); });

    return {
      setHtml(html) {
        editor.innerHTML = RT.sanitizeHtml(html || '');
        refreshPlaceholder();
        paintState();
      },
      getHtml: () => RT.sanitizeHtml(editor.innerHTML),
      // Adds HTML at the end (text sent from a page) without moving the caret, and
      // shows it; saving goes through onChange like typing.
      appendHtml(html) {
        editor.insertAdjacentHTML('beforeend', RT.sanitizeHtml(html || ''));
        editor.scrollTop = editor.scrollHeight;
        changed();
      },
      setEnabled(on) {
        editor.contentEditable = on ? 'true' : 'false';
        if (toolbar) for (const b of toolbar.querySelectorAll('button')) b.disabled = !on;
      },
      focus: () => editor.focus(),
      run,
    };
  }

  return { editorShortcut, createRichEditor };
});
