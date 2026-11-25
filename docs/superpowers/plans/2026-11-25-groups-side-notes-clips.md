# Tab Groups, Notes Beside the Page, Send Selection to a Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three features picked on the preview page:
1. A note can be open in a side panel next to the web page.
2. Selected text on a page can be sent to a note with a right-click.
3. Tabs can be put in named, coloured groups. A group can be saved and later reopened with all its tabs.

**Architecture:**
- **Side notes:** there is still only one notes editor. Opening the side panel *moves* the existing notes editor (`.notes-main`) into a panel to the right of the web pages, and closing it moves the editor back. So there is one editor, one copy of the data and one save path, and the two can't drift apart.
- **Right-click menu:** a menu drawn by the host page (HTML), not a native Windows menu. That keeps it inside the protected window and styled like the app. It's opened from the webview's `context-menu` event. The tab groups' right-click menu uses the same component.
- **Tab groups:** `renderer/tabs.js` gains groups. A group is an id, name, colour and collapsed flag, and its tabs always sit next to each other in the tab bar. Open groups are part of the tab session (`session.enc`, now version 2). Saved groups live in a new encrypted store, `groups.enc`, through `lib/secure-store.js`. A group opened from or saved to the saved list stays linked: its tab list is saved again automatically, as in Chrome.

**Tech Stack:** Electron ^44.8.0, plain JS (UMD renderer modules), `node:test`, and jsdom 31.0.0 for the DOM tests. No new dependencies.

**Spec:** The preview cards `tab-groups`, `split-notes` and `clip-to-note` in `preview.html`, plus the user's request: "grouped tabs will be opened like that when I reopen it".

## Global Constraints

- **Privacy:**
  - Saved groups (names, URLs, titles) are stored encrypted (`safeStorage`), like the session. An unreadable `groups.enc` means an empty list, never a crash or an error box.
  - Clipped text goes into notes, which are already encrypted, and never through the clipboard.
- **Group colours:** 8 colours, in this order: `blue #60a5fa`, `pink #f472b6`, `yellow #fbbf24`, `green #34d399`, `purple #a78bfa`, `red #f87171`, `cyan #22d3ee`, `grey #9ca3af`. A new group takes the first colour not already used by an open group.
- **Group names:** 1–40 characters, trimmed. The default is `Group N`, using the lowest N not already taken.
- **Limits:**
  - At most 50 saved groups.
  - At most 50 tabs per saved group, and only `http(s)` tabs are kept. This is the same rule as the session's 50 tabs.
  - A clip is at most 20,000 characters, then it's cut and ends with `…`.
- **Side panel:**
  - Ctrl+Shift+N toggles it, from anywhere, including inside a web page.
  - Its width can be dragged between 260 px and 60 % of the browser area, and the web page always keeps at least 320 px.
  - Its width and whether it's open are remembered (localStorage, layout only, no note content).
- **Keys:** while you type in the side note, the editor's own keys (Ctrl+B/I/U/E, Ctrl+Shift+7/8/9, Tab) win over browser keys. Browser keys the editor doesn't use (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+L …) still work.
- **Pacing:** one task at a time. The user checks each in the app, then commits.

## Review Focus

1. **A session file written by the current version (v1, no groups):** all tabs come back, ungrouped. Tested in Task 3 (`validateSession v1`).
2. **Opening a saved group that is already open:** the app switches to it instead of opening a second copy. Tested in Task 4 (`findOpenGroup`).
3. **Clipping text that looks like HTML (`<img onerror=…>`) or is huge:** it shows as plain text in the note, cut at 20,000 characters. Tested in Task 2 (`clipHtml`).
4. **Closing the last tab of a linked group:** the group disappears from the tab bar, but its saved copy keeps its tabs. An empty group is never saved. Tested in Task 4 (`savedUpdateFor`).
5. **The side panel open in a narrow window:** the page keeps at least 320 px, and the panel shrinks (or hides below 580 px total). Tested in Task 1 (`clampSideWidth`).

---

### Task 1: Notes beside the page

**Files:**
- Create: `renderer/side-notes.js`, `test/side-notes.test.js`
- Modify:
  - `renderer/notes-ui.js`: `mountInto`, a compact note picker
  - `renderer/shortcuts.js` and its test: `toggle-notes`
  - `renderer/app.js`: wiring, key precedence
  - `index.html`: side container, divider, 📝 button, CSS
  - `README.md`, `preview.html`: mark the three cards as in progress

