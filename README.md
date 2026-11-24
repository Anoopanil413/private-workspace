# Private Workspace

A browser and notes window whose contents are **excluded from screen capture**: screenshots,
screen sharing and monitoring apps don't see it, while you see it normally.
In a capture the window is simply absent — whatever is behind it shows instead.

## Run

```
cd workspace
npm install     # first time only
npm start
```

If `npm start` says Electron failed to install, run `node node_modules/electron/install.js` once.

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
| Exporting / importing notes | Export writes straight to `Downloads\Private Workspace` (no Save dialog): **encrypted** `.pwnotes` (your password, scrypt + AES-256-GCM; opens on any PC) or plain `.txt`. Import uses the app's own Open dialog and adds notes without duplicating ones you have | Unit-tested (`notes-export`) |
| Links that open a new tab (`target=_blank`, Ctrl+click) | Open as a tab inside the workspace. `window.open()` with a size (sign-in pop-ups) still gets a protected pop-up window, so logins keep working | Unit-tested (`routeWindowOpen`) |
| Window titles in the taskbar and Alt+Tab | Every window, including pages' pop-ups, keeps the title "Private Workspace" | Unit-tested (`lockTitle`) |
| Someone walks up / you need it gone now | Panic key **Ctrl+Shift+H** hides every window (also from the taskbar and Alt+Tab), from any app; press again to restore | Unit-tested (`createPanic`) |

## Limits

- Only what's **inside this app** is protected. Your other apps (Chrome, VS Code, …) are still captured;
  Windows doesn't let one app hide another app's windows.
- Opening a downloaded file or printing a saved PDF happens in other apps, which are captured.
- Folder uploads and the File System Access pickers (`showOpenFilePicker`) aren't supported, because their
  dialogs can't be protected. Sites fall back to normal file uploads.
- Windows-owned UI isn't covered: the emoji panel (Win + .), IME candidate windows, and system prompts.
- Notes are saved encrypted (Windows DPAPI) in `%APPDATA%\private-workspace\notes.enc`. Other Windows accounts
  can't read them, but a program running **as you** can still ask Windows to decrypt them. If the file can't be
  read (for example it was copied from another account), it's moved aside as `notes.enc.corrupt-<time>`,
  never overwritten.
