// Auto-update from GitHub Releases (electron-updater; feed set by electron-builder's
// `publish` config). The installed app checks at start and every 6 hours, downloads
// quietly, reports the new version once, and installs when the app quits or when the
// user chooses "Restart now". Failures (offline, GitHub down) are only logged.
const SIX_HOURS = 6 * 3600 * 1000;

function createUpdater({
  autoUpdater, isPackaged, onReady, log = () => {}, intervalMs = SIX_HOURS, setInterval = global.setInterval,
  testFeedUrl = null,
}) {
  let reported = null;

  function check() {
    Promise.resolve()
      .then(() => autoUpdater.checkForUpdates())
      .catch((err) => log(`update check failed: ${err && err.message}`));
  }

  function start() {
    // A test feed is for trying updates in development; the installed app ignores it.
    const testing = !isPackaged && !!testFeedUrl;
    if (!isPackaged && !testing) return false;
    if (testing) {
      autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.setFeedURL({ provider: 'generic', url: testFeedUrl });
    }
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableWebInstaller = true; // releases ship the full installer
    autoUpdater.allowDowngrade = false; // never "update" to an older version
    autoUpdater.logger = { info: log, warn: log, error: log, debug() {} };
    autoUpdater.on('error', (err) => log(`updater error: ${err && err.message}`));
    autoUpdater.on('update-downloaded', (info) => {
      if (!info || info.version === reported) return;
      reported = info.version;
      onReady(info.version);
    });
    check();
    const timer = setInterval(check, intervalMs);
    if (timer && timer.unref) timer.unref();
    return true;
  }

  // Silent install, then start the new version.
  const install = () => autoUpdater.quitAndInstall(true, true);

  return { start, install };
}

module.exports = { createUpdater };
