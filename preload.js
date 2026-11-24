const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspace', {
  toggleProtection: () => ipcRenderer.invoke('toggle-protection'),
  getProtection: () => ipcRenderer.invoke('get-protection'),
  onNotice: (fn) => ipcRenderer.on('workspace-notice', (_e, msg) => fn(String(msg))),
});
