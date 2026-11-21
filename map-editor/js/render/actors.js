// Characters on the map. Heroes stand still until the player steers one (Play mode); villagers and monsters stroll
// about on their own along routes they can really walk. Villagers keep to paths when there are any near home.
// Each family sets its pace and range (CharacterArt.walk); some monsters patrol, walking far from end to end.
// One placed with rise: 1 lies under the ground by day and climbs out after dark (a.up: 0 buried, 1 out).
// The old wandering code (Wander) was removed; see docs/map-editor/plan.md Phase 24.
const Actors = (() => {
  const PLAYER_SPEED = 14;
  const PATROL = 2.5;     // a patroller's range, times its family's
  const SEARCH = 6000;    // most pixels a route search looks at (patrollers look at more)
  const STEPS = [5, 10];  // walk frames a second, slowest and fastest (a quick walker's legs move faster)
  const RISE = 0.4;       // how fast a riser climbs out or sinks back (share of its height a second)
  const NEAR = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const SECTORS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const actors = new Map();

  // Matches actors to the character objects on the map. A moved object restarts its actor there.
  function sync(map) {
    const seen = new Set();
    for (const o of map.objects) {
      if (!CharacterArt.has(o.type)) continue;
      seen.add(o.id);
      let a = actors.get(o.id);
      if (!a || a.homeX !== o.x || a.homeY !== o.y || a.type !== o.type || a.still !== !!o.still || a.rise !== !!o.rise) {
        const rng = Random.makeRng(o.seed), walk = CharacterArt.walk(o.type);
        a = { id: o.id, type: o.type, seed: o.seed, homeX: o.x, homeY: o.y, x: o.x + 0.5, y: o.y + 0.5, dir: 'south',
          moving: false, walkT: 0, rng, wanders: !!walk, route: null, wait: 1 + rng() * 4 };
        if (walk) {
          a.patrol = (rng() < walk.patrol && o.patrol !== 0) || o.patrol === 1;   // patrol: 0 rules patrols out, 1 makes one
          a.speed = walk.speed;
          a.roam = walk.roam * (a.patrol ? PATROL : 1);
          a.paths = !!walk.paths;
        }
        a.still = !!o.still;
        a.rise = !!o.rise;
        a.up = 0;
        if (a.still) a.wanders = false;                        // still: 1 stands where placed
        actors.set(o.id, a);
      }
    }
    for (const id of actors.keys()) if (!seen.has(id)) actors.delete(id);
  }

  function list() { return [...actors.values()]; }
  function get(id) { return actors.get(id); }
  function count() { return actors.size; }

  // Moves every actor. steer: { id, dx, dy } for the one the player controls, or null. live: false while paused
  // (villagers wait, and risers are simply out or in). night: 0 by day to 1 at night.
  function update(dt, world, steer, live, night) {
    for (const a of actors.values()) {
      if (a.rise) {
        const want = night > 0.5 ? 1 : 0;
        a.up = live ? Math.max(0, Math.min(1, a.up + Math.sign(want - a.up) * Math.min(Math.abs(want - a.up), RISE * dt))) : want;
      }
      if (steer && steer.id === a.id) { walkBy(a, world, steer.dx, steer.dy, PLAYER_SPEED * dt); a.route = null; }
      else if (a.rise && a.up < 1) a.moving = false;
      else if (a.wanders && live) stroll(a, world, dt);
      else a.moving = false;
      if (a.moving) a.walkT += dt * Math.max(STEPS[0], Math.min(STEPS[1], (steer && steer.id === a.id ? PLAYER_SPEED : a.speed || 6) * 1.1));
    }
  }

  // A stroller waits a few seconds, then walks a route to a spot near home (a villager to a path if one is near; a
  // patroller to one of the furthest spots it can reach), and so on.
  // A route that gets blocked (something placed in the way, or a leg that takes too long) is dropped, and a new
  // one is found after the wait.
  function stroll(a, world, dt) {
    if (!a.route) {
      a.moving = false;
      if ((a.wait -= dt) > 0) return;
      a.route = findRoute(a, world);
      a.wait = a.patrol ? 1 + a.rng() * 2 : 2 + a.rng() * 5;
      if (!a.route) return;
    }
    const [tx, ty] = a.route[0];
    const dx = tx + 0.5 - a.x, dy = ty + 0.5 - a.y, d = Math.hypot(dx, dy);
    if (d < 0.6) { a.route.shift(); a.legT = 0; if (!a.route.length) a.route = null; return; }
    const before = [a.x, a.y];
    walkBy(a, world, dx, dy, Math.min(d, a.speed * dt));
    a.legT = (a.legT || 0) + dt;
    if ((a.x === before[0] && a.y === before[1]) || a.legT > 2) { a.route = null; a.legT = 0; a.moving = false; }
  }

  // Breadth-first search over pixels the feet fit, within the actor's range of home. Picks a reached pixel at least
  // 8 steps away (a path pixel when there are some, for villagers; one of the furthest, for patrollers) and returns
  // the way there, as every 3rd pixel. One standing where its feet don't fit (dropped against furniture) starts
  // from the nearest spot that does. Null if stuck.
  function findRoute(a, world) {
    const { w } = world, limit = a.patrol ? SEARCH * 3 : SEARCH;
    const ok = (x, y) => fits(world, x + 0.5, y + 0.5);
    let sx = Math.floor(a.x), sy = Math.floor(a.y);
    const stuck = !ok(sx, sy);
    if (stuck) {
      const near = nearestFit(sx, sy, ok);
      if (!near) return null;
      [sx, sy] = near;
    }
    const start = sy * w + sx;
    const parent = new Map([[start, -1]]), dist = new Map([[start, 0]]);
    const queue = [start], far = [], paths = [];
    for (let q = 0; q < queue.length && queue.length < limit; q++) {
      const i = queue[q], x = i % w, y = (i / w) | 0, d = dist.get(i);
      if (d >= 8) { far.push(i); if (Types.isPath(world.ground[i])) paths.push(i); }
      for (const [ox, oy] of NEAR) {
        const nx = x + ox, ny = y + oy, j = ny * w + nx;
        if (dist.has(j) || Math.hypot(nx - a.homeX, (ny - a.homeY) / 0.7) > a.roam || !ok(nx, ny) || !Height.canStep(world, i, j)) continue;
        if (ox && oy && !(ok(x + ox, y) && ok(x, y + oy))) continue;
        if (world.water[j] && !world.deck[j] && !world.stones[j]) continue;   // wading is for heroes
        dist.set(j, d + 1);
        parent.set(j, i);
        queue.push(j);
      }
    }
    const pool = a.patrol ? far.slice(Math.floor(far.length * 0.75)) : a.paths && paths.length && a.rng() < 0.75 ? paths : far;
    if (!pool.length) return null;
    const route = [];
    for (let i = pool[Math.floor(a.rng() * pool.length)]; i !== start; i = parent.get(i)) route.push([i % w, (i / w) | 0]);
    route.reverse();
    const out = route.filter((p, k) => k % 3 === 2 || k === route.length - 1);
    if (stuck) out.unshift([sx, sy]);
    return out;
  }

  // The closest pixel within 5 of (x, y) where ok(x, y), or null.
  function nearestFit(x, y, ok) {
    let best = null, bd = Infinity;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const d = dx * dx + dy * dy;
      if (d < bd && ok(x + dx, y + dy)) { best = [x + dx, y + dy]; bd = d; }
    }
    return best;
  }

  // True if feet can stand here: dry land, a deck, a bridge, a stepping stone, or shallow water by the shore (wading),
  // and no wall, chasm, rail, or object in the way.
  function walkable(world, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 1 || yi < 1 || xi >= world.w - 1 || yi >= world.h - 1) return false;
    const i = yi * world.w + xi;
    if (world.span[i]) return world.span[i] === 1;
    return (!world.water[i] || world.deck[i] || world.stones[i] || Tracks.shallow(world, i)) && !world.blocked[i] && !Types.isWall(world.ground[i]) && !world.chasm[i];
  }

  // Feet are 3 pixels wide.
  function fits(world, x, y) { return walkable(world, x - 1, y) && walkable(world, x, y) && walkable(world, x + 1, y); }

  // True if feet can go from (x0, y0) to (x1, y1): they fit there, and it isn't up or down a cliff.
  function canMove(world, x0, y0, x1, y1) {
    const from = Math.floor(y0) * world.w + Math.floor(x0), to = Math.floor(y1) * world.w + Math.floor(x1);
    return fits(world, x1, y1) && Height.canStep(world, from, to);
  }

  // Steps by (dx, dy) scaled to len, sliding along walls. Returns false if it couldn't move at all.
  // Feet that don't fit where they stand (dropped against furniture) may step anywhere until they do.
  function walkBy(a, world, dx, dy, len) {
    const d = Math.hypot(dx, dy);
    a.moving = d > 0;
    if (!d) return true;
    a.dir = facing(dx, dy);
    const sx = dx / d * len, sy = dy / d * len;
    if (!fits(world, a.x, a.y)) {
      a.x = Math.max(2, Math.min(world.w - 3, a.x + sx)); a.y = Math.max(2, Math.min(world.h - 3, a.y + sy));
      return true;
    }
    if (canMove(world, a.x, a.y, a.x + sx, a.y + sy)) { a.x += sx; a.y += sy; return true; }
    if (sx && canMove(world, a.x, a.y, a.x + sx, a.y)) { a.x += sx; return true; }
    if (sy && canMove(world, a.x, a.y, a.x, a.y + sy)) { a.y += sy; return true; }
    return false;
  }

  // One of 8 facing names for a movement direction (screen y points down).
  function facing(dx, dy) {
    const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return SECTORS[(k + 8) % 8];
  }

  // Actor id under a map point (within the half-size sprite's box), front-most first.
  function hit(x, y) {
    const sorted = list().sort((p, q) => q.y - p.y);
    for (const a of sorted) {
      const g = CharacterArt.ghost(a.type, a.seed);
      if (g.hit.has(Math.floor(x - a.x + 0.5) + ',' + Math.floor(y - a.y + 0.5))) return a.id;
    }
    return null;
  }

  // Makes the map object's spot match where its actor is now, so a drag starts from there.
  function pin(map, id) {
    const a = actors.get(id), o = map.objects.find(ob => ob.id === id);
    if (!a || !o) return;
    o.x = a.homeX = Math.floor(a.x);
    o.y = a.homeY = Math.floor(a.y);
  }

  return { sync, list, get, count, update, hit, pin, walkable, fits, walkBy };
})();
