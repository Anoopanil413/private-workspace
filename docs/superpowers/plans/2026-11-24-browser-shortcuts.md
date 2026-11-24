# Browser Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the usual browser keyboard shortcuts work in the workspace browser. Ctrl+T opens a blank tab with the cursor in the address bar, ready to type.

**Architecture:** One pure keymap, `renderer/shortcuts.js` (UMD), turns a key press into an action name. When focus is inside a web page (a `<webview>`), the host page never sees the key. So the main process listens to `before-input-event` on each webview, stops the matching keys, and forwards the action to the host page over IPC. When focus is in the host page (the address bar, the tab strip), a `keydown` listener uses the same keymap. Both routes call one `runAction` in `renderer/app.js`.

**Tech Stack:** Electron ^44.8.0, plain JS, `node:test`.

**Spec:** The user's request: "Ctrl+T should open a new tab, the keys we use on normal browsers should work, and after I open a new tab it should focus the address bar so I can start typing at once."

## Global Constraints

- **Shortcut list:**

  | Keys | Action |
  |---|---|
  | Ctrl+T | new tab |
  | Ctrl+W, Ctrl+F4 | close tab |
  | Ctrl+Shift+T | reopen closed tab |
  | Ctrl+Tab, Ctrl+PageDown | next tab |
  | Ctrl+Shift+Tab, Ctrl+PageUp | previous tab |
  | Ctrl+1…8 | tab N |
  | Ctrl+9 | last tab |
  | Ctrl+L, Alt+D, F6 | focus address bar |
  | Ctrl+R, F5 | reload |
  | Ctrl+Shift+R, Ctrl+F5, Shift+F5 | reload without cache |
  | Alt+Left / Alt+Right | back / forward |
  | Ctrl+F | find |
  | F3 / Shift+F3, Ctrl+G / Ctrl+Shift+G | find next / previous |
  | Ctrl+= (or +) / Ctrl+- / Ctrl+0 | zoom in / out / reset |
  | Ctrl+D | bookmark |

- **AltGr:** Ctrl and Alt pressed together is AltGr on many keyboards, so it never matches a Ctrl shortcut.
- **Ctrl+T on the Notes screen:** it switches to the Browser and opens a new tab. Every other browser shortcut does nothing while Notes is shown, so Ctrl+B, Ctrl+I, Ctrl+U and the other notes shortcuts stay free.
- **New tab:** `about:blank`, labelled "New tab", with an empty address bar that has focus.
- **After Enter in the address bar:** focus moves into the page, as in Chrome.
- **Ctrl+Shift+H** stays the global panic key and is not part of this keymap.

## Review Focus

1. **Typing in a web page form must not be eaten:** plain letters, Ctrl+C/V/X/Z/A and Ctrl+Backspace all pass through to the page. Tested (`matchShortcut` returns null for them).
2. **AltGr characters** (Ctrl+Alt+Q gives @ on some layouts) must not trigger shortcuts. Tested.
3. **Ctrl+W on the last tab** leaves one tab open and the app open. Covered by existing close behaviour, smoke-tested.
4. **Shortcuts pressed while focus is inside the page** must work: the IPC path is smoke-tested.

---

### Task 1: Keymap, tab helpers, wiring, find bar

**Files:**
- Create: `renderer/shortcuts.js`, `test/shortcuts.test.js`
- Modify:
  - `renderer/tabs.js`: blank new tab, `list()`, `reopen()`, closed-tab stack, `cycleIndex`, `indexForNumber`
  - `test/tabs-model.test.js`
  - `main.js`: `before-input-event` on webviews, sending `workspace-shortcut`
  - `preload.js`: `onShortcut`
  - `renderer/app.js`: `runAction`, host `keydown`, focus behaviour, find, zoom
  - `index.html`: find bar
  - `README.md`

**Interfaces:**
- Produces (UMD `PWShortcuts`): `matchShortcut(input: { type?, key, control, shift, alt, meta }): string | null`. It returns one of: `new-tab`, `close-tab`, `reopen-tab`, `next-tab`, `prev-tab`, `tab-1` … `tab-8`, `last-tab`, `focus-url`, `reload`, `hard-reload`, `back`, `forward`, `find`, `find-next`, `find-prev`, `zoom-in`, `zoom-out`, `zoom-reset`, `bookmark`. Also `fromKeyboardEvent(e: KeyboardEvent)`, which returns that input shape.
- Produces (`PWTabs`):
  - `cycleIndex(length, index, delta): number`, which wraps around.
  - `indexForNumber(length, n): number | null`. Values 1–8 give `n-1` if that tab exists; 9 gives the last tab.
  - `createTabs(...)` gains `list(): Tab[]`, `reopen(): Tab | null`, and `open(url, { background })`.
  - `NEW_TAB_URL = 'about:blank'`.
- Produces (IPC): `workspace-shortcut`, carrying `{ action: string }`, sent from main to host. Preload exposes `window.workspace.onShortcut(fn)`.

- [ ] **Step 1: Write the failing tests:**
  - `matchShortcut maps the browser shortcuts`: one assertion per row of the table.
  - `matchShortcut ignores typing and editing keys`: `a`, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z, Ctrl+A and Ctrl+Backspace each give null.
  - `matchShortcut ignores AltGr (Ctrl+Alt)`.
  - `matchShortcut ignores key-up events`.
  - `cycleIndex wraps both ways`.
  - `indexForNumber: Ctrl+9 is the last tab; a number beyond the tab count is null`.
- [ ] **Step 2: Run them.** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement `renderer/shortcuts.js` and the tab helpers.**
- [ ] **Step 4: Run them.** `npm test`. Expected: all pass.
- [ ] **Step 5: Wire it up.**
  - **Main:** webviews listen to `before-input-event`. On a match, call `preventDefault()` and send `workspace-shortcut`.
  - **Host page:** a `keydown` listener uses the same keymap. `runAction` carries out each action.
  - **Find bar:** an input, a match count, ↑ / ↓ and ×. It uses `findInPage` and `found-in-page`, Enter / Shift+Enter move between matches, and Esc closes it. Switching tabs closes it.
  - **Zoom:** steps of 0.5 between −3 and +5.
  - **New tabs:** the "+" button and Ctrl+T open a blank tab and focus the address bar.
  - **README:** add the shortcuts.
- [ ] **Step 6: Smoke-test** with a local server:
  - Ctrl+T from inside a page opens a tab, and the address bar has focus.
  - Typing a site and pressing Enter loads it and moves focus into the page.
  - Ctrl+W, Ctrl+Shift+T, Ctrl+Tab and Ctrl+1 all work.
  - Ctrl+F finds a word and shows the count.
  - Ctrl+= changes the zoom.
  - Ctrl+C in a page text box still copies.
  - No console errors.
- [ ] **Step 7: User check, then commit.** `feat: browser keyboard shortcuts; Ctrl+T focuses the address bar`
