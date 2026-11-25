# Restore Tabs, Blur When Unfocused, Dark Websites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three features picked on the preview page:
1. Open tabs come back after a restart.
2. The workspace blurs when another app has focus.
3. Websites can be shown dark: either the site's own dark theme, or a forced dark look, chosen per site.

**Architecture:**
- **Saved settings:** a small encrypted JSON store, `lib/secure-store.js` (DPAPI through `safeStorage`, like notes), keeps both the tab session and the dark-mode choices. Host names and URLs are browsing history, so they aren't stored in plain text.
- **Restore tabs:** the host page saves its tab list, debounced and on quit. At start-up it restores them, and background tabs only load when first opened.
- **Blur:** the main process sends window focus changes to the host page, which toggles a CSS blur over everything, the web pages included.
- **Dark mode:** applied per webview by the main process through the Chrome DevTools Protocol: `Emulation.setEmulatedMedia` asks the site for its dark theme, and `Emulation.setAutoDarkModeOverride` forces Chromium's automatic dark mode. It's re-applied on every main-frame navigation, using that site's setting.

**Tech Stack:** Electron ^44.8.0, plain JS, `node:test`. No new dependencies.

**Spec:** The preview cards `restore-tabs`, `blur-unfocused` and `dark-sites` in `preview.html`.

## Global Constraints

- **Privacy:** tab URLs, titles and per-site dark settings are stored encrypted (`safeStorage`). An unreadable file means starting fresh. It's never shown to the user as an error and never crashes the app.
- **Restore:**
  - At most 50 tabs are saved.
  - Only `http(s)` URLs are kept, so blank tabs are dropped.
  - Restored tabs keep their order and which tab was active.
  - Only the active tab loads at start-up; the others load when first clicked, showing their saved title until then.
  - Pages' pop-up windows aren't saved.
- **Blur:**
  - On by default, and switched with a toggle button in the status strip that's remembered.
  - It blurs as soon as the window loses focus and clears when focus returns.
  - It never blurs while the window has focus. Moving focus between the address bar, the notes and a web page doesn't count as losing focus.
