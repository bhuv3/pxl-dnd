// Places automatic details (tufts, flowers, reeds, objects…) and draws the ones that move.
const Details = (() => {
  const { GROUND, WATER, SCATTER } = Types;
  const BEAM = [1.5, 1.42, 1.1];   // lighthouse beam color
  const BEAM_TURN = 0.9;           // its turning speed (radians a second)

  // Decides where every detail goes. Runs on rebuild.
  function place(world, map, pal) {
    const s = map.settings;
    const things = [];
    const flat = [];
    Sprites.configure(s, pal, map.seed);
    world.blocked = new Uint8Array(world.w * world.h);
    placeObjects(world, map, things, pal);
    placeScatter(world, s, things);
    if (s.beachRocks) placeBeachRocks(world, s, things);
    placeTufts(world, s, things);
    placeFlowers(world, s, things);
    if (s.reeds) placeReeds(world, things);
    if (s.lilyPads) placeLilies(world, s, flat);
    placeStones(world, flat);
    placeGlints(world, s);
    things.sort((a, b) => sortKey(a) - sortKey(b));
    collectAnchors(world, things);
    world.things = things;
    world.flat = flat;
  }

  // Draw order: flat things (rugs) first, the rest back to front.
  function sortKey(t) { return t.kind === 'object' && t.sprite.flat ? -1 : t.y; }

  // Pixel index, or -1 when outside the map.
  function at(world, x, y) { return x < 0 || y < 0 || x >= world.w || y >= world.h ? -1 : y * world.w + x; }

  // True if a pixel is dry grass with nothing standing on it.
  function isGrass(world, x, y) {
    const i = at(world, x, y);
    return i >= 0 && world.ground[i] === GROUND.GRASS && !world.water[i] && !world.blocked[i] && !world.span[i];
  }

  // An object thing with its cached sprite. Marks the ground around its base as taken.
  // Buildings take their whole footprint; a sprite with a blocks list takes just those spots.
  function objectThing(world, type, x, y, seed, scale, id, turn) {
    const sprite = Sprites.get(type, seed, scale, turn);
    const block = (px, py) => { const i = at(world, px, py); if (i >= 0) world.blocked[i] = 1; };
    if (sprite.blocks) {
      for (const [bx, by] of sprite.blocks) for (let d = -1; d <= 1; d++) { block(x + bx + d, y + by); block(x + bx, y + by + d); }
    } else {
      const fp = sprite.footprint;
      const r = Math.max(1, Math.round((sprite.box.maxX - sprite.box.minX) / 4));
      const [x0, x1] = fp ? [sprite.box.minX, sprite.box.maxX] : [-r, r];
      for (let dy = fp ? -fp : -1; dy <= 1; dy++) for (let dx = x0; dx <= x1; dx++) block(x + dx, y + dy);
    }
    return { kind: 'object', type, x, y, sprite, id, phase: (seed % 1000) / 1000 * Math.PI * 2 };
  }

  // Map positions of lit windows, chimneys, fires and other lights, fairy rings and lighthouse lamps, from the
  // sprites' anchors. lift: how far up they're drawn on raised ground.
  function collectAnchors(world, things) {
    world.windows = []; world.chimneys = []; world.fires = []; world.rings = []; world.beams = [];
    for (const t of things) {
      const b = t.kind === 'object' && t.sprite.beam;
      if (b) world.beams.push({ x: t.x + b.x, y: t.y + b.y - Height.liftAt(world, t.x, t.y), phase: t.phase });
      const a = t.kind === 'object' && t.sprite.anchors;
      if (!a) continue;
      const key = Math.floor(Random.hash(t.x, t.y + 3) * 1000), lift = Height.liftAt(world, t.x, t.y);
      for (const [wx, wy, n] of a.windows || []) world.windows.push({ x: t.x + wx, y: t.y + wy, key: key + n * 17, lift });
      if (a.chimney) world.chimneys.push({ x: t.x + a.chimney[0], y: t.y + a.chimney[1], key, lift });
      if (a.fire) world.fires.push({ x: t.x + a.fire[0], y: t.y + a.fire[1], key, kind: 'campfire', lift });
      if (a.light) world.fires.push({ x: t.x + a.light[0], y: t.y + a.light[1], key, kind: a.light[2], lift });
      (a.lights || []).forEach(([lx, ly, kind], k) => world.fires.push({ x: t.x + lx, y: t.y + ly, key: key + k * 31, kind, lift }));
      if (a.ring) world.rings.push({ x: t.x, y: t.y + a.ring.cy, rx: a.ring.rx, ry: a.ring.ry });
    }
  }

  // Objects the user placed one by one. Characters and animals move, so they're drawn separately.
  // A door is fitted to the gap it stands in; it disappears if its walls are gone.
  // Types that no longer exist (like the old stairs stamp) are kept in the data but not drawn.
  function placeObjects(world, map, things, pal) {
    for (const o of map.objects) {
      if (CharacterArt.has(o.type) || Animals.has(o.type) || !Types.OBJECTS.includes(o.type)) continue;
      if (o.type !== 'door') { things.push(objectThing(world, o.type, o.x, o.y, o.seed, o.scale, o.id, o.turn)); continue; }
      const fit = Doors.fit(world, o.x, o.y);
      if (fit) things.push({ kind: 'object', type: 'door', x: o.x, y: o.y, id: o.id, phase: 0, sprite: Doors.sprite(fit, pal, false), open: Doors.sprite(fit, pal, true) });
    }
  }

  // Grid cell size (spacing) for each scatter region type.
  function scatterCell(type, s) {
    const k = s.forestSpacing;
    const G = Sprites.GROW;                  // trees stand further apart the bigger they are drawn
    if (type === SCATTER.FOREST) return Math.max(4, Math.round(s.treeSize * 1.5 * k * G.tree));
    if (type === SCATTER.PINES) return Math.max(4, Math.round(s.pineSize * 1.6 * k * G.pine));
    if (type === SCATTER.ROCKY) return Math.max(4, Math.round(s.rockSize * 2.2 * k * G.rock));
    if (type === SCATTER.BUSHES) return Math.max(3, Math.round(s.bushSize * 2 * k * G.bush));
    return 4;
  }

  // Fills painted scatter regions using a jittered grid: one candidate per cell.
  function placeScatter(world, s, things) {
    const { w, h, scatter } = world;
    const present = new Set(scatter);
    present.delete(SCATTER.NONE);
    if (!present.size) return;
    const edge = Grid.distanceField(w, h, Grid.maskWhere(scatter, v => v === SCATTER.NONE));
    for (const type of present) {
      const cell = scatterCell(type, s);
      const salt = type * 1009;
      for (let cy = 0; cy < h; cy += cell) {
        for (let cx = 0; cx < w; cx += cell) {
          const x = cx + Math.floor(Random.hash(cx + salt, cy) * cell);
          const y = cy + Math.floor(Random.hash(cx, cy + salt) * cell);
          const i = at(world, x, y);
          if (i < 0 || scatter[i] !== type || world.water[i] || world.span[i] || world.chasm[i] || Types.isPath(world.ground[i]) || Types.isWall(world.ground[i])) continue;
          if (type === SCATTER.FLOWERS) { addMeadow(world, x, y, cell, things); continue; }
          if (world.blocked[i]) continue;
          const clump = 0.6 + 0.8 * Random.noise(x, y, 30, salt);
          const nearEdge = edge[i] <= 3;
          if (Random.hash(x + salt, y + 13) > s.forestDensity * clump * (nearEdge ? 0.7 : 1)) {
            if (type === SCATTER.FOREST || type === SCATTER.PINES) addForestFloor(world, s, x, y, salt, things);
            continue;
          }
          const pick = scatterObject(type, nearEdge, Random.hash(x + 7, y + salt));
          const seed = Math.floor(Random.hash(x + salt, y + 99) * 1e9);
          const scale = pick.scale * (0.85 + Random.hash(x, y + 31) * 0.3);
          things.push(objectThing(world, pick.type, x, y, seed, scale));
        }
      }
    }
  }

  // Sometimes a log, stump, or mushrooms in a forest cell that got no tree.
  function addForestFloor(world, s, x, y, salt, things) {
    const r = Random.hash(x + salt, y + 211);
    if (r > s.forestFloor * 0.6) return;
    const k = r / (s.forestFloor * 0.6);
    const type = k < 0.3 ? 'log' : k < 0.6 ? 'stump' : 'mushrooms';
    const seed = Math.floor(Random.hash(x + salt, y + 223) * 1e9);
    things.push(objectThing(world, type, x, y, seed, 0.8 + Random.hash(x, y + 227) * 0.3));
  }

  // Which object a scatter cell gets. Forest edges get bushes.
  function scatterObject(type, nearEdge, r) {
    if (type === SCATTER.FOREST) {
      if (nearEdge ? r < 0.6 : r < 0.15) return { type: 'bush', scale: 1 };
      return { type: 'tree', scale: 1 };
    }
    if (type === SCATTER.PINES) {
      if (nearEdge && r < 0.4) return { type: 'bush', scale: 0.9 };
      return r < 0.08 ? { type: 'tree', scale: 0.9 } : { type: 'pine', scale: 1 };
    }
    if (type === SCATTER.BUSHES) return { type: 'bush', scale: 0.8 + r * 0.4 };
    if (r < 0.35) return { type: 'pebble', scale: 1 };
    return { type: 'rock', scale: 0.5 + r * 0.8 };
  }

  // A small burst of flowers around a point, on grass or dirt.
  function addMeadow(world, x, y, cell, things) {
    const n = Random.hash(x + 61, y) < 0.3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const fx = x + Math.floor((Random.hash(x + k, y + 71) - 0.5) * cell);
      const fy = y + Math.floor((Random.hash(x, y + k + 81) - 0.5) * cell);
      const i = at(world, fx, fy);
      if (i < 0 || world.water[i] || world.blocked[i] || world.span[i] || world.chasm[i] || Types.isWall(world.ground[i])) continue;
      things.push({ kind: 'flower', x: fx, y: fy, color: Math.floor(Random.hash(fx, fy + 91) * 3), tall: Random.hash(fx + 3, fy) < 0.6 });
    }
  }

  // A few small rocks on the beach, above the reach of the waves.
  function placeBeachRocks(world, s, things) {
    const { w, h, ground, water, seaDist } = world;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (water[i] || ground[i] !== GROUND.SAND || seaDist[i] > s.beachWidth || seaDist[i] < s.waveReach + 1.5) continue;
        if (Random.hash(x + 4001, y + 977) > 0.0025) continue;
        const seed = Math.floor(Random.hash(x, y + 5) * 1e9);
        const big = Random.hash(x + 3, y) < 0.35;
        things.push(objectThing(world, big ? 'rock' : 'pebble', x, y, seed, big ? 0.5 : 1));
      }
    }
  }

  // Grass tufts: clumped by noise, thinner near grass edges.
  function placeTufts(world, s, things) {
    const { w, h } = world;
    const count = Math.round(w * h * s.tuftDensity / 100 * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Random.hash(i, 1) * w), y = Math.floor(Random.hash(i, 2) * h);
      if (!isGrass(world, x, y)) continue;
      if (world.grassEdge[y * w + x] < 2.5 && Random.hash(i, 7) < 0.75) continue;
      if (Random.hash(i, 3) > Random.noise(x, y, 14, 1000)) continue;
      things.push({ kind: 'tuft', x, y, r1: Random.hash(i, 4), r2: Random.hash(i, 5), r3: Random.hash(i, 6), r4: Random.hash(i, 8) });
    }
  }

  // Wild flowers in noise patches on grass.
  function placeFlowers(world, s, things) {
    const { w, h } = world;
    const count = Math.round(w * h * s.flowerAmount / 100 * 3);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Random.hash(i, 41) * w), y = Math.floor(Random.hash(i, 42) * h);
      if (!isGrass(world, x, y) || world.grassEdge[y * w + x] < 2) continue;
      if (Random.noise(x, y, 20, 1300) < 0.5) continue;
      things.push({ kind: 'flower', x, y, color: Math.floor(Random.hash(i, 43) * 3), tall: Random.hash(i, 44) < 0.5 });
    }
  }

  // Reeds along lake and river banks, in patches. Never by the sea.
  function placeReeds(world, things) {
    const { w, h, water, waterDist, freshDist, seaDist } = world;
    const count = Math.round(w * h * 6 / 100);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Random.hash(i, 11) * w), y = Math.floor(Random.hash(i, 12) * h);
      const p = y * w + x;
      const kind = water[p];
      const nearEdge = kind ? kind !== WATER.SEA && waterDist[p] <= 1.5 : freshDist[p] <= 2.5 && seaDist[p] > 4;
      if (!nearEdge || world.blocked[p] || Types.isPath(world.ground[p]) || Types.isWall(world.ground[p]) || nearDeck(world, x, y, 3)) continue;
      if (Random.noise(x, y, 10, 1100) < 0.45) continue;
      things.push({ kind: 'reed', x, y, r1: Random.hash(i, 13), r2: Random.hash(i, 14), r3: Random.hash(i, 15) });
    }
  }

  // True if a bridge or dock is within r pixels.
  function nearDeck(world, x, y, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const i = at(world, x + dx, y + dy);
        if (i >= 0 && (world.deck[i] || world.span[i])) return true;
      }
    }
    return false;
  }

  // Lily pads in calm, shallow lake water.
  function placeLilies(world, s, flat) {
    const { w, h, water, waterDist } = world;
    const count = Math.round(w * h * 2 / 100);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Random.hash(i, 31) * w), y = Math.floor(Random.hash(i, 32) * h);
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const p = at(world, x + dx, y + dy);
          if (p < 0 || water[p] !== WATER.LAKE || waterDist[p] < 2.5) ok = false;
        }
      }
      if (!ok || waterDist[y * w + x] > s.bandWidth * 3 + 2) continue;
      if (Random.noise(x, y, 8, 1200) < 0.4) continue;
      if (nearDeck(world, x, y, 2)) continue;
      flat.push({ kind: 'lily', x, y, flower: Random.hash(i, 33) < 0.3 });
    }
  }

  // Stepping stones: a flat stone every few pixels where a path crosses a narrow river.
  function placeStones(world, flat) {
    const { w, h, stones } = world;
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        if (stones[y * w + x] && x % 3 === 0 && y % 2 === 0) flat.push({ kind: 'stone', x, y });
      }
    }
  }

  // Twinkling glints on lakes and the sea, away from the shore.
  function placeGlints(world, s) {
    const { w, h, water, waterDist } = world;
    const glints = [];
    const count = Math.round(world.waterIdx.length * s.glintDensity / 100);
    for (let i = 0; i < count * 3 && glints.length < count; i++) {
      const x = Math.floor(Random.hash(i, 21) * w), y = Math.floor(Random.hash(i, 22) * h);
      const p = y * w + x;
      const kind = water[p];
      if (!kind || kind === WATER.RIVER || waterDist[p] < 2.5) continue;
      glints.push({ x, y, phase: Random.hash(i, 23) * Math.PI * 2, speed: 0.7 + Random.hash(i, 24) * 0.6 });
    }
    world.glints = glints;
    placeRiverGlints(world, s);
  }

  // Glints that travel down each river: a spot along the path plus a sideways offset.
  function placeRiverGlints(world, s) {
    const out = [];
    world.riverPaths.forEach((path, n) => {
      const count = Math.round(path.length * s.glintDensity / 12);
      for (let i = 0; i < count; i++) {
        out.push({
          path: n,
          u0: Random.hash(i + n * 7919, 51) * path.length,
          side: (Random.hash(i + n * 7919, 52) - 0.5) * 1.2,
          speed: 0.6 + Random.hash(i + n * 7919, 53) * 0.8,
          phase: Random.hash(i + n * 7919, 54) * Math.PI * 2,
        });
      }
    });
    world.riverGlints = out;
  }

  // Wind offset for something at (x, y).
  function windAt(s, time, x, y, scale) {
    if (!s.wind) return 0;
    return Math.sin(time * s.windSpeed * 1.3 + x * 0.09 + y * 0.05) * s.windStrength * scale;
  }

  // Draws details for one frame: flat things first, then the rest back to front.
  function draw(frame, world, s, pal, time) {
    drawFlat(frame, world, pal);
    const put = makePut(frame, world);
    for (const t of world.things) if (!(t.kind === 'object' && t.sprite.flat)) drawThing(put, t, s, pal, time);
  }

  // Things that lie flat on the ground or water: lily pads, stepping stones, rugs.
  // Things and flat pieces sorted into 32-pixel cells (made once per world), so drawIn only looks at those near its box.
  const CELL = 32, cellIndexes = new WeakMap();
  function cellIndex(world) {
    let ix = cellIndexes.get(world);
    if (ix && ix.things === world.things && ix.count === world.things.length + world.flat.length) return ix;
    const cols = Math.ceil(world.w / CELL), rows = Math.ceil(world.h / CELL), cells = Array.from({ length: cols * rows }, () => []);
    const put = (item, n, flat) => { cells[Math.min(rows - 1, Math.max(0, Math.floor(item.y / CELL))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(item.x / CELL)))].push({ item, n, flat }); };
    world.flat.forEach((f, n) => put(f, n, true));
    world.things.forEach((t, n) => put(t, n, false));
    ix = { cols, rows, cells, things: world.things, count: world.things.length + world.flat.length };
    cellIndexes.set(world, ix);
    return ix;
  }

  // How far a thing's pixels can reach from its position (offsets from x, y, with room for sway), from its sprite's pixels (cached).
  const extents = new WeakMap();
  function reachOf(t, flat) {
    if (flat || !t.sprite || !t.sprite.px) return { x0: -12, y0: -12, x1: 12, y1: 12 };         // tufts, flowers, reeds, stones, lilies
    let r = extents.get(t.sprite);
    if (!r) {
      const margin = t.sprite.sails ? 48 : 8;
      r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const sp of [t.sprite, t.open].filter(Boolean)) for (const p of sp.px) {
        r.x0 = Math.min(r.x0, p.x - margin); r.x1 = Math.max(r.x1, p.x + margin); r.y0 = Math.min(r.y0, p.y - margin); r.y1 = Math.max(r.y1, p.y + margin);
      }
      extents.set(t.sprite, r);
    }
    return r;
  }

  // Draws only what can touch the pixel box { x0, y0, x1, y1 } (things within `reach` pixels of it), into frame, in draw's order and
  // with draw's rules, writing nothing outside the box: for a page that needs a few pixels of this stage at the current time
  // without drawing the map (the game's lightAt).
  function drawIn(frame, world, s, pal, time, box, reach = 64) {
    const base = makePut(frame, world), ix = cellIndex(world);
    const put = (x, y, c, g) => { if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) base(x, y, c, g); };
    const cx0 = Math.max(0, Math.floor((box.x0 - reach) / CELL)), cx1 = Math.min(ix.cols - 1, Math.floor((box.x1 + reach) / CELL));
    const cy0 = Math.max(0, Math.floor((box.y0 - reach) / CELL)), cy1 = Math.min(ix.rows - 1, Math.floor((box.y1 + reach) / CELL));
    const flats = [], flatObjects = [], things = [];
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (const e of ix.cells[cy * ix.cols + cx]) {
          const t = e.item, r = reachOf(t, e.flat);
          if (t.x + r.x1 < box.x0 || t.x + r.x0 > box.x1 || t.y + r.y1 < box.y0 || t.y + r.y0 > box.y1) continue;
          if (e.flat) flats.push(e);
          else if (t.kind === 'object' && t.sprite.flat) flatObjects.push(e);
          else things.push(e);
        }
      }
    }
    const inOrder = (p, q) => p.n - q.n;
    for (const { item: f } of flats.sort(inOrder)) { if (f.kind === 'lily') Sprites.drawLily(put, f, pal); else Sprites.drawStone(put, f, pal); }
    for (const { item: t } of flatObjects.sort(inOrder)) Sprites.drawSprite(put, t.sprite, t.x, t.y, 0);
    for (const { item: t } of things.sort(inOrder)) drawThing(put, t, s, pal, time);
  }
  function drawFlat(frame, world, pal) {
    const put = makePut(frame, world);
    for (const f of world.flat) {
      if (f.kind === 'lily') Sprites.drawLily(put, f, pal);
      else Sprites.drawStone(put, f, pal);
    }
    for (const t of world.things) if (t.kind === 'object' && t.sprite.flat) Sprites.drawSprite(put, t.sprite, t.x, t.y, 0);
  }

  // Draws one tuft, flower, reed, or object with its wind sway.
  function drawThing(put, t, s, pal, time) {
    const sway = windAt(s, time, t.x, t.y, 1);
    if ((t.kind === 'tuft' || t.kind === 'flower') && Tracks.isTrodden(t.x, t.y)) return;   // flattened underfoot
    if (t.kind === 'tuft') Sprites.drawTuft(put, t, sway, pal);
    else if (t.kind === 'flower') Sprites.drawFlower(put, t, sway, pal);
    else if (t.kind === 'reed') Sprites.drawReed(put, t, sway, pal);
    else if (t.kind === 'object' && t.sprite.bob) {
      // Floating: rides up and down a pixel and rocks (only the mast and sail have sway weight).
      Sprites.drawSprite(put, t.sprite, t.x, t.y + Math.round(Math.sin(time * 1.6 + t.phase) * 0.7), Math.sin(time * 1.1 + t.phase) * 1.4);
    } else if (t.kind === 'object') {
      Sprites.drawSprite(put, t.open && Doors.isOpen(t) ? t.open : t.sprite, t.x, t.y, objectSway(s, time, t));
      if (t.sprite.sails) Landmarks.drawSails(put, t.sprite.sails, t.x, t.y, s, time);
    }
  }

  // At night each lighthouse's beam sweeps round: pools of light along it, fading with distance from the lamp.
  function addBeams(world, time, dark) {
    const night = Fire.nightOf(dark);
    if (night <= 0 || !world.beams) return;
    for (const b of world.beams) {
      const a = time * BEAM_TURN + b.phase;
      for (let k = 1; k <= 7; k++) {
        const d = k * 11;
        Fire.addLight(world, Math.round(b.x + Math.cos(a) * d), Math.round(b.y + Math.sin(a) * d * 0.6), night * (1.15 - k * 0.11), BEAM, 6 + k * 2.2);
      }
    }
  }

  // Slow, whole-tree sway. Rocks don't move (their pixels have no sway weight).
  function objectSway(s, time, t) {
    if (!s.wind) return 0;
    return Math.sin(time * s.windSpeed + t.x * 0.05 + t.phase * 0.3) * s.windStrength;
  }

  // Pixel writer for the frame. Ground-level pixels get darkened inside shadows.
  function makePut(frame, world) {
    const { w, h, shadowMask } = world;
    return (x, y, c, groundLevel) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x, i = p * 4;
      if (groundLevel && shadowMask && shadowMask[p]) {
        const f = Ground.SHADE;
        frame[i] = c[0] * f[0]; frame[i + 1] = c[1] * f[1]; frame[i + 2] = c[2] * f[2];
      } else {
        frame[i] = c[0]; frame[i + 1] = c[1]; frame[i + 2] = c[2];
      }
    };
  }

  return { place, draw, drawIn, drawFlat, drawThing, makePut, addBeams };
})();
