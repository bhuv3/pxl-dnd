// The combat grid: 10 map pixels = one 5 ft square. Which squares walls, furniture, and water block, who stands where,
// where a creature can walk this turn (diagonals cost 5 ft, the 5e default), the path there, reach, and line of
// sight between squares (walls block it; creatures and furniture don't).
const Squares = (() => {
  const SIZE = 10;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let world = null, cols = 0, rows = 0, solid = null;
  const closed = new Set(), avoid = new Set();   // keys: closed doors (block walking and sight); squares to keep off (a found trap)

  // Reads which squares are solid: walls, or furniture covering part of the square's middle.
  function setWorld(w) {
    world = w;
    cols = Math.floor(w.w / SIZE); rows = Math.floor(w.h / SIZE);
    solid = new Uint8Array(cols * rows);
    closed.clear(); avoid.clear();
    for (let sy = 0; sy < rows; sy++) {
      for (let sx = 0; sx < cols; sx++) {
        let wall = 0, stuff = 0, wet = 0;
        for (let y = sy * SIZE + 2; y < sy * SIZE + 9; y++) {
          for (let x = sx * SIZE + 2; x < sx * SIZE + 8; x++) {
            const i = y * w.w + x;
            if (Types.isWall(w.ground[i])) wall++;
            else if (w.blocked[i]) stuff++;
            else if (w.water[i] && w.span[i] !== 1 && !w.deck[i] && !w.stones[i]) wet++;
          }
        }
        solid[sy * cols + sx] = wall > 8 || stuff >= 3 || wet > 20 ? 1 : 0;
      }
    }
  }

  const inside = (sx, sy) => sx >= 0 && sy >= 0 && sx < cols && sy < rows;
  // A wall or a solid prop (or off the map), ignoring doors and traps: what blocks a spell's area.
  function isWall(sx, sy) { return !inside(sx, sy) || solid[sy * cols + sx] === 1; }
  function isSolid(sx, sy) { return !inside(sx, sy) || solid[sy * cols + sx] === 1 || closed.has(sy * cols + sx) || avoid.has(sy * cols + sx); }
  // A closed door blocks walking and sight; an avoided square (a trap someone found) only walking.
  function setClosed(sx, sy, on) { if (on) closed.add(key(sx, sy)); else closed.delete(key(sx, sy)); }
  function setAvoid(sx, sy, on) { if (on) avoid.add(key(sx, sy)); else avoid.delete(key(sx, sy)); }
  // The square under a figure's feet, and the feet position for a square.
  function of(f) { return { sx: Math.floor(f.x / SIZE), sy: Math.floor(f.y / SIZE) }; }
  function feet(sx, sy) { return { x: sx * SIZE + 5, y: sy * SIZE + 7 }; }
  const key = (sx, sy) => sy * cols + sx;
  // Squares apart, centre to centre, by Pythagoras (a diagonal step is 1.41 squares, about 7 ft). Times 5 for feet.
  function distance(a, b) { return Math.hypot(a.sx - b.sx, a.sy - b.sy); }
  // Next to each other: one of the 8 squares around (what a 5 ft reach touches).
  function touching(a, b) { return Math.max(Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy)) === 1; }
  function adjacent(a, b) { return touching(of(a), of(b)); }

  // Standing figures and fallen heroes take up their square; the slain don't.
  function occupies(o) { return !o.dead || o.dead.style === 'down'; }

  // Every square a creature can reach with steps squares of movement, and the cheapest way there: a straight step
  // costs 1, a diagonal one √2 (Pythagoras, so 30 ft reaches about as far every way).
  // others: the other figures: allies can be passed through but not stopped on (through), enemies block.
  // Returns Map(key → { sx, sy, cost, prev, through }).
  function reachable(f, steps, others) {
    const start = of(f), seen = new Map([[key(start.sx, start.sy), { ...start, cost: 0, prev: null }]]);
    const occupant = new Map(others.filter(occupies).map(o => { const s = of(o); return [key(s.sx, s.sy), o]; }));
    const open = [seen.get(key(start.sx, start.sy))], done = new Set();
    while (open.length) {
      let i = 0;
      for (let j = 1; j < open.length; j++) if (open[j].cost < open[i].cost) i = j;
      const s = open.splice(i, 1)[0], sk = key(s.sx, s.sy);
      if (done.has(sk)) continue;
      done.add(sk);
      for (const [dx, dy] of DIRS) {
        const nx = s.sx + dx, ny = s.sy + dy, k = key(nx, ny), cost = s.cost + (dx && dy ? Math.SQRT2 : 1);
        if (cost > steps + 1e-9 || isSolid(nx, ny)) continue;
        if (dx && dy && (isSolid(s.sx + dx, s.sy) || isSolid(s.sx, s.sy + dy))) continue;   // no squeezing past corners
        const o = occupant.get(k);
        if (o && o.side !== f.side) continue;                                                  // enemies block
        const had = seen.get(k);
        if (had && had.cost <= cost) continue;
        const n = { sx: nx, sy: ny, cost, prev: sk };
        seen.set(k, n);
        open.push(n);
      }
    }
    for (const [k, v] of seen) if (occupant.has(k) && occupant.get(k) !== f) v.through = true;       // can't stop here
    return seen;
  }

  // The squares from the start to a reached square (the start not included).
  function path(map, sx, sy) {
    const out = [];
    for (let n = map.get(key(sx, sy)); n && n.prev !== null; n = map.get(n.prev)) out.unshift({ sx: n.sx, sy: n.sy });
    return out;
  }

  // True if no wall or closed door stands between two squares' centers. cover: solid props (pillars, crates) in
  // between block it too (hiding behind them).
  function sight(a, b, cover = false) {
    const ax = a.sx * SIZE + 5, ay = a.sy * SIZE + 5, bx = b.sx * SIZE + 5, by = b.sy * SIZE + 5;
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let k = 1; k < n; k++) {
      const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
      const sx = Math.floor(x / SIZE), sy = Math.floor(y / SIZE);
      if (Types.isWall(world.ground[y * world.w + x]) || closed.has(key(sx, sy))) return false;
      if (cover && solid[sy * cols + sx] === 1 && !(sx === a.sx && sy === a.sy) && !(sx === b.sx && sy === b.sy)) return false;
    }
    return true;
  }

  return { SIZE, setWorld, isSolid, isWall, touching, setClosed, setAvoid, of, feet, key, distance, adjacent, occupies, reachable, path, sight, size: () => ({ cols, rows }) };
})();
