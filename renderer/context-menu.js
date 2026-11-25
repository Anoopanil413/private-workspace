// Right-click menus drawn by the host page (HTML), so they stay inside the protected
// window: a native Windows menu is a separate window that screen capture could see.
// Item = { label, action?, noteId?, items?: Item[], separator?: true }
// UMD: window.PWContextMenu / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWContextMenu = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const RECENT = 5;
  const TITLE_MAX = 40;
  const short = (s) => (s.length > TITLE_MAX ? `${s.slice(0, TITLE_MAX)}…` : s);

  // The menu for selected page text. sideNote: the note open beside the page, if any.
  function selectionMenu({ selectionText, sideNote, recent }) {
    if (!String(selectionText || '').trim()) return [];
    const items = [{ label: 'Copy', action: 'copy' }, { separator: true }];
    if (sideNote) items.push({ label: `Add to "${short(sideNote.title)}"`, action: 'add', noteId: sideNote.id });
    const others = recent.filter((n) => !sideNote || n.id !== sideNote.id).slice(0, RECENT);
    items.push({
      label: 'Add to note',
      items: [
        ...others.map((n) => ({ label: short(n.title), action: 'add', noteId: n.id })),
        ...(others.length ? [{ separator: true }] : []),
        { label: '＋ New note', action: 'add', noteId: null },
      ],
    });
    return items;
  }

  function createMenu(root) {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    let onPick = null;

    function hide() {
      if (root.hidden) return;
      root.hidden = true;
      root.replaceChildren();
      onPick = null;
    }

    function pick(item) {
      const fn = onPick;
      hide();
      if (fn) fn(item);
    }

    const visibleButtons = () => [...root.querySelectorAll('button')].filter((b) => !b.closest('.ctx-sub[hidden]'));

    function openSub(wrap, focusFirst) {
      for (const s of root.querySelectorAll('.ctx-sub')) if (!wrap.contains(s)) s.hidden = true;
      const sub = wrap.querySelector('.ctx-sub');
      sub.hidden = false;
      sub.classList.remove('flip');
      const r = sub.getBoundingClientRect();
      if (r.right > (win.innerWidth || Infinity)) sub.classList.add('flip');
      if (focusFirst) sub.querySelector('button').focus();
    }

    function closeSub(wrap) {
      const sub = wrap.querySelector('.ctx-sub');
      if (sub) sub.hidden = true;
    }

    function render(items, into) {
      for (const item of items) {
        if (item.separator) { const hr = doc.createElement('div'); hr.className = 'ctx-sep'; into.append(hr); continue; }
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = item.label;
        if (item.items) {
          const wrap = doc.createElement('div');
          wrap.className = 'ctx-wrap';
          btn.setAttribute('aria-haspopup', 'true');
          const arrow = doc.createElement('span');
          arrow.className = 'ctx-arrow';
          arrow.textContent = ' ▸';
          btn.append(arrow);
          const sub = doc.createElement('div');
          sub.className = 'ctx-sub';
          sub.setAttribute('role', 'menu');
          sub.hidden = true;
          render(item.items, sub);
          wrap.append(btn, sub);
          wrap.addEventListener('mouseenter', () => openSub(wrap, false));
          wrap.addEventListener('mouseleave', () => closeSub(wrap));
          btn.addEventListener('click', () => openSub(wrap, true));
          btn._open = () => openSub(wrap, true);
          into.append(wrap);
        } else {
          btn.addEventListener('click', () => pick(item));
          btn._pick = () => pick(item);
          btn.addEventListener('mouseenter', () => btn.focus());
          into.append(btn);
        }
      }
    }

    root.addEventListener('keydown', (e) => {
      const btn = e.target.closest && e.target.closest('button');
      if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
      if (!btn) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (btn._pick) btn._pick(); else if (btn._open) btn._open(); return; }
      if (e.key === 'ArrowRight' && btn._open) { e.preventDefault(); btn._open(); return; }
      if (e.key === 'ArrowLeft') {
        const sub = btn.closest('.ctx-sub');
        if (sub) { e.preventDefault(); sub.hidden = true; sub.parentElement.querySelector('button').focus(); }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        // Move within the list the focused item is in.
        const list = btn.closest('.ctx-sub') || root;
        const own = visibleButtons().filter((b) => (b.closest('.ctx-sub') || root) === list);
        const i = own.indexOf(btn);
        own[(i + (e.key === 'ArrowDown' ? 1 : -1) + own.length) % own.length].focus();
      }
    });
    // Focus leaving the menu (a click on the page, another app) closes it.
    root.addEventListener('focusout', (e) => { if (!e.relatedTarget || !root.contains(e.relatedTarget)) setTimeout(() => { if (!root.contains(doc.activeElement)) hide(); }, 0); });

    function show(items, x, y, pickFn) {
      root.replaceChildren();
      onPick = pickFn;
      render(items, root);
      root.hidden = false;
      // Keep it on screen.
      const w = root.offsetWidth || 0;
      const h = root.offsetHeight || 0;
      const maxX = (win.innerWidth || Infinity) - w - 4;
      const maxY = (win.innerHeight || Infinity) - h - 4;
      root.style.left = `${Math.max(4, Math.min(x, maxX))}px`;
      root.style.top = `${Math.max(4, Math.min(y, maxY))}px`;
      const first = root.querySelector('button');
      if (first) first.focus();
    }

    return { show, hide, isOpen: () => !root.hidden };
  }

  return { selectionMenu, createMenu };
});
