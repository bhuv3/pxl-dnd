// Monsters: skeletons, goblins, slimes and cultists drawn in code, a different one for every seed, at the size of
// the villagers. Each family rolls its own looks (bones and armor, skin and gear, color and size, robes and masks)
// and walks at its own pace and in its own way (skeletons and goblins stride and swing their arms, cultists glide with
// their robes swishing, slimes hop and squash); some carry a light (a goblin's torch, a cultist's candle, a glowing
// slime).
const Monsters = (() => {
  const { SIZE, CX, FEET, blank, set, box, ramp, jitter, outline, dim, posed, mirrored, footUp, armSwing, stride } = Villagers.kit;
  const IRON = [128, 132, 140], STEEL = [200, 204, 212], RUST = [140, 86, 52], WOOD = [130, 90, 56], LEATHER = [96, 62, 40];
  const GOLD = [214, 172, 64], DARK = [24, 20, 26], TOOTH = [236, 232, 214], FLAME = [[255, 238, 160], [255, 168, 60]], SHOE = [56, 44, 40];
  const EYES = [[255, 84, 60], [96, 206, 255], [130, 255, 120], [255, 206, 90], [196, 120, 255]];
  const DULL = [[110, 40, 40], [60, 70, 100], [70, 80, 60], [96, 84, 70], [60, 50, 70], [120, 100, 70], [80, 60, 44]];
  const WARM = [1.45, 1, 0.6];

  // A pixel that stays bright at night (alpha 254, see CharacterArt).
  function glow(px, x, y, c) {
    set(px, x, y, c);
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) px[(y * SIZE + x) * 4 + 3] = 254;
  }
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];
  // A light's color for a pixel color: brighter where the color is strong.
  const tintOf = c => c.map(v => 0.55 + v / 255 * 0.95);

  // The 8 facings from a front, back and east-facing side, each { stand, walk } (see Villagers.kit.posed).
  function views(front, back, east, light) {
    return { east, west: mirrored(east), south: front, 'south-east': front, 'south-west': front, north: back, 'north-east': back, 'north-west': back, light };
  }

  // A limb w pixels wide from (x, y0) down to row y1, ending ahead pixels further along (forward or back), in color c.
  function limb(px, x, y0, y1, ahead, w, c) {
    for (let y = y0; y <= y1; y++) { const dx = x + Math.round(ahead * (y - y0 + 1) / (y1 - y0 + 1)); for (let k = 0; k < w; k++) set(px, dx + k, y, c); }
  }

  // ---------- Skeleton ----------

  const BONES = [[228, 222, 204], [214, 202, 168], [200, 198, 190], [196, 182, 150]];

  function skeleton(seed) {
    const rng = Random.makeRng(seed * 4241 + 7);
    const p = {
      bone: ramp(jitter(pick(rng, BONES), rng)), eye: pick(rng, EYES),
      helm: pick(rng, ['none', 'none', 'helm', 'horned', 'hood', 'crown']),
      armor: pick(rng, ['none', 'none', 'plate', 'rags', 'rags']),
      weapon: pick(rng, ['sword', 'sword', 'axe', 'spear', 'bow', 'none']),
      shield: rng() < 0.35, cloth: ramp(jitter(pick(rng, DULL), rng)), metal: ramp(jitter(rng() < 0.5 ? RUST : IRON, rng)),
    };
    if (p.weapon === 'bow' || p.weapon === 'spear') p.shield = false;
    return views(posed(pose => skeletonFront(p, false, pose)), posed(pose => skeletonFront(p, true, pose)), posed(pose => skeletonSide(p, pose)));
  }

  function skeletonFront(p, back, pose) {
    const px = blank(), B = p.bone, top = 5 - pose.up, body = 15 - pose.up, hips = 23 - pose.up, hand = body + 7;
    const ws = back ? -1 : 1, wx = CX + ws * 6, sx = CX - ws * 7;
    if (back) weapon(px, p.weapon, wx, top, hand + armSwing(pose, ws), p);
    for (const s of [-1, 1]) {
      const lift = footUp(pose, s);
      for (let y = hips + 1; y < FEET - lift; y++) set(px, CX + s * 2, y, s < 0 ? B[2] : B[1]);
      set(px, CX + s * 2, hips + 3, B[0]);
      box(px, s < 0 ? CX - 4 : CX + 2, FEET - lift, s < 0 ? CX - 2 : CX + 4, FEET - lift, B, true);
    }
    box(px, CX - 3, hips, CX + 3, hips, B);
    for (let y = body; y < hips; y++) set(px, CX, y, back ? B[1] : B[0]);
    for (let y = body + 1; y <= body + 6; y += 2) { const w = y > body + 4 ? 2 : 3; for (let x = CX - w; x <= CX + w; x++) set(px, x, y, x < CX ? B[2] : B[1]); }
    box(px, CX - 4, body, CX + 4, body, B);
    for (const s of [-1, 1]) {
      const ax = CX + s * 5, reach = hand + armSwing(pose, s);
      for (let y = body; y <= reach; y++) set(px, ax, y, s < 0 ? B[2] : B[1]);
      set(px, ax, body + 4, B[0]);
      set(px, ax, reach + 1, B[1]); set(px, ax + s, reach + 1, B[0]);
    }
    if (p.armor === 'plate') { box(px, CX - 3, body, CX + 3, body + 5, p.metal); set(px, CX - 2, body + 1, p.metal[2]); set(px, CX + 2, body + 1, p.metal[0]); }
    if (p.armor === 'rags') {
      for (let y = hips - 1; y <= hips + 3; y++) for (let x = CX - 4; x <= CX + 4; x++) if (y < hips + 3 || (x + y) % 2) set(px, x, y, x < CX - 2 ? p.cloth[2] : p.cloth[1]);
      box(px, CX - 3, body, CX - 2, body + 3, p.cloth, true);
    }
    set(px, CX, body - 1, B[0]);
    skull(px, p, top, back);
    helmet(px, p, top, back, false);
    if (!back) weapon(px, p.weapon, wx, top, hand + armSwing(pose, ws), p);
    if (p.shield) shield(px, sx, hand - 3 + armSwing(pose, -ws), back, p);
    outline(px);
    return px;
  }

  // A skull: rounded cranium, narrow jaw, dark sockets with glowing eyes, a nose hole and teeth.
  function skull(px, p, top, back) {
    const B = p.bone;
    for (let j = 0; j < 7; j++) {
      const inset = j === 0 ? 2 : j === 1 ? 1 : 0;
      for (let x = CX - 4 + inset; x <= CX + 4 - inset; x++) set(px, x, top + j, x === CX + 4 - inset ? B[0] : j < 3 && x < CX ? B[2] : B[1]);
    }
    for (let j = 7; j < 9; j++) for (let x = CX - 2; x <= CX + 2; x++) set(px, x, top + j, j === 8 ? B[0] : B[1]);
    if (back) return;
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? CX - 3 : CX + 1;
      for (let y = top + 3; y <= top + 5; y++) for (let x = x0; x <= x0 + 2; x++) if (!(y === top + 5 && x === (s < 0 ? x0 : x0 + 2))) set(px, x, y, DARK);
      glow(px, x0 + 1, top + 4, p.eye);
    }
    set(px, CX, top + 6, DARK);
    for (let x = CX - 2; x <= CX + 2; x++) if ((x - CX) % 2) set(px, x, top + 7, DARK);
  }

  function helmet(px, p, top, back, side) {
    const M = p.metal, a = side ? CX - 5 : CX - 5, b = side ? CX + 4 : CX + 5;
    if (p.helm === 'helm' || p.helm === 'horned') {
      box(px, a, top - 1, b, top + 2, M);
      set(px, a + 1, top, M[2]);
      if (!back && !side) for (let y = top + 3; y <= top + 5; y++) set(px, CX, y, M[1]);
    }
    if (p.helm === 'horned') {
      const H = p.bone;
      for (const s of side ? [-1] : [-1, 1]) {
        const x = s < 0 ? a : b;
        set(px, x + s, top, H[1]); set(px, x + s * 2, top - 1, H[1]); set(px, x + s * 2, top - 2, H[2]); set(px, x + s * 2, top - 3, H[2]); set(px, x + s, top - 4, H[2]);
      }
    }
    if (p.helm === 'hood') {
      const C = p.cloth;
      for (let j = -1; j <= 8; j++) {
        const inset = j === -1 ? 3 : j === 0 ? 1 : 0;
        for (let x = CX - 6 + inset; x <= CX + (side ? 4 : 6) - inset; x++) {
          const opening = side ? j >= 3 && x >= CX : !back && j >= 3 && Math.abs(x - CX) <= 4;
          if (!opening) set(px, x, top + j, x < CX - 3 ? C[2] : x > CX + 3 ? C[0] : C[1]);
        }
      }
    }
    if (p.helm === 'crown') {
      const G = ramp(GOLD);
      box(px, CX - 4, top, CX + 3 + (side ? 0 : 1), top, G, true);
      for (let x = CX - 4; x <= CX + 4; x += 2) set(px, x, top - 1, G[2]);
      if (!back) glow(px, CX, top, [255, 70, 80]);
    }
  }

  // What a skeleton holds at column x (hand row hand). Shared by the side view.
  function weapon(px, kind, x, top, hand, p) {
    const W = ramp(WOOD), S = ramp(STEEL);
    if (kind === 'sword') {
      for (let y = hand - 9; y < hand; y++) set(px, x, y, y === hand - 9 ? S[1] : S[2]);
      box(px, x - 1, hand, x + 1, hand, ramp(IRON), true);
      set(px, x, hand + 1, LEATHER); set(px, x, hand + 2, GOLD);
    } else if (kind === 'axe') {
      for (let y = hand - 7; y <= hand + 3; y++) set(px, x, y, W[1]);
      const d = x > CX ? 1 : -1;
      for (let y = hand - 7; y <= hand - 4; y++) for (let k = 1; k <= 2; k++) set(px, x + d * k, y, k === 2 ? S[2] : S[1]);
    } else if (kind === 'spear') {
      for (let y = top - 2; y <= FEET; y++) set(px, x, y, W[1]);
      set(px, x, top - 3, S[2]); set(px, x, top - 4, S[2]); set(px, x - 1, top - 2, S[0]); set(px, x + 1, top - 2, S[0]);
    } else if (kind === 'bow') {
      const d = x > CX ? 1 : -1;
      for (let k = -6; k <= 6; k++) set(px, x + d * Math.round(Math.sqrt(1 - (k / 6) ** 2) * 2), hand - 2 + k, W[k < 0 ? 2 : 1]);
      for (let k = -5; k <= 5; k++) set(px, x, hand - 2 + k, [210, 206, 190]);
    }
  }

  // A round wooden shield with an iron rim and boss, centered on column x.
  function shield(px, x, y, back, p) {
    const W = ramp(back ? WOOD.map(v => v * 0.8) : WOOD), M = p.metal;
    for (let r = 0; r < 7; r++) {
      const w = r === 0 || r === 6 ? 1 : 2;
      for (let k = -w; k <= w; k++) set(px, x + k, y + r, Math.abs(k) === w || r === 0 || r === 6 ? M[0] : k < 0 ? W[2] : W[1]);
    }
    if (!back) { set(px, x, y + 3, M[2]); set(px, x, y + 2, M[1]); }
  }

  function skeletonSide(p, pose) {
    const px = blank(), B = p.bone, top = 5 - pose.up, body = 15 - pose.up, hips = 23 - pose.up, hand = body + 7;
    const swing = pose.stride ? -pose.stride : 0, reach = hand - Math.abs(swing);
    // The far arm (with the shield) behind, then the legs, far one darker.
    limb(px, CX, body, hand - Math.abs(swing), -swing * 2, 1, dim(B, 0.8)[1]);
    if (p.shield) shield(px, CX - 3 - swing * 2, hand - 3, true, p);
    for (const s of [-1, 1]) {
      const { ahead, lift } = stride(pose, s), x = s < 0 ? CX - 1 : CX + 1, C = s < 0 ? dim(B, 0.8) : B;
      limb(px, x, hips + 1, FEET - 1 - lift, ahead, 1, C[s < 0 ? 1 : 0]);
      box(px, x + ahead - 1, FEET - lift, x + ahead + 1, FEET - lift, C, true);
    }
    box(px, CX - 2, hips, CX + 1, hips, B);
    for (let y = body; y < hips; y++) set(px, CX - 1, y, B[0]);
    for (let y = body + 1; y <= body + 6; y += 2) for (let x = CX - 1; x <= CX + 2 - (y > body + 4 ? 1 : 0); x++) set(px, x, y, B[1]);
    if (p.armor === 'plate') box(px, CX - 2, body, CX + 2, body + 5, p.metal);
    if (p.armor === 'rags') for (let y = hips - 1; y <= hips + 3; y++) for (let x = CX - 3; x <= CX + 2; x++) if (y < hips + 3 || (x + y) % 2) set(px, x, y, p.cloth[1]);
    set(px, CX, body - 1, B[0]);
    // Skull in profile, facing right.
    for (let j = 0; j < 7; j++) {
      const inset = j === 0 ? 2 : j === 1 ? 1 : 0;
      for (let x = CX - 4 + inset; x <= CX + 3 - (j === 0 ? 1 : 0); x++) set(px, x, top + j, x === CX - 4 + inset ? B[0] : B[1]);
    }
    for (let j = 7; j < 9; j++) for (let x = CX; x <= CX + 3; x++) set(px, x, top + j, j === 8 ? B[0] : B[1]);
    box(px, CX + 1, top + 3, CX + 2, top + 4, [DARK, DARK, DARK], true);
    glow(px, CX + 2, top + 4, p.eye);
    set(px, CX + 3, top + 5, DARK);
    set(px, CX + 1, top + 7, DARK); set(px, CX + 3, top + 7, DARK);
    helmet(px, p, top, false, true);
    limb(px, CX, body, reach, swing * 2, 1, B[2]);
    set(px, CX + 1 + swing * 2, reach + 1, B[1]);
    weapon(px, p.weapon, CX + 2 + swing * 2, top, reach, p);
    outline(px);
    return px;
  }

  // ---------- Goblin ----------

  const GREENS = [[112, 152, 70], [92, 134, 84], [146, 164, 72], [118, 128, 96], [96, 150, 120], [160, 140, 82]];

  function goblin(seed) {
    const rng = Random.makeRng(seed * 6007 + 3);
    const p = {
      skin: ramp(jitter(pick(rng, GREENS), rng)), eye: pick(rng, [[255, 222, 80], [255, 96, 60], [250, 250, 236]]), glowEyes: rng() < 0.5,
      top: pick(rng, ['rags', 'rags', 'vest', 'tunic', 'bare']), cloth: ramp(jitter(pick(rng, DULL), rng)),
      hat: pick(rng, ['none', 'none', 'pot', 'hood', 'bone', 'feather']), item: pick(rng, ['dagger', 'club', 'spear', 'torch', 'torch', 'sling']),
      ear: 3 + Math.floor(rng() * 3), hooked: rng() < 0.5, tooth: rng() < 0.7, stout: rng() < 0.3,
    };
    const light = p.item === 'torch' ? { color: WARM, radius: 24, power: 1, up: 8 } : null;
    return views(posed(pose => goblinFront(p, false, pose)), posed(pose => goblinFront(p, true, pose)), posed(pose => goblinSide(p, pose)), light);
  }

  function goblinFront(p, back, pose) {
    const px = blank(), K = p.skin, legTop = 25 - pose.up, body = 19 - pose.up, top = 10 - pose.up, half = p.stout ? 5 : 4, hand = legTop;
    const is = back ? -1 : 1, ix = CX + is * (half + 3);
    if (back) goblinItem(px, p, ix, hand + armSwing(pose, is), top);
    for (const s of [-1, 1]) {
      const lift = footUp(pose, s), x0 = s < 0 ? CX - 3 : CX + 1;
      box(px, x0, legTop, x0 + 2, FEET - 2 - lift, K);
      box(px, s < 0 ? CX - 4 : CX + 1, FEET - 1 - lift, s < 0 ? CX - 1 : CX + 4, FEET - lift, K, true);
      set(px, CX + s * 4, FEET - lift, K[0]);
    }
    const C = p.cloth;
    box(px, CX - half, body, CX + half, legTop - 1, p.top === 'bare' || p.top === 'vest' ? K : C);
    if (p.top === 'vest' && !back) { box(px, CX - half, body, CX - 2, legTop - 1, C); box(px, CX + 2, body, CX + half, legTop - 1, C); }
    if (p.top === 'vest' && back) box(px, CX - half, body, CX + half, legTop - 1, C);
    if (p.top === 'rags') for (let x = CX - half; x <= CX + half; x++) if ((x + 1) % 2) set(px, x, legTop, C[1]);
    if (p.top === 'tunic') box(px, CX - half, legTop, CX + half, legTop + 1, C);
    box(px, CX - 2, legTop, CX + 2, legTop + 1, ramp(LEATHER));
    box(px, CX - half, legTop - 1, CX + half, legTop - 1, ramp(LEATHER), true);
    for (const s of [-1, 1]) {
      const ax = s < 0 ? CX - half - 2 : CX + half + 1, reach = hand + armSwing(pose, s);
      box(px, ax, body, ax + 1, reach - 1, p.top === 'tunic' || p.top === 'rags' ? C : K);
      box(px, ax, reach, ax + 1, reach + 1, K);
    }
    // A big head with long ears.
    for (let j = 0; j < 8; j++) {
      const inset = j === 0 ? 2 : j === 1 || j === 7 ? 1 : 0;
      for (let x = CX - 5 + inset; x <= CX + 5 - inset; x++) set(px, x, top + j, x === CX + 5 - inset ? K[0] : x < CX - 2 && j < 4 ? K[2] : K[1]);
    }
    for (const s of [-1, 1]) {
      for (let k = 1; k <= p.ear; k++) {
        const y = top + 3 - Math.floor(k / 2);
        set(px, CX + s * (5 + k), y, k === p.ear ? K[0] : K[1]);
        if (k < p.ear - 1) set(px, CX + s * (5 + k), y + 1, K[0]);
      }
      if (!back) set(px, CX + s * 6, top + 4, [170, 90, 90]);
    }
    if (!back) {
      for (const s of [-1, 1]) {
        set(px, CX + s * 2, top + 3, K[0]); set(px, CX + s * 3, top + 3, K[0]);
        if (p.glowEyes) glow(px, CX + s * 2, top + 4, p.eye); else set(px, CX + s * 2, top + 4, p.eye);
      }
      set(px, CX, top + 4, K[1]); set(px, CX, top + 5, K[0]); set(px, CX, top + 6, K[0]);
      if (p.hooked) set(px, CX + 1, top + 6, K[0]);
      for (let x = CX - 2; x <= CX + 2; x++) set(px, x, top + 7, DARK);
      if (p.tooth) set(px, CX + 1, top + 7, TOOTH);
    }
    goblinHat(px, p, top, back, false);
    if (!back) goblinItem(px, p, ix, hand + armSwing(pose, is), top);
    outline(px);
    return px;
  }

  function goblinHat(px, p, top, back, side) {
    const C = p.cloth, M = ramp(IRON), r = side ? CX + 4 : CX + 5;
    if (p.hat === 'pot') { box(px, CX - 5, top - 2, r, top + 1, M); set(px, CX - 4, top - 1, M[2]); set(px, CX, top - 3, M[0]); }
    if (p.hat === 'hood') {
      for (let j = -1; j <= 7; j++) {
        const inset = j === -1 ? 3 : j === 0 ? 1 : 0;
        for (let x = CX - 5 + inset; x <= r - inset; x++) {
          const opening = side ? j >= 3 && x >= CX : !back && j >= 3 && Math.abs(x - CX) <= 3;
          if (!opening) set(px, x, top + j, x < CX - 2 ? C[2] : C[1]);
        }
      }
    }
    if (p.hat === 'bone') { for (let k = -3; k <= 3; k++) set(px, CX + k, top - 1 - (Math.abs(k) === 3 ? 1 : 0), TOOTH); }
    if (p.hat === 'feather') for (let k = 0; k < 5; k++) set(px, CX - 2 - (k >> 1), top - 1 - k, k % 2 ? [220, 70, 50] : [180, 40, 40]);
  }

  // What a goblin holds at column x: a dagger, club, spear, torch (its flame glows) or sling.
  function goblinItem(px, p, x, hand, top) {
    const W = ramp(WOOD), S = ramp(STEEL);
    if (p.item === 'dagger') { for (let y = hand - 4; y < hand; y++) set(px, x, y, S[2]); set(px, x - 1, hand - 1, IRON); set(px, x + 1, hand - 1, IRON); }
    if (p.item === 'club') { for (let y = hand - 5; y <= hand + 1; y++) set(px, x, y, W[1]); box(px, x - 1, hand - 8, x + 1, hand - 5, W); set(px, x + 1, hand - 7, W[0]); }
    if (p.item === 'spear') { for (let y = top - 2; y <= FEET; y++) set(px, x, y, W[1]); set(px, x, top - 3, S[2]); set(px, x, top - 4, S[2]); set(px, x - 1, top - 2, S[0]); set(px, x + 1, top - 2, S[0]); }
    if (p.item === 'torch') {
      for (let y = hand - 5; y <= hand + 1; y++) set(px, x, y, W[y < hand - 3 ? 0 : 1]);
      glow(px, x, hand - 6, FLAME[1]); glow(px, x - 1, hand - 7, FLAME[1]); glow(px, x, hand - 7, FLAME[0]); glow(px, x + 1, hand - 7, FLAME[1]);
      glow(px, x, hand - 8, FLAME[0]); glow(px, x, hand - 9, FLAME[1]);
    }
    if (p.item === 'sling') { for (let y = hand + 1; y <= hand + 4; y++) set(px, x, y, LEATHER); set(px, x - 1, hand + 4, [150, 150, 150]); }
  }

  function goblinSide(p, pose) {
    const px = blank(), K = p.skin, C = p.cloth, legTop = 25 - pose.up, body = 19 - pose.up, top = 10 - pose.up, hand = legTop;
    const swing = pose.stride ? -pose.stride : 0, sleeve = p.top === 'bare' || p.top === 'vest' ? K : C;
    // The far arm behind, then the legs (far one darker), each with a clawed foot.
    limb(px, CX - 1, body + 1, hand - Math.abs(swing), -swing * 2, 2, dim(sleeve, 0.7)[1]);
    for (const s of [-1, 1]) {
      const { ahead, lift } = stride(pose, s), x0 = s < 0 ? CX - 2 : CX, S = s < 0 ? dim(K, 0.8) : K;
      limb(px, x0, legTop, FEET - 2 - lift, ahead, 2, S[1]);
      box(px, x0 + ahead, FEET - 1 - lift, x0 + ahead + 3, FEET - lift, S, true);
      set(px, x0 + ahead + 4, FEET - lift, S[0]);
    }
    const half = p.stout ? 3 : 2;
    box(px, CX - half - 1, body, CX + half, legTop - 1, p.top === 'bare' ? K : C);
    if (p.top === 'rags') for (let x = CX - half - 1; x <= CX + half; x++) if (x % 2) set(px, x, legTop, C[1]);
    if (p.top === 'tunic') box(px, CX - half - 1, legTop, CX + half, legTop + 1, C);
    box(px, CX - 2, legTop, CX + 1, legTop + 1, ramp(LEATHER));
    box(px, CX - half - 1, legTop - 1, CX + half, legTop - 1, ramp(LEATHER), true);
    // Head in profile with the ear sweeping back and a long nose in front.
    for (let j = 0; j < 8; j++) {
      const inset = j === 0 ? 2 : j === 1 || j === 7 ? 1 : 0;
      for (let x = CX - 4 + inset; x <= CX + 4 - inset; x++) set(px, x, top + j, x === CX - 4 + inset ? K[0] : K[1]);
    }
    for (let k = 1; k <= p.ear + 1; k++) { set(px, CX - 3 - k, top + 3 - Math.floor(k / 2), k > p.ear ? K[0] : K[1]); if (k < p.ear) set(px, CX - 3 - k, top + 4 - Math.floor(k / 2), K[0]); }
    set(px, CX + 2, top + 3, K[0]);
    if (p.glowEyes) glow(px, CX + 2, top + 4, p.eye); else set(px, CX + 2, top + 4, p.eye);
    set(px, CX + 5, top + 5, K[1]); set(px, CX + 5, top + 6, K[0]); if (p.hooked) set(px, CX + 6, top + 6, K[0]);
    set(px, CX + 2, top + 7, DARK); set(px, CX + 3, top + 7, DARK); if (p.tooth) set(px, CX + 3, top + 7, TOOTH);
    goblinHat(px, p, top, false, true);
    const reach = hand - Math.abs(swing);
    limb(px, CX - 1, body + 1, reach - 1, swing * 2, 2, dim(sleeve, p.top === 'bare' || p.top === 'vest' ? 0.9 : 0.88)[1]);
    box(px, CX - 1 + swing * 2, reach, CX + swing * 2, reach + 1, K);
    goblinItem(px, p, CX + 2 + swing * 2, reach, top);
    outline(px);
    return px;
  }

  // ---------- Slime ----------

  const SLIMES = [[96, 196, 84], [80, 150, 230], [236, 120, 170], [160, 100, 220], [236, 176, 70], [70, 196, 186], [200, 70, 70]];

  function slime(seed) {
    const rng = Random.makeRng(seed * 3301 + 11);
    const base = jitter(pick(rng, SLIMES), rng);
    const p = {
      base, color: ramp(base), rx: 6 + Math.floor(rng() * 4), ry: 5 + Math.floor(rng() * 3),
      eyes: pick(rng, ['two', 'two', 'one', 'none']), mouth: rng() < 0.5,
      inside: pick(rng, ['none', 'none', 'bubbles', 'skull', 'coin', 'bone']), crown: rng() < 0.08, glows: rng() < 0.45,
    };
    const light = p.glows ? { color: tintOf(base), radius: 14 + p.rx, power: 0.85, up: p.ry } : null;
    const hops = view => ({ stand: blob(p, view, HOPS[0]), walk: HOPS.slice(1).map(h => blob(p, view, h)) });
    return views(hops('front'), hops('back'), hops('side'), light);
  }

  // A slime doesn't walk, it hops: [at rest, squashed flat, stretching up, in the air, coming down]. sq: wider and
  // lower by that much; hop: how high off the ground.
  const HOPS = [{ sq: 0, hop: 0 }, { sq: 1, hop: 0 }, { sq: -1, hop: 1 }, { sq: 0, hop: 2 }, { sq: -1, hop: 1 }];

  // A rounded blob sitting on the ground, lit from the top left, with a shine, eyes, and something stuck inside.
  function blob(p, view, { sq, hop }) {
    const px = blank(), C = p.color, rx = (view === 'side' ? p.rx - 1 : p.rx) + sq, ry = p.ry - sq, base = FEET - hop, cy = base - ry;
    const core = C[1].map(v => Math.min(255, v + (255 - v) * 0.35));
    for (let y = base - ry * 2 + 1; y <= base; y++) {
      const t = (y - cy) / ry, w = t < 0 ? rx * Math.sqrt(1 - t * t) : rx * (1 - 0.12 * t * t);
      for (let x = Math.round(CX - w); x <= Math.round(CX + w); x++) {
        const u = (x - CX) / rx;
        let c = u + t < -0.7 ? C[2] : y >= base - 1 || u > 0.65 ? C[0] : C[1];
        if (p.glows && Math.hypot(u, t * 1.2) < 0.45) { glow(px, x, y, core); continue; }
        set(px, x, y, c);
      }
    }
    const shine = [240, 248, 250];
    set(px, Math.round(CX - rx * 0.45), Math.round(cy - ry * 0.6), shine);
    set(px, Math.round(CX - rx * 0.45) + 1, Math.round(cy - ry * 0.6), shine);
    set(px, Math.round(CX - rx * 0.45), Math.round(cy - ry * 0.6) + 1, C[2]);
    const mix = c => c.map((v, k) => v * 0.55 + C[1][k] * 0.45);
    if (p.inside === 'skull') { box(px, CX + 1, cy + 1, CX + 3, cy + 2, [mix(TOOTH), mix(TOOTH), mix(TOOTH)], true); set(px, CX + 1, cy + 1, mix(DARK)); set(px, CX + 3, cy + 1, mix(DARK)); set(px, CX + 2, cy + 3, mix(TOOTH)); }
    if (p.inside === 'coin') { set(px, CX + 2, cy + 2, mix(GOLD)); set(px, CX + 3, cy + 2, mix(GOLD)); set(px, CX - 3, cy + 3, mix(GOLD)); }
    if (p.inside === 'bone') for (let k = 0; k < 4; k++) set(px, CX - 1 + k, cy + 3 - (k >> 1), mix(TOOTH));
    if (p.inside === 'bubbles') for (const [dx, dy] of [[2, 1], [-2, 3], [3, -1]]) set(px, CX + dx, cy + dy, C[2]);
    if (view !== 'back') {
      const ex = view === 'side' ? [CX + rx - 3] : p.eyes === 'two' ? [CX - 3, CX + 2] : [CX - 1];
      if (p.eyes === 'two' || (p.eyes === 'one' && view === 'side')) ex.forEach(x => { set(px, x, cy - 2, DARK); set(px, x, cy - 1, DARK); set(px, x, cy - 2, [250, 250, 250]); });
      if (p.eyes === 'one' && view === 'front') { box(px, CX - 2, cy - 3, CX, cy - 1, [[250, 250, 250], [250, 250, 250], [250, 250, 250]], true); set(px, CX - 1, cy - 2, DARK); }
      if (p.mouth && view === 'front') { set(px, CX - 1, cy + 1, DARK); set(px, CX, cy + 2, DARK); set(px, CX + 1, cy + 1, DARK); }
    }
    if (p.crown) {
      const G = ramp(GOLD), y = base - ry * 2;
      box(px, CX - 2, y, CX + 2, y, G, true);
      for (let x = CX - 2; x <= CX + 2; x += 2) set(px, x, y - 1, G[2]);
    }
    outline(px);
    return px;
  }

  // ---------- Cultist ----------

  const ROBES = [[120, 30, 36], [40, 36, 46], [76, 40, 96], [40, 70, 52], [86, 30, 30], [196, 190, 172], [30, 40, 70]];
  const GEMS = [[255, 70, 80], [90, 210, 255], [140, 255, 150], [200, 120, 255], [255, 200, 80]];

  function cultist(seed) {
    const rng = Random.makeRng(seed * 5153 + 29);
    const p = {
      robe: ramp(jitter(pick(rng, ROBES), rng)), trim: ramp(pick(rng, [GOLD, [206, 200, 184], [160, 34, 34], [70, 66, 74]])),
      face: pick(rng, ['shadow', 'shadow', 'mask', 'skull']), eye: pick(rng, EYES), sigil: pick(rng, ['eye', 'circle', 'triangle', 'none']),
      item: pick(rng, ['candle', 'candle', 'dagger', 'staff', 'book']), gem: pick(rng, GEMS),
      hands: ramp(pick(rng, [[230, 200, 176], [200, 160, 130], [150, 156, 150], [130, 90, 70]])), peak: rng() < 0.6,
    };
    const light = p.item === 'candle' ? { color: WARM, radius: 12, power: 0.9, up: 10 } : p.item === 'staff' ? { color: tintOf(p.gem), radius: 16, power: 0.9, up: 22 } : null;
    return views(posed(pose => cultistFront(p, false, pose)), posed(pose => cultistFront(p, true, pose)), posed(pose => cultistSide(p, pose)), light);
  }

  // Cultists glide: the body rises and falls, the hem swishes from side to side, and a foot shows under it.
  function cultistFront(p, back, pose) {
    const px = blank(), R = p.robe, T = p.trim, top = 6 - pose.up, body = 16 - pose.up, hand = body + 6;
    if (p.item === 'staff') staff(px, p, back ? CX - 7 : CX + 7, top);
    // The robe flares toward the hem; a trimmed opening runs down the front.
    const swish = y => y >= FEET - 2 ? pose.stride : 0;
    for (let y = body; y <= FEET; y++) {
      const w = 4 + Math.floor((y - body) / 4), a = CX - w + swish(y), b = CX + w + swish(y);
      for (let x = a; x <= b; x++) set(px, x, y, y === FEET ? T[0] : x === a ? R[2] : x === b ? R[0] : R[1]);
    }
    if (pose.stride) box(px, CX + (pose.stride > 0 ? 1 : -3), FEET, CX + (pose.stride > 0 ? 3 : -1), FEET, ramp(SHOE), true);
    if (!back) for (let y = body + 7; y < FEET; y++) set(px, CX + swish(y), y, T[1]);
    box(px, CX - 4, body + 6, CX + 4, body + 6, ramp([176, 150, 90]), true);
    if (!back && p.sigil !== 'none') sigil(px, p.sigil, CX, body + 3, T);
    // Sleeves, and hands held together in front (or at the sides, holding a dagger or staff).
    for (const s of [-1, 1]) {
      const ax = s < 0 ? CX - 6 : CX + 5;
      box(px, ax, body, ax + 1, hand - 1, R);
      if (back || p.item === 'dagger' || p.item === 'staff') box(px, ax, hand, ax + 1, hand, p.hands, true);
    }
    if (!back && (p.item === 'candle' || p.item === 'book')) {
      for (let x = CX - 3; x <= CX + 3; x++) set(px, x, hand - 2, R[0]);
      box(px, CX - 2, hand - 1, CX + 2, hand - 1, p.hands, true);
      if (p.item === 'candle') {
        for (let y = hand - 4; y <= hand - 2; y++) set(px, CX, y, [236, 228, 200]);
        glow(px, CX, hand - 5, FLAME[1]); glow(px, CX, hand - 6, FLAME[0]);
      } else {
        box(px, CX - 3, hand - 3, CX + 3, hand - 2, ramp([90, 40, 40]), true);
        box(px, CX - 2, hand - 4, CX - 1, hand - 3, ramp([230, 222, 196]), true); box(px, CX + 1, hand - 4, CX + 2, hand - 3, ramp([230, 222, 196]), true);
      }
    }
    if (!back && p.item === 'dagger') { for (let y = hand - 4; y < hand; y++) set(px, CX + 6, y, STEEL); set(px, CX + 5, hand - 1, GOLD); set(px, CX + 7, hand - 1, GOLD); }
    // The hood: peaked or round, the face in shadow (glowing eyes), behind a bone mask, or a bare skull.
    for (let j = p.peak ? -3 : -1; j <= 9; j++) {
      const w = j < 0 ? (p.peak ? 1 + (j + 3) : 3) : j < 2 ? 5 : 6;
      for (let x = CX - w; x <= CX + w; x++) set(px, x, top + j, x < CX - 2 ? R[2] : x > CX + 2 ? R[0] : R[1]);
    }
    if (back) { for (let j = 0; j <= 9; j++) set(px, CX, top + j, R[0]); }
    else {
      for (let j = 3; j <= 8; j++) for (let x = CX - 3; x <= CX + 3; x++) if (!((j === 3 || j === 8) && Math.abs(x - CX) === 3)) set(px, x, top + j, DARK);
      if (p.face === 'mask') { box(px, CX - 2, top + 4, CX + 2, top + 7, ramp([224, 218, 200]), true); set(px, CX - 1, top + 5, DARK); set(px, CX + 1, top + 5, DARK); set(px, CX, top + 7, [200, 194, 176]); }
      if (p.face === 'skull') { box(px, CX - 2, top + 4, CX + 2, top + 7, ramp([214, 206, 180]), true); set(px, CX - 1, top + 5, DARK); set(px, CX + 1, top + 5, DARK); set(px, CX, top + 6, DARK); set(px, CX - 1, top + 7, DARK); set(px, CX + 1, top + 7, DARK); }
      glow(px, CX - 1, top + 5, p.eye); glow(px, CX + 1, top + 5, p.eye);
      for (let j = 3; j <= 8; j++) { set(px, CX - 4, top + j, T[1]); set(px, CX + 4, top + j, T[0]); }
    }
    outline(px);
    return px;
  }

  // A small symbol on the chest.
  function sigil(px, kind, x, y, T) {
    const c = T[2];
    if (kind === 'eye') { set(px, x - 1, y, c); set(px, x + 1, y, c); set(px, x, y - 1, c); set(px, x, y + 1, c); set(px, x, y, DARK); }
    if (kind === 'circle') { set(px, x - 1, y, c); set(px, x + 1, y, c); set(px, x, y - 1, c); set(px, x, y + 1, c); }
    if (kind === 'triangle') { set(px, x, y - 1, c); set(px, x - 1, y, c); set(px, x + 1, y, c); set(px, x - 1, y + 1, c); set(px, x, y + 1, c); set(px, x + 1, y + 1, c); }
  }

  // A tall staff topped with a glowing gem in a claw.
  function staff(px, p, x, top) {
    for (let y = top - 1; y <= FEET; y++) set(px, x, y, ramp(WOOD)[y % 5 ? 1 : 0]);
    set(px, x - 1, top - 2, WOOD); set(px, x + 1, top - 2, WOOD);
    glow(px, x, top - 3, p.gem); glow(px, x, top - 2, p.gem.map(v => v * 0.8)); glow(px, x, top - 4, p.gem.map(v => Math.min(255, v + 60)));
  }

  function cultistSide(p, pose) {
    const px = blank(), R = p.robe, T = p.trim, top = 6 - pose.up, body = 16 - pose.up, hand = body + 6;
    const swish = y => y >= FEET - 2 ? pose.stride : 0, hemW = 3 + Math.floor((FEET - body) / 4);
    if (pose.stride < 0) box(px, CX - hemW - 3, FEET, CX - hemW - 1, FEET, dim(ramp(SHOE), 0.8), true);
    for (let y = body; y <= FEET; y++) {
      const w = 3 + Math.floor((y - body) / 4), a = CX - w - 1 + swish(y), b = CX + w - 1 + swish(y);
      for (let x = a; x <= b; x++) set(px, x, y, y === FEET ? T[0] : x === b ? R[0] : R[1]);
    }
    if (pose.stride > 0) box(px, CX + hemW, FEET, CX + hemW + 2, FEET, ramp(SHOE), true);
    box(px, CX - 4, body + 6, CX + 3, body + 6, ramp([176, 150, 90]), true);
    for (let j = p.peak ? -3 : -1; j <= 9; j++) {
      const w = j < 0 ? (p.peak ? 1 + (j + 3) : 3) : 5;
      const back = j < 0 && p.peak ? -2 : 0;
      for (let x = CX - w + back; x <= CX + w - 1 + back; x++) set(px, x, top + j, x < CX - 2 ? R[2] : R[1]);
    }
    for (let j = 3; j <= 8; j++) for (let x = CX + 1; x <= CX + 4; x++) set(px, x, top + j, DARK);
    if (p.face !== 'shadow') box(px, CX + 2, top + 4, CX + 4, top + 7, ramp(p.face === 'mask' ? [224, 218, 200] : [214, 206, 180]), true);
    glow(px, CX + 3, top + 5, p.eye);
    for (let j = 3; j <= 8; j++) set(px, CX, top + j, T[1]);
    box(px, CX - 1, body + 1, CX + 1, hand - 1, R.map(c => c.map(v => v * 0.85)), true);
    box(px, CX, hand, CX + 1, hand, p.hands, true);
    if (p.item === 'staff') staff(px, p, CX + 3, top);
    if (p.item === 'candle') { for (let y = hand - 3; y < hand; y++) set(px, CX + 2, y, [236, 228, 200]); glow(px, CX + 2, hand - 4, FLAME[1]); glow(px, CX + 2, hand - 5, FLAME[0]); }
    if (p.item === 'dagger') { for (let y = hand - 4; y < hand; y++) set(px, CX + 2, y, STEEL); set(px, CX + 2, hand, GOLD); }
    if (p.item === 'book') box(px, CX + 1, hand - 2, CX + 3, hand - 1, ramp([90, 40, 40]), true);
    outline(px);
    return px;
  }

  // Pace (pixels a second), how far from home they stroll, and the share that patrol.
  CharacterArt.addGenerated('skeleton', 'Skeleton', '#e4dccb', skeleton, { group: 'Monsters', walk: { speed: 5, roam: 28, patrol: 0.35 } });
  CharacterArt.addGenerated('goblin', 'Goblin', '#7f9a46', goblin, { group: 'Monsters', walk: { speed: 8, roam: 36, patrol: 0.5 } });
  CharacterArt.addGenerated('slime', 'Slime', '#60c454', slime, { group: 'Monsters', walk: { speed: 3, roam: 16, patrol: 0.1 } });
  CharacterArt.addGenerated('cultist', 'Cultist', '#7a2a30', cultist, { group: 'Monsters', walk: { speed: 4, roam: 22, patrol: 0.25 } });

  return { skeleton, goblin, slime, cultist };
})();
