# Private Workspace

A desktop app with a **web browser and a notes pad whose contents are hidden from screen capture**.
Screenshots, screen recording, screen sharing (Zoom, Teams, Meet, Discord…) and monitoring apps don't
see it, while you see it normally on your monitor. In a capture the window is simply absent — whatever
is behind it shows instead.

Use it for anything you don't want to appear on a shared or recorded screen: personal browsing,
passwords and banking pages, private notes, messages.

## Requirements

- **Windows 10 version 2004 (May 2020 update) or later**, or Windows 11. The capture exclusion is a
  Windows feature; on older Windows versions the window shows up black in captures, and on macOS/Linux
  it isn't hidden reliably.
- [Node.js](https://nodejs.org/) 18 or later (includes `npm`).

## Install

Run `Private-Workspace-Setup-<version>.exe`. It installs for your Windows user only (no admin rights needed) and
adds Start-menu and desktop shortcuts.

The installer isn't code-signed, so the first time Windows shows **"Windows protected your PC"**: click
**More info → Run anyway**.

Your notes, tabs and settings live in `%APPDATA%\\private-workspace`, the same folder `npm start` uses, so they
carry over between the installed app and a development run.

## Updates

The installed app updates itself from this repository's GitHub Releases. It checks when it starts and every 6
hours, downloads a new version quietly in the background, then shows **"Version X is ready. It installs when you
close the app."** with a **Restart now** button. Your last note edit and open tabs are saved before it restarts.
If you're offline, or GitHub can't be reached, nothing is shown and it tries again later. It never installs an
older version. (Running with `npm start` never checks for updates.)

## Run from source

```
git clone https://github.com/Anoopanil413/private-workspace.git
cd private-workspace
npm install     # first time only
npm start
```

If `npm start` says Electron failed to install, run `node node_modules/electron/install.js` once.

## Build the installer

```
npm run dist    # -> dist\Private-Workspace-Setup-<version>.exe and dist\latest.yml
```

The app icon is `build/icon.png`; `npm run icon` redraws it from the SVG in `scripts/make-icon.js`.

## How to release

From a clean working tree on the branch you release from:

```
npm run release:patch   # 1.0.0 -> 1.0.1 (fixes)
npm run release:minor   # 1.0.0 -> 1.1.0 (new features)
npm run release:major   # 1.0.0 -> 2.0.0 (big changes)
```

Each one runs the tests, bumps the version in `package.json`, commits it as `release: v<version>`, creates the
tag `v<version>` and pushes both. The tag starts the **Release** workflow on GitHub Actions
(`.github/workflows/release.yml`): it checks the tag matches `package.json`, runs the tests, builds the installer
and publishes it as a GitHub Release with `latest.yml`. Installed apps find it on their next start or within 6
hours, download it quietly and install it on restart.

A tag that doesn't match `package.json` (for example `v1.2.0` pushed by hand while the version is still 1.1.0)
fails the workflow and publishes nothing. To redo a failed release, fix the problem, delete the tag
(`git push --delete origin v1.2.0` and `git tag -d v1.2.0`) and the draft or partial release on GitHub if one
exists, then tag again.

## Browser shortcuts

The usual browser keys work, also while you're typing inside a web page:

| Keys | Action |
|---|---|
| Ctrl+T | New tab (the cursor goes to the address bar, so you can type straight away) |
| Ctrl+W, Ctrl+F4 / Ctrl+Shift+T | Close tab / reopen the last closed tab |
| Ctrl+Tab, Ctrl+PgDn / Ctrl+Shift+Tab, Ctrl+PgUp | Next / previous tab |
| Ctrl+1 … Ctrl+8 / Ctrl+9 | Go to that tab / the last tab |
| Ctrl+L, Alt+D, F6 | Address bar |
| Ctrl+R, F5 / Ctrl+Shift+R, Ctrl+F5 | Reload / reload without the cache |
| Alt+← / Alt+→, mouse back/forward buttons | Back / forward |
| Ctrl+F, then Enter / Shift+Enter, F3 / Shift+F3 | Find in page, next / previous match |
| Ctrl+= / Ctrl+- / Ctrl+0 | Zoom in / out / reset |
| Ctrl+D | Add the page to quick open |
| Ctrl+Shift+N | Notes beside the page (open / close) |

The address bar opens sites (`example.com`), local addresses (`localhost:3000`, `192.168.1.10`) and searches
DuckDuckGo for anything else. On the Notes screen only Ctrl+T works (it switches to the browser), so the notes
editor keeps its own keys.

## Tab groups

Right-click a tab:

- **Add to new group**: you can type the group's name straight away (Enter keeps it, Esc keeps the default
  `Group N`).
- **Add to group ▸**: one of the open groups.
- **Remove from group**.

