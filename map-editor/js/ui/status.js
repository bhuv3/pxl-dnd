// Status bar text.
const Status = (() => {
  const el = id => document.getElementById(id);

  // Cursor position and what's under it.
  function setCursor(x, y, terrain) {
    el('statusPos').textContent = x == null ? '' : `x ${x}, y ${y}`;
    el('statusTerrain').textContent = terrain || '';
  }

  // Message on the right side, e.g. "Rendering…".
  function message(text) { el('statusMsg').textContent = text || ''; }

  return { setCursor, message };
})();