**Interfaces:**
- Produces:
  - `PWSideNotes.clampSideWidth(want: number, total: number): number`. It returns 0 when `total < 580`, meaning hidden.
  - `PWSideNotes.createSideNotes({ browserPanel, host, notesUI, button }) → { toggle(): void, isOpen(): boolean }`
  - `notesUI.mountInto(container: Element | null): void`. Passing `null` puts the editor back on the Notes screen.
  - `notesUI.activeNote(): { id, title } | null`
  - Shortcut action `'toggle-notes'` for Ctrl+Shift+N.

- [ ] **Step 1: Write the failing tests.**
  - `test/side-notes.test.js`, `clampSideWidth`:
    - `(360, 1200) → 360`
    - `(100, 1200) → 260`
    - `(900, 1200) → 720` (the 60 % limit)
    - `(500, 700) → 380` (the page keeps 320)
    - `(360, 579) → 0`
  - `test/shortcuts.test.js`: Ctrl+Shift+N → `'toggle-notes'`, and Ctrl+N (no Shift) → `null`.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - **Layout:** `#webviews` sits in a flex row with `#side-notes`, an `<aside>` holding a 6 px `.side-divider` and the panel.
  - **Dragging the divider:** while dragging, a transparent full-size overlay covers the webviews so the page doesn't swallow mouse moves.
  - **Header** of the panel: the note's title as a button that opens the note list as a drop-down (it reuses `#notes-list` and `#notes-search`), ＋ New, and × to close.
  - **📝 button:** after ☆ in the nav bar, with `aria-pressed`.
  - **Notes tab:** clicking it while the panel is open moves the editor back for that screen. Going back to Browser mounts it in the panel again if it was open.
  - **Key precedence:** `app.js`'s document `keydown` handler returns early when `e.defaultPrevented`, and the editor's handler calls `preventDefault` for the keys it uses.
  - **Ctrl+Shift+N:** `toggle-notes` runs from any screen. From Notes, it switches to Browser with the panel open.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Smoke test in the real app** (scratchpad harness, as before):
  - Open the panel and type in it. The text is saved in `notes.enc`, and the Notes screen shows the same text.
  - Ctrl+B in the panel makes the text bold and does *not* add a bookmark. Ctrl+T still opens a tab.
  - Drag the divider to resize, restart, and the panel opens at the same width.
  - Ctrl+Shift+N works while a web page has focus.
- [ ] **Step 6: User check, then commit.** `feat: notes beside the page`

### Task 2: Send selected text to a note

**Files:**
- Create: `renderer/clip.js`, `renderer/context-menu.js`, `test/clip.test.js`, `test/context-menu.test.js`
- Modify:
  - `renderer/notes-ui.js`: `recent`, `append`
  - `renderer/app.js`: the webview `context-menu` event
  - `index.html`: `#ctx-menu` and its CSS, script tags
  - `README.md`

**Interfaces:**
- Consumes: `notesUI.activeNote()` and `PWSideNotes …isOpen()` from Task 1.
- Produces:
  - `PWClip.clipHtml({ text: string, title: string, url: string }): string`
  - `PWContextMenu.selectionMenu({ selectionText, sideNote: {id,title}|null, recent: [{id,title}] }): Item[]`, where `Item = { label, action?: string, noteId?: string|null, items?: Item[], separator?: true }`
  - `PWContextMenu.createMenu(root: Element) → { show(items, x, y, onPick(item)), hide() }`. Task 3 uses it too.
  - `notesUI.recent(n: number): [{ id, title }]`, newest first.
  - `notesUI.append(noteId: string | null, html: string): Promise<{ id, title }>`. `null` means a new note.

