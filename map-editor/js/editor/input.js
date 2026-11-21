// Mouse and keyboard handling: pan, zoom, and passing events to the active tool.
const Input = (() => {
  let canvas;
  let spaceDown = false;
  let panning = null;
  let pointerInside = false;
  const keyHandlers = [];
  const pointer = { sx: 0, sy: 0, x: 0, y: 0, inside: false };

  // Hooks up all events on the display canvas and window.
  function init(c) {
    canvas = c;
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerenter', () => { pointerInside = true; pointer.inside = true; });
    canvas.addEventListener('pointerleave', () => { pointerInside = false; pointer.inside = false; Status.setCursor(null); Renderer.requestPresent(); });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    updateCursor();
  }

  // Event position relative to the canvas.
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Remembers the pointer in screen and map coordinates.
  function track(e) {
    const p = local(e);
    const flat = Viewport.toMap(p.x, p.y);
    const m = Renderer.getView() === 'rendered' ? Height.unproject(Renderer.getWorld(), flat.x, flat.y) : flat;   // the map pixel drawn there
    Object.assign(pointer, { sx: p.x, sy: p.y, x: m.x, y: m.y });
    return pointer;
  }

  function onDown(e) {
    track(e);
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || (e.button === 0 && (spaceDown || App.isFullscreen()))) {
      panning = { x: e.clientX, y: e.clientY };
      updateCursor();
      return;
    }
    if (Tools.down) Tools.down(pointer, e);
    Renderer.requestPresent();
  }

  function onMove(e) {
    track(e);
    if (panning) {
      Viewport.panBy(e.clientX - panning.x, e.clientY - panning.y);
      panning = { x: e.clientX, y: e.clientY };
    } else if (Tools.move) {
      Tools.move(pointer, e);
    }
    showCursorInfo();
    Renderer.requestPresent();
  }

  function onUp(e) {
    track(e);
    if (panning) { panning = null; updateCursor(); return; }
    if (Tools.up) Tools.up(pointer, e);
    Renderer.requestPresent();
  }

  // Wheel, trackpad swipe, and pinch (ctrlKey) zoom smoothly around the cursor, in proportion to the scroll.
  function onWheel(e) {
    e.preventDefault();
    const p = local(e);
    const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const factor = Math.exp(-e.deltaY * lines * (e.ctrlKey ? 0.012 : 0.003));
    Viewport.zoomBy(p.x, p.y, Math.max(0.8, Math.min(1.25, factor)));
    track(e);
    Renderer.requestPresent();
  }

  // Shows map coordinates and terrain under the cursor.
  function showCursorInfo() {
    const map = Renderer.getMap();
    const x = Math.floor(pointer.x), y = Math.floor(pointer.y);
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) { Status.setCursor(null); return; }
    Status.setCursor(x, y, Resolve.describe(Renderer.getWorld(), map, x, y));
  }

  function isTyping(e) { return /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName); }

  function onKeyDown(e) {
    if (isTyping(e)) return;
    if (e.code === 'Space') {
      if (!spaceDown) { spaceDown = true; updateCursor(); }
      e.preventDefault();
      return;
    }
    for (const fn of keyHandlers) if (fn(e) === true) { e.preventDefault(); return; }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') { spaceDown = false; updateCursor(); }
  }

  // Lets other modules react to key presses. Return true to consume the key.
  function onKey(fn) { keyHandlers.push(fn); }

  // Picks the mouse cursor for the current state. In fullscreen, dragging always pans.
  function updateCursor() {
    canvas.style.cursor = panning ? 'grabbing' : spaceDown || App.isFullscreen() ? 'grab' : (Tools.cursor ? Tools.cursor() : 'crosshair');
  }

  return { init, onKey, pointer, updateCursor, isInside: () => pointerInside };
})();
