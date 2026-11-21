// Random landscapes for the New map dialog. Each biome paints the same layers the tools do (ground, water, scatter,
// elevation, terrace, rivers, objects), so the result is an ordinary map you keep painting. Same seed, same map.
const Generate = (() => {
  const { GROUND, WATER, SCATTER } = Types;

  // Biomes in menu order (more are added by addBiome). Terrain: water / sea (fraction of the map), hills (fraction raised), levels (highest hill),
  // hillSize (noise size, as a share of the map's short side), mesas (fraction cut into flat plateaus), river,
  // path (ground), camp (building, fire, extra), loose (objects dotted about), palms (round each pool).
  // season, settings and colors go on the new map.
  const BIOMES = {
    meadows: {
      name: 'Meadows and forest', water: 0.1, hills: 0.28, levels: 3, hillSize: 0.4, river: true, path: GROUND.PATH,
      camp: ['tent', 'campfire', 'log'], loose: ['rock', 'log', 'stump', 'mushrooms', 'bush'],
    },
    islands: {
      name: 'Islands', sea: 0.5, hills: 0.12, levels: 2, hillSize: 0.28, path: GROUND.PATH,
      camp: ['hut', 'campfire', 'barrel'], loose: ['palm', 'palm', 'rock', 'bush'],
    },
    desert: {
      name: 'Desert', water: 0.025, hills: 0.25, levels: 1, hillSize: 0.3, mesas: 0.06, path: GROUND.GRAVEL,
      camp: ['tent', 'campfire', 'sacks'], loose: ['rock', 'rubble', 'rubble'], palms: 4,
      settings: { timeOfDay: 14, butterflies: 2, fireflies: 0, fish: 2, cloudAmount: 0.1 },
    },
    snowy: {
      name: 'Snowy pines', water: 0.07, hills: 0.32, levels: 4, hillSize: 0.4, river: true, path: GROUND.PATH,
      camp: ['cabin', 'campfire', 'log'], loose: ['rock', 'log', 'stump'],
      season: 'winter', settings: { weather: 'snow', precipitation: 0.5, butterflies: 0, fireflies: 0 },
    },
    cave: {
      name: 'Cave', cave: true,
      settings: { underground: true, ambient: 0.3, weather: 'clear', clouds: false, butterflies: 0, birds: 0, fireflies: 0, fish: 0 },
    },
    village: { name: 'Village', village: true, river: true },
    dungeon: {
      name: 'Dungeon', dungeon: true,
      settings: { underground: true, ambient: 0.3, weather: 'clear', clouds: false, butterflies: 0, birds: 0, fireflies: 0, fish: 0 },
    },
  };

  // A new map of the given biome, made from the seed. life: who to put on it (see lifeOptions); nobody by default.
  function landscape(width, height, seed, biome, life) {
    const key = BIOMES[biome] ? biome : 'meadows', b = BIOMES[key];
    const map = MapModel.create(width, height, seed, GROUND.GRASS);
    Random.setSeed(seed);
    const g = { map, b, key, w: width, h: height, n: width * height, size: Math.min(width, height), rng: Random.makeRng(seed),
      lrng: Random.makeRng(seed * 7 + 99991), L: lifeOptions(life), later: [] };
    if (b.make) b.make(g); else if (b.cave) cave(g); else if (b.dungeon) dungeon(g); else if (b.village) village(g); else outdoors(g);
    for (const [group, fn] of g.later) if (g.L[group]) fn();
    map.name = b.name;
    if (b.season) applySeason(map.settings, b.season);
    Object.assign(map.settings, b.settings || {});
    Object.assign(map.settings.colors, b.colors || {});
    return map;
  }

  // ---------- Outdoors ----------

  // Height → water and hills; then ground, plants, a river, a path with a camp on it, and a few loose objects.
  function outdoors(g) {
    const { map, b, w, h, n, size } = g;
    const height = field(g, size * b.hillSize, 3001);
    const wet = field(g, size * 0.3, 3002);
    const wood = field(g, size * 0.2, 3003);
    const spots = field(g, size * 0.07, 3004);
    if (b.sea) forEach(g, (i, x, y) => { height[i] = height[i] * 0.55 + Math.min(1, edge(g, x, y) * 1.6) * 0.45; });

    // Water: the lowest ground, without the puddles.
    const low = quantile(height, b.sea || b.water);
    const pools = dropSmall(g, Grid.maskWhere(height, v => v < low), size * size * 0.004);
    for (let i = 0; i < n; i++) if (pools[i]) map.water[i] = b.sea ? WATER.SEA : WATER.LAKE;
    const toWater = Grid.distanceField(w, h, pools);

    // Hills: the highest ground, one level per band.
    const foot = quantile(height, 1 - b.hills), top = quantile(height, 0.995);
    for (let i = 0; i < n; i++) {
      if (!map.water[i] && height[i] > foot) map.elevation[i] = Math.min(b.levels, 1 + Math.floor((height[i] - foot) / (top - foot) * b.levels));
    }
    if (b.mesas) {
      const mesa = field(g, size * 0.15, 3005), edgeOf = quantile(mesa, 1 - b.mesas);
      const flat = dropSmall(g, Grid.maskWhere(mesa, v => v > edgeOf), 150);
      for (let i = 0; i < n; i++) if (flat[i] && !map.water[i] && toWater[i] > 6) { map.terrace[i] = 3; map.elevation[i] = 0; }
    }

    const p = { height, wet, wood, spots, toWater };
    LOOKS[g.key].ground(g, p);
    LOOKS[g.key].plants(g, p);

    const river = b.river ? addRiver(g) : null;
    if (river) {
      // Low ground along the river, so it runs through valleys more than gorges.
      const near = Grid.distanceField(w, h, Grid.maskFromPath(w, h, river, { width: 2 }));
      for (let i = 0; i < n; i++) if (near[i] < 14) map.elevation[i] = Math.min(map.elevation[i], Math.floor(near[i] / 7));
    }
    const path = addPath(g, river);
    const camp = addCamp(g, path, river, toWater);
    addLoose(g, river, toWater);

    // Life: folk round the camp and travelers on the path, animals where they'd live, monsters out in the wilds.
    const rest = camp || densify(path)[densify(path).length >> 1];
    const away = ([x, y]) => !camp || Math.hypot(x - camp[0], y - camp[1]) > 40;
    later(g, 'people', () => {
      if (camp) for (let k = many(g, 'people', 2.5); k > 0; k--) { const a = g.lrng() * Math.PI * 2; person(g, camp[0] + Math.cos(a) * 14, camp[1] + 11 + Math.sin(a) * 7); }
      const along = densify(path);
      for (let k = many(g, 'people', 1 + n / 90000); k > 0; k--) person(g, ...along[Math.floor(g.lrng() * along.length)]);
    });
    later(g, 'animals', () => {
      wildAnimals(g, toWater, river, away);
      if (camp) for (let k = many(g, 'animals', 2); k > 0; k--) animal(g, 'chicken', camp[0] + (g.lrng() - 0.5) * 24, camp[1] + 10 + g.lrng() * 4);
    });
    later(g, 'monsters', () => wildMonsters(g, toWater, away));
    later(g, 'hero', () => hero(g, rest[0], rest[1] + (camp ? 12 : 0)));
  }

  // How each outdoor biome colors its ground and where its plants grow.
  // p: the noise fields (height, wet, wood, spots) and distance to water. Fractions are shares of the map.
  const LOOKS = {
    meadows: {
      ground(g, p) {
        const dry = quantile(p.wet, 0.2);
        for (let i = 0; i < g.n; i++) g.map.ground[i] = p.wet[i] < dry ? GROUND.DIRT : GROUND.GRASS;
      },
      plants(g, p) {
        const forest = quantile(p.wood, 0.68), edge = quantile(p.wood, 0.62), bloom = quantile(p.spots, 0.1), stony = quantile(p.spots, 0.8);
        landEach(g, i => {
          const lvl = g.map.elevation[i];
          if (p.wood[i] > forest) return lvl >= 2 ? SCATTER.PINES : SCATTER.FOREST;
          if (p.wood[i] > edge) return SCATTER.BUSHES;
          if (lvl >= g.b.levels && p.spots[i] > stony) return SCATTER.ROCKY;
          if (g.map.ground[i] === GROUND.GRASS && p.spots[i] < bloom) return SCATTER.FLOWERS;
          return SCATTER.NONE;
        });
      },
    },
    islands: {
      ground(g, p) {
        const dry = quantile(p.wet, 0.1);
        for (let i = 0; i < g.n; i++) g.map.ground[i] = p.toWater[i] < 5 + p.spots[i] * 8 ? GROUND.SAND : p.wet[i] < dry ? GROUND.DIRT : GROUND.GRASS;
      },
      plants(g, p) {
        const forest = quantile(p.wood, 0.7), edge = quantile(p.wood, 0.64), bloom = quantile(p.spots, 0.08);
        landEach(g, i => {
          if (g.map.ground[i] !== GROUND.GRASS) return SCATTER.NONE;
          if (p.wood[i] > forest && p.toWater[i] > 12) return SCATTER.FOREST;
          if (p.wood[i] > edge) return SCATTER.BUSHES;
          return p.spots[i] < bloom ? SCATTER.FLOWERS : SCATTER.NONE;
        });
      },
    },
    desert: {
      ground(g, p) {
        const crust = quantile(p.wet, 0.62);
        for (let i = 0; i < g.n; i++) {
          g.map.ground[i] = p.toWater[i] < 5 + p.spots[i] * 7 ? GROUND.GRASS : g.map.terrace[i] || p.wet[i] > crust ? GROUND.DRY_EARTH : GROUND.SAND;
        }
      },
      plants(g, p) {
        const stony = quantile(p.spots, 0.82), scrub = quantile(p.wood, 0.95);
        landEach(g, i => {
          if (g.map.ground[i] === GROUND.GRASS) return p.toWater[i] > 2 ? SCATTER.BUSHES : SCATTER.NONE;
          if (g.map.ground[i] === GROUND.DRY_EARTH && p.spots[i] > stony) return SCATTER.ROCKY;
          return p.wood[i] > scrub ? SCATTER.BUSHES : SCATTER.NONE;
        });
      },
    },
    snowy: {
      ground(g, p) {
        const bare = quantile(p.wet, 0.06);
        for (let i = 0; i < g.n; i++) g.map.ground[i] = p.wet[i] < bare ? GROUND.DIRT : GROUND.GRASS;
      },
      plants(g, p) {
        const forest = quantile(p.wood, 0.5), stony = quantile(p.spots, 0.93);
        landEach(g, i => p.wood[i] > forest ? SCATTER.PINES : p.spots[i] > stony ? SCATTER.ROCKY : SCATTER.NONE);
      },
    },
  };

  // A river from one edge to the opposite one, wandering on the way. Returns its points.
  function addRiver(g) {
    const { map, rng } = g;
    const points = line(g, rng() < 0.5, 3006);
    map.rivers.push({ id: MapModel.nextId(map), points, width: map.settings.riverWidth, meander: map.settings.riverMeander,
      wobble: map.settings.riverWidthWobble, seed: seedFrom(rng) });
    return points;
  }

  // A path across the map (across the river, so it gets a bridge). Returns its points.
  function addPath(g, river) {
    const { map, b, w, h, n } = g;
    const riverDown = river && river[0][1] === 0;   // vertical lines start on the top edge
    const points = line(g, river ? !riverDown : g.rng() < 0.5, 3007);
    const road = Grid.maskFromPath(w, h, points, { width: 4 });
    const verge = Grid.maskFromPath(w, h, points, { width: 12 });
    for (let i = 0; i < n; i++) {
      if (verge[i]) map.scatter[i] = SCATTER.NONE;
      if (road[i] && !map.water[i]) { map.ground[i] = b.path; map.terrace[i] = 0; }
    }
    return points;
  }

  // Wobbly line from edge to edge. vertical: top to bottom, else left to right. Ends sit on the map's edges.
  function line(g, vertical, salt) {
    const { w, h, size, rng } = g;
    const len = vertical ? h : w, span = vertical ? w : h;
    const base = span * (0.3 + rng() * 0.4), steps = 6;
    const pts = [];
    for (let k = 0; k <= steps; k++) {
      const along = Math.round(k / steps * (len - 1));
      const off = (Random.noise1D(along, len * 0.5, salt) - 0.5) * size * 0.6;
      const cross = Math.round(Math.min(span - 10, Math.max(9, base + off)));
      pts.push(vertical ? [cross, along] : [along, cross]);
    }
    return pts;
  }

  // A small camp beside the path, on dry level ground away from the river and near the middle of the map.
  // Returns its middle, or null if there was no room.
  function addCamp(g, path, river, toWater) {
    const { map, b, w, h, n } = g;
    const fromRiver = river ? Grid.distanceField(w, h, Grid.maskFromPath(w, h, river, { width: 1 })) : null;
    const spots = [];
    const dense = densify(path);
    dense.forEach(([x, y], k) => {
      const a = dense[Math.max(0, k - 3)], c = dense[Math.min(dense.length - 1, k + 3)];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      for (const side of [-1, 1]) spots.push([Math.round(x - (c[1] - a[1]) / len * 16 * side), Math.round(y + (c[0] - a[0]) / len * 16 * side)]);
    });
    spots.sort((p, q) => Math.hypot(p[0] - w / 2, p[1] - h / 2) - Math.hypot(q[0] - w / 2, q[1] - h / 2));
    const fits = ([x, y]) => {
      if (x < 30 || y < 48 || x > w - 31 || y > h - 20) return false;
      const i = y * w + x;
      if (toWater[i] < 14 || (fromRiver && fromRiver[i] < 22)) return false;
      for (let dy = -24; dy <= 14; dy += 2) for (let dx = -24; dx <= 24; dx += 2) {
        const j = (y + dy) * w + x + dx;
        if (map.elevation[j] || map.terrace[j] || map.water[j]) return false;
      }
      return true;
    };
    const spot = spots.find(fits);
    if (!spot) return null;
    const [cx, cy] = spot;
    forEach(g, (i, x, y) => {
      const d = Math.hypot(x - cx, (y - cy + 4) * 1.2);
      if (Math.hypot(x - cx, (y - cy - 10) * 0.9) < 46) map.scatter[i] = SCATTER.NONE;       // trees in front would hide the camp
      if (d < 12 + Random.noise(x, y, 6, 3008) * 8 && !Types.isPath(map.ground[i])) map.ground[i] = GROUND.DIRT;
    });
    const [home, fire, extra] = b.camp;
    place(g, home, cx, cy - 10);
    place(g, fire, cx, cy + 10);
    place(g, extra, cx - 16, cy + 12);
    return [cx, cy];
  }

  // Loose objects dotted over open land: about one per 5000 pixels.
  function addLoose(g, river, toWater) {
    const { map, b, w, h, n, rng } = g;
    const fromRiver = river ? Grid.distanceField(w, h, Grid.maskFromPath(w, h, river, { width: 1 })) : null;
    const want = Math.round(n / 5000);
    for (let tries = 0, placed = 0; placed < want && tries < want * 30; tries++) {
      const type = b.loose[Math.floor(rng() * b.loose.length)];
      const x = 6 + Math.floor(rng() * (w - 12)), y = 12 + Math.floor(rng() * (h - 18)), i = y * w + x;
      if (map.water[i] || Types.isPath(map.ground[i]) || toWater[i] < 3 || (fromRiver && fromRiver[i] < 12)) continue;
      if (type === 'palm' && map.ground[i] !== GROUND.SAND) continue;
      if (type === 'mushrooms' && map.scatter[i] !== SCATTER.FOREST) continue;
      if (type === 'bush' && map.scatter[i]) continue;
      place(g, type, x, y);
      placed++;
    }
    if (b.palms) addPalms(g, toWater);
  }

  // A few palms round each pool, on its grassy bank.
  function addPalms(g, toWater) {
    const { map, b, w, h, rng } = g;
    const { label, sizes } = regions(g, map.water);
    const sx = new Float64Array(sizes.length), sy = new Float64Array(sizes.length);
    for (let i = 0; i < g.n; i++) if (label[i]) { sx[label[i]] += i % w; sy[label[i]] += (i / w) | 0; }
    for (let id = 1; id < sizes.length; id++) {
      const cx = sx[id] / sizes[id], cy = sy[id] / sizes[id], r = Math.sqrt(sizes[id] / Math.PI);
      for (let tries = 0, placed = 0; placed < b.palms && tries < 200; tries++) {
        const a = rng() * Math.PI * 2, d = r + 2 + rng() * 10;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (x < 4 || y < 12 || x > w - 5 || y > h - 3) continue;
        const i = y * w + x;
        if (map.water[i] || toWater[i] < 3 || toWater[i] > 9 || Types.isPath(map.ground[i])) continue;
        place(g, 'palm', x, y);
        placed++;
      }
    }
  }

  // ---------- Cave ----------

  // Rock everywhere, one connected cave carved out of it, with pools, gravel, a camp and lights.
  function cave(g) {
    const { map, w, h, n, size } = g;
    const rough = field(g, size * 0.1, 3101), broad = field(g, size * 0.3, 3102), spots = field(g, size * 0.06, 3103), wet = field(g, size * 0.12, 3104);
    const room = new Float32Array(n);
    forEach(g, (i, x, y) => { room[i] = rough[i] * 0.6 + broad[i] * 0.4 - (1 - Math.min(1, edge(g, x, y) * 5)) * 0.5; });
    const cut = quantile(room, 0.48);
    let floor = Grid.maskWhere(room, v => v > cut);
    for (let k = 0; k < 3; k++) floor = smooth(g, floor);
    // Keep only the biggest cave, so every part of it can be reached.
    const { label, sizes } = regions(g, floor);
    const biggest = sizes.indexOf(Math.max(...sizes.slice(1)));
    for (let i = 0; i < n; i++) floor[i] = label[i] === biggest ? 1 : 0;

    const toWall = Grid.distanceField(w, h, Grid.maskWhere(floor, v => !v));
    const gravel = quantile(spots, 0.86), stony = quantile(spots, 0.12), damp = quantile(wet, 0.08);
    const pools = dropSmall(g, Grid.maskWhere(wet, v => v < damp).map((v, i) => v && toWall[i] > 3 ? 1 : 0), 80);
    for (let i = 0; i < n; i++) {
      map.ground[i] = !floor[i] ? GROUND.ROCK : spots[i] > gravel ? GROUND.GRAVEL : GROUND.CAVE_FLOOR;
      if (pools[i]) map.water[i] = WATER.LAKE;
      else if (floor[i] && spots[i] < stony && toWall[i] > 2) map.scatter[i] = SCATTER.ROCKY;
    }
    const toWater = Grid.distanceField(w, h, pools);

    // Camp in the roomiest dry spot.
    let best = -1;
    for (let i = 0; i < n; i++) if (toWater[i] > 10 && (best < 0 || toWall[i] > toWall[best])) best = i;
    if (best >= 0 && toWall[best] > 18) {
      const cx = best % w, cy = (best / w) | 0;
      forEach(g, (i, x, y) => { if (Math.hypot(x - cx, y - cy) < 26) map.scatter[i] = SCATTER.NONE; });
      place(g, 'campfire', cx, cy + 4);
      place(g, 'bedroll', cx - 16, cy - 2);
      place(g, 'bedroll', cx + 15, cy - 3);
      place(g, 'chest', cx + 16, cy + 13);
      place(g, 'barrel', cx - 17, cy + 13);
    }

    // Braziers and torches along the walls, spread out; mushrooms in damp corners.
    const lights = [], want = Math.max(3, Math.round(n / 9000));
    for (let tries = 0; lights.length < want && tries < want * 60; tries++) {
      const x = Math.floor(g.rng() * w), y = Math.floor(g.rng() * h), i = y * w + x;
      if (!floor[i] || map.water[i] || toWall[i] < 3 || toWall[i] > 5 || lights.some(([a, c]) => Math.hypot(a - x, c - y) < 45)) continue;
      lights.push([x, y]);
      place(g, g.rng() < 0.3 ? 'brazier' : 'torch', x, y);
    }
    for (let tries = 0, placed = 0; placed < n / 6000 && tries < 400; tries++) {
      const x = Math.floor(g.rng() * w), y = Math.floor(g.rng() * h), i = y * w + x;
      if (!floor[i] || map.water[i] || toWall[i] > 4 || toWall[i] < 2) continue;
      place(g, 'mushrooms', x, y);
      placed++;
    }

    // Life: goblins round the camp, slimes by the pools, a few more in the dark; the hero at the camp.
    const camp = best >= 0 && toWall[best] > 12 ? [best % w, (best / w) | 0] : null;
    const open = (x, y) => { const i = y * w + x; return floor[i] && !map.water[i] && !map.scatter[i] && toWall[i] >= 4; };
    later(g, 'monsters', () => {
      if (camp) for (let k = many(g, 'monsters', 2.5); k > 0; k--) { const a = g.lrng() * Math.PI * 2; monster(g, ['goblin'], camp[0] + Math.cos(a) * 7, camp[1] + 4 + Math.sin(a) * 5); }
      spread(g, many(g, 'monsters', Math.max(2, n / 18000)), (x, y) => open(x, y) && toWater[y * w + x] >= 3 && toWater[y * w + x] <= 12, (x, y) => monster(g, ['slime'], x, y));
      spread(g, many(g, 'monsters', n / 40000), (x, y) => open(x, y) && (!camp || Math.hypot(x - camp[0], y - camp[1]) > 40), (x, y) => monster(g, MONSTERS, x, y));
    });
    later(g, 'hero', () => {
      if (camp) return hero(g, camp[0], camp[1] + 20);
      spread(g, 1, (x, y) => open(x, y) && toWall[y * w + x] > 8, (x, y) => hero(g, x, y));
    });
  }

  // Majority filter: a pixel becomes floor when most of its 3 × 3 neighborhood is. Rounds the cave walls.
  function smooth(g, mask) {
    const { w, h, n } = g;
    const out = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c += mask[(y + dy) * w + x + dx];
        out[y * w + x] = c >= 5 ? 1 : 0;
      }
    }
    return out;
  }

  // ---------- Village ----------

  // A cobbled main road with a square and a well, lanes off it, every house different, gardens, a pen or two
  // with animals, fields of hay, and woods round the edge. A river runs through half the villages.
  function village(g) {
    const { map, w, h, n, size, rng } = g;
    g.pens = [];
    const wet = field(g, size * 0.3, 3201), wood = field(g, size * 0.2, 3202), spots = field(g, size * 0.07, 3203);
    const dry = quantile(wet, 0.12);
    for (let i = 0; i < n; i++) map.ground[i] = wet[i] < dry ? GROUND.DIRT : GROUND.GRASS;

    const river = rng() < 0.5 ? addRiver(g) : null;
    const wetMask = river ? Grid.maskFromPath(w, h, river, { width: map.settings.riverWidth + map.settings.riverMeander * 2 + 8 }) : new Uint8Array(n);

    // Roads: the main one across (over the river, if any), then lanes from it to the edges.
    const roads = new Uint8Array(n);
    const paint = (pts, width, ground) => {
      const mask = Grid.maskFromPath(w, h, pts, { width });
      for (let i = 0; i < n; i++) if (mask[i]) { roads[i] = 1; map.ground[i] = ground; }
    };
    const riverDown = river && river[0][1] === 0;
    const main = line(g, river ? !riverDown : rng() < 0.5, 3204);
    const mainVertical = main[0][1] === 0;
    paint(main, 7, GROUND.COBBLE);
    const along = densify(main);
    const lanes = [];
    for (let k = 0, count = 1 + Math.floor(rng() * 2); k < count; k++) {
      const [sx, sy] = along[Math.floor(along.length * (0.25 + rng() * 0.5))];
      const end = mainVertical ? [rng() < 0.5 ? 0 : w - 1, sy + (rng() - 0.5) * h * 0.4] : [sx + (rng() - 0.5) * w * 0.4, rng() < 0.5 ? 0 : h - 1];
      const bend = [(sx + end[0]) / 2 + (rng() - 0.5) * 30, (sy + end[1]) / 2 + (rng() - 0.5) * 30];
      const lane = [[sx, sy], bend, end].map(([x, y]) => [Math.round(Math.max(0, Math.min(w - 1, x))), Math.round(Math.max(0, Math.min(h - 1, y)))]);
      paint(lane, 5, GROUND.PATH);
      lanes.push(lane);
    }

    // The square: a cobbled patch on the main road near the middle, with the well.
    const qr = 20 + Math.floor(rng() * 7);            // room for the well (19 wide under its roof) and stalls round it
    const fromRiver = river ? Grid.distanceField(w, h, Grid.maskFromPath(w, h, river, { width: 1 })) : null;
    const cost = ([x, y]) => Math.hypot(x - w / 2, y - h / 2) + (fromRiver && fromRiver[Math.round(y) * w + Math.round(x)] < qr + 22 ? 1e6 : 0);
    const [qx, qy] = along.reduce((a, p) => cost(p) < cost(a) ? p : a).map(Math.round);
    forEach(g, (i, x, y) => {
      if (Math.hypot(x - qx, (y - qy) * 1.15) < qr + (Random.noise(x, y, 5, 3205) - 0.5) * 4 && !wetMask[i]) { roads[i] = 1; map.ground[i] = GROUND.COBBLE; }
    });
    place(g, 'well', qx, qy + 6);
    const stalls = ['crate', 'barrel', 'sacks', 'barrel', 'crate', 'bench', 'lantern'];
    for (let k = 0; k < 5; k++) {
      const a = rng() * Math.PI * 2;
      place(g, stalls[Math.floor(rng() * stalls.length)], qx + Math.cos(a) * (qr - 5), qy + Math.sin(a) * (qr - 5) * 0.8);
    }

    // Houses beside every road, front walls toward the road where they can, never on a road or in the river.
    const { taken, free, take, spots: roadSpots, site, houses: buildHouses } = lots(g, roads, wetMask, [main, ...lanes]);
    const fromSquare = ([x, y]) => Math.hypot(x - qx, y - qy);
    const byDistance = d => roadSpots.slice().sort((a, b) => Math.abs(fromSquare(a) - d) - Math.abs(fromSquare(b) - d));

    // Landmarks first, so they get the good spots: the tavern on the square, the smithy and temple a little way off,
    // and a watchtower where the main road leaves the village.
    const tavern = site('tavern', byDistance(0));
    const smithy = site('smithy', byDistance(35 + rng() * 30));
    const temple = n > 30000 && rng() < 0.8 ? site('temple', byDistance(50 + rng() * 40)) : null;
    const toEdge = ([x, y]) => Math.min(x, y, w - 1 - x, h - 1 - y);
    const tower = n > 50000 && rng() < 0.65 ? site('tower', roadSpots.filter(p => toEdge(p) > 12).sort((a, b) => toEdge(a) - toEdge(b))) : null;

    // A windmill out in the open, not far from a road (sited before the houses, which fill what room is left). Only its
    // tower needs clear ground: the sails may turn in front of whatever stands behind.
    if (rng() < 0.75) {
      const fromRoad = Grid.distanceField(w, h, roads);
      for (let tries = 0; tries < 1500; tries++) {
        const scale = tries < 800 ? 1 : 0.75, [half, tall] = LOTS.windmill.map(v => Math.round(v * scale));       // a smaller mill if a full one finds no room
        const x = Math.floor(rng() * w), y = Math.floor(rng() * h), d = fromRoad[y * w + x], body = Math.round(18 * scale);
        if (d < 6 || d > 60 || x - half < 2 || x + half > w - 3 || y - tall < 2 || !free(x - body, y - Math.round(70 * scale), x + body, y + 2)) continue;
        take(x - body - 10, y - Math.round(70 * scale), x + body + 10, y + 4);
        place(g, 'windmill', x, y, scale < 1 ? { scale } : undefined);
        place(g, 'sacks', x + body + 2, y + 3);
        break;
      }
    }

    // Houses beside every road.
    const houses = buildHouses(Math.round(n / 2200));

    // Bits round the houses: barrels and crates by the walls, a planter.
    const yard = ['barrel', 'crate', 'planter', 'haybale', 'barrel', 'log'];
    houses.forEach(([hx, hy]) => {
      for (let k = 0; k < 2; k++) {
        if (rng() < 0.4) continue;
        const x = hx + (rng() < 0.5 ? -1 : 1) * (LOTS.house[0] + 3 + Math.floor(rng() * 3)), y = hy - Math.floor(rng() * 4);
        if (free(x - 2, y - 3, x + 2, y)) { place(g, yard[Math.floor(rng() * yard.length)], x, y); take(x - 3, y - 4, x + 3, y + 1); }
      }
    });

    // Pens with sheep, and hay fields, out in the open.
    for (let tries = 0, made = 0; made < Math.max(1, Math.round(n / 30000)) && tries < 200; tries++) {
      const pw = 33 + Math.floor(rng() * 3) * 11, ph = 22 + Math.floor(rng() * 2) * 11;
      const x0 = Math.floor(rng() * (w - pw - 8)) + 4, y0 = Math.floor(rng() * (h - ph - 8)) + 4;
      if (!free(x0 - 2, y0 - 8, x0 + pw + 2, y0 + ph + 2)) continue;
      take(x0 - 4, y0 - 10, x0 + pw + 4, y0 + ph + 4);
      if (made % 2 === 0) pen(g, x0, y0, pw, ph);
      else hayField(g, x0, y0, pw, ph);
      made++;
    }

    // Woods and flowers away from roads and buildings.
    const near = Grid.distanceField(w, h, Grid.maskWhere(roads, v => v).map((v, i) => v || taken[i] ? 1 : 0));
    const forest = quantile(wood, 0.72), edge = quantile(wood, 0.66), bloom = quantile(spots, 0.1);
    for (let i = 0; i < n; i++) {
      if (map.water[i] || taken[i] || roads[i] || near[i] < 4) continue;
      map.scatter[i] = wood[i] > forest && near[i] > 24 ? SCATTER.FOREST : wood[i] > edge && near[i] > 8 ? SCATTER.BUSHES
        : map.ground[i] === GROUND.GRASS && spots[i] < bloom ? SCATTER.FLOWERS : SCATTER.NONE;
    }

    // Life: a villager by most houses, folk on the square and the right person at each landmark (townsfolk at
    // the tavern, the smith, a monk or elder, a guard); chickens, sheep in the pens, wild animals by the woods;
    // monsters lurking out of town; the hero on the square.
    const R = g.lrng;
    later(g, 'people', () => {
      if (tavern) for (let k = many(g, 'people', 2); k > 0; k--) person(g, tavern[0] + (R() - 0.5) * 20, tavern[1] + 5, 'folk');
      if (smithy) for (let k = many(g, 'people', 1); k > 0; k--) person(g, smithy[0] + (R() - 0.5) * 24, smithy[1] + 6, 'smith');
      if (temple) for (let k = many(g, 'people', 1); k > 0; k--) person(g, temple[0] + (R() - 0.5) * 10, temple[1] + 6, R() < 0.5 ? 'monk' : 'elder');
      if (tower) for (let k = many(g, 'people', 1); k > 0; k--) person(g, tower[0] + 13 + (R() - 0.5) * 6, tower[1] + 5, 'guard');
      houses.forEach(([hx, hy]) => { for (let k = many(g, 'people', 0.6); k > 0; k--) person(g, hx + (R() - 0.5) * 16, hy + 5); });
      for (let k = many(g, 'people', 3); k > 0; k--) { const a = R() * Math.PI * 2; person(g, qx + Math.cos(a) * (qr - 2), qy + 6 + Math.sin(a) * (qr - 4) * 0.7); }
    });
    const toWater = Grid.distanceField(w, h, wetMask), clearOf = ([x, y]) => !taken[y * w + x] && !roads[y * w + x];
    later(g, 'animals', () => {
      houses.forEach(([hx, hy]) => { for (let k = many(g, 'animals', 0.5); k > 0; k--) animal(g, 'chicken', hx + (R() - 0.5) * 30, hy + 4 + R() * 4); });
      g.pens.forEach(([x0, y0, pw, ph]) => { for (let k = many(g, 'animals', 3); k > 0; k--) animal(g, 'sheep', x0 + 6 + R() * (pw - 12), y0 + 8 + R() * (ph - 12)); });
      wildAnimals(g, toWater, river, clearOf, true);
    });
    later(g, 'monsters', () => wildMonsters(g, toWater, ([x, y]) => clearOf([x, y]) && Math.hypot(x - qx, y - qy) > 60));
    later(g, 'hero', () => hero(g, qx, qy + 8));
  }

  // How much room each village building needs: [half its width, its height]. One that finds no room for a full lot is
  // built smaller (SMALL_LOTS: half width, height, the building's scale; under 0.9 a house or tavern has one floor).
  const LOTS = { tavern: [44, 58], temple: [37, 108], smithy: [38, 36], tower: [20, 96], windmill: [37, 96], house: [29, 56] };
  const SMALL_LOTS = {
    tavern: [[38, 47, 0.8], [34, 42, 0.65]], temple: [[31, 89, 0.8], [27, 79, 0.65]], smithy: [[32, 36, 0.8], [31, 36, 0.65]],
    tower: [[16, 84, 0.8], [14, 72, 0.65]], house: [[24, 40, 0.8], [20, 40, 0.65]],
  };
  const lotsFor = type => [[...LOTS[type], 1], ...(SMALL_LOTS[type] || [])];

  // Building lots beside roads (villages, harbor towns): which ground is taken, and helpers that build there.
  // roads: road pixels; wet: ground to keep off (a river and its banks); lines: the roads as polylines.
  // free(x0, y0, x1, y1) / take(...): test and claim a box. spots: [x, y, runs across] along every road.
  // site(type, order): builds type at the first spot in order where it fits; returns its base or null.
  // houses(want): houses at the road spots in turn (skipping a few), up to want; returns their bases.
  function lots(g, roads, wet, lines) {
    const { w, h, n, rng } = g;
    const taken = new Uint8Array(n);
    const free = (x0, y0, x1, y1) => {
      if (x0 < 2 || y0 < 2 || x1 > w - 3 || y1 > h - 3) return false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (roads[i] || taken[i] || wet[i]) return false; }
      return true;
    };
    const take = (x0, y0, x1, y1) => {
      for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) taken[y * w + x] = 1;
    };
    const spots = lines.flatMap(road => {
      const pts = densify(road);
      return pts.slice(2, -2).map(([x, y], k) => [Math.round(x), Math.round(y), Math.abs(pts[k + 4][0] - pts[k][0]) > Math.abs(pts[k + 4][1] - pts[k][1])]);
    });
    const site = (type, order) => {
      for (const [half, tall, scale] of lotsFor(type)) {
        for (const [x, y, flat] of order) {
          for (const [hx, hy] of roadside(g, roads, x, y, flat, half, tall)) {
            if (!free(hx - half, hy - tall, hx + half, hy + 2)) continue;
            take(hx - half - 2, hy - tall - 2, hx + half + 2, hy + 4);
            place(g, type, hx, hy, scale < 1 ? { scale } : undefined);
            return [hx, hy];
          }
        }
      }
      return null;
    };
    // Full-size houses go in first (a few spots also take a smaller one), then smaller houses fill what room is left.
    const houses = want => {
      const out = [], all = lotsFor('house');
      const pass = sizes => {
        for (const [x, y, flat] of spots) {
          for (const side of [0, 1]) {
            if (out.length >= want) return;
            if (rng() < 0.15) continue;
            // A house faces its road: to the front above it, its back to us below it, end on beside a lane (where it is
            // narrower and its roof runs further back).
            const turn = flat ? (side ? 2 : 0) : side ? 3 : 1;
            for (const [wide, high, scale] of sizes()) {
              const half = flat ? wide : Math.min(wide, 23), tall = flat ? high : high + 4;
              const at = roadside(g, roads, x, y, flat, half, tall)[side];
              if (!at || !free(at[0] - half, at[1] - tall, at[0] + half, at[1] + 2)) continue;
              take(at[0] - half - 2, at[1] - tall - 2, at[0] + half + 2, at[1] + 4);
              place(g, 'house', at[0], at[1], { ...(scale < 1 ? { scale } : {}), ...(turn ? { turn } : {}) });
              out.push(at);
              break;
            }
          }
        }
      };
      pass(() => all.slice(0, rng() < 0.7 ? 1 : 2));
      pass(() => all);
      return out;
    };
    return { taken, free, take, spots, site, houses };
  }

  // Where a building (half wide, tall high) can stand beside the road at (x, y): just above and below it when it
  // runs across (fitted to its edge over the building's width), or either side when it runs up and down. Bases, as [x, y].
  function roadside(g, roads, x, y, flat, half, tall) {
    const { w, h } = g;
    let lo = Infinity, hi = -Infinity;
    for (let a = -half; a <= half; a++) {
      for (let b = -25; b <= 25; b++) {
        const [px, py] = flat ? [x + a, y + b] : [x + b, y + a - 2];
        if (px < 0 || py < 0 || px >= w || py >= h || !roads[py * w + px]) continue;
        const v = flat ? py : px;
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    }
    if (lo === Infinity) return [];
    const down = Math.round(tall * 0.4);
    return flat ? [[x, lo - 3], [x, hi + tall + 3]] : [[lo - half - 3, y + down], [hi + half + 3, y + down]];
  }

  // A fenced pen with a gate in the bottom side (its sheep come with the animals).
  function pen(g, x0, y0, pw, ph) {
    (g.pens = g.pens || []).push([x0, y0, pw, ph]);
    for (let x = x0 + 5; x <= x0 + pw - 5; x += 11) {
      place(g, 'fence', x, y0);
      if (Math.abs(x - (x0 + pw / 2)) > 6) place(g, 'fence', x, y0 + ph);
    }
    for (let y = y0 + 11; y <= y0 + ph; y += 11) { place(g, 'fence', x0, y, { turn: 1 }); place(g, 'fence', x0 + pw, y, { turn: 1 }); }
    place(g, 'haybale', x0 + pw - 7, y0 + 7);
  }

  // A patch of bare earth with hay bales.
  function hayField(g, x0, y0, pw, ph) {
    const { map, w, rng } = g;
    for (let y = y0; y <= y0 + ph; y++) for (let x = x0; x <= x0 + pw; x++) if (Random.noise(x, y, 4, 3206) > 0.25) map.ground[y * w + x] = GROUND.DIRT;
    for (let k = 0, count = 3 + Math.floor(rng() * 4); k < count; k++) place(g, 'haybale', x0 + 5 + rng() * (pw - 10), y0 + 6 + rng() * (ph - 8));
  }

  // ---------- Dungeon ----------

  const WALL = 4;   // stone wall thickness round rooms and corridors
  const HALL = 14;  // corridor width: room for a character (8 wide) with space either side
  const GAP = 10;   // doorway width: narrower than the corridor, so a door fits the gap, and wider than a character

  // What a room is for: its floor and how it gets furnished. Big rooms can be halls; the rest pick at random.
  const ROOMS = {
    hall:     { floor: GROUND.FLAGSTONE },
    barracks: { floor: GROUND.WOOD_FLOOR },
    library:  { floor: GROUND.WOOD_FLOOR },
    storage:  { floor: GROUND.COBBLE },
    shrine:   { floor: GROUND.TILE },
    armory:   { floor: GROUND.SLATE },
    treasure: { floor: GROUND.TILE },
    ruin:     { floor: GROUND.GRAVEL },
  };

  // Stone-walled rooms cut into rock, joined by corridors, with doors, furniture and wall torches.
  function dungeon(g) {
    const { map, w, h, n, rng } = g;
    const rooms = placeRooms(g);
    const room = new Uint8Array(n), hall = new Uint8Array(n);
    const fill = (mask, x0, y0, x1, y1) => {
      for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) mask[y * w + x] = 1;
    };
    rooms.forEach(r => fill(room, r.x0, r.y0, r.x1, r.y1));
    links(rooms, rng).forEach(([a, b]) => {
      const [ax, ay] = centre(a), [bx, by] = centre(b), half = HALL / 2;
      const [cx, cy] = rng() < 0.5 ? [bx, ay] : [ax, by];   // the corner of the L
      fill(hall, Math.min(ax, cx) - half, Math.min(ay, cy) - half, Math.max(ax, cx) + half - 1, Math.max(ay, cy) + half - 1);
      fill(hall, Math.min(cx, bx) - half, Math.min(cy, by) - half, Math.max(cx, bx) + half - 1, Math.max(cy, by) + half - 1);
    });

    // Floors, then a stone wall round every floor, then rock.
    const floor = new Uint8Array(n);
    for (let i = 0; i < n; i++) floor[i] = room[i] | hall[i];
    const toFloor = Grid.distanceField(w, h, floor);
    for (let i = 0; i < n; i++) map.ground[i] = floor[i] ? GROUND.FLAGSTONE : toFloor[i] <= WALL ? GROUND.STONE_WALL : GROUND.ROCK;
    rooms.forEach(r => {
      const big = r.x1 - r.x0 > 40 && r.y1 - r.y0 > 28;
      const kinds = Object.keys(ROOMS).filter(t => t !== 'hall');
      r.kind = big && rng() < 0.6 ? 'hall' : kinds[Math.floor(rng() * kinds.length)];
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) map.ground[y * w + x] = ROOMS[r.kind].floor;
      r.doors = doorways(g, r, room, hall);
    });
    rooms.forEach(r => furnish(g, r));
    // The hero starts in the room nearest an edge, which no monster shares.
    const start = rooms.reduce((a, r) => edgeGap(g, r) < edgeGap(g, a) ? r : a, rooms[0]);
    later(g, 'monsters', () => populate(g, rooms, hall, room, g.L.hero ? start : null));
    later(g, 'hero', () => { const [x, y] = centre(start); hero(g, x, y + 4); });

    // Rubble here and there along the corridors.
    for (let tries = 0, placed = 0; placed < n / 9000 && tries < 300; tries++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h), i = y * w + x;
      if (!hall[i] || room[i] || map.ground[i] !== GROUND.FLAGSTONE) continue;
      place(g, rng() < 0.5 ? 'rubble' : 'rock', x, y);
      placed++;
    }
  }

  // Rectangles that don't touch, with room for walls and a corridor between them.
  function placeRooms(g) {
    const { w, h, n, rng } = g;
    // Rooms are sized for the furniture: a bed is 13 by 22, a long table 33 by 14.
    const rooms = [], want = Math.max(3, Math.round(n / 9000)), pad = WALL * 2 + HALL, edge = WALL + 4;
    const maxW = Math.max(34, Math.min(104, w * 0.42)), maxH = Math.max(30, Math.min(78, h * 0.42));
    for (let tries = 0; rooms.length < want && tries < want * 100; tries++) {
      const rw = 28 + Math.floor(rng() * (maxW - 28)), rh = 26 + Math.floor(rng() * (maxH - 26));
      const x0 = edge + Math.floor(rng() * (w - rw - 2 * edge)), y0 = edge + Math.floor(rng() * (h - rh - 2 * edge));
      const r = { x0, y0, x1: x0 + rw - 1, y1: y0 + rh - 1 };
      if (x0 < edge || y0 < edge || r.x1 >= w - edge || r.y1 >= h - edge) continue;
      if (rooms.some(o => r.x0 - pad <= o.x1 && o.x0 - pad <= r.x1 && r.y0 - pad <= o.y1 && o.y0 - pad <= r.y1)) continue;
      rooms.push(r);
    }
    return rooms;
  }

  function centre(r) { return [(r.x0 + r.x1) >> 1, (r.y0 + r.y1) >> 1]; }

  // Which rooms get a corridor: the shortest tree that reaches them all, plus a few loops.
  function links(rooms, rng) {
    const dist = (a, b) => Math.hypot(centre(a)[0] - centre(b)[0], centre(a)[1] - centre(b)[1]);
    const joined = new Set([0]), out = [];
    while (joined.size < rooms.length) {
      let best = null;
      for (const i of joined) {
        for (let j = 0; j < rooms.length; j++) {
          if (!joined.has(j) && (!best || dist(rooms[i], rooms[j]) < best.d)) best = { i, j, d: dist(rooms[i], rooms[j]) };
        }
      }
      joined.add(best.j);
      out.push([rooms[best.i], rooms[best.j]]);
    }
    for (let k = 0; k < rooms.length / 4; k++) {
      const a = rooms[Math.floor(rng() * rooms.length)];
      const b = rooms.filter(r => r !== a && !out.some(([p, q]) => (p === a && q === r) || (p === r && q === a)))
        .sort((p, q) => dist(a, p) - dist(a, q))[0];
      if (b && dist(a, b) < 120) out.push([a, b]);
    }
    return out;
  }

  // Where corridors cross a room's wall: narrows each crossing to a doorway and hangs a door in most.
  // Returns the doorways as [x, y] (in the wall's middle).
  function doorways(g, r, room, hall) {
    const { map, w, h, rng } = g;
    const sides = [
      [r.x1 - r.x0 + 1, (t, d) => [r.x0 + t, r.y0 - 1 - d], true],
      [r.x1 - r.x0 + 1, (t, d) => [r.x0 + t, r.y1 + 1 + d], true],
      [r.y1 - r.y0 + 1, (t, d) => [r.x0 - 1 - d, r.y0 + t], false],
      [r.y1 - r.y0 + 1, (t, d) => [r.x1 + 1 + d, r.y0 + t], false],
    ];
    const out = [];
    for (const [len, at] of sides) {
      const open = t => {
        for (let d = 0; d < WALL; d++) {
          const [x, y] = at(t, d);
          if (x < 0 || y < 0 || x >= w || y >= h || !hall[y * w + x] || room[y * w + x]) return false;
        }
        return true;
      };
      for (let t = 0; t < len; t++) {
        if (!open(t)) continue;
        let end = t;
        while (end + 1 < len && open(end + 1)) end++;
        const mid = (t + end + 1) >> 1, g0 = mid - GAP / 2, g1 = mid + GAP / 2 - 1;
        for (let k = t; k <= end; k++) {
          if (k >= g0 && k <= g1) continue;
          for (let d = 0; d < WALL; d++) { const [x, y] = at(k, d); map.ground[y * w + x] = GROUND.STONE_WALL; }
        }
        const spot = at(mid, 1);
        out.push(spot);
        if (rng() < 0.65) place(g, 'door', spot[0], spot[1]);
        t = end;
      }
    }
    return out;
  }

  // Furniture by room kind, kept clear of doorways; torches on the back wall.
  function furnish(g, r) {
    const { rng } = g;
    const W = r.x1 - r.x0 + 1, H = r.y1 - r.y0 + 1, [cx, cy] = centre(r);
    const taken = r.taken = [];
    const put = (type, x, y, room = 4) => {
      x = Math.round(x); y = Math.round(y);
      if (x < r.x0 + 2 || x > r.x1 - 2 || y < r.y0 + 1 || y > r.y1) return false;
      if (r.doors.some(([dx, dy]) => Math.hypot(dx - x, dy - y) < 14)) return false;
      if (taken.some(([tx, ty, tr]) => Math.abs(tx - x) < tr + room && Math.abs(ty - y) < Math.max(tr, room))) return false;
      taken.push([x, y, room]);
      place(g, type, x, y);
      return true;
    };
    const along = (type, y, step, room) => { for (let x = r.x0 + step / 2; x <= r.x1 - step / 2; x += step) put(type, x, y, room); };
    const corners = (types, count) => {
      const spots = [[r.x0 + 6, r.y0 + 10], [r.x1 - 6, r.y0 + 10], [r.x0 + 6, r.y1 - 1], [r.x1 - 6, r.y1 - 1]];
      for (let k = 0; k < count; k++) {
        const [x, y] = spots[Math.floor(rng() * spots.length)];
        put(types[Math.floor(rng() * types.length)], x + (rng() - 0.5) * 14, y - rng() * 6, 5);
      }
    };

    // Torches first, so nothing else stands on them.
    for (const f of W > 48 ? [0.25, 0.75] : [0.5]) {
      const x = Math.round(r.x0 + W * f);
      if (!r.doors.some(([dx]) => Math.abs(dx - x) < 10)) place(g, 'sconce', x, r.y0 - 1);
    }
    switch (r.kind) {
      case 'hall':
        put('longtable', cx, cy + 6, 10);
        put('bench', cx, cy - 10, 8);
        put('bench', cx, cy + 16, 8);
        for (const y of [r.y0 + 22, r.y1 - 2]) { put('pillar', r.x0 + 8, y, 5); put('pillar', r.x1 - 8, y, 5); }
        put('brazier', r.x0 + 9, cy + 6, 5);
        put('brazier', r.x1 - 9, cy + 6, 5);
        break;
      case 'barracks':
        along('bed', r.y0 + 24, 17, 8);
        for (let x = r.x0 + 9; x < r.x1 - 5; x += 17) if (rng() < 0.6) put('chest', x, r.y0 + 34, 5);
        if (H > 52) { put('table', cx, r.y1 - 4, 10); put('stool', cx - 14, r.y1 - 3, 4); }
        break;
      case 'library':
        along('bookshelf', r.y0 + 10, 20, 9);
        put('table', cx, cy + 10, 10);
        put('stool', cx + 14, cy + 10, 4);
        if (H > 46) along('bookshelf', r.y1 - 2, 40, 9);
        break;
      case 'storage':
        corners(['barrel', 'barrel', 'crate', 'crate', 'sacks'], Math.round(W * H / 220));
        break;
      case 'shrine':
        put('altar', cx, r.y0 + 14, 9);
        put('candles', cx - 13, r.y0 + 14, 2);
        put('candles', cx + 13, r.y0 + 14, 2);
        put('roundrug', cx, cy + 12, 10);
        put('statue', r.x0 + 6, r.y0 + 26, 5);
        put('statue', r.x1 - 6, r.y0 + 26, 5);
        break;
      case 'armory':
        along('weaponrack', r.y0 + 8, 20, 9);
        put('anvil', cx, cy + 8, 6);
        put('brazier', cx + 16, cy + 8, 5);
        corners(['barrel', 'crate'], 2);
        break;
      case 'treasure':
        put('chest', cx, cy, 6);
        put('chest', cx - 14, cy + 7, 6);
        put('chest', cx + 14, cy + 7, 6);
        put('statue', r.x0 + 6, r.y0 + 26, 5);
        put('statue', r.x1 - 6, r.y0 + 26, 5);
        break;
      case 'ruin':
        for (let k = 0; k < W * H / 300; k++) put(rng() < 0.5 ? 'rubble' : rng() < 0.6 ? 'rock' : 'mushrooms', r.x0 + rng() * W, r.y0 + 6 + rng() * (H - 6), 5);
        put('bedroll', cx, cy, 9);
        break;
    }
  }

  // Who lives in a dungeon (undead, a goblin warren, or a mix), and who you meet in each kind of room.
  const DWELLERS = {
    undead:  { hall: ['skeleton', 'skeleton', 'cultist'], barracks: ['skeleton'], library: ['cultist', 'skeleton'], storage: ['slime', 'skeleton'],
      shrine: ['cultist'], armory: ['skeleton'], treasure: ['skeleton'], ruin: ['slime', 'skeleton'] },
    goblins: { hall: ['goblin'], barracks: ['goblin'], library: ['goblin', 'cultist'], storage: ['goblin', 'slime'],
      shrine: ['cultist', 'goblin'], armory: ['goblin'], treasure: ['goblin', 'slime'], ruin: ['slime'] },
    mixed:   { hall: ['goblin', 'skeleton'], barracks: ['goblin', 'skeleton'], library: ['cultist'], storage: ['slime', 'goblin'],
      shrine: ['cultist'], armory: ['skeleton', 'goblin'], treasure: ['skeleton', 'slime'], ruin: ['slime'] },
  };
  const CROWD = { hall: [2, 4], barracks: [2, 3], library: [1, 1], storage: [1, 2], shrine: [2, 3], armory: [1, 2], treasure: [1, 2], ruin: [1, 3] };

  // How far a room is from the map's nearest edge.
  function edgeGap(g, r) { return Math.min(r.x0, r.y0, g.w - 1 - r.x1, g.h - 1 - r.y1); }

  // Monsters in most rooms (not in skip), clear of furniture and doorways, and a few more out in the corridors.
  // Who lives here (undead, goblins, a mix) picks the kinds; kinds turned off in the options give way to the others.
  function populate(g, rooms, hall, room, skip) {
    const { w, h, n } = g, rng = g.lrng;
    const who = DWELLERS[pick(rng, Object.keys(DWELLERS))];
    const placed = [];
    const clear = (x, y, r) => !placed.some(([px, py]) => Math.hypot(px - x, py - y) < 10)
      && (!r || (!r.doors.some(([dx, dy]) => Math.hypot(dx - x, dy - y) < 12) && !r.taken.some(([tx, ty, tr]) => Math.abs(tx - x) < tr + 3 && Math.abs(ty - y) < tr + 3)));
    for (const r of rooms) {
      if (r === skip || rng() < 0.3) continue;
      const [lo, hi] = CROWD[r.kind];
      for (let k = many(g, 'monsters', (lo + hi) / 2); k > 0; k--) {
        for (let tries = 0; tries < 30; tries++) {
          const x = Math.round(r.x0 + 3 + rng() * (r.x1 - r.x0 - 6)), y = Math.round(r.y0 + 8 + rng() * (r.y1 - r.y0 - 9));
          if (!clear(x, y, r)) continue;
          monster(g, who[r.kind], x, y);
          placed.push([x, y]);
          break;
        }
      }
    }
    const roamers = [...new Set(Object.values(who).flat())];
    for (let tries = 0, made = 0, want = many(g, 'monsters', Math.max(1, n / 25000)); made < want && tries < 400; tries++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h), i = y * w + x;
      if (!hall[i] || room[i] || !hall[i + 2] || !hall[i - 2] || !clear(x, y)) continue;
      monster(g, roamers, x, y);
      placed.push([x, y]);
      made++;
    }
  }

  // ---------- Life ----------
  // People, monsters, animals and the hero go on last, from their own random numbers, so turning them on or off (or
  // changing how many) never changes the land. Each biome leaves what to do in g.later, by group.

  const ROLES = ['folk', 'farmer', 'child', 'baker', 'smith', 'merchant', 'elder', 'guard', 'monk'];
  const MONSTERS = ['skeleton', 'goblin', 'slime', 'cultist'];
  const ANIMALS = ['sheep', 'chicken', 'deer', 'rabbit', 'duck'];

  // Where each group turns up, per biome (null: nowhere there). _ is every other biome.
  const WHERE = {
    people: { village: 'By their houses, on the square, and at the tavern, smithy, temple and tower.', cave: null, dungeon: null,
      _: 'Round the camp, and travelers on the path.' },
    monsters: { dungeon: 'In the rooms, by room kind, and some in the corridors.', cave: 'Goblins round the camp, slimes by the pools, a few more in the dark.',
      village: 'Out in the fields and woods, away from the houses.', _: 'Out in the wilds, away from the camp. Slimes keep near water.' },
    animals: { village: 'Chickens by the houses, sheep in the pens, ducks on the water, deer and rabbits by the woods.', cave: null, dungeon: null,
      _: 'Deer and rabbits in the open, ducks on the water, a flock of sheep on the grass, chickens at the camp.' },
    hero: { village: 'On the square.', dungeon: 'In the room nearest the edge, with no monsters in it.', _: 'At the camp.' },
  };
  function where(group, biome) {
    const own = BIOMES[biome] && BIOMES[biome].where, t = WHERE[group];
    return own && group in own ? own[group] : biome in t ? t[biome] : t._;
  }

  // Fills in the options for who goes on the map: { people, monsters, animals: { on, amount, kinds, move }, hero }.
  // Everything is off unless turned on. amount: 1 is the usual number. move: 'wander', 'still', or for monsters
  // 'patrol' (wander, and some patrol; the default).
  function lifeOptions(life = {}) {
    const group = (o, all, move) => {
      if (!o || !o.on) return null;
      const kinds = (o.kinds || all).filter(k => all.includes(k));
      return kinds.length ? { amount: Math.max(0, o.amount ?? 1), kinds, move: o.move || move } : null;
    };
    return { people: group(life.people, ROLES, 'wander'), monsters: group(life.monsters, MONSTERS, 'patrol'),
      animals: group(life.animals, ANIMALS, 'wander'), hero: !!life.hero };
  }

  // Queues fn to run at the end if group is turned on.
  function later(g, group, fn) { g.later.push([group, fn]); }

  // How many of something: mean times the group's amount, rounded up or down at random.
  function many(g, group, mean) {
    const m = mean * g.L[group].amount, f = Math.floor(m);
    return f + (g.lrng() < m - f ? 1 : 0);
  }

  // A villager at (x, y): of that role when it's turned on, else of a role that is. extra: more fields
  // ({ patrol: 1 } for a guard walking the walls, { still: 1 } for one on watch).
  function person(g, x, y, role, extra) {
    const P = g.L.people;
    if (!P.kinds.includes(role)) role = pick(g.lrng, P.kinds);
    place(g, 'villager', x, y, { seed: seedAs(g, role), ...(P.move === 'still' ? { still: 1 } : {}), ...extra }, g.lrng);
  }

  // A monster of one of kinds (those turned on; any that is, if none of them are). extra: more fields, only when it
  // is one of kinds ({ rise: 1 } for a skeleton that climbs out of its grave after dark).
  function monster(g, kinds, x, y, extra) {
    const M = g.L.monsters, ok = kinds.filter(k => M.kinds.includes(k));
    const how = M.move === 'still' ? { still: 1 } : M.move === 'wander' ? { patrol: 0 } : {};
    const type = pick(g.lrng, ok.length ? ok : M.kinds);
    place(g, type, x, y, { ...how, ...(kinds.includes(type) ? extra : {}) }, g.lrng);
  }

  // An animal, if its kind is turned on.
  function animal(g, type, x, y) {
    const A = g.L.animals;
    if (A.kinds.includes(type)) place(g, type, x, y, A.move === 'still' ? { still: 1 } : {}, g.lrng);
  }

  // The first hand-made character (the elf wizard) at (x, y).
  function hero(g, x, y) {
    const type = (Types.OBJECT_GROUPS.Characters || []).find(k => !CharacterArt.isGenerated(k));
    if (type) place(g, type, x, y, {}, g.lrng);
  }

  // Calls put(x, y) at up to count random pixels where ok(x, y).
  function spread(g, count, ok, put) {
    const { w, h } = g;
    for (let tries = 0, made = 0; made < count && tries < count * 200; tries++) {
      const x = 4 + Math.floor(g.lrng() * (w - 8)), y = 6 + Math.floor(g.lrng() * (h - 10));
      if (ok(x, y)) { put(x, y); made++; }
    }
  }

  // Open dry ground: no water, path, wall, tree or rock scatter.
  function openGround(g, x, y) {
    const i = y * g.w + x, m = g.map, sc = m.scatter[i];
    return !m.water[i] && !Types.isPath(m.ground[i]) && !Types.isWall(m.ground[i]) && sc !== SCATTER.FOREST && sc !== SCATTER.PINES && sc !== SCATTER.ROCKY;
  }

  // Deer and rabbits on open ground, a flock of sheep on the grass, ducks on lakes and the river. ok([x, y]): allowed
  // there. penned: the sheep are in pens already.
  function wildAnimals(g, toWater, river, ok, penned) {
    const { n, map, w } = g, R = g.lrng;
    const land = (x, y) => openGround(g, x, y) && ok([x, y]);
    const herd = (type, groups, size, test) => spread(g, groups, test, (x, y) => {
      for (let k = 0, c = 1 + Math.floor(R() * size); k < c; k++) animal(g, type, x + (R() - 0.5) * 10, y + (R() - 0.5) * 6);
    });
    herd('deer', many(g, 'animals', n / 45000), 3, land);
    herd('rabbit', many(g, 'animals', n / 30000), 2, land);
    if (!penned) herd('sheep', many(g, 'animals', n / 70000), 5, (x, y) => land(x, y) && map.ground[y * w + x] === GROUND.GRASS);
    herd('duck', many(g, 'animals', n / 50000), 3, (x, y) => map.water[y * w + x] && toWater && toWater[y * w + x] === 0 && near(map, w, x, y, 4));
    if (river) {
      const along = densify(river);
      for (let k = many(g, 'animals', 1 + n / 120000); k > 0; k--) { const [x, y] = along[Math.floor(R() * along.length)]; animal(g, 'duck', x, y); }
    }
  }

  // True if dry land is within r of water pixel (x, y).
  function near(map, w, x, y, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = (y + dy) * w + x + dx; if (i >= 0 && i < map.water.length && !map.water[i]) return true; }
    return false;
  }

  // Monsters out in the wilds: goblins in bands, slimes near water, skeletons and cultists alone. ok([x, y]):
  // allowed there.
  function wildMonsters(g, toWater, ok) {
    const R = g.lrng, wet = toWater && toWater.some(v => v === 0);
    const land = (x, y) => openGround(g, x, y) && ok([x, y]);
    for (let k = many(g, 'monsters', Math.max(1, g.n / 25000)); k > 0; k--) {
      const kind = pick(R, g.L.monsters.kinds);
      const test = kind === 'slime' && wet ? (x, y) => land(x, y) && toWater[y * g.w + x] < 14 : land;
      spread(g, 1, test, (x, y) => {
        const band = kind === 'goblin' ? 1 + Math.floor(R() * 3) : 1;
        for (let b = 0; b < band; b++) monster(g, [kind], x + (R() - 0.5) * 12 * (b > 0), y + (R() - 0.5) * 8 * (b > 0));
      });
    }
  }

  // ---------- Helpers ----------

  function pick(rng, list) { return list[Math.floor(rng() * list.length)]; }

  // Runs fn(i, x, y) for every pixel.
  function forEach(g, fn) {
    for (let y = 0, i = 0; y < g.h; y++) for (let x = 0; x < g.w; x++, i++) fn(i, x, y);
  }

  // Sets the scatter layer on dry land from pick(i).
  function landEach(g, pick) {
    for (let i = 0; i < g.n; i++) if (!g.map.water[i]) g.map.scatter[i] = pick(i);
  }

  // Noise over the whole map, one value per pixel.
  function field(g, size, salt) {
    const f = new Float32Array(g.n);
    forEach(g, (i, x, y) => { f[i] = Random.noise(x, y, size, salt); });
    return f;
  }

  // Value below which a fraction p of the field lies (from a sample of its pixels).
  function quantile(f, p) {
    const sample = [];
    for (let i = 0; i < f.length; i += 7) sample.push(f[i]);
    sample.sort((a, b) => a - b);
    return sample[Math.min(sample.length - 1, Math.floor(p * sample.length))];
  }

  // 0 on the map's edge, 1 halfway to the middle of its short side.
  function edge(g, x, y) { return Math.min(x, y, g.w - 1 - x, g.h - 1 - y) / (g.size / 4); }

  // Connected regions of a mask (4 neighbors): a label per pixel (0 outside) and each label's size.
  function regions(g, mask) {
    const { w, n } = g;
    const label = new Int32Array(n), sizes = [0];
    for (let s = 0; s < n; s++) {
      if (!mask[s] || label[s]) continue;
      const id = sizes.length, stack = [s];
      let count = 0;
      label[s] = id;
      while (stack.length) {
        const i = stack.pop(), x = i % w;
        count++;
        if (x > 0 && mask[i - 1] && !label[i - 1]) { label[i - 1] = id; stack.push(i - 1); }
        if (x < w - 1 && mask[i + 1] && !label[i + 1]) { label[i + 1] = id; stack.push(i + 1); }
        if (i >= w && mask[i - w] && !label[i - w]) { label[i - w] = id; stack.push(i - w); }
        if (i + w < n && mask[i + w] && !label[i + w]) { label[i + w] = id; stack.push(i + w); }
      }
      sizes.push(count);
    }
    return { label, sizes };
  }

  // The mask without its regions smaller than min pixels.
  function dropSmall(g, mask, min) {
    const { label, sizes } = regions(g, mask);
    const out = new Uint8Array(g.n);
    for (let i = 0; i < g.n; i++) out[i] = label[i] && sizes[label[i]] >= min ? 1 : 0;
    return out;
  }

  // A point every 4 pixels or so along a polyline.
  function densify(pts) {
    const out = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
      for (let s = 0; s < steps; s++) out.push([x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // Adds one object with its own look. extra: more fields, like { turn: 1 }. rng: where its seed comes from (the
  // life pass uses its own).
  function place(g, type, x, y, extra, rng = g.rng) {
    if (!type) return;
    x = Math.max(2, Math.min(g.w - 3, Math.round(x))); y = Math.max(2, Math.min(g.h - 3, Math.round(y)));
    g.map.objects.push({ id: MapModel.nextId(g.map), type, x, y, seed: seedFrom(rng), scale: 1, ...extra });
  }

  // A seed for a villager of a role (smith, guard, monk…), so the right person stands by the right building.
  function seedAs(g, role) {
    let seed = seedFrom(g.lrng);
    for (let k = 0; k < 300 && Villagers.roleOf(seed) !== role; k++) seed = seedFrom(g.lrng);
    return seed;
  }

  function seedFrom(rng) { return Math.floor(rng() * 2147483646) + 1; }

  // Swaps in a season's colors (as the Season buttons do).
  function applySeason(s, name) {
    const season = Colors.SEASONS[name];
    s.season = name;
    s.snow = season.snow;
    Object.assign(s.colors, season.colors);
  }

  // Adds a biome (see BIOMES) made by its own make(g). where: what Who's on the map says for each group (null: none).
  function addBiome(key, biome) { BIOMES[key] = biome; }

  // The building blocks, for biomes made elsewhere (places.js).
  const kit = {
    LOTS, lotsFor, place, field, quantile, forEach, landEach, regions, dropSmall, densify, line, addRiver, edge, smooth, lots, roadside,
    later, many, person, monster, animal, hero, spread, openGround, wildAnimals, wildMonsters, pick, seedFrom, applySeason,
  };

  return { BIOMES, ROLES, MONSTERS, ANIMALS, where, landscape, addBiome, kit };
})();
