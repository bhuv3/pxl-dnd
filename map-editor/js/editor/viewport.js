// Zoom and pan state, and conversion between screen and map coordinates.
const Viewport = (() => {
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 24;
  // margin: space Fit leaves around the map (0 in fullscreen). fitPending: fit on the next resize.
  // fitIsMin: the fit zoom is the smallest allowed (fullscreen: zoom in only).
  const state = { zoom: 2, panX: 0, panY: 0, width: 0, height: 0, mapW: 1, mapH: 1, margin: 16, fitPending: false, fitIsMin: false };

  // Updates the size of the visible area (CSS pixels).
  function resize(width, height) {
    state.width = width; state.height = height;
    state.zoom = Math.max(state.zoom, minZoom());
    constrain();
  }

  // Sets the map size the view is showing.
  function setMap(w, h) { state.mapW = w; state.mapH = h; }

  // Zoom at which the whole map just fits inside the view (minus the margin).
  function fitZoom() {
    const m = state.margin * 2;
    return clamp(Math.min((state.width - m) / state.mapW, (state.height - m) / state.mapH), MIN_ZOOM, MAX_ZOOM);
  }

  // Smallest zoom allowed right now.
  function minZoom() { return state.fitIsMin ? fitZoom() : MIN_ZOOM; }

  // Fits the whole map inside the view, then centers it.
  function fit() {
    state.zoom = fitZoom();
    state.fitPending = false;
    center();
  }

  // Fits once the view has its new size (after entering or leaving fullscreen).
  function requestFit() { state.fitPending = true; }

  // Centers the map in the view.
  function center() {
    state.panX = Math.round((state.width - state.mapW * state.zoom) / 2);
    state.panY = Math.round((state.height - state.mapH * state.zoom) / 2);
  }

  // Per axis: a map smaller than the view stays centered; a bigger one can't leave a gap past the margin.
  function constrain() {
    const m = state.margin;
    const axis = (pan, size, view) => size + 2 * m <= view ? Math.round((view - size) / 2) : clamp(pan, view - size - m, m);
    state.panX = axis(state.panX, state.mapW * state.zoom, state.width);
    state.panY = axis(state.panY, state.mapH * state.zoom, state.height);
  }

  // Changes zoom while keeping the map point under (sx, sy) in place (then constrained).
  function zoomAt(sx, sy, zoom) {
    zoom = clamp(zoom, minZoom(), MAX_ZOOM);
    if (Math.abs(zoom - state.zoom) < 1e-6) return;
    const mx = (sx - state.panX) / state.zoom, my = (sy - state.panY) / state.zoom;
    state.zoom = zoom;
    state.panX = Math.round(sx - mx * zoom);
    state.panY = Math.round(sy - my * zoom);
    constrain();
  }

  // Zooms in or out to the next whole zoom (halves and doubles below 1×), around the view center.
  function step(dir) {
    const z = state.zoom;
    const next = dir > 0 ? (z < 1 ? z * 2 : Math.floor(z + 1e-6) + 1) : (z <= 1 ? z / 2 : Math.ceil(z - 1e-6) - 1);
    zoomAt(state.width / 2, state.height / 2, next);
  }

  // Multiplies the zoom around a screen point (smooth wheel and pinch zoom).
  function zoomBy(sx, sy, factor) { zoomAt(sx, sy, state.zoom * factor); }

  // Moves the view by a screen offset.
  function panBy(dx, dy) { state.panX += dx; state.panY += dy; constrain(); }

  // Screen point → map point (fractional).
  function toMap(sx, sy) { return { x: (sx - state.panX) / state.zoom, y: (sy - state.panY) / state.zoom }; }

  // Map point → screen point.
  function toScreen(mx, my) { return { x: mx * state.zoom + state.panX, y: my * state.zoom + state.panY }; }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  return { state, resize, setMap, fit, requestFit, zoomAt, zoomBy, step, panBy, toMap, toScreen };
})();
