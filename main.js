// Private Workspace — windows whose contents are excluded from screen capture.
// setContentProtection(true) calls SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE),
// so screenshots, screen-share and tracker captures do not see these windows.
const { app, BrowserWindow, Menu, dialog, globalShortcut, ipcMain, session } = require('electron');
const fs = require('fs');
const path = require('path');
const nativeGuard = require('./native-guard');
const { lockTitle } = require('./lib/window-privacy');
const { createPanic } = require('./lib/panic');

// Global shortcut that hides (and restores) every window of the app, even when
// another app has focus.
const PANIC_ACCELERATOR = 'CommandOrControl+Shift+H';
const panic = createPanic(() => BrowserWindow.getAllWindows());

const PARTITION = 'persist:private';
const WEB_URL = /^https?:\/\//i;
const PAGE_PRELOAD = path.join(__dirname, 'webview-preload.js');
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain',
  '.csv': 'text/csv', '.json': 'application/json', '.zip': 'application/zip', '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg', '.doc': 'application/msword', '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
// Website permissions we allow. Everything else (camera, mic, location, notifications —
// which would pop up OUTSIDE the protected window — etc.) is denied.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);

let mainWin;
let protectedOn = true;

// Every BrowserWindow this app creates (main window, pages' pop-ups) gets protected,
// and keeps a neutral title so page titles never reach the (captured) taskbar.
app.on('browser-window-created', (_e, win) => {
  win.setContentProtection(protectedOn);
  lockTitle(win);
  panic.adopt(win); // a pop-up opened while the panic key is active stays hidden
});

function notifyHost(message) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('workspace-notice', message);
}

// Options for windows that pages open (window.open, target=_blank): same private
// session, no Node, sandboxed. They stay inside the workspace instead of the
// default browser, which would be visible to capture.
function popupOptions() {
  return {
    width: 1000,
    height: 720,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false,
      preload: PAGE_PRELOAD, nodeIntegrationInSubFrames: true,
    },
  };
}

function guardPageWindows(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (WEB_URL.test(url) || url === 'about:blank') {
      return { action: 'allow', overrideBrowserWindowOptions: popupOptions() };
    }
    // mailto:, whatsapp:, etc. would open another app outside the protected window.
    notifyHost(`Blocked opening "${url.split(':')[0]}:" link — it would open outside the protected workspace.`);
    return { action: 'deny' };
  });
}

app.on('web-contents-created', (_e, contents) => {
  const type = contents.getType();

  // The <webview> is attached to the host window's webContents, so this check
  // belongs there (not on the webview itself).
  if (type === 'window') {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      // Only our own trusted preload (file-picker redirect), in every frame.
      webPreferences.preload = PAGE_PRELOAD;
      webPreferences.nodeIntegrationInSubFrames = true;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      if (params.partition !== PARTITION || !(WEB_URL.test(params.src) || params.src === 'about:blank')) {
        event.preventDefault();
      }
    });
  }

  if (type === 'webview' || (type === 'window' && contents !== mainWin?.webContents)) {
    guardPageWindows(contents);
  }
});

function setupSession() {
  const ses = session.fromPartition(PARTITION);
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
  ses.setDevicePermissionHandler(() => false);

  // Save downloads straight to a folder instead of showing a native Save dialog.
  ses.on('will-download', (_e, item) => {
    const dir = path.join(app.getPath('downloads'), 'Private Workspace');
    item.setSavePath(path.join(dir, item.getFilename()));
    item.once('done', (_ev, state) => {
      notifyHost(state === 'completed'
        ? `Downloaded ${item.getFilename()} to Downloads\\Private Workspace. Opening it in another app will be visible to capture.`
        : `Download of ${item.getFilename()} ${state}.`);
    });
  });
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 420,
    backgroundColor: '#14141a',
    title: 'Private Workspace',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // `npm run preview` shows the feature-preview mock-ups instead of the workspace.
  const page = process.argv.includes('--preview') ? 'preview.html' : 'index.html';
  mainWin.loadFile(path.join(__dirname, page));
  // The host page itself never opens windows.
  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWin.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWin.on('closed', () => { mainWin = null; });
}

