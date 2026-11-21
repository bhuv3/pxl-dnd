// Tabletop play: the square grid, the ruler, and exports sized per grid square.
const Tabletop = (() => {
  const PRESETS = [[70, 'Roll20'], [100, 'Foundry'], [140, 'Print, 1 inch'], [200, 'Large']];

  // Grid line positions (map pixels) along one axis.
  function lines(size, offset, length) {
    const out = [];
    for (let v = ((offset % size) + size) % size; v <= length; v += size) out.push(v);
    return out;
  }

  // Thin grid lines over the map, in screen space. Hidden when squares get too small to see.
  function drawGrid(ctx, map) {
    const s = map.settings;
    if (!s.grid || s.gridSize * Viewport.state.zoom < 4) return;
    const a = Viewport.toScreen(0, 0), b = Viewport.toScreen(map.width, map.height);
    ctx.save();
    ctx.beginPath();
    for (const x of lines(s.gridSize, s.gridOffsetX, map.width)) {
      const sx = Math.round(Viewport.toScreen(x, 0).x) + 0.5;
      ctx.moveTo(sx, a.y); ctx.lineTo(sx, b.y);
    }
    for (const y of lines(s.gridSize, s.gridOffsetY, map.height)) {
      const sy = Math.round(Viewport.toScreen(0, y).y) + 0.5;
      ctx.moveTo(a.x, sy); ctx.lineTo(b.x, sy);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(0, 0, 0, ${s.gridOpacity})`;
    ctx.stroke();
    ctx.restore();
  }

  // Grid square holding a map point: [column, row].
  function squareAt(s, x, y) {
    return [Math.floor((x - s.gridOffsetX) / s.gridSize), Math.floor((y - s.gridOffsetY) / s.gridSize)];
  }

  // Map point at the center of a square.
  function squareCenter(s, [c, r]) {
    return [s.gridOffsetX + (c + 0.5) * s.gridSize, s.gridOffsetY + (r + 0.5) * s.gridSize];
  }

  // Straight-line distance between two squares' centers (Pythagoras), in squares and feet, to 2 decimals.
  function distance(s, from, to) {
    const n = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const round = v => Math.round(v * 100) / 100;
    return { squares: round(n), feet: round(n * s.gridFeet) };
  }

  // The ruler: both squares outlined, a line between their centers, and the distance at the end.
  function drawRuler(ctx, map, ruler) {
    const s = map.settings;
    const from = squareAt(s, ruler.from[0], ruler.from[1]), to = squareAt(s, ruler.to[0], ruler.to[1]);
    const z = Viewport.state.zoom, size = s.gridSize * z;
    const p = Viewport.toScreen(...squareCenter(s, from)), q = Viewport.toScreen(...squareCenter(s, to));
    const d = distance(s, from, to);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillStyle = 'rgba(255, 214, 102, 0.25)';
    for (const c of [p, q]) { ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size); ctx.strokeRect(c.x - size / 2, c.y - size / 2, size, size); }
    ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255, 214, 102, 1)'; ctx.stroke();
    label(ctx, `${d.feet} ft · ${d.squares} ${d.squares === 1 ? 'square' : 'squares'}`, q.x + size / 2 + 8, q.x - size / 2 - 8, q.y);
    ctx.restore();
  }

  // Text on a dark pill, right of the square (or left of it near the view's edge).
  function label(ctx, text, right, left, y) {
    ctx.font = '600 13px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 14;
    const x = right + w > Viewport.state.width - 4 ? left - w : right;
    ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y - 12, w, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd666';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 7, y + 1);
  }

  // Grid lines drawn into an export canvas at the given scale.
  function drawExportGrid(ctx, map, zoom) {
    const s = map.settings;
    const t = zoom >= 10 ? 2 : 1;
    ctx.fillStyle = `rgba(0, 0, 0, ${s.gridOpacity})`;
    for (const x of lines(s.gridSize, s.gridOffsetX, map.width)) ctx.fillRect(Math.round(x * zoom) - (t >> 1), 0, t, map.height * zoom);
    for (const y of lines(s.gridSize, s.gridOffsetY, map.height)) ctx.fillRect(0, Math.round(y * zoom) - (t >> 1), map.width * zoom, t);
  }

  // Map size in whole grid squares.
  function squares(map) {
    const s = map.settings;
    return [Math.floor(map.width / s.gridSize), Math.floor(map.height / s.gridSize)];
  }

  return { PRESETS, drawGrid, drawRuler, drawExportGrid, squares };
})();
