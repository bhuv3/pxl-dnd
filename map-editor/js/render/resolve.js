// Turns the painted layers into the final terrain the renderer draws.
const Resolve = (() => {
  const { GROUND, WATER, isPath, isWall, isBuilt } = Types;
  const UNDERWATER = 9;   // ground value used under water pixels
  const CHASM_SPAN = 24;  // widest path that still counts as crossing a chasm (pixels to the drop on each side)

  // The empty world for a map: every layer Resolve fills, zeroed.
  function newWorld(map) {
    const w = map.width, h = map.height, n = w * h;
    return {
      w, h,
      ground: new Uint8Array(n),
      water: new Uint8Array(n),
      scatter: new Uint8Array(n),
      level: new Uint8Array(n),    // height level, warped like the other layers
      flowX: new Float32Array(n),
      flowY: new Float32Array(n),
      riverPaths: [],
      stones: new Uint8Array(n),
      crossing: new Uint8Array(n), // path kind where a river runs over a painted path (bridges go here)
      riverLevel: new Int8Array(n), // river water level: 0, or below 0 after a drop (Lower river)
      terrace: new Uint8Array(n),  // flattened ground (level + 1), warped like the other layers
      chasm: new Uint8Array(n),    // 1 where the ground drops away (painted chasm, and under bridges across it)
    };
  }

  // Builds the world: final layers plus distance data.
  function run(map) {
    const w = map.width, h = map.height;
    const s = map.settings;
    const world = newWorld(map);
    warpLayers(map, world, s.edgeWobble);
    if (s.raggedEdges) roughenGrass(world);
    markChasms(world);
    Rivers.stamp(map, world);
    markUnderwater(world);
    computeDecks(world, s);
    computeDistances(world);
    applyShoreRules(world, s);
    Bridges.place(world, s);
    Height.resolve(world, s);
    world.grassEdge = Grid.distanceField(w, h, Grid.maskWhere(world.ground, g => g !== GROUND.GRASS));
    world.toWall = Grid.distanceField(w, h, Grid.maskWhere(world.ground, isWall));
    indexWater(world, s);
    return world;
  }

  // ---------- Windowed solve (after a small edit) ----------

  // How far a painted change can alter anything the renderer reads, and how far a pixel looks for what it depends on, so the
  // window is the change grown by both. The water distances (waterDist, landDist, seaDist, freshDist) are read up to 40 pixels
  // (DIST_CAP) and change within 3 + 40 of a painted change; the ground distances (grassEdge, toWall) are only read below 3
  // (GROUND_DIST_CAP is 4) and the beach can turn ground up to about 26 pixels away, so 26 + 4 reaches. Both fit in 44.
  const R_CHANGE = 44, R_DEP = 44, R_STRUCTURE = 30;
  // Arrays the windowed solve copies from its scratch world into the previous world, inside the interior.
  const SPLICED = ['ground', 'water', 'scatter', 'level', 'terrace', 'chasm', 'stones', 'crossing', 'riverLevel', 'flowX', 'flowY',
    'waterDist', 'landDist', 'seaDist', 'freshDist', 'grassEdge', 'toWall', 'soft'];

  const grow = (r, by, w, h) => ({ x0: Math.max(0, r.x0 - by), y0: Math.max(0, r.y0 - by), x1: Math.min(w, r.x1 + by), y1: Math.min(h, r.y1 + by) });

  // True when any value of arr inside the rectangle satisfies test (default: nonzero).
  function anyIn(arr, r, w, test) {
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0, i = y * w + r.x0; x < r.x1; x++, i++) if (test ? test(arr[i]) : arr[i]) return true;
    return false;
  }

  // Re-solves only around an edit: `dirty` is the rectangle of painted pixels that changed ({ x0, y0, x1, y1 }, x1 and y1
  // exclusive) and `old` the world of the previous solve, which is updated in place. Everything is computed with the same
  // code and the same global coordinates as run(), over a window, then copied into the interior of the window (the dirty
  // rectangle grown by R_CHANGE), where it is exact. Water distances above DIST_CAP and ground distances above GROUND_DIST_CAP are not kept exact: nothing reads them.
  // heightActive: the map has height (hills, terraces, a chasm, lowered rivers). Height is not solved here, so the caller must
  // have checked that the edit cannot change it (no water changed, no path near: see Incremental). Returns { ok: true,
  // interior } or { ok: false, reason } when the edit is not local enough (a bridge, dock or chasm near it, a large change):
  // then old is untouched and the caller runs run().
  function runWindow(map, old, dirty, heightActive) {
    const { w, h } = old, s = map.settings, no = reason => ({ ok: false, reason });
    if (old.raised && !heightActive) return no('raised ground');
    const interior = grow(dirty, R_CHANGE, w, h), win = grow(interior, R_DEP, w, h);
    if ((win.x1 - win.x0) * (win.y1 - win.y0) > 0.35 * w * h) return no('a big change');
    const near = grow(win, R_STRUCTURE, w, h);
    if (anyIn(old.deck, near, w) || anyIn(old.span, near, w) || anyIn(old.crossing, near, w) || anyIn(old.chasm, near, w)) return no('a bridge, dock or chasm is near');

    const world = newWorld(map);
    warpLayers(map, world, s.edgeWobble, win);
    if (anyIn(world.water, win, w, v => v === WATER.CHASM)) return no('a chasm was painted');
    if (s.raggedEdges) roughenGrass(world, win);
    Rivers.stamp(map, world);
    markUnderwater(world, win);
    world.deck = new Uint8Array(w * h);
    if (s.bridges && seedDecks(world, world.deck, win)) return no('a dock would form');
    if (anyIn(world.crossing, win, w)) return no('a bridge would form');
    computeDistances(world, win);
    applyShoreRules(world, s, win);
    world.grassEdge = Grid.distanceField(w, h, Grid.maskWhere(world.ground, g => g !== GROUND.GRASS, win, w), win);
    world.toWall = Grid.distanceField(w, h, Grid.maskWhere(world.ground, isWall, win, w), win);
    world.soft = new Uint8Array(w * h);                        // Height.resolve's flag for hillside ground (the map is flat here)
    for (let y = win.y0; y < win.y1; y++) for (let x = win.x0, i = y * w + win.x0; x < win.x1; x++, i++) world.soft[i] = !world.water[i] && !world.terrace[i] && !world.chasm[i] ? 1 : 0;

    for (const name of SPLICED) copyRect(old[name], world[name], interior, w);
    spliceIndexLists(old, world, s, interior);
    return { ok: true, interior, window: win };
  }

  // Copies a rectangle of a w-wide layer.
  function copyRect(to, from, r, w) {
    for (let y = r.y0; y < r.y1; y++) to.set(from.subarray(y * w + r.x0, y * w + r.x1), y * w + r.x0);
  }

  // Updates waterIdx and washIdx (ascending pixel indices) for the interior: the entries outside it stay, the interior's are
  // listed again from the new world.
  function spliceIndexLists(old, world, s, interior) {
    const { w } = old, wet = [], wash = [];
    for (let y = interior.y0; y < interior.y1; y++) {
      for (let x = interior.x0, i = y * w + interior.x0; x < interior.x1; x++, i++) {
        if (world.water[i]) wet.push(i);
        else if (world.seaDist[i] <= s.waveReach + 1 && !world.deck[i]) wash.push(i);
      }
    }
    old.waterIdx = mergeIndices(old.waterIdx, wet, interior, w);
    old.washIdx = mergeIndices(old.washIdx, wash, interior, w);
  }

  // The sorted index list `list` without the entries inside the rectangle, merged with `added` (sorted, all inside it).
  function mergeIndices(list, added, r, w) {
    const out = new Int32Array(list.length + added.length);
    let n = 0, a = 0;
    for (let k = 0; k < list.length; k++) {
      const i = list[k], x = i % w, y = (i / w) | 0;
      if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) continue;
      while (a < added.length && added[a] < i) out[n++] = added[a++];
      out[n++] = i;
    }
    while (a < added.length) out[n++] = added[a++];
    return out.slice(0, n);
  }

  // The rectangle a step works on: the window (x1 and y1 exclusive), or the whole map.
  function bounds(world, win) { return win || { x0: 0, y0: 0, x1: world.w, y1: world.h }; }

  // Reads every layer through a small noise offset so painted edges look natural.
  // Built ground (stone walls, wood floors) keeps its exact shape, and nothing wobbles into it.
  function warpLayers(map, world, amount, win) {
    const { w, h } = world, b = bounds(world, win);
    for (let y = b.y0; y < b.y1; y++) {
      for (let x = b.x0; x < b.x1; x++) {
        const ox = (Random.noise(x, y, 6, 11) - 0.5) * 2 * amount;
        const oy = (Random.noise(x, y, 6, 23) - 0.5) * 2 * amount;
        const sx = Math.min(w - 1, Math.max(0, Math.round(x + ox)));
        const sy = Math.min(h - 1, Math.max(0, Math.round(y + oy)));
        const i = y * w + x, j = sy * w + sx;
        const exact = isBuilt(map.ground[i]) || isBuilt(map.ground[j]);
        world.ground[i] = exact ? map.ground[i] : map.ground[j];
        world.level[i] = map.elevation[exact ? i : j];
        world.terrace[i] = map.terrace[exact ? i : j];
        world.water[i] = map.water[j];
        world.scatter[i] = map.scatter[j];
      }
    }
  }

  // Flips a few pixels along grass borders so the edge looks ragged.
  function roughenGrass(world, win) {
    const { w, h } = world, b = bounds(world, win);
    const src = world.ground.slice();
    for (let y = Math.max(1, b.y0); y < Math.min(h - 1, b.y1); y++) {
      for (let x = Math.max(1, b.x0); x < Math.min(w - 1, b.x1); x++) {
        const i = y * w + x;
        const g = src[i];
        const nb = [src[i - 1], src[i + 1], src[i - w], src[i + w]];
        if (g === GROUND.GRASS) {
          const other = nb.find(v => v !== GROUND.GRASS);
          if (other !== undefined && !isBuilt(other) && Random.hash(x + 333, y) < 0.25) world.ground[i] = other;
        } else if (!isBuilt(g) && nb.includes(GROUND.GRASS) && Random.hash(x, y + 777) < 0.2) {
          world.ground[i] = GROUND.GRASS;
        }
      }
    }
  }

  // Painted chasms leave the water layer and become CHASM ground. A path painted across a chasm (path pixels with
  // the drop on both sides) becomes a crossing, so Bridges spans it like a river.
  function markChasms(world) {
    const { w, h, ground, water, chasm, crossing } = world;
    let any = false;
    for (let i = 0; i < w * h; i++) {
      if (water[i] !== WATER.CHASM) continue;
      chasm[i] = 1; water[i] = WATER.NONE; ground[i] = GROUND.CHASM; any = true;
    }
    if (!any) return;
    const dropAlong = (x, y, dx, dy) => {
      for (let k = 1; k <= CHASM_SPAN; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
        const j = ny * w + nx;
        if (chasm[j]) return true;
        if (!isPath(ground[j])) return false;
      }
      return false;
    };
    const over = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!isPath(ground[i])) continue;
        if ((dropAlong(x, y, -1, 0) && dropAlong(x, y, 1, 0)) || (dropAlong(x, y, 0, -1) && dropAlong(x, y, 0, 1))) over.push(i);
      }
    }
    for (const i of over) { crossing[i] = ground[i]; chasm[i] = 1; ground[i] = GROUND.CHASM; }
  }

  // Ground under water gets its own value, so land edges are detected against water too.
  function markUnderwater(world, win) {
    const { w } = world, b = bounds(world, win);
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0, i = y * w + b.x0; x < b.x1; x++, i++) if (world.water[i]) world.ground[i] = UNDERWATER;
  }

  // Distance fields used by shore rules, water bands, and details.
  function computeDistances(world, win) {
    const { w, h, water } = world;
    const field = test => Grid.distanceField(w, h, Grid.maskWhere(water, test, win, w), win);
    world.waterDist = field(v => v === WATER.NONE);
    world.landDist = field(v => v !== WATER.NONE);
    world.seaDist = field(v => v === WATER.SEA);
    world.freshDist = field(v => v === WATER.LAKE || v === WATER.RIVER);
  }

  // Planks on path pixels with lake or sea on both sides (docks and causeways; rivers get Bridges).
  // 1 = walk up/down, 2 = walk left/right.
  function computeDecks(world, s) {
    const { w, h, ground, water } = world;
    const deck = new Uint8Array(w * h);
    world.deck = deck;
    if (!s.bridges) return;
    const before = water.slice();
    seedDecks(world, deck, null);
    fillDeckHoles(world);
    unifyDecks(world);
    widenDecks(world);
    straightenDecks(world, before);
  }

  // Marks into deck the path pixels with lake or sea water reached along the path on both sides within 30 pixels (1 = walk
  // up/down, 2 = walk left/right), over the window or the whole map. Returns how many it marked.
  function seedDecks(world, deck, win) {
    const { w, h, ground, water } = world, b = bounds(world, win);
    const RANGE = 30;
    const wetAlong = (x, y, dx, dy) => {
      for (let k = 1; k <= RANGE; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
        const j = ny * w + nx;
        if (water[j]) return water[j] !== WATER.RIVER;
        if (!isPath(ground[j])) return false;
      }
      return false;
    };
    let count = 0;
    for (let y = b.y0; y < b.y1; y++) {
      for (let x = b.x0; x < b.x1; x++) {
        const i = y * w + x;
        if (water[i] || !isPath(ground[i])) continue;
        if (wetAlong(x, y, -1, 0) && wetAlong(x, y, 1, 0)) { deck[i] = 1; count++; }
        else if (wetAlong(x, y, 0, -1) && wetAlong(x, y, 0, 1)) { deck[i] = 2; count++; }
      }
    }
    return count;
  }

  // Path pixels mostly surrounded by deck become deck too.
  function fillDeckHoles(world) {
    const { w, h, ground, water, deck } = world;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (deck[i] || water[i] || !isPath(ground[i])) continue;
        const nb = [deck[i - 1], deck[i + 1], deck[i - w], deck[i + w]].filter(v => v);
        if (nb.length >= 3) deck[i] = nb[0];
      }
    }
  }

  // Gives each connected bridge or dock a single plank direction (the most common one).
  function unifyDecks(world) {
    const { deck } = world;
    const seen = new Uint8Array(deck.length);
    for (let start = 0; start < deck.length; start++) {
      if (!deck[start] || seen[start]) continue;
      const part = connected(world, start, seen);
      const count = [0, 0, 0];
      for (const i of part) count[deck[i]]++;
      const dir = count[1] >= count[2] ? 1 : 2;
      for (const i of part) deck[i] = dir;
    }
  }

  // Adds one plank of width on each side of a deck, over the water, so bridges read clearly.
  function widenDecks(world) {
    const { w, h, ground, water, deck } = world;
    const src = deck.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!src[i]) continue;
        const side = src[i] === 1 ? [i - 1, i + 1] : [i - w, i + w];
        for (const j of side) {
          if (!water[j] || src[j]) continue;
          water[j] = WATER.NONE;
          ground[j] = ground[i];
          deck[j] = src[i];
        }
      }
    }
  }

  // Turns each bridge or dock into a parallelogram that follows the path's angle, so its rails are straight lines.
  // The center line is fitted through the rows (or columns), the width is the median; length spans the whole deck.
  // Deck pixels left outside the rectangle go back to water (before: water as it was before decks).
  function straightenDecks(world, before) {
    const { w, h, deck, ground } = world;
    const seen = new Uint8Array(deck.length);
    for (let start = 0; start < deck.length; start++) {
      if (!deck[start] || seen[start]) continue;
      const part = connected(world, start, seen);
      const dir = deck[start];
      const across = new Map();   // row (dir 1) or column (dir 2) → [min, max] across the walk direction
      const kind = ground[start];
      let lo = Infinity, hi = -Infinity;
      for (const i of part) {
        const x = i % w, y = (i / w) | 0;
        const [along, side] = dir === 1 ? [y, x] : [x, y];
        lo = Math.min(lo, along); hi = Math.max(hi, along);
        const e = across.get(along) || [side, side];
        across.set(along, [Math.min(e[0], side), Math.max(e[1], side)]);
      }
      const line = fitLine([...across.entries()]);
      for (const i of part) deck[i] = 0;
      const kept = new Set();
      for (let along = lo; along <= hi; along++) {
        const a = Math.round(line.at(along) - line.width / 2);
        for (let side = Math.max(0, a); side < Math.min(a + line.width, dir === 1 ? w : h); side++) {
          const i = dir === 1 ? along * w + side : side * w + along;
          deck[i] = dir;
          seen[i] = 1;
          kept.add(i);
          world.water[i] = WATER.NONE;
          ground[i] = kind;
        }
      }
      for (const i of part) if (!kept.has(i)) refill(world, i, before);
    }
  }

  // A pixel cut from a deck: its old water, or water if mostly surrounded by it.
  function refill(world, i, before) {
    const { w, water, ground } = world;
    let kind = before[i];
    if (!kind) {
      const nb = [before[i - 1], before[i + 1], before[i - w], before[i + w]].filter(v => v);
      if (nb.length >= 2) kind = nb[0];
    }
    if (!kind) return;
    water[i] = kind;
    ground[i] = UNDERWATER;
  }

  // Straight center line through [along, [min, max]] rows (least squares) and their median width.
  function fitLine(rows) {
    let n = 0, sa = 0, sc = 0, saa = 0, sac = 0;
    const widths = [];
    for (const [a, [lo, hi]] of rows) {
      const c = (lo + hi + 1) / 2;
      n++; sa += a; sc += c; saa += a * a; sac += a * c;
      widths.push(hi - lo + 1);
    }
    const den = n * saa - sa * sa;
    const slope = den ? (n * sac - sa * sc) / den : 0;
    const base = (sc - slope * sa) / n;
    widths.sort((x, y) => x - y);
    return { at: a => base + slope * a, width: widths[widths.length >> 1] };
  }

  // Pixels of the deck connected to start (4-neighbors).
  function connected(world, start, seen) {
    const { w, deck } = world;
    const part = [start];
    seen[start] = 1;
    for (let k = 0; k < part.length; k++) {
      const i = part[k], x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < deck.length && deck[j] && !seen[j]) { seen[j] = 1; part.push(j); }
      }
    }
    return part;
  }

  // Beaches by the sea (not on paths, so a quay or a road keeps its stones), mud or sand rims by lakes and rivers.
  function applyShoreRules(world, s, win) {
    const { w, ground, water, seaDist, freshDist } = world, b = bounds(world, win);
    for (let y = b.y0; y < b.y1; y++) {
      for (let x = b.x0; x < b.x1; x++) {
        const i = y * w + x;
        if (water[i] || isWall(ground[i]) || isBuilt(ground[i])) continue;
        const beach = s.beachWidth + (Random.noise(x, y, 8, 70) - 0.5) * 2;
        if (s.beachWidth > 0 && seaDist[i] <= beach && !isPath(ground[i])) { ground[i] = GROUND.SAND; continue; }
        if (freshDist[i] > 1.5 || isPath(ground[i]) || ground[i] === GROUND.SAND) continue;
        if (s.lakeSandRim) ground[i] = GROUND.SAND;
        else if (s.mudBanks) ground[i] = GROUND.MUD;
      }
    }
  }

  // Lists of water pixels and wave-washed land pixels, so per-frame drawing stays fast.
  function indexWater(world, s) {
    const { water, seaDist } = world;
    const { w, deck } = world;
    const wet = [], wash = [], underDeck = [];
    for (let i = 0; i < water.length; i++) {
      if (water[i]) {
        wet.push(i);
        if (i >= w && deck[i - w]) underDeck.push(i);
      } else if (seaDist[i] <= s.waveReach + 1 && !deck[i]) wash.push(i);
    }
    world.waterIdx = Int32Array.from(wet);
    world.washIdx = Int32Array.from(wash);
    world.underDeck = Int32Array.from(underDeck);
  }

  // Short name of the terrain at a pixel, for the status bar.
  function describe(world, map, x, y) {
    const i = y * map.width + x;
    const parts = [];
    const water = world ? world.water[i] : map.water[i];
    if (world && (world.deck[i] || world.span[i])) parts.push('Bridge');
    else if (world && world.chasm[i]) parts.push('Chasm');
    else if (water === WATER.RIVER) parts.push('River');
    else if (water) parts.push(Types.materialFor('water', water).name);
    else {
      const g = world ? world.ground[i] : map.ground[i];
      parts.push(g === GROUND.MUD ? 'Mud' : Types.materialFor('ground', g).name);
    }
    if (map.scatter[i]) parts.push(Types.materialFor('scatter', map.scatter[i]).name.toLowerCase() + ' area');
    if (world && world.raised && world.lift[i] && !world.chasm[i]) {
      const level = Math.round(world.lift[i] / map.settings.levelHeight * 10) / 10;
      parts.push((world.terrace[i] && !water ? 'flat, ' : '') + 'level ' + level);
    }
    if (world && world.ramp && world.ramp[i]) parts.push('stairs');
    return parts.join(', ');
  }

  return { run, runWindow, describe, UNDERWATER, DIST_CAP: 40, GROUND_DIST_CAP: 4 };
})();
