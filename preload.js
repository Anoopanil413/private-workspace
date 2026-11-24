const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspace', {
  toggleProtection: () => ipcRenderer.invoke('toggle-protection'),
  getProtection: () => ipcRenderer.invoke('get-protection'),
  onNotice: (fn) => ipcRenderer.on('workspace-notice', (_e, msg) => fn(String(msg))),
  onOpenTab: (fn) => ipcRenderer.on('workspace-open-tab', (_e, msg) =>
    fn({ url: String(msg && msg.url), background: Boolean(msg && msg.background) })),
  notes: {
    load: () => ipcRenderer.invoke('notes:load'),
    save: (data) => ipcRenderer.invoke('notes:save', data),
    exportNotes: (opts) => ipcRenderer.invoke('notes:export', opts),
    pickImport: () => ipcRenderer.invoke('notes:pick-import'),
    importNotes: (opts) => ipcRenderer.invoke('notes:import', opts),
  },
});
