// More random landscapes for the New map dialog: a castle, a swamp, a harbor town, and a graveyard with ruins.
// Built from Generate's kit, so each is an ordinary map you keep painting, and the same seed makes the same map.
(() => {
  const { GROUND, WATER, SCATTER } = Types;
  const { LOTS, lotsFor, place, field, quantile, forEach, landEach, dropSmall, densify, line, lots, later, many, person, monster,
    animal, hero, spread, wildAnimals, wildMonsters, pick, seedFrom } = Generate.kit;

  // ---------- Castle ----------

  // A walled courtyard: stone walls, a round tower on each corner (more along long walls), a gatehouse where the
  // road comes in, the keep at the back, a smithy and barracks along the walls, a training yard, a well, banners
  // and torches, all in one coat of arms. A moat round it on bigger maps (the road crosses it on planks), fields
  // and woods outside, and houses along the road on the biggest maps.
  function castle(g) {
    const { map, w, h, n, size, rng } = g;
    const wet = field(g, size * 0.3, 4001), wood = field(g, size * 0.2, 4002), spots = field(g, size * 0.07, 4003);
    const dry = quantile(wet, 0.15);
    for (let i = 0; i < n; i++) map.ground[i] = wet[i] < dry ? GROUND.DIRT : GROUND.GRASS;

    const T = 7, hg = Structures.GATE >> 1, arms = Math.floor(rng() * Structures.ARMS.length);
    const cw = clamp(Math.round(w * 0.55), 48, Math.min(200, w - 24)), ch = clamp(Math.round(h * 0.5), 52, Math.min(150, h - 36));
    const x0 = (w - cw) >> 1, x1 = x0 + cw - 1, y0 = Math.max(12, Math.round((h - ch) * 0.4)), y1 = Math.min(h - 6, y0 + ch - 1);
    const gx = (x0 + x1) >> 1, mo = 7, mw = 7;
    const moat = rng() < 0.7 && x0 - mo - mw > 3 && y0 - mo - mw > 3 && y1 + mo + mw < h - 10;
    const out = new Float32Array(n);   // how far outside the walls
    const inner = (x, y) => x >= x0 + T && x <= x1 - T && y >= y0 + T && y <= y1 - T;
    const gap = (x, y) => y > y1 - T && Math.abs(x - gx) <= hg;
    forEach(g, (i, x, y) => {
      out[i] = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
      if (moat && out[i] >= mo && out[i] < mo + mw) map.water[i] = WATER.LAKE;
      if (out[i] > 0) return;
      map.scatter[i] = SCATTER.NONE;
      map.ground[i] = !inner(x, y) && !gap(x, y) ? GROUND.STONE_WALL : Random.noise(x, y, 12, 4004) < 0.74 ? GROUND.GRAVEL : GROUND.DIRT;
    });

    // The road: in through the gate (on planks over the moat) and away to the edge; a cobbled way up to the keep.
    const keepY = y0 + T + 34 + (ch > 110 ? 8 : 0);          // the keep stands well into the yard: it is tall, and rises behind the back wall
    const beyond = Math.min(h - 2, y1 + (moat ? mo + mw + 8 : 10));
    const way = [[gx, y1 - T], [gx, beyond], [clamp(gx + Math.round((rng() - 0.5) * w * 0.3), 8, w - 9), h - 1]];
    const roads = new Uint8Array(n);
    paint(g, way, 7, i => { if (map.ground[i] !== GROUND.STONE_WALL) { map.ground[i] = GROUND.COBBLE; map.water[i] = WATER.NONE; roads[i] = 1; } });
    paint(g, [[gx, y1 - T], [gx, keepY + 2]], 5, i => { map.ground[i] = GROUND.COBBLE; roads[i] = 1; });
    paint(g, way.slice(1), 14, i => { if (out[i] > 0) map.scatter[i] = SCATTER.NONE; });

    // Walls, towers, gatehouse and keep, sharing the coat of arms.
    const crest = () => { let s = seedFrom(rng); for (let k = 0; k < 400 && Structures.heraldryOf(s) !== arms; k++) s = seedFrom(rng); return s; };
    // A small castle's towers, gatehouse and keep are built smaller (the keep also when it would rise off the map).
    const fit = clamp(cw / 150, 0.65, 1), sized = (scale, seed) => scale < 1 ? { seed, scale } : { seed };
    const towers = [[x0 + 3, y0 + T - 1], [x1 - 3, y0 + T - 1], [x0 + 3, y1], [x1 - 3, y1]];
    if (ch > 110) towers.push([x0 + 3, (y0 + y1) >> 1], [x1 - 3, (y0 + y1) >> 1]);
    if (cw > 160) towers.push([x0 + (cw >> 2), y0 + T - 1], [x1 - (cw >> 2), y0 + T - 1]);
    towers.forEach(([x, y]) => place(g, 'walltower', x, y, sized(fit, crest())));
    place(g, 'gatehouse', gx, y1, sized(fit, crest()));
    const keepSize = clamp(Math.min(fit, (keepY - 3) / 104), 0.6, 1), keepHalf = Math.round(40 * keepSize);
    place(g, 'keep', gx, keepY, sized(keepSize, crest()));

    // The courtyard: buildings along the walls, then the well, a training yard, banners up the way, braziers and
    // torches. Ground outside the courtyard counts as taken.
    const yard = lots(g, roads, Uint8Array.from(out, (d, i) => d > 0 || !inner(i % w, (i / w) | 0) ? 1 : 0), []);
    yard.take(gx - keepHalf - 2, keepY - 32, gx + keepHalf + 2, keepY + 6);
    const built = [];
    const build = type => {
      const left = rng() < 0.5;
      for (const [half, tall, scale] of lotsFor(type)) {              // full size if the yard has room, smaller if not
        const spotsAt = [];
        for (let y = y1 - T - 8; y >= y0 + T + 14; y -= 3) spotsAt.push(...(left ? [[x0 + T + half + 3, y], [x1 - T - half - 3, y]] : [[x1 - T - half - 3, y], [x0 + T + half + 3, y]]));
        for (const [x, y] of spotsAt) {
          if (y - tall < y0 + T || !yard.free(x - half, y - tall, x + half, y + 3)) continue;
          yard.take(x - half - 2, y - tall - 2, x + half + 2, y + 5);
          place(g, type, x, y, scale < 1 ? { scale } : undefined);
          built.push([type, x, y]);
          return;
        }
      }
    };
    ['smithy', 'house', 'house', ...(cw * ch > 16000 ? ['temple', 'house'] : [])].forEach(build);
    const spot = (bw, bh, tries = 300) => {
      for (let k = 0; k < tries; k++) {
        const x = Math.round(x0 + T + 4 + bw / 2 + rng() * (cw - 2 * T - 8 - bw)), y = Math.round(keepY + 8 + bh + rng() * (y1 - T - keepY - 12 - bh));
        if (yard.free(x - (bw >> 1), y - bh, x + (bw >> 1), y + 2)) { yard.take(x - (bw >> 1) - 2, y - bh - 2, x + (bw >> 1) + 2, y + 4); return [x, y]; }
      }
      return null;
    };
    const well = spot(22, 26);
    if (well) place(g, 'well', well[0], well[1]);
    const drill = spot(44, 32);
    if (drill) {
      place(g, 'weaponrack', drill[0] - 11, drill[1] - 14); place(g, 'weaponrack', drill[0] + 11, drill[1] - 14);
      for (let k = 0, c = 2 + Math.floor(rng() * 2); k < c; k++) place(g, 'haybale', drill[0] - 14 + k * 14, drill[1]);
    }
    for (let k = 0; k < 4; k++) { const s = spot(11, 8, 60); if (s) place(g, pick(rng, ['barrel', 'crate', 'sacks', 'barrel']), s[0], s[1]); }
    for (let y = keepY + 22, k = 0; y <= y1 - T - 14 && k < 3; y += 34, k++) for (const s of [-1, 1]) if (yard.free(gx + s * 9 - 1, y - 2, gx + s * 9 + 1, y)) place(g, 'banner', gx + s * 9, y, { seed: crest() });
    for (const s of [-1, 1]) place(g, 'brazier', gx + s * 13, keepY + 5);
    for (let y = y1 - T - 10; y > y0 + T + 14; y -= 30) for (const x of [x0 + T + 2, x1 - T - 2]) if (yard.free(x - 1, y - 2, x + 1, y)) { yard.take(x - 2, y - 3, x + 2, y + 1); place(g, 'torch', x, y); }

    // Houses along the road outside, on the biggest maps.
    const town = n >= 100000 ? lots(g, roads, Uint8Array.from(out, d => d < (moat ? mo + mw + 6 : 10) ? 1 : 0), [way.slice(1)]).houses(Math.round(n / 14000)) : [];

    // Woods, bushes and flowers out in the fields.
    const clear = Grid.distanceField(w, h, Uint8Array.from(roads, (v, i) => v || map.water[i] ? 1 : 0));
    const forest = quantile(wood, 0.72), edge = quantile(wood, 0.66), bloom = quantile(spots, 0.1);
    for (let i = 0; i < n; i++) {
      if (map.water[i] || out[i] < (moat ? mo + mw + 6 : 12) || clear[i] < 5 || town.some(([x, y]) => Math.abs(i % w - x) < 22 && Math.abs(((i / w) | 0) - y + 14) < 22)) continue;
      map.scatter[i] = wood[i] > forest && out[i] > 30 ? SCATTER.FOREST : wood[i] > edge ? SCATTER.BUSHES : map.ground[i] === GROUND.GRASS && spots[i] < bloom ? SCATTER.FLOWERS : SCATTER.NONE;
    }

    // Life: guards at the gate and walking the walls, the right person at each building, the lord at the keep door,
    // folk in the courtyard and by the houses; chickens in the yard, ducks on the moat, deer and sheep outside;
    // monsters out in the wilds; the hero on the road outside the gate.
    const R = g.lrng, toWater = Grid.distanceField(w, h, map.water);
    later(g, 'people', () => {
      for (const s of [-1, 1]) person(g, gx + s * (hg + 5), y1 + 4, 'guard', { still: 1 });
      for (let k = many(g, 'people', 2 + cw / 60); k > 0; k--) {
        const x = x0 + T + 4 + R() * (cw - 2 * T - 8), y = y0 + T + 16 + R() * (ch - 2 * T - 22);
        const [px, py] = R() < 0.5 ? [x, y1 - T - 3] : [R() < 0.5 ? x0 + T + 3 : x1 - T - 3, y];
        person(g, px, py, 'guard', { patrol: 1 });
      }
      built.forEach(([type, x, y]) => person(g, x + (R() - 0.5) * 10, y + 5, type === 'smithy' ? 'smith' : type === 'temple' ? 'monk' : R() < 0.5 ? 'guard' : 'folk'));
      person(g, gx + 5, keepY + 6, 'elder');
      for (let k = many(g, 'people', 3); k > 0; k--) person(g, gx + (R() - 0.5) * cw * 0.5, (keepY + y1) / 2 + (R() - 0.5) * 14);
      town.forEach(([x, y]) => { for (let k = many(g, 'people', 0.6); k > 0; k--) person(g, x + (R() - 0.5) * 16, y + 5); });
    });
    later(g, 'animals', () => {
      for (let k = many(g, 'animals', 3); k > 0; k--) animal(g, 'chicken', gx + (R() - 0.5) * cw * 0.6, (keepY + y1) / 2 + (R() - 0.5) * 16);
      wildAnimals(g, toWater, null, ([x, y]) => out[y * w + x] > 20);
    });
    later(g, 'monsters', () => wildMonsters(g, toWater, ([x, y]) => out[y * w + x] > 45));
    later(g, 'hero', () => hero(g, gx, beyond - 2));
  }

  // ---------- Swamp ----------

  // Murky pools everywhere, muddy banks with reeds and lily pads, thickets and dead trees, a boardwalk across on
  // planks, and a witch's hut on stilts at the water's edge with her cauldron outside. Fog and fireflies.
  function swamp(g) {
    const { map, w, h, n, size, rng } = g;
    const height = field(g, size * 0.16, 4101), damp = field(g, size * 0.3, 4102), wood = field(g, size * 0.14, 4103), spots = field(g, size * 0.06, 4104);
    const low = quantile(height, 0.34), pools = dropSmall(g, Grid.maskWhere(height, v => v < low), 40);
    let toWater = Grid.distanceField(w, h, pools);
    const muddy = quantile(damp, 0.4);
    for (let i = 0; i < n; i++) {
      if (pools[i]) { map.water[i] = WATER.LAKE; continue; }
      map.ground[i] = toWater[i] < 3 + spots[i] * 4 || (damp[i] < muddy && spots[i] > 0.55) ? GROUND.DIRT : GROUND.GRASS;
    }
    const thicket = quantile(wood, 0.72), scrub = quantile(wood, 0.56), bloom = quantile(spots, 0.04);
    landEach(g, i => wood[i] > thicket && toWater[i] > 4 ? SCATTER.FOREST : wood[i] > scrub ? SCATTER.BUSHES : spots[i] < bloom ? SCATTER.FLOWERS : SCATTER.NONE);

    // The boardwalk: planks across the map, over the pools.
    const walk = line(g, rng() < 0.5, 4105);
    const planks = (pts, width) => {
      paint(g, pts, width + 8, i => { map.scatter[i] = SCATTER.NONE; });
      return paint(g, pts, width, i => { map.ground[i] = GROUND.WOOD_FLOOR; map.water[i] = WATER.NONE; });
    };
    const fromWalk = Grid.distanceField(w, h, planks(walk, 4));
    toWater = Grid.distanceField(w, h, map.water);

    // The witch's hut on a bank near the boardwalk, with dry ground in front for the cauldron.
    const bank = (x, y, far) => {
      const i = y * w + x;
      if (x < 22 || x > w - 23 || y < 32 || y > h - 16 || map.water[i] || toWater[i] < 1 || toWater[i] > 4 || fromWalk[i] < 16 || fromWalk[i] > far) return false;
      for (const [dx, dy] of [[0, 7], [-6, 8], [6, 8], [0, 3]]) if (map.water[(y + dy) * w + x + dx]) return false;
      return true;
    };
    let hut = null;
    for (let k = 0; k < 4000 && !hut; k++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h);
      if (bank(x, y, k < 2500 ? 50 : 200)) hut = [x, y];
    }
    if (hut) {
      const [hx, hy] = hut;
      forEach(g, (i, x, y) => { if (Math.hypot(x - hx, (y - hy - 2) * 1.3) < 30) map.scatter[i] = SCATTER.NONE; });
      place(g, 'stilthut', hx, hy);
      place(g, 'cauldron', hx, hy + 9);
      place(g, 'candles', hx - 13, hy + 10);
      if (rng() < 0.5) place(g, 'mushrooms', hx + 14, hy + 11);
      if (rng() < 0.35) place(g, 'ring', hx + (rng() < 0.5 ? -14 : 14), hy + 14);
      // A plank path from the hut to the boardwalk.
      const near = densify(walk).reduce((a, p) => Math.hypot(p[0] - hx, p[1] - hy) < Math.hypot(a[0] - hx, a[1] - hy) ? p : a);
      planks([[hx, hy + 13], near.map(Math.round)], 3);
    }
    toWater = Grid.distanceField(w, h, map.water);

    // Dead trees on the banks and standing in the shallows; logs, stumps, toadstools.
    const toLand = Grid.distanceField(w, h, Uint8Array.from(map.water, v => v ? 0 : 1));
    const clearOfHut = (x, y) => !hut || Math.hypot(x - hut[0], y - hut[1]) > 22;
    for (let k = 0, made = 0; made < n / 2600 && k < 4000; k++) {
      const x = 4 + Math.floor(rng() * (w - 8)), y = 12 + Math.floor(rng() * (h - 16)), i = y * w + x;
      if (Types.isPath(map.ground[i]) || fromWalk[i] < 5 || !clearOfHut(x, y) || (map.water[i] && toLand[i] > 2)) continue;
      place(g, map.water[i] || rng() < 0.75 ? 'deadtree' : pick(rng, ['log', 'stump', 'mushrooms', 'rock']), x, y);
      made++;
    }

    // Life: the witch at her hut, a traveler or two on the boardwalk; slimes by the water, cultists near the hut,
    // a few more monsters about; ducks, deer and rabbits; the hero at one end of the boardwalk.
    const R = g.lrng, along = densify(walk);
    const dry = ([x, y]) => !Types.isPath(map.ground[y * w + x]) && clearOfHut(x, y);
    later(g, 'people', () => {
      if (hut) person(g, hut[0] + 4, hut[1] + 11, 'elder');
      for (let k = many(g, 'people', 1.5); k > 0; k--) person(g, ...along[Math.floor(along.length * (0.2 + R() * 0.6))]);
    });
    later(g, 'monsters', () => {
      spread(g, many(g, 'monsters', Math.max(2, n / 14000)), (x, y) => !map.water[y * w + x] && toWater[y * w + x] < 8 && dry([x, y]), (x, y) => monster(g, ['slime'], x, y));
      if (hut) for (let k = many(g, 'monsters', 1.5); k > 0; k--) { const a = R() * Math.PI * 2; monster(g, ['cultist'], hut[0] + Math.cos(a) * 24, hut[1] + 12 + Math.sin(a) * 10); }
      wildMonsters(g, toWater, dry);
    });
    later(g, 'animals', () => wildAnimals(g, toWater, null, dry, true));
    later(g, 'hero', () => hero(g, ...along[3]));
  }

  // ---------- Harbor town ----------

  // The sea along the bottom of the map, a beach, a stone quay with wooden piers out into the water and boats
  // moored at them (more out at sea), a lighthouse on the headland, and the town up from the shore: a street
  // along the coast, lanes inland, houses, a tavern by the quay, crates and barrels everywhere. Gulls overhead.
  function harbor(g) {
    const { map, w, h, n, size, rng } = g;
    const wet = field(g, size * 0.3, 4201), wood = field(g, size * 0.2, 4202), spots = field(g, size * 0.07, 4203);
    const side = rng() < 0.5 ? -1 : 1;
    const hx = Math.round(side > 0 ? w * 0.85 : w * 0.15);
    const qx0 = Math.round(side > 0 ? w * 0.2 : w * 0.36), qx1 = Math.round(side > 0 ? w * 0.64 : w * 0.8);
    const base = h * (0.6 + rng() * 0.06), qy = Math.round(base - 2);
    const coast = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      const raw = base + (Random.noise1D(x, w * 0.5, 4204) - 0.5) * size * 0.14 + Math.exp(-Math.pow((x - hx) / (w * 0.07), 2)) * size * 0.2;
      const t = clamp(Math.min(x - (qx0 - 14), qx1 + 14 - x) / 14, 0, 1);
      coast[x] = Math.min(h - 6, raw * (1 - t) + qy * t);
    }
    const dry = quantile(wet, 0.15);
    forEach(g, (i, x, y) => {
      if (y > coast[x]) { map.water[i] = WATER.SEA; return; }
      map.ground[i] = y > coast[x] - 4 - spots[i] * 6 ? GROUND.SAND : wet[i] < dry ? GROUND.DIRT : GROUND.GRASS;
    });

    // The quay, and piers out from it (the planks go over the water).
    const shore = new Uint8Array(n);
    for (let y = qy - 9; y <= qy; y++) for (let x = qx0; x <= qx1; x++) { map.ground[y * w + x] = GROUND.COBBLE; shore[y * w + x] = 1; }
    const piers = [], count = Math.max(1, Math.min(4, Math.round((qx1 - qx0) / 55) + (rng() < 0.4 ? 1 : 0)));
    for (let k = 0; k < count; k++) {
      const px = Math.round(qx0 + (k + 0.5) * (qx1 - qx0) / count + (rng() - 0.5) * 8), len = Math.round(Math.min(h - qy - 8, 22 + rng() * 22));
      if (len < 10) continue;
      for (let y = qy + 1; y <= qy + len; y++) {
        const half = y > qy + len - 4 && len > 18 ? 5 : 2;
        for (let x = px - half; x <= px + half; x++) { const i = y * w + x; map.water[i] = WATER.NONE; map.ground[i] = GROUND.WOOD_FLOOR; shore[i] = 1; }
      }
      piers.push([px, qy + len]);
    }

    // The lighthouse on the headland's tip, among rocks.
    let tx = hx;
    for (let x = Math.round(hx - w * 0.05); x <= hx + w * 0.05; x++) if (x >= 0 && x < w && coast[x] > coast[tx]) tx = x;
    const light = [tx, Math.round(coast[tx]) - 8];
    forEach(g, (i, x, y) => {
      const d = Math.hypot(x - light[0], (y - light[1]) * 1.3);
      if (d < 30 && !map.water[i]) { shore[i] = 1; map.scatter[i] = d > 16 && d < 26 && Random.noise(x, y, 5, 4205) > 0.5 ? SCATTER.ROCKY : SCATTER.NONE; }
    });
    place(g, 'lighthouse', light[0], light[1]);

    // The street along the coast, and lanes inland.
    const roads = new Uint8Array(n);
    const street = [];
    for (let k = 0; k <= 8; k++) { const x = Math.round(k / 8 * (w - 1)); street.push([x, clamp(Math.round(Math.min(coast[x], qy) - 13), 8, h - 8)]); }
    paint(g, street, 7, i => { if (!map.water[i]) { map.ground[i] = GROUND.COBBLE; roads[i] = 1; } });
    const lanes = [];
    for (let k = 0, c = 1 + Math.floor(rng() * 2); k < c; k++) {
      const [sx, sy] = street[2 + Math.floor(rng() * 5)], ex = clamp(sx + Math.round((rng() - 0.5) * w * 0.3), 4, w - 5);
      const lane = [[sx, sy], [Math.round((sx + ex) / 2 + (rng() - 0.5) * 30), Math.round(sy / 2)], [ex, 0]];
      paint(g, lane, 5, i => { map.ground[i] = GROUND.PATH; roads[i] = 1; });
      lanes.push(lane);
    }
    const keepOff = Uint8Array.from(map.water, (v, i) => v || shore[i] || map.ground[i] === GROUND.SAND ? 1 : 0);
    const town = lots(g, roads, keepOff, [street, ...lanes]);
    const qc = [(qx0 + qx1) >> 1, qy - 13];
    const byDistance = d => town.spots.slice().sort((a, b) => Math.abs(Math.hypot(a[0] - qc[0], a[1] - qc[1]) - d) - Math.abs(Math.hypot(b[0] - qc[0], b[1] - qc[1]) - d));
    const tavern = town.site('tavern', byDistance(0));
    const smithy = rng() < 0.5 ? town.site('smithy', byDistance(50 + rng() * 40)) : null;
    const temple = n > 60000 && rng() < 0.6 ? town.site('temple', byDistance(70 + rng() * 50)) : null;
    const houses = town.houses(Math.round(n / 2600));

    // On the quay: stacks of crates, barrels and sacks, lanterns along the edge, clear of the piers' ends.
    const byPier = x => piers.some(([px]) => Math.abs(x - px) < 7);
    for (let k = 0, c = Math.round((qx1 - qx0) / 18); k < c; k++) {
      const x = Math.round(qx0 + 6 + rng() * (qx1 - qx0 - 12));
      if (!byPier(x)) place(g, pick(rng, ['crate', 'barrel', 'barrel', 'sacks', 'crate']), x, qy - 2 - Math.floor(rng() * 5));
    }
    for (let x = qx0 + 10; x < qx1 - 6; x += 32) if (!byPier(x)) place(g, 'lantern', x, qy - 1);

    // Boats: moored beside the piers, and a few out at sea.
    const toLand = Grid.distanceField(w, h, Uint8Array.from(map.water, v => v ? 0 : 1));
    const sea = (x, y) => x > 8 && x < w - 9 && y < h - 3 && map.water[y * w + x] && toLand[y * w + x] >= 3;
    piers.forEach(([px, end]) => {
      for (let k = 0, c = 1 + Math.floor(rng() * 2); k < c; k++) {
        const x = px + (rng() < 0.5 ? -1 : 1) * (24 + Math.floor(rng() * 5)), y = qy + 8 + Math.floor(rng() * Math.max(1, end - qy - 10));
        if (sea(x, y)) place(g, 'boat', x, y);
      }
    });
    for (let k = 0, made = 0; made < 1 + n / 50000 && k < 400; k++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h);
      if (sea(x, y) && toLand[y * w + x] > 10) { place(g, 'boat', x, y); made++; }
    }

    // Woods and flowers inland, away from the town.
    const near = Grid.distanceField(w, h, Uint8Array.from(roads, (v, i) => v || town.taken[i] || keepOff[i] ? 1 : 0));
    const forest = quantile(wood, 0.72), edge = quantile(wood, 0.66), bloom = quantile(spots, 0.1);
    for (let i = 0; i < n; i++) {
      if (keepOff[i] || near[i] < 4) continue;
      map.scatter[i] = wood[i] > forest && near[i] > 24 ? SCATTER.FOREST : wood[i] > edge && near[i] > 8 ? SCATTER.BUSHES : map.ground[i] === GROUND.GRASS && spots[i] < bloom ? SCATTER.FLOWERS : SCATTER.NONE;
    }

    // Life: folk and merchants on the quay, fishermen on the piers, people at the tavern and by their houses, the
    // keeper at the lighthouse; chickens by the houses, deer and rabbits inland; monsters well away from the town;
    // the hero on the quay.
    const R = g.lrng, toWater = Grid.distanceField(w, h, map.water);
    const away = ([x, y]) => near[y * w + x] > 40 && !keepOff[y * w + x];
    later(g, 'people', () => {
      for (let k = many(g, 'people', 4); k > 0; k--) person(g, qx0 + 6 + R() * (qx1 - qx0 - 12), qy - 5 + R() * 3, R() < 0.4 ? 'merchant' : 'folk');
      piers.forEach(([px, end]) => { for (let k = many(g, 'people', 0.8); k > 0; k--) person(g, px, end - 2 - R() * 8, 'farmer'); });
      if (tavern) for (let k = many(g, 'people', 2); k > 0; k--) person(g, tavern[0] + (R() - 0.5) * 20, tavern[1] + 5, 'folk');
      if (smithy) person(g, smithy[0], smithy[1] + 5, 'smith');
      if (temple) person(g, temple[0], temple[1] + 6, 'monk');
      person(g, light[0] + 6, light[1] + 6, 'elder');
      houses.forEach(([x, y]) => { for (let k = many(g, 'people', 0.5); k > 0; k--) person(g, x + (R() - 0.5) * 16, y + 5); });
    });
    later(g, 'animals', () => {
      houses.forEach(([x, y]) => { for (let k = many(g, 'animals', 0.4); k > 0; k--) animal(g, 'chicken', x + (R() - 0.5) * 30, y + 4 + R() * 4); });
      wildAnimals(g, toWater, null, away, true);
    });
    later(g, 'monsters', () => wildMonsters(g, toWater, away));
    later(g, 'hero', () => hero(g, qc[0], qy - 4));
  }

  // ---------- Graveyard and ruins ----------

  // An old graveyard behind an iron fence: rows of headstones, gravel paths, a crypt or two at the back, dead trees
  // and lanterns at the gate. Beyond it the ruins of a chapel (broken walls, pillars, an altar) and odd bits of
  // wall in the fields. Autumn, fog, and dusk coming on: after dark, skeletons climb out of their graves.
  function graveyard(g) {
    const { map, w, h, n, size, rng } = g;
    const wet = field(g, size * 0.3, 4301), wood = field(g, size * 0.2, 4302), spots = field(g, size * 0.07, 4303);
    const dry = quantile(wet, 0.2);
    for (let i = 0; i < n; i++) map.ground[i] = wet[i] < dry ? GROUND.DIRT : GROUND.GRASS;

    const gw = clamp(Math.round(w * 0.46), 44, Math.min(170, w - 16)), gh = clamp(Math.round(h * 0.42), 40, Math.min(130, h - 40));
    const ruinsAbove = h - gh >= 110, ruinsBeside = !ruinsAbove && w - gw >= 110;
    const shift = ruinsBeside ? (rng() < 0.5 ? -1 : 1) * Math.round((w - gw) * 0.22) : 0;
    const gx0 = ((w - gw) >> 1) + shift, gx1 = gx0 + gw - 1;
    const gy1 = h - 26 - (h > 260 ? Math.round((h - 260) * 0.3) : 0), gy0 = gy1 - gh + 1;
    const gcx = (gx0 + gx1) >> 1, gmy = ((gy0 + gy1) >> 1) + 6;

    // Inside: grass with gravel paths in a cross; the fence round it with a gate; a path from the gate away.
    forEach(g, (i, x, y) => {
      if (x < gx0 - 6 || x > gx1 + 6 || y < gy0 - 6 || y > gy1 + 6) return;
      map.scatter[i] = SCATTER.NONE;
      if (x > gx0 && x < gx1 && y > gy0 && y < gy1) map.ground[i] = (Math.abs(x - gcx) <= 2 && y > gy0 + 3) || (Math.abs(y - gmy) <= 2 && x > gx0 + 3 && x < gx1 - 3) ? GROUND.GRAVEL : GROUND.GRASS;
    });
    const out = [[gcx, gy1], [gcx, gy1 + 10], [clamp(gcx + Math.round((rng() - 0.5) * w * 0.3), 6, w - 7), h - 1]];
    paint(g, out, 4, i => { map.ground[i] = GROUND.PATH; });
    paint(g, out, 12, i => { map.scatter[i] = SCATTER.NONE; });
    for (let x = gx0 + 5; x + 5 <= gx1; x += 11) {
      place(g, 'ironfence', x, gy0);
      if (Math.abs(x - gcx) > 9) place(g, 'ironfence', x, gy1);
    }
    for (let y = gy0 + 11; y <= gy1; y += 11) { place(g, 'ironfence', gx0, y, { turn: 1 }); place(g, 'ironfence', gx1, y, { turn: 1 }); }
    for (const s of [-1, 1]) place(g, 'lantern', gcx + s * 8, gy1 + 1);

    // Crypts at the back, then the graves in rows, clear of the paths and the crypts.
    const crypts = [], reserved = [];
    const cryptAt = gw > 90 ? [-1, 1] : [rng() < 0.5 ? -1 : 1];
    for (const s of cryptAt) {
      const x = gcx + s * Math.round(gw * 0.27), y = gy0 + 32;
      place(g, 'crypt', x, y);
      crypts.push([x, y]);
      reserved.push([x - 26, y - 30, x + 26, y + 6]);
    }
    const graves = [];
    for (let y = gy0 + 18; y <= gy1 - 8; y += 18) {
      for (let x = gx0 + 9; x <= gx1 - 9; x += 14) {
        if (Math.abs(x - gcx) < 9 || Math.abs(y - gmy) < 9 || reserved.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d) || rng() > 0.82) continue;
        place(g, 'headstone', x + Math.round((rng() - 0.5) * 2), y);
        graves.push([x, y + 4]);
      }
    }
    for (let k = 0, c = 1 + Math.floor(rng() * 2); k < c; k++) place(g, 'deadtree', rng() < 0.5 ? gx0 + 5 : gx1 - 5, gy0 + 10 + Math.floor(rng() * (gh - 20)), { scale: 1.2 });

    // The ruined chapel: a broken floor, walls standing in places, two rows of pillars (some fallen), the altar.
    let ruin = null;
    if (ruinsAbove || ruinsBeside) {
      const rw = clamp(Math.round(w * 0.32), 44, 80), rh = clamp(Math.round(h * 0.2), 34, 54);
      const rx0 = ruinsAbove ? clamp(gcx - (rw >> 1) + Math.round((rng() - 0.5) * w * 0.3), 8, w - rw - 9) : shift > 0 ? Math.max(8, gx0 - rw - 24) : Math.min(w - rw - 9, gx1 + 24);
      const ry0 = ruinsAbove ? clamp(gy0 - rh - 24, 14, h) : clamp(gy0 + 4, 14, h - rh - 10);
      ruin = [rx0, ry0, rx0 + rw - 1, ry0 + rh - 1];
    }
    if (ruin) {
      const [rx0, ry0, rx1, ry1] = ruin, rcx = (rx0 + rx1) >> 1, rcy = (ry0 + ry1) >> 1;
      forEach(g, (i, x, y) => {
        if (x < rx0 - 8 || x > rx1 + 8 || y < ry0 - 8 || y > ry1 + 8) return;
        map.scatter[i] = SCATTER.NONE;
        if (x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1) { const v = Random.noise(x, y, 7, 4304); map.ground[i] = v > 0.32 ? GROUND.FLAGSTONE : v > 0.2 ? GROUND.GRAVEL : GROUND.GRASS; }
      });
      for (let x = rx0 + 10; x <= rx1 - 8; x += 22) if (rng() < 0.8) place(g, 'ruinwall', x, ry0 + 2);
      for (let y = ry0 + 22; y <= ry1; y += 24) for (const x of [rx0, rx1]) if (rng() < 0.75) place(g, 'ruinwall', x, y, { turn: 1 });
      for (const x of [rx0 + 7, rx1 - 7]) if (rng() < 0.7) place(g, 'ruinwall', x, ry1, { scale: 0.6 });
      for (let x = rx0 + 10; x <= rx1 - 10; x += 12) for (const y of [rcy - 2, rcy + 9]) {
        if (Math.abs(x - rcx) < 6) continue;
        place(g, rng() < 0.65 ? 'pillar' : 'rubble', x, y);
      }
      place(g, 'altar', rcx, ry0 + 12);
      if (rng() < 0.6) place(g, 'candles', rcx + 8, ry0 + 12);
      for (let k = 0; k < 3; k++) place(g, pick(rng, ['rubble', 'mushrooms', 'rock']), rx0 + 4 + rng() * (rx1 - rx0 - 8), ry0 + 14 + rng() * (ry1 - ry0 - 16));
      paint(g, [[gcx, gy0 - 1], [rcx, ry1 + 2]], 3, i => { if (!Types.isPath(map.ground[i])) map.ground[i] = GROUND.PATH; map.scatter[i] = SCATTER.NONE; });
    }

    // Odd bits of wall, dead trees and woods out in the fields.
    const busy = new Uint8Array(n);
    forEach(g, (i, x, y) => {
      busy[i] = (x > gx0 - 14 && x < gx1 + 14 && y > gy0 - 14 && y < gy1 + 14) || Types.isPath(map.ground[i])
        || (ruin && x > ruin[0] - 14 && x < ruin[2] + 14 && y > ruin[1] - 30 && y < ruin[3] + 14) ? 1 : 0;
    });
    const clear = Grid.distanceField(w, h, busy);
    const forest = quantile(wood, 0.74), edge = quantile(wood, 0.68), bloom = quantile(spots, 0.06);
    for (let i = 0; i < n; i++) {
      if (clear[i] < 4) continue;
      map.scatter[i] = wood[i] > forest && clear[i] > 10 ? SCATTER.FOREST : wood[i] > edge ? SCATTER.BUSHES : spots[i] < bloom ? SCATTER.FLOWERS : SCATTER.NONE;
    }
    const field_ = (x, y) => x > 10 && x < w - 11 && y > 24 && y < h - 6 && clear[y * w + x] > 12 && !map.scatter[y * w + x];
    for (let k = 0, made = 0; made < 1 + n / 40000 && k < 600; k++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h);
      if (!field_(x, y)) continue;
      place(g, 'ruinwall', x, y, { scale: 0.7 });
      place(g, 'rubble', x + 12, y + 3);
      made++;
    }
    for (let k = 0, made = 0; made < n / 9000 && k < 900; k++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h);
      if (field_(x, y)) { place(g, 'deadtree', x, y); made++; }
    }

    // Life: skeletons in the graves (they climb out after dark), cultists at the crypts and the altar, a few more
    // monsters about; a gravedigger, a monk at the ruins and a mourner; rabbits and deer; the hero at the gate.
    const R = g.lrng;
    const outside = ([x, y]) => !busy[y * w + x];
    later(g, 'monsters', () => {
      const pool = graves.slice();
      for (let k = Math.min(pool.length, many(g, 'monsters', Math.max(2, graves.length * 0.14))); k > 0; k--) {
        const [x, y] = pool.splice(Math.floor(R() * pool.length), 1)[0];
        monster(g, ['skeleton'], x, y, { rise: 1 });
      }
      crypts.forEach(([x, y]) => monster(g, ['cultist'], x + (R() - 0.5) * 8, y + 7));
      if (ruin) for (let k = many(g, 'monsters', 1.5); k > 0; k--) monster(g, ['cultist'], ((ruin[0] + ruin[2]) >> 1) + (R() - 0.5) * 16, ruin[1] + 18);
      wildMonsters(g, null, outside);
    });
    later(g, 'people', () => {
      if (graves.length) { const [x, y] = graves[Math.floor(R() * graves.length)]; person(g, x + 4, y + 2, 'folk'); }
      if (graves.length) { const [x, y] = graves[Math.floor(R() * graves.length)]; person(g, x, y + 3, 'elder', { still: 1 }); }
      person(g, ruin ? (ruin[0] + ruin[2]) >> 1 : gcx, ruin ? ruin[1] + 18 : gy1 + 6, 'monk');
    });
    later(g, 'animals', () => wildAnimals(g, null, null, outside, true));
    later(g, 'hero', () => hero(g, gcx, gy1 + 10));
  }

  // ---------- Helpers ----------

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Runs fn(i) for every pixel within width of the polyline pts. Returns the mask.
  function paint(g, pts, width, fn) {
    const mask = Grid.maskFromPath(g.w, g.h, pts, { width });
    for (let i = 0; i < g.n; i++) if (mask[i]) fn(i);
    return mask;
  }

  Generate.addBiome('castle', {
    name: 'Castle', make: castle,
    where: { people: 'Guards at the gate and walking the walls, the smith, the lord at the keep, folk in the courtyard and by the houses outside.',
      monsters: 'Out in the wilds, well away from the castle.', animals: 'Chickens in the courtyard, ducks on the moat, deer, rabbits and sheep in the fields.',
      hero: 'On the road outside the gate.' },
  });
  Generate.addBiome('swamp', {
    name: 'Swamp', make: swamp,
    where: { people: 'The witch at her hut, a traveler or two on the boardwalk.', monsters: 'Slimes by the water, cultists round the witch’s hut, a few more about.',
      animals: 'Ducks on the pools, deer and rabbits on dry ground.', hero: 'At one end of the boardwalk.' },
    settings: { fog: 0.35, fireflies: 120, butterflies: 3, birds: 0, fish: 3, timeOfDay: 17 },
    colors: { deep: '#2c4c45', mid: '#3a6150', shallow: '#56806a', foam: '#b4c4aa', glint: '#b0c8b0', grassDark: '#4a7232', grassLight: '#557d36',
      grassLip: '#3a5c28', tuftShadow: '#3a5c28', bladeRoot: '#5f8f3c', bladeMid: '#7aa548', bladeTip: '#98bb5c', canopyOutline: '#1b2e1c',
      canopyDark: '#29452a', canopyMid: '#365a30', canopyLight: '#4a7038', canopyHighlight: '#62873e', lily: '#4f8a3a', lilyDark: '#35632a' },
  });
  Generate.addBiome('harbor', {
    name: 'Harbor town', make: harbor,
    where: { people: 'On the quay and the piers, at the tavern and by their houses, and the keeper at the lighthouse.',
      monsters: 'Out in the wilds, well away from the town.', animals: 'Chickens by the houses, ducks on the water, deer and rabbits inland.', hero: 'On the quay.' },
    settings: { gulls: 10, birds: 0, fish: 8 },
  });
  Generate.addBiome('graveyard', {
    name: 'Graveyard and ruins', make: graveyard, season: 'autumn',
    where: { people: 'A gravedigger and a mourner among the graves, a monk at the ruins.',
      monsters: 'Skeletons in the graves that climb out after dark, cultists at the crypts and the altar, a few more about.',
      animals: 'Rabbits and deer in the fields.', hero: 'At the graveyard gate.' },
    settings: { fog: 0.5, timeOfDay: 18.75, dayCycle: true, dayLength: 240, butterflies: 0, birds: 0, fireflies: 40, cloudAmount: 0.6 },
  });
})();
