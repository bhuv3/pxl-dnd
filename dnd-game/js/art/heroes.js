// Heroes: the five player characters drawn in code in the editor villagers' style (32 × 32, shown at half size):
// a human Fighter, a high-elf Wizard, a dwarf Cleric, a halfling Rogue, and a dragonborn Paladin. One body rig
// draws every hero from an outfit, in any pose: a pose is a set of numbers (arm angles, lean, stride, crouch),
// so a sword swing turns the real arm. Side views have every pose; front and back views stand and walk.
const Heroes = (() => {
  const { SIZE, CX, FEET, STAND, WALK, blank, set, box, ramp, outline, mirror, dim, footUp, armSwing, stride } = Villagers.kit;
  const EYE = [36, 28, 34];
  const IRON = [128, 132, 140], STEEL = [190, 196, 208], GOLD = [214, 176, 72], LEATHER = [110, 74, 48], WOOD = [120, 84, 52];
  const BONE = [226, 212, 178], ORB = [150, 232, 255];
  // Body sizes in character pixels: legs, body, head rows; half the body's width; arm length.
  const BUILDS = {
    normal:   { leg: 4, body: 8, head: 9, half: 4, depth: 2, arm: 7 },
    dwarf:    { leg: 2, body: 8, head: 9, half: 5, depth: 3, arm: 6 },
    halfling: { leg: 2, body: 6, head: 8, half: 3, depth: 2, arm: 5 },
    tall:     { leg: 5, body: 9, head: 8, half: 5, depth: 3, arm: 8 },
  };
  const OUTFITS = {
    'hero-fighter': { name: 'Fighter', build: 'normal', skin: [232, 182, 142], hair: [104, 66, 40], hat: 'helmet', armor: 'chain',
      top: [150, 156, 166], tabard: [176, 48, 44], legs: [86, 70, 58], boots: [70, 52, 40], weapon: 'sword',
      shield: { face: [176, 48, 44], rim: IRON, mark: [236, 230, 214] } },
    'hero-wizard': { name: 'Wizard', build: 'normal', skin: [246, 212, 184], hair: [236, 214, 150], longHair: true, ears: true,
      hat: 'wizard', hatColor: [62, 84, 176], armor: 'robe', top: [62, 84, 176], trim: GOLD, boots: [80, 60, 90], weapon: 'staff',
      light: { color: [0.9, 1.15, 1.5], radius: 14, power: 1.2 } },
    'hero-cleric': { name: 'Cleric', build: 'dwarf', skin: [212, 156, 118], hair: [150, 70, 40], beard: true, hat: 'cap', armor: 'chain',
      top: [150, 156, 166], tabard: [226, 222, 210], emblem: GOLD, legs: [90, 74, 60], boots: [70, 52, 40], weapon: 'mace',
      shield: { face: STEEL, rim: GOLD, mark: GOLD }, light: { color: [1.3, 1.2, 0.8], radius: 10, power: 0.6 } },
    'hero-rogue': { name: 'Rogue', build: 'halfling', skin: [232, 182, 142], hair: [90, 58, 36], hat: 'hood', hatColor: [52, 78, 58],
      armor: 'leather', top: [110, 74, 48], legs: [66, 60, 70], boots: [196, 150, 112], weapon: 'dagger' },
    'hero-paladin': { name: 'Paladin', build: 'tall', head: 'dragon', skin: [178, 52, 40], belly: [226, 178, 120], armor: 'plate',
      top: STEEL, trim: GOLD, cape: [56, 78, 150], legs: STEEL, boots: [110, 116, 130], weapon: 'sword' },
  };
  // Poses as rig numbers. Angles are radians from straight up, positive = forward (π hangs down).
  const POSES = {
    stand:  {},
    windup: { arm: -0.7, weapon: -1.3, lean: -1, stride: -1 },
    strike: { arm: 1.7, weapon: 1.9, lean: 1, stride: 1 },
    cast:   { arm: 1.2, far: 1.4, lean: 1, weapon: 0.6 },
    raise:  { arm: 0.15, weapon: 0.1 },
    inhale: { lean: -1, up: 1 },
    hit:    { arm: 2.4, far: 2.2, lean: -1, hurt: true },
    dodge:  { lean: -1, stride: -1 },
    shiver: { lean: -1 },
    down:   { crouch: 3, arm: 2.6, far: 2.9, stride: 1, hurt: true },
  };
  const REST_WEAPON = { sword: 0.3, mace: 0.4, staff: 0.08, dagger: 0.6 };
  const cache = new Map();

  function has(key) { return !!OUTFITS[key]; }

  // Rows of the body for a pose: crouching lowers it, up raises it.
  function rig(o, p) {
    const B = BUILDS[o.build], legTop = FEET - 1 - B.leg - (p.up || 0) + (p.crouch || 0);
    const bodyTop = legTop - B.body, headTop = bodyTop - 1 - B.head;
    return { B, legTop, bodyTop, headTop, sx: CX + (p.lean || 0), sy: bodyTop + 1 };
  }

  const setGlow = (px, x, y, c) => { set(px, x, y, c); if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) px[(y * SIZE + x) * 4 + 3] = 254; };
  // Steps along a direction from (x, y): calls fn(x, y, k) at each whole pixel.
  function walkLine(x, y, a, from, to, fn) {
    for (let k = from; k <= to; k++) fn(Math.round(x + Math.sin(a) * k), Math.round(y - Math.cos(a) * k), k);
  }
  // Arm angles at rest: hanging, swinging against the legs while walking.
  const restArm = (p, s) => Math.PI - 0.2 + (p.stride || 0) * 0.5 * s;
  function handAt(r, a, far) { return { x: Math.round(r.sx - (far ? 1 : 0) + Math.sin(a) * r.B.arm), y: Math.round(r.sy - Math.cos(a) * r.B.arm) }; }

  // ---------- Side view (facing east) ----------

  function side(o, p) {
    const px = blank(), r = rig(o, p), near = p.arm ?? restArm(p, 1), far = p.far ?? restArm(p, -1);
    if (o.cape) capeSide(px, o, r, p);
    armSide(px, o, r, far, true);
    if (o.shield) shieldSide(px, o, r);
    if (o.armor === 'robe') robeSide(px, o, r, p); else legsSide(px, o, r, p);
    torsoSide(px, o, r);
    if (o.head === 'dragon') dragonSide(px, o, r, p); else headSide(px, o, r, p);
    armSide(px, o, r, near, false);
    if (!p.noWeapon) { const h = handAt(r, near); weapon(px, o, h.x, h.y, p.weapon ?? REST_WEAPON[o.weapon]); }
    outline(px);
    return px;
  }

  // Legs swinging from the hip (the far one darker), boots with the toe forward.
  function legsSide(px, o, r, p) {
    for (const s of [-1, 1]) {
      const { ahead, lift } = stride(pose(p), s), k = s < 0 ? 0.78 : 1, x0 = s < 0 ? CX - 2 : CX, bottom = FEET - 2 - lift;
      for (let y = r.legTop; y <= bottom; y++) { const x = x0 + Math.round(ahead * (y - r.legTop + 1) / Math.max(1, bottom - r.legTop + 1)); box(px, x, y, x + 1, y, dim(ramp(o.legs), k)); }
      box(px, x0 + ahead, FEET - 1 - lift, x0 + ahead + 2, FEET - lift, dim(ramp(o.boots), k));
    }
  }

  // A robe to the floor that flares at the hem when striding; the shoes peek out.
  function robeSide(px, o, r, p) {
    const st = pose(p).stride || 0;
    for (const s of [-1, 1]) { const { ahead } = stride(pose(p), s); box(px, CX - 1 + ahead, FEET, CX + 1 + ahead, FEET, dim(ramp(o.boots), s < 0 ? 0.78 : 1)); }
    for (let y = r.legTop - 2; y <= FEET - 1; y++) {
      const w = r.B.depth + 1 + Math.floor((y - r.legTop + 2) / 3), flare = y >= FEET - 3 && st ? 1 : 0;
      box(px, CX - w - flare, y, CX + w - 1 + flare, y, ramp(o.top));
    }
    box(px, CX - 4, FEET - 1, CX + 3, FEET - 1, ramp(o.trim), true);
  }

  function torsoSide(px, o, r) {
    const d = r.B.depth, x0 = r.sx - d - 1, x1 = r.sx + d, T = ramp(o.top);
    box(px, x0, r.bodyTop, x1, r.legTop - 1, T);
    if (o.armor === 'chain') for (let y = r.bodyTop; y < r.legTop; y++) for (let x = x0; x <= x1; x++) if ((x + y) & 1) set(px, x, y, T[0]);
    if (o.armor === 'plate') { box(px, x1, r.bodyTop, x1, r.legTop - 1, T, true); box(px, x0, r.bodyTop + 3, x1, r.bodyTop + 3, ramp(o.trim), true); box(px, r.sx - 1, r.bodyTop - 1, r.sx + 1, r.bodyTop + 1, ramp(STEEL)); }
    if (o.armor === 'robe') box(px, x1, r.bodyTop, x1, r.legTop + 1, ramp(o.trim), true);
    if (o.armor === 'leather') for (let k = 0; k < r.B.body; k++) set(px, x0 + Math.round(k * (x1 - x0) / r.B.body), r.bodyTop + k, ramp(LEATHER)[0]);
    if (o.tabard) box(px, x1 - 1, r.bodyTop, x1, r.legTop + 1, ramp(o.tabard));
    if (o.armor !== 'robe') box(px, x0, r.legTop - 1, x1, r.legTop - 1, ramp(LEATHER), true);
    else box(px, x0, r.legTop - 1, x1, r.legTop - 1, ramp(o.trim), true);
    box(px, r.sx, r.bodyTop - 1, r.sx + 1, r.bodyTop - 1, ramp(o.skin), true);
  }

  // A cape hanging down the back, swinging out at the bottom when striding.
  function capeSide(px, o, r, p) {
    const C = ramp(o.cape), st = Math.abs(pose(p).stride || 0);
    for (let y = r.bodyTop + 1; y <= FEET - 3; y++) { const out = y > FEET - 7 ? st : 0; box(px, r.sx - r.B.depth - 3 - out, y, r.sx - r.B.depth - 1, y, C); }
  }

  // An arm from the shoulder at an angle: a sleeve and a hand (the far one darker and a step back).
  function armSide(px, o, r, a, far) {
    const k = far ? 0.7 : 1, sleeve = dim(ramp(o.armor === 'plate' ? STEEL : o.top), k * (far ? 1 : 0.9)), hand = dim(ramp(o.skin), k);
    const h = handAt(r, a, far), wide = Math.abs(Math.cos(a)) > 0.6;
    walkLine(r.sx - (far ? 1 : 0), r.sy, a, 0, r.B.arm - 1, (x, y) => { set(px, x, y, sleeve[1]); set(px, x + (wide ? 1 : 0), y + (wide ? 0 : 1), sleeve[wide ? 0 : 1]); });
    box(px, h.x, h.y, h.x + 1, h.y + 1, hand);
  }

  // A round shield on the far arm, its rim showing behind the body.
  function shieldSide(px, o, r) {
    const S = o.shield, cx = r.sx - r.B.depth - 2, cy = r.bodyTop + 4;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) set(px, cx + dx, cy + dy, Math.abs(dy) === 3 || dx === -1 ? S.rim : S.face);
  }

  // A head in profile: face to the right, eye, nose, hair, hats; the elf's pointed ear; the dwarf's beard.
  function headSide(px, o, r, p) {
    const S = ramp(o.skin), H = ramp(o.hair), x = r.sx, top = r.headTop, h = r.B.head;
    for (let j = 0; j < h; j++) {
      const inset = j === 0 || j === h - 1 ? 2 : j === 1 || j === h - 2 ? 1 : 0;
      for (let xx = x - 4 + inset; xx <= x + 4 - inset; xx++) set(px, xx, top + j, xx === x - 4 + inset ? S[0] : S[1]);
    }
    set(px, x + 5, top + 6, S[1]);
    if (p.hurt) box(px, x + 1, top + 5, x + 2, top + 5, S, true); else set(px, x + 2, top + 5, EYE);
    if (o.hat !== 'hood') {
      for (let j = -1; j < 3; j++) { const inset = j === -1 ? 2 : 0; for (let xx = x - 4 + inset; xx <= x + 4 - inset; xx++) set(px, xx, top + j, j === -1 ? H[2] : H[1]); }
      const down = o.longHair ? r.bodyTop + 3 : top + 6;
      for (let y = top + 3; y <= down; y++) box(px, x - 4, y, x - 2, y, H, true);
    }
    if (o.ears) { set(px, x - 1, top + 5, S[1]); set(px, x - 2, top + 4, S[1]); set(px, x - 3, top + 3, S[2]); }
    if (o.beard) for (let y = top + 6; y <= r.bodyTop + 3; y++) box(px, x - 1, y, x + 4 - Math.max(0, y - (top + h)), y, H);
    hatSide(px, o, x, top, h);
  }

  function hatSide(px, o, x, top, h) {
    switch (o.hat) {
      case 'helmet':
        box(px, x - 5, top - 1, x + 4, top + 3, ramp(IRON));
        set(px, x - 4, top, STEEL);
        box(px, x + 4, top + 3, x + 4, top + 6, ramp(IRON), true);
        break;
      case 'cap':
        box(px, x - 4, top - 1, x + 4, top + 2, ramp(STEEL));
        box(px, x - 4, top + 2, x + 4, top + 2, ramp(GOLD), true);
        break;
      case 'wizard': {
        const C = ramp(o.hatColor);
        box(px, x - 6, top + 1, x + 5, top + 2, C);
        for (let k = 0; k <= 5; k++) { const w = 4 - Math.floor(k * 0.7), back = Math.floor(k / 2); box(px, x - w - back, top - k, x + w - 1 - back, top - k, C); }
        box(px, x - 4, top, x + 3, top, ramp(GOLD), true);
        set(px, x - 2, top - 2, GOLD);
        break;
      }
      case 'hood': {
        const C = ramp(o.hatColor);
        for (let j = -1; j <= h; j++) {
          const inset = j === -1 ? 2 : 0;
          for (let xx = x - 5 + inset; xx <= x + 4 - inset; xx++) if (!(j >= 3 && j <= h - 2 && xx >= x + 1)) set(px, xx, top + j, xx < x - 2 ? C[2] : C[1]);
        }
        box(px, x - 6, top + 2, x - 6, top + 5, C, true);
        box(px, x + 1, top + 3, x + 4, top + h - 2, dim(ramp(o.skin), 0.7));
        set(px, x + 2, top + 5, EYE);
        break;
      }
    }
  }

  // A dragon's head in profile: scaled skull, long snout with a pale jaw, a glowing eye, horns sweeping back.
  function dragonSide(px, o, r, p) {
    const S = ramp(o.skin), Bl = ramp(o.belly), x = r.sx, top = r.headTop, h = r.B.head;
    box(px, x - 1, r.bodyTop - 1, x + 1, r.bodyTop - 1, S, true);
    for (let j = 0; j < h; j++) {
      const inset = j === 0 || j === h - 1 ? 2 : j === 1 ? 1 : 0;
      for (let xx = x - 4 + inset; xx <= x + 2; xx++) set(px, xx, top + j, xx === x - 4 + inset ? S[0] : (xx + j) % 3 === 0 ? S[0] : S[1]);
    }
    box(px, x + 3, top + 3, x + 6, top + 4, S);
    box(px, x + 2, top + 5, x + 5, top + 6, Bl);
    box(px, x + 3, top + 5, x + 6, top + 5, dim(S, 0.6), true);
    set(px, x + 6, top + 3, dim(S, 0.4)[1]);
    box(px, x, top + 2, x + 2, top + 2, dim(S, 0.7), true);
    if (p.hurt) set(px, x + 1, top + 3, S[0]); else setGlow(px, x + 1, top + 3, [255, 214, 90]);
    for (const [dx, dy] of [[-3, 0], [-4, -1], [-5, -2], [-6, -2], [-2, -1], [-3, -2]]) set(px, x + dx, top + dy, BONE);
    for (const dy of [3, 5, 7]) set(px, x - 5, top + dy, S[0]);
  }

  // The weapon in the hand at an angle: sword, mace, staff with a glowing orb, or dagger.
  function weapon(px, o, hx, hy, a) {
    const W = o.weapon, along = (k, c, glow) => walkLine(hx, hy, a, k, k, (x, y) => (glow ? setGlow : set)(px, x, y, c));
    if (W === 'sword' || W === 'dagger') {
      const len = W === 'sword' ? 9 : 4;
      along(-1, LEATHER);
      walkLine(hx, hy, a + Math.PI / 2, -1, 1, (x, y) => set(px, Math.round(x + Math.sin(a)), Math.round(y - Math.cos(a)), W === 'sword' ? GOLD : LEATHER));
      for (let k = 2; k <= len + 1; k++) along(k, k === len + 1 ? [240, 244, 250] : STEEL);
    } else if (W === 'mace') {
      for (let k = -1; k <= 4; k++) along(k, WOOD);
      const cx = Math.round(hx + Math.sin(a) * 6), cy = Math.round(hy - Math.cos(a) * 6);
      box(px, cx - 1, cy - 1, cx + 1, cy + 1, ramp(IRON));
      set(px, cx, cy - 2, IRON); set(px, cx, cy + 2, IRON); set(px, cx - 2, cy, IRON); set(px, cx + 2, cy, IRON);
    } else if (W === 'staff') {
      for (let k = -6; k <= 11; k++) along(k, WOOD);
      const cx = Math.round(hx + Math.sin(a) * 13), cy = Math.round(hy - Math.cos(a) * 13);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setGlow(px, cx + dx, cy + dy, ORB);
      setGlow(px, cx, cy, [235, 252, 255]);
    }
  }

  // ---------- Front and back views ----------

  function frontBack(o, p, back) {
    const px = blank(), r = rig(o, p), B = r.B, half = B.half;
    const reach = s => r.bodyTop + B.arm - 1 + armSwing(pose(p), s);
    const armX = s => s < 0 ? CX - half - 2 : CX + half + 1;
    if (o.cape && !back) box(px, CX - half - 1, r.bodyTop + 1, CX + half + 1, FEET - 3, dim(ramp(o.cape), 0.8));
    if (o.weapon === 'staff') staffFront(px, back ? armX(1) + 2 : armX(-1) - 1, r);
    if (o.armor === 'robe') robeFront(px, o, r, p); else legsFront(px, o, r, p);
    torsoFront(px, o, r, back);
    for (const s of [-1, 1]) {
      const ax = armX(s), y1 = reach(s);
      box(px, ax, r.bodyTop, ax + 1, y1 - 2, ramp(o.armor === 'plate' ? STEEL : o.top));
      box(px, ax, y1 - 1, ax + 1, y1, ramp(o.skin));
    }
    if (o.cape && back) box(px, CX - half - 1, r.bodyTop, CX + half + 1, FEET - 3, ramp(o.cape));
    if (o.head === 'dragon') dragonFront(px, o, r, p, back); else headFront(px, o, r, p, back);
    const weaponSide = back ? 1 : -1, shieldSide = -weaponSide;
    if (o.weapon !== 'staff') weaponFront(px, o, armX(weaponSide) + (weaponSide < 0 ? -1 : 2), reach(weaponSide));
    if (o.shield) shieldFront(px, o, armX(shieldSide) + (shieldSide > 0 ? 1 : 0), r.bodyTop + 5, back);
    outline(px);
    return px;
  }

  function legsFront(px, o, r, p) {
    const narrow = r.B.half <= 3;
    for (const s of [-1, 1]) {
      const lift = footUp(pose(p), s), x0 = s < 0 ? CX - (narrow ? 2 : 3) : CX + 1;
      box(px, x0, r.legTop, x0 + (narrow ? 1 : 2), FEET - 2 - lift, ramp(o.legs));
      box(px, s < 0 ? x0 - 1 : x0, FEET - 1 - lift, s < 0 ? x0 + (narrow ? 1 : 2) : x0 + (narrow ? 2 : 3), FEET - lift, ramp(o.boots));
    }
  }

  function robeFront(px, o, r, p) {
    const st = pose(p).stride || 0;
    for (const s of [-1, 1]) { const lift = footUp(pose(p), s); box(px, s < 0 ? CX - 3 : CX + 1, FEET - lift, s < 0 ? CX - 1 : CX + 3, FEET - lift, ramp(o.boots)); }
    for (let y = r.legTop - 2; y <= FEET - 1; y++) {
      const w = r.B.half + Math.floor((y - r.legTop + 2) / 3), hem = y >= FEET - 3 ? st : 0;
      box(px, CX - w + hem, y, CX + w + hem, y, ramp(o.top));
    }
    box(px, CX - r.B.half - 3, FEET - 1, CX + r.B.half + 3, FEET - 1, ramp(o.trim), true);
  }

  function torsoFront(px, o, r, back) {
    const half = r.B.half, T = ramp(o.top);
    box(px, CX - half, r.bodyTop, CX + half, r.legTop - 1, T);
    if (o.armor === 'chain') for (let y = r.bodyTop; y < r.legTop; y++) for (let x = CX - half; x <= CX + half; x++) if ((x + y) & 1) set(px, x, y, T[0]);
    if (o.armor === 'plate') { box(px, CX - half, r.bodyTop + 3, CX + half, r.bodyTop + 3, ramp(o.trim), true); box(px, CX - half - 1, r.bodyTop - 1, CX - half + 1, r.bodyTop + 1, ramp(STEEL)); box(px, CX + half - 1, r.bodyTop - 1, CX + half + 1, r.bodyTop + 1, ramp(STEEL)); }
    if (o.armor === 'robe' && !back) box(px, CX, r.bodyTop, CX, r.legTop + 1, ramp(o.trim), true);
    if (o.armor === 'leather' && !back) for (let k = 0; k <= half * 2; k++) set(px, CX - half + k, r.bodyTop + Math.round(k * (r.B.body - 1) / (half * 2)), ramp(LEATHER)[0]);
    if (o.tabard) box(px, CX - 2, r.bodyTop, CX + 2, r.legTop + 1, ramp(o.tabard), true);
    if (o.emblem && !back) { set(px, CX, r.bodyTop + 2, o.emblem); set(px, CX - 1, r.bodyTop + 3, o.emblem); set(px, CX, r.bodyTop + 3, o.emblem); set(px, CX + 1, r.bodyTop + 3, o.emblem); set(px, CX, r.bodyTop + 4, o.emblem); }
    box(px, CX - half, r.legTop - 1, CX + half, r.legTop - 1, ramp(o.armor === 'robe' ? o.trim : LEATHER), true);
    box(px, CX - 1, r.bodyTop - 1, CX + 1, r.bodyTop - 1, ramp(o.skin), true);
  }

  // A round head with eyes (not from the back), hair, beard, ears, and the hat.
  function headFront(px, o, r, p, back) {
    const S = ramp(o.skin), H = ramp(o.hair), top = r.headTop, h = r.B.head, w = 5;
    for (let j = 0; j < h; j++) {
      const inset = j === 0 || j === h - 1 ? 2 : j === 1 || j === h - 2 ? 1 : 0;
      for (let x = CX - w + inset; x <= CX + w - inset; x++) set(px, x, top + j, x === CX + w - inset ? S[0] : S[1]);
    }
    if (o.ears) for (const s of [-1, 1]) { set(px, CX + s * 6, top + 5, S[1]); set(px, CX + s * 7, top + 4, S[1]); set(px, CX + s * 7, top + 3, S[2]); }
    if (!back && o.hat !== 'hood') {
      if (p.hurt) { box(px, CX - 3, top + 5, CX - 2, top + 5, S, true); box(px, CX + 2, top + 5, CX + 3, top + 5, S, true); }
      else { set(px, CX - 2, top + 5, EYE); set(px, CX + 2, top + 5, EYE); }
    }
    if (o.hat !== 'hood') {
      for (let j = -1; j < 3; j++) { const inset = j === -1 ? 3 : j === 0 ? 1 : 0; for (let x = CX - w + inset; x <= CX + w - inset; x++) set(px, x, top + j, j === -1 ? H[2] : H[1]); }
      if (back) for (let y = top + 3; y <= (o.longHair ? r.bodyTop + 4 : top + h - 2); y++) box(px, CX - w, y, CX + w, y, H, true);
      else if (o.longHair) for (let y = top + 3; y <= r.bodyTop + 3; y++) { set(px, CX - w - 1, y, H[2]); set(px, CX + w + 1, y, H[0]); }
    }
    if (o.beard && !back) for (let y = top + 6; y <= r.bodyTop + 3; y++) { const bw = y > top + h ? 3 : 4; box(px, CX - bw, y, CX + bw, y, H); }
    hatFront(px, o, top, h, back);
  }

  function hatFront(px, o, top, h, back) {
    switch (o.hat) {
      case 'helmet': box(px, CX - 6, top - 1, CX + 6, top + 3, ramp(IRON)); set(px, CX - 5, top, STEEL); if (!back) box(px, CX, top + 3, CX, top + 6, ramp(IRON), true); break;
      case 'cap': box(px, CX - 5, top - 1, CX + 5, top + 2, ramp(STEEL)); box(px, CX - 5, top + 2, CX + 5, top + 2, ramp(GOLD), true); break;
      case 'wizard': {
        const C = ramp(o.hatColor);
        box(px, CX - 7, top + 1, CX + 7, top + 2, C);
        for (let k = 0; k <= 5; k++) { const w = 5 - Math.floor(k * 0.8), lean = Math.floor(k / 3); box(px, CX - w + lean, top - k, CX + w + lean, top - k, C); }
        box(px, CX - 5, top, CX + 5, top, ramp(GOLD), true);
        if (!back) set(px, CX + 1, top - 2, GOLD);
        break;
      }
      case 'hood': {
        const C = ramp(o.hatColor);
        for (let j = -1; j <= h; j++) {
          const inset = j === -1 ? 3 : j === 0 ? 1 : 0;
          for (let x = CX - 6 + inset; x <= CX + 6 - inset; x++) {
            const opening = !back && j >= 3 && j <= h - 1 && Math.abs(x - CX) <= 3;
            if (opening) set(px, x, top + j, dim(ramp(o.skin), 0.7)[1]); else set(px, x, top + j, x < CX - 3 ? C[2] : x > CX + 3 ? C[0] : C[1]);
          }
        }
        if (!back) { set(px, CX - 2, top + 5, EYE); set(px, CX + 2, top + 5, EYE); }
        break;
      }
    }
  }

  // A dragon's head from the front (snout, nostrils, two glowing eyes) or back (scales and spines), horns either way.
  function dragonFront(px, o, r, p, back) {
    const S = ramp(o.skin), Bl = ramp(o.belly), top = r.headTop, h = r.B.head;
    box(px, CX - 1, r.bodyTop - 1, CX + 1, r.bodyTop - 1, S, true);
    for (let j = 0; j < h; j++) {
      const inset = j === 0 ? 2 : j === 1 ? 1 : j >= h - 2 ? 2 : 0;
      for (let x = CX - 4 + inset; x <= CX + 4 - inset; x++) set(px, x, top + j, (x + j) % 3 === 0 ? S[0] : S[1]);
    }
    if (!back) {
      box(px, CX - 2, top + h - 3, CX + 2, top + h - 1, Bl);
      set(px, CX - 1, top + h - 4, S[0]); set(px, CX + 1, top + h - 4, S[0]);
      for (const s of [-1, 1]) { if (p.hurt) set(px, CX + s * 2, top + 3, S[0]); else setGlow(px, CX + s * 2, top + 3, [255, 214, 90]); }
    } else for (let y = top + 2; y < top + h; y += 2) set(px, CX, y, S[0]);
    for (const s of [-1, 1]) for (const [dx, dy] of [[4, 0], [5, -1], [5, -2], [6, -3]]) set(px, CX + s * dx, top + dy, BONE);
  }

  function weaponFront(px, o, x, hand) {
    if (o.weapon === 'sword') { box(px, x, hand - 1, x, hand, ramp(LEATHER), true); box(px, x - 1, hand - 2, x + 1, hand - 2, ramp(GOLD), true); box(px, x, hand - 11, x, hand - 3, ramp(STEEL), true); set(px, x, hand - 11, [240, 244, 250]); }
    if (o.weapon === 'dagger') { set(px, x, hand, LEATHER); box(px, x, hand - 4, x, hand - 1, ramp(STEEL), true); }
    if (o.weapon === 'mace') { box(px, x, hand - 5, x, hand + 1, ramp(WOOD), true); box(px, x - 1, hand - 8, x + 1, hand - 6, ramp(IRON)); }
  }

  function staffFront(px, x, r) {
    box(px, x, r.headTop - 2, x, FEET, ramp(WOOD), true);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setGlow(px, x + dx - 0, r.headTop - 4 + dy, ORB);
    setGlow(px, x, r.headTop - 4, [235, 252, 255]);
  }

  // A round shield on the arm: face, rim, and a mark (a plain wooden back from behind).
  function shieldFront(px, o, cx, cy, back) {
    const S = o.shield, widths = [1, 2, 3, 3, 3, 2, 1];
    widths.forEach((w, k) => {
      const y = cy - 3 + k;
      for (let dx = -w; dx <= w; dx++) set(px, cx + dx, y, Math.abs(dx) === w || k === 0 || k === 6 ? S.rim : back ? WOOD : S.face);
    });
    if (!back) { box(px, cx, cy - 2, cx, cy + 2, [S.mark, S.mark, S.mark], true); box(px, cx - 2, cy, cx + 2, cy, [S.mark, S.mark, S.mark], true); }
  }

  // ---------- Families, poses, hands ----------

  // Walk and stride numbers for the villagers' kit (stride, up, pass).
  function pose(p) { return { stride: p.stride || 0, up: p.up || 0, pass: p.pass || 0 }; }

  // All 8 facings standing and walking, for CharacterArt.
  function make(key) {
    const o = OUTFITS[key];
    const east = { stand: side(o, STAND), walk: WALK.map(w => side(o, w)) };
    const front = { stand: frontBack(o, STAND, false), walk: WALK.map(w => frontBack(o, w, false)) };
    const back = { stand: frontBack(o, STAND, true), walk: WALK.map(w => frontBack(o, w, true)) };
    const west = { stand: mirror(east.stand), walk: east.walk.map(mirror) };
    return { east, west, south: front, 'south-east': front, 'south-west': front, north: back, 'north-east': back, 'north-west': back, light: o.light || null };
  }

  // The pixels of a hero in a pose (a name, plus an arm angle while swinging, and the weapon hidden while a
  // blade effect draws it). Side views only; other facings stand. Cached.
  function posed(key, dir, name, arm, noWeapon) {
    const sideOn = dir.includes('east') || dir.includes('west');
    if (!sideOn) return null;
    const p = { ...(POSES[name] || {}), ...(arm != null ? { arm, weapon: arm } : {}), ...(noWeapon ? { noWeapon: true } : {}) };
    const id = `${key}|${dir}|${name}|${arm == null ? '' : Math.round(arm * 20)}|${noWeapon ? 1 : 0}`;
    let px = cache.get(id);
    if (!px) {
      const q = arm != null ? { ...p, arm: Math.round(arm * 20) / 20 } : p;
      px = side(OUTFITS[key], q);
      if (dir.includes('west')) px = mirror(px);
      if (cache.size > 600) cache.clear();
      cache.set(id, px);
    }
    return px;
  }

  // Where a hero's shoulder is and how long the arm is, in map pixels from the feet (for blades that swing from it).
  function shoulder(f, name) {
    const o = OUTFITS[f.key], r = rig(o, POSES[name] || {}), dir = f.dir.includes('west') ? -1 : 1;
    return { x: f.x + f.knockX + dir * (r.sx - CX) / 2, y: f.y + f.knockY - (FEET - r.sy) / 2, arm: r.B.arm / 2, dir };
  }

  // The hand's position (map pixels) with the arm at an angle.
  function handPoint(f, a, name) {
    const s = shoulder(f, name);
    return { x: s.x + Math.sin(a) * s.arm * s.dir, y: s.y - Math.cos(a) * s.arm };
  }

  function armOf(name) { const p = POSES[name]; return p && p.arm != null ? p.arm : Math.PI - 0.2; }

  for (const key of Object.keys(OUTFITS)) CharacterArt.addGenerated(key, OUTFITS[key].name, '#c9a24a', () => make(key), { group: 'Heroes' });

  return { OUTFITS, POSES, has, posed, shoulder, handPoint, armOf };
})();
