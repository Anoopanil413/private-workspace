// Draws the app icon (a shield in the app's colours) and saves build/icon.png
// (512×512), which electron-builder turns into the Windows .ico.
// Run with: npx electron scripts/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SIZE = 512;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <rect x="16" y="16" width="480" height="480" rx="108" fill="#14141a"/>
  <rect x="16" y="16" width="480" height="480" rx="108" fill="none" stroke="#2a2a34" stroke-width="8"/>
  <path d="M256 92 L392 142 V252 C392 336 334 396 256 424 C178 396 120 336 120 252 V142 Z"
        fill="#134e39" stroke="#6ee7b7" stroke-width="22" stroke-linejoin="round"/>
  <circle cx="256" cy="246" r="44" fill="#6ee7b7"/>
  <path d="M256 290 V346" stroke="#6ee7b7" stroke-width="26" stroke-linecap="round"/>
</svg>`;

// Optional first argument: where to write (default build/icon.png).
const out = path.resolve(process.argv.find((a) => a.endsWith('.png')) || path.join(__dirname, '..', 'build', 'icon.png'));

app.whenReady().then(async () => {
  // A hidden (not offscreen) window still paints, and capturePage reads that frame.
  const win = new BrowserWindow({
    width: SIZE, height: SIZE, show: false, frame: false, transparent: true, useContentSize: true,
    webPreferences: { backgroundThrottling: false },
  });
  setTimeout(() => { console.error('Timed out drawing the icon'); app.exit(1); }, 20000);
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.resize({ width: SIZE, height: SIZE }).toPNG());
  console.log(`wrote ${out} (${image.getSize().width}x${image.getSize().height})`);
  app.exit(0);
});
