const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspace', {
  toggleProtection: () => ipcRenderer.invoke('toggle-protection'),
  getProtection: () => ipcRenderer.invoke('get-protection'),
  onNotice: (fn) => ipcRenderer.on('workspace-notice', (_e, msg) =>
    fn(String(msg && msg.text), { sticky: Boolean(msg && msg.sticky) })),
  onShortcut: (fn) => ipcRenderer.on('workspace-shortcut', (_e, msg) => fn({ action: String(msg && msg.action) })),
  onOpenTab: (fn) => ipcRenderer.on('workspace-open-tab', (_e, msg) =>
    fn({ url: String(msg && msg.url), background: Boolean(msg && msg.background) })),
  adblock: {
    onCount: (fn) => ipcRenderer.on('adblock:count', (_e, msg) =>
      fn({ webContentsId: Number(msg && msg.webContentsId), count: Number(msg && msg.count) || 0 })),
    getSite: (host) => ipcRenderer.invoke('adblock:get-site', host),
    setSite: (host, allowed) => ipcRenderer.invoke('adblock:set-site', { host, allowed }),
  },
  notes: {
    load: () => ipcRenderer.invoke('notes:load'),
    save: (data) => ipcRenderer.invoke('notes:save', data),
    exportNotes: (opts) => ipcRenderer.invoke('notes:export', opts),
    pickImport: () => ipcRenderer.invoke('notes:pick-import'),
    importNotes: (opts) => ipcRenderer.invoke('notes:import', opts),
  },
});
