// Protects windows that Electron's setContentProtection() does not cover: <select>
// dropdowns, colour picker, alert()/confirm() boxes, file-picker dialogs. They are all
// created by this process, so this process may set their display affinity itself.
//
// A WinEvent hook (filtered to our own process) fires when any of our windows is created
// or shown, and protection is applied at that moment. A once-a-second sweep backs it up.
const WDA_NONE = 0x00;
const WDA_EXCLUDEFROMCAPTURE = 0x11;
const EVENT_OBJECT_CREATE = 0x8000;
const EVENT_OBJECT_SHOW = 0x8002;
const OBJID_WINDOW = 0;
const GA_ROOT = 2;
const SWEEP_MS = 1000;

const state = { enabled: true, running: false, error: null, applied: 0, failed: 0 };
const ignored = new Set(); // window handles (as BigInt) left alone, e.g. test fixtures
let api = null;
let hook = null;
let sweepTimer = null;

function loadApi() {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
  koffi.alias('HWND', HANDLE);
  const WinEventProc = koffi.proto('void __stdcall WinEventProc(HANDLE hook, uint32_t event, HWND hwnd, int32_t idObject, int32_t idChild, uint32_t thread, uint32_t time)');
  const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(HWND hwnd, intptr_t lParam)');
  return {
    koffi, WinEventProc, EnumWindowsProc,
    SetWinEventHook: user32.func('HANDLE __stdcall SetWinEventHook(uint32_t eventMin, uint32_t eventMax, HANDLE hmod, WinEventProc *cb, uint32_t pid, uint32_t tid, uint32_t flags)'),
    UnhookWinEvent: user32.func('bool __stdcall UnhookWinEvent(HANDLE hook)'),
    EnumWindows: user32.func('bool __stdcall EnumWindows(EnumWindowsProc *cb, intptr_t lParam)'),
    GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(HWND hwnd, _Out_ uint32_t *pid)'),
    GetAncestor: user32.func('HWND __stdcall GetAncestor(HWND hwnd, uint32_t flags)'),
    GetWindowDisplayAffinity: user32.func('bool __stdcall GetWindowDisplayAffinity(HWND hwnd, _Out_ uint32_t *affinity)'),
    SetWindowDisplayAffinity: user32.func('bool __stdcall SetWindowDisplayAffinity(HWND hwnd, uint32_t affinity)'),
  };
}

function protect(hwnd) {
  if (!hwnd) return;
  const root = api.GetAncestor(hwnd, GA_ROOT) || hwnd;
  if (ignored.has(api.koffi.address(root))) return;
  const want = state.enabled ? WDA_EXCLUDEFROMCAPTURE : WDA_NONE;
  const cur = [0];
  if (api.GetWindowDisplayAffinity(root, cur) && cur[0] === want) return;
  if (api.SetWindowDisplayAffinity(root, want)) state.applied++;
  else state.failed++;
}

function sweep() {
  const pid = [0];
  api.EnumWindows((hwnd) => {
    api.GetWindowThreadProcessId(hwnd, pid);
    if (pid[0] === process.pid) protect(hwnd);
    return true;
  }, 0);
}

function start() {
  if (state.running || process.platform !== 'win32') return state.running;
  try {
    api = loadApi();
    const cb = api.koffi.register((_h, _event, hwnd, idObject, idChild) => {
      if (idObject === OBJID_WINDOW && idChild === 0) protect(hwnd);
    }, api.koffi.pointer(api.WinEventProc));
    // WINEVENT_OUTOFCONTEXT (0): delivered on this (main) thread's message loop.
    hook = api.SetWinEventHook(EVENT_OBJECT_CREATE, EVENT_OBJECT_SHOW, null, cb, process.pid, 0, 0);
    if (!hook) throw new Error('SetWinEventHook failed');
    sweepTimer = setInterval(sweep, SWEEP_MS);
    sweep();
    state.running = true;
  } catch (err) {
    state.error = err.message;
    console.error('[native-guard] pop-up protection unavailable:', err.message);
  }
  return state.running;
}

function setEnabled(on) {
  state.enabled = !!on;
  if (state.running) sweep();
}

// For test fixtures only: leave this BrowserWindow's native window alone
// (call after setContentProtection(false) on it).
function ignoreWindow(win) {
  const buf = win.getNativeWindowHandle();
  ignored.add(buf.length === 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0)));
}

module.exports = { start, setEnabled, ignoreWindow, status: () => ({ ...state }) };
