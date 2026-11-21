// Tracks: footprints that characters and animals leave in sand, snow, and mud, and rings on the water where a
// character wades through the shallows. Both fade with the animation time; nothing is saved with the map.
const Tracks = (() => {
  const { GROUND, isPath, isWall, isBuilt } = Types;
  const STRIDE = 2;            // pixels walked between two prints
  const MAX_PRINTS = 900;
  const LIFE = { sand: 30, snow: 60, mud: 45 };   // seconds a print takes to fade
  const DEPTH = { sand: 0.3, snow: 0.32, mud: 0.35 };
  const SNOW_TINT = [1, 0.8, 0.45];                 // prints in snow darken red most, so they look blue-grey
  const WADE = 2;              // characters can wade this far (pixels) into the water from the shore
  const RING_EVERY = 0.4;      // seconds between rings while wading
  const RING_LIFE = 1.4;
  let prints = [], rings = [], walkers = new Map();
  let trodden = null, tw = 0;  // 1 where a print flattened the tufts, per map pixel (tw wide)

  // Forgets every print and ring (a new or rebuilt map).
  function clear() { prints = []; rings = []; walkers = new Map(); trodden = null; }

  // True for water shallow enough to wade: within WADE of the shore, not under a bridge.
  function shallow(world, i) { return !!world.water[i] && !world.span[i] && world.waterDist[i] <= WADE; }

  // True if the feet at (x, y) stand in water (wading), not on a deck or a stepping stone.
  function wading(world, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= world.w || yi >= world.h) return false;
    const i = yi * world.w + xi;
    return shallow(world, i) && !world.deck[i] && !world.stones[i];
  }

  // Which kind of print the ground at pixel i takes, or null.
  function surface(world, s, i) {
    if (world.water[i] || world.deck[i] || world.span[i]) return null;
    const g = world.ground[i];
    if (g === GROUND.MUD) return 'mud';
    if (s.snow && !isPath(g) && !isWall(g) && !isBuilt(g) && !s.underground) return 'snow';
    if (g === GROUND.SAND) return 'sand';
    return null;
  }

  // Drops prints and rings for everyone who moved since the last frame.
  function update(world, s, time) {
    const seen = new Set();
    const step = (id, x, y, moving, rings2) => {
      seen.add(id);
      let w = walkers.get(id);
      if (!w) { walkers.set(id, { x, y, side: 1, ring: time }); return; }
      const d = Math.hypot(x - w.x, y - w.y);
      if (rings2 && wading(world, x, y) && time - w.ring >= (moving ? RING_EVERY : RING_EVERY * 3)) {
        rings.push({ x: Math.floor(x), y: Math.floor(y) + 1, born: time });
        w.ring = time;
      }
      if (d < STRIDE) return;
      // One print to the left or right of the path, alternating.
      const nx = -(y - w.y) / d, ny = (x - w.x) / d;
      const px = Math.round(x + nx * w.side * 0.8), py = Math.round(y + ny * w.side * 0.8);
      w.x = x; w.y = y; w.side = -w.side;
      if (px < 0 || py < 0 || px >= world.w || py >= world.h) return;
      const kind = surface(world, s, py * world.w + px);
      if (kind) prints.push({ x: px, y: py, kind, born: time });
    };
    for (const a of Actors.list()) step(a.id, a.x, a.y, a.moving, true);
    for (const a of Animals.list()) if (!Animals.isAquatic(a.type)) step(a.id, a.x, a.y, !!a.target, false);
    for (const id of walkers.keys()) if (!seen.has(id)) walkers.delete(id);
    if (prints.length > MAX_PRINTS) prints = prints.slice(-MAX_PRINTS);
    prints = prints.filter(p => time - p.born < LIFE[p.kind] && time >= p.born);
    rings = rings.filter(r => time - r.born < RING_LIFE && time >= r.born);
    if (!trodden || trodden.length !== world.w * world.h) trodden = new Uint8Array(world.w * world.h);
    else trodden.fill(0);
    tw = world.w;
    for (const p of prints) {
      for (let y = Math.max(0, p.y - 1); y <= Math.min(world.h - 1, p.y + 1); y++) {
        for (let x = Math.max(0, p.x - 2); x <= Math.min(world.w - 1, p.x + 2); x++) trodden[y * world.w + x] = 1;
      }
    }
  }

  // True if a print flattened the tufts and flowers at (x, y).
  function isTrodden(x, y) { return !!trodden && x >= 0 && x < tw && trodden[y * tw + x] === 1; }

  // How deep a print is now (0 to its kind's depth, fading as it ages).
  function printDepth(p, time) { return DEPTH[p.kind] * (1 - (time - p.born) / LIFE[p.kind]); }

  // Footprints: a dent (darker) with a lit rim below it, fading as they age.
  function drawPrints(frame, world, time) {
    for (const p of prints) {
      const k = printDepth(p, time);
      const i = (p.y * world.w + p.x) * 4;
      for (let c = 0; c < 3; c++) frame[i + c] *= 1 - k * (p.kind === 'snow' ? SNOW_TINT[c] : 1);
      if (p.y + 1 >= world.h) continue;
      const j = i + world.w * 4;
      for (let c = 0; c < 3; c++) frame[j + c] = Math.min(255, frame[j + c] * (1 + k * 0.35));
    }
  }

  // Radius and blend strength of a ring at this time.
  function ringShape(r, time) {
    const t = (time - r.born) / RING_LIFE;
    return { r: 1.5 + t * 4, alpha: 0.55 * (1 - t) };
  }

  // Rings spreading out from wading feet.
  function drawRings(frame, world, pal, time) {
    for (const r of rings) {
      const sh = ringShape(r, time);
      Water.ripple(frame, world, r.x, r.y, sh.r, sh.alpha, pal.foam);
    }
  }

  // What the GL pass draws now: { prints: [{ x, y, k, snow }], rings: [{ x, y, r, alpha }] }.
  function glState(time) {
    return {
      prints: prints.map(p => ({ x: p.x, y: p.y, k: printDepth(p, time), snow: p.kind === 'snow' })),
      rings: rings.map(r => ({ x: r.x, y: r.y, ...ringShape(r, time) })),
    };
  }

  return { clear, shallow, wading, update, isTrodden, drawPrints, drawRings, glState, SNOW_TINT };
})();
