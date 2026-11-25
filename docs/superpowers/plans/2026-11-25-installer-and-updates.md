# Installer, Auto-Update and Preview Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. Refresh the feature preview page: mark what's built and add new ideas.
2. Ship the app as a Windows installer (.exe).
3. Have installed copies update themselves whenever a new version tag is released.

**Architecture:**
- **Installer:** `electron-builder` builds an NSIS installer that installs per user, with no admin rights needed and a Start-menu entry.
- **Releases:** pushing a `vX.Y.Z` tag runs a GitHub Actions workflow on Windows. It checks that the tag matches `package.json`, runs the tests, builds the installer and publishes a GitHub Release with `latest.yml`.
- **Updates:** installed copies use `electron-updater` against that public repo. They check at start-up and every 6 hours, download quietly, and install on the next quit. A notice offers "Restart now".
- **Update logic:** lives in `lib/updater.js`, wrapped around an injected `autoUpdater`, so it can be unit-tested.

**Tech Stack:** Electron ^44.8.0, `electron-builder` 26.18.0 (dev), `electron-updater` 6.8.11, GitHub Actions, GitHub Releases (public repo `Anoopanil413/private-workspace`, so no token is built into the app).

**Spec:** The user's request: "I want the exe-like app, and whenever a new update is done I want it updated for users, like version tag updates." Plus "update the preview route and give me new features".
Their decisions:
- Update on **every version tag**.
- **Download quietly, install on restart.**

## Global Constraints

- **Version source:** `package.json` `version` is the single source of truth. A release tag must be `v` + that version; the workflow fails otherwise.
- **Where updates come from:** GitHub Releases on `Anoopanil413/private-workspace`. Releases are published, not drafts, so installed apps see them at once.
- **Same notes folder:** the installed app must use the same data folder as `npm start` (`%APPDATA%\private-workspace`), so notes, bookmarks and settings carry over.
- **No unprotected UI:**
  - No update dialogs: update status shows in the app's own (protected) notice bar.
  - The installer runs silently (`quitAndInstall(true, true)`), so no installer window appears during an update.
- **Development runs (`npm start`) never check for updates.** Only the installed app does.
- **Dependencies:** pinned exact, at least 14 days old.
- **Code signing is out of scope.** The installer is unsigned, so Windows SmartScreen shows "unrecognised app" on first install. This is documented in the README.
- **Pacing:** one task at a time. The user checks each, then commits and pushes; the executor never pushes or tags.

## Review Focus

1. **Notes after switching from `npm start` to the installed app:** they must still be there (same `userData` folder). Smoke-tested by checking `app.getPath('userData')` in the packaged build.
2. **Offline, or GitHub unreachable:** the update check fails quietly. No error notice, and the app works normally. Tested in Task 3.
3. **Tag and version mismatch** (tag `v1.2.0`, `package.json` still says 1.1.0) must fail the release instead of publishing a wrong build. Tested in Task 4.
4. **koffi native module in the packaged app:** native-guard must still load, so pop-up protection still works. Smoke-tested in Task 2 by launching the unpacked build.
5. **"Restart now" with unsaved notes:** the last edit must be saved before the app quits to install. Tested in Task 3.

---

### Task 1: Preview page refresh

**Files:**
- Modify: `preview.html`

- [ ] **Step 1: Mark as built:** `shortcuts-find` (browser shortcuts and find). Add two cards already marked built: `rich-notes` (rich-text notes with toolbar) and `browser-shortcuts`. Mark `installer` "In progress", with an updated mock: installer plus update notice.
- [ ] **Step 2: Add new idea cards:**
  - Settings page (panic key, auto-lock, ad-block switch, update status)
  - Restore tabs after restart
  - Separate accounts per tab (two Gmail logins side by side)
  - Command palette (Ctrl+K searches tabs, notes and bookmarks)
  - Blur when unfocused (contents blur when you switch to another app)
  - Downloads list
  - Dark mode for websites
  - Pin and colour-tag notes
- [ ] **Step 3: Check the page.** Open `npm run preview`: the built and in-progress tags show, the filters work, and there are no console errors.
- [ ] **Step 4: User check, then commit.** `docs: refresh feature preview (built marks, new ideas)`

### Task 2: Windows installer (`npm run dist`)

**Files:**
- Modify: `package.json` (`build` config, `dist` script, `productName`, `devDependencies`), `main.js` (pin the `userData` path), `.gitignore` (`dist/`), `README.md`
- Create: `build/icon.png` (512×512) and `scripts/make-icon.js`, which renders the shield icon from SVG with Electron so no image tool is needed

**Interfaces:**
- Produces:
  - `npm run dist` builds `dist/Private Workspace Setup <version>.exe` and `dist/latest.yml`.
  - The `build.publish` config is `{ provider: 'github', owner: 'Anoopanil413', repo: 'private-workspace', releaseType: 'release' }`.

- [ ] **Step 1: Install the dependency.** `npm install --save-dev --save-exact electron-builder@26.18.0`
- [ ] **Step 2: Configure the build.**
  - Targets: `win` / `nsis`, with `oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`, `createDesktopShortcut: true`.
  - `files`: everything except `docs/`, `test/` and `.superpowers/`.
  - `asarUnpack` for `koffi`.
