// Decides how to rebuild after an edit. It remembers the painted layers of the last solve, finds the rectangle of pixels that
// changed since, and, when that is a small, local change on a flat map, has Resolve.runWindow update the world in place
// instead of solving the whole map again. Anything else (a new map, changed settings or rivers, raised ground, a big change)
// is left to Resolve.run. See docs/map-editor/gl-renderer.md section 11.
const Incremental = (() => {
  const LAYERS = ['ground', 'water', 'scatter', 'elevation', 'terrace'];
  // The settings the solving modules (Resolve, Rivers, Bridges, Height) read: a change to one needs a full solve.
  const SETTINGS = ['bridgeStyle', 'bridges', 'beachWidth', 'levelHeight', 'waveReach', 'steppingStones', 'stairs', 'riverBendSize',
    'raggedEdges', 'mudBanks', 'lakeSandRim', 'edgeWobble', 'shadows', 'lightAngle'];
  let snap = null;

  const settingsKey = map => SETTINGS.map(k => map.settings[k]).join('|');
  const hasHeight = map => map.elevation.some(v => v) || map.terrace.some(v => v);

  // Remembers the painted layers a full or windowed solve just used.
  function remember(map) {
    snap = {
      w: map.width, h: map.height, seed: map.seed, settings: settingsKey(map), rivers: JSON.stringify(map.rivers),
      layers: LAYERS.map(name => map[name].slice()), height: hasHeight(map),
    };
  }

  // After a windowed update: refreshes the snapshot only inside the rectangle that changed (nothing else did).
  function refresh(map, d) {
    const w = map.width;
    LAYERS.forEach((name, k) => { for (let y = d.y0; y < d.y1; y++) snap.layers[k].set(map[name].subarray(y * w + d.x0, y * w + d.x1), y * w + d.x0); });
  }

  // Forgets the snapshot: the next rebuild solves everything.
  function forget() { snap = null; }

  // [index of the first value that differs, index of the last], or [-1, -1], found four bytes at a time from both ends.
  function differingSpan(a, b) {
    const n = a.length, words = n >> 2;
    if ((a.byteOffset | b.byteOffset) & 3) {                        // a view that is not word-aligned: plain bytes
      let f = 0; while (f < n && a[f] === b[f]) f++;
      if (f === n) return [-1, -1];
      let l = n - 1; while (a[l] === b[l]) l--;
      return [f, l];
    }
    const A = new Uint32Array(a.buffer, a.byteOffset, words), B = new Uint32Array(b.buffer, b.byteOffset, words);
    let lo = 0; while (lo < words && A[lo] === B[lo]) lo++;
    let first = lo * 4;
    if (lo === words) { first = words * 4; while (first < n && a[first] === b[first]) first++; if (first === n) return [-1, -1]; }
    else while (a[first] === b[first]) first++;
    let last = n - 1;
    let hi = words - 1; while (last >= words * 4 && a[last] === b[last]) last--;
    if (last < words * 4) { while (hi >= 0 && A[hi] === B[hi]) hi--; last = hi * 4 + 3; while (a[last] === b[last]) last--; }
    return [first, last];
  }

  // The rectangle ({ x0, y0, x1, y1, water }, x1 and y1 exclusive; water: the water layer changed) of painted pixels that differ
  // from the snapshot, null when none do, or a string saying why a full solve is needed.
  function dirtyRect(map) {
    if (!snap) return 'first solve';
    if (snap.w !== map.width || snap.h !== map.height) return 'new size';
    if (snap.seed !== map.seed) return 'new seed';
    if (snap.settings !== settingsKey(map)) return 'settings changed';
    if (snap.rivers !== JSON.stringify(map.rivers)) return 'rivers changed';
    const w = map.width, h = map.height;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, water = false;
    for (let k = 0; k < LAYERS.length; k++) {
      const a = map[LAYERS[k]], b = snap.layers[k];
      const [first, last] = differingSpan(a, b);
      if (first < 0) continue;
      if (k >= 3) return 'height painted';                          // elevation and terrace reshape the whole hillside
      if (k === 1) water = true;
      const ya = Math.floor(first / w), yb = Math.floor(last / w);
      if (ya < y0) y0 = ya; if (yb + 1 > y1) y1 = yb + 1;
      for (let y = ya; y <= yb; y++) {                              // the columns, only on the rows between the first and last difference
        const row = y * w;
        let xa = 0; while (xa < w && a[row + xa] === b[row + xa]) xa++;
        if (xa === w) continue;
        let xb = w - 1; while (a[row + xb] === b[row + xb]) xb--;
        if (xa < x0) x0 = xa; if (xb + 1 > x1) x1 = xb + 1;
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1, water };
  }

  // The differences between a world updated in place and a full solve of the same map, as readable lines (empty when they
  // agree). Water distances are compared up to Resolve.DIST_CAP and ground distances up to Resolve.GROUND_DIST_CAP.
  function diff(updated, full) {
    const caps = { waterDist: Resolve.DIST_CAP, landDist: Resolve.DIST_CAP, seaDist: Resolve.DIST_CAP, freshDist: Resolve.DIST_CAP,
      grassEdge: Resolve.GROUND_DIST_CAP, toWall: Resolve.GROUND_DIST_CAP };
    const out = [], w = full.w;
    for (const k of Object.keys(full)) {
      if (k === 'depth' || k === 'srcY') continue;           // not solve outputs: the raised-ground renderer fills them each frame
      const a = updated[k], b = full[k];
      if (!ArrayBuffer.isView(b)) {
        if (['riverPaths', 'bridges', 'raised'].includes(k) && JSON.stringify(a) !== JSON.stringify(b)) out.push(k + ' differs');
        continue;
      }
      if (!a || a.length !== b.length) { out.push(`${k}: length ${a && a.length} vs ${b.length}`); continue; }
      const cap = caps[k] || Infinity;
      let bad = 0, first = -1;
      for (let i = 0; i < b.length; i++) {
        if (cap === Infinity ? a[i] === b[i] : Math.min(a[i], cap) === Math.min(b[i], cap)) continue;
        bad++;
        if (first < 0) first = i;
      }
      if (bad) out.push(`${k}: ${bad} pixels differ, first at (${first % w}, ${(first / w) | 0}): updated ${a[first]}, full ${b[first]}`);
    }
    return out;
  }

  // True when a path (in the map now, or in the snapshot) lies within 4 pixels of the changed rectangle: the warp reads that
  // far, so a path pixel there may be a different pixel now.
  function pathNear(map, d) {
    const w = map.width, x0 = Math.max(0, d.x0 - 4), y0 = Math.max(0, d.y0 - 4), x1 = Math.min(w, d.x1 + 4), y1 = Math.min(map.height, d.y1 + 4);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; if (Types.isPath(map.ground[i]) || Types.isPath(snap.layers[0][i])) return true; }
    return false;
  }

  // Brings `world` (the solve of the previous painted state) up to date with the map. Returns { kind: 'none' } when the
  // painted layers did not change, { kind: 'window', interior, window, ms } when only the area around the edit was solved
  // again, or { kind: 'full', reason } when the caller must run Resolve.run (the snapshot is then left for it to remember).
  function update(map, world) {
    const d = dirtyRect(map);
    if (typeof d === 'string') return { kind: 'full', reason: d };
    if (d === null) return { kind: 'none' };
    // On a map with height, the hillside, cliffs, stairs and rivers' levels depend on water and on paths, so an edit that
    // changes water, or has a path (before or after) within a few pixels, takes the full solve. Ground and scatter edits
    // away from paths cannot change them.
    const heightActive = world.raised || snap.height;
    if (heightActive) {
      if (d.water) return { kind: 'full', reason: 'water edited on a map with height' };
      if (pathNear(map, d)) return { kind: 'full', reason: 'a path is near, on a map with height' };
    }
    const t0 = performance.now();
    const r = Resolve.runWindow(map, world, d, heightActive);
    if (!r.ok) return { kind: 'full', reason: r.reason };
    refresh(map, d);
    return { kind: 'window', interior: r.interior, window: r.window, dirty: d, ms: performance.now() - t0 };
  }

  return { remember, forget, update, diff, dirtyRect, LAYERS };
})();
