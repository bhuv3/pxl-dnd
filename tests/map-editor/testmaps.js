// Deterministic test maps for the Node tests (no canvas needed): noise-made ground, lakes, a sea, scatter regions, paths,
// and optionally rivers, docks and hills. M is the object load() returns.
function synthetic(M, w, h, seed, opts = {}) {
  const { GROUND: G, WATER: W, SCATTER: S } = M.Types;
  const map = M.MapModel.create(w, h, seed, G.GRASS);
  M.Random.setSeed(seed);
  const ids = [G.DIRT, G.GRASS, G.GRASS, G.SAND, G.COBBLE, G.GRAVEL, G.FLAGSTONE, G.CAVE_FLOOR, G.DRY_EARTH, G.ROCK, G.STONE_WALL];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, n = M.Random.noise(x, y, 45, 1), m = M.Random.noise(x, y, 22, 2), lake = M.Random.noise(x, y, 70, 3);
      map.ground[i] = n < 0.18 ? ids[(m * 40 | 0) % ids.length] : n < 0.75 ? G.GRASS : ids[1 + (m * 30 | 0) % (ids.length - 1)];
      if (lake < 0.2) map.water[i] = W.LAKE;
      if (opts.sea && y > h * 0.82 + (M.Random.noise(x, 0, 30, 4) - 0.5) * 30) map.water[i] = W.SEA;
      const sc = M.Random.noise(x, y, 28, 5);
      if (sc > 0.66) map.scatter[i] = S.FOREST; else if (sc < 0.17) map.scatter[i] = S.PINES; else if (sc > 0.6 && sc < 0.62) map.scatter[i] = S.FLOWERS;
    }
  }
  const disc = (layer, cx, cy, r, v) => { for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) map[layer][y * w + x] = v; };
  const line = (layer, pts, r, v) => { for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.max(1, Math.hypot(x1 - x0, y1 - y0) | 0); for (let t = 0; t <= n; t++) disc(layer, Math.round(x0 + (x1 - x0) * t / n), Math.round(y0 + (y1 - y0) * t / n), r, v); } };
  if (opts.paths) {
    line('ground', [[0, h * 0.3], [w * 0.4, h * 0.35], [w * 0.7, h * 0.5], [w - 1, h * 0.45]], 2, G.PATH);   // a road, crossing water where it meets it
    line('ground', [[w * 0.2, 0], [w * 0.25, h * 0.4], [w * 0.2, h - 1]], 2, G.COBBLE);
  }
  if (opts.rivers) {
    map.rivers.push({ id: M.MapModel.nextId(map), points: [[0, h * 0.62], [w * 0.4, h * 0.58], [w - 1, h * 0.66]], width: 8, meander: 6, wobble: 0.3, seed: seed + 5, drops: [] });
  }
  if (opts.hills) for (const [fx, fy, r, v] of [[0.7, 0.2, 0.12, 1], [0.7, 0.2, 0.07, 2], [0.3, 0.7, 0.1, 1]]) disc('elevation', Math.round(w * fx), Math.round(h * fy), Math.round(Math.min(w, h) * r), v);
  return map;
}

// A small fixed set used by the baseline: every ground/scatter/water kind, with and without rivers, hills and a sea.
function suite(M) {
  return [
    ['synthetic plain 300x300', synthetic(M, 300, 300, 11)],
    ['synthetic paths+sea 360x300', synthetic(M, 360, 300, 22, { paths: true, sea: true })],
    ['synthetic rivers+paths 400x320', synthetic(M, 400, 320, 33, { paths: true, rivers: true })],
    ['synthetic hills 320x320', synthetic(M, 320, 320, 44, { hills: true, paths: true })],
  ];
}

module.exports = { synthetic, suite };
