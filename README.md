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

## Install and run

```
git clone https://github.com/Anoopanil413/private-workspace.git
cd private-workspace
npm install     # first time only
npm start
```

If `npm start` says Electron failed to install, run `node node_modules/electron/install.js` once.

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

## Limits

- Only what's **inside this app** is protected. Your other apps (Chrome, VS Code, …) are still captured;
  Windows doesn't let one app hide another app's windows.
- It hides the window from **software** capture only. A phone camera pointed at the screen, or a
  hardware capture card, still sees it.
- Opening a downloaded file or printing a saved PDF happens in other apps, which are captured.
- Folder uploads and the File System Access pickers (`showOpenFilePicker`) aren't supported, because their
  dialogs can't be protected. Sites fall back to normal file uploads.
- Windows-owned UI isn't covered: the emoji panel (Win + .), IME candidate windows, and system prompts.
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