A group shows as a coloured chip in front of its tabs. Click the chip to collapse the group into the chip
(it shows how many tabs it has), and click again to expand it. Right-click the chip to **Rename**, change its
**Colour** (8 colours), **Collapse / Expand**, **Ungroup** (its tabs stay open) or **Close group** (Ctrl+Shift+T
reopens its tabs one by one). A group's tabs always sit together. Ctrl+Tab and Ctrl+1 … 9 skip the tabs of a
collapsed group; opening one of them expands the group. Groups, their names, colours and collapsed state come back
with your tabs after a restart (stored encrypted with the session).

## Notes beside the page

Click **📝** next to the address bar, or press **Ctrl+Shift+N** (also while you're in a web page), to open a
note on the right of the page, so you can read and write at the same time. Click the note's title at the top
of the panel to pick or search another note; **＋** starts a new one. Drag the panel's left edge to resize it.
The app remembers whether it was open and its width. It's the same note as on the Notes screen: while you type
in it, the formatting keys below work, and browser keys the editor doesn't use (Ctrl+T, Ctrl+W, Ctrl+L …) still
do. In a very narrow window the panel hides until there's room.

## Send selected text to a note

Select text on a web page and right-click it:

- **Copy** copies it.
- **Add to "<note>"** (when a note is open beside the page) adds it to that note straight away.
- **Add to note ▸** lists your five newest notes and **＋ New note**.

The text goes in as a quote, followed by the page's title and address (as plain text: notes don't keep links),
for example `— Careers · careers.example.com/jobs`. Formatting from the page isn't kept, and very long selections
are cut at 20,000 characters. The text goes straight into your encrypted notes, never through the clipboard. The
menu is drawn inside the app's window, so it's hidden from screen capture like the rest of the app. Right-clicking
without a selection does nothing, as before.

## Notes formatting

Notes are rich text: formatting shows as you type. Use the toolbar above the note or these keys:

| Keys | Format |
|---|---|
| Ctrl+B / Ctrl+I / Ctrl+U | Bold / italic / underline |
| Ctrl+Shift+X | Strikethrough |
| Ctrl+Shift+7 / Ctrl+Shift+8 / Ctrl+Shift+9 | Numbered list / bulleted list / checklist (click a box to tick it) |
| Tab / Shift+Tab | Indent / outdent a list item (Tab types a tab elsewhere) |
| Ctrl+E | Code |
| Ctrl+Shift+V | Paste as plain text |

Pasting from web pages, Word or Google Docs keeps bold, italic, underline, strikethrough, lists and headings;
fonts, colours, images, links and scripts are removed. Notes written in Markdown by older versions are converted
to formatted notes the first time they open.

## How it's protected
## How to use it

When the app opens, the status bar at the top reads **Hidden from screen capture** (green). Everything
inside the window is protected from that moment.

| Part | What it does |
|---|---|
| **Browser** tab | A normal web browser (starts on DuckDuckGo). Type an address or search in the bar and press Enter; use ← → ⟳ for back, forward and reload. Logins and cookies are kept between sessions. Links that open new windows open in protected pop-up windows, not your default browser. |
| **Notes** tab | A plain notes pad. Saved automatically on this computer as you type. |
| **Turn off** / **Turn on** button | Switches the protection off (the window then appears in captures like any other app) and back on. While it's off the status bar turns red, reads **Visible to screen capture**, and a warning banner shows. |
| Notices bar | Tells you when the app did something on your behalf, e.g. saved a download, saved a PDF instead of printing, or blocked a link that would open another app. |

**Downloads** go straight to `Downloads\Private Workspace` (no Save dialog). **Printing** from a page
saves a PDF to the same folder instead of opening the print dialog. **Uploads** use the app's own
file picker, which is also hidden.

## Check that it works

1. Start the app and open any page in it.
2. Press **Win + Shift + S** (Snipping Tool) or **PrtScn**, or start a screen share in Zoom/Teams/Meet
   and look at your own preview.
3. The Private Workspace window should be missing from the image — you'll see the desktop or the window
   behind it. Click **Turn off** and try again: now it appears.

## How it works

- Every window the app creates calls Electron's `setContentProtection(true)`, which uses the Windows
  API `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`. Windows then leaves those windows out of
  every capture (screenshot APIs, Desktop Duplication, Graphics Capture), while still drawing them on
  your monitor.
- Some windows are created by Chromium rather than by the app — `<select>` dropdowns, the colour picker,
  `alert()`/`confirm()` boxes, dialogs. `native-guard.js` watches for any new window created by this
  process (a WinEvent hook, backed by a once-a-second sweep) and applies the same protection to it the
  moment it appears.
- Things that would open **outside** the protected process are replaced or blocked: the system print
  dialog (→ PDF), Chromium's file picker (→ the app's own picker), Save dialogs (→ automatic downloads),
  links to other apps such as `mailto:` (→ blocked), notifications, camera, microphone and location
  (→ denied).
- Web pages run sandboxed in their own session, with no access to Node.js or your files.

### What's protected