- [ ] **Step 3: Pin the data folder.** In `main.js`, before anything reads `userData`, call `app.setPath('userData', path.join(app.getPath('appData'), 'private-workspace'))`. This keeps the `npm start` folder.
- [ ] **Step 4: Build.** Run `npm run dist`. Expected: the installer and `latest.yml` are in `dist/`.
- [ ] **Step 5: Smoke-test** by launching `dist/win-unpacked/Private Workspace.exe`, without installing:
  - The window opens and shows the shield.
  - `userData` ends in `private-workspace`.
  - native-guard is running.
  - No console errors.
- [ ] **Step 6: User check, then commit.** The user may run the installer themselves. Commit: `build: Windows installer with electron-builder`

### Task 3: Auto-update

**Files:**
- Create: `lib/updater.js`, `test/updater.test.js`
- Modify:
  - `package.json`: add `electron-updater@6.8.11`.
  - `main.js`: start the updater, add the `update:install` IPC, flush notes before installing.
  - `preload.js`: `onUpdate`, `installUpdate`.
  - `renderer/notices.js`: a notice can have an action button.
  - `renderer/app.js`
  - `README.md`

**Interfaces:**
- Produces:
  - `createUpdater({ autoUpdater, isPackaged: boolean, onReady: (version: string) => void, log?: (msg) => void, intervalMs = 6 * 3600 * 1000, setInterval = global.setInterval }) -> { start(): void, install(): void }`
  - `start` does nothing unless packaged. It sets `autoDownload = true` and `autoInstallOnAppQuit = true`, checks now and then every `intervalMs`, and catches and logs errors without notifying.
  - `update-downloaded` calls `onReady(info.version)`, once per version.
  - `install()` calls `autoUpdater.quitAndInstall(true, true)`.
- Produces (IPC):
  - `update:ready`, carrying `{ version }`, sent from main to the host.
  - `update:install`, sent from the host to main. Main waits for pending notes saves, then installs.
- Produces (notices): `show(text, { sticky, action: { label, onClick } })`.

- [ ] **Step 1: Write the failing tests:**
  - `start does nothing in development (not packaged)`
  - `start enables background download and install-on-quit, checks now and on an interval`
  - `a failed check (offline) is logged, not reported, and later checks still run`
  - `update-downloaded reports the version once`
  - `install quits and installs silently and relaunches`
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `lib/updater.js`.**
- [ ] **Step 4: Run them.** Expected: all pass.
- [ ] **Step 5: Wire it up.**
  - When an update is ready, show a sticky notice: "Version X is ready. It installs when you close the app." with a **Restart now** button.
  - The button sends `update:install`. Main calls `notesStore.whenIdle()`, then `install()`.
- [ ] **Step 6: Smoke-test** against a local update feed: a local HTTP server serving `latest.yml` for a higher version with a matching file and sha512. Run the dev app with `forceDevUpdateConfig` pointing at it. Expected:
  - The download completes and the notice appears with the button.
  - With the server stopped, there's no error notice.
- [ ] **Step 7: User check, then commit.** `feat: auto-update from GitHub Releases`

### Task 4: Release on version tag

**Files:**
- Create: `.github/workflows/release.yml`, `scripts/check-version.js`, `test/check-version.test.js`
- Modify: `package.json` (`release` helper scripts), `README.md` ("How to release")

**Interfaces:**
- Produces: `checkVersion(tag: string, version: string): { ok: boolean, message: string }`. It accepts `v1.2.3` against `1.2.3`, and also refs like `refs/tags/v1.2.3`.

- [ ] **Step 1: Write the failing tests.** `v1.2.3` matches 1.2.3. `refs/tags/v1.2.3` matches. `v1.2.4` against 1.2.3 is not ok and the message names both. `1.2.3` without the `v` is not ok.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement the check.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Add the workflow.**
  - Trigger: `on: push: tags: ['v*']`, running on `windows-latest`.
  - Permissions: `contents: write`.
  - Steps:
    1. `actions/checkout`, then `actions/setup-node` with Node 22.
    2. `npm ci`.
    3. `node scripts/check-version.js "$GITHUB_REF"`.
    4. `npm test`.
    5. `npx electron-builder --win --publish always`, with `GH_TOKEN` set to `${{ secrets.GITHUB_TOKEN }}`.
- [ ] **Step 6: Document releasing in the README.**
  1. `npm version patch` (or `minor` / `major`), which bumps the version and creates the tag.
  2. `git push --follow-tags`.
  3. The Actions run builds and publishes the release.
  4. Installed apps update within 6 hours, or on next start.
- [ ] **Step 7: Validate the workflow.** Check the YAML parses (`node -e` with a YAML parse through a pinned `yaml` dev dependency, or `actionlint` if available).
- [ ] **Step 8: User check.** The user pushes a first tag (e.g. `v1.0.1`) and watches the Actions run. Commit: `ci: build and publish a release on version tags`
