# Private Workspace Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eight features picked from the preview page: pop-up title fix, encrypted notes, panic key, browser tabs, editable bookmarks, ad/tracker blocking, multiple Markdown notes, and notes export/import.

**Architecture:** Testable logic lives in small CommonJS modules under `lib/` (main process) and UMD modules under `renderer/` (host page, also loadable by Node for tests). `main.js` wires the logic to Electron and to IPC; `index.html` keeps markup and CSS, and its inline script moves to `renderer/app.js`. Every window, menu and dialog is still created by the main process, so `native-guard.js` keeps protecting it.

**Tech Stack:** Electron ^44.8.0, plain HTML/CSS/JS (no bundler), Node built-in `node:test`, Electron `safeStorage` (Windows DPAPI), Node `crypto` (scrypt + AES-256-GCM), `@ghostery/adblocker` (new dependency).

**Spec:** [`preview.html`](../../../preview.html), the cards whose `data-id` is `popup-title-leak`, `encrypt-notes`, `panic-key`, `tabs`, `bookmarks`, `adblock`, `multi-notes` and `notes-export`.

## Global Constraints

- **Target platform:** Windows 10/11 only. The app keeps working on other platforms but is only verified on Windows.
- **No unprotected UI:** never open a system Save dialog, a print dialog or Chromium's own file picker. Any file the app writes goes to `Downloads\Private Workspace`. Any Open dialog is `dialog.showOpenDialog` from the main process.
- **Window titles:** every window's title is `Private Workspace`.
- **Host page CSP:** stays `default-src 'none'`. The only change allowed is `script-src 'self'` instead of `'unsafe-inline'`.
- **IPC checks:** every `ipcMain.handle` for host-page APIs rejects senders other than `mainWin.webContents`.
- **Network:** the only new network traffic is the ad-block list download.
- **Dependencies:** new dependencies are pinned to an exact version at least two weeks old (no `^`).
- **Tests:** run with `npm test` (`node --test test/`). Tests must pass in a shell where `ELECTRON_RUN_AS_NODE=1` is set (the VS Code terminal sets it).
- **Manual check:** the app window is hidden from screen capture, so automation can't see it. Every task ends with the user running `npm start`, checking the listed behaviour and approving before the commit and before the next task starts.
- **Branch:** all work happens on `feature/workspace-additions`, never on `main`.

## Review Focus

1. **Notes from the old version.** A user upgrading with text in the old single-note `localStorage` must find it as their first note, and the old text must only be removed after the encrypted save succeeds. Tested in Task 3 (`migrateLegacy`).
2. **Unreadable notes file.** If `notes.enc` can't be decrypted (another Windows account, or corruption), the app must not overwrite it with an empty list. It moves the file aside and warns. Tested in Task 3.
3. **Sign-in pop-ups.** `window.open(url, name, 'width=…')`, which OAuth flows use, must stay a real pop-up window with `window.opener`, not become a tab. Tested in Task 6 (`routeWindowOpen`).
4. **Wrong export password.** Importing with a wrong password or a damaged file shows a clear error and leaves existing notes untouched. Tested in Task 5.
5. **Ad-block list unavailable.** Offline on first launch, or the list server down: browsing works unblocked and a notice explains why. Tested in Task 8.

---

### Task 1: Test harness + pop-up title fix

**Files:**
- Create: `lib/window-privacy.js`, `test/window-privacy.test.js`
- Modify: `package.json` (add `"test": "node --test test/"`), `main.js:30` (`browser-window-created` handler)

**Interfaces:**
- Produces: `lockTitle(win: { setTitle(t: string): void, on(evt: string, fn: Function): void }, title = 'Private Workspace'): void`

- [ ] **Step 1: Create the branch and commit the preview page**

```bash
git checkout -b feature/workspace-additions
git add preview.html main.js package.json docs/superpowers/plans/2026-11-24-workspace-additions.md
git commit -m "feat: add feature preview page and implementation plan"
```