| What | How | Verified |
|---|---|---|
| Main window and pages' pop-up windows | `setContentProtection(true)` on every window the app creates | Hidden in a capture made with Electron's `desktopCapturer` |
| `<select>` dropdowns, colour picker, `alert()`/`confirm()` | `native-guard.js` protects every window this process creates, at the moment it's created | Windows reports them protected |
| File pickers (uploads) | Chromium's picker runs in a helper process that can't be protected, so uploads use the app's own Open dialog instead | Protected; files reach the page normally |
| `window.print()` | The Windows print dialog belongs to `explorer.exe` and can't be protected, so the page is saved as a PDF to `Downloads\Private Workspace` instead | No dialog opens |
| Links that open another app (`mailto:`, `whatsapp:` …) | Blocked, with a notice | — |
| Downloads | Saved straight to `Downloads\Private Workspace`, no Save dialog | — |
| Notifications, camera, microphone, location | Denied (notifications would appear outside the window) | — |
| Exporting / importing notes | Export writes straight to `Downloads\Private Workspace` (no Save dialog): **encrypted** `.pwnotes` (your password, scrypt + AES-256-GCM; opens on any PC) or plain `.txt` (formatting removed; checklists as `[x]` / `[ ]`). Import uses the app's own Open dialog and adds notes without duplicating ones you have: `.pwnotes` keeps all formatting, `.md` files are converted to formatted notes, other text files come in as plain lines | Unit-tested (`notes-export`) |
| Bright pages lighting up the room | **Dark mode for websites** (🌙 button next to the address bar), per site: *Normal (as Windows)*, *Site's dark theme* (asks the site for its own dark design), or *Force dark* (darkens any page). "Use for all sites" sets the default. Choices are stored encrypted | Unit-tested (`dark-mode`); brightness measured on real pages |
| People looking at your screen | **Blur when away** (on by default, ◐ button in the top bar): while another app is in front, everything in the workspace, web pages included, is blurred, and it clears when you click back in | Unit-tested (`blur`); blur measured on a real capture |
| Your open tabs | Saved encrypted (Windows DPAPI) in `session.enc` and reopened on the next start. Only the tab you were on loads straight away; the others load when you click them | Unit-tested (`secure-store`, `session`) |
| Links that open a new tab (`target=_blank`, Ctrl+click) | Open as a tab inside the workspace. `window.open()` with a size (sign-in pop-ups) still gets a protected pop-up window, so logins keep working | Unit-tested (`routeWindowOpen`) |
| Ads and trackers | Requests to known ad/tracking servers are blocked (Ghostery's prebuilt EasyList + EasyPrivacy lists, downloaded on first launch and refreshed weekly). The 🛡 badge shows the count; switch it off per site | Unit-tested (`adblock`) |
| Window titles in the taskbar and Alt+Tab | Every window, including pages' pop-ups, keeps the title "Private Workspace" | Unit-tested (`lockTitle`) |
| Someone walks up / you need it gone now | Panic key **Ctrl+Shift+H** hides every window (also from the taskbar and Alt+Tab), from any app; press again to restore. Launching the app again also brings it back (only one copy ever runs, so two copies can't overwrite each other's notes) | Unit-tested (`createPanic`) |

## Limits

- Only what's **inside this app** is protected. Your other apps (Chrome, VS Code, …) are still captured;
  Windows doesn't let one app hide another app's windows.
- It hides the window from **software** capture only. A phone camera pointed at the screen, or a
  hardware capture card, still sees it.
- Opening a downloaded file or printing a saved PDF happens in other apps, which are captured.
- Folder uploads and the File System Access pickers (`showOpenFilePicker`) aren't supported, because their
  dialogs can't be protected. Sites fall back to normal file uploads.
- Windows-owned UI isn't covered: the emoji panel (Win + .), IME candidate windows, and system prompts.
- Ad blocking blocks network requests only; it doesn't hide page elements, so empty ad boxes can remain.
  Without internet on the very first launch there is no block list yet, so pages load unblocked (a notice says so).
- Notes are saved encrypted (Windows DPAPI) in `%APPDATA%\private-workspace\notes.enc`. Other Windows accounts
  can't read them, but a program running **as you** can still ask Windows to decrypt them. If the file can't be
  read (for example it was copied from another account), it's moved aside as `notes.enc.corrupt-<time>`,
  never overwritten.
- Pages that need a camera, microphone or notifications won't get them.
- Notes are saved unencrypted in `%APPDATA%\private-workspace`; any program running as you can read that file.

## Files

| File | Purpose |
|---|---|
| `main.js` | Electron main process: creates and protects windows, permissions, downloads, print-to-PDF, file picker |
| `native-guard.js` | Protects windows Chromium creates on its own (dropdowns, dialogs) via the Windows API, using `koffi` |
| `index.html` | The app's interface: status bar, Browser and Notes tabs |
| `preload.js` | Safe bridge between the interface and the main process (protection toggle, notices) |
| `webview-preload.js` | Runs inside web pages: redirects file uploads and `window.print()` to the protected versions |