- [ ] **Step 1: Write the failing tests.**
  - `clipHtml`:
    - `{ text: 'Interviews are on 3 Dec.', title: 'Jobs', url: 'https://careers.example.com/a' }` gives a `<blockquote>` holding the text, followed by `<div>— Jobs · careers.example.com/a</div>`.
    - Line breaks in the text become `<br>`.
    - `<img src=x onerror=alert(1)>` comes out escaped, and running the result through `PWRichText.sanitizeHtml` (jsdom) leaves it unchanged.
    - 25,000 characters come out as 20,000 plus `…`.
    - An empty or whitespace-only selection gives `''`.
  - `selectionMenu`:
    - An empty selection gives `[]`.
    - With text, there's a "Copy" item first.
    - With `sideNote` set, the next item is `Add to "<title>"`.
    - Then `Add to note ▸`, whose sub-items are the `recent` notes (at most 5) and `＋ New note` (`noteId: null`).
    - A side note that is also in `recent` isn't listed twice.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - **When the menu opens:**
    - Each webview's `context-menu` event opens the menu at the event's `x, y`, offset by the webview's position, but only when `params.selectionText` is non-empty.
    - Right-click with no selection does nothing, as today.
    - Esc, a click outside, scrolling or switching tabs closes the menu.
  - **Copy:** `webview.copy()`.
  - **Add to note:**
    - It calls `notesUI.append`, then shows the notice `Added to "<title>".`
    - If the target is the note open in the editor, the text is added at the end of the editor's content, so typing continues and saving goes through `onEdit`. Otherwise only the data changes, then it's saved.
  - **Sub-menu:** opens on hover or on → key. ↑ ↓ Enter work.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Smoke test:**
  - Select text on a real page, right-click, Add to note → New note. The note contains the quote and the source line, and `notes.enc` has it after a restart.
  - With the side panel open, the first menu item adds to the open note, and the text appears there at once.
  - A capture with `desktopCapturer` while the menu is open doesn't show it.
- [ ] **Step 6: User check, then commit.** `feat: send selected text to a note`

### Task 3: Tab groups in the tab bar

**Files:**
- Create: `renderer/tab-groups.js`, `test/tab-groups.test.js`
- Modify:
  - `renderer/tabs.js`: groups, chips, collapse, `snapshot()` with groups
  - `renderer/session.js` and `test/session-model.test.js`: version 2
  - `renderer/app.js`: the tab right-click menu, restoring groups
  - `index.html`: chip and colour CSS, script tag
  - `README.md`

**Interfaces:**
- Consumes: `PWContextMenu.createMenu` from Task 2.
- Produces:
  - `PWTabGroups.GROUP_COLORS`: `[{ name, hex }]`, the 8 colours in the Global Constraints order.
  - `PWTabGroups.nextColor(usedNames: string[]): string` (a colour name).
  - `PWTabGroups.nextGroupName(usedNames: string[]): string`
  - `PWTabGroups.cleanName(s: string): string | null`
  - `PWTabGroups.insertIndex(order: [{ id, group }], groupId): number`, where a tab joining a group goes after that group's last tab.
  - `tabs.createGroup(tabIds, { name?, color?, savedId? }) → group`, `tabs.addToGroup(tabId, groupId)`, `tabs.ungroupTab(tabId)`
  - `tabs.updateGroup(groupId, { name?, color?, collapsed? })`, `tabs.closeGroup(groupId)`, `tabs.ungroup(groupId)`, `tabs.groups(): Group[]`
  - `Group = { id, name, color, collapsed, savedId: string | null }`
  - `tabs.onGroupChange(fn(group))`, for Task 4's linked saves.
  - **Session v2:** `{ version: 2, tabs: [{ url, title, group: number | null }], groups: [{ name, color, collapsed, savedId }], active }`. `group` is an index into `groups`.

- [ ] **Step 1: Write the failing tests.**
  - `nextColor([])` → `'blue'`; `nextColor(['blue', 'pink'])` → `'yellow'`; with all 8 used → `'blue'`.
  - `nextGroupName(['Group 1', 'Group 3'])` → `'Group 2'`.
  - `cleanName('  ')` → `null`; a 50-character name → its first 40 characters.
  - `insertIndex([{id:'a',group:'g'},{id:'b',group:'g'},{id:'c',group:null}], 'g')` → `2`.
  - **`validateSession`:**
    - A v1 file → v2 with `groups: []` and every tab `group: null`.
    - A v2 tab whose `group` index is out of range → `null`.
    - An unknown colour → `'blue'`.
    - A group no kept tab points to is dropped, and the indexes are renumbered.
  - **`sessionFromTabs`** keeps groups and drops blank tabs, without breaking group indexes.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - **Chip:** a group is drawn as a chip (`● Name`, in its colour) before its first tab, and its tabs get a 2 px top line in the group colour.
  - **Collapse:** clicking the chip collapses the group to the chip plus its tab count (`▸ 3`) and hides its tabs. If the active tab is in it, the next tab outside the group is activated.
  - **Tab right-click menu:**
    - `Add to new group`
    - `Add to group ▸` (the open groups)
    - `Remove from group`
  - **Chip right-click menu:**
    - `Rename…` (inline input on the chip; Enter saves, Esc cancels)
    - `Colour ▸` (the 8 colours)
    - `Collapse` / `Expand`
    - `Ungroup`
    - `Close group`
  - **Ctrl+Shift+T** after Close group reopens one tab at a time, as today.
  - **Hidden tabs:** Ctrl+Tab, Ctrl+1…9 and closing a tab only move through tabs that are visible (`tabs.visible()`), so the tabs of a collapsed group are skipped.
  - **Session:** saved with groups, and restored with groups, collapsed state included.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Smoke test:**
  - Make two groups and collapse one, then restart: the groups, colours, names and collapsed state come back, and only the active tab loads.
  - Ctrl+Tab skips the tabs of a collapsed group.
