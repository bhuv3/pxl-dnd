// What the fight draws on the floor, under the figures: the squares the current hero can walk to, the path to
// the square under the mouse, a gold ring under whoever's turn it is (or the party leader), red rings under the
// targets of the chosen action (brighter under the one the mouse is on), red crosses on found traps, and the
// squares an aimed area spell would cover (orange).
const GridOverlay = (() => {
  const view = { reach: null, path: [], targets: [], hover: null, current: null, marks: [], area: null };

  function set(v) { Object.assign(view, v); }

  function draw(c2d) {
    const z = Stage.cam.zoom, S = Squares.SIZE;
    if (view.reach) {
      for (const sq of view.reach.values()) {
        if (sq.cost === 0 || sq.through) continue;
        fill(c2d, sq, 'rgba(150, 210, 255, 0.13)', z, S);
      }
      for (const sq of view.path) fill(c2d, sq, 'rgba(255, 255, 255, 0.22)', z, S);
    }
    if (view.area) for (const sq of view.area) fill(c2d, sq, 'rgba(255, 150, 60, 0.36)', z, S);
    for (const m of view.marks) cross(c2d, m);
    if (view.current) ring(c2d, view.current, [255, 214, 90], 0.9);
    for (const t of view.targets) ring(c2d, t, [255, 90, 70], t === view.hover ? 1 : 0.55);
  }

  // A square's inside, leaving its edge so the grid shows.
  function fill(c2d, sq, color, z, S) {
    const p = Stage.toScreen(sq.sx * S, sq.sy * S);
    c2d.fillStyle = color;
    c2d.fillRect(p.x + 1, p.y + 1, S * z - 2, S * z - 2);
  }

  // A flattened ring of half-pixels round a figure's feet.
  function ring(c2d, f, rgb, alpha) {
    const n = 28;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      Shapes.px(c2d, f.x + Math.cos(a) * 5, f.y + 0.5 + Math.sin(a) * 2.2, rgb.map(v => v * alpha), 0.5);
    }
  }

  // A red cross on a square (a trap the party found).
  function cross(c2d, sq) {
    const x = sq.sx * Squares.SIZE + 5, y = sq.sy * Squares.SIZE + 5;
    for (let k = -3; k <= 3; k += 0.5) { Shapes.px(c2d, x + k, y + k * 0.6, [230, 70, 60], 0.5); Shapes.px(c2d, x + k, y - k * 0.6, [230, 70, 60], 0.5); }
  }

  return { set, draw, view };
})();