- **Dark mode:**
  - Three choices per site: `system` (no change, the default), `dark` (ask the site for its dark theme) and `force` (Chromium's automatic dark mode as well).
  - A "Use for all sites" option sets the default for sites without their own choice.
  - The choice applies at once to every open tab on that site, without a reload where Chromium allows it.
- **Pacing:** one task at a time. The user checks each in the app, then commits.

## Review Focus

1. **Restoring with a lost or corrupt session file:** the app starts with the home tab and doesn't crash. Tested (`secure-store`).
2. **Closing the app right after opening a tab:** the tab is in the session next time, because the session is saved when quitting. Tested (`whenIdle` path) and smoke-tested.
3. **Opening a native dialog or a page pop-up from the app:** the main window loses focus and blurs. That's expected: the dialog has focus, not the workspace. Smoke-tested.
4. **A site in `force` mode navigating to another site:** the next site uses *its* own setting, not the previous one. Tested (`darkModeFor`) and smoke-tested.
5. **The DevTools Protocol failing to attach** (another debugger is attached): dark mode quietly does nothing for that tab, with no crash. Smoke-tested by forcing the attach to fail.

---

### Task 1: Restore tabs after restart

**Files:**
- Create: `lib/secure-store.js`, `test/secure-store.test.js`, `test/session-model.test.js`
- Modify:
  - `renderer/tabs.js`: lazy tabs, `snapshot()`, `sessionFromTabs`, `onListChange`
  - `test/tabs-model.test.js`
  - `main.js`: `session:load` and `session:save` IPC, wait for the store before quitting
  - `preload.js`: `workspace.session`
  - `renderer/app.js`: restore at start-up, save on change
  - `README.md`

**Interfaces:**
- Produces:
  - `createSecureStore({ file, cipher, validate: (x) => T, empty: () => T }) -> { load(): Promise<T>, save(data: T): Promise<void>, whenIdle(): Promise<void> }`
    - `load` returns `empty()` when the file is missing, unreadable or invalid, or when encryption is unavailable.
    - `save` validates first, then writes tmp + rename, one save at a time.
  - `validateSession(x): Session`, where `Session = { version: 1, tabs: [{ url, title }], active: number }`.
    - Keeps only `http(s)` URLs, cuts titles to 200 characters and keeps at most 50 tabs.
    - `active` is clamped to the tab range, or 0.
  - `sessionFromTabs(tabs: { url, title }[], activeIndex: number): Session`, in `PWTabs`. It applies the same filtering and keeps `active` pointing at the same tab after blank tabs are removed.
  - `createTabs` additions:
    - `open(url, { background, lazy, title })`: a lazy tab doesn't set its webview `src` until it's first activated, and shows `title` until then.
    - `onListChange(fn)`: fires on open, close, activate, navigation and title change.
  - IPC: `session:load` returns a `Session`. `session:save(session)` returns `{ ok }`.
  - Preload: `window.workspace.session = { load(), save(s) }`.

- [ ] **Step 1: Write the failing tests:**
  - `secure-store`:
    - round trip
    - missing file → empty
    - garbage file → empty, and the next save overwrites it
    - encryption unavailable → empty, and save throws
    - invalid data on save is rejected
    - no .tmp file remains
    - overlapping saves keep the last
  - `validateSession`:
    - drops `about:blank`, `file:` and `javascript:` URLs
    - keeps at most 50 tabs
    - clamps `active`
    - cuts titles to 200 characters
    - turns garbage into an empty session
  - `sessionFromTabs`: keeps the active tab pointing at the right one when blank tabs before it are dropped.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** `lib/secure-store.js`, `validateSession` (in `lib/secure-store.js`'s companion `lib/session.js`) and `sessionFromTabs`.
- [ ] **Step 4: Run them.** Expected: all pass.
- [ ] **Step 5: Wire it up.**
  - The store file is `userData/session.enc`.
  - The host page saves 1 s after the last list change. On quit, main waits for the session store like the notes store.
  - At start-up:
    - **With saved tabs:** open them all as lazy, activate the saved one, and show the notice "Restored N tabs".
    - **Without:** open the home tab.
- [ ] **Step 6: Smoke-test:**
  - Open 3 sites and make the second active, then quit and relaunch. The same 3 tabs are there, in order, the second is active, and only it has loaded.
  - Clicking another tab loads it.
  - Opening a tab and quitting at once: the tab is still there next time.
  - A garbage `session.enc` gives the home tab and no error.
- [ ] **Step 7: User check, then commit.** `feat: restore tabs after restart (encrypted session)`

### Task 2: Blur when unfocused

**Files:**
- Modify:
  - `main.js`: forward the window's `blur` and `focus` events
  - `preload.js`: `onWindowFocus`
  - `index.html`: toggle button in the status strip, blur CSS
  - `renderer/app.js`
  - `README.md`

**Interfaces:**
- Produces:
  - IPC `workspace-focus`, carrying `{ focused: boolean }`, sent from main to the host.
  - Preload: `window.workspace.onWindowFocus(fn)`.
  - The blur is the class `privacy-blur` on `body`. When the toggle is on, it applies `filter: blur(14px)` to every child of `body` except the status strip, plus a "Hidden while you're in another app" label.
  - localStorage `blur-when-away`: `'1'` or `'0'`. A missing value means on.

- [ ] **Step 1: Write the failing test.** A pure `shouldBlur({ enabled, focused })` in `renderer/notices.js`'s sibling `renderer/blur.js` (UMD), with tests: blurs only when enabled and not focused.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Wire it up.**
  - Main sends `{ focused }` on the window's `blur` and `focus`, and the current state once the page loads.
  - The host toggles the class. The toggle button shows `◐ Blur when away` with `aria-pressed`.
- [ ] **Step 6: Smoke-test:**
  - Focus another window: the class is set, and a capture of the window's contents is measurably blurred, compared by pixel variance against the focused capture.
  - Focus back: the blur clears.
  - With the toggle off there's never a blur, and the setting survives a reload.
- [ ] **Step 7: User check, then commit.** `feat: blur the workspace when another app has focus`

### Task 3: Dark mode for websites

**Files:**
- Create: `lib/dark-mode.js`, `test/dark-mode.test.js`, `renderer/dark-ui.js`
- Modify:
  - `main.js`: apply per webview, IPC, prefs in `secure-store` (`userData/dark-sites.enc`)
  - `preload.js`: `workspace.dark`
  - `index.html`: 🌙 button and pop-over in the nav
  - `renderer/app.js`
  - `README.md`

**Interfaces:**
- Produces:
  - `DarkPrefs = { version: 1, default: Mode, sites: { [host]: Mode } }`, where `Mode = 'system' | 'dark' | 'force'`.
  - `validateDarkPrefs(x): DarkPrefs`. It drops unknown modes and invalid hosts, and keeps at most 1000 sites.
  - `darkModeFor(prefs, url): Mode`. It returns the site's own setting, or the default. Non-http(s) pages give `system`.
  - `cdpCommandsFor(mode): [method, params][]`:
    - `system` gives `[['Emulation.setEmulatedMedia', { features: [] }], ['Emulation.setAutoDarkModeOverride', {}]]`.
    - `dark` gives `[['Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }], ['Emulation.setAutoDarkModeOverride', {}]]`.
    - `force` gives the same media command and `['Emulation.setAutoDarkModeOverride', { enabled: true }]`.
  - `setSiteMode(prefs, host, mode): DarkPrefs` and `setDefaultMode(prefs, mode): DarkPrefs`.
  - IPC:
    - `dark:get(url)` returns `{ host, mode, siteMode, defaultMode }`.
    - `dark:set({ host, mode })` and `dark:set-default(mode)` re-apply to all open tabs.
  - Preload: `window.workspace.dark = { get(url), set(host, mode), setDefault(mode) }`.

- [ ] **Step 1: Write the failing tests** for `validateDarkPrefs`, `darkModeFor` (site over default, other host, non-web URL), `cdpCommandsFor` (all three modes) and `setSiteMode` / `setDefaultMode`. Setting a site to the default mode removes its entry.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `lib/dark-mode.js`.**
- [ ] **Step 4: Run them.** Expected: all pass.
- [ ] **Step 5: Wire it up.**
  - **Main:**
    - For each webview, attach `webContents.debugger` (`1.3`), wrapped in try/catch.
    - On `did-start-navigation` (main frame, new document) and on `dom-ready`, send `cdpCommandsFor(darkModeFor(prefs, url))`.
    - Detach when the webview is destroyed.
  - **Host page:**
    - The 🌙 button (filled when dark is on) opens a pop-over with three options for this site ("Normal", "Site's dark theme", "Force dark") and a "Use for all sites" link.
- [ ] **Step 6: Smoke-test** with a local server: one page that has a `prefers-color-scheme: dark` style and one plain white page.
  - `dark` gives the first page its dark colours, read from its computed background.
  - `force` makes the white page dark: a capture's average brightness drops.
  - Navigating to another host uses that host's mode.
  - The setting survives a restart.
  - A failed debugger attach does nothing.
- [ ] **Step 7: User check, then commit.** `feat: dark mode for websites (site theme or forced, per site)`