- [ ] **Step 6: User check, then commit.** `feat: tab groups in the tab bar`

### Task 4: Save groups and reopen them

**Files:**
- Modify:
  - `renderer/tab-groups.js` and its test: saved-group rules
  - `main.js`: `groups.enc` store, `groups:load` / `groups:save` IPC (sender check), waiting for it before quitting
  - `preload.js`: `workspace.groups`
  - `renderer/app.js`: 🗂 menu, open, link
  - `index.html`: 🗂 button and pop-over
  - `README.md`, `preview.html` (mark the three cards built)

**Interfaces:**
- Consumes: the `tabs` group API and `onGroupChange` from Task 3; `createSecureStore` from `lib/secure-store.js`.
- Produces:
  - `PWTabGroups.validateSaved(x): { version: 1, groups: Saved[] }`, where `Saved = { id, name, color, tabs: [{ url, title }], updated }`
  - `PWTabGroups.savedUpdateFor(saved: Saved, liveTabs: [{ url, title }], now): Saved | null`. It returns `null` when nothing kept is left, so an empty group is never saved.
  - `PWTabGroups.findOpenGroup(groups: Group[], savedId): Group | null`
  - `workspace.groups.load(): Promise<{ version: 1, groups }>` and `workspace.groups.save(data): Promise<{ ok, error? }>`

- [ ] **Step 1: Write the failing tests.**
  - **`validateSaved`:**
    - Garbage → `{ version: 1, groups: [] }`.
    - A group with no web tabs is dropped.
    - It keeps 50 groups and 50 tabs at most.
    - The name goes through `cleanName`, and a bad colour becomes `'blue'`.
  - **`savedUpdateFor`:**
    - Live tabs `[]` → `null`.
    - Blank tabs are dropped, and `updated = now`.
    - The same tabs as already saved → `null` (no write).
  - **`findOpenGroup`:**
    - Finds a group by `savedId`.
    - An unknown `savedId` → `null`.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - **🗂 button:** in the nav bar, before ☆. Its pop-over lists the saved groups (colour dot, name, `N tabs`, `open now` when open), each with **Open** and 🗑. At the bottom is **＋ Save open tabs as a group**, which groups every ungrouped tab and saves it.
  - **The chip menu gains:** `Save group` (when not saved) or `Saved ✓ · Stop saving` (unlinks it; the saved copy stays).
  - **Open:**
    - If the group is already open, the app switches to its first tab and expands it.
    - Otherwise its tabs open lazily at the end of the tab bar as a linked group, and the first one loads.
  - **Linked groups:** a change (tab added, closed or navigated, rename, colour) saves the group again, debounced by 1 s, through `savedUpdateFor`.
  - **🗑:** asks `Delete saved group "<name>"? Its tabs stay open if they are.` and unlinks any open copy.
  - **Main process:**
    - The store is created like `darkStore`, in `setupSession`.
    - It's added to `waitForSaves`.
    - IPC is accepted only from `mainWin.webContents`.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Smoke test:**
  - Save a group, close it, restart the app, and open it from 🗂: all its tabs come back in the group, with the same name and colour.
  - Opening it again only switches to it.
  - Closing a tab in the linked group, then restarting, leaves the saved copy without that tab.
  - `groups.enc` isn't readable as plain text.
- [ ] **Step 6: User check, then commit.** `feat: save tab groups and reopen them`