ipcMain.handle('toggle-protection', (event) => {
  if (event.sender !== mainWin?.webContents) return protectedOn;
  protectedOn = !protectedOn;
  for (const w of BrowserWindow.getAllWindows()) w.setContentProtection(protectedOn);
  nativeGuard.setEnabled(protectedOn);
  return protectedOn;
});

ipcMain.handle('get-protection', () => protectedOn);

// window.print() -> PDF in Downloads\Private Workspace (the system print dialog is
// hosted by explorer.exe and would be visible to capture). Rate-limited per page.
const lastPrint = new WeakMap();
ipcMain.handle('workspace-print', async (event) => {
  const wc = event.sender;
  if (wc === mainWin?.webContents || wc.session !== session.fromPartition(PARTITION)) return false;
  const now = Date.now();
  if (now - (lastPrint.get(wc) || 0) < 5000) return false;
  lastPrint.set(wc, now);
  const title = (wc.getTitle() || 'page').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
  const dir = path.join(app.getPath('downloads'), 'Private Workspace');
  const file = path.join(dir, `${title} ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.pdf`);
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(file, await wc.printToPDF({ printBackground: true }));
    notifyHost(`Saved a PDF instead of printing: Downloads\\Private Workspace\\${path.basename(file)}. Printing it later will be visible to capture.`);
    return true;
  } catch (err) {
    notifyHost(`Could not save PDF: ${err.message}`);
    return false;
  }
});

// File picker for pages, shown from this process so native-guard can protect it
// (Chromium's own picker runs in a helper process we cannot protect).
ipcMain.handle('workspace-pick-files', async (event, opts = {}) => {
  const sender = event.sender;
  if (sender === mainWin?.webContents || sender.session !== session.fromPartition(PARTITION)) return [];
  if (opts.directory) {
    notifyHost('Folder uploads are not supported in the Private Workspace. Select files instead.');
    return [];
  }
  const exts = String(opts.accept || '').split(',').map((s) => s.trim().toLowerCase())
    .filter((s) => /^\.[\w-]+$/.test(s)).map((s) => s.slice(1));
  const parent = BrowserWindow.fromWebContents(sender.hostWebContents || sender) || mainWin;
  const { canceled, filePaths } = await dialog.showOpenDialog(parent, {
    properties: opts.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: exts.length ? [{ name: 'Allowed files', extensions: exts }, { name: 'All files', extensions: ['*'] }] : [],
  });
  if (canceled || !filePaths.length) return [];

  const stats = await Promise.all(filePaths.map((p) => fs.promises.stat(p)));
  const total = stats.reduce((n, s) => n + s.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    notifyHost(`Selected files are too large (${Math.round(total / 1048576)} MB; limit ${MAX_UPLOAD_BYTES / 1048576} MB).`);
    return [];
  }
  return Promise.all(filePaths.map(async (p, i) => ({
    name: path.basename(p),
    type: MIME[path.extname(p).toLowerCase()] || '',
    lastModified: stats[i].mtimeMs,
    data: await fs.promises.readFile(p),
  })));
});

app.whenReady().then(() => {
  // No default menu: it only adds shortcuts this app doesn't need (DevTools, reload).
  Menu.setApplicationMenu(null);
  setupSession();
  const guarded = nativeGuard.start();
  createWindow();
  if (!guarded && process.platform === 'win32') {
    mainWin.webContents.once('did-finish-load', () => notifyHost(
      'Warning: pop-up protection failed to start. Dropdowns, dialogs and file pickers may be visible to screen capture.'));
  }
  if (!globalShortcut.register(PANIC_ACCELERATOR, () => panic.toggle())) {
    mainWin.webContents.once('did-finish-load', () => notifyHost(
      'Panic key Ctrl+Shift+H is used by another app, so it is unavailable.'));
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { getMainWindow: () => mainWin, nativeGuard };
