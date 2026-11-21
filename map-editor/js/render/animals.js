// Animals that live near where they were placed: they wander, graze, and shy ones run from characters. Drawn into the
// frame in map pixels (facing right in the templates, mirrored when facing left), at the characters' scale: a sheep
// comes to a person's waist, a deer to the shoulder.
const Animals = (() => {
  // Each frame is template rows; the bottom row is the feet, centered on x = 0. lift raises a frame (hops).
  const ART = {
    sheep: {
      colors: { W: [236, 236, 228], w: [196, 196, 188], k: [58, 50, 48] },
      stand: ['   WWWWWW    ', '  WWWWWWWW kk', ' WWWWWWWWWkkk', ' WWWWWWWWWkkk', ' WWWWWWWWWWk ', ' wWWWWWWWWw  ', '  wwwwwwww   ', '  kk    kk   ', '  kk    kk   '],
      walk: [['   WWWWWW    ', '  WWWWWWWW kk', ' WWWWWWWWWkkk', ' WWWWWWWWWkkk', ' WWWWWWWWWWk ', ' wWWWWWWWWw  ', '  wwwwwwww   ', ' kk      kk  ', 'kk        kk '],
        ['   WWWWWW    ', '  WWWWWWWW kk', ' WWWWWWWWWkkk', ' WWWWWWWWWkkk', ' WWWWWWWWWWk ', ' wWWWWWWWWw  ', '  wwwwwwww   ', '   kk  kk    ', '    kkkk     ']],
      graze: ['             ', '   WWWWWW    ', '  WWWWWWWW   ', ' WWWWWWWWWW  ', ' WWWWWWWWWWk ', ' wWWWWWWWWwkk', '  wwwwwwww kk', '  kk    kk kk', '  kk    kk   '],
    },
    deer: {
      colors: { b: [150, 96, 56], B: [196, 150, 104], d: [92, 60, 38], t: [240, 236, 226], k: [40, 30, 26] },
      stand: ['           d   d ', '           dd dd ', '            ddd  ', '            bbb  ', '           bbbbk ', '           bbbbb ', '          bbb    ', '         bbbb    ', ' bbbbbbbbbbbb    ', 'tbbbbbbbbbbbb    ', 'tbbbbbbbbbbbb    ', ' bBBBBBBBBBb     ', ' bb BBBBB bb     ', ' dd       dd     ', ' dd       dd     ', ' dd       dd     '],
      walk: [
        ['           d   d ', '           dd dd ', '            ddd  ', '            bbb  ', '           bbbbk ', '           bbbbb ', '          bbb    ', '         bbbb    ', ' bbbbbbbbbbbb    ', 'tbbbbbbbbbbbb    ', 'tbbbbbbbbbbbb    ', ' bBBBBBBBBBb     ', ' bb BBBBB bb     ', ' dd       dd     ', 'dd         dd    ', 'd           d    '],
        ['           d   d ', '           dd dd ', '            ddd  ', '            bbb  ', '           bbbbk ', '           bbbbb ', '          bbb    ', '         bbbb    ', ' bbbbbbbbbbbb    ', 'tbbbbbbbbbbbb    ', 'tbbbbbbbbbbbb    ', ' bBBBBBBBBBb     ', ' bb BBBBB bb     ', '  dd     dd      ', '   dd   dd       ', '   d     d       '],
      ],
      graze: ['                 ', '                 ', '                 ', '                 ', '                 ', '                 ', '                 ', '                 ', ' bbbbbbbbbbbb    ', 'tbbbbbbbbbbbbb   ', 'tbbbbbbbbbbbbbb  ', ' bBBBBBBBBBb bbb ', ' bb BBBBB bb  bbb', ' dd       dd  bbk', ' dd       dd     ', ' dd       dd     '],
    },
    rabbit: {
      colors: { b: [150, 128, 104], e: [176, 150, 124], t: [242, 240, 236], k: [50, 40, 36] },
      stand: ['     e  ', '     ee ', '     ee ', '    bbbk', '  bbbbbb', ' bbbbbb ', 'tbbbbbb ', ' bb  bb '],
      walk: [{ rows: ['     e  ', '     ee ', '     ee ', '    bbbk', '  bbbbbb', ' bbbbbb ', 'tbbbbbb ', 'b      b'], lift: 2 }, ['     e  ', '     ee ', '     ee ', '    bbbk', '  bbbbbb', ' bbbbbb ', 'tbbbbbb ', '  bbbb  ']],
    },
    chicken: {
      colors: { w: [244, 240, 230], r: [214, 58, 46], o: [236, 160, 50], y: [220, 150, 40] },
      stand: ['    rr ', '    wwo', '    ww ', 'w  www ', 'wwwwww ', ' wwwww ', '  www  ', '  y y  '],
      walk: [['    rr ', '    wwo', '    ww ', 'w  www ', 'wwwwww ', ' wwwww ', '  www  ', ' y   y '], ['    rr ', '    wwo', '    ww ', 'w  www ', 'wwwwww ', ' wwwww ', '  www  ', '   yy  ']],
      graze: ['       ', '       ', 'w      ', 'wwwww  ', ' wwwwwr', '  wwwwo', '  www  ', '  y y  '],
    },
    duck: {
      colors: { g: [40, 110, 60], o: [236, 160, 50], b: [140, 110, 80], B: [110, 86, 62], w: [236, 232, 220] },
      stand: ['      gg  ', '      ggoo', '      ww  ', 'bbbbbbbb  ', 'bBbbbbbb  ', ' BBBBBB   '],
      walk: [['      gg  ', '      ggoo', '      ww  ', 'bbbbbbbb  ', 'bBbbbbbb  ', ' BBBBBB   '], ['      gg  ', '      ggoo', 'b     ww  ', 'bbbbbbbb  ', 'bBbbbbbb  ', ' BBBBBB   ']],
      graze: ['          ', 'b         ', 'bb        ', 'bbbbbbbb  ', 'bBbbbbbbg ', ' BBBBBB go'],
    },
  };
  // speed (pixels/second), roam (how far from home), shy (runs from characters this close), water (swims).
  const TYPES = {
    sheep: { name: 'Sheep', speed: 5, roam: 26, shy: 0, color: '#ecece4' },
    deer: { name: 'Deer', speed: 11, roam: 44, shy: 36, color: '#966038' },
    rabbit: { name: 'Rabbit', speed: 18, roam: 22, shy: 24, color: '#968068' },
    chicken: { name: 'Chicken', speed: 6, roam: 16, shy: 14, color: '#f4f0e6' },
    duck: { name: 'Duck', speed: 5, roam: 28, shy: 16, water: true, color: '#286e3c' },
  };
  const SHADOW = 0.75;
  const animals = new Map();
  let lastTime = 0;

  function has(type) { return !!TYPES[type]; }
  function isAquatic(type) { return !!(TYPES[type] && TYPES[type].water); }

  // Registers the animals as stampable objects.
  function register() {
    for (const [type, t] of Object.entries(TYPES)) Types.addObject('Animals', type, t.name, t.color);
  }

  // Template rows → pixels ({ x, y, c }) for one frame.
  function pixels(type, frame) {
    const art = ART[type], rows = frame.rows || frame, lift = frame.lift || 0;
    const half = Math.floor(rows[0].length / 2), base = rows.length - 1, out = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (art.colors[ch]) out.push({ x: x - half, y: y - base - lift, c: art.colors[ch] });
    }));
    return out;
  }

  const ghosts = new Map();

  // Standing sprite in the format of Sprites.get, for the stamp ghost, drag ghost, and selection box.
  function ghost(type) {
    if (ghosts.has(type)) return ghosts.get(type);
    const px = pixels(type, ART[type].stand).map(p => ({ ...p, w: 0 }));
    const xs = px.map(p => p.x), ys = px.map(p => p.y);
    const g = { px, shadowR: 0, box: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: 0 }, hit: new Set(px.map(p => p.x + ',' + p.y)) };
    ghosts.set(type, g);
    return g;
  }

  // Matches animals to the animal objects on the map. A moved object restarts its animal there.
  function sync(map) {
    const seen = new Set();
    for (const o of map.objects) {
      if (!TYPES[o.type]) continue;
      seen.add(o.id);
      const a = animals.get(o.id);
      if (a && a.homeX === o.x && a.homeY === o.y && a.type === o.type && a.still === !!o.still) continue;
      const rng = Random.makeRng(o.seed);
      animals.set(o.id, { id: o.id, type: o.type, homeX: o.x, homeY: o.y, x: o.x + 0.5, y: o.y + 0.5, dir: rng() < 0.5 ? -1 : 1,
        target: null, wait: rng() * 3, graze: false, walkT: 0, rng, still: !!o.still });
    }
    for (const id of animals.keys()) if (!seen.has(id)) animals.delete(id);
  }

  // True if this animal can stand at (x, y): water for ducks; for the rest, open dry ground.
  function canStand(world, type, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 1 || yi < 1 || xi >= world.w - 1 || yi >= world.h - 1) return false;
    const i = yi * world.w + xi;
    if (isAquatic(type)) return !!world.water[i] && !world.span[i] && world.waterDist[i] >= 1;
    return Actors.walkable(world, x, y) && !world.water[i];
  }

  // Moves every animal. Called once per drawn frame with the animation time.
  function update(world, map, time) {
    sync(map);
    const dt = Math.max(0, Math.min(0.5, time - lastTime));
    lastTime = time;
    for (const a of animals.values()) step(world, a, dt);
  }

  // Runs from a nearby character, walks to its target, or waits (grazing now and then) and picks a new one.
  // One placed to stand still (still: 1 on its object) only grazes.
  function step(world, a, dt) {
    const t = TYPES[a.type];
    if (a.still) { if (ART[a.type].graze && a.rng() < dt * 0.5) a.graze = !a.graze; return; }
    const threat = t.shy && nearestActor(a, t.shy);
    if (threat && !a.fleeing) {
      const d = Math.hypot(a.x - threat.x, a.y - threat.y) || 1;
      a.target = [a.x + (a.x - threat.x) / d * 22, a.y + (a.y - threat.y) / d * 16];
      a.fleeing = true;
      a.graze = false;
    }
    if (!a.target) {
      a.wait -= dt;
      if (a.wait <= 0) pickTarget(world, a, t);
      else if (ART[a.type].graze && a.rng() < dt * 0.5) a.graze = !a.graze;
      return;
    }
    const dx = a.target[0] - a.x, dy = a.target[1] - a.y, dist = Math.hypot(dx, dy);
    const len = Math.min(dist, t.speed * (a.fleeing ? 2.5 : 1) * dt);
    if (dx) a.dir = dx > 0 ? 1 : -1;
    const nx = a.x + dx / (dist || 1) * len, ny = a.y + dy / (dist || 1) * len;
    const from = Math.floor(a.y) * world.w + Math.floor(a.x), to = Math.floor(ny) * world.w + Math.floor(nx);
    if (dist < 0.5 || !canStand(world, a.type, nx, ny) || !Height.canStep(world, from, to)) { rest(a); return; }
    a.x = nx; a.y = ny;
    a.walkT += dt;
  }

  // Stops and waits a few seconds.
  function rest(a) {
    a.target = null;
    a.fleeing = false;
    a.wait = 1 + a.rng() * 4;
    a.graze = !!ART[a.type].graze && a.rng() < 0.6;
  }

  // A random spot within the animal's range of home that it can stand on.
  function pickTarget(world, a, t) {
    for (let k = 0; k < 8; k++) {
      const ang = a.rng() * Math.PI * 2, r = a.rng() * t.roam;
      const x = a.homeX + 0.5 + Math.cos(ang) * r, y = a.homeY + 0.5 + Math.sin(ang) * r * 0.7;
      if (canStand(world, a.type, x, y)) { a.target = [x, y]; a.graze = false; return; }
    }
    a.wait = 1;
  }

  // The closest character within r pixels, or null.
  function nearestActor(a, r) {
    let best = null, bestD = r;
    for (const c of Actors.list()) {
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // Current frame: walking (two steps), grazing, or standing.
  function frameOf(a) {
    const art = ART[a.type];
    if (a.target) return art.walk[Math.floor(a.walkT * (a.type === 'rabbit' ? 5 : 6)) % art.walk.length];
    return a.graze && art.graze ? art.graze : art.stand;
  }

  // Draws every animal back to front on flat maps, then redraws anything standing in front of it.
  function draw(frame, world, s, pal, time) {
    if (!animals.size) return;
    const put = Details.makePut(frame, world);
    for (const a of [...animals.values()].sort((p, q) => p.y - q.y)) {
      drawAnimal(frame, world, pal, time, a, put, 0);
      for (const t of world.things) {
        if (!covers(t, a) || (t.sprite && t.sprite.flat)) continue;
        Details.drawThing(put, t, s, pal, time);
      }
    }
  }

  // True if a thing stands in front of an animal (or a character) at a and is tall and wide enough to cover it: it must
  // be drawn again over it. Buildings and trees reach a long way up, grass only a little.
  function covers(t, a, up = 30, half = 24) {
    const b = t.sprite && t.sprite.box;
    if (b) { up = Math.max(up, 4 - b.minY); half = Math.max(half, Math.max(-b.minX, b.maxX) + 10); }
    return t.y > a.y && t.y <= a.y + up && Math.abs(t.x - a.x) <= half;
  }

  // One animal with a soft shadow (or a ripple on water), drawn dy pixels up (raised ground).
  function drawAnimal(frame, world, pal, time, a, put, dy) {
    const ax = Math.floor(a.x), ay = Math.floor(a.y), px = pixels(a.type, frameOf(a));
    if (isAquatic(a.type)) {
      if (a.target && Math.floor(time * 2 + a.id) % 3 === 0) Water.ripple(frame, world, ax, ay + 1 - dy, 3, 0.35, pal.foam);
    } else {
      const half = Math.max(...px.map(p => Math.abs(p.x))), y = ay + 1 - dy;
      for (let x = ax - half + 1; x <= ax + half - 1; x++) {
        if (x < 0 || y < 0 || x >= world.w || y >= world.h || world.water[(ay + 1) * world.w + x]) continue;
        const i = (y * world.w + x) * 4;
        frame[i] *= SHADOW; frame[i + 1] *= SHADOW; frame[i + 2] *= SHADOW;
      }
    }
    for (const p of px) put(ax + p.x * a.dir, ay + p.y, p.c);
  }

  function list() { return [...animals.values()]; }
  function get(id) { return animals.get(id); }

  // Animal id under a map point (inside its standing box), front-most first.
  function hit(x, y) {
    for (const a of list().sort((p, q) => q.y - p.y)) {
      const b = ghost(a.type).box;
      const lx = (Math.floor(x) - Math.floor(a.x)) * a.dir, ly = Math.floor(y) - Math.floor(a.y);
      if (lx >= b.minX && lx <= b.maxX && ly >= b.minY - 1 && ly <= 1) return a.id;
    }
    return null;
  }

  // Makes the map object's spot match where its animal is now, so a drag starts from there.
  function pin(map, id) {
    const a = animals.get(id), o = map.objects.find(ob => ob.id === id);
    if (!a || !o) return;
    o.x = a.homeX = Math.floor(a.x);
    o.y = a.homeY = Math.floor(a.y);
  }

  register();

  // Every template frame of a type (stand, walk steps, graze), for the GL sprite atlas.
  function frames(type) {
    const art = ART[type];
    return [art.stand, ...(art.walk || []), ...(art.graze ? [art.graze] : [])];
  }

  return { has, isAquatic, ghost, update, draw, drawAnimal, covers, list, get, hit, pin, pixels, frameOf, frames, types: () => Object.keys(TYPES) };
})();
