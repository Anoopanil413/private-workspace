// Blur when away: screen capture can't see the workspace, but people near the screen
// can. While another app has focus, everything except the status strip is blurred.
// UMD: window.PWBlur / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWBlur = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const STORAGE_KEY = 'blur-when-away';

  const shouldBlur = ({ enabled, focused }) => enabled && !focused;
  const readBlurSetting = (raw) => raw !== '0'; // on unless turned off

  // body: gets the `privacy-blur` class. button: the on/off toggle.
  // onWindowFocus: subscribes to { focused } updates from the main process.
  function createBlurGuard({ body, button, onWindowFocus }) {
    let enabled = true;
    try { enabled = readBlurSetting(localStorage.getItem(STORAGE_KEY)); } catch {}
    let focused = true;

    function paint() {
      body.classList.toggle('privacy-blur', shouldBlur({ enabled, focused }));
      button.setAttribute('aria-pressed', String(enabled));
      button.title = enabled
        ? 'Blur when away is on: the workspace blurs while another app is in front. Click to turn off.'
        : 'Blur when away is off. Click to turn on.';
    }

    button.addEventListener('click', () => {
      enabled = !enabled;
      try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
      paint();
    });
    onWindowFocus(({ focused: f }) => { focused = f; paint(); });
    paint();
  }

  return { shouldBlur, readBlurSetting, createBlurGuard };
});
