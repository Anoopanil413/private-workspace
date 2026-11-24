// Trusted preload for pages inside the workspace (sandboxed: no Node access).
//
// Chromium shows <input type="file"> pickers from a separate helper process, whose window
// this app cannot protect from screen capture. So we cancel that picker and ask the main
// process to show its own Open dialog (in-process, protected by native-guard), then hand
// the chosen files to the page exactly as a normal pick would.
const { ipcRenderer, contextBridge } = require('electron');

// The File System Access pickers use the same unprotectable helper; hide them so sites
// fall back to <input type="file">. showPicker() is routed through click() below.
contextBridge.executeInMainWorld({
  func: () => {
    for (const k of ['showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker']) {
      try { delete window[k]; } catch {}
      try { Object.defineProperty(window, k, { value: undefined, configurable: false, writable: false }); } catch {}
    }
    // window.print() opens the Windows print dialog, which is hosted by explorer.exe and
    // cannot be protected. Ask the preload (via a DOM event) to save a PDF instead.
    window.print = function print() { window.dispatchEvent(new CustomEvent('__workspace-print')); };
    const proto = HTMLInputElement.prototype;
    if (proto.showPicker) {
      const orig = proto.showPicker;
      proto.showPicker = function showPicker() {
        if (this.type === 'file') { this.click(); return; }
        return orig.call(this);
      };
    }
  },
});

window.addEventListener('__workspace-print', () => ipcRenderer.invoke('workspace-print'));

let picking = false;

window.addEventListener('click', async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'file' || input.disabled) return;
  e.preventDefault(); // cancels Chromium's own (unprotected) picker
  if (picking) return;
  picking = true;
  try {
    const files = await ipcRenderer.invoke('workspace-pick-files', {
      multiple: input.multiple,
      directory: input.webkitdirectory,
      accept: input.accept || '',
    });
    if (!files || !files.length) {
      input.dispatchEvent(new Event('cancel', { bubbles: false }));
      return;
    }
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(new File([f.data], f.name, { type: f.type, lastModified: f.lastModified }));
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    picking = false;
  }
}, true);