- [ ] **Step 2: Write the failing test** in `test/window-privacy.test.js`

```js
test('lockTitle sets the neutral title and blocks page title updates', () => {
  const win = new EventEmitter();
  win.setTitle = (t) => { win.title = t; };
  lockTitle(win);
  assert.equal(win.title, 'Private Workspace');
  let prevented = false;
  win.emit('page-title-updated', { preventDefault: () => { prevented = true; } }, 'Inbox (3) – Gmail');
  assert.ok(prevented);
  assert.equal(win.title, 'Private Workspace');
});
```

- [ ] **Step 3: Run it.** `npm test`. Expected: FAIL, `Cannot find module '../lib/window-privacy'`.
- [ ] **Step 4: Implement `lockTitle`.** Call `setTitle(title)`, then add a `page-title-updated` listener that calls `e.preventDefault()`. In `main.js`, call `lockTitle(win)` inside the existing `browser-window-created` handler, next to `setContentProtection`.
- [ ] **Step 5: Run it.** `npm test`. Expected: 1 passing.
- [ ] **Step 6: User check.** Run `npm start` and open `https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_win_open`. Click "Try it". The new window's taskbar button and Alt+Tab entry both read "Private Workspace".
- [ ] **Step 7: Commit:** `fix: keep page titles out of the taskbar for pop-up windows`

---

### Task 2: Panic key

**Files:**
- Create: `lib/panic.js`, `test/panic.test.js`
- Modify: `main.js` (register shortcut in `whenReady`, unregister on `will-quit`, call `panic.adopt` in `browser-window-created`), `index.html` (hint in the status strip), `README.md`

**Interfaces:**
- Produces: `createPanic(getWindows: () => Win[]) -> { toggle(): boolean /* true = now hidden */, isHidden(): boolean, adopt(win: Win): void }`, where `Win = { isDestroyed(), isVisible(), hide(), show(), focus(), once(evt, fn) }`
- Produces: the constant `PANIC_ACCELERATOR = 'CommandOrControl+Shift+H'` in `main.js`

- [ ] **Step 1: Write the failing tests** in `test/panic.test.js`, using fake windows that record `hide` and `show` calls:
  - `toggle hides every visible window and returns true`
  - `second toggle shows only the windows it hid` (a window that was already hidden stays hidden)
  - `destroyed windows are skipped` (no throw, no calls)
  - `adopt hides a window created while hidden and restores it on the next toggle`
  - `adopt does nothing while not hidden`
- [ ] **Step 2: Run them.** `npm test`. Expected: 5 FAIL.
- [ ] **Step 3: Implement `createPanic`.** Keep a `Set` of the windows it hid. `adopt` hides the window immediately and again on its first `show` event, because pop-ups show themselves after creation. Restoring focuses the last window it shows.
- [ ] **Step 4: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 5: Wire it into `main.js`.** If `globalShortcut.register(PANIC_ACCELERATOR, () => panic.toggle())` returns `false`, call `notifyHost('Panic key Ctrl+Shift+H is used by another app, so it is unavailable.')`. Add the status-strip hint `Ctrl+Shift+H hides everything` (muted text, before the toggle button). Add a README row describing the panic key.
- [ ] **Step 6: User check.** Focus another app (Notepad) and press Ctrl+Shift+H: the workspace and its pop-ups disappear from the screen, the taskbar and Alt+Tab. Press it again: they come back.
- [ ] **Step 7: Commit:** `feat: add Ctrl+Shift+H panic key that hides every window`

---

### Task 3: Encrypted notes store (still a single note)

**Files:**
- Create: `lib/notes-store.js`, `renderer/notes-model.js`, `renderer/app.js`, `test/notes-store.test.js`, `test/notes-model.test.js`
- Modify: `main.js` (IPC), `preload.js`, `index.html` (move the inline `<script>` into `renderer/app.js`, CSP `script-src 'self'`, load scripts with `<script src>`), `README.md` (replace the "Notes are saved unencrypted" limit)

