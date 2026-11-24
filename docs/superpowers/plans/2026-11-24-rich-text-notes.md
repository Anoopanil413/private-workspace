# Rich-Text Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Markdown textarea + preview with a rich-text notes editor: a formatting toolbar (Bold, Italic, Underline, Strikethrough, Numbered list, Bulleted list, Checklist, Indent, Code) and the matching keyboard shortcuts.

**Architecture:** The editor is a `contenteditable` element driven by `document.execCommand`, so Ctrl+Z undo keeps working. Notes are stored as HTML that has been run through an allow-list sanitizer. Every HTML string that reaches the page (stored notes, imports, pastes, drops) is rebuilt node by node from that allow-list. Old Markdown notes are converted once when loaded. Shared pure code lives in `renderer/rich-text.js`, a UMD module that runs in the page, in the main process and under Node tests.

**Tech Stack:** Electron ^44.8.0, plain JS (no bundler), `node:test`, `jsdom` 31.0.0 (new dev dependency, for the sanitizer tests only).

**Spec:** The user's screenshot of a Slack-style toolbar with icons B · I · U · S · 1≡ · •≡ · (checklist) · (indent) · <>. Decisions from the user: rich text (WYSIWYG), icon 7 = Checklist, icon 8 = Indent.

## Global Constraints

- **Allowed markup:** stored and displayed note HTML may only contain these tags:
  - Blocks: `p div br h1 h2 h3 blockquote pre`
  - Lists: `ul ol li`
  - Inline: `b strong i em u s strike del code`
  - Attributes: only `data-type="checklist"` on `ul` and `data-checked="true|false"` on `li`.
  - Everything else is dropped, keeping its text: `script`, `style`, `iframe`, `img`, links, and every other attribute including `on*`, `style`, `href`.
- **One way in:** `innerHTML` is only ever assigned the output of `sanitizeHtml`, and the editor only receives HTML through it.
- **Shortcuts:** Ctrl+B / Ctrl+I / Ctrl+U (built into the browser), Ctrl+Shift+X strikethrough, Ctrl+Shift+7 numbered list, Ctrl+Shift+8 bulleted list, Ctrl+Shift+9 checklist, Ctrl+E inline code, Tab / Shift+Tab indent / outdent in lists. Ctrl+Shift+H stays the global panic key.
- **Upgrade path:** existing notes (Markdown, no `format` field) still open with their formatting, through a one-time conversion. Old `.pwnotes` exports and text files still import.
- **Plain-text export:** `.txt` export contains plain text, not HTML tags.
- **Tests:** `npm test`. New dev dependencies are pinned exact and at least 14 days old.
- **Pacing:** one task at a time. The user checks each in the app (it is hidden from capture), then commits.

## Review Focus

1. **Hostile HTML in an imported `.pwnotes` or a paste** (`<img onerror>`, `<a href=javascript:>`, `<svg>`, `style=`): must come out as plain text or be dropped. Tested in Task 1 (sanitizer).
2. **Existing Markdown notes after the upgrade:** headings, lists and bold must survive, with nothing lost. Tested in Task 1 (`toRichNotes`).
3. **Search and titles must use the text, not the tags.** Searching "strong" must not match every bold note. Tested in Task 1.
4. **Checklist ticks must survive save and reload:** the `data-checked` attribute is allowed through. Tested in Task 1, checked by hand in Task 2.
5. **Pasting from Word or a web page:** formatting is kept within the allow-list, and fonts, colours and images are dropped. Tested in Task 1 (sanitizer) and smoke-tested in Task 2.

---

### Task 1: Rich-text core (sanitizer, HTML → text, Markdown upgrade)

**Files:**
- Create: `renderer/rich-text.js`, `test/rich-text.test.js`
- Modify: `lib/notes-store.js` (keep `format`), `renderer/notes-model.js` (titles and search use the text), `test/notes-store.test.js`, `test/notes-model.test.js`, `package.json` (add `jsdom` dev dependency)

**Interfaces:**
- Produces, UMD `PWRichText`:
  - `sanitizeHtml(html: string, doc?: Document): string`. Rebuilds the input with only the allowed tags and attributes; unknown tags are unwrapped to their children; `script`, `style`, `template`, `iframe`, `object`, `svg`, `math`, `img` and `head` are removed with their content. `doc` defaults to `document`; tests pass a jsdom document.
  - `htmlToText(html: string): string`. String-based, no DOM, usable in the main process. Blocks end with a newline. List items become `- `, `1. `, or `[ ] ` / `[x] ` for checklists, indented two spaces per level. Decodes `&amp; &lt; &gt; &quot; &#39; &nbsp;` and numeric entities.
  - `textToHtml(text: string): string`. Escapes the text; each line becomes a `<p>` (empty lines become `<p><br></p>`).
  - `toRichNotes(data: NotesData, markdownToHtml: (md) => string): NotesData`. Converts notes without `format: 'html'` to `format: 'html'` (body = sanitized `markdownToHtml(body)`), and leaves html notes as they are.
- Produces (data): `Note = { id, body, updated, format?: 'html' }`. `validateNotes` keeps `format` only when it equals `'html'`.
- Changes `PWNotes.noteTitle` and `filterNotes`: they work on `htmlToText(body)` when `format === 'html'`.

