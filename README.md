# Private Workspace

A browser and notes window whose contents are **excluded from screen capture**: screenshots,
screen sharing and monitoring apps don't see it, while you see it normally.
In a capture the window is simply absent — whatever is behind it shows instead.

## Install

Run `Private-Workspace-Setup-<version>.exe`. It installs for your Windows user only (no admin rights needed) and
adds Start-menu and desktop shortcuts.

The installer isn't code-signed, so the first time Windows shows **"Windows protected your PC"**: click
**More info → Run anyway**.

Your notes, tabs and settings live in `%APPDATA%\private-workspace`, the same folder `npm start` uses, so they
carry over between the installed app and a development run.

## Updates

The installed app updates itself from this repository's GitHub Releases. It checks when it starts and every 6
hours, downloads a new version quietly in the background, then shows **"Version X is ready. It installs when you
close the app."** with a **Restart now** button. Your last note edit and open tabs are saved before it restarts.
If you're offline, or GitHub can't be reached, nothing is shown and it tries again later. It never installs an
older version. (Running with `npm start` never checks for updates.)

## Run from source

```
npm install     # first time only
npm start
```

If `npm start` says Electron failed to install, run `node node_modules/electron/install.js` once.

## Build the installer

```
npm run dist    # -> dist\Private-Workspace-Setup-<version>.exe and dist\latest.yml
```

The app icon is `build/icon.png`; `npm run icon` redraws it from the SVG in `scripts/make-icon.js`.

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

The address bar opens sites (`example.com`), local addresses (`localhost:3000`, `192.168.1.10`) and searches
DuckDuckGo for anything else. On the Notes screen only Ctrl+T works (it switches to the browser), so the notes
editor keeps its own keys.

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
