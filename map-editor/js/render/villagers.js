// Villagers: people drawn in code, a different one for every seed. A role (farmer, smith, baker, merchant, elder,
// guard, monk, child, townsfolk) sets the likely clothes and what they carry; build, skin, hair, beard, colors,
// hat and details are rolled on top. Drawn at the size of the sprite characters (32 × 32, shown at half size)
// from the front, the back, and the side (the diagonals use the front and back), standing and in 4 walking poses.
const Villagers = (() => {
  const SIZE = CharacterArt.SIZE, CX = 16, FEET = 29;
  const OUTLINE = [34, 28, 36], EYE = [36, 28, 34];

  const SKINS = [[246, 206, 172], [232, 182, 142], [212, 156, 118], [186, 128, 92], [150, 96, 66], [118, 76, 54]];
  const HAIRS = [[30, 26, 30], [64, 40, 28], [104, 66, 40], [140, 62, 36], [190, 96, 44], [214, 176, 96], [170, 160, 140]];
  const GREYS = [[150, 150, 156], [210, 208, 202]];
  const DYES = [[150, 52, 44], [186, 140, 64], [62, 88, 140], [62, 110, 64], [118, 82, 52], [196, 182, 150], [118, 116, 112],
    [104, 64, 112], [52, 112, 116], [170, 150, 60], [60, 56, 62], [222, 210, 180], [140, 96, 120], [90, 120, 150]];
  const LEATHER = [96, 62, 40], STRAW = [214, 180, 100], IRON = [128, 132, 140], WOOD = [130, 90, 56], LINEN = [234, 228, 212];
  // Poses. stride: which leg leads (1 the right one from the front, the near one from the side; arms swing the other
  // way). up: the body rides a pixel higher. pass: the leg swinging past the other, its foot off the ground.
  // A walk is stride, passing, the other stride, passing.
  const STAND = { stride: 0, up: 0, pass: 0 };
  const WALK = [{ stride: 1, up: 0, pass: 0 }, { stride: 0, up: 1, pass: -1 }, { stride: -1, up: 0, pass: 0 }, { stride: 0, up: 1, pass: 1 }];

  // Who they are: the rolls each role leans to. Lists are picked from at random.
  const ROLES = {
    farmer:   { tops: ['tunic', 'shirt'], lowers: ['trousers', 'trousers', 'dress'], hats: ['straw', 'straw', 'none', 'kerchief'], items: ['pitchfork', 'basket', 'none', 'bucket'], apron: 0.2 },
    smith:    { tops: ['shirt'], lowers: ['trousers'], hats: ['none', 'none', 'cap'], items: ['hammer', 'none'], apron: 1, apronColor: LEATHER, stout: 0.7 },
    baker:    { tops: ['shirt', 'tunic'], lowers: ['trousers', 'dress'], hats: ['kerchief', 'bonnet', 'none'], items: ['basket', 'none'], apron: 1, apronColor: LINEN },
    merchant: { tops: ['vest', 'tunic'], lowers: ['trousers'], hats: ['feather', 'cap', 'none'], items: ['sack', 'lantern', 'none'], apron: 0, stout: 0.4 },
    elder:    { tops: ['robe'], lowers: ['dress'], hats: ['none', 'hood', 'cap'], items: ['stick', 'stick', 'lantern'], apron: 0, grey: 1, beard: 0.6 },
    guard:    { tops: ['tabard'], lowers: ['trousers'], hats: ['helmet', 'helmet', 'cap'], items: ['spear', 'spear', 'none'], apron: 0 },
    monk:     { tops: ['robe'], lowers: ['dress'], hats: ['hood', 'none'], items: ['stick', 'lantern', 'none'], apron: 0, beard: 0.3, plain: true },
    child:    { tops: ['tunic', 'shirt'], lowers: ['trousers', 'dress'], hats: ['none', 'none', 'cap'], items: ['none', 'none', 'basket'], apron: 0, child: true },
    folk:     { tops: ['tunic', 'shirt', 'vest'], lowers: ['trousers', 'dress'], hats: ['none', 'none', 'kerchief', 'cap', 'bonnet', 'straw'], items: ['none', 'basket', 'bucket', 'sack', 'broom'], apron: 0.12 },
  };
  const ROLE_ODDS = ['folk', 'folk', 'folk', 'farmer', 'farmer', 'child', 'child', 'baker', 'smith', 'merchant', 'elder', 'guard', 'monk'];

  // Everything about one villager, rolled from the seed.
  function roll(seed) {
    const rng = Random.makeRng(seed * 7919 + 13);
    const pick = list => list[Math.floor(rng() * list.length)];
    const role = ROLES[pick(ROLE_ODDS)];
    const child = !!role.child;
    const lower = pick(role.lowers);
    const hairStyles = child ? ['short', 'long', 'ponytail', 'curly', 'bun'] : lower === 'dress' ? ['long', 'bun', 'ponytail', 'short', 'curly', 'braids']
      : ['short', 'short', 'bald', 'curly', 'long', 'ponytail'];
    const hairColor = role.grey ? pick(GREYS) : rng() < 0.08 && !child ? pick(GREYS) : pick(HAIRS);
    const dye = () => jitter(pick(role.plain ? [[118, 82, 52], [96, 90, 84], [150, 130, 100]] : DYES), rng);
    const top = dye();
    return {
      child, lower,
      top: role.tops[Math.floor(rng() * role.tops.length)],
      stout: !child && rng() < (role.stout || 0.15),
      skin: ramp(jitter(pick(SKINS), rng)),
      hair: ramp(hairColor), hairStyle: pick(hairStyles),
      beard: !child && lower !== 'dress' && rng() < (role.beard ?? 0.3) ? pick(['short', 'long', 'moustache']) : null,
      topColor: ramp(top), lowerColor: ramp(lower === 'dress' && rng() < 0.6 ? top : dye()), trim: ramp(dye()),
      shoes: ramp(jitter(pick([LEATHER, [60, 46, 40], [118, 82, 52]]), rng)),
      apron: rng() < role.apron ? ramp(role.apronColor || LINEN) : null,
      hat: pick(role.hats), hatColor: ramp(dye()),
      item: pick(role.items),
      blush: rng() < 0.4, belt: rng() < 0.6,
    };
  }

  // The role a seed rolls (roll picks it first).
  function roleOf(seed) { return ROLE_ODDS[Math.floor(Random.makeRng(seed * 7919 + 13)() * ROLE_ODDS.length)]; }

  // ---------- Pixels ----------

  function blank() { return new Uint8ClampedArray(SIZE * SIZE * 4); }
  function set(px, x, y, c) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  function opaque(px, x, y) { return x >= 0 && y >= 0 && x < SIZE && y < SIZE && px[(y * SIZE + x) * 4 + 3] > 0; }
  // Rectangle, lit on the left column and shaded on the right (light comes from the top left).
  function box(px, x0, y0, x1, y1, r, flat) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(px, x, y, flat ? r[1] : x === x0 && x1 > x0 ? r[2] : x === x1 && x1 > x0 ? r[0] : r[1]);
  }
  function ramp(c) { return [c.map(v => v * 0.72), c, c.map(v => Math.min(255, v * 1.2 + 10))]; }
  function jitter(c, rng) { const k = 0.92 + rng() * 0.16; return c.map(v => Math.min(255, v * k * (0.97 + rng() * 0.06))); }

  // A dark outline round the whole figure.
  function outline(px) {
    const edge = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (opaque(px, x, y)) continue;
        if (opaque(px, x - 1, y) || opaque(px, x + 1, y) || opaque(px, x, y - 1) || opaque(px, x, y + 1)) edge.push([x, y]);
      }
    }
    edge.forEach(([x, y]) => set(px, x, y, OUTLINE));
  }

  function mirror(px) {
    const out = blank();
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) out.set(px.subarray((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4), (y * SIZE + SIZE - 1 - x) * 4);
    return out;
  }

  function dim(r, k) { return r.map(c => c.map(v => v * k)); }

  // A figure drawn in every pose: { stand, walk: [4 frames] } from draw(pose).
  function posed(draw) { return { stand: draw(STAND), walk: WALK.map(draw) }; }
  function mirrored(set) { return { stand: mirror(set.stand), walk: set.walk.map(mirror) }; }

  // Seen from the front, how far a foot (s: -1 left, 1 right) is off the ground in a pose: the leading foot is
  // planted, the other heel lifts, and the passing foot is up.
  function footUp(pose, s) { return pose.stride ? (s === pose.stride ? 0 : 1) : s === pose.pass ? 2 : 0; }
  // How much lower an arm's hand hangs (s: the side): the arm against the leading leg swings forward.
  function armSwing(pose, s) { return pose.stride ? (s === -pose.stride ? 1 : -1) : 0; }
  // Seen from the side (s: 1 near leg, -1 far leg): how far its foot is ahead, and how far off the ground.
  function stride(pose, s) { return pose.stride ? { ahead: s * pose.stride * 2, lift: 0 } : { ahead: s === pose.pass ? 1 : 0, lift: s === pose.pass ? 1 : 0 }; }

  // Rows of the body, from the feet up. up: the body raised that much (the legs straighten).
  function rig(p, up = 0) {
    const legH = p.child ? 2 : 4, bodyH = p.child ? 6 : 8, headH = p.child ? 8 : 9;
    const legTop = FEET - 2 - legH + 1 - up, bodyTop = legTop - bodyH, headTop = bodyTop - 1 - headH;
    const half = p.child ? 3 : p.stout ? 5 : 4;
    return { legTop, bodyTop, headTop, headH, half, armLen: bodyH - (p.child ? 1 : 0) };
  }

  // ---------- Front and back ----------

  function frontOrBack(p, back, pose) {
    const px = blank(), r = rig(p, pose.up), { legTop, bodyTop, headTop, headH, half } = r;
    const hand = bodyTop + r.armLen - 1;
    const itemSide = back ? -1 : 1;
    if (p.item === 'spear' || p.item === 'pitchfork' || p.item === 'stick' || p.item === 'broom') longItem(px, p, CX + itemSide * (half + 3), headTop, hand, false);

    // Shoes and legs, or a skirt over the shoes. A skirt's hem swings with the stride.
    const hem = y => y >= FEET - 3 ? pose.stride : 0;
    for (const s of [-1, 1]) {
      const lift = footUp(pose, s), x0 = s < 0 ? CX - 3 : CX + 1;
      if (p.lower === 'dress') { box(px, x0, FEET - 1 - lift, x0 + 2, FEET - lift, p.shoes); continue; }
      box(px, x0, legTop, x0 + 2, FEET - 2 - lift, p.lowerColor);
      box(px, s < 0 ? CX - 4 : CX + 1, FEET - 1 - lift, s < 0 ? CX - 1 : CX + 4, FEET - lift, p.shoes);
    }
    if (p.lower === 'dress') {
      for (let y = legTop - 2; y <= FEET - 2; y++) {
        const w = half + Math.floor((y - legTop + 2) / 3);
        box(px, CX - w + hem(y), y, CX + w + hem(y), y, p.lowerColor);
      }
    }

    // Body.
    const topR = p.topColor;
    box(px, CX - half, bodyTop, CX + half, legTop - 1, topR);
    if (p.top === 'tunic' || p.top === 'tabard') box(px, CX - half, legTop, CX + half, legTop + 1, topR);
    if (p.top === 'robe') for (let y = legTop - 2; y <= FEET - 1; y++) { const w = half + Math.floor((y - legTop + 2) / 3); box(px, CX - w + hem(y), y, CX + w + hem(y), y, topR); }
    if (p.top === 'vest' && !back) { box(px, CX - half, bodyTop, CX - 2, legTop - 1, p.trim); box(px, CX + 2, bodyTop, CX + half, legTop - 1, p.trim); }
    if (p.top === 'tabard') box(px, CX - 2, bodyTop, CX + 2, legTop + 1, p.trim, true);
    if (p.belt) box(px, CX - half, legTop - 1, CX + half, legTop - 1, p.top === 'robe' ? ramp(STRAW) : ramp(LEATHER), true);
    if (p.apron && !back) box(px, CX - 2, bodyTop + 2, CX + 2, Math.min(FEET - 2, legTop + 3), p.apron);
    if (!back && p.top !== 'robe' && p.top !== 'tabard') { set(px, CX, bodyTop, p.skin[1]); set(px, CX, bodyTop + 1, p.skin[0]); }

    // Arms and hands, swinging.
    for (const s of [-1, 1]) {
      const ax = s < 0 ? CX - half - 2 : CX + half + 1, reach = hand + armSwing(pose, s);
      box(px, ax, bodyTop, ax + 1, reach - 2, topR);
      box(px, ax, reach - 1, ax + 1, reach, p.skin);
    }

    // Head.
    box(px, CX - 1, bodyTop - 1, CX + 1, bodyTop - 1, p.skin, true);
    head(px, p, headTop, headH, back);
    if (!back) face(px, p, headTop);
    hairFrontBack(px, p, headTop, headH, bodyTop, back);
    if (p.beard && !back) beard(px, p, headTop, bodyTop);
    hat(px, p, headTop, headH, back);

    if (p.item === 'basket' || p.item === 'bucket' || p.item === 'lantern' || p.item === 'hammer') handItem(px, p, CX + itemSide * (half + 3), hand + armSwing(pose, itemSide));
    if (p.item === 'sack' && back) box(px, CX - half + 1, bodyTop + 1, CX + half - 1, bodyTop + 6, ramp([176, 150, 110]));
    if (p.item === 'sack' && !back) { set(px, CX + half + 2, bodyTop - 1, ramp([176, 150, 110])[2]); set(px, CX + half + 1, bodyTop - 2, ramp([176, 150, 110])[1]); }
    outline(px);
    return px;
  }

  // Rounded head in skin, ears at the sides.
  function head(px, p, top, h, back) {
    for (let j = 0; j < h; j++) {
      const inset = j === 0 || j === h - 1 ? 2 : j === 1 || j === h - 2 ? 1 : 0;
      for (let x = CX - 5 + inset; x <= CX + 5 - inset; x++) set(px, x, top + j, x === CX + 5 - inset ? p.skin[0] : p.skin[1]);
    }
    set(px, CX - 6, top + 5, p.skin[1]); set(px, CX + 6, top + 5, p.skin[0]);
    if (back) set(px, CX, top + h - 1, p.skin[0]);
  }

  // Eyes, a mouth now and then, rosy cheeks.
  function face(px, p, top) {
    const ey = top + 5;
    set(px, CX - 2, ey, EYE); set(px, CX + 2, ey, EYE);
    if (!p.child) { set(px, CX - 2, ey - 1, p.skin[0]); set(px, CX + 2, ey - 1, p.skin[0]); }
    else { set(px, CX - 2, ey + 1, EYE); set(px, CX + 2, ey + 1, EYE); }
    if (p.blush) { set(px, CX - 3, ey + 2, [222, 128, 120]); set(px, CX + 3, ey + 2, [222, 128, 120]); }
    set(px, CX, ey + 2, p.skin[0]);
  }

  // Hair seen from the front (a cap, bangs, and sides) or the back (covering the head, long hair down the back).
  function hairFrontBack(px, p, top, h, bodyTop, back) {
    const H = p.hair, style = p.hairStyle;
    if (style === 'bald') { if (back) box(px, CX - 5, top + 4, CX + 5, top + 6, H, true); else { set(px, CX - 5, top + 4, H[1]); set(px, CX + 5, top + 4, H[0]); } return; }
    const curly = style === 'curly';
    for (let j = -1; j < 3; j++) {
      const inset = j === -1 ? 3 : j === 0 ? 1 : 0;
      for (let x = CX - 5 - (curly ? 1 : 0) + inset; x <= CX + 5 + (curly ? 1 : 0) - inset; x++) set(px, x, top + j, j === -1 || x < CX - 2 ? H[2] : x > CX + 3 ? H[0] : H[1]);
    }
    if (back) {
      const down = style === 'long' || style === 'braids' ? bodyTop + 4 : style === 'ponytail' ? top + h + 1 : top + h - 2;
      for (let y = top + 3; y <= down; y++) {
        const w = y > top + h - 2 ? (style === 'ponytail' ? 1 : 4) : 5 + (curly && y % 2 ? 1 : 0);
        box(px, CX - w, y, CX + w, y, H);
      }
      if (style === 'ponytail') box(px, CX - 1, top + h - 1, CX + 1, bodyTop + 5, H);
    } else {
      // Bangs, parted on one side.
      for (let x = CX - 5; x <= CX + 5; x++) if (x < CX + 1 || curly) set(px, x, top + 3, H[1]);
      const down = style === 'long' || style === 'braids' ? bodyTop + 3 : curly ? top + 6 : style === 'short' ? top + 4 : top + 5;
      for (let y = top + 3; y <= down; y++) {
        set(px, CX - 6, y, H[2]); set(px, CX + 6, y, H[0]);
        if (y > top + h - 2) { set(px, CX - 5, y, H[1]); set(px, CX + 5, y, H[1]); }
      }
      if (style === 'braids') { set(px, CX - 6, bodyTop + 4, p.trim[1]); set(px, CX + 6, bodyTop + 4, p.trim[1]); }
    }
    if (style === 'bun') box(px, CX - 2, top - 3, CX + 2, top - 2, H);
  }

  function beard(px, p, top, bodyTop) {
    const H = p.hair;
    if (p.beard === 'moustache') { box(px, CX - 2, top + 7, CX + 2, top + 7, H, true); return; }
    const end = p.beard === 'long' ? bodyTop + 3 : top + 9;
    for (let y = top + 6; y <= end; y++) {
      const w = y >= top + 9 ? 2 : 4;
      for (let x = CX - w; x <= CX + w; x++) if (!(y === top + 7 && Math.abs(x - CX) <= 1)) set(px, x, y, x < CX ? H[2] : H[1]);
    }
  }

  // Hats from the front or back.
  function hat(px, p, top, h, back) {
    const C = p.hatColor;
    switch (p.hat) {
      case 'straw':
        box(px, CX - 8, top + 1, CX + 8, top + 2, ramp(STRAW));
        box(px, CX - 4, top - 2, CX + 4, top, ramp(STRAW));
        box(px, CX - 4, top, CX + 4, top, C, true);
        break;
      case 'cap': box(px, CX - 5, top - 1, CX + 5, top + 2, C); if (!back) box(px, CX - 5, top + 3, CX + 2, top + 3, C, true); break;
      case 'feather':
        box(px, CX - 6, top + 1, CX + 6, top + 2, C); box(px, CX - 4, top - 1, CX + 4, top, C);
        for (let k = 0; k < 4; k++) set(px, CX + 4 + Math.floor(k / 2), top - 2 - k, k % 2 ? [236, 230, 210] : [200, 60, 50]);
        break;
      case 'kerchief': box(px, CX - 5, top - 1, CX + 5, top + 2, C); if (back) { set(px, CX, top + 3, C[1]); set(px, CX - 1, top + 3, C[0]); } break;
      case 'bonnet':
        box(px, CX - 6, top - 1, CX + 6, top + 3, ramp(LINEN));
        if (!back) for (let x = CX - 6; x <= CX + 6; x++) if (x & 1) set(px, x, top + 3, [210, 204, 190]);
        break;
      case 'helmet':
        box(px, CX - 6, top - 1, CX + 6, top + 3, ramp(IRON));
        if (!back) box(px, CX, top + 3, CX, top + 6, ramp(IRON), true);
        set(px, CX - 5, top, [196, 200, 208]);
        break;
      case 'hood':
        for (let j = -1; j <= h; j++) {
          const inset = j === -1 ? 3 : j === 0 ? 1 : 0;
          for (let x = CX - 6 + inset; x <= CX + 6 - inset; x++) {
            const opening = !back && j >= 3 && j <= h - 1 && Math.abs(x - CX) <= 4;
            if (!opening) set(px, x, top + j, x < CX - 3 ? C[2] : x > CX + 3 ? C[0] : C[1]);
          }
        }
        break;
    }
  }

  // Things carried in one hand.
  function handItem(px, p, x, hand) {
    const s = x > CX ? 1 : -1, x0 = s > 0 ? x - 1 : x - 3;
    if (p.item === 'basket') {
      const W = ramp([176, 128, 70]);
      box(px, x0, hand, x0 + 4, hand + 3, W);
      for (let k = 0; k <= 4; k++) set(px, x0 + k, hand + 1 + (k & 1), W[0]);
      set(px, x0 + 1, hand - 1, W[0]); set(px, x0 + 3, hand - 1, W[0]); set(px, x0 + 2, hand - 2, W[0]);
      set(px, x0 + 1, hand, [214, 70, 60]); set(px, x0 + 3, hand, [120, 170, 70]);
    } else if (p.item === 'bucket') {
      box(px, x0 + 1, hand + 1, x0 + 3, hand + 4, ramp(IRON)); set(px, x0 + 2, hand, ramp(IRON)[0]);
    } else if (p.item === 'lantern') {
      set(px, x0 + 2, hand + 1, ramp(IRON)[0]); box(px, x0 + 1, hand + 2, x0 + 3, hand + 4, ramp(IRON)); set(px, x0 + 2, hand + 3, [255, 214, 110]);
    } else if (p.item === 'hammer') {
      box(px, x0 + 2, hand - 1, x0 + 2, hand + 4, ramp(WOOD), true); box(px, x0 + 1, hand + 4, x0 + 3, hand + 5, ramp(IRON));
    }
  }

  // Long things held upright: a walking stick, spear, pitchfork, or broom.
  function longItem(px, p, x, headTop, hand, side) {
    const top = p.item === 'stick' ? headTop + 4 : headTop - 3, bottom = p.item === 'broom' ? FEET - 3 : FEET;
    box(px, x, top, x, bottom, ramp(WOOD), true);
    if (p.item === 'spear') { set(px, x, top - 1, [200, 204, 212]); set(px, x, top - 2, [200, 204, 212]); set(px, x - 1, top, IRON); set(px, x + 1, top, IRON); }
    if (p.item === 'pitchfork') { box(px, x - 2, top, x + 2, top, ramp(IRON), true); for (const dx of [-2, 0, 2]) { set(px, x + dx, top - 1, IRON); set(px, x + dx, top - 2, IRON); } }
    if (p.item === 'broom') for (let y = bottom + 1; y <= FEET; y++) box(px, x - 2, y, x + 2, y, ramp(STRAW));
    if (p.item === 'stick') set(px, x, top - 1, ramp(WOOD)[0]);
  }

  // ---------- Side (facing east) ----------

  function side(p, pose) {
    const px = blank(), r = rig(p, pose.up), { legTop, bodyTop, headTop, headH } = r;
    const half = p.stout ? 3 : p.child ? 2 : 2, hand = bodyTop + r.armLen - 1, swing = pose.stride ? -pose.stride : 0;
    if (['spear', 'pitchfork', 'stick', 'broom'].includes(p.item)) longItem(px, p, CX + 4, headTop, hand, true);
    // The far arm, behind everything, swinging against the near one.
    sideArm(px, p, bodyTop, hand, -swing, 0.7);
    // Legs (the far one darker), each swinging from the hip; a skirt over them flares at the hem when striding.
    for (const s of [-1, 1]) {
      const { ahead, lift } = stride(pose, s), k = s < 0 ? 0.78 : 1, x0 = s < 0 ? CX - 2 : CX, bottom = FEET - 2 - lift;
      if (p.lower !== 'dress') for (let y = legTop; y <= bottom; y++) { const x = x0 + Math.round(ahead * (y - legTop + 1) / (bottom - legTop + 1)); box(px, x, y, x + 1, y, dim(p.lowerColor, k)); }
      box(px, x0 + ahead, FEET - 1 - lift, x0 + ahead + 3, FEET - lift, dim(p.shoes, k));
    }
    const flare = y => y >= FEET - 3 && pose.stride ? 1 : 0;
    if (p.lower === 'dress') for (let y = legTop - 2; y <= FEET - 2; y++) { const w = half + 1 + Math.floor((y - legTop + 2) / 3); box(px, CX - w - flare(y), y, CX + w - 1 + flare(y), y, p.lowerColor); }
    box(px, CX - half - 1, bodyTop, CX + half, legTop - 1, p.topColor);
    if (p.top === 'tunic' || p.top === 'tabard') box(px, CX - half - 1, legTop, CX + half, legTop + 1, p.topColor);
    if (p.top === 'robe') for (let y = legTop - 2; y <= FEET - 1; y++) { const w = half + 1 + Math.floor((y - legTop + 2) / 3); box(px, CX - w - flare(y), y, CX + w - 1 + flare(y), y, p.topColor); }
    if (p.top === 'tabard') box(px, CX + half, bodyTop, CX + half, legTop + 1, p.trim, true);
    if (p.belt) box(px, CX - half - 1, legTop - 1, CX + half, legTop - 1, p.top === 'robe' ? ramp(STRAW) : ramp(LEATHER), true);
    if (p.apron) box(px, CX + half, bodyTop + 2, CX + half, Math.min(FEET - 2, legTop + 3), p.apron, true);
    if (p.item === 'sack') box(px, CX - half - 3, bodyTop + 1, CX - half - 1, bodyTop + 6, ramp([176, 150, 110]));
    // The near arm, a shade darker so it reads in front of the body.
    sideArm(px, p, bodyTop, hand, swing, 0.88);
    box(px, CX, bodyTop - 1, CX + 1, bodyTop - 1, p.skin, true);
    // Head in profile: face to the right, nose, one eye, ear.
    for (let j = 0; j < headH; j++) {
      const inset = j === 0 || j === headH - 1 ? 2 : j === 1 || j === headH - 2 ? 1 : 0;
      for (let x = CX - 4 + inset; x <= CX + 4 - inset; x++) set(px, x, headTop + j, x === CX - 4 + inset ? p.skin[0] : p.skin[1]);
    }
    set(px, CX + 5, headTop + 6, p.skin[1]);
    set(px, CX + 2, headTop + 5, EYE);
    if (p.child) set(px, CX + 2, headTop + 6, EYE);
    if (p.blush) set(px, CX + 2, headTop + 7, [222, 128, 120]);
    set(px, CX - 1, headTop + 5, p.skin[0]);
    hairSide(px, p, headTop, headH, bodyTop);
    if (p.beard) {
      const end = p.beard === 'long' ? bodyTop + 3 : p.beard === 'moustache' ? headTop + 7 : headTop + 9;
      for (let y = headTop + (p.beard === 'moustache' ? 7 : 6); y <= end; y++) box(px, CX + (p.beard === 'moustache' ? 3 : 0), y, CX + 4, y, p.hair, true);
    }
    hatSide(px, p, headTop, headH);
    if (['basket', 'bucket', 'lantern', 'hammer'].includes(p.item)) handItem(px, p, CX + 2 + swing * 2, hand - Math.abs(swing));
    outline(px);
    return px;
  }

  // An arm seen from the side, from the shoulder to the hand, swung forward (swing 1) or back (-1). k: how dark.
  function sideArm(px, p, bodyTop, hand, swing, k) {
    const end = hand - Math.abs(swing), len = end - 1 - bodyTop;
    for (let y = bodyTop + 1; y <= end - 2; y++) { const x = CX - 1 + Math.round(swing * 2 * (y - bodyTop) / len); box(px, x, y, x + 1, y, dim(p.topColor, k), true); }
    box(px, CX - 1 + swing * 2, end - 1, CX + swing * 2, end, k < 0.8 ? dim(p.skin, 0.85) : p.skin);
  }

  function hairSide(px, p, top, h, bodyTop) {
    const H = p.hair, style = p.hairStyle;
    if (style === 'bald') { box(px, CX - 4, top + 3, CX - 1, top + 5, H, true); return; }
    const curly = style === 'curly';
    for (let j = -1; j < 3; j++) {
      const inset = j === -1 ? 2 : 0;
      for (let x = CX - 4 - (curly ? 1 : 0) + inset; x <= CX + 4 - inset; x++) set(px, x, top + j, j === -1 ? H[2] : H[1]);
    }
    set(px, CX + 4, top + 3, H[0]);
    const down = style === 'long' || style === 'braids' ? bodyTop + 4 : curly ? top + 7 : style === 'short' ? top + 5 : top + 6;
    for (let y = top + 3; y <= down; y++) box(px, CX - 4 - (curly && y % 2 ? 1 : 0), y, CX - 2 + (y < top + h - 1 ? 0 : -1), y, H, true);
    if (style === 'ponytail') box(px, CX - 6, top + 3, CX - 5, bodyTop + 3, H, true);
    if (style === 'bun') box(px, CX - 5, top - 1, CX - 3, top + 1, H);
  }

  function hatSide(px, p, top, h) {
    const C = p.hatColor;
    switch (p.hat) {
      case 'straw': box(px, CX - 8, top + 1, CX + 8, top + 2, ramp(STRAW)); box(px, CX - 3, top - 2, CX + 3, top, ramp(STRAW)); box(px, CX - 3, top, CX + 3, top, C, true); break;
      case 'cap': box(px, CX - 4, top - 1, CX + 4, top + 2, C); box(px, CX + 4, top + 2, CX + 6, top + 2, C, true); break;
      case 'feather':
        box(px, CX - 5, top + 1, CX + 6, top + 2, C); box(px, CX - 3, top - 1, CX + 3, top, C);
        for (let k = 0; k < 4; k++) set(px, CX - 3 - Math.floor(k / 2), top - 2 - k, k % 2 ? [236, 230, 210] : [200, 60, 50]);
        break;
      case 'kerchief': box(px, CX - 4, top - 1, CX + 4, top + 2, C); set(px, CX - 5, top + 3, C[0]); break;
      case 'bonnet': box(px, CX - 5, top - 1, CX + 4, top + 4, ramp(LINEN)); break;
      case 'helmet': box(px, CX - 5, top - 1, CX + 5, top + 3, ramp(IRON)); set(px, CX - 4, top, [196, 200, 208]); break;
      case 'hood':
        for (let j = -1; j <= h; j++) {
          const inset = j === -1 ? 2 : 0;
          for (let x = CX - 5 + inset; x <= CX + 4 - inset; x++) if (!(j >= 3 && j <= h - 1 && x >= CX)) set(px, x, top + j, C[1]);
        }
        break;
    }
  }

  // The 8 facings for a seed, in every pose: front for the south ones, back for the north ones, the side for east
  // and west.
  function make(seed) {
    const p = roll(seed);
    const front = posed(pose => frontOrBack(p, false, pose)), back = posed(pose => frontOrBack(p, true, pose)), east = posed(pose => side(p, pose));
    return { east, west: mirrored(east), south: front, 'south-east': front, 'south-west': front, north: back, 'north-east': back, 'north-west': back };
  }

  CharacterArt.addGenerated('villager', 'Villager', '#c4753a', make, { walk: { speed: 6, roam: 45, patrol: 0, paths: true } });

  // Drawing helpers, shared with Monsters.
  const kit = { SIZE, CX, FEET, OUTLINE, STAND, WALK, blank, set, opaque, box, ramp, jitter, outline, mirror, dim, posed, mirrored, footUp, armSwing, stride };

  return { make, roleOf, kit };
})();
