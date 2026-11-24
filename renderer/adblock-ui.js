// Shield badge in the nav bar: requests blocked on the active tab's page, and a
// pop-over to switch blocking off for the current site. UMD: window.PWAdblockUI.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWAdblockUI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };

  function createAdblockBadge({ badge, countEl, pop, adblock, getActive }) {
    const counts = new Map(); // webContents id -> blocked count
    const idOf = (tab) => { try { return tab.webview.getWebContentsId(); } catch { return null; } };

    function refresh() {
      const tab = getActive();
      const n = tab ? counts.get(idOf(tab)) || 0 : 0;
      countEl.textContent = String(n);
      badge.title = `${n} ads and trackers blocked on this page`;
    }

    function closePop() { pop.hidden = true; badge.setAttribute('aria-expanded', 'false'); }

    async function openPop() {
      const tab = getActive();
      const host = tab ? hostOf(tab.url) : '';
      pop.replaceChildren();
      const head = document.createElement('b');
      const sub = document.createElement('span');
      sub.className = 'ab-sub';
      pop.append(head, sub);
      pop.hidden = false;
      badge.setAttribute('aria-expanded', 'true');

      const state = host ? await adblock.getSite(host) : null;
      if (!state || !state.running) {
        head.textContent = 'Ad blocking is off';
        sub.textContent = state ? 'The block list could not be downloaded. It retries next launch.' : 'Open a website first.';
        return;
      }
      head.textContent = `${counts.get(idOf(tab)) || 0} blocked on this page`;
      sub.textContent = host;
      const label = document.createElement('label');
      label.className = 'ab-toggle';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !state.allowed;
      label.append(box, document.createTextNode(' Block ads & trackers on this site'));
      box.addEventListener('change', async () => {
        box.disabled = true;
        await adblock.setSite(host, !box.checked);
        box.disabled = false;
        // Bypass the cache: ads loaded while the site was allowed would otherwise be
        // served from it without passing the blocker.
        try { getActive()?.webview.reloadIgnoringCache(); } catch {}
      });
      pop.append(label);
    }

    adblock.onCount(({ webContentsId, count }) => {
      counts.set(webContentsId, count);
      refresh();
    });
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pop.hidden) openPop(); else closePop();
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', closePop);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });

    refresh();
    return { refresh, close: closePop };
  }

  return { createAdblockBadge };
});