**Interfaces:**
- Produces (data): `NotesData = { version: 1, notes: Note[] }`, `Note = { id: string, body: string, updated: number }`. The title is derived from the body, never stored.
- Produces: `createNotesStore({ file: string, cipher: { isAvailable(): boolean, encrypt(s: string): Buffer, decrypt(b: Buffer): string } }) -> { load(): Promise<{ data: NotesData, warning: string | null }>, save(data: NotesData): Promise<void> }`
- Produces: `validateNotes(data: unknown): NotesData`. Throws `TypeError` on a bad shape, more than 2000 notes, or a body over 1,000,000 characters.
- Produces (renderer, UMD global `PWNotes`): `migrateLegacy(data: NotesData, legacyText: string | null, now: number, makeId: () => string): NotesData | null` and `makeId(): string` (uses `crypto.randomUUID()`)
- Produces (IPC): `notes:load` returns `{ data, warning }`. `notes:save(data)` returns `{ ok: true } | { ok: false, error: string }`.
- Produces (preload): `window.workspace.notes = { load(), save(data) }`
- Convention for every `renderer/*.js` file: UMD wrapper, `module.exports = api` under Node, otherwise `window.PW<Name> = api`.

- [ ] **Step 1: Write the failing store tests** in `test/notes-store.test.js`. Use a temp dir and a fake cipher that base64-encodes and reverses the string, so the encrypted bytes can't contain the body.
  - `save then load returns the same data`
  - `file on disk does not contain the note text`
  - `missing file loads as { version: 1, notes: [] } with warning null`
  - `undecryptable file is moved to notes.enc.corrupt-<timestamp>, load returns empty data and a warning, and the original bytes are preserved` (Review Focus 2)
  - `save throws 'Encryption unavailable' and writes nothing when cipher.isAvailable() is false`
  - `no .tmp file remains after save` (writes to `<file>.tmp`, then renames)
  - `validateNotes rejects a note without a string body`
- [ ] **Step 2: Write the failing model tests** in `test/notes-model.test.js`:
  - `migrateLegacy turns old text into the first note when the store is empty` (Review Focus 1)
  - `migrateLegacy returns null when the store already has notes or the old text is empty or whitespace`