- [ ] **Step 1: Install jsdom.** `npm install --save-dev --save-exact jsdom@31.0.0`
- [ ] **Step 2: Write the failing tests:**
  - `sanitizeHtml keeps allowed formatting`: `<p><b>a</b> <u>b</u> <s>c</s> <code>d</code></p>` is unchanged.
  - `sanitizeHtml drops script/img/svg/iframe with their content and strips event and style attributes`. Input: `<p onclick="x" style="color:red">hi<img src=x onerror=alert(1)><script>alert(1)</script><svg><a href="javascript:1">s</a></svg></p>`. Output: `<p>hi</p>`.
  - `sanitizeHtml unwraps unknown tags but keeps their text`: `<span style="font:x"><a href="https://x">link</a></span>` becomes `link`.
  - `sanitizeHtml keeps checklist attributes only on ul/li`.
  - `htmlToText renders lists, checklists, nesting and entities`.
  - `textToHtml escapes and keeps lines`.
  - `toRichNotes converts markdown notes once and leaves html notes alone`.
  - `validateNotes keeps format 'html' and drops other format values`.
  - `noteTitle and filterNotes ignore tags for html notes`: searching `strong` doesn't match `<p><strong>x</strong></p>`.
- [ ] **Step 3: Run them.** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement `renderer/rich-text.js`, then the `notes-store` and `notes-model` changes.**
- [ ] **Step 5: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 6: User check.** None; there is no UI change yet. The user commits: `feat: rich-text core (sanitizer, HTML↔text, markdown upgrade)`

### Task 2: Rich-text editor with toolbar and shortcuts

**Files:**
- Modify: `index.html` (toolbar, `contenteditable` editor replacing textarea and preview, styles), `renderer/notes-ui.js` (editor, commands, shortcuts, paste/drop, checklist toggle, active button states, upgrade on load/import), `README.md`
- Remove from the page: the preview pane and the Preview toggle. `renderer/markdown.js` stays, for the upgrade.

**Interfaces:**
- Consumes: `PWRichText.*` and `PWMarkdown.renderMarkdown` (Task 1).
- Produces: the toolbar buttons `data-cmd` = `bold | italic | underline | strikeThrough | insertOrderedList | insertUnorderedList | checklist | indent | code`, each with a `title` showing its shortcut.

- [ ] **Step 1: Replace the textarea and preview with a toolbar and `<div id="notes" contenteditable="true">`.** Set `white-space: pre-wrap`, style lists, `code`, and checklist items (a `li::before` checkbox, struck-through when ticked).
- [ ] **Step 2: Load and save.**
  - On load and after import: `data = toRichNotes(data, renderMarkdown)`. If anything was converted, save once.
  - Showing a note: `editor.innerHTML = sanitizeHtml(note.body)`.
  - The `input` event: the note body becomes `sanitizeHtml(editor.innerHTML)` and `format` becomes `'html'`, saved with the existing 400 ms debounce.
- [ ] **Step 3: Commands.**
  - `execCommand` handles bold, italic, underline, strikeThrough, the two lists, indent and outdent.
  - Checklist: insert an unordered list, then set `data-type="checklist"` on the list at the caret. Toggling again turns it back into an unordered list.
  - Code: wrap the selection in `<code>` with `insertHTML` (escaped), or unwrap it when the caret is already inside `<code>`.
  - Shortcuts: the keydown handler maps the global constraint list. Tab and Shift+Tab indent and outdent inside a list, and insert a tab character elsewhere.
- [ ] **Step 4: Checklist ticks.** A click in the checkbox area of a checklist `li` (left of its content box) flips `data-checked` and saves.
- [ ] **Step 5: Paste and drop.** HTML is inserted as `sanitizeHtml(html)` with `insertHTML`, and plain text with `insertText`. Files and images are ignored.
- [ ] **Step 6: Button states.** On `selectionchange` inside the editor, set `aria-pressed` from `queryCommandState`, the list or checklist the caret is in, and `<code>`.
- [ ] **Step 7: Smoke-test** in a throwaway profile:
  - an old Markdown note shows formatted;
  - each button and shortcut changes the HTML;
  - a ticked checklist item survives a reload;
  - hostile pasted HTML ends up as text;
  - search ignores tags;
  - no console errors.
- [ ] **Step 8: User check, then commit.** `feat: rich-text notes editor with toolbar and shortcuts`

### Task 3: Export/import with rich notes

**Files:**
- Modify: `lib/notes-export.js` (`toText` uses `htmlToText` for html notes; `textToNotes` produces `format: 'html'` bodies through `textToHtml`), `test/notes-export.test.js`, `README.md`

- [ ] **Step 1: Write the failing tests:**
  - `toText turns html notes into plain text` (no `<` in the output for `<p><b>x</b></p>`).
  - `textToNotes makes html notes from text files`.
  - `a pwnotes export round-trips format: 'html'`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: all pass.
- [ ] **Step 5: Smoke-test.** A `.txt` export of a formatted note reads as clean text.
- [ ] **Step 6: User check, then commit.** `feat: plain-text export and text import for rich notes`
