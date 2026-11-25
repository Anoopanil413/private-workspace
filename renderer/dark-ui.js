// 🌙 button in the nav bar: dark mode for the current site, and the default for all
// sites. The main process applies it (lib/dark-mode.js). UMD: window.PWDarkUI.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWDarkUI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LABELS = {
    system: 'Normal (as Windows)',
    dark: "Site's dark theme",
    force: 'Force dark',
  };
  const HINTS = {
    system: 'Pages look the way the site and your Windows theme make them.',
    dark: 'Asks the site for its own dark theme. Sites without one stay as they are.',
    force: 'Darkens every page, also sites without a dark theme.',
  };

  function createDarkButton({ button, pop, dark, getActive }) {
    const currentUrl = () => { const t = getActive(); return t ? t.url : ''; };

    async function refresh() {
      let state = null;
      try { state = await dark.get(currentUrl()); } catch {}
      const on = !!state && state.mode !== 'system';
      button.setAttribute('aria-pressed', String(on));
      button.title = state && state.host
        ? `Dark mode for ${state.host}: ${LABELS[state.mode]}`
        : 'Dark mode for websites';
      return state;
    }

    function close() { pop.hidden = true; button.setAttribute('aria-expanded', 'false'); }

    async function open() {
      const state = await refresh();
      pop.replaceChildren();
      pop.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      const head = document.createElement('b');
      pop.append(head);
      if (!state || !state.host) {
        head.textContent = 'Dark mode for websites';
        const sub = document.createElement('span');
        sub.className = 'ab-sub';
        sub.textContent = 'Open a website first.';
        pop.append(sub);
        return;
      }
      head.textContent = `Dark mode for ${state.host}`;
      for (const mode of ['system', 'dark', 'force']) {
        const label = document.createElement('label');
        label.className = 'dark-opt';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dark-mode';
        radio.value = mode;
        radio.checked = state.mode === mode;
        const text = document.createElement('span');
        const title = document.createElement('span');
        title.textContent = LABELS[mode];
        const hint = document.createElement('small');
        hint.textContent = HINTS[mode];
        text.append(title, hint);
        label.append(radio, text);
        radio.addEventListener('change', async () => {
          await dark.set(state.host, mode, currentUrl());
          open();
        });
        pop.append(label);
      }
      const foot = document.createElement('div');
      foot.className = 'dark-foot';
      const def = document.createElement('span');
      def.textContent = `All other sites: ${LABELS[state.defaultMode]}`;
      foot.append(def);
      if (state.mode !== state.defaultMode) {
        const all = document.createElement('button');
        all.textContent = `Use "${LABELS[state.mode]}" for all sites`;
        all.addEventListener('click', async () => { await dark.setDefault(state.mode, currentUrl()); open(); });
        foot.append(all);
      }
      pop.append(foot);
    }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pop.hidden) open(); else close();
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    refresh();
    return { refresh, close };
  }

  return { createDarkButton };
});
