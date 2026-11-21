// Landmarks: the buildings a village has one of, at the characters' scale like the houses. Tavern, temple, smithy,
// watchtower, windmill and hut, each a different building for every seed, drawn from HouseKit's walls, roofs, windows and
// doors plus their own parts (a hanging sign, stained glass, a bell tower, an open forge, battlements, a flag, turning
// sails). Like a house, a landmark is drawn lit from the left and mirrored when the light comes from the right.
// Structures builds the castle with some of its parts (spire, parapet, topper, slit).
const Landmarks = (() => {
  let S = null, P = null, L = null;
  const TYPES = ['tavern', 'temple', 'smithy', 'tower', 'windmill', 'hut'];
  const GOLD = [[150, 112, 40], [212, 170, 62], [246, 214, 120]];
  const VERDIGRIS = [[62, 112, 98], [92, 150, 128], [136, 192, 168]];
  const GLASS = [[168, 44, 52], [52, 84, 168], [214, 168, 52], [56, 136, 84], [124, 60, 148], [60, 148, 168]];
  const DARK = [32, 28, 34];
  const SIGNS = ['mug', 'barrel', 'moon', 'antlers', 'key', 'sun', 'fish', 'crown'];
  const FLAGS = [[168, 44, 52], [52, 84, 168], [214, 168, 52], [56, 136, 84], [124, 60, 148], [230, 226, 214]];

  function has(type) { return TYPES.includes(type); }

  // Sets the sprite settings, palette and light direction for the shared parts (used by Structures).
  function begin(s, pal, dir) { S = s; P = pal; L = dir; }

  // Builds one landmark sprite. s, pal, dir: the sprite settings, palette and light direction from Sprites.
  function build(type, rng, scale, s, pal, dir) {
    S = s; P = pal; L = dir;
    Houses.begin(s, pal, dir);
    const made = { tavern, temple, smithy, tower, windmill, hut }[type](rng, scale);
    return L.x < 0 ? made : HouseKit.mirror(made);
  }

  // What HouseKit has drawn, as a sprite: its pixels, its windows, and whatever else it has (extra, more anchors).
  function sprite(extra, anchors) {
    const { px, glass } = HouseKit.finish(), all = { windows: glass, ...anchors };
    for (const k in all) if (!all[k]) delete all[k];
    return { px, ...extra, anchors: all };
  }

  // ---------- Tavern ----------

  // A big house on two floors (one when it's built small), with a wide pair of doors, a lantern either side, a sign hanging from an
  // iron bar at one end, barrels at the other, and a bench.
  function tavern(rng, scale) {
    const K = HouseKit;
    const p = Houses.makePlan(rng, scale, { styles: ['timber', 'timber', 'timber', 'stone', 'brick', 'plank'], w: [44, 56], two: 1,
      doorW: 10, doorH: 11, arched: true, porch: false, lantern: false, extras: false, front: false, chimney: true });
    const d = Houses.draw(p), side = p.bay ? -p.bay.side : rng() < 0.5 ? -1 : 1, lights = [];        // side: the end the sign hangs from
    const jut = p.jetty ? 1 : 0, corner = side > 0 ? d.x1 + jut : d.x0 - jut;
    if (p.storeys > 1) sign(rng, corner, d.back - K.BASE - K.STOREY - 3, side);
    else {                                                                   // a small tavern's sign hangs from a post beside it
      const px = corner + side * 3, base = (p.bay ? 0 : d.back) + 1;
      for (let y = base - 22; y <= base; y++) { K.put(px, y, P.trunkLight); K.put(px + 1, y, P.trunkDark); }
      sign(rng, px + (side > 0 ? 1 : 0), base - 21, side);
    }
    for (const lx of [d.doorX - 2, d.doorX + p.doorW + 1]) lights.push([...K.lantern(lx, d.ground - 8), 'lantern']);
    const by = (p.bay ? 0 : d.back) + 1, bx = side > 0 ? d.x0 - 8 : d.x1 + 4;
    K.barrel(bx, by);
    if (rng() < 0.6) K.barrel(bx + (side > 0 ? -6 : 6), by);
    const seat = side > 0 ? d.x1 - 12 : d.x0 + 4;
    if (p.doorInBay || seat > d.doorX + p.doorW + 3 || seat + 9 < d.doorX - 3) bench(seat, d.back + 1);
    return sprite({ shadowR: p.W * 0.55, footprint: 12 - d.back }, { chimney: d.smoke, lights });
  }

  // An iron bar out from the corner of the wall at (x, y) with a brace under it, and a painted board hanging from it
  // on two chains, with a picture on it. The board swings a little in the wind.
  function sign(rng, x, y, side) {
    const K = HouseKit;
    for (let k = 1; k <= 12; k++) K.put(x + side * k, y, k === 12 ? P.ironLight : P.iron);
    for (let k = 1; k <= 4; k++) K.put(x + side * k, y + 5 - k, P.iron);
    const a = side > 0 ? x + 2 : x - 11, swing = row => 0.12 + row * 0.05;
    const board = pick(rng, [[P.woodDark, P.wood, P.woodLight], [[40, 60, 52], [56, 84, 70], [84, 116, 98]],
      [[96, 38, 34], [128, 54, 46], [160, 76, 62]], [[40, 48, 80], [56, 68, 110], [84, 98, 146]]]);
    K.put(a + 1, y + 1, P.iron, swing(0)); K.put(a + 8, y + 1, P.iron, swing(0));
    for (let r = 0; r < 8; r++) for (let k = 0; k < 10; k++) {
      const rim = r === 0 || r === 7 || k === 0 || k === 9;
      K.put(a + k, y + 2 + r, rim ? board[0] : r === 1 ? board[2] : board[1], swing(r + 1));
    }
    for (const [dx, dy, c] of emblem(pick(rng, SIGNS))) for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) K.put(a + 1 + dx * 2 + u, y + 3 + dy * 2 + v, c, swing(dy * 2 + v + 2));
  }

  // A bench of planks on two legs, its left end at x, standing on row y.
  function bench(x, y) {
    const K = HouseKit;
    for (let k = 0; k < 9; k++) { K.put(x + k, y - 3, k === 0 ? P.woodLight : P.wood); K.put(x + k, y - 2, P.woodDark); }
    for (const lx of [x + 1, x + 7]) { K.put(lx, y - 1, P.woodDark); K.put(lx, y, P.woodDark); }
  }

  // A 4 × 3 picture for a tavern sign (drawn at twice the size).
  function emblem(kind) {
    const out = [], Y = GOLD[1], W = [240, 236, 222], B = [120, 78, 44], G = [176, 180, 188];
    const grid = {
      mug:     ['WW. ', 'YYB ', 'YY  '],
      barrel:  ['BBB ', 'GGG ', 'BBB '],
      moon:    [' YY ', 'Y   ', ' YY '],
      antlers: ['B..B', ' BB ', ' BB '],
      key:     ['GG  ', 'GGGG', '  G '],
      sun:     ['.Y. ', 'YYY ', '.Y. '],
      fish:    [' GG ', 'GGGG', ' GG '],
      crown:   ['Y.Y.', 'YYYY', 'YYYY'],
    }[kind];
    const colors = { W, Y, B, G, '.': null };
    grid.forEach((row, dy) => [...row].forEach((ch, dx) => { const c = colors[ch]; if (c) out.push([dx, dy, c]); }));
    if (kind === 'antlers') out.push([1, 0, B], [2, 0, B]);
    if (kind === 'sun') out.push([0, 0, Y], [2, 0, Y], [0, 2, Y], [2, 2, Y]);
    return out;
  }

  // ---------- Temple ----------

  // A long stone, brick or whitewashed hall with tall stained-glass windows under an unbroken roof, and a bell tower at
  // one end: a belfry with its bell, and a spire, pyramid or battlements on top. The door (under a round window) is in
  // the tower, or in a gabled porch that stands out from the middle of the hall.
  function temple(rng, scale) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900), lights = [];
    const W = Math.max(34, k(44 + rng() * 14)), hallH = Math.max(14, k(18)), roofH = Math.max(12, k(15 + rng() * 3));
    const wall = pick(rng, ['stone', 'stone', 'stone', 'plaster', 'plaster', 'brick']), roofKind = pick(rng, ['slate', 'slate', 'tile', 'shingle']);
    const wallRamp = Houses.wallColors(rng, wall), roofRamp = Houses.roofColors(rng, roofKind), trim = [P.trunkDark, P.trunkMid];
    const glass = [pick(rng, GLASS), pick(rng, GLASS), pick(rng, GLASS)];
    const at = pick(rng, ['left', 'right']), tw = Math.max(13, k(16 + rng() * 3)) | 1, porch = W >= 44 && rng() < 0.55;
    const x0 = -(W >> 1), x1 = x0 + W - 1, back = porch ? -4 : 0, top = back - K.BASE - hallH + 1;
    const tx0 = at === 'left' ? x0 - 4 : x1 + 5 - tw, tx1 = tx0 + tw - 1, cx = (tx0 + tx1) >> 1, pb0 = ((x0 + x1) >> 1) - 8, pb1 = pb0 + 15;
    K.start(P, S);
    K.wall(x0, x1, top, back - K.BASE, wall, wallRamp, salt);
    K.foundation(x0, x1, back);
    let spans = [[x0 + 3, x1 - 3]];                                          // tall windows along the hall, clear of the tower and the porch
    const clear = (a, b) => { spans = spans.flatMap(([s, e]) => b < s || a > e ? [[s, e]] : [[s, a - 1], [b + 1, e]]); };
    clear(tx0 - 3, tx1 + 3);
    if (porch) clear(pb0 - 3, pb1 + 3);
    for (const [a, b] of spans) {
      const len = b - a + 1, n = Math.floor((len + 5) / 10), gap = (len - n * 5) / (n + 1);
      for (let i = 0; i < n; i++) lancet(Math.round(a + gap * (i + 1) + 5 * i), top + 4, hallH - 6, glass, rng);
    }
    K.ridgeRoof(x0, x1, top + 1, roofH, roofKind, roofRamp, salt, trim);
    if (porch) {                                                             // the porch: taller than the wall, gabled, the door and the round window in it
      K.wall(pb0, pb1, top - 4, -K.BASE, wall, wallRamp, salt + 11);
      K.foundation(pb0, pb1, 0);
      for (let y = top + 2; y <= back; y++) K.shade(pb1 + 1, y, 0.7);
      K.doorAt(pb0 + 4, 0, trim, true, 8, 11);
      rose(pb0 + 8, -16, glass);
      K.frontGable(pb0, pb1, top - 4, roofKind, roofRamp, wall, wallRamp, salt, trim, 5);
    }

    const tTop = -(K.BASE + hallH + roofH + Math.max(12, k(16 + rng() * 10))) + 1, belfry = tTop + 4;
    K.wall(tx0, tx1, tTop, -K.BASE, wall, wallRamp, salt + 5);
    K.foundation(tx0, tx1, 0);
    if (at === 'left') for (let y = top + 2; y <= back; y++) K.shade(tx1 + 1, y, 0.7);         // the tower shades the hall
    for (let x = tx0; x <= tx1; x++) { K.put(x, belfry + 11, wallRamp[2]); K.shade(x, belfry + 12, 0.8); }
    for (let r = 0; r < 9; r++) for (let x = cx - 3; x <= cx + 3; x++) if (!(r === 0 && Math.abs(x - cx) === 3)) K.put(x, belfry + r, DARK);
    for (let x = cx - 4; x <= cx + 4; x++) K.put(x, belfry + 9, P.stoneLight);
    bell(cx, belfry + 3);
    if (porch) K.attic(cx, -14, trim);
    else { K.doorAt(cx - 4, 0, trim, true, 8, 11); rose(cx, -17, glass); }
    if (belfry + 12 <= -32) K.attic(cx, Math.round((belfry + 12 - 21) / 2) - 2, trim);
    const cap = pick(rng, ['spire', 'spire', 'pyramid', 'battlements']), capRamp = rng() < 0.35 ? VERDIGRIS : roofRamp;
    const tip = cap === 'battlements' ? parapet(tx0, tx1, tTop - 1, cx, wallRamp)
      : spire(cx, tw / 2 + 1.5, tTop - 1, cap === 'spire' ? Math.round(tw * 1.7 + rng() * 6 * scale) : Math.round(tw * 0.8), capRamp);
    topper(cx, tip - 1, pick(rng, ['cross', 'cross', 'orb', 'star', 'spike']));
    const doorX = porch ? pb0 + 8 : cx;
    if (rng() < 0.45) lights.push([...K.lantern(Math.max((porch ? pb0 : tx0) + 1, doorX - 6), -8), 'lantern']);
    return sprite({ shadowR: (Math.max(x1, tx1) - Math.min(x0, tx0)) * 0.55, footprint: 12 - back }, { lights });
  }

  // A tall window with a pointed top in a stone surround, 5 wide and h tall from (x, y): a patchwork of a few colors of
  // glass between dark leads.
  function lancet(x, y, h, glass, rng) {
    const K = HouseKit, n = K.group();
    for (let r = 0; r < h; r++) for (let c = 0; c < 5; c++) {
      const inset = r === 0 ? 2 : r === 1 ? 1 : 0;
      if (c < inset || c > 4 - inset) { K.put(x + c, y + r, P.stoneLight); continue; }
      if (r % 4 === 3 || (c === 2 && r > 1)) { K.put(x + c, y + r, DARK); continue; }
      K.put(x + c, y + r, glass[Math.floor(rng() * glass.length)]);
      K.lit(x + c, y + r, n);
    }
    for (let c = -1; c <= 5; c++) { K.put(x + c, y + h, P.stoneLight); K.shade(x + c, y + h + 1, 0.82); }
  }

  // A round window in a stone ring, its glass in six colored wedges round a gold middle.
  function rose(cx, cy, glass) {
    const K = HouseKit, n = K.group();
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      const d = Math.hypot(x, y);
      if (d > 3.4) continue;
      if (d > 2.5) { K.put(cx + x, cy + y, P.stoneLight); continue; }
      K.put(cx + x, cy + y, d < 0.5 ? GOLD[1] : glass[Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI / 3) + 0.001) % glass.length]);
      K.lit(cx + x, cy + y, n);
    }
  }

  // A bell hanging in the dark of a belfry, its top at (cx, y).
  function bell(cx, y) {
    const K = HouseKit;
    K.put(cx, y, GOLD[0]);
    for (const r of [1, 2]) { K.put(cx - 1, y + r, GOLD[2]); K.put(cx, y + r, GOLD[1]); K.put(cx + 1, y + r, GOLD[0]); }
    for (let x = -2; x <= 2; x++) K.put(cx + x, y + 3, x === -2 ? GOLD[2] : x === 2 ? GOLD[0] : GOLD[1]);
    K.put(cx, y + 4, GOLD[0]);
  }

  // A spire or a pyramid roof from half-width hw at row y up to a point, lit on the left. Returns the row above its tip.
  function spire(cx, hw, y, h, ramp) {
    const K = HouseKit;
    for (let j = 0; j < h; j++) {
      const w = Math.round(hw * (1 - j / h));
      for (let x = cx - w; x <= cx + w; x++) {
        let c = x === cx ? ramp[1] : x < cx ? ramp[2] : ramp[0];
        if (j % 3 === 1 && x !== cx) c = x < cx ? ramp[1] : K.mul(ramp[0], 0.85);
        if (j === 0 || (Math.abs(x - cx) === w && w > 0)) c = K.mul(ramp[0], 0.85);
        if (S.snow && x < cx && Random.hash(x + 61, y - j) < 0.5) c = P.snow;
        K.put(x, y - j, c);
      }
    }
    return y - h;
  }

  // Corbels, a parapet and merlons on top of a tower from x0 to x1 (centred on cx), from row y up. Returns the top row.
  function parapet(x0, x1, y, cx, ramp) {
    const K = HouseKit;
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const end = x === x0 - 1 ? ramp[2] : x === x1 + 1 ? ramp[0] : ramp[1], merlon = (Math.abs(x - cx) + 1) % 5 < 3;
      K.put(x, y, (x - x0) % 2 ? ramp[0] : ramp[1]);
      K.put(x, y - 1, end);
      K.put(x, y - 2, merlon ? end : ramp[2]);
      if (merlon) { K.put(x, y - 3, end); K.put(x, y - 4, end); K.put(x, y - 5, S.snow ? P.snow : ramp[2]); }
    }
    return y - 5;
  }

  // Something golden on top, standing on row y: a cross, an orb, a star or a spike.
  function topper(x, y, kind) {
    const K = HouseKit;
    K.put(x, y, GOLD[0]); K.put(x, y - 1, GOLD[1]);
    if (kind === 'spike') { K.put(x, y - 2, GOLD[2]); K.put(x, y - 3, GOLD[2]); return; }
    if (kind === 'cross') { for (let r = 2; r <= 5; r++) K.put(x, y - r, GOLD[r > 3 ? 2 : 1]); K.put(x - 1, y - 4, GOLD[2]); K.put(x + 1, y - 4, GOLD[0]); return; }
    if (kind === 'orb') { for (let dy = 2; dy <= 4; dy++) for (let dx = -1; dx <= 1; dx++) if (dy === 3 || dx === 0) K.put(x + dx, y - dy, dx < 0 ? GOLD[2] : dx > 0 ? GOLD[0] : GOLD[1]); return; }
    K.put(x, y - 2, GOLD[2]); K.put(x - 1, y - 3, GOLD[1]); K.put(x + 1, y - 3, GOLD[1]); K.put(x, y - 3, GOLD[2]); K.put(x, y - 4, GOLD[1]);
  }

  // ---------- Smithy ----------

  // A workshop with an open shed beside it: a forge of glowing coals under its chimney, tools on the back wall, an
  // anvil on its block out front, and a barrel of water for quenching.
  function smithy(rng, scale) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900);
    const hw = Math.max(24, k(26 + rng() * 6)), sw = Math.max(21, k(22 + rng() * 4)), side = rng() < 0.5 ? -1 : 1;        // side: the shed's end
    const total = hw + sw, left = -(total >> 1);
    const [hx0, hx1, sx0, sx1] = side > 0 ? [left, left + hw - 1, left + hw, left + total - 1] : [left + sw, left + total - 1, left, left + sw - 1];
    const wall = pick(rng, ['stone', 'stone', 'log', 'plank', 'timber', 'brick']), roofKind = pick(rng, ['shingle', 'slate', 'tile']);
    const wallRamp = Houses.wallColors(rng, wall), roofRamp = Houses.roofColors(rng, roofKind), trim = [P.trunkDark, P.trunkMid], frame = Houses.trimColors(rng);
    const top = -K.BASE - K.STOREY + 1, shedTop = top + 1, roofH = 13 + Math.floor(rng() * 3);
    K.start(P, S);

    // The shed: its back wall in shadow, the forge against it, tools hanging, a lean-to roof on a post.
    const fx0 = side > 0 ? sx0 + 2 : sx1 - 11, fcx = fx0 + 5;
    K.wall(sx0, sx1, shedTop, 0, wall === 'timber' || wall === 'log' ? 'plank' : wall, wallRamp, salt + 7);
    for (let y = shedTop; y <= 0; y++) for (let x = sx0; x <= sx1; x++) {       // in the roof's shade, warmed by the forge's glow
      const near = Math.max(0, 1 - Math.abs(x - fcx) / 13);
      K.shade(x, y, (y === 0 ? 0.48 : 0.62) + near * 0.2);
      if (near > 0.2) K.tint(x, y, [1 + near * 0.3, 1 + near * 0.08, 1 - near * 0.15]);
    }
    for (let y = -6; y <= 0; y++) for (let c = 0; c < 10; c++) {
      const joint = -y % 3 === 2 || (c + (Math.floor(-y / 3) % 2 ? 2 : 0)) % 4 === 0;
      K.put(fx0 + c, y, joint ? P.stoneMortar : c === 0 ? P.stoneLight : c === 9 ? P.stoneDark : P.stone);
    }
    for (let c = 1; c < 9; c++) { K.put(fx0 + c, -7, c % 2 ? P.fire3 : P.fire2); if (c % 3 === 1) K.put(fx0 + c, -8, P.fire1); }
    for (let r = 0; r < 3; r++) for (let c = 1 + r; c <= 8 - r; c++) K.put(fx0 + c, -9 - r, c === 1 + r ? P.stoneLight : c === 8 - r ? P.stoneDark : P.stone);
    toolRack(side > 0 ? sx1 - 13 : sx0 + 3, shedTop + 4);
    leanRoof(sx0 - (side < 0 ? 2 : 0), sx1 + (side > 0 ? 2 : 0), shedTop - 5, 7, roofKind, roofRamp, salt);
    const smoke = K.chimney(fcx - 2, -12, top - roofH - 2);
    const post = side > 0 ? sx1 : sx0;
    for (let y = shedTop + 2; y <= 0; y++) { K.put(post, y, P.trunkMid); K.put(post - side, y, P.trunkDark); }

    // The workshop, with its door on the shed's side and a window.
    K.wall(hx0, hx1, top, -K.BASE, wall, wallRamp, salt);
    K.foundation(hx0, hx1, 0);
    if (wall === 'timber') K.frame(hx0, hx1, top, -K.BASE, trim, []);
    K.doorAt(side > 0 ? hx1 - 9 : hx0 + 4, 0, trim, false);
    K.windowAt(side > 0 ? hx0 + 4 : hx1 - 10, -K.BASE - 9, frame);
    K.ridgeRoof(hx0, hx1, top + 1, roofH, roofKind, roofRamp, salt, trim);

    // Out front: the anvil on its block, the barrel of water, a heap of coal.
    anvil(fcx + side * 10, 1);
    const bx = side > 0 ? sx1 + 3 : sx0 - 7;
    K.barrel(bx, 1);
    for (let c = 1; c <= 3; c++) K.put(bx + c, -4, P.shallow);
    for (let r = 0; r < 3; r++) for (let c = r; c < 6 - r; c++) K.put(fx0 + (side > 0 ? 11 : -7) + c, 1 - r, Random.hash(c + salt, r) < 0.3 ? P.rockDark : P.rockOutline);
    return sprite({ shadowR: total * 0.55, footprint: 12 }, { chimney: smoke, lights: [[fcx, -7, 'torch']] });
  }

  // A rack of tools on the wall, 11 wide from (x, y): a board with a hammer, a pair of tongs and a horseshoe hanging from it.
  function toolRack(x, y) {
    const K = HouseKit;
    for (let c = 0; c < 11; c++) K.put(x + c, y, c === 0 ? P.woodLight : P.wood);
    for (let r = 1; r <= 3; r++) K.put(x + 1, y + r, P.woodLight);                                       // the hammer's handle, then its head
    for (let c = 0; c <= 2; c++) { K.put(x + c, y + 4, P.ironLight); K.put(x + c, y + 5, P.iron); }
    for (let r = 1; r <= 5; r++) { K.put(x + (r > 3 ? 5 : 4), y + r, P.ironLight); K.put(x + (r > 3 ? 6 : 7), y + r, P.iron); }      // the tongs, closing at the bottom
    for (let r = 1; r <= 3; r++) { K.put(x + 8, y + r, P.ironLight); K.put(x + 10, y + r, P.iron); }      // the horseshoe
    K.put(x + 9, y + 3, P.ironLight);
  }

  // A roof of one slope coming toward us, rows top to top + h - 1, over x0..x1: it shades what stands under it.
  function leanRoof(x0, x1, top, h, kind, ramp, salt) {
    const K = HouseKit;
    for (let r = 0; r < h; r++) for (let x = x0; x <= x1; x++) {
      let c = r === 0 ? ramp[2] : r === h - 1 ? K.mul(ramp[0], 0.8) : K.covering(kind, x - x0, r, ramp, salt);
      if (S.snow && (r < 2 || (r < 5 && Random.hash(x + 51, r) < 0.5))) c = P.snow;
      K.put(x, top + r, c);
    }
    for (let x = x0; x <= x1; x++) { K.shade(x, top + h, 0.65); K.shade(x, top + h + 1, 0.85); }
  }

  // An anvil on a block of wood, centred on cx, standing on row y.
  function anvil(cx, y) {
    const K = HouseKit;
    for (let x = -2; x <= 2; x++) { K.put(cx + x, y, x < 0 ? P.wood : P.woodDark); K.put(cx + x, y - 1, x === -2 ? P.woodLight : x < 1 ? P.wood : P.woodDark); }
    for (let x = -1; x <= 1; x++) K.put(cx + x, y - 2, P.iron);
    for (let x = -2; x <= 2; x++) K.put(cx + x, y - 3, P.iron);
    for (let x = -4; x <= 3; x++) K.put(cx + x, y - 4, x < -2 ? P.iron : P.ironLight);
  }

  // ---------- Watchtower ----------

  // A tall stone tower with arrow slits and a door (battlements or a pointed roof on top), or a wooden one on legs
  // with a lookout hut. Most fly a flag that flaps in the wind; many keep a torch burning at the top.
  function tower(rng, scale) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900), lights = [];
    const flag = [pick(rng, FLAGS), pick(rng, [[230, 226, 214], [32, 28, 34], [214, 168, 52]])];
    K.start(P, S);
    const stone = rng() < 0.65, [top, W] = stone ? stoneTower(rng, k, salt, lights) : lookout(rng, k, salt, lights);
    if (rng() < 0.85) {                                                    // the flag: a pole, and cloth that waves more toward its free end
      for (let r = 1; r <= 9; r++) K.put(0, top - r, P.trunkDark);
      for (let r = 0; r < 5; r++) for (let c = 1; c <= 9; c++) K.put(c, top - 9 + r, r === 2 && c > 1 && c < 9 ? flag[1] : flag[0], c * 0.3);
    } else topper(0, top - 1, pick(rng, ['orb', 'star', 'spike']));
    return sprite({ shadowR: W * 0.7, footprint: Math.max(4, Math.round(W * 0.4)) }, { lights });
  }

  // The stone watchtower. Returns [its top row, its width].
  function stoneTower(rng, k, salt, lights) {
    const K = HouseKit, W = Math.max(17, k(22 + rng() * 5)) | 1, H = Math.max(34, k(46 + rng() * 12)), x0 = -(W >> 1), x1 = W >> 1;
    const wall = rng() < 0.8 ? 'stone' : 'brick', ramp = Houses.wallColors(rng, wall);
    K.wall(x0, x1, -H + 1, -K.BASE, wall, ramp, salt);
    for (let y = -H + 1; y <= -K.BASE; y++) { K.shade(x1 - 1, y, 0.88); K.shade(x1 - 2, y, 0.95); }      // round toward the dark side
    for (let y = -8; y <= -K.BASE; y++) { K.put(x0 - 1, y, y === -8 ? ramp[2] : ramp[1]); K.put(x1 + 1, y, ramp[0]); }      // a wider foot
    for (let x = x0; x <= x1; x++) { K.put(x, -8, ramp[2]); K.shade(x, -7, 0.85); }
    K.foundation(x0 - 1, x1 + 1, 0);
    K.doorAt(-3, 0, [P.trunkDark, P.trunkMid], true);
    for (let y = -26; y > -H + 6; y -= 26) for (let x = x0; x <= x1; x++) { K.put(x, y, ramp[2]); K.shade(x, y + 1, 0.8); }
    for (let y = -19, n = 0; y > -H + 9; y -= 13, n++) slit(n % 2 ? -6 : 5, y, y - 13 <= -H + 9);
    if (rng() < 0.6) {
      const top = parapet(x0, x1, -H, 0, ramp);
      if (rng() < 0.7) { K.put(x1 + 2, -H - 2, P.iron); K.put(x1 + 2, -H - 3, P.fire1); lights.push([x1 + 2, -H - 3, 'torch']); }
      return [top, W];
    }
    return [spire(0, W / 2 + 2.5, -H, Math.round(W * 0.8 + rng() * 4), Houses.roofColors(rng, pick(rng, ['slate', 'tile', 'shingle']))), W];
  }

  // An arrow slit, 2 wide and 6 tall from (x, y), on a stone sill. The top one of a tower is lit at night.
  function slit(x, y, glows) {
    const K = HouseKit, n = K.group();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) { K.put(x + c, y + r, DARK); if (glows) K.lit(x + c, y + r, n); }
    for (let c = -1; c <= 2; c++) K.put(x + c, y + 6, P.stoneLight);
  }

  // The wooden lookout: four legs with cross braces, a ladder, a platform, and a hut with an open band to look out of.
  // Returns [its top row, its width].
  function lookout(rng, k, salt, lights) {
    const K = HouseKit, W = Math.max(19, k(25 + rng() * 4)), ph = Math.max(24, k(32 + rng() * 9)), x0 = -(W >> 1), x1 = x0 + W - 1;
    const wood = [P.trunkDark, P.trunkMid, P.trunkLight];
    for (let y = -ph; y <= 0; y++) for (const lx of [x0 + 1, x1 - 2]) { K.put(lx, y, wood[2]); K.put(lx + 1, y, wood[0]); }
    for (let y0 = -ph + 4; y0 < -10; y0 += 14) for (let i = 0, span = W - 7; i <= span; i++) {
      const yy = Math.round(y0 + i / span * 10);
      K.put(x0 + 3 + i, yy, wood[1]); K.put(x1 - 3 - i, yy, wood[0]);
    }
    for (let y = -ph + 1; y <= 0; y++) { K.put(-2, y, wood[1]); K.put(2, y, wood[1]); if (y % 3 === 0) for (let x = -1; x <= 1; x++) K.put(x, y, wood[2]); }
    for (let x = x0 - 2; x <= x1 + 2; x++) { K.put(x, -ph, wood[0]); K.put(x, -ph - 1, wood[1]); }
    K.wall(x0, x1, -ph - 12, -ph - 2, 'plank', Houses.wallColors(rng, 'plank'), salt);
    const n = K.group();
    for (let y = -ph - 9; y <= -ph - 5; y++) for (let x = x0 + 2; x <= x1 - 2; x++) if ((x - x0) % 5 !== 1) { K.put(x, y, DARK); if (y === -ph - 7) K.lit(x, y, n); }
    if (rng() < 0.6) { K.put(x1 + 3, -ph - 3, P.iron); K.put(x1 + 3, -ph - 4, P.fire1); lights.push([x1 + 3, -ph - 4, 'torch']); }
    return [spire(0, W / 2 + 3, -ph - 13, Math.round(W * 0.5 + 3), Houses.roofColors(rng, pick(rng, ['thatch', 'shingle']))), W];
  }

  // ---------- Windmill ----------

  // A tower that narrows as it rises, with a door, small windows, sometimes a wooden stage round its middle, a rounded
  // cap, and sails that turn (drawn each frame from sails).
  function windmill(rng, scale) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900);
    const wb = Math.max(19, k(26 + rng() * 5)) | 1, wt = wb - 8 - 2 * Math.floor(rng() * 2), H = Math.max(36, k(52 + rng() * 10));
    const wall = pick(rng, ['stone', 'smooth', 'smooth', 'plank', 'brick']), ramp = Houses.wallColors(rng, wall === 'smooth' ? 'plaster' : wall), trim = Houses.trimColors(rng);
    const hb = wb >> 1, halfAt = y => Math.round(hb - (wb - wt) / 2 * (-y / H));
    K.start(P, S);
    K.wall(-hb, hb, -H + 1, -K.BASE, wall, ramp, salt);
    K.keep((x, y) => Math.abs(x) <= halfAt(y));
    for (let y = -H + 1; y <= -K.BASE; y++) {                              // round: lit on the left, falling into shade on the right
      const hw = halfAt(y);
      for (let x = -hw; x <= hw; x++) { const t = x / hw; K.shade(x, y, t < -0.55 ? 1.08 : t < 0.2 ? 1 : t < 0.6 ? 0.9 : 0.78); }
      K.put(-hw, y, ramp[2]); K.put(hw, y, K.mul(ramp[0], 0.8));
    }
    K.foundation(-hb, hb, 0);
    const sy = rng() < 0.4 ? -Math.round(H * 0.45) : 0;                    // a wooden stage round the middle, sometimes
    if (sy) {
      const hw = halfAt(sy) + 4;
      for (let x = -hw; x <= hw; x++) {
        K.put(x, sy, P.woodDark); K.put(x, sy - 1, P.wood); K.put(x, sy - 4, P.woodLight); K.shade(x, sy + 1, 0.75);
        if (Math.abs(x) === hw || (x + hw) % 4 === 0) { K.put(x, sy - 2, P.woodDark); K.put(x, sy - 3, P.woodDark); }
      }
      for (const s of [-1, 1]) for (let i = 1; i <= 4; i++) K.put(s * (hw - i), sy + i, P.woodDark);
    }
    K.doorAt(-3, 0, [P.trunkDark, P.trunkMid], true);
    for (let y = -24, i = 0; y > -H + 9; y -= 15, i++) if (halfAt(y) >= 5 && !(sy && y > sy - 11 && y < sy + 4)) K.attic(i % 2 ? 1 : -1, y, trim);
    const cap = Houses.roofColors(rng, pick(rng, ['thatch', 'shingle', 'slate'])), capH = Math.max(8, k(11 + rng() * 4)), capW = wt / 2 + 3;
    for (let j = 0; j < capH; j++) {
      const w = Math.round(capW * Math.sqrt(1 - (j / capH) ** 2));
      for (let x = -w; x <= w; x++) {
        let c = x < -w * 0.35 ? cap[2] : x > w * 0.4 ? cap[0] : cap[1];
        if (j % 3 === 2 && Math.abs(x) < w) c = K.mul(c, 0.86);
        if (j === 0 || Math.abs(x) === w) c = K.mul(cap[0], 0.85);
        if (S.snow && j > capH * 0.4 && Random.hash(x + 71, j) < 0.6) c = P.snow;
        K.put(x, -H - j, c);
      }
    }
    const sails = {
      x: 0, y: -H + 2, r: Math.max(18, Math.min(36, Math.round((30 + rng() * 6) * scale))), arms: rng() < 0.85 ? 4 : 6, width: rng() < 0.5 ? 6 : 7, grid: 5,
      cloth: rng() < 0.65 ? pick(rng, [P.canvasLight, P.canvas, [214, 160, 130], [196, 196, 186]]) : null,
      frame: [P.trunkDark, P.woodDark], phase: rng() * Math.PI * 2, rate: 0.3 + rng() * 0.25,
    };
    const blocks = [];
    for (let x = -hb; x <= hb; x++) for (let y = -6; y <= 0; y++) blocks.push([x, y]);
    const made = sprite({ sails, blocks, shadowR: wb * 0.8 });
    made.still = made.px.concat(sailPixels(sails, Math.PI / 4));
    return made;
  }

  // The sail pixels at angle a: a spar from the hub per arm, and a lattice (with or without cloth) on one side of it.
  function sailPixels(sl, a) {
    const out = [], seen = new Set();
    const dot = (x, y, c) => {
      const px = Math.round(x), py = Math.round(y), k = px + ',' + py;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ x: px, y: py, c, w: 0 });
    };
    const hub = sl.grid ? 2 : 1, bars = sl.grid || 3;                       // big sails have a bigger hub and a wider lattice
    for (let y = -hub; y <= hub; y++) for (let x = -hub; x <= hub; x++) if (Math.abs(x) + Math.abs(y) < hub * 2) dot(sl.x + x, sl.y + y, Math.abs(x) + Math.abs(y) < 2 ? sl.frame[0] : sl.frame[1]);
    for (let k = 0; k < sl.arms; k++) {
      const t0 = a + k * Math.PI * 2 / sl.arms, c = Math.cos(t0), s = Math.sin(t0), nx = -s, ny = c;
      for (let t = 1.5; t <= sl.r; t += 0.5) dot(sl.x + c * t, sl.y + s * t, sl.frame[0]);
      for (let t = sl.r * 0.3; t <= sl.r; t += 0.5) {
        for (let o = 1; o <= sl.width; o += 0.5) {
          const edge = o >= sl.width - 0.25 || Math.round(t) % bars === 0 || t >= sl.r - 0.25;
          if (!edge && !sl.cloth) continue;
          dot(sl.x + c * t + nx * o, sl.y + s * t + ny * o, edge ? sl.frame[1] : sl.cloth);
        }
      }
    }
    return out;
  }

  // Draws a windmill's sails for this frame. They turn faster in a stronger wind.
  function drawSails(write, sl, x, y, s, time) {
    const wind = s.wind ? 0.6 + s.windStrength * 0.4 : 0.35;
    for (const p of sailPixels(sl, sl.phase + time * sl.rate * wind)) write(x + p.x, y + p.y, p.c);
  }

  // Draws a windmill's sails for this frame. They turn faster in a stronger wind.
  function drawSails(write, sl, x, y, s, time) {
    const wind = s.wind ? 0.6 + s.windStrength * 0.4 : 0.35;
    for (const p of sailPixels(sl, sl.phase + time * sl.rate * wind)) write(x + p.x, y + p.y, p.c);
  }

  // ---------- Hut ----------

  // A round hut: a low mud wall with a doorway between two posts (a striped cloth hangs in it) and a small window,
  // under a tall dome of thatch bound with two ropes; smoke rises from the top, and a couple of clay pots stand by the door.
  function hut(rng, scale) {
    const K = HouseKit, R = Math.max(9, Math.round((12 + rng() * 3) * scale)), wallW = Math.round(R * 0.85), roofH = Math.round(R * 1.5);
    const salt = 1 + Math.floor(rng() * 900), ramp = [P.thatchDark, P.thatch, P.thatchLight], door = Math.round((rng() - 0.5) * wallW * 0.6) - 3;
    const cloth = pick(rng, [[[168, 44, 52], [230, 226, 214]], [[52, 84, 168], [214, 168, 52]], [[56, 136, 84], [230, 226, 214]], [[214, 168, 52], [124, 60, 148]]]);
    K.start(P, S);
    K.wall(-wallW, wallW, -8, 0, 'mud', Houses.wallColors(rng, 'mud'), salt);
    for (let y = -8; y <= 0; y++) for (let x = Math.round(wallW * 0.55); x <= wallW; x++) K.shade(x, y, 0.88);       // round toward the dark side
    for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) {
      const post = c === 0 ? P.trunkMid : c === 5 ? P.trunkDark : r === 7 ? P.trunkMid : null;
      K.put(door + c, -r, post || (r >= 3 ? cloth[(r + c) % 3 === 0 ? 1 : 0] : DARK));
    }
    const wx = door + 3 < 0 ? Math.min(wallW - 5, door + 11) : Math.max(-wallW + 2, door - 8), n = K.group();        // a small window on the roomier side
    if (wx + 3 < door - 1 || wx > door + 7) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { K.put(wx + c, -6 + r, P.windowDay); K.lit(wx + c, -6 + r, n); }
      for (let c = -1; c <= 3; c++) K.put(wx + c, -3, P.trunkMid);
    }
    for (let j = 0; j < roofH; j++) {
      const t = (j + 1) / roofH, hw = Math.round(R * Math.sqrt(t) * 1.08 + 0.5), y = -8 - (roofH - 1) + j;
      const rope = j === Math.round(roofH * 0.45) || j === Math.round(roofH * 0.75);
      for (let x = -hw; x <= hw; x++) {
        let c = K.mul(K.covering('thatch', x + 40, j, ramp, salt), x < -hw * 0.35 ? 1.08 : x > hw * 0.4 ? 0.82 : 1);
        if (rope) c = K.mul(P.trunkMid, x > hw * 0.4 ? 0.8 : 1);
        if (Math.abs(x) === hw) c = K.mul(ramp[0], 0.85);
        if (S.snow && t < 0.5 && x < hw * 0.4 && Random.hash(x + 51, j) < 0.8) c = P.snow;
        K.put(x, y, c);
      }
    }
    K.put(0, -8 - roofH, ramp[0]); K.put(-1, -8 - roofH, ramp[1]);
    for (let x = -wallW; x <= wallW; x++) { if (Random.hash(x + salt, 7) < 0.5) K.put(x, -7, ramp[0]); K.shade(x, -6, 0.72); K.shade(x, -5, 0.88); }
    for (const [pxl, tall] of [[door + 7, 3], [door + 10, 2]]) if (pxl + 2 <= wallW + 3) {                    // clay pots by the door
      for (let r = 0; r < tall; r++) for (let c = 0; c < 3; c++) K.put(pxl + c, 1 - r, c === 0 ? [206, 124, 86] : c === 2 ? [138, 70, 48] : [176, 96, 66]);
      K.put(pxl + 1, 1 - tall, [110, 56, 40]);
    }
    return sprite({ shadowR: R * 1.15, footprint: Math.round(roofH * 0.6) }, { chimney: [0, -9 - roofH] });
  }

  function pick(rng, list) { return list[Math.floor(rng() * list.length)]; }

  return { TYPES, has, build, drawSails, begin, spire, parapet, topper, slit };
})();
