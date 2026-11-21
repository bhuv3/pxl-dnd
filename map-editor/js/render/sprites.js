// Pixel sprite generators: tufts, flowers, reeds, lily pads, trees, pines, bushes, rocks, forest floor, buildings, tents.
const Sprites = (() => {
  let S = null, P = null, L = { x: -0.7, y: -0.7 };
  let cache = new Map();
  let signature = '';
  const EDGE_ROUGHNESS = 0.5;
  const PINE_LAYERS = 4;
  const ROCK_ROUGHNESS = 0.35;
  const ROCK_BEVEL = 2;
  const ROCK_MOSS = 0.3;

  // ---------- Small animated details ----------

  // Grass tuft: a tall center blade and two leaning side blades over a shadow line.
  function drawTuft(put, t, sway, pal) {
    for (let k = -2; k <= 2; k++) put(t.x + k, t.y + 1, pal.tuftShadow, true);
    const blades = [
      { dx: 0, h: 3 + Math.floor(t.r1 * 3), lean: 0, center: true },
      { dx: -1, h: 2 + Math.floor(t.r2 * 2), lean: -2 },
      { dx: 1, h: 2 + Math.floor(t.r3 * 2), lean: 2 },
    ];
    if (t.r4 < 0.4) blades.push({ dx: 0, h: 2, lean: -1 });
    for (const b of blades) {
      for (let i = 0; i < b.h; i++) {
        const f = b.h > 1 ? i / (b.h - 1) : 1;
        const upper = f > 0.36;
        const c = b.center ? (upper ? pal.bladeTip : pal.bladeMid) : (upper ? pal.bladeMid : pal.bladeRoot);
        put(t.x + b.dx + Math.round((b.lean + sway) * f * f), t.y - i, c, true);
      }
    }
  }

  // Wild flower: a short stem with one colored pixel on top.
  function drawFlower(put, f, sway, pal) {
    const color = [pal.flower1, pal.flower2, pal.flower3][f.color];
    put(f.x, f.y, pal.bladeRoot, true);
    if (f.tall) put(f.x + Math.round(sway * 0.3), f.y - 1, pal.bladeMid, true);
    put(f.x + Math.round(sway * 0.6), f.y - (f.tall ? 2 : 1), color, true);
  }

  // Reeds: two or three tall stalks, some with a brown cattail on top.
  function drawReed(put, t, sway, pal) {
    const stalks = t.r3 < 0.5 ? [-1, 1] : [-1, 0, 1];
    stalks.forEach((dx, n) => {
      const h = Math.max(2, 6 - Math.floor(((t.r1 * 7 + n * 3.3) % 1) * 3) - (dx === 0 ? 0 : 1));
      let topX = t.x;
      for (let i = 0; i < h; i++) {
        const f = i / (h - 1);
        topX = t.x + dx + Math.round((dx * 0.6 + sway * 0.6) * f * f);
        put(topX, t.y - i, f < 0.4 ? pal.reedDark : pal.reedLight);
      }
      if (dx === 0 && t.r2 < 0.5) {
        put(topX, t.y - h, pal.reedTop);
        put(topX, t.y - h - 1, pal.reedTop);
      }
    });
  }

  // Lily pad: a small leaf with a notch, a darker underside, and maybe a flower.
  function drawLily(put, l, pal) {
    put(l.x - 1, l.y - 1, pal.lily); put(l.x, l.y - 1, pal.lily);
    put(l.x - 1, l.y, pal.lily); put(l.x, l.y, pal.lily); put(l.x + 1, l.y, pal.lily);
    put(l.x - 1, l.y + 1, pal.lilyDark); put(l.x, l.y + 1, pal.lilyDark); put(l.x + 1, l.y + 1, pal.lilyDark);
    if (l.flower) put(l.x, l.y - 1, pal.lilyFlower);
  }

  // Flat stepping stone: a light top with a dark edge below it.
  function drawStone(put, st, pal) {
    put(st.x, st.y, pal.pebbleLight); put(st.x + 1, st.y, pal.pebbleLight);
    put(st.x, st.y + 1, pal.pebbleDark); put(st.x + 1, st.y + 1, pal.pebbleDark);
  }

  // Draws a cached sprite with wind sway. Higher pixels (w near 1) move the most.
  function drawSprite(put, sprite, x, y, sway) {
    for (const p of sprite.px) put(x + p.x + Math.round(sway * p.w), y + p.y, p.c);
  }

  // ---------- Object sprites ----------

  // Sets the settings and palette used to build sprites. Clears the cache if they changed.
  function configure(s, pal, seed) {
    S = s; P = pal;
    const a = s.lightAngle * Math.PI / 180;
    L = { x: Math.cos(a), y: -Math.sin(a) };
    const sig = JSON.stringify([seed, s.treeSize, s.sizeVariation, s.treeBlobs, s.leafTexture, s.pineSize, s.bushSize,
      s.rockSize, s.fruitChance, s.lightAngle, s.shading, s.outline, s.dither, s.snow, s.colors]);
    if (sig !== signature) { cache = new Map(); signature = sig; }
  }

  // Sprite for an object type and seed (turned a quarter when turn is 1 and the type can turn), built once and cached.
  function get(type, seed, scale, turn) {
    if (CharacterArt.has(type)) return CharacterArt.ghost(type, seed);
    if (Animals.has(type)) return Animals.ghost(type);
    if (type === 'door') return Doors.icon(P);
    turn = (turn || 0) % Props.turns(type);
    const k = type + ':' + seed + ':' + scale + ':' + turn;
    let sprite = cache.get(k);
    if (!sprite) { sprite = build(type, seed, scale, turn); cache.set(k, sprite); }
    return sprite;
  }

  // How much bigger than its size setting each natural thing is drawn, so it stands at the characters' scale like the
  // buildings (a tree is twice a person's height, a boulder comes to the waist). Forest spacing grows with it (Details).
  const GROW = { tree: 2.2, pine: 2.2, palm: 2, bush: 1.6, rock: 1.6, pebble: 1.3, log: 1.7, stump: 1.4, mushrooms: 1.5, ring: 1.6, tent: 2, campfire: 1.7 };

  // Builds a sprite: pixel list relative to its base, plus shadow size and bounds.
  // Optional: anchors (windows, chimney, fire, light, lights, ring), sails, beam (a lighthouse's), bob (floats), still (see build), footprint depth (blocks a box), blocks (pixels to keep clear),
  // flat (lies on the ground: drawn under everything else).
  function build(type, seed, scale, turn) {
    const rng = Random.makeRng(seed);
    const vary = 1 + (rng() - 0.5) * 2 * S.sizeVariation;
    scale *= GROW[type] || 1;
    let sprite;
    if (type === 'tree') sprite = makeRoundTree(rng, Math.max(3, Math.round(S.treeSize * scale * vary)));
    else if (type === 'pine') sprite = makePine(rng, Math.max(3, Math.round(S.pineSize * scale * vary)));
    else if (type === 'palm') sprite = makePalm(rng, scale * vary);
    else if (type === 'bush') sprite = makeBush(rng, Math.max(2, Math.round(S.bushSize * scale * vary)));
    else if (type === 'pebble') sprite = makeRock(rng, Math.max(1.2, 1.8 * scale * vary), true);
    else if (type === 'log') sprite = makeLog(rng, scale * vary);
    else if (type === 'stump') sprite = makeStump(rng, scale * vary);
    else if (type === 'mushrooms') sprite = makeMushrooms(rng, scale);
    else if (type === 'ring') sprite = makeRing(rng, scale * vary);
    else if (type === 'house') sprite = Houses.build(rng, scale, S, P, L, { facing: Houses.FACINGS[turn] });
    else if (type === 'cabin') sprite = Houses.build(rng, scale, S, P, L, { styles: ['log'], facing: Houses.FACINGS[turn] });        // a cabin is a log house
    else if (Landmarks.has(type)) sprite = Landmarks.build(type, rng, scale, S, P, L);
    else if (Structures.has(type)) sprite = Structures.build(type, rng, scale, S, P, L, turn);
    else if (type === 'tent') sprite = makeTent(rng, scale);
    else if (type === 'campfire') sprite = makeCampfire(rng, scale);
    else if (Props.has(type)) sprite = Props.build(type, rng, scale, P, turn);
    else sprite = makeRock(rng, Math.max(1.5, S.rockSize * scale * vary), false);
    // still: every pixel of a sprite with moving parts (windmill sails) as they stand at rest, for the ghost and hits.
    const all = sprite.still || sprite.px;
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const p of all) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    sprite.box = { minX, maxX, minY, maxY };
    sprite.hit = new Set(all.map(p => p.x + ',' + p.y));
    return sprite;
  }

  // Sprite as a small canvas, used for the stamp ghost.
  function toCanvas(sprite) {
    if (sprite.canvas) return sprite.canvas;
    const { minX, maxX, minY, maxY } = sprite.box;
    const c = document.createElement('canvas');
    c.width = maxX - minX + 1;
    c.height = maxY - minY + 1;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (const p of sprite.still || sprite.px) {
      const i = ((p.y - minY) * c.width + (p.x - minX)) * 4;
      img.data[i] = p.c[0]; img.data[i + 1] = p.c[1]; img.data[i + 2] = p.c[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    sprite.canvas = c;
    return c;
  }

  // ---------- Shading helpers ----------

  const key = (x, y) => x + ',' + y;

  // Brightness → one of a few colors. Dithering nudges every other pixel so bands blend.
  function pickShade(s, x, y, ramp, thresholds) {
    if (S.dither) s += ((x + y) & 1) ? 0.04 : -0.04;
    let i = 0;
    while (i < thresholds.length && s >= thresholds[i]) i++;
    return ramp[i];
  }

  // Marks cells that touch the outside of their shape.
  function markEdges(cells) {
    for (const c of cells.values()) {
      c.edge = !cells.has(key(c.x + 1, c.y)) || !cells.has(key(c.x - 1, c.y)) ||
               !cells.has(key(c.x, c.y + 1)) || !cells.has(key(c.x, c.y - 1));
    }
  }

  // ---------- Round trees and bushes ----------

  // Canopy made of overlapping balls, each lit from the light direction. clumps: the balls to use (a tree's crown);
  // without them, one big ball with smaller ones over it (a bush).
  function makeCanopy(rng, R, centerY, spreadX, spreadY, clipBottom, clumps) {
    const blobs = clumps || [{ x: 0, y: centerY, r: R }];
    for (let i = 0; !clumps && i < S.treeBlobs; i++) {
      const a = rng() * Math.PI * 2, d = R * (0.35 + rng() * 0.4);
      blobs.push({ x: Math.cos(a) * d * spreadX, y: centerY + Math.sin(a) * d * spreadY, r: R * (0.45 + rng() * 0.25) });
    }
    const ox = Math.floor(rng() * 1000), oy = Math.floor(rng() * 1000);
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const b of blobs) {
      minX = Math.min(minX, Math.floor(b.x - b.r - 2)); maxX = Math.max(maxX, Math.ceil(b.x + b.r + 2));
      minY = Math.min(minY, Math.floor(b.y - b.r - 2)); maxY = Math.max(maxY, Math.ceil(b.y + b.r + 2));
    }
    const cells = new Map();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (clipBottom && y > 0) continue;
        const wobble = (Random.valueNoise((x + ox) / 2, (y + oy) / 2, 901) - 0.5) * EDGE_ROUGHNESS * 3;
        let best = 0, nx = 0, ny = 0;
        for (const b of blobs) {
          const dx = x - b.x, dy = y - b.y;
          const d = Math.hypot(dx, dy) + wobble;
          const hgt = 1 - (d * d) / (b.r * b.r);
          if (hgt > best) { best = hgt; nx = dx / b.r; ny = dy / b.r; }
        }
        if (best <= 0) continue;
        let s = (nx * L.x + ny * L.y) * 0.75 + Math.sqrt(best) * 0.55;
        s -= Math.max(0, (y - centerY) / R) * 0.2;
        s += (Random.valueNoise((x + ox) / 1.8, (y + oy) / 1.8, 902) - 0.5) * S.leafTexture;
        cells.set(key(x, y), { x, y, s });
      }
    }
    markEdges(cells);
    return cells;
  }

  // Canopy cells → colored pixels with sway weights and optional fruit.
  function canopyPixels(px, cells, centerY, R, hasFruit, salt) {
    const ramp = [P.canopyDark, P.canopyMid, P.canopyLight, P.canopyHighlight];
    const bottom = centerY + R;
    for (const c of cells.values()) {
      let color;
      if (!S.shading) color = P.canopyMid;
      else if (S.outline && c.edge) color = c.s > 0.45 ? P.canopyDark : P.canopyOutline;
      else color = pickShade(c.s, c.x, c.y, ramp, [0.15, 0.45, 0.72]);
      if (hasFruit && !c.edge && c.s > 0.2 && Random.hash(c.x + 900, c.y + salt) < 0.04) color = P.fruit;
      px.push({ x: c.x, y: c.y, c: color, w: Math.max(0, Math.min(1, (bottom - c.y) / (R * 2))) });
    }
  }

  // The clumps of leaves that make a tree's crown: a core, a ring of clumps round it, one on top set to a side and one or
  // two low boughs that droop, so the outline is lobed and uneven instead of a ball. The Leaf clumps setting is how many go
  // in the ring; with none, the crown is one ball.
  function crownClumps(rng, R, centerY) {
    const n = S.treeBlobs, clumps = [{ x: 0, y: centerY, r: R * (n ? 0.62 : 1) }];
    if (!n) return clumps;
    const ring = Math.max(3, n), start = rng() * Math.PI * 2, side = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < ring; i++) {
      const a = start + (i / ring) * Math.PI * 2 + (rng() - 0.5) * 0.5, d = 0.52 + rng() * 0.2;
      clumps.push({ x: Math.cos(a) * R * d, y: centerY + Math.sin(a) * R * 0.78 * d, r: R * (0.4 + rng() * 0.16) });
    }
    clumps.push({ x: side * R * (0.15 + rng() * 0.25), y: centerY - R * (0.62 + rng() * 0.15), r: R * (0.36 + rng() * 0.1) });
    clumps.push({ x: -side * R * (0.7 + rng() * 0.2), y: centerY + R * (0.3 + rng() * 0.15), r: R * (0.3 + rng() * 0.08) });
    if (rng() < 0.6) clumps.push({ x: side * R * (0.75 + rng() * 0.2), y: centerY + R * (0.2 + rng() * 0.2), r: R * 0.3 });
    return clumps;
  }

  // Tree: a trunk lit on one side that forks into two limbs, under a crown of leaf clumps.
  function makeRoundTree(rng, R) {
    const px = [];
    const trunkH = Math.max(1, Math.round(R * 0.8));
    const centerY = -(trunkH + R * 0.75);
    const tw = Math.max(2, Math.round(R / 3));
    const x0 = -Math.floor(tw / 2);
    const trunkTop = Math.round(centerY + R * 0.5);
    const salt = Math.floor(rng() * 5000);
    for (let y = trunkTop; y <= 0; y++) {
      for (let k = 0; k < tw; k++) {
        const x = x0 + k;
        const side = tw > 1 ? (k / (tw - 1)) * 2 - 1 : 0;
        let c = P.trunkMid;
        if (S.shading) {
          const lit = side * L.x;
          c = lit > 0.3 ? P.trunkLight : lit < -0.3 ? P.trunkDark : P.trunkMid;
          if (Random.hash(x * 13 + 400 + salt, y) < 0.12) c = P.trunkDark;
          if (y < -trunkH + 2) c = P.trunkDark;
        }
        px.push({ x, y, c, w: 0 });
      }
    }
    px.push({ x: x0 - 1, y: 0, c: P.trunkDark, w: 0 }, { x: x0 + tw, y: 0, c: P.trunkDark, w: 0 });
    for (const side of [-1, 1]) for (let t = 1; R >= 8 && t <= R * 0.6; t++) {              // the limbs, seen where the leaves part
      const x = Math.round(side * t * 0.75), y = trunkTop - Math.round(t * 0.55);
      px.push({ x, y, c: side * L.x > 0 ? P.trunkMid : P.trunkDark, w: 0 }, { x, y: y + 1, c: P.trunkDark, w: 0 });
    }
    const hasFruit = rng() < S.fruitChance;
    canopyPixels(px, makeCanopy(rng, R, centerY, 1, 0.8, false, crownClumps(rng, R, centerY)), centerY, R, hasFruit, salt);
    return { px, shadowR: R * 1.05 };
  }

  // Bush: a low, wide canopy with no trunk.
  function makeBush(rng, R) {
    const px = [];
    const centerY = -R * 0.7;
    const salt = Math.floor(rng() * 5000);
    canopyPixels(px, makeCanopy(rng, R, centerY, 1.3, 0.6, true), centerY, R, rng() < S.fruitChance * 0.5, salt);
    return { px, shadowR: R * 1.2 };
  }

  // ---------- Pines ----------

  // Stacked triangles, narrower toward the top. Each layer shades the one below.
  function makePine(rng, R) {
    const totalH = R * 2.6;
    const step = totalH / PINE_LAYERS;
    const layerH = step * 1.6;
    const ox = Math.floor(rng() * 1000);
    const layerBottom = i => -3 - i * step;
    const layerWidth = i => R * (1 - i / (PINE_LAYERS + 0.6));
    const cells = new Map();
    const top = Math.floor(layerBottom(PINE_LAYERS - 1) - layerH) - 1;
    for (let y = top; y <= -2; y++) {
      for (let x = -R - 2; x <= R + 2; x++) {
        for (let i = PINE_LAYERS - 1; i >= 0; i--) {
          const yb = layerBottom(i), yt = yb - layerH;
          if (y < yt || y > yb) continue;
          const t = (y - yt) / layerH;
          const hw = layerWidth(i) * t;
          if (Math.abs(x) > hw) continue;
          if (t > 0.88 && Random.hash(x + 300 + ox, y + i * 17) < 0.4) continue;
          const side = x / (hw + 0.5);
          let s = 0.3 + side * L.x * 0.55 + (1 - t) * (-L.y) * 0.35;
          if (i < PINE_LAYERS - 1 && y - layerBottom(i + 1) > 0 && y - layerBottom(i + 1) <= 2) s -= 0.35;
          s += (Random.valueNoise((x + ox) / 1.8, y / 1.8, 903) - 0.5) * S.leafTexture * 0.8;
          cells.set(key(x, y), { x, y, s, t });
          break;
        }
      }
    }
    markEdges(cells);
    const px = [];
    for (let y = -2; y <= 0; y++) {
      px.push({ x: 0, y, c: P.trunkDark, w: 0 });
      px.push({ x: -1, y, c: S.shading && L.x < 0 ? P.trunkMid : P.trunkDark, w: 0 });
    }
    const ramp = [P.pineDark, P.pineMid, P.pineLight];
    for (const c of cells.values()) {
      let color;
      if (!S.shading) color = P.pineMid;
      else if (S.outline && c.edge) color = c.s > 0.4 ? P.pineDark : P.pineOutline;
      else color = pickShade(c.s, c.x, c.y, ramp, [0.2, 0.5]);
      if (S.snow && c.t < 0.4 && c.s > 0.3) color = P.snow;
      px.push({ x: c.x, y: c.y, c: color, w: Math.max(0, Math.min(1, -(c.y + 3) / totalH)) });
    }
    return { px, shadowR: R * 0.85 };
  }

  // ---------- Forest floor ----------

  // Fallen log lying sideways: lit top, dark underside, bark streaks, moss, and a cut end with rings.
  function makeLog(rng, scale) {
    const len = Math.max(5, Math.round((7 + rng() * 5) * scale));
    const T = Math.max(3, Math.round(3.5 * scale));
    const x0 = -Math.floor(len / 2), x1 = x0 + len - 1;
    const cut = rng() < 0.5 ? x0 : x1, back = cut === x0 ? x1 : x0;
    const salt = Math.floor(rng() * 1000);
    const px = [];
    for (let y = -T + 1; y <= 0; y++) {
      const row = y + T - 1;
      for (let x = x0; x <= x1; x++) {
        let c = P.trunkMid;
        if (x === cut) c = row === 0 || row === T - 1 ? P.woodDark : row === Math.floor(T / 2) ? P.wood : P.woodLight;
        else if (x === cut + (cut === x0 ? 1 : -1)) c = P.trunkDark;
        else if (row === T - 1 || (S.outline && x === back)) c = P.trunkDark;
        else if (row === 0) c = S.shading && L.y < 0 ? P.trunkLight : P.trunkMid;
        else if (Random.hash(Math.floor(x / 2) + salt, row) < 0.3) c = P.trunkDark;
        if (row === 0 && x !== cut && Random.valueNoise((x + salt) / 2.5, 0.5, 960) > 0.62) c = x % 2 ? P.mossDark : P.mossLight;
        if (row === 0 && x !== cut && S.snow) c = P.snow;
        fixed(px, x, y, c);
      }
    }
    if (len > 7) fixed(px, x0 + 2 + Math.floor(rng() * (len - 5)), -T, P.trunkMid);
    return { px, shadowR: len * 0.45 };
  }

  // Tree stump: a ringed top ellipse, bark sides lit on one side, little roots.
  function makeStump(rng, scale) {
    const r = Math.max(2, Math.round((2.5 + rng()) * scale));
    const H = Math.max(2, Math.round(2.5 * scale));
    const ry = Math.max(1, Math.round(r * 0.5)), cy = -H - ry;
    const salt = Math.floor(rng() * 1000);
    const px = [];
    const topBottom = {};
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x / (r + 0.3), (y - cy) / (ry + 0.5));
        if (d > 1) continue;
        topBottom[x] = Math.max(topBottom[x] ?? -99, y);
        const c = d > 0.78 ? P.trunkMid : d < 0.2 ? P.woodDark : d > 0.42 && d < 0.6 ? P.wood : P.woodLight;
        fixed(px, x, y, S.snow && d < 0.78 ? P.snow : c);
      }
    }
    for (let x = -r; x <= r; x++) {
      for (let y = (topBottom[x] ?? cy) + 1; y <= 0; y++) {
        const side = x / r * L.x;
        let c = side > 0.35 ? P.trunkLight : side < -0.35 ? P.trunkDark : P.trunkMid;
        if (Random.hash(x + salt, 3) < 0.3) c = P.trunkDark;
        fixed(px, x, y, c);
      }
    }
    fixed(px, -r - 1, 0, P.trunkDark);
    fixed(px, r + 1, 0, P.trunkDark);
    return { px, shadowR: r * 1.3 };
  }

  // One mushroom: a light stem under a domed cap (red with spots, or brown with a lit edge). Big ones are wider and taller.
  function addMushroom(px, x, y, red, big, spot) {
    const cap = red ? P.mushroomCap : P.mushroomBrown, w = big ? 3 : 2, lit = L.x < 0 ? -1 : 1;
    for (let r = 0; r <= (big ? 2 : 1); r++) fixed(px, x, y - r, P.mushroomStem);
    const top = y - (big ? 3 : 2);
    for (let k = -w; k <= w; k++) fixed(px, x + k, top, k === -w * lit ? P.mushroomStem : cap);
    for (let k = -w + 1; k <= w - 1; k++) fixed(px, x + k, top - 1, cap);
    if (big) for (let k = -1; k <= 1; k++) fixed(px, x + k, top - 2, cap);
    if (red) { fixed(px, x + spot, top - 1, P.mushroomSpot); if (big) fixed(px, x - spot * 2, top, P.mushroomSpot); }
    else fixed(px, x + lit * (w - 1), top - 1, P.woodLight);
  }

  // A small cluster of 1–3 mushrooms.
  function makeMushrooms(rng, scale) {
    const px = [];
    const red = rng() < 0.5;
    const n = 1 + Math.floor(rng() * 3 * Math.min(1.5, scale));
    for (let k = 0; k < n; k++) {
      const x = k === 0 ? 0 : Math.round((rng() - 0.5) * 14), y = k === 0 ? 0 : -Math.round(rng() * 3);
      addMushroom(px, x, y, red, rng() < 0.5, rng() < 0.5 ? -1 : 1);
    }
    return { px, shadowR: 0 };
  }

  // Fairy ring: mushrooms around an ellipse. The base is the ring's bottom; the grass under it darkens.
  function makeRing(rng, scale) {
    const rx = Math.max(3, (5 + rng() * 3) * scale), ry = rx * 0.6;
    const n = Math.round(8 + rng() * 4 + rx * 0.6);
    const red = rng() < 0.3;
    const px = [], blocks = [];
    const start = rng() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      if (rng() < 0.12) continue;
      const a = start + (k / n) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      const x = Math.round(Math.cos(a) * rx), y = Math.round(Math.sin(a) * ry - ry);
      addMushroom(px, x, y, red, rng() < 0.35, rng() < 0.5 ? -1 : 1);
      blocks.push([x, y]);
    }
    return { px, shadowR: 0, blocks, anchors: { ring: { rx, ry, cy: -ry } } };
  }

  // ---------- Buildings ----------

  // Adds a pixel that never sways.
  function fixed(px, x, y, c) { px.push({ x, y, c, w: 0 }); }


  // Palm: a slim ringed trunk, gently curved, under a crown of drooping fronds that sway in the wind.
  function makePalm(rng, scale) {
    const px = [], H = Math.max(5, Math.round((8 + rng() * 4) * scale)), lean = (rng() - 0.5) * 4 * scale;
    const lit = L.x < 0 ? 0 : 1;
    for (let j = 0; j <= H; j++) {
      const t = j / H, x = Math.round(lean * t * t);
      for (let k = 0; k < 2; k++) {
        const c = j % 3 === 0 ? P.trunkDark : k === lit ? P.trunkLight : P.trunkMid;
        px.push({ x: x + k, y: -j, c, w: t * 0.3 });
      }
    }
    const cx = Math.round(lean), cy = -H - 1, n = 7 + Math.floor(rng() * 3), len = Math.max(4, Math.round((6 + rng() * 2) * scale));
    const spin = rng() * Math.PI;
    for (let f = 0; f < n; f++) {
      const a = spin + f * Math.PI * 2 / n, dx = Math.cos(a), dy = Math.sin(a) * 0.6;
      for (let s = 1; s <= len; s++) {
        const droop = (s / len) ** 2 * 3, x = Math.round(cx + dx * s), y = Math.round(cy + dy * s + droop);
        const facing = (dx * L.x + dy * L.y) > 0;
        const c = s === len ? P.canopyDark : facing ? P.canopyLight : P.canopyMid;
        px.push({ x, y, c, w: 0.6 + s / len * 0.4 });
        if (s > 1 && s < len) {
          px.push({ x: x + Math.round(-dy * 1.6), y: y + Math.round(dx), c: P.canopyDark, w: 0.6 + s / len * 0.4 });
          px.push({ x: x + Math.round(dy * 1.6), y: y - Math.round(dx), c: facing ? P.canopyMid : P.canopyDark, w: 0.6 + s / len * 0.4 });
        }
      }
    }
    px.push({ x: cx, y: cy, c: P.canopyHighlight, w: 0.6 }, { x: cx + 1, y: cy, c: P.trunkLight, w: 0.6 });
    return { px, shadowR: len * 0.9 };
  }

  // Tent cloth colors: mostly plain canvas, now and then dyed purple or blue.
  function tentCloth(rng) {
    const r = rng();
    return r < 0.7 ? [P.canvasDark, P.canvas, P.canvasLight] : r < 0.85 ? [P.purpleDark, P.purple, P.purpleLight] : [P.deep, P.mid, P.shallow];
  }

  // Tent: usually a round one (a cone of cloth panels around a center pole), sometimes a ridge tent.
  function makeTent(rng, scale) {
    const ramp = tentCloth(rng);
    return rng() < 0.7 ? roundTent(rng, scale, ramp) : ridgeTent(rng, scale, ramp);
  }

  // Round tent: a squat cone whose seams run from the pole to a round hem, lit on the side facing the light, with a door flap.
  function roundTent(rng, scale, ramp) {
    const R = Math.max(5, Math.round((7 + rng() * 2) * scale));
    const H = Math.round(R * 1.05), ry = Math.max(2, Math.round(R * 0.4)), panels = 7 + Math.floor(rng() * 3), turnBy = rng() * Math.PI;
    const px = [];
    for (let j = 0; j <= H + ry; j++) {
      const t = Math.min(1, j / H), hw = Math.max(0.5, R * Math.pow(t, 0.8)), y = j - H - ry;
      for (let x = -Math.round(hw); x <= Math.round(hw); x++) {
        const hem = ry * Math.sqrt(Math.max(0, 1 - (x / (R + 0.5)) ** 2));
        if (j > H && j - H > hem) continue;
        const a = Math.asin(Math.max(-1, Math.min(1, x / (hw + 0.5))));
        const seam = Math.abs(Math.sin((a + turnBy) * panels / 2)) < 0.16 && t > 0.2;
        const s = 0.5 + (x / (hw + 0.5)) * L.x * 0.55 - (1 - t) * L.y * 0.2;
        let c = S.shading ? pickShade(s, x, y, ramp, [0.33, 0.68]) : ramp[1];
        if (seam) c = ramp[0];
        if (S.outline && (Math.abs(x) === Math.round(hw) || j - H >= hem - 1 && j >= H)) c = ramp[0];
        if (S.snow && t < 0.4 && s > 0.3) c = P.snow;
        fixed(px, x, y, c);
      }
    }
    for (let j = 0; j < 4; j++) for (let x = -2 + Math.ceil(j / 2); x <= 2 - Math.ceil(j / 2); x++) fixed(px, x, -j, j === 0 ? P.trunkDark : P.rockOutline);
    fixed(px, 0, -H - ry - 1, P.trunkDark); fixed(px, 0, -H - ry - 2, P.trunkMid);
    return { px, shadowR: R * 1.1, footprint: Math.round((H + ry) * 0.5) };
  }

  // Ridge tent, seen from its open end: a triangle of cloth with the doorway open between two flaps round a pole, the two
  // slopes of its roof running back above it (one lit, one in shade), and a guy rope to a peg either side.
  function ridgeTent(rng, scale, ramp) {
    const half = Math.max(6, Math.round((6 + rng() * 2) * scale)), rise = Math.round(half * 1.1), back = Math.max(4, Math.round(half * 0.6));
    const px = [], edge = x => -Math.round(rise * (1 - Math.abs(x) / half)), doorTop = -Math.round(rise * 0.72);
    for (let x = -half; x <= half; x++) {
      const top = edge(x), lit = (x < 0) === (L.x < 0);
      for (let r = 1; r <= back; r++) {
        let c = x === 0 ? ramp[2] : lit ? (r % 3 ? ramp[2] : ramp[1]) : r % 3 ? ramp[1] : ramp[0];
        if (S.outline && (r === back || Math.abs(x) === half)) c = ramp[0];
        if (S.snow && x !== 0 && r > back - 3 && Random.hash(x + 33, r) < 0.7) c = P.snow;
        fixed(px, x, top - r, c);
      }
      for (let y = top; y <= 0; y++) {
        const doorHalf = Math.round((y - doorTop) / -doorTop * half * 0.42), open = y > doorTop && Math.abs(x) <= doorHalf;
        const c = open ? (Math.abs(x) === doorHalf ? ramp[2] : x === 0 ? P.trunkMid : P.trunkDark) : y === top || y === 0 ? ramp[0] : x < 0 === (L.x < 0) ? ramp[1] : shadeOf(ramp[1], 0.88);
        fixed(px, x, y, c);
      }
    }
    fixed(px, 0, -rise - back - 1, P.trunkDark); fixed(px, 0, -rise - back - 2, P.trunkMid);
    for (const side of [-1, 1]) {
      for (let k = 1; k <= 5; k++) fixed(px, side * (half + k), -6 + k, P.canvasDark);
      fixed(px, side * (half + 6), 0, P.trunkDark); fixed(px, side * (half + 6), -1, P.trunkMid);
    }
    return { px, shadowR: half * 1.2, footprint: Math.round((rise + back) * 0.5) };
  }

  // A color darkened (or lightened) by a factor.
  function shadeOf(c, k) { return c.map(v => Math.min(255, v * k)); }

  // Campfire: a ring of small stones around two crossed logs. Flames are drawn per frame.
  function makeCampfire(rng, scale) {
    const rx = 3.5 * scale, ry = 2 * scale, cy = -Math.round(ry), reach = Math.max(2, Math.round(rx * 0.6));
    const n = Math.round(7 + rx) + Math.floor(rng() * 3);
    const px = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng() * 0.3;
      const x = Math.round(Math.cos(a) * rx), y = cy + Math.round(Math.sin(a) * ry);
      const lit = Math.cos(a) * L.x + Math.sin(a) * L.y > 0;
      fixed(px, x, y, lit ? P.rockLight : P.rockMid);
      if (rx > 4) fixed(px, x + (Math.cos(a) > 0 ? -1 : 1), y, lit ? P.rockMid : P.rockDark);        // bigger stones round a bigger fire
      fixed(px, x, y + 1, P.rockDark);
    }
    for (let k = -reach; k <= reach; k++) {
      fixed(px, k, cy + Math.round(k / 2), k % 2 ? P.trunkMid : P.trunkDark);
      fixed(px, k, cy - Math.round(k / 2), k % 2 ? P.trunkLight : P.trunkMid);
    }
    for (let k = -1; k <= 1; k++) fixed(px, k, cy, k ? P.fire2 : P.fire3);
    return { px, shadowR: 0, anchors: { fire: [0, cy] } };
  }

  // ---------- Rocks ----------

  // Bumpy outline, then a height from the distance to the edge; slopes facing the light are bright.
  function makeRock(rng, size, small) {
    const rx = size, ry = Math.max(1.5, size * 0.72);
    const ox = rng() * 100, oy = rng() * 100;
    const minX = -Math.ceil(rx * 1.6) - 2, maxX = -minX;
    const minY = -Math.ceil(ry * 2 * 1.4) - 2, maxY = 1;
    const W = maxX - minX + 1, H = maxY - minY + 1;
    const inside = new Uint8Array(W * H);
    const idx = (x, y) => (y - minY) * W + (x - minX);
    for (let y = minY; y <= 0; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x / rx, dy = (y + ry) / ry;
        const a = Math.atan2(dy, dx);
        const r = 1 + (Random.valueNoise(Math.cos(a) * 1.5 + ox, Math.sin(a) * 1.5 + oy, 950) - 0.5) * 2 * ROCK_ROUGHNESS;
        if (Math.hypot(dx, dy) < r) inside[idx(x, y)] = 1;
      }
    }
    const dist = Grid.distanceField(W, H, inside.map(v => 1 - v));
    const height = (x, y) => (x < minX || x > maxX || y < minY || y > maxY) ? 0 : Math.min(dist[idx(x, y)], ROCK_BEVEL) / ROCK_BEVEL;
    let topY = 0;
    outer: for (let y = minY; y <= 0; y++) for (let x = minX; x <= maxX; x++) if (inside[idx(x, y)]) { topY = y; break outer; }
    const rockH = Math.max(1, -topY);
    const cells = new Map();
    for (let y = minY; y <= 0; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!inside[idx(x, y)]) continue;
        const gx = height(x + 1, y) - height(x - 1, y);
        const gy = height(x, y + 1) - height(x, y - 1);
        let s = 0.5 - (gx * L.x + gy * L.y) * 0.9;
        s += (1 - (y - topY) / rockH) * 0.15;
        s -= Math.max(0, (y + ry * 0.4) / ry) * 0.2;
        s += (Random.valueNoise((x + ox) / 1.5, (y + oy) / 1.5, 951) - 0.5) * 0.15;
        cells.set(key(x, y), { x, y, s, up: (y - topY) / rockH });
      }
    }
    markEdges(cells);
    const crack = small ? new Map() : makeCracks(rng, cells, size);
    const ramp = [P.rockDark, P.rockMid, P.rockLight, P.rockHighlight];
    const px = [];
    for (const c of cells.values()) {
      let color;
      if (!S.shading) color = P.rockMid;
      else if (S.outline && c.edge) color = c.s > 0.55 ? P.rockDark : P.rockOutline;
      else color = pickShade(c.s, c.x, c.y, ramp, [0.3, 0.55, 0.8]);
      const k = key(c.x, c.y);
      if (S.shading && crack.has(k)) color = crack.get(k) === 'dark' ? P.rockOutline : P.rockHighlight;
      if (!small && !c.edge && c.up < 0.45 &&
          Random.valueNoise((c.x + ox) / 2.5, (c.y + oy) / 2.5, 952) > 1 - ROCK_MOSS * 0.8) {
        color = c.s > 0.55 ? P.mossLight : P.mossDark;
      }
      px.push({ x: c.x, y: c.y, c: color, w: 0 });
    }
    return { px, shadowR: small ? 0 : rx * 1.05 };
  }

  // Short random walks from the top edge inward, with a light pixel beside each step.
  function makeCracks(rng, cells, size) {
    const crack = new Map();
    if (cells.size <= 20) return crack;
    const edgeCells = [...cells.values()].filter(c => c.edge && c.up < 0.5);
    const n = rng() < 0.6 ? 1 : 2;
    for (let k = 0; k < n && edgeCells.length; k++) {
      let { x, y } = edgeCells[Math.floor(rng() * edgeCells.length)];
      const len = 2 + Math.floor(rng() * size * 0.8);
      for (let s = 0; s < len; s++) {
        y += 1;
        if (rng() < 0.5) x += x < 0 ? 1 : -1;
        const c = cells.get(key(x, y));
        if (!c || c.edge) break;
        crack.set(key(x, y), 'dark');
        const lx = x + (L.x < 0 ? -1 : 1);
        if (cells.has(key(lx, y)) && !crack.has(key(lx, y))) crack.set(key(lx, y), 'light');
      }
    }
    return crack;
  }

  return { GROW, drawTuft, drawFlower, drawReed, drawLily, drawStone, drawSprite, configure, get, toCanvas, palette: () => P };
})();
