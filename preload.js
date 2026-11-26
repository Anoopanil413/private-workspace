const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspace', {
  toggleProtection: () => ipcRenderer.invoke('toggle-protection'),
  getProtection: () => ipcRenderer.invoke('get-protection'),
  onNotice: (fn) => ipcRenderer.on('workspace-notice', (_e, msg) =>
    fn(String(msg && msg.text), { sticky: Boolean(msg && msg.sticky) })),
  onUpdateReady: (fn) => ipcRenderer.on('update:ready', (_e, msg) => fn({ version: String(msg && msg.version) })),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onPageScroll: (fn) => ipcRenderer.on('workspace-page-scroll', () => fn()),
  onWindowFocus: (fn) => ipcRenderer.on('workspace-focus', (_e, msg) => fn({ focused: Boolean(msg && msg.focused) })),
  onShortcut: (fn) => ipcRenderer.on('workspace-shortcut', (_e, msg) => fn({ action: String(msg && msg.action) })),
  onOpenTab: (fn) => ipcRenderer.on('workspace-open-tab', (_e, msg) =>
    fn({ url: String(msg && msg.url), background: Boolean(msg && msg.background) })),
  adblock: {
    onCount: (fn) => ipcRenderer.on('adblock:count', (_e, msg) =>
      fn({ webContentsId: Number(msg && msg.webContentsId), count: Number(msg && msg.count) || 0 })),
    getSite: (host) => ipcRenderer.invoke('adblock:get-site', host),
    setSite: (host, allowed) => ipcRenderer.invoke('adblock:set-site', { host, allowed }),
  },
  dark: {
    get: (url) => ipcRenderer.invoke('dark:get', url),
    set: (host, mode, url) => ipcRenderer.invoke('dark:set', { host, mode, url }),
    setDefault: (mode, url) => ipcRenderer.invoke('dark:set-default', { mode, url }),
  },
  groups: {
    load: () => ipcRenderer.invoke('groups:load'),
    save: (data) => ipcRenderer.invoke('groups:save', data),
  },
  session: {
    load: () => ipcRenderer.invoke('session:load'),
    save: (session) => ipcRenderer.invoke('session:save', session),
  },
  notes: {
    load: () => ipcRenderer.invoke('notes:load'),
    save: (data) => ipcRenderer.invoke('notes:save', data),
    exportNotes: (opts) => ipcRenderer.invoke('notes:export', opts),
    pickImport: () => ipcRenderer.invoke('notes:pick-import'),
    importNotes: (opts) => ipcRenderer.invoke('notes:import', opts),
  },
});