- [ ] **Step 3: Run them.** `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement `lib/notes-store.js` and `renderer/notes-model.js`.**
- [ ] **Step 5: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 6: Wire it up.**
  - **Main:** `cipher` wraps `safeStorage`. The file is `path.join(app.getPath('userData'), 'notes.enc')`. The IPC handlers check the sender and run `validateNotes` before saving.
  - **Host page:** `renderer/app.js` loads notes on start. If `migrateLegacy` returns data, it saves it and removes `localStorage['private-notes']` only once the save returns `{ ok: true }`. The textarea edits `notes[0]`, with the same 400 ms debounce. The footer shows `Saved, encrypted · <time>` or the error. A load `warning` goes to the notice bar.
- [ ] **Step 7: User check.**
  - Existing notes text is still there after the upgrade.
  - `%APPDATA%\private-workspace\notes.enc` looks like gibberish in Notepad.
  - Restarting the app keeps the notes.
  - Browser, toggle and notices still work after the script move.
- [ ] **Step 8: Commit:** `feat: store notes encrypted with Windows DPAPI`

---

### Task 4: Multiple notes + Markdown preview

**Files:**
- Create: `renderer/markdown.js`, `renderer/notes-ui.js`, `test/markdown.test.js`
- Modify: `renderer/notes-model.js`, `test/notes-model.test.js`, `renderer/app.js` (hand notes over to `notes-ui`), `index.html` (notes panel markup and CSS)

**Interfaces:**
- Consumes: `window.workspace.notes`, `NotesData`, `PWNotes.makeId` (Task 3)
- Produces (UMD `PWMarkdown`): `renderMarkdown(src: string): string`. It returns HTML, escapes everything first, and only emits `h1`–`h3`, `p`, `strong`, `em`, `code`, `pre`, `ul`, `ol`, `li`, `blockquote` and `br`. Links render as their text only, with no `<a>`.
- Produces (`PWNotes`): `noteTitle(note: Note): string`, `filterNotes(notes: Note[], query: string): Note[]`, `createNote(now: number, makeId): Note`, `sortByUpdated(notes: Note[]): Note[]`
- Produces: `createNotesUI({ root: HTMLElement, store: window.workspace.notes, onNotice(msg) }) -> { flush(): Promise<void> }`. `flush` saves any pending edit immediately; Task 5 relies on it.

- [ ] **Step 1: Write the failing tests.**

```js
assert.equal(renderMarkdown('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
assert.equal(renderMarkdown('# Hi'), '<h1>Hi</h1>');
assert.equal(renderMarkdown('**b** and *i*'), '<p><strong>b</strong> and <em>i</em></p>');
assert.equal(renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
assert.equal(renderMarkdown('`x<y`'), '<p><code>x&lt;y</code></p>');
assert.equal(renderMarkdown('[t](javascript:alert(1))'), '<p>t</p>');
assert.equal(noteTitle({ body: '\n\n## Interview prep\nmore' }), 'Interview prep');
assert.equal(noteTitle({ body: '   ' }), 'Untitled');
// titles longer than 60 characters are cut to 60
// filterNotes is case-insensitive and matches the body; an empty query returns everything
// sortByUpdated puts the newest first and does not mutate its input
```

- [ ] **Step 2: Run them.** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement `renderMarkdown` and the new `PWNotes` functions.** `renderMarkdown` works line by line: group blocks, escape `& < > " '` in each, then apply inline rules.
- [ ] **Step 4: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 5: Build `renderer/notes-ui.js` to match the preview's `multi-notes` card.**
  - **Sidebar:** a search box, the notes sorted by `updated` with title and relative time, and "+ New note".
  - **Editor and preview:** a textarea plus a preview pane, with a "Preview" toggle button whose state is remembered in `localStorage`.
  - **Delete:** a "Delete" button that asks via `confirm()`, which native-guard protects.
  - **Autosave:** typing saves the whole `NotesData` after 400 ms, and deleting the last note leaves one empty note.
- [ ] **Step 6: User check.**
  - Create three notes, search for a word that is only in one of them, and delete one.
  - Typing `# Title`, `- item` and `**bold**` renders in the preview.
  - Typing `<img src=x onerror=alert(1)>` shows as plain text.
  - Restarting keeps all the notes.
- [ ] **Step 7: Commit:** `feat: multiple notes with search and Markdown preview`

---

### Task 5: Notes export / import

**Files:**
- Create: `lib/notes-export.js`, `test/notes-export.test.js`
- Modify: `main.js` (IPC), `preload.js`, `renderer/notes-ui.js` (Export/Import buttons and password `<dialog>`), `index.html` (CSS), `README.md`

**Interfaces:**
- Consumes: `createNotesStore`, `validateNotes` (Task 3), `createNotesUI().flush()` (Task 4)
- Produces:
  - `encryptExport(data: NotesData, password: string): Promise<Buffer>`. Output is the JSON `{ format: 'pwnotes', v: 1, kdf: { name: 'scrypt', N: 32768, r: 8, p: 1, salt }, iv, tag, ct }`, with binary fields in base64. Cipher is AES-256-GCM with a 32-byte key and a 12-byte IV. A password under 8 characters throws an error with code `WEAK_PASSWORD`.
  - `decryptExport(buf: Buffer, password: string): Promise<NotesData>`. Throws an error with code `BAD_PASSWORD` on a GCM auth failure, or code `BAD_FORMAT` when the input isn't valid `pwnotes` JSON.
  - `toText(data: NotesData): string`. Joins the note bodies with `\n\n---\n\n`.
  - `mergeNotes(existing: NotesData, incoming: Note[], makeId: () => string): { data: NotesData, added: number }`. An incoming note with the same id and body is skipped. One with the same id and a different body gets a new id.
  - `uniqueFile(dir: string, base: string, ext: string): Promise<string>`. Returns `base.ext`, or `base (1).ext`, `base (2).ext` and so on if taken.
- Produces (IPC):
  - `notes:export({ kind: 'pwnotes' | 'txt', password? })` returns `{ ok, file?, code? }`.
  - `notes:pick-import()` returns `{ token, kind: 'pwnotes' | 'text', name } | null`.
  - `notes:import({ token, password? })` returns `{ ok: true, data, added } | { ok: false, code }`.
- Produces (preload): the same three calls on `window.workspace.notes`

- [ ] **Step 1: Write the failing tests:**
  - `encrypt then decrypt round-trips the data`
  - `wrong password rejects with code BAD_PASSWORD` (Review Focus 4)
  - `a flipped byte in ct rejects with BAD_PASSWORD`
  - `garbage input rejects with BAD_FORMAT`
  - `a password of 7 characters rejects with WEAK_PASSWORD`
  - `mergeNotes skips identical notes, re-ids conflicting ones and counts added`
  - `uniqueFile picks "notes (1).pwnotes" when "notes.pwnotes" exists`
- [ ] **Step 2: Run them.** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement `lib/notes-export.js`.**
- [ ] **Step 4: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 5: Wire it up.**
  - **Export:** writes to `Downloads\Private Workspace\notes-YYYY-MM-DD.<ext>` through `uniqueFile`, then calls `notifyHost` with the path. A `.txt` export adds "This file is not encrypted."
  - **Import:** `pick-import` uses `dialog.showOpenDialog(mainWin, …)` with filters `pwnotes` and `txt, md`, and keeps the file's bytes in a `Map` by a random token for 5 minutes. A text import becomes one note per file. Import merges into the store, saves, and returns the new data.
  - **Host page:** export calls `flush()` first. Passwords are asked in an in-page `<dialog>` with a password field (plus a confirm field for export). Errors show inline in the dialog: "Wrong password or damaged file."
- [ ] **Step 6: User check.**
  - Export as encrypted, delete a note, then import with the right password: the note is back with no duplicates.
  - Importing with a wrong password shows the error and leaves the notes unchanged.
  - Export as `.txt` opens fine in Notepad.
  - Exporting twice on the same day gives `notes-…(1).pwnotes`.
- [ ] **Step 7: Commit:** `feat: export and import notes (password-encrypted or text)`

---

### Task 6: Browser tabs

**Files:**
- Create: `lib/window-routing.js`, `renderer/tabs.js`, `test/window-routing.test.js`, `test/tabs-model.test.js`
- Modify: `main.js` (`guardPageWindows` uses `routeWindowOpen`, sends `workspace-open-tab`), `preload.js`, `renderer/app.js` (nav bar and quick-open act on the active tab), `index.html` (a tab strip above the nav, a webview container instead of the single `<webview>`)

**Interfaces:**
- Produces:
  - `routeWindowOpen({ url: string, disposition: string }): 'tab' | 'popup' | 'deny'`. A URL that isn't http(s) or `about:blank` gives `'deny'`. `'foreground-tab'` or `'background-tab'` gives `'tab'`. Anything else gives `'popup'`.
  - `nextActiveAfterClose(ids: string[], closingId: string, activeId: string): string | null`, exported from `renderer/tabs.js`. It prefers the tab on the right, then the one on the left.
- Produces (IPC to host): `workspace-open-tab`, carrying `{ url: string, background: boolean }`
- Produces (preload): `window.workspace.onOpenTab(fn)`
- Produces (UMD `PWTabs`): `createTabs({ strip: HTMLElement, host: HTMLElement, homeUrl: string }) -> { open(url, { background } = {}): Tab, close(id), activate(id), active(): Tab | null, onChange(fn: (tab: Tab | null) => void) }`, where `Tab = { id: string, webview: HTMLElement, title: string, url: string }`

- [ ] **Step 1: Write the failing tests:**
  - `routeWindowOpen sends target=_blank links to tabs` (`'foreground-tab'` and `'background-tab'` give `'tab'`)
  - `routeWindowOpen keeps window.open with features as a popup` (`'new-window'` gives `'popup'`; Review Focus 3)
  - `routeWindowOpen denies mailto: and whatsapp:`
  - `nextActiveAfterClose picks the right neighbour, then the left, then null`
  - `closing a background tab keeps the active one`
- [ ] **Step 2: Run them.** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement both functions.** Make the `require` in `renderer/tabs.js` Node-safe: under Node, DOM code only runs when `createTabs` is called.
- [ ] **Step 4: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 5: Wire it up.**
  - **Main:** for a `'tab'` route, `guardPageWindows` denies the window open and sends `workspace-open-tab`. The blocked-scheme notice stays the same.
  - **Webviews:** created with `document.createElement('webview')`, with `partition="persist:private"` and `allowpopups`. The existing `will-attach-webview` check stays unchanged.
  - **Tab strip:** each tab's title comes from `page-title-updated`, cut off with an ellipsis. Middle-click or × closes a tab. Closing the last tab opens `homeUrl` (`https://duckduckgo.com`).
  - **Nav and quick-open:** the URL box follows the active tab. Quick-open chips open in the active tab.
- [ ] **Step 6: User check.**
  - Ctrl+click or `target=_blank` links open a new tab.
  - The w3schools `window.open` demo still opens a pop-up window.
  - Google sign-in from a site that uses a pop-up still completes.
  - Back, forward, reload and the URL box act on the active tab, and closing tabs moves focus sensibly.
- [ ] **Step 7: Commit:** `feat: browser tabs; new-tab links open as tabs`

---

### Task 7: Editable bookmarks

**Files:**
- Create: `renderer/bookmarks.js`, `test/bookmarks.test.js`
- Modify: `renderer/app.js`, `index.html` (star button in the nav; the quick-open chips are rendered from data)

**Interfaces:**
- Consumes: `PWTabs` `active()` and `onChange` (Task 6)
- Produces (UMD `PWBookmarks`):
  - `DEFAULT_BOOKMARKS`: Gmail, Outlook, WhatsApp, Drive and Search, with the URLs currently in `index.html:85-89`
  - `loadBookmarks(raw: string | null): Bookmark[]`
  - `addBookmark(list, { title, url }): Bookmark[]`
  - `removeBookmark(list, url): Bookmark[]`
  - `moveBookmark(list, from: number, to: number): Bookmark[]`
  - `isBookmarked(list, url): boolean`
  - `Bookmark = { title: string, url: string }`. Every function returns a new array.

- [ ] **Step 1: Write the failing tests:**
  - `loadBookmarks returns defaults for null and for invalid JSON`
  - `loadBookmarks drops entries whose url is not http(s)`
  - `addBookmark ignores a url already present`
  - `addBookmark trims the title to 40 characters and falls back to the hostname when the title is empty`
  - `addBookmark rejects javascript: urls (returns the list unchanged)`
  - `removeBookmark removes by url`
  - `moveBookmark(list, 0, 2) moves the first item to index 2`
- [ ] **Step 2: Run them.** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement `renderer/bookmarks.js`.**
- [ ] **Step 4: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 5: Wire it up.** The ☆ / ★ button follows `isBookmarked(active().url)`; clicking it adds or removes the page. Each chip has a × to remove it. Chips are reordered by HTML5 drag-and-drop. The list persists to `localStorage['bookmarks']`.
- [ ] **Step 6: User check.** Star a page and its chip appears; the star is filled while on that page. Remove a chip, drag one to a new position, then restart: the changes are kept.
- [ ] **Step 7: Commit:** `feat: editable quick-open bookmarks`

---

### Task 8: Ad & tracker blocking

**Files:**
- Create: `lib/adblock.js`, `test/adblock.test.js`
- Modify: `package.json` (exact-pinned `@ghostery/adblocker`), `main.js` (start in `setupSession`, IPC), `preload.js`, `renderer/app.js`, `index.html` (shield badge and pop-over in the nav), `README.md`

**Interfaces:**
- Consumes: `PWTabs` `active()` and `onChange` (Task 6). The webview id comes from `webview.getWebContentsId()`.
- Produces:
  - `shouldBlock(engine: FiltersEngine, { url: string, resourceType: string, pageUrl: string }, allowHosts: Set<string>): boolean`. Returns false for `mainFrame` requests and when the page's hostname is in `allowHosts`. Otherwise it returns the engine's match result.
  - `createAdblock({ cacheFile: string, allowFile: string, fetch: typeof fetch, now?: () => number }) -> { start(session, onBlocked: (webContentsId: number) => void): Promise<boolean>, setAllowed(host: string, allowed: boolean): Promise<void>, isAllowed(host: string): boolean }`
  - `start` loads the engine from `cacheFile`. If there is no cache, it fetches the prebuilt ads-and-tracking list. If the cache is older than 7 days, it refreshes in the background. It returns `false` if no engine could be loaded.
- Produces (IPC):
  - `adblock:count`, sent to the host, carrying `{ webContentsId, count }`. Throttled to once per 250 ms per page. The count resets on a main-frame navigation.
  - `adblock:get-site(host)` returns `{ allowed }`.
  - `adblock:set-site({ host, allowed })`
- Produces (preload): `window.workspace.adblock = { onCount(fn), getSite(host), setSite(host, allowed) }`

- [ ] **Step 1: Install the dependency.** Run `npm view @ghostery/adblocker time --json` and pick the newest version that is at least 14 days old. Then run `npm install --save-exact @ghostery/adblocker@<that version>`.
- [ ] **Step 2: Write the failing tests.** Build the engine with `FiltersEngine.parse('||ads.example.com^')`.
  - `blocks a script from ads.example.com on https://news.test/`
  - `does not block when news.test is allowed`
  - `never blocks a mainFrame request`
  - `does not block first-party https://news.test/app.js`
  - `start resolves false when fetch rejects and there is no cache` (Review Focus 5)
  - `start loads from cacheFile without calling fetch when the cache is fresh`
  - `setAllowed persists to allowFile and a new instance reads it back`
- [ ] **Step 3: Run them.** `npm test`. Expected: FAIL.
- [ ] **Step 4: Implement `lib/adblock.js`.** Block network requests only, through our own `ses.webRequest.onBeforeRequest`, so the per-site allowlist works. Don't hide page elements (cosmetic filtering).
- [ ] **Step 5: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 6: Wire it up.**
  - **Main:** the cache file is `userData/adblock-engine.bin` and the allowlist is `userData/adblock-allow.json`. When `start` returns false, call `notifyHost('Ad blocking is off: the block list could not be downloaded. Pages still load normally.')`.
  - **Host page:** the 🛡 badge shows the count for the active tab. Clicking it opens a pop-over (in-page HTML, not a native menu) with "Block on this site" and a toggle. Changing the toggle reloads the tab.
- [ ] **Step 7: User check.**
  - A news site shows a count above 0 and loads visibly lighter.
  - Toggling the site off and reloading shows a count of 0 and the ads return.
  - Restarting with Wi-Fi off still browses (cached list). On a first run offline, delete `adblock-engine.bin` and the notice appears.
- [ ] **Step 8: Commit:** `feat: ad and tracker blocking with per-site toggle`

---

## After all tasks

- [ ] **Run every test.** `npm test`. Expected: all pass.
- [ ] **Update `preview.html`.** Mark the eight built cards as "Built", so the page now separates built features from ideas.
- [ ] **Review the whole branch.** Run one reviewer over all the changes. Then use superpowers:finishing-a-development-branch.

**Out of scope (not picked on the preview page):** keyboard shortcuts such as Ctrl+T, Ctrl+W and Ctrl+F; restoring tabs after a restart; favicons; app lock; installer.
