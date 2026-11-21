// Doors: fill a gap between two walls. The gap sets the door's width and which way it faces,
// and a door swings open while a character or animal is close.
const Doors = (() => {
  const MAX_GAP = 24;     // widest doorway, in pixels
  const MAX_WALL = 12;    // thickest wall a door can sit in
  const NEAR = 10;        // this close, the door opens

  function wall(world, x, y) {
    return x >= 0 && y >= 0 && x < world.w && y < world.h && Types.isWall(world.ground[y * world.w + x]);
  }

  // First wall pixel from (x, y) stepping by (dx, dy), as a step count, or 0 if none within MAX_GAP.
  function reach(world, x, y, dx, dy) {
    for (let k = 1; k <= MAX_GAP + 1; k++) if (wall(world, x + dx * k, y + dy * k)) return k;
    return 0;
  }

  // The gap around (x, y) with walls on both sides: along the row (a wall running left-right, door seen from
  // the front) or along the column (a wall running up-down, door seen edge-on). Picks the narrower one.
  // Returns { across, g0, g1 (gap), b0, b1 (wall thickness) }, or null.
  function fit(world, x, y) {
    if (!world || wall(world, x, y)) return null;
    const options = [measure(world, x, y, true), measure(world, x, y, false)].filter(Boolean);
    return options.sort((a, b) => (a.g1 - a.g0) - (b.g1 - b.g0))[0] || null;
  }

  // One orientation. across = the wall runs left-right (the gap is a run of columns).
  function measure(world, x, y, across) {
    const [dx, dy] = across ? [1, 0] : [0, 1];
    const lo = reach(world, x, y, -dx, -dy), hi = reach(world, x, y, dx, dy);
    if (!lo || !hi) return null;
    const g0 = (across ? x : y) - lo + 1, g1 = (across ? x : y) + hi - 1;
    const sideA = across ? [g0 - 1, null] : [null, g0 - 1], sideB = across ? [g1 + 1, null] : [null, g1 + 1];
    const solid = t => {
      const [ax, ay] = across ? [sideA[0], t] : [t, sideA[1]], [bx, by] = across ? [sideB[0], t] : [t, sideB[1]];
      return wall(world, ax, ay) && wall(world, bx, by);
    };
    let b0 = across ? y : x, b1 = b0;
    while (b1 - b0 < MAX_WALL && solid(b0 - 1)) b0--;
    while (b1 - b0 < MAX_WALL && solid(b1 + 1)) b1++;
    if (b1 - b0 >= MAX_WALL) return null;
    return { across, g0, g1, b0, b1 };
  }

  // Where the door object sits: the middle of the gap, on the wall's bottom row (or the gap's bottom row).
  function spot(f) {
    return f.across ? [Math.round((f.g0 + f.g1) / 2), f.b1] : [Math.round((f.b0 + f.b1) / 2), f.g1];
  }

  // Sprite for a fitted door, relative to its spot. Closed: a plank door filling the gap (front view) or a plank
  // edge down the wall's middle (edge-on). Open: the frame stays and the leaf swings into the room behind.
  function sprite(f, P, open) {
    const [ox, oy] = spot(f), px = [];
    const put = (x, y, c) => px.push({ x: x - ox, y: y - oy, c, w: 0 });
    if (f.across) {
      for (let y = f.b0; y <= f.b1; y++) {
        for (let x = f.g0; x <= f.g1; x++) {
          const frame = x === f.g0 || x === f.g1 || y === f.b0;
          if (open && !frame) continue;
          let c = frame ? P.trunkDark : y === f.b1 ? P.woodDark : (x - f.g0) % 3 === 0 ? P.woodDark : (x - f.g0) % 2 ? P.wood : P.woodAlt;
          if (!open && x === f.g1 - 2 && y === f.b0 + Math.ceil((f.b1 - f.b0) * 0.55)) c = P.windowLit;
          put(x, y, c);
        }
      }
      if (open) for (let k = 1; k <= f.g1 - f.g0 - 1; k++) put(f.g0 + 1, f.b0 - k, k % 3 ? P.wood : P.woodDark);
    } else {
      const x = ox;
      for (const y of [f.g0, f.g1]) for (let k = -1; k <= 1; k++) put(x + k, y, k ? P.stoneDark : P.stoneLight);   // jambs
      if (open) {
        for (let k = 1; k <= f.g1 - f.g0 - 1; k++) { put(x + 1 + k, f.g0 + 1, k % 3 ? P.woodLight : P.woodDark); put(x + 1 + k, f.g0 + 2, P.trunkDark); }
      } else {
        for (let y = f.g0 + 1; y < f.g1; y++) {
          put(x - 1, y, P.trunkDark);
          put(x, y, (y - f.g0) % 3 === 0 ? P.wood : P.woodLight);
          put(x + 1, y, P.trunkDark);
        }
      }
    }
    return finish(px);
  }

  // Adds the bounds and hit set every sprite has. Doors never block walking.
  function finish(px) {
    const xs = px.map(p => p.x), ys = px.map(p => p.y);
    return { px, shadowR: 0, blocks: [], box: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
      hit: new Set(px.map(p => p.x + ',' + p.y)) };
  }

  // A small closed door for the toolbar ghost when there's no gap under the cursor.
  function icon(P) {
    return sprite({ across: true, g0: -3, g1: 3, b0: -5, b1: 0 }, P, false);
  }

  // True while a character or animal is near the door's middle.
  function isOpen(t) {
    const b = t.sprite.box, cx = t.x + (b.minX + b.maxX) / 2, cy = t.y + (b.minY + b.maxY) / 2;
    const near = a => Math.abs(a.x - cx) < NEAR && Math.abs(a.y - cy) < NEAR;
    return Actors.list().some(near) || Animals.list().some(near);
  }

  return { fit, spot, sprite, icon, isOpen };
})();
