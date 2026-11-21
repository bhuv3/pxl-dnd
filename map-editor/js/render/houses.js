// Houses: one generator, every seed a different house, at the characters' scale. A house rolls a style (cottage, timber
// frame, stone, brick, clapboard, log, adobe), its size and floors, colors, a shape (ridge roof, front gable, flat roof, a
// gabled bay in front), a chimney, and a composed front (door, evenly spaced windows, dormers, porch, lantern, things at the
// wall), and is drawn from HouseKit's parts. Its color ramps (roofColors, wallColors, trimColors) are shared by the
// landmarks and structures.
const Houses = (() => {
  let S = null, P = null, L = null;

  // Color ramps [dark, mid, light]. Palette ramps come first so the Colors tab still steers most houses.
  const ROOFS = {
    shingle: () => [P.roofDark, P.roof, P.roofLight],
    terracotta: () => [[150, 62, 40], [192, 90, 56], [222, 128, 82]],
    slate: () => [P.slateGap, P.slate, P.slateLight],
    bluegrey: () => [[62, 68, 82], [88, 96, 112], [118, 128, 146]],
    moss: () => [[58, 82, 52], [82, 110, 66], [112, 140, 84]],
    darkwood: () => [[74, 52, 38], [102, 72, 50], [134, 98, 66]],
    teal: () => [[40, 80, 98], [56, 108, 128], [84, 140, 160]],
    thatch: () => [P.thatchDark, P.thatch, P.thatchLight],
  };
  const PAINTS = [
    [[196, 188, 170], [222, 214, 196], [240, 234, 220]],   // whitewash
    [[184, 150, 90], [208, 176, 112], [226, 198, 138]],    // ochre
    [[190, 146, 136], [214, 172, 160], [232, 198, 186]],   // rose
    [[146, 166, 178], [170, 190, 200], [196, 212, 220]],   // pale blue
    [[160, 170, 128], [184, 194, 150], [206, 214, 176]],   // sage
  ];
  const BOARDS = [
    [[120, 42, 36], [156, 58, 46], [184, 84, 64]],         // barn red
    [[70, 86, 100], [92, 112, 128], [120, 140, 154]],      // weathered blue
    [[78, 96, 64], [100, 122, 82], [128, 150, 104]],       // green
  ];
  const TRIMS = [[[90, 40, 32], [130, 58, 44]], [[40, 66, 96], [60, 92, 130]], [[48, 84, 52], [70, 114, 72]], [[230, 226, 214], [250, 248, 240]]];

  // What each kind of house is made of: its walls, its width (map pixels), how often it has two floors, its roofs.
  const STYLES = {
    cottage: { walls: ['plaster', 'plaster', 'plaster', 'stone'], w: [28, 38], two: 0, roofs: ['thatch', 'thatch', 'thatch', 'shingle', 'tile'] },
    timber: { walls: ['timber'], w: [30, 46], two: 0.65, roofs: ['tile', 'tile', 'slate', 'shingle', 'thatch'] },
    stone: { walls: ['stone'], w: [32, 52], two: 0.4, roofs: ['slate', 'slate', 'tile', 'shingle', 'thatch'] },
    brick: { walls: ['brick'], w: [30, 46], two: 0.5, roofs: ['tile', 'slate'] },
    plank: { walls: ['plank'], w: [28, 44], two: 0.45, roofs: ['shingle', 'shingle', 'slate', 'tile'] },
    log: { walls: ['log'], w: [28, 38], two: 0, roofs: ['shingle'] },
    adobe: { walls: ['mud'], w: [28, 44], two: 0.25, roofs: ['flat'] },
  };
  const FACINGS = ['front', 'right', 'back', 'left'];
  const COMMON = ['cottage', 'cottage', 'timber', 'timber', 'timber', 'stone', 'stone', 'brick', 'plank', 'plank', 'log', 'adobe'];

  // Builds one house sprite. s, pal, dir: the sprite settings, palette and light direction from Sprites. The house is drawn
  // lit from the left (HouseKit) and mirrored when the light comes from the right. o: what to fix instead of rolling it
  // (see makePlan; a cabin is a house whose style is always log).
  // A house faces the screen unless o.facing says 'right', 'back' or 'left' (FACINGS, in the order a house turns).
  function build(rng, scale, s, pal, dir, o = {}) {
    S = s; P = pal; L = dir;
    const flip = L.x >= 0, facing = o.facing || 'front';             // a mirrored house must be planned facing the other way
    const sprite = raise(makePlan(rng, scale, { ...o, facing: flip && facing === 'left' ? 'right' : flip && facing === 'right' ? 'left' : facing }));
    return flip ? HouseKit.mirror(sprite) : sprite;
  }

  // Rolls a house: its style, size, floors, materials and colors, its shape (a ridge roof, a front gable, a flat roof,
  // a gabled bay in front), its chimney, and where everything on its front goes. Columns count from the wall's left end.
  // o fixes some of it: { styles (names to pick from), w ([min, max] width), two (chance of two floors), doorW, doorH,
  // arched, porch, lantern, bay (false: none), extras (false: none), front (false: never a front gable), chimney (true: always one),
  // facing }. Turned to the back, a house shows its long wall with no door; turned left or right it shows its gable end, the
  // roof running back, and a small porch at the edge its door is on. Its materials and colors are the same whichever way it faces.
  function makePlan(rng, scale, o = {}) {
    const pick = list => list[Math.floor(rng() * list.length)], chance = k => rng() < k, range = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const style = STYLES[pick(o.styles || COMMON)], wall = pick(style.walls), wide = o.w || style.w;
    const storeys = chance(o.two ?? style.two) && scale >= 0.9 ? 2 : 1;      // a small house has one floor
    const long = Math.max(24, Math.round(range(wide[0], wide[1]) * scale)), facing = o.facing || 'front', side = facing === 'left' || facing === 'right';
    const W = side ? Math.min(30, Math.round(long * 0.36 + 12)) : long;         // end on, we see how deep the house is
    const roof = pick(storeys > 1 ? style.roofs.filter(r => r !== 'thatch') : style.roofs);
    const p = { W, storeys, wall, roof, salt: range(1, 900), roofH: roof === 'thatch' ? range(16, 18) : range(14, 17), rng, pick, chance, range, doorW: o.doorW || 6, doorH: o.doorH || 10, facing, noDoor: facing !== 'front' };
    p.wallRamp = wallColors(rng, wall);
    if (wall === 'timber' && storeys > 1) { p.ground = pick(['stone', 'stone', 'plaster', 'brick']); p.groundRamp = wallColors(rng, p.ground); p.jetty = chance(0.7); }
    p.roofRamp = roofColors(rng, roof);
    p.trim = [P.trunkDark, P.trunkMid];
    p.frame = trimColors(rng);
    p.shutters = chance(0.3) ? pick(TRIMS) : null;
    p.doorRamp = chance(0.5) ? p.trim : pick(TRIMS.slice(0, 3));
    p.arched = o.arched ?? chance(0.35);
    p.shape = roof === 'flat' ? 'flat' : side ? 'front' : W <= 36 && o.front !== false && chance(0.2) ? 'front' : 'ridge';
    p.gableBack = side ? range(10, 13) : 6;                                       // how much roof shows running back behind a gable
    if (side) p.sideDoor = facing;
    if (p.shape === 'ridge' && W >= 42 && wall !== 'log' && o.bay !== false && facing === 'front' && chance(0.45)) {
      const w = 2 * range(8, 10), side = chance(0.5) ? -1 : 1;
      p.bay = { w, side, x: side < 0 ? -1 : W - w + 1, windows: [] };
    }
    p.mustSmoke = !!o.chimney;
    planChimney(p);
    p.porch = !p.noDoor && (o.porch ?? (!p.jetty && p.shape !== 'flat' && chance(0.25)));
    planFront(p);
    p.lantern = !p.noDoor && (o.lantern ?? (!p.porch && chance(0.2)));
    planExtras(p);
    if (o.extras === false) p.extras = [];
    return p;
  }

  // The chimney: on the ridge near an end, a stack up the front wall, behind a front gable, or none.
  function planChimney(p) {
    const { W, bay, chance, range } = p, side = bay ? -bay.side : chance(0.5) ? -1 : 1;
    p.brickStack = p.wall === 'brick' || chance(0.3);
    if (p.shape === 'flat') return;
    if (p.shape === 'front') { if (chance(0.5)) { p.chimney = 'back'; p.chimneyX = side < 0 ? 3 : W - 8; } return; }
    const roll = p.rng(), none = p.mustSmoke ? 0 : p.roof === 'thatch' ? 0.35 : 0.15, breast = p.wall === 'log' ? 0.5 : p.roof === 'thatch' ? 0 : 0.25;
    if (roll < none) return;
    p.chimney = roll < none + breast ? 'breast' : 'ridge';
    p.chimneyX = p.chimney === 'breast' ? (side < 0 ? 2 : W - 7) : side < 0 ? 3 + range(0, 3) : W - 8 - range(0, 3);
  }

  // The front: the door (in the main wall or in the bay), windows spaced evenly along the free stretches of wall, the
  // upper windows over the lower ones and over the door, the bay's own windows, dormers over windows, a timber frame's studs.
  function planFront(p) {
    const { W, bay, chance, pick } = p, lead = p.shutters ? 2 : 0, unit = 7 + lead * 2, dw = p.doorW;
    const cutFrom = (spans, a, b) => spans.flatMap(([s, e]) => b < s || a > e ? [[s, e]] : [[s, a - 1], [b + 1, e]].filter(([u, v]) => v - u + 1 >= unit));
    const fit = spans => spans.flatMap(([s, e]) => {
      const len = e - s + 1, n = Math.floor((len + 3) / (unit + 3)), gap = (len - n * unit) / (n + 1);
      return Array.from({ length: n }, (_, i) => Math.round(s + gap * (i + 1) + unit * i) + lead);
    });
    let spans = [[3, W - 4]];
    if (bay) spans = cutFrom(spans, bay.x - 2, bay.x + bay.w + 1);
    if (p.chimney === 'breast') spans = cutFrom(spans, p.chimneyX - 2, p.chimneyX + 6);
    p.doorInBay = !p.noDoor && !!bay && (chance(0.35) || !spans.length);
    if (p.noDoor) p.door = null;
    else if (p.doorInBay) p.door = Math.floor((bay.w - dw) / 2);
    else {
      // The door goes where it still leaves room for a window: the middle or a third along first, an end if it must.
      const [s, e] = spans.reduce((best, sp) => sp[1] - sp[0] > best[1] - best[0] ? sp : best, spans[0] || [3, W - 4]);
      const pad = p.porch ? 6 : 3 + lead, first = pick([0.5, 0.5, 0.15, 0.85]);
      const tries = [first, 0.5, 0.15, 0.85, 0, 1].map(at => { const d = Math.round(s + 1 + Math.max(0, e - s - dw - 1) * at); return [d, cutFrom(spans, d - pad, d + dw - 1 + pad)]; });
      [p.door, spans] = tries.find(t => fit(t[1]).length) || tries[0];
    }
    const cols = fit(spans);
    const win = (x, floor) => ({ x, floor, shutters: !!p.shutters, box: chance(0.25) });
    const kept = cols.filter(() => chance(0.85));
    p.windows = (kept.length ? kept : cols.slice(0, 1)).map(x => win(x, 0));
    const upper = p.doorInBay || p.noDoor ? cols : [...cols, p.door + Math.round((dw - 7) / 2)].sort((a, b) => a - b);
    if (p.storeys > 1) p.windows.push(...upper.map(x => win(x, 1)));
    if (bay) {
      const mid = Math.floor((bay.w - 7) / 2);
      if (!p.doorInBay) bay.windows.push(win(mid, 0));
      if (p.storeys > 1) bay.windows.push(win(mid, 1));
      bay.attic = chance(0.6);
    }
    const top = p.storeys > 1 ? upper : cols;
    if (p.wall === 'timber') p.studs = between(p.storeys > 1 ? upper.map(x => [x - lead, x + 6 + lead]) : [...cols.map(x => [x - lead, x + 6 + lead]), ...(p.doorInBay || p.noDoor ? [] : [[p.door, p.door + dw - 1]])]);
    const clear = x => !(p.chimney === 'ridge' && x + 8 > p.chimneyX - 2 && x - 2 < p.chimneyX + 6) && !(p.chimney === 'breast' && x + 8 > p.chimneyX - 1 && x - 2 < p.chimneyX + 5);
    const spots = top.filter(clear);
    p.dormers = p.shape === 'ridge' && p.roof !== 'thatch' && p.roofH >= 15 && spots.length && chance(0.35)
      ? (spots.length > 1 && W >= 40 && chance(0.5) ? [spots[0], spots[spots.length - 1]] : [pick(spots)]) : [];
  }

  // The middles of the gaps between openings (each [first column, last column]), where a timber frame's studs stand.
  function between(list) {
    const sorted = list.slice().sort((a, b) => a[0] - b[0]), out = [];
    for (let i = 1; i < sorted.length; i++) if (sorted[i][0] - sorted[i - 1][1] >= 4) out.push(Math.round((sorted[i - 1][1] + sorted[i][0]) / 2));
    return out;
  }

  // Things at the wall: a barrel, a woodpile or a bush at either end, ivy up a corner, a bush under a window.
  function planExtras(p) {
    const { W, bay, chance, pick, range } = p;
    p.extras = [];
    for (const side of [-1, 1]) {
      if (!chance(0.4) || p.sideDoor === (side < 0 ? 'left' : 'right')) continue;
      const kind = pick(['barrel', 'barrel', 'woodpile', 'bush']), wide = { barrel: 5, woodpile: 9, bush: 6 }[kind];
      const front = !!bay && bay.side === side, edge = front ? 2 : 1;
      p.extras.push({ kind, x: side < 0 ? -wide - edge - 1 : W + edge + 1, front });
    }
    if (p.wall !== 'log' && p.wall !== 'plank' && chance(0.25)) {
      const side = bay ? -bay.side : chance(0.5) ? -1 : 1;
      if (!(p.chimney === 'breast' && (p.chimneyX < W / 2) === (side < 0))) p.extras.push({ kind: 'ivy', x: side < 0 ? 0 : W - 1, dir: -side, h: range(8, 8 + 8 * p.storeys) });
    }
    const low = p.windows.filter(w => !w.floor && !w.box);
    if (low.length && chance(0.3)) p.extras.push({ kind: 'bush', x: pick(low).x });
  }

  // A planned house as a sprite.
  function raise(p) {
    const d = draw(p), { px, glass } = HouseKit.finish(), anchors = { windows: glass };
    if (d.smoke) anchors.chimney = d.smoke;
    if (d.light) anchors.light = d.light;
    return { px, shadowR: p.W * 0.55, anchors, footprint: (p.sideDoor ? 18 : 12) - d.back };
  }

  // Draws a planned house with HouseKit: the main block (set back when a bay stands in front), its openings and roof,
  // the bay, then the porch, the lantern and the things at the wall. Returns where things ended up (for a landmark that
  // adds its own parts): { x0, x1, back (the main wall's ground row), top (its top row), ground (the door's ground row),
  // doorX, smoke, light }.
  function draw(p) {
    const K = HouseKit, { W, storeys, wall, roof, salt } = p;
    K.start(P, S);
    const x0 = -Math.floor(W / 2), x1 = x0 + W - 1, back = p.bay ? -5 : 0;
    const wallH = K.BASE + K.STOREY * storeys, top = back - wallH + 1, jut = p.jetty ? 1 : 0, mid = back - K.BASE - K.STOREY;
    const lower = storeys > 1 && wall === 'timber' ? p.ground : wall;          // a timber house may stand on a stone floor
    let smoke = null;
    K.wall(x0, x1, mid + 1, back - K.BASE, lower, lower === wall || lower === 'plaster' ? p.wallRamp : p.groundRamp, salt);
    if (storeys > 1) K.wall(x0 - jut, x1 + jut, top, mid, wall, p.wallRamp, salt + 9);
    K.foundation(x0, x1, back);
    if (wall === 'timber') {
      const studs = (p.studs || []).map(v => x0 + v);
      if (storeys > 1) K.frame(x0 - jut, x1 + jut, top, mid, p.trim, studs);
      if (storeys === 1 || lower === 'plaster') K.frame(x0, x1, mid + 1, back - K.BASE, p.trim, studs);
    }
    if (jut) for (let x = x0 - jut; x <= x1 + jut; x++) { K.put(x, mid, (x - x0) % 4 === 0 ? p.trim[1] : p.trim[0]); K.shade(x, mid + 1, 0.62); K.shade(x, mid + 2, 0.82); }
    else if (storeys > 1 && wall !== 'timber') for (let x = x0; x <= x1; x++) K.shade(x, mid, 0.7);
    const sill = floor => back - K.BASE - 9 - floor * K.STOREY;
    for (const w of p.windows) K.windowAt(x0 + w.x, sill(w.floor), p.frame, { shutters: w.shutters && p.shutters, box: w.box });
    if (!p.doorInBay && !p.noDoor) K.doorAt(x0 + p.door, back, p.doorRamp, p.arched, p.doorW, p.doorH);

    if (p.shape === 'flat') K.flatRoof(x0, x1, top, p.roofRamp, p.wallRamp, salt);
    else if (p.shape === 'front') {
      const rise = Math.round(((x1 - x0) / 2 + 2) * 0.8);
      if (p.chimney) smoke = K.chimney(x0 + p.chimneyX, top, top - rise - Math.max(3, p.gableBack - 3), p.brickStack);
      const apex = K.frontGable(x0, x1, top, roof, p.roofRamp, wall, p.wallRamp, salt, p.trim, p.gableBack);
      K.attic(Math.round((x0 + x1) / 2), apex + 6, p.frame);
    } else {
      const ridgeTop = K.ridgeRoof(x0 - jut, x1 + jut, top + 1, p.roofH, roof, p.roofRamp, salt, p.trim);
      if (p.chimney === 'breast') smoke = K.chimney(x0 + p.chimneyX, back, ridgeTop - 3, p.brickStack);
      if (p.chimney === 'ridge') smoke = K.chimney(x0 + p.chimneyX, ridgeTop + 6, ridgeTop - 4, p.brickStack);
      for (const d of p.dormers) raiseDormer(p, x0 + d, top - 4);
    }
    if (p.bay) raiseBay(p, x0 + p.bay.x, wallH);

    const ground = p.doorInBay ? 0 : back, doorX = p.noDoor ? null : (p.doorInBay ? x0 + p.bay.x : x0) + p.door;
    let light = null;
    if (p.porch) K.porch(doorX, ground, p.roofRamp, roof, salt, p.trim, p.doorW);
    if (p.lantern) light = [...K.lantern(doorX + p.doorW + 1, ground - 7), 'lantern'];
    if (doorX !== null) K.apron(doorX + (p.doorW >> 1), ground + 3, salt);
    if (p.sideDoor) K.sidePorch(p.sideDoor === 'right' ? x1 : x0, back, p.sideDoor === 'right' ? 1 : -1, p.roofRamp, p.trim, salt);
    for (const e of p.extras) {
      const ex = x0 + e.x, ey = (e.front ? 0 : back) + 1;
      if (e.kind === 'barrel') K.barrel(ex, ey); else if (e.kind === 'woodpile') K.woodpile(ex, ey); else if (e.kind === 'bush') K.bush(ex, ey, salt + e.x);
      else K.ivy(ex, ey - 1, e.h, e.dir, salt + e.x);
    }
    return { x0, x1, back, top, ground, doorX, smoke, light };
  }

  // A dormer on the front slope: a small gabled window with plastered cheeks. (x, y): its window's left column and sill row.
  function raiseDormer(p, x, y) {
    const K = HouseKit;
    for (let yy = y - 8; yy <= y; yy++) for (let xx = x - 1; xx <= x + 7; xx++) K.put(xx, yy, xx === x + 7 ? p.wallRamp[0] : p.wallRamp[1]);
    K.frontGable(x - 1, x + 7, y - 8, p.roof, p.roofRamp, 'plaster', p.wallRamp, p.salt, p.trim, 2);
    K.windowAt(x, y - 7, p.frame);
  }

  // The bay: a gabled block standing in front of the main wall, from column b0, with its own windows (and maybe the door).
  function raiseBay(p, b0, wallH) {
    const K = HouseKit, bay = p.bay, b1 = b0 + bay.w - 1, top = -wallH + 1;
    K.wall(b0, b1, top, -K.BASE, p.wall, p.wallRamp, p.salt + 3);
    K.foundation(b0, b1, 0);
    if (p.wall === 'timber') K.frame(b0, b1, top, -K.BASE, p.trim, []);
    for (let y = top; y <= 0; y++) K.shade(b1 + 1, y, 0.7);                    // the bay shades the wall beside it
    for (const w of bay.windows) K.windowAt(b0 + w.x, -K.BASE - 9 - w.floor * K.STOREY, p.frame, { shutters: w.shutters && p.shutters, box: w.box });
    if (p.doorInBay) K.doorAt(b0 + p.door, 0, p.doorRamp, p.arched, p.doorW, p.doorH);
    const apex = K.frontGable(b0, b1, top, p.roof, p.roofRamp, p.wall, p.wallRamp, p.salt, p.trim, 6);
    if (bay.attic) K.attic(Math.round((b0 + b1) / 2), apex + 5, p.frame);
  }

  // Color ramps for a roof covering, a wall kind, and the trim, each with a small random shift.
  function roofColors(rng, kind) {
    const pick = list => list[Math.floor(rng() * list.length)];
    return jitterRamp(rng, kind === 'thatch' ? ROOFS.thatch() : kind === 'tile' ? pick([ROOFS.terracotta(), ROOFS.shingle()])
      : kind === 'slate' ? pick([ROOFS.slate(), ROOFS.bluegrey()]) : kind === 'plank' ? pick([ROOFS.darkwood(), ROOFS.moss()])
      : kind === 'flat' ? [P.dryEarthDark, P.dryEarth, P.dryEarthLight] : pick([ROOFS.shingle(), ROOFS.moss(), ROOFS.teal(), ROOFS.darkwood()]));
  }
  function wallColors(rng, wall) {
    const pick = list => list[Math.floor(rng() * list.length)];
    return jitterRamp(rng, wall === 'log' ? [P.woodDark, P.wood, P.woodLight] : wall === 'plank' ? (rng() < 0.5 ? [P.woodDark, P.wood, P.woodLight] : pick(BOARDS))
      : wall === 'stone' ? [P.stoneDark, P.stone, P.stoneLight] : wall === 'brick' ? [[120, 52, 40], [150, 70, 52], [176, 96, 72]]
      : wall === 'mud' ? [P.dirtDark, P.dirtLight, P.dryEarthLight] : pick(PAINTS));
  }
  function trimColors(rng) { return rng() < 0.5 ? [P.trunkDark, P.trunkMid] : TRIMS[Math.floor(rng() * TRIMS.length)]; }
  function jitterRamp(rng, ramp) {
    const k = 0.9 + rng() * 0.2, h = [rng(), rng(), rng()].map(v => 0.96 + v * 0.08);
    return ramp.map(c => c.map((v, i) => Math.min(255, v * k * h[i])));
  }

  // ---------- The one older part still in use (a ruined wall's ivy) ----------

  // Ivy climbing one corner.
  function ivy(px, rng, x, wallH) {
    const dir = x < 0 ? 1 : -1, height = Math.max(3, Math.floor(wallH * (0.5 + rng() * 0.5)));
    for (let row = 0; row < height; row++) {
      const spread = Math.round((1 - row / height) * 2 + rng());
      for (let k = 0; k <= spread; k++) fixed(px, x + k * dir, -row, rng() < 0.4 ? P.canopyDark : P.canopyMid);
    }
  }

  function fixed(px, x, y, c) { px.push({ x, y, c, w: 0 }); }

  // Sets the sprite settings, palette and light direction for the parts below, when another generator
  // (Landmarks) builds with them.
  function begin(s, pal, dir) { S = s; P = pal; L = dir; }

  return { FACINGS, build, begin, makePlan, draw, roofColors, wallColors, trimColors, ivy };
})();
