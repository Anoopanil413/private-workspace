// Notice bar: messages stack instead of replacing each other. Sticky ones (warnings)
// stay until dismissed; others fade after a while. UMD: window.PWNotices / module.exports.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PWNotices = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_NOTICES = 4;
  const FADE_MS = 8000;

  // Same text again moves to the end; over the limit the oldest non-sticky goes first.
  // action (optional): { label, onClick } shown as a button on the notice.
  function addNotice(list, { text, sticky = false, action = null }, makeId) {
    const next = list.filter((n) => n.text !== text);
    next.push({ id: makeId(), text, sticky: !!sticky, action: action || null });
    while (next.length > MAX_NOTICES) {
      const i = next.findIndex((n) => !n.sticky);
      next.splice(i === -1 ? 0 : i, 1);
    }
    return next;
  }

  const removeNotice = (list, id) => list.filter((n) => n.id !== id);

  function createNotices(container) {
    let list = [];
    let seq = 0;
    const timers = new Map();

    function render() {
      container.replaceChildren(...list.map((n) => {
        const row = document.createElement('div');
        row.className = 'notice-row' + (n.sticky ? ' sticky' : '');
        const text = document.createElement('span');
        text.textContent = n.text;
        const x = document.createElement('button');
        x.className = 'notice-x';
        x.title = 'Dismiss';
        x.textContent = '×';
        x.addEventListener('click', () => dismiss(n.id));
        if (n.action) {
          const act = document.createElement('button');
          act.className = 'notice-action';
          act.textContent = n.action.label;
          act.addEventListener('click', () => n.action.onClick());
          row.append(text, act, x);
        } else {
          row.append(text, x);
        }
        return row;
      }));
      container.classList.toggle('show', list.length > 0);
    }

    function dismiss(id) {
      clearTimeout(timers.get(id));
      timers.delete(id);
      list = removeNotice(list, id);
      render();
    }

    function show(text, { sticky = false, action = null } = {}) {
      const before = new Set(list.map((n) => n.id));
      list = addNotice(list, { text, sticky, action }, () => `n${++seq}`);
      for (const id of before) if (!list.some((n) => n.id === id)) { clearTimeout(timers.get(id)); timers.delete(id); }
      const added = list[list.length - 1];
      if (!added.sticky) timers.set(added.id, setTimeout(() => dismiss(added.id), FADE_MS));
      render();
    }

    return { show };
  }

  return { addNotice, removeNotice, createNotices, MAX_NOTICES };
});
