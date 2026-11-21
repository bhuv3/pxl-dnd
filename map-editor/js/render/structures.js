// The bigger outdoor builds and the bits that go with them, each one different for every seed: a castle keep,
// gatehouse and wall towers (all in the castle's colors), banners, a witch's hut on stilts, dead trees, a cauldron,
// a lighthouse with a turning beam, boats that bob on the water, headstones, crypts, ruined walls and an iron fence.
// The buildings among them are at the characters' scale and drawn from HouseKit's parts, like the houses and landmarks.
const Structures = (() => {
  let S = null, P = null, L = null;
  const TYPES = ['keep', 'gatehouse', 'walltower', 'banner', 'stilthut', 'deadtree', 'cauldron', 'lighthouse', 'boat',
    'headstone', 'crypt', 'ruinwall', 'ironfence'];
  const TURN = ['ruinwall', 'ironfence'];
  const GATE = 13;  // width of the gatehouse passage (the castle generator leaves this gap in the wall)
  // Coats of arms: [field, charge]. Every heraldic sprite picks one first thing (heraldryOf), so a castle can match.
  const ARMS = [
    [[168, 40, 48], [232, 196, 84]], [[44, 72, 156], [236, 232, 220]], [[40, 110, 70], [232, 196, 84]],
    [[110, 50, 140], [236, 232, 220]], [[34, 32, 38], [210, 50, 50]], [[236, 232, 220], [168, 40, 48]],
    [[212, 160, 50], [34, 32, 38]], [[60, 130, 170], [232, 196, 84]],
  ];
  const PATTERNS = ['pale', 'cross', 'chevron', 'roundel', 'chief'];
  const GOLD = [[150, 112, 40], [212, 170, 62], [246, 214, 120]];
  const DARK = [32, 28, 34];
  const BONE = [[176, 168, 146], [214, 208, 188], [238, 234, 220]];
  const PAINT = { white: [[176, 172, 164], [222, 218, 208], [246, 244, 236]], red: [[118, 34, 34], [160, 50, 46], [192, 78, 68]],
    black: [[30, 30, 36], [50, 50, 58], [78, 78, 88]], blue: [[36, 58, 104], [52, 84, 140], [84, 120, 176]], green: [[38, 74, 52], [54, 104, 72], [84, 138, 98]] };

  function has(type) { return TYPES.includes(type); }
  function canTurn(type) { return TURN.includes(type); }

  // Which coat of arms an object's seed gives (an index into ARMS). Sprites.build spends one number on size first.
  function heraldryOf(seed) {
    const rng = Random.makeRng(seed);
    rng();
    return Math.floor(rng() * ARMS.length);
  }

  // Builds one sprite. s, pal, dir: the sprite settings, palette and light direction from Sprites. turn: 1 for a
  // quarter-turned wall or fence. The buildings (castle parts, banner, stilt hut, lighthouse, crypt) are drawn with
  // HouseKit lit from the left, and mirrored when the light comes from the right.
  function build(type, rng, scale, s, pal, dir, turn) {
    S = s; P = pal; L = dir;
    Houses.begin(s, pal, dir);
    Landmarks.begin(s, pal, dir);
    const arms = Math.floor(rng() * ARMS.length);
    const big = { keep, gatehouse, walltower: wallTower, banner, stilthut: stiltHut, lighthouse, crypt }[type];
    if (big) { const made = big(rng, scale, arms); return L.x < 0 ? made : HouseKit.mirror(made); }
    switch (type) {
      case 'deadtree': return deadTree(rng, scale);
      case 'cauldron': return cauldron(rng);
      case 'boat': return boat(rng, scale);
      case 'headstone': return headstone(rng, scale);
      case 'ruinwall': return ruinWall(rng, scale, turn);
      default: return ironFence(scale, turn);
    }
  }

  // What HouseKit has drawn, as a sprite: its pixels, its lit windows, and whatever else it has (extra, more anchors).
  function sprite(extra, anchors) {
    const { px, glass } = HouseKit.finish(), all = { windows: glass, ...anchors };
    for (const k in all) if (!all[k] || (Array.isArray(all[k]) && !all[k].length)) delete all[k];
    return { px, ...extra, anchors: all };
  }

  // ---------- Castle ----------

  // A square stone keep on three or four floors, with a round turret at each corner (pointed roofs or battlements), rows
  // of arrow slits, a great pair of doors with torches, and the castle's banners hanging down the front.
  function keep(rng, scale, arms) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900), lights = [];
    const W = Math.max(41, k(58 + rng() * 12)) | 1, storeys = scale >= 0.85 && rng() < 0.5 ? 4 : 3, storeyH = 13, H = storeys * storeyH + 5;
    const x0 = -(W >> 1), x1 = W >> 1, ramp = Houses.wallColors(rng, 'stone'), tw = 6;
    K.start(P, S);
    K.wall(x0, x1, -H + 1, -K.BASE, 'stone', ramp, salt);
    K.foundation(x0, x1, 0);
    for (let n = 1; n < storeys; n++) for (let x = x0; x <= x1; x++) { K.put(x, -K.BASE - n * storeyH, ramp[2]); K.shade(x, -K.BASE - n * storeyH + 1, 0.8); }
    K.doorAt(-6, 0, [P.trunkDark, P.trunkMid], true, 12, 14);
    for (const lx of [-9, 8]) { K.put(lx, -9, P.iron); K.put(lx, -10, P.fire1); lights.push([lx, -10, 'torch']); }

    // The banners hang from under the battlements; arrow slits fill the rest of each floor.
    const hang = Math.min(22, storeyH * (storeys - 1) - 4), flags = [x0 + 15, x1 - 21], pattern = PATTERNS[arms % PATTERNS.length];
    for (let n = 0; n < storeys; n++) {
      const y = -K.BASE - (n + 1) * storeyH + 4;
      for (let off = 5; off <= (W >> 1) - 15; off += 10) for (const x of [-off - 1, off]) {
        if (n === 0 && Math.abs(x) < 12) continue;
        if (y < -H + 7 + hang && flags.some(bx => x + 1 >= bx - 2 && x <= bx + 8)) continue;
        Landmarks.slit(x, y, true);
      }
    }
    for (const bx of flags) { for (let x = bx - 1; x <= bx + 7; x++) K.put(x, -H + 4, P.iron); cloth(bx, -H + 5, 7, hang, ARMS[arms], pattern, 0.08); }
    Landmarks.parapet(x0 + 2 * tw + 1, x1 - 2 * tw - 1, -H, 0, ramp);

    // The corner turrets, a little taller; a pennant on the right-hand one.
    const pointed = rng() < 0.55, roof = Houses.roofColors(rng, pick(rng, ['slate', 'slate', 'tile', 'shingle'])), tTop = -H - 8 - Math.floor(rng() * 5);
    let flagAt = 0;
    for (const cx of [x0 + 4, x1 - 4]) {
      drum(cx, tw, tTop, -K.BASE, ramp, salt + cx);
      K.foundation(cx - tw, cx + tw, 0);
      for (let y = tTop + 8; y < -16; y += 17) Landmarks.slit(cx - 1, y, true);
      flagAt = pointed ? Landmarks.spire(cx, tw + 2.5, tTop - 1, 15 + Math.floor(rng() * 6), roof) : Landmarks.parapet(cx - tw, cx + tw, tTop - 1, cx, ramp);
    }
    pennant(x1 - 4, flagAt, ARMS[arms]);
    return sprite({ shadowR: W * 0.6, footprint: Math.round(W * 0.3) }, { lights });
  }

  // Two round towers either side of an arched gate (its portcullis drawn up), joined by a wall with battlements, torches
  // by the gate and the castle's banner over it. The passage between the towers is left open to walk through.
  function gatehouse(rng, scale, arms) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900), lights = [], blocks = [];
    const hg = GATE >> 1, tw = Math.max(6, k(8 + rng() * 2)), H = Math.max(34, k(46 + rng() * 10)), ramp = Houses.wallColors(rng, 'stone');
    const gateH = 17, archTop = -H + 8;
    const open = (x, y) => y > -gateH + 2 ? Math.abs(x) <= hg : y === -gateH + 2 ? Math.abs(x) <= hg - 1 : y === -gateH + 1 ? Math.abs(x) <= hg - 2 : y === -gateH && Math.abs(x) <= hg - 4;
    K.start(P, S);
    K.wall(-hg - 1, hg + 1, archTop, 0, 'stone', ramp, salt);              // the wall over the passage, with the arch cut out of it
    K.keep((x, y) => !open(x, y));
    for (let x = -hg + 3; x <= hg - 3; x++) K.put(x, -gateH - 1, ramp[2]);
    for (let x = -hg + 1; x <= hg - 1; x++) for (let y = -gateH; y <= -gateH + 6; y++) {      // the portcullis, drawn up
      if (open(x, y) && (y === -gateH + 3 || (x + hg) % 2 === 1)) K.put(x, y, y === -gateH + 6 ? P.ironLight : P.iron);
    }
    Landmarks.parapet(-hg, hg, archTop - 1, 0, ramp);
    const room = -gateH - 2 - archTop;
    if (room >= 9) { for (let x = -4; x <= 4; x++) K.put(x, archTop + 2, P.iron); cloth(-3, archTop + 3, 7, Math.min(14, room - 3), ARMS[arms], PATTERNS[arms % PATTERNS.length], 0.06); }

    // The towers, the torches beside the gate and a pennant on the taller one.
    const tall = rng() < 0.5 ? -1 : 1;
    for (const side of [-1, 1]) {
      const cx = side * (hg + 1 + tw), th = H + (side === tall ? 5 : 0);
      drum(cx, tw, -th + 1, -K.BASE, ramp, salt + cx + 7);
      K.foundation(cx - tw, cx + tw, 0);
      for (let y = -18; y > -th + 10; y -= 14) Landmarks.slit(cx - 1, y, true);
      const tip = Landmarks.parapet(cx - tw, cx + tw, -th, cx, ramp);
      if (side === tall) pennant(cx, tip, ARMS[arms]);
      for (let x = cx - tw; x <= cx + tw; x++) for (let y = -5; y <= 0; y++) blocks.push([x, y]);
      const lx = side * (hg + 3);
      K.put(lx, -gateH + 4, P.iron); K.put(lx, -gateH + 3, P.fire1);
      lights.push([lx, -gateH + 3, 'torch']);
    }
    return sprite({ blocks, shadowR: (hg + tw * 2) * 1.1 }, { lights });
  }

  // A round tower for the corners of the castle wall: arrow slits, battlements or a pointed roof, sometimes a torch or
  // a pennant in the castle's colors.
  function wallTower(rng, scale, arms) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900), lights = [];
    const hw = Math.max(7, k(9 + rng() * 2)), H = Math.max(32, k(44 + rng() * 12)), ramp = Houses.wallColors(rng, 'stone');
    K.start(P, S);
    drum(0, hw, -H + 1, -K.BASE, ramp, salt);
    K.foundation(-hw, hw, 0);
    for (let y = -16, n = 0; y > -H + 9; y -= 14, n++) Landmarks.slit(n % 2 ? -4 : 2, y, true);
    let tip;
    if (rng() < 0.65) {
      tip = Landmarks.parapet(-hw, hw, -H, 0, ramp);
      if (rng() < 0.6) { K.put(hw + 2, -H - 2, P.iron); K.put(hw + 2, -H - 3, P.fire1); lights.push([hw + 2, -H - 3, 'torch']); }
    } else tip = Landmarks.spire(0, hw + 2.5, -H, Math.round(hw * 1.9 + rng() * 5), Houses.roofColors(rng, pick(rng, ['slate', 'tile', 'shingle'])));
    if (rng() < 0.6) pennant(0, tip, ARMS[arms]);
    return sprite({ shadowR: hw * 1.3, footprint: 8 }, { lights });
  }

  // A banner on a pole: a gold finial, a crossbar, and the cloth hanging from it, swaying in the wind.
  function banner(rng, scale, arms) {
    const K = HouseKit, H = Math.max(20, Math.round((28 + rng() * 6) * scale)), len = Math.max(10, Math.round((14 + rng() * 4) * scale));
    K.start(P, S);
    for (let y = -H; y <= 0; y++) { K.put(0, y, P.trunkMid); K.put(1, y, P.trunkDark); }
    for (let x = -5; x <= 6; x++) K.put(x, -H + 3, P.trunkDark);
    for (const [x, y, c] of [[0, -H - 1, GOLD[1]], [1, -H - 1, GOLD[0]], [0, -H - 2, GOLD[2]], [1, -H - 2, GOLD[1]], [0, -H - 3, GOLD[2]]]) K.put(x, y, c);
    for (let x = -2; x <= 3; x++) K.put(x, 0, x < 1 ? P.rockLight : P.rockMid);
    cloth(-3, -H + 4, 7, Math.min(len, H - 9), ARMS[arms], PATTERNS[arms % PATTERNS.length], 0.15);
    return sprite({ shadowR: 2, blocks: [[0, 0], [1, 0]] });
  }

  // Hanging cloth w × h from (x0, y0), in a coat of arms, with a swallowtail. Each row sways a little more.
  function cloth(x0, y0, w, h, [field, charge], pattern, sway) {
    const K = HouseKit, mid = x0 + (w >> 1), third = Math.floor(h / 3);
    for (let r = 0; r < h; r++) for (let x = x0; x < x0 + w; x++) {
      const d = Math.abs(x - mid);
      if (r >= h - 3 && d <= r - (h - 3)) continue;                         // the swallowtail's notch
      const on = pattern === 'pale' ? d === 0 && r < h - 3 : pattern === 'cross' ? (d === 0 && r < h - 3) || r === third || r === third + 1
        : pattern === 'chevron' ? r - third === d || r - third - 1 === d : pattern === 'roundel' ? Math.hypot(x - mid, r - h * 0.4) < w / 3.4 : r < Math.max(2, h / 5);
      K.put(x, y0 + r, on ? charge : x === x0 + w - 1 || r === 0 ? shade(field, 0.72) : x === x0 ? shade(field, 1.12) : field, sway + r * 0.05);
    }
  }

  // A pole on top of a roof or tower (tip: its top row) with a triangular flag that flutters.
  function pennant(x, tip, [field, charge]) {
    const K = HouseKit;
    for (let r = 1; r <= 9; r++) K.put(x, tip - r, P.trunkDark);
    for (let r = 0; r < 5; r++) for (let c = 1; c <= 9 - r * 2; c++) K.put(x + c, tip - 9 + r, r === 2 && c === 2 ? charge : r === 0 ? shade(field, 1.12) : field, c * 0.3);
  }

  // A round stone tower, cx ± hw, rows top to bottom: coursed blocks, lit on the left and falling into shade on the right.
  function drum(cx, hw, top, bottom, ramp, salt) {
    const K = HouseKit;
    K.wall(cx - hw, cx + hw, top, bottom, 'stone', ramp, salt);
    for (let y = top; y <= bottom; y++) {
      for (let x = cx - hw; x <= cx + hw; x++) { const t = (x - cx) / hw; K.shade(x, y, t < -0.5 ? 1.08 : t < 0.15 ? 1 : t < 0.6 ? 0.88 : 0.74); }
      K.put(cx - hw, y, ramp[2]); K.put(cx + hw, y, K.mul(ramp[0], 0.8));
    }
  }

  // ---------- Swamp ----------

  // A crooked little hut on stilts: a leaning plank house on a platform, a mossy thatch roof, a round window that
  // glows at night, a stovepipe, a ladder down, and herbs and a skull hanging from the platform's edge.
  function stiltHut(rng, scale) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900), lights = [], blocks = [];
    const W = Math.max(19, k(24 + rng() * 6)), wallH = 13, legs = Math.max(9, k(12 + rng() * 6)), roofH = 12 + Math.floor(rng() * 3);
    const lean = (rng() < 0.5 ? -1 : 1) * (0.1 + rng() * 0.07), side = rng() < 0.5 ? -1 : 1, x0 = -(W >> 1), x1 = x0 + W - 1, deck = -legs - 1;
    const wood = [[52, 46, 34], [74, 64, 44], [98, 86, 60]], shift = (x, y) => [x + Math.round(-y * lean), y + deck - 1];

    // The hut on its own, upright: walls, a door toward the porch, a round window, the roof and its stovepipe.
    K.start(P, S);
    K.wall(x0, x1, -wallH + 1, 0, 'plank', Houses.wallColors(rng, rng() < 0.5 ? 'plank' : 'log').map(c => [c[0] * 0.72, c[1] * 0.78, c[2] * 0.66]), salt);
    const dx = side > 0 ? x1 - 8 : x0 + 3;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 6; c++) if (!(r === 9 && (c === 0 || c === 5))) K.put(dx + c, -r, c === 0 || c === 5 || r === 9 ? wood[0] : c === 3 ? wood[0] : wood[1]);
    const wx = side > 0 ? x0 + 6 : x1 - 6, wy = -wallH + 6, n = K.group();
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const d = Math.hypot(ox, oy);
      if (d > 2.6) continue;
      if (d > 1.7) { K.put(wx + ox, wy + oy, wood[0]); continue; }
      K.put(wx + ox, wy + oy, ox || oy ? [120, 150, 70] : P.windowDay);
      K.lit(wx + ox, wy + oy, n);
    }
    const ridge = K.ridgeRoof(x0, x1, -wallH + 2, roofH, 'thatch', Houses.roofColors(rng, 'thatch').map(c => [c[0] * 0.62, c[1] * 0.72, c[2] * 0.5]), salt, [P.trunkDark, P.trunkMid]);
    for (let y = ridge; y <= -wallH + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) if (Random.hash(x + salt, y * 3) < 0.13) K.tint(x, y, [0.62, 1.02, 0.55]);       // moss
    const pipeX = side > 0 ? x0 + 4 : x1 - 5;
    for (let y = ridge - 6; y <= ridge + 3; y++) for (let c = 0; c < 2; c++) K.put(pipeX + c + (y < ridge - 2 ? side : 0), y, c ? P.iron : P.ironLight);
    const house = K.finish();

    // The stilts with their braces, the platform (a porch on the ladder's side), the ladder, and things hanging down.
    K.start(P, S);
    const stilts = [x0 + 1, Math.round(x0 + W * 0.36), Math.round(x1 - W * 0.36) - 1, x1 - 2];
    stilts.forEach((sx, i) => {
      const kink = Random.hash(sx + 5, i) < 0.5 ? 0 : side;
      for (let y = deck + 1; y <= 0; y++) { const x = sx + (y > deck / 2 ? 0 : kink); K.put(x, y, y === 0 ? wood[0] : wood[2]); K.put(x + 1, y, wood[0]); }
      blocks.push([sx, 0], [sx + 1, 0]);
    });
    for (const [a, b] of [[stilts[0], stilts[1]], [stilts[3], stilts[2]]]) for (let i = 0, span = Math.abs(b - a); i <= span; i++) K.put(a + Math.sign(b - a) * i, Math.round(deck + 2 + i / span * (legs - 4)), wood[0]);
    const px0 = x0 - 3 + (side < 0 ? -7 : 0), px1 = x1 + 3 + (side > 0 ? 7 : 0);
    for (let x = px0; x <= px1; x++) { K.put(x, deck, (x - px0) % 4 ? wood[2] : wood[1]); K.put(x, deck + 1, wood[1]); K.put(x, deck + 2, wood[0]); }
    const lx = side > 0 ? px1 - 5 : px0 + 1;
    for (let y = deck + 3; y <= 0; y++) { K.put(lx, y, wood[1]); K.put(lx + 4, y, wood[1]); if (y % 3 === 0) for (let c = 1; c <= 3; c++) K.put(lx + c, y, wood[2]); }
    blocks.push([lx + 2, 0]);
    const hangX = side > 0 ? px0 + 2 : px1 - 2;
    for (let i = 0; i < 3; i++) for (let r = 0; r < 2 + i % 2; r++) K.put(hangX + i * 3 * side, deck + 3 + r, i === 1 ? [140, 120, 60] : [70, 110, 50], 0.2 + r * 0.05);
    for (let r = 0; r < 4; r++) for (let c = -1; c <= 1; c++) if (!(r === 3 && c)) K.put(hangX + 10 * side + c, deck + 3 + r, r === 1 && c ? DARK : BONE[r === 0 ? 2 : 1], 0.25);

    // The hut goes on the platform, leaning.
    for (const q of house.px) { const [x, y] = shift(q.x, q.y); K.put(x, y, q.c, q.w); }
    for (const [x, y, id] of house.glass) { const [gx, gy] = shift(x, y); K.lit(gx, gy, id); }
    const lamp = shift(wx, wy + 1), pipe = shift(pipeX + side, ridge - 7);
    return sprite({ blocks, shadowR: W * 0.55 }, { lights: [[lamp[0], lamp[1], 'candle']], chimney: pipe });
  }

  // A bare, twisted dead tree: a gnarled trunk splitting into crooked branches, some with grey moss hanging off.
  function deadTree(rng, scale) {
    const px = [], H = Math.max(14, Math.round((24 + rng() * 16) * scale));          // twice a person's height, like the living trees
    const bark = rng() < 0.6 ? [[52, 46, 44], [78, 70, 64], [108, 98, 88]] : [P.trunkDark, P.trunkMid, P.trunkLight];
    const moss = rng() < 0.6, litLeft = L.x < 0;
    const sway = y => Math.max(0, Math.min(1, -y / H)) * 0.6;
    const branch = (x, y, a, len, thick, depth) => {
      for (let t = 0; t < len; t++) {
        x += Math.cos(a); y += Math.sin(a); a += (rng() - 0.5) * 0.4;
        for (let k = 0; k < thick; k++) {
          const c = thick === 1 ? bark[1] : k === 0 ? (litLeft ? bark[2] : bark[0]) : k === thick - 1 ? (litLeft ? bark[0] : bark[2]) : bark[1];
          put(px, Math.round(x) + k - (thick >> 1), Math.round(y), c, sway(y));
        }
        if (depth < 3 && t > len * 0.35 && t < len - 1 && rng() < 0.2) branch(x, y, a + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.6), len * 0.5, Math.max(1, thick - 1), depth + 1);
      }
      if (depth < 3 && len > 3) {
        branch(x, y, a - 0.4 - rng() * 0.4, len * 0.6, Math.max(1, thick - 1), depth + 1);
        branch(x, y, a + 0.4 + rng() * 0.4, len * 0.6, Math.max(1, thick - 1), depth + 1);
      } else if (moss && rng() < 0.6) {
        for (let k = 1, n = 2 + Math.floor(rng() * 4); k <= n; k++) put(px, Math.round(x), Math.round(y) + k, k % 2 ? [120, 128, 104] : [96, 104, 84], sway(y) + 0.2);
      }
    };
    branch(0, 1, -Math.PI / 2 + (rng() - 0.5) * 0.4, H * 0.5, H > 30 ? 5 : 4, 0);
    for (const s of [-1, 1]) { put(px, s * 3, 0, bark[0], 0); put(px, s * 3, -1, bark[0], 0); if (rng() < 0.6) put(px, s * 4, 0, bark[0], 0); }
    if (rng() < 0.5) put(px, 0, -Math.round(H * 0.25), DARK, 0);
    return { px, shadowR: 4, blocks: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] };
  }

  // A black pot on three legs over a small fire, full of something green and bubbling.
  function cauldron(rng) {
    const px = [], litLeft = L.x < 0, black = [24, 24, 28], brew = [[92, 176, 64], [170, 236, 110]];
    // [row, half width] from the rim down: the brew inside the rim, the front lip, then the round body.
    [[-13, 5], [-12, 6], [-11, 6], [-10, 7], [-9, 7], [-8, 7], [-7, 7], [-6, 7], [-5, 6], [-4, 5], [-3, 3]].forEach(([y, half], r) => {
      for (let x = -half; x <= half; x++) {
        const lit = (x < 0) === litLeft && Math.abs(x) >= half - 2;
        fixed(px, x, y, r < 2 ? (Math.abs(x) === half ? P.ironLight : brew[(x + 7 + r) % 3 === 0 ? 1 : 0]) : r === 2 ? P.ironLight : lit ? P.iron : black);
      }
    });
    for (const bx of [-2, 1, 3]) if (rng() < 0.6) { fixed(px, bx, -14, brew[1]); if (rng() < 0.5) fixed(px, bx, -15, brew[0]); }
    for (const x of [-6, -5, 5, 6]) for (let y = -2; y <= 0; y++) fixed(px, x, y, black);
    for (let x = -4; x <= 4; x++) { fixed(px, x, 0, x % 2 ? P.trunkMid : P.trunkDark); fixed(px, x, -1, x % 3 ? P.fire3 : P.fire2); }
    return { px, shadowR: 6, footprint: 4, anchors: { light: [0, -1, 'torch'] } };
  }

  // ---------- Harbor ----------

  // A tall tower that narrows as it rises, painted in bands (or plain), a railed gallery and a glass lamp room
  // under a dome. The lamp shines at night and its beam turns (Details.addBeams). Some have a keeper's cottage.
  function lighthouse(rng, scale) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900);
    const wb = Math.max(19, k(26 + rng() * 5)) | 1, wt = wb - 8, H = Math.max(46, k(66 + rng() * 18));
    const scheme = pick(rng, [['white', 'red'], ['white', 'red'], ['white', 'black'], ['white'], ['stone']]);
    const bandH = Math.max(9, Math.round(H / (5 + Math.floor(rng() * 3)))), hb = wb >> 1, halfAt = y => Math.round(hb - (wb - wt) / 2 * (-y / H));
    K.start(P, S);
    if (rng() < 0.5) cottage(rng, (rng() < 0.5 ? -1 : 1), hb, salt);       // the keeper's cottage, behind one side

    for (let y = -H + 1; y <= 0; y++) {                                      // the tower: bands of paint (or stone), shaded round
      const hw = halfAt(y), band = scheme[Math.floor(-y / bandH) % scheme.length], ramp = band === 'stone' ? [P.stoneDark, P.stone, P.stoneLight] : PAINT[band];
      for (let x = -hw; x <= hw; x++) {
        const t = x / hw;
        let c = shade(ramp[t < -0.5 ? 2 : 1], t < 0.15 ? 1 : t < 0.6 ? 0.88 : 0.74);
        if (band === 'stone' && (-y % 3 === 2 || (x + hw + (Math.floor(-y / 3) % 2) * 3) % 6 === 0)) c = P.stoneMortar;
        if (Math.abs(x) === hw || y === 0) c = shade(ramp[0], x < 0 ? 1.1 : 0.8);
        K.put(x, y, c);
      }
    }
    K.foundation(-hb, hb, 0);
    K.doorAt(-3, 0, [P.trunkDark, P.trunkMid], true);
    for (let y = -24, i = 0; y > -H + 10; y -= 16, i++) if (halfAt(y) >= 5) K.attic(i % 2 ? 1 : -1, y, [P.iron, P.ironLight]);

    // The gallery with its rail, the lamp room, the dome and its vane.
    const g = -H, gw = halfAt(-H + 1) + 4, lw = Math.max(4, (wt >> 1) - 1), lampY = g - 7, n = K.group();
    for (let x = -gw; x <= gw; x++) {
      K.put(x, g, P.iron); K.put(x, g + 1, [40, 40, 46]); K.put(x, g - 4, P.iron);
      if (Math.abs(x) === gw || (x + gw) % 3 === 0) for (let r = 1; r <= 3; r++) K.put(x, g - r, P.ironLight);
    }
    for (let y = g - 12; y <= g - 1; y++) for (let x = -lw; x <= lw; x++) {
      const bar = Math.abs(x) === lw || x % 3 === 0 && y % 4 === 0 || y === g - 12;
      K.put(x, y, bar ? P.iron : Math.abs(x) <= 1 && Math.abs(y - lampY) <= 1 ? [255, 240, 190] : [196, 214, 220]);
      if (!bar) K.lit(x, y, n);
    }
    const dome = scheme.includes('red') ? PAINT.red : scheme.includes('black') ? PAINT.black : [[62, 112, 98], [92, 150, 128], [136, 192, 168]];
    for (let j = 0; j < 7; j++) {
      const w = Math.round((lw + 2.5) * Math.sqrt(1 - (j / 7) ** 2));
      for (let x = -w; x <= w; x++) K.put(x, g - 13 - j, j === 0 || Math.abs(x) === w ? shade(dome[0], 0.85) : S.snow && j > 3 ? P.snow : x < -w * 0.3 ? dome[2] : x > w * 0.4 ? dome[0] : dome[1]);
    }
    for (let r = 0; r < 4; r++) K.put(0, g - 20 - r, r > 1 ? P.ironLight : P.iron);
    for (let i = 0; i < 9; i++) K.put(Math.round((rng() - 0.5) * (wb + 12)), 1 + Math.floor(rng() * 2), i % 2 ? P.rockMid : P.rockLight);
    return sprite({ shadowR: wb * 0.8, footprint: 8, beam: { x: 0, y: lampY } }, { lights: [[0, lampY, 'lantern']] });
  }

  // The lighthouse keeper's cottage: a small house standing behind the tower, to one side of it.
  function cottage(rng, side, hb, salt) {
    const K = HouseKit, cw = 22, cx0 = side > 0 ? hb - 4 : -hb + 4 - cw, cx1 = cx0 + cw - 1, kind = pick(rng, ['plaster', 'stone', 'plank']);
    const top = -K.BASE - K.STOREY + 1;
    K.wall(cx0, cx1, top, -K.BASE, kind, Houses.wallColors(rng, kind), salt + 3);
    K.foundation(cx0, cx1, 0);
    K.windowAt(side > 0 ? cx1 - 10 : cx0 + 4, -K.BASE - 9, Houses.trimColors(rng));
    const roof = pick(rng, ['slate', 'tile']);
    K.ridgeRoof(cx0, cx1, top + 1, 11, roof, Houses.roofColors(rng, roof), salt, [P.trunkDark, P.trunkMid]);
  }

  // A rowboat with its oars shipped, or a sailboat with a mast and a sail that sways. Bobs on the water.
  function boat(rng, scale) {
    const px = [], sail = rng() < 0.5, dir = rng() < 0.5 ? 1 : -1;
    const a = Math.max(7, Math.round((sail ? 16 + rng() * 5 : 10 + rng() * 3) * scale));       // a rowboat seats two, a sailboat is longer
    const hull = pick(rng, [[P.woodDark, P.wood, P.woodLight], PAINT.red, PAINT.blue, PAINT.green, PAINT.white, PAINT.black]);
    const rim = hull === PAINT.white ? P.wood : P.woodLight;
    // Side of the hull (3 rows, narrower at the keel, the bow end raised), then the inside and the far rim.
    for (let r = 0; r < 3; r++) {
      const from = -a + (2 - r), to = a - (2 - r) + (r === 2 ? 1 : 0);
      for (let x = from; x <= to; x++) fixed(px, x * dir, -r, r === 0 ? hull[0] : r === 2 ? rim : hull[1]);
    }
    fixed(px, (a + 1) * dir, -3, rim);
    for (let x = -a + 1; x <= a - 1; x++) {
      fixed(px, x * dir, -3, (x + a) % 4 === 0 ? P.woodLight : P.woodDark);
      if (Math.abs(x) <= a - 2) fixed(px, x * dir, -4, rim);
    }
    for (const x of [-a - 1, a + 2]) fixed(px, x * dir, 0, P.foam);
    if (!sail) {
      for (const s of [-1, 1]) for (let k = 0; k <= 5; k++) fixed(px, s * (a - 4 + k), -4 + k, k === 5 ? P.woodLight : P.trunkMid);
      return { px, shadowR: 0, footprint: 2, bob: true };
    }
    const mx = Math.round(a * 0.2) * dir, mh = Math.max(14, Math.round((22 + rng() * 8) * scale)), boomEnd = mx - Math.round(a * 0.9) * dir;
    const cloth = pick(rng, [P.canvasLight, P.canvas, [214, 160, 130], [236, 232, 220], PAINT.red[1]]), stripe = rng() < 0.4;
    for (let y = -mh; y <= -4; y++) put(px, mx, y, P.trunkDark, (-y - 4) / mh * 0.5);
    for (let k = 0; k <= Math.abs(boomEnd - mx); k++) put(px, mx - k * dir, -6, P.trunkMid, 0.1);
    for (let y = -mh + 1; y <= -7; y++) {
      const t = (y + mh) / (mh - 7), reach = Math.round(t * Math.abs(boomEnd - mx));
      for (let k = 1; k <= reach; k++) put(px, mx - k * dir, y, stripe && Math.abs(y + mh * 0.55) < 1 ? PAINT.red[1] : k === reach ? shade(cloth, 0.82) : cloth, (-y - 4) / mh * 0.5);
    }
    put(px, mx + dir, -mh, PAINT.red[1], 0.6); put(px, mx + 2 * dir, -mh, PAINT.red[1], 0.7);
    return { px, shadowR: 0, footprint: 2, bob: true };
  }

  // ---------- Graveyard and ruins ----------

  // A headstone: rounded, a cross, a slab, an obelisk, a Celtic cross or a broken one, some leaning, mossy, with a
  // mound of earth in front, sometimes flowers or a candle on it.
  function headstone(rng, scale) {
    const px = [], lights = [], kind = pick(rng, ['round', 'round', 'cross', 'slab', 'obelisk', 'broken', 'celtic']);
    const stone = pick(rng, [[P.stoneDark, P.stone, P.stoneLight], [[86, 88, 94], [112, 114, 122], [146, 148, 156]], [[120, 110, 94], [150, 138, 118], [180, 168, 146]]]);
    const big = 1, tilt = rng() < 0.35 ? (rng() < 0.5 ? -2 : 2) : 0, litLeft = L.x < 0;       // chest-high to a person
    // Rows from the top as [from, to] spans.
    const shapes = {
      round: [[-1, 1], [-2, 2], [-2, 2], [-2, 2], [-2, 2], [-2, 2], [-2, 2]],
      slab: [[-2, 2], [-2, 2], [-2, 2], [-2, 2], [-2, 2], [-2, 2]],
      broken: [[-2, 0], [-2, 1], [-2, 2], [-2, 2], [-2, 2]],
      cross: [[0, 0], [-2, 2], [0, 0], [0, 0], [0, 0], [0, 0], [-1, 1]],
      celtic: [[0, 0], [-1, 1], [-2, 2], [-1, 1], [0, 0], [0, 0], [0, 0], [-1, 1]],
      obelisk: [[0, 0], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [-2, 2], [-2, 2]],
    };
    const rows = shapes[kind].flatMap(r => big ? [r.map(v => v * 2), r.map(v => v * 2)] : [r]), H = rows.length;
    rows.forEach(([from, to], k) => {
      const y = -H + 1 + k, lean = tilt && k < H / 2 ? tilt : 0;
      for (let x = from; x <= to; x++) {
        let c = k === 0 || x === (litLeft ? from : to) ? stone[2] : x === (litLeft ? to : from) ? stone[0] : stone[1];
        if ((kind === 'round' || kind === 'slab') && k >= 2 && k <= 3 && Math.abs(x) <= 1 && (x + k) % 2 === 0) c = P.stoneMortar;
        if (kind === 'celtic' && k === 2 && Math.abs(x) === 1) c = stone[0];
        if (k > H - 3 && rng() < 0.3) c = rng() < 0.5 ? P.mossDark : P.mossLight;
        fixed(px, x + lean, y, c);
      }
    });
    if (kind === 'broken') for (let k = 0; k < 4; k++) fixed(px, 5 + k, -(k % 2), stone[k % 2]);
    if (rng() < 0.7) {
      const old = rng() < 0.4;
      for (let y = 1; y <= 5; y++) for (let x = -5 + (y === 5 ? 1 : 0); x <= 5 - (y === 5 ? 1 : 0); x++) {
        fixed(px, x, y, old ? (Random.hash(x + 3, y) < 0.5 ? P.grassDark : P.grassLight) : y === 1 ? P.dirtLight : Random.hash(x, y + 5) < 0.4 ? P.dirtDark : P.dirt);
      }
      const extra = rng();
      if (extra < 0.25) for (let k = 0; k < 4; k++) { fixed(px, -3 + k * 2, 2 + (k % 2), [P.flower1, P.flower3, P.flower2, P.flower1][k]); fixed(px, -3 + k * 2, 3 + (k % 2), P.canopyMid); }
      else if (extra < 0.38) { fixed(px, 3, 2, P.mushroomStem); fixed(px, 3, 1, P.mushroomStem); fixed(px, 3, 0, P.mushroomSpot); lights.push([3, 0, 'candle']); }
    }
    return { px, shadowR: 3, blocks: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]], anchors: lights.length ? { lights } : undefined };
  }

  // A stone mausoleum: columns, a pediment with a carving, an iron door or a dark stair going down, urns on the
  // corners, sometimes a statue or a cross on top, ivy, and a lantern by the door.
  function crypt(rng, scale) {
    const K = HouseKit, k = v => Math.round(v * scale), salt = 1 + Math.floor(rng() * 900), lights = [];
    const W = Math.max(27, k(34 + rng() * 10)) | 1, wallH = Math.max(16, k(20 + rng() * 4)), x0 = -(W >> 1), x1 = W >> 1;
    const ramp = Houses.wallColors(rng, 'stone').map(c => shade(c, 0.85)), top = -wallH + 1, ph = Math.max(6, Math.round(W / 5));
    K.start(P, S);
    K.wall(x0, x1, top, -K.BASE, 'stone', ramp, salt);
    K.foundation(x0 - 1, x1 + 1, 0);
    for (let x = x0 - 2; x <= x1 + 2; x++) { K.put(x, top - 2, ramp[2]); K.put(x, top - 1, ramp[1]); K.shade(x, top, 0.7); }       // the cornice
    for (let j = 1; j <= ph; j++) {                                          // the pediment
      const hw = Math.round((W / 2 + 2) * (1 - j / (ph + 1)));
      for (let x = -hw; x <= hw; x++) K.put(x, top - 2 - j, x === -hw ? ramp[2] : x === hw ? ramp[0] : j === 1 ? shade(ramp[1], 0.85) : ramp[1]);
    }
    carving(pick(rng, ['skull', 'cross', 'ring']), top - 2 - Math.ceil(ph / 2), ramp);

    // Columns, the door (iron, or a stair going down into the dark) and a step.
    const cols = W >= 37 && rng() < 0.6 ? [x0 + 2, -10, 8, x1 - 4] : [x0 + 2, x1 - 4];
    for (const cx of cols) for (let y = top + 1; y <= -K.BASE; y++) {
      K.put(cx, y, ramp[2]); K.put(cx + 1, y, ramp[1]); K.put(cx + 2, y, ramp[0]);
      if (y === top + 1 || y === -K.BASE) { K.put(cx - 1, y, ramp[2]); K.put(cx + 3, y, ramp[0]); }
    }
    const stair = rng() < 0.4;
    for (let r = 0; r < 12; r++) for (let c = 0; c < 8; c++) {
      if (r === 11 && (c === 0 || c === 7)) continue;
      const edge = c === 0 || c === 7 || r === 11 || (r === 10 && (c === 1 || c === 6));
      K.put(-4 + c, -r, stair ? (!edge && r < 5 ? (r % 2 ? [40, 36, 42] : [72, 68, 72]) : DARK) : edge ? P.iron : c % 2 && r % 4 === 2 ? P.ironLight : [42, 44, 50]);
    }
    for (let x = -6; x <= 5; x++) { K.put(x, 1, P.rockLight); K.put(x, 2, P.rockMid); }

    // Urns on the corners, something on the pediment, ivy, cracks, a lantern.
    for (const ux of [x0 - 1, x1 + 1]) for (const [dx, dy, c] of [[0, 0, 1], [-1, -1, 2], [0, -1, 1], [1, -1, 0], [-1, -2, 2], [0, -2, 1], [1, -2, 0], [0, -3, 1]]) K.put(ux + dx, top - 3 + dy, ramp[c]);
    const peak = top - 2 - ph, on = rng();
    if (on < 0.35) for (const [ax, ay] of ANGEL) for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) K.put(ax * 2 + u, peak + ay * 2 + v, ax < 0 ? P.stoneLight : ax > 0 ? P.stoneDark : P.stone);
    else if (on < 0.68) { for (let r = 1; r <= 8; r++) for (const c of [0, 1]) K.put(c, peak - r, c ? ramp[0] : ramp[2]); for (let x = -2; x <= 3; x++) for (const r of [5, 6]) K.put(x, peak - r, x > 1 ? ramp[0] : ramp[1]); }
    if (rng() < 0.5) { const left = rng() < 0.5; K.ivy(left ? x0 : x1, -K.BASE, Math.round(wallH * (0.5 + rng() * 0.4)), left ? 1 : -1, salt); }
    for (let i = 0; i < 6; i++) K.shade(x0 + 1 + Math.floor(rng() * (W - 2)), -2 - Math.floor(rng() * (wallH - 4)), 0.65);
    if (rng() < 0.4) lights.push([...K.lantern(6, -9), 'lantern']);
    return sprite({ shadowR: W * 0.55, footprint: Math.round(W * 0.35) }, { lights });
  }

  // A statue of an angel, as offsets from the top of the pediment (drawn at twice the size).
  const ANGEL = [[0, -7], [-1, -6], [0, -6], [1, -6], [-3, -5], [-2, -5], [0, -5], [2, -5], [3, -5], [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4],
    [-1, -3], [0, -3], [1, -3], [-1, -2], [0, -2], [1, -2], [-1, -1], [0, -1], [1, -1]];

  // What is carved on a crypt's pediment, centred on row cy: a skull, a cross or a ring.
  function carving(kind, cy, ramp) {
    const K = HouseKit, dark = shade(ramp[0], 0.8);
    if (kind === 'skull') { for (let y = -2; y <= 0; y++) for (let x = -2; x <= 2; x++) if (!(y === -2 && Math.abs(x) === 2)) K.put(x, cy + y, y === -1 && Math.abs(x) === 1 ? DARK : BONE[x < 0 ? 2 : 1]); for (let x = -1; x <= 1; x++) K.put(x, cy + 1, x ? BONE[1] : DARK); }
    else if (kind === 'cross') { for (let y = -2; y <= 2; y++) K.put(0, cy + y, dark); for (let x = -2; x <= 2; x++) K.put(x, cy - 1, dark); }
    else for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.abs(Math.hypot(x, y) - 2) < 0.6) K.put(x, cy + y, dark);
  }

  // A broken stretch of old stone wall: a jagged top, maybe a gap where a window was, moss, ivy and fallen stones at
  // its foot. Turned, it runs up and down the map.
  function ruinWall(rng, scale, turn) {
    const px = [], blocks = [];
    const len = Math.max(10, Math.round((14 + rng() * 12) * scale)), H = Math.max(8, Math.round((10 + rng() * 8) * scale));
    const ramp = Houses.wallColors(rng, 'stone').map(c => shade(c, 0.9)), litLeft = L.x < 0;
    const tops = [];
    for (let k = 0, h = Math.round(H * (0.5 + rng() * 0.5)); k < len; k++) {
      h += Math.round((rng() - 0.5) * 3);
      if (rng() < 0.06) h = 2 + Math.floor(rng() * 2);
      h = Math.max(2, Math.min(H, h));
      tops.push(h);
    }
    const top = () => rng() < 0.35 ? (rng() < 0.5 ? P.mossDark : P.mossLight) : ramp[2];
    if (turn) {
      for (let k = len - 1; k >= 0; k--) {
        const h = tops[k];
        for (let y = -k - h; y <= -k; y++) for (let x = -1; x <= 1; x++) {
          const c = y <= -k - h + 1 ? (x === 0 ? top() : ramp[1]) : x === (litLeft ? -1 : 1) ? ramp[1] : x === 0 ? ramp[1] : ramp[0];
          fixed(px, x, y, (k + y) % 3 === 0 && x === 0 && y > -k - h + 1 ? P.stoneMortar : c);
        }
        blocks.push([0, -k]);
      }
      return { px, shadowR: 2, blocks };
    }
    const x0 = -(len >> 1), hole = len >= 14 && H >= 10 && rng() < 0.45 ? x0 + (len >> 1) - 1 : null;
    for (let k = 0; k < len; k++) {
      const x = x0 + k, h = tops[k], course = (r) => Math.floor(r / 3);
      for (let r = 0; r < h; r++) {
        const y = -r, off = course(r) % 2 ? 2 : 0;
        if (hole !== null && x >= hole && x <= hole + 2 && r >= Math.round(H * 0.35) && r <= Math.round(H * 0.7) && !(r === Math.round(H * 0.7) && x !== hole + 1)) continue;
        let c = r % 3 === 2 || (k + off) % 4 === 0 ? P.stoneMortar : Random.hash(Math.floor((k + off) / 4), course(r) + 31) < 0.25 ? ramp[2] : ramp[1];
        if (k === 0 || k === len - 1) c = (k === 0) === litLeft ? ramp[2] : ramp[0];
        fixed(px, x, y, c);
      }
      fixed(px, x, -h, top());
      fixed(px, x, -h - 1, tops[k] >= 3 ? ramp[2] : ramp[1]);
      blocks.push([x, 0]);
    }
    if (rng() < 0.5) Houses.ivy(px, rng, rng() < 0.5 ? x0 : x0 + len - 1, Math.min(...tops));
    for (let k = 0, n = 2 + Math.floor(rng() * 4); k < n; k++) {
      const x = x0 - 2 + Math.floor(rng() * (len + 4)), y = 1 + Math.floor(rng() * 2);
      fixed(px, x, y - 1, ramp[2]); fixed(px, x, y, ramp[0]); if (rng() < 0.5) { fixed(px, x + 1, y - 1, ramp[1]); fixed(px, x + 1, y, ramp[0]); }
    }
    return { px, shadowR: len * 0.4, blocks };
  }

  // Iron railings with spear tips between stone posts. Turned, it runs up and down the map.
  function ironFence(scale, turn) {
    const px = [], len = Math.max(6, Math.round(11 * scale)), half = len >> 1, blocks = [];
    if (!turn) {
      for (let k = 0; k < len; k++) {
        const x = k - half, post = k === 0 || k === len - 1;
        if (post) { for (let y = -7; y <= 0; y++) fixed(px, x, y, y === -7 ? P.stoneLight : P.stone); continue; }
        fixed(px, x, -5, P.iron); fixed(px, x, -1, P.iron);
        if (k % 2 === 0) { for (let y = -6; y <= 0; y++) fixed(px, x, y, P.iron); fixed(px, x, -7, P.ironLight); }
      }
      return { px, shadowR: 0, footprint: 1 };
    }
    for (let k = len - 1; k >= 0; k--) {
      const y = -k, post = k === 0 || k === len - 1;
      for (let r = 0; r <= 6; r++) fixed(px, 0, y - r, post ? (r === 6 ? P.stoneLight : P.stone) : r === 6 && k % 2 === 0 ? P.ironLight : P.iron);
      blocks.push([0, y]);
    }
    return { px, shadowR: 0, blocks };
  }

  // ---------- Helpers ----------

  function shade(c, f) { return c.map(v => Math.min(255, v * f)); }
  function pick(rng, list) { return list[Math.floor(rng() * list.length)]; }
  function fixed(px, x, y, c) { px.push({ x, y, c, w: 0 }); }
  function put(px, x, y, c, w) { px.push({ x, y, c, w }); }

  return { TYPES, GATE, ARMS, has, canTurn, heraldryOf, build };
})();
