// New looks (2024 text) for the Cleric spells. Healing reads warm green-white with rising motes, radiant is gold, necrotic is
// dark violet. Each restyle keeps the spell's events (hit, apply, popup, struck, caught) and changes only how it looks.
// Scale: 5 ft = 10 map pixels.
(() => {
  const { struck, caught, restyle } = Spells;
  const GOLD = [255, 211, 77], HOLY = [255, 244, 190], GREEN = [190, 255, 150], PALE = [225, 255, 205], DARK = [186, 130, 240], WHITE = [255, 255, 255];

  // The caster's hand lighting up as a spell gathers: a halo and a few sparks.
  const gather = (type, kind, radius = 12, count = 14, speed = 14) => [
    { at: 0.02, do: 'glow', where: 'casterHand', type, radius, time: 0.5, power: 0.9 },
    { at: 0.05, do: 'burst', kind, type, count, where: 'casterHand', speed },
  ];

  // Healing arriving on figures: a bloom of green-white light, motes rising off them, a bright outline.
  // who: 'target' or 'hits'; at: when; the rising motes come in three waves so they keep coming.
  const bloom = (who, at, o = {}) => {
    const type = o.type || 'healing', col = o.color || PALE;
    return [
      { at, do: 'glow', who, where: 'chest', type, radius: o.radius || 20, time: 0.9, power: 1 },
      { at, do: 'glow', who, where: 'feet', type, radius: (o.radius || 20) * 1.1, time: 0.8, power: 0.7, squash: 0.5 },
      { at, do: 'burst', who, where: 'feet', kind: 'heal', count: 26, speed: 18, spread: 6, dir: [0, -1], cone: 1.0 },
      { at: at + 0.12, do: 'burst', who, where: 'feet', kind: 'mote', count: 22, speed: 16, spread: 6, dir: [0, -1], cone: 1.0 },
      { at: at + 0.25, do: 'burst', who, where: 'chest', kind: 'heal', count: 18, speed: 12, spread: 5, dir: [0, -1], cone: 1.2 },
      { at: at + 0.05, do: 'flash', who, color: col, time: 0.08 },
      { at: at + 0.05, do: 'outline', who, color: col, time: 0.2 },
    ];
  };

  // "A creature you touch regains 2d8 Hit Points": a green-white glow gathers in the hand, then wells up round the touched
  // friend: a column of soft light, a ring on the floor, motes rising from them.
  restyle('cureWounds', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.7 },
    gather('healing', 'heal', 12, 16, 12),
    { at: 0.2, do: 'ring', type: 'healing', where: 'targetFeet', r0: 2, r1: 17, time: 0.6, thick: 2 },
    { at: 0.25, do: 'column', who: 'target', type: 'healing', height: 26, time: 0.7 },
    { at: 0.25, do: 'column', who: 'target', type: 'healing', height: 22, time: 0.5, dx: -2 },
    { at: 0.25, do: 'column', who: 'target', type: 'healing', height: 22, time: 0.5, dx: 2 },
    { at: 0.25, do: 'glow', where: 'targetFeet', type: 'healing', radius: 22, time: 1.1, power: 0.8, squash: 0.55 },
    { at: 0.25, do: 'glow', where: 'target', type: 'healing', radius: 18, time: 1.0, power: 0.9 },
    { at: 0.25, do: 'emit', kind: 'mote', where: 'targetFeet', rate: 70, time: 0.8, radius: 8, speed: 10, big: 0.5 },
    { at: 0.25, do: 'emit', kind: 'heal', where: 'targetFeet', rate: 40, time: 0.7, radius: 7, speed: 8, big: 0.4 },
    { at: 0.25, do: 'light', type: 'healing', where: 'target', radius: 24, time: 1.1, power: 1.3 },
    { at: 0.55, do: 'flash', who: 'target', color: PALE, time: 0.08 },
    { at: 0.55, do: 'outline', who: 'target', color: PALE, time: 0.2 },
    { at: 0.6, do: 'burst', who: 'target', where: 'chest', kind: 'heal', count: 28, speed: 20, spread: 5 },
    { at: 0.6, do: 'apply', who: 'target' },
    { at: 0.6, do: 'popup', text: 'amount', color: 'heal' },
  ]);

  // "A creature of your choice that you can see within range regains 2d4 Hit Points": the word flies out as a bright green
  // spark trailing a streak, and bursts into rising green light on the friend.
  restyle('healingWord', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.45 },
    ...gather('healing', 'heal', 11, 12, 16),
    { at: 0.05, do: 'burst', kind: 'mote', where: 'mouth', count: 8, speed: 14 },
    { at: 0.1, do: 'projectile', sprite: 'dart', type: 'healing', speed: 95, arc: 10, sure: true, lightRadius: 14, trailRate: 70, glow: 9, streak: 14 },
    { at: 'hit', do: 'pop', type: 'healing', radius: 4, time: 0.2 },
    { at: 'hit', do: 'ring', type: 'healing', where: 'targetFeet', r0: 2, r1: 16, time: 0.5, thick: 2 },
    ...bloom('target', 0, { radius: 18 }).map(s => ({ ...s, at: 'hit', delay: s.at })),
    { at: 'hit', do: 'light', type: 'healing', radius: 22, time: 0.8, power: 1.3 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'amount', color: 'heal' },
  ]);

  // "Flame-like radiance descends on a creature": a bright shaft of gold light drops from above, flames of light lick up
  // round the target's feet (a 5 ft sphere), and motes rain off. A target who saves has it land beside it.
  restyle('sacredFlame', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.7 },
    ...gather('radiant', 'mote', 12, 14, 14),
    { at: 0.2, do: 'glow', where: 'targetFeet', dy: -34, type: 'radiant', radius: 18, time: 0.4, power: 0.8 },
    { at: 0.28, do: 'column', who: 'target', type: 'radiant', height: 40, time: 0.55, if: ['hit', 'crit'] },
    { at: 0.28, do: 'column', who: 'target', type: 'radiant', height: 36, time: 0.45, dx: -2, if: ['hit', 'crit'] },
    { at: 0.28, do: 'column', who: 'target', type: 'radiant', height: 36, time: 0.45, dx: 2, if: ['hit', 'crit'] },
    { at: 0.28, do: 'volume', shape: 'sphere', feet: 5, type: 'radiant', where: 'targetFeet', dy: 0, time: 0.7, light: 1.6, if: ['hit', 'crit'] },
    { at: 0.3, do: 'glow', where: 'targetFeet', type: 'radiant', radius: 24, time: 0.6, power: 1, squash: 0.55 },
    { at: 0.3, do: 'burst', who: 'target', where: 'feet', kind: 'mote', count: 36, speed: 30, spread: 5, if: ['hit', 'crit'] },
    { at: 0.3, do: 'burst', who: 'target', where: 'feet', kind: 'spark', type: 'radiant', count: 14, speed: 40, spread: 3, if: ['hit', 'crit'] },
    { at: 0.28, do: 'column', who: 'target', type: 'radiant', height: 34, time: 0.4, dx: 8, if: 'miss' },
    { at: 0.28, do: 'volume', shape: 'sphere', feet: 3, type: 'radiant', where: 'targetFeet', dy: 0, time: 0.5, light: 1.2, if: 'miss' },
    { at: 0.3, do: 'burst', who: 'target', where: 'feet', kind: 'mote', count: 14, speed: 20, spread: 3, if: 'miss' },
    { at: 0.24, do: 'pose', who: 'target', pose: 'dodge', time: 0.45, if: 'miss' },
    { at: 0.32, do: 'flash', who: 'target', color: HOLY, time: 0.1, if: ['hit', 'crit'] },
    { at: 0.32, do: 'pose', who: 'target', pose: 'hit', time: 0.4, if: ['hit', 'crit'] },
    { at: 0.32, do: 'apply', who: 'target', if: ['hit', 'crit'] },
    { at: 0.32, do: 'popup', text: 'amount', color: 'damage', if: ['hit', 'crit'] },
    { at: 0.32, do: 'popup', text: 'SAVE', color: 'miss', if: 'miss' },
  ]);

  // "Each Undead in a 30-foot Emanation must make a Wisdom save": holy light pours out of the raised symbol and sweeps the
  // whole 30 ft (a 60 px radius) in waves; undead it reaches flash, shake and are shoved back.
  restyle('turnUndead', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 1.0 },
    { at: 0.05, do: 'glow', where: 'casterHand', type: 'radiant', radius: 14, time: 0.7, power: 1 },
    { at: 0.1, do: 'burst', kind: 'mote', type: 'radiant', count: 26, where: 'casterHand', speed: 26 },
    { at: 0.1, do: 'glow', where: 'casterFeet', type: 'radiant', radius: 60, time: 1.1, power: 0.08, squash: 0.6 },
    { at: 0.1, do: 'light', type: 'radiant', where: 'caster', radius: 60, time: 1.1, power: 0.4 },
    { at: 0.15, do: 'volume', shape: 'sphere', feet: 30, type: 'radiant', where: 'casterFeet', dy: 0, time: 0.9, light: 0.3, soft: 0.22 },
    { at: 0.15, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 3, r1: 60, time: 0.6, thick: 2 },
    { at: 0.3, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 3, r1: 60, time: 0.6, thick: 1 },
    { at: 0.45, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 3, r1: 60, time: 0.6, thick: 1 },
    { at: 0.2, do: 'emit', kind: 'mote', where: 'casterFeet', rate: 90, time: 0.8, radius: 60, speed: 10, big: 0.3 },
    { at: 0.5, do: 'flash', who: 'hits', color: HOLY, time: 0.1, hitIf: 'failed' },
    { at: 0.5, do: 'glow', who: 'hits', where: 'chest', type: 'radiant', radius: 22, time: 0.5, power: 1 },
    { at: 0.5, do: 'burst', who: 'hits', where: 'chest', kind: 'mote', count: 24, speed: 34 },
    { at: 0.5, do: 'burst', who: 'hits', where: 'feet', kind: 'spark', type: 'radiant', count: 14, speed: 40, hitIf: 'failed' },
    { at: 0.5, do: 'pose', who: 'hits', pose: 'shiver', time: 0.5 },
    { at: 0.5, do: 'knock', who: 'hits', dist: 2, time: 0.5, hitIf: 'failed' },
    { at: 0.55, do: 'popup', who: 'hits', text: 'TURNED', color: 'radiant', hitIf: 'failed' },
    { at: 0.55, do: 'popup', who: 'hits', text: 'SAVE', color: 'miss', hitIf: 'saved' },
    { at: 0.55, do: 'apply', who: 'hits' },
    { at: 0.6, do: 'popup', who: 'hits', text: 'amount', color: 'damage', hitIf: 'failed', above: 7 },
  ]);

  // Divine Spark: "point your Holy Symbol at another creature within 30 feet ... Radiant or Necrotic damage (CON save, half on
  // a save)": the symbol blazes and a fat bead of the chosen colour leaps to the target and bursts.
  restyle('divineSpark', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'chosen', radius: 14, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'mote', type: 'chosen', count: 22, where: 'casterHand', speed: 20 },
    { at: 0.05, do: 'light', type: 'chosen', where: 'casterHand', radius: 16, time: 0.4, power: 1.2 },
    { at: 0.15, do: 'projectile', sprite: 'bead', type: 'chosen', speed: 170, sure: true, trailRate: 100, lightRadius: 18, glow: 11, streak: 12 },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 6, time: 0.28 },
    { at: 'hit', do: 'glow', type: 'chosen', radius: 26, time: 0.5, power: 1.2 },
    { at: 'hit', do: 'ring', type: 'chosen', where: 'targetFeet', r0: 2, r1: 16, time: 0.4, thick: 2 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 36, speed: 44, spread: 1 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'chosen', count: 14, speed: 50 },
    { at: 'hit', do: 'light', type: 'chosen', radius: 24, time: 0.5, power: 1.4 },
    { at: 'hit', do: 'flash', who: 'target', color: WHITE, time: 0.08 },
    { at: 'hit', do: 'knock', who: 'target', dist: 1.5, time: 0.4, if: ['hit', 'crit'] },
    { at: 'hit', do: 'pose', who: 'target', pose: 'hit', time: 0.4 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'amount', color: 'damage' },
    { at: 'hit', do: 'popup', text: 'SAVE', color: 'miss', above: 7, if: 'miss' },
  ]);

  // Divine Spark healing: "restore Hit Points to the creature": the same spark, but gold and green: it lands softly and
  // the friend is bathed in rising light.
  restyle('divineSparkHeal', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.5 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'radiant', radius: 14, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 22, where: 'casterHand', speed: 20 },
    { at: 0.15, do: 'projectile', sprite: 'dart', type: 'radiant', speed: 120, arc: 8, sure: true, lightRadius: 14, trailRate: 80, glow: 9, streak: 14 },
    { at: 'hit', do: 'pop', type: 'radiant', radius: 4, time: 0.22 },
    { at: 'hit', do: 'ring', type: 'healing', where: 'targetFeet', r0: 2, r1: 16, time: 0.5, thick: 2 },
    ...bloom('target', 0, { radius: 20, color: HOLY }).map(s => ({ ...s, at: 'hit', delay: s.at })),
    { at: 'hit', do: 'burst', kind: 'mote', count: 18, speed: 26 },
    { at: 'hit', do: 'light', type: 'healing', radius: 22, time: 0.8, power: 1.3 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'amount', color: 'heal' },
  ]);

  // "You hurl a bolt of light ... 4d6 Radiant damage, and the next attack roll against it has Advantage": a big white-gold
  // bolt trails a long streak; on a hit it bursts, and the target stays lit, pulsing with light for the next attacker.
  restyle('guidingBolt', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.55 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'radiant', radius: 16, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 26, where: 'casterHand', speed: 22 },
    { at: 0.05, do: 'light', type: 'radiant', where: 'casterHand', radius: 20, time: 0.4, power: 1.3 },
    { at: 0.2, do: 'projectile', sprite: 'bead', type: 'radiant', speed: 170, trailRate: 130, lightRadius: 28, glow: 14, streak: 18 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'radiant', radius: 8, time: 0.3 },
    { at: 'hit', do: 'glow', type: 'radiant', radius: 30, time: 0.9, power: 1.2 },
    { at: 'hit', do: 'screenflash', color: [255, 232, 160], strength: 0.3, time: 0.12, if: 'crit' },
    { at: 'hit', do: 'ring', type: 'radiant', where: 'targetFeet', r0: 3, r1: 24, time: 0.5, thick: 2 },
    { at: 'hit', do: 'burst', kind: 'mote', count: 60, speed: 56, spread: 3, size: 2 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'radiant', count: 26, speed: 80 },
    { at: 'hit', do: 'light', type: 'radiant', radius: 40, time: 0.9, power: 1.9 },
    // It stays lit: a halo that pulses round the target and motes that keep rising, for the Advantage.
    { at: 'hit', do: 'outline', who: 'target', color: GOLD, time: 0.9, if: ['hit', 'crit'] },
    { at: 'hit', do: 'glow', who: 'target', where: 'chest', type: 'radiant', radius: 18, time: 0.5, power: 0.9, delay: 0.3, if: ['hit', 'crit'] },
    { at: 'hit', do: 'glow', who: 'target', where: 'chest', type: 'radiant', radius: 18, time: 0.5, power: 0.8, delay: 0.7, if: ['hit', 'crit'] },
    { at: 'hit', do: 'emit', kind: 'mote', where: 'targetFeet', rate: 40, time: 1.2, radius: 6, speed: 14, delay: 0.2, if: ['hit', 'crit'] },
    { at: 'hit', do: 'popup', text: 'GUIDED', color: 'radiant', above: 7, if: ['hit', 'crit'] },
    struck({ flash: HOLY, knock: 2 }),
  ]);

  // "A creature you touch ... 2d10 Necrotic damage" (CON save, half on a save): dark violet gathers in the hand and a
  // black-violet blast of withering energy rots out of the touched creature, with smoke and sinking motes.
  restyle('inflictWounds', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.35 },
    { at: 0.02, do: 'emit', kind: 'smoke', type: 'necrotic', where: 'casterFeet', rate: 40, time: 0.3, radius: 4, speed: 5 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'necrotic', radius: 14, time: 0.4, power: 1.1 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'necrotic', count: 20, where: 'casterHand', speed: 12 },
    { at: 0.3, do: 'pose', who: 'caster', pose: 'strike', time: 0.4 },
    { at: 0.36, do: 'glow', where: 'target', type: 'necrotic', radius: 26, time: 0.7, power: 1.2 },
    { at: 0.36, do: 'volume', shape: 'sphere', feet: 5, type: 'necrotic', where: 'targetFeet', dy: 0, time: 0.6, light: 1.2, if: ['hit', 'crit'] },
    { at: 0.36, do: 'ring', type: 'necrotic', where: 'targetFeet', r0: 2, r1: 16, time: 0.5, thick: 2 },
    { at: 0.36, do: 'burst', who: 'target', where: 'chest', kind: 'smoke', type: 'necrotic', count: 34, speed: 30, size: 2 },
    { at: 0.36, do: 'burst', who: 'target', where: 'chest', kind: 'glow', type: 'necrotic', count: 34, speed: 40, if: ['hit', 'crit'] },
    { at: 0.36, do: 'burst', who: 'target', where: 'chest', kind: 'glow', type: 'necrotic', count: 14, speed: 24, if: 'miss' },
    { at: 0.4, do: 'emit', kind: 'smoke', type: 'necrotic', where: 'targetFeet', rate: 40, time: 0.6, radius: 5, speed: 8, if: ['hit', 'crit'] },
    { at: 0.36, do: 'light', type: 'necrotic', where: 'target', radius: 20, time: 0.5, power: 1.3 },
    { at: 0.36, do: 'flash', who: 'target', color: DARK, time: 0.08 },
    { at: 0.36, do: 'knock', who: 'target', dist: 1.5, time: 0.4, if: ['hit', 'crit'] },
    { at: 0.36, do: 'knock', who: 'target', dist: 0.7, time: 0.3, if: 'miss' },
    { at: 0.36, do: 'pose', who: 'target', pose: 'hit', time: 0.4 },
    { at: 0.36, do: 'shake', strength: 1.2, time: 0.2, if: ['hit', 'crit'] },
    { at: 0.36, do: 'apply', who: 'target' },
    { at: 0.36, do: 'popup', text: 'amount', color: 'damage' },
    { at: 0.36, do: 'popup', text: 'SAVE', color: 'miss', above: 7, if: 'miss' },
  ]);

  // "You bless up to three creatures within range": a gold halo swells round the caster, then each blessed friend is crowned
  // with a column of gold light, motes rising, and a ring on the floor.
  restyle('bless', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.9 },
    { at: 0.05, do: 'glow', where: 'caster', type: 'radiant', radius: 28, time: 1.0, power: 0.9 },
    { at: 0.05, do: 'light', type: 'radiant', where: 'caster', radius: 30, time: 1.0, power: 1.4 },
    { at: 0.05, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 3, r1: 40, time: 0.7, thick: 2 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 30, where: 'casterHand', speed: 24 },
    { at: 0.3, do: 'column', who: 'hits', type: 'radiant', height: 22, time: 0.6 },
    { at: 0.3, do: 'glow', who: 'hits', where: 'chest', type: 'radiant', radius: 20, time: 0.9, power: 1 },
    { at: 0.3, do: 'glow', who: 'hits', where: 'feet', type: 'radiant', radius: 22, time: 0.8, power: 0.7, squash: 0.5 },
    { at: 0.35, do: 'burst', who: 'hits', where: 'feet', kind: 'mote', count: 26, speed: 16, spread: 6, dir: [0, -1], cone: 1.0 },
    { at: 0.5, do: 'burst', who: 'hits', where: 'chest', kind: 'mote', count: 20, speed: 14, spread: 5, dir: [0, -1], cone: 1.2 },
    { at: 0.45, do: 'outline', who: 'hits', color: GOLD, time: 0.3 },
    { at: 0.45, do: 'apply', who: 'hits' },
    { at: 0.45, do: 'popup', who: 'hits', text: 'BLESS', color: 'radiant' },
  ]);

  // "A shimmering field surrounds a creature ... +2 bonus to AC": a gold spark flies to the friend and a shimmering shell closes
  // round them (a ring that shrinks to their feet, the hexagon of light, sparkles on its surface).
  restyle('shieldOfFaith', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    ...gather('radiant', 'mote', 11, 14, 14),
    { at: 0.1, do: 'projectile', sprite: 'dart', type: 'radiant', speed: 110, arc: 8, sure: true, lightRadius: 14, trailRate: 70, glow: 9, streak: 14 },
    { at: 'hit', do: 'ring', type: 'radiant', where: 'targetFeet', r0: 22, r1: 7, time: 0.4, thick: 2 },
    { at: 'hit', do: 'bubble', who: 'target', type: 'radiant', time: 1.0 },
    { at: 'hit', do: 'glow', who: 'target', where: 'chest', type: 'radiant', radius: 20, time: 1.0, power: 0.9 },
    { at: 'hit', do: 'burst', who: 'target', where: 'chest', kind: 'spark', type: 'radiant', count: 26, speed: 30, spread: 8 },
    { at: 'hit', do: 'burst', who: 'target', where: 'chest', kind: 'mote', count: 20, speed: 12, spread: 8 },
    { at: 'hit', do: 'light', type: 'radiant', where: 'target', radius: 20, time: 0.9, power: 1.2 },
    { at: 'hit', do: 'outline', who: 'target', color: GOLD, time: 0.2 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: '+2 AC', color: 'radiant' },
  ]);

  // Spiritual Weapon: "a floating, spectral force ... make one melee spell attack ... Force damage": the force blazes into being
  // (gold with a violet edge: it is Force) at its square, lunges at the foe within 5 ft, and slams home.
  const spiritSlam = [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.5 },
    { at: 0.03, do: 'glow', where: 'point', type: 'radiant', radius: 18, time: 0.5, power: 1 },
    { at: 0.03, do: 'glow', where: 'point', type: 'force', radius: 12, time: 0.4, power: 0.8 },
    { at: 0.03, do: 'ring', type: 'radiant', where: 'point', r0: 14, r1: 3, time: 0.25, thick: 2 },
    { at: 0.05, do: 'burst', kind: 'mote', where: 'point', count: 28, speed: 20 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', where: 'point', count: 14, speed: 24 },
    { at: 0.14, do: 'projectile', sprite: 'bead', type: 'radiant', from: 'point', duration: 0.1, glow: 10, streak: 8, trailRate: 100, lightRadius: 16 },
    { at: 0.25, do: 'pop', type: 'radiant', who: 'target', radius: 6, time: 0.28, if: ['hit', 'crit'] },
    { at: 0.25, do: 'glow', who: 'target', where: 'chest', type: 'radiant', radius: 24, time: 0.5, power: 1.1, if: ['hit', 'crit'] },
    { at: 0.25, do: 'ring', type: 'force', where: 'targetFeet', r0: 2, r1: 14, time: 0.35, thick: 2, if: ['hit', 'crit'] },
    { at: 0.25, do: 'burst', kind: 'glow', type: 'force', who: 'target', where: 'chest', count: 28, speed: 40, if: ['hit', 'crit'] },
    { at: 0.25, do: 'burst', kind: 'spark', type: 'radiant', who: 'target', where: 'chest', count: 14, speed: 56, if: ['hit', 'crit'] },
    { at: 0.25, do: 'light', type: 'radiant', where: 'target', radius: 20, time: 0.4, power: 1.2 },
    struck({ at: 0.25, flash: HOLY, knock: 1.5 }),
  ];
  restyle('spiritualWeapon', spiritSlam);
  restyle('spiritualStrike', spiritSlam);

  // Preserve Life: "restore Hit Points ... to creatures of your choice in a 30-foot Emanation": a wave of healing light sweeps
  // out the whole 30 ft (60 px) in rings and a soft dome of rising light; each hurt friend inside blooms green-white.
  restyle('preserveLife', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.9 },
    { at: 0.05, do: 'glow', where: 'casterHand', type: 'healing', radius: 14, time: 0.7, power: 1 },
    { at: 0.05, do: 'burst', kind: 'heal', count: 24, where: 'casterHand', speed: 24 },
    { at: 0.1, do: 'glow', where: 'casterFeet', type: 'healing', radius: 60, time: 1.1, power: 0.2, squash: 0.6 },
    { at: 0.1, do: 'light', type: 'healing', where: 'caster', radius: 60, time: 1.1, power: 0.4 },
    { at: 0.15, do: 'volume', shape: 'sphere', feet: 30, type: 'healing', where: 'casterFeet', dy: 0, time: 0.9, light: 0.3, soft: 0.22 },
    { at: 0.15, do: 'ring', type: 'healing', where: 'casterFeet', r0: 3, r1: 60, time: 0.7, thick: 3 },
    { at: 0.3, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 3, r1: 60, time: 0.7, thick: 2 },
    { at: 0.2, do: 'emit', kind: 'heal', where: 'casterFeet', rate: 90, time: 0.8, radius: 60, speed: 10, big: 0.3 },
    { at: 0.2, do: 'emit', kind: 'mote', where: 'casterFeet', rate: 50, time: 0.8, radius: 60, speed: 10 },
    { at: 0.5, do: 'glow', who: 'hits', where: 'chest', type: 'healing', radius: 20, time: 0.8, power: 1 },
    { at: 0.5, do: 'burst', who: 'hits', where: 'feet', kind: 'heal', count: 30, speed: 18, spread: 6, dir: [0, -1], cone: 1.0 },
    { at: 0.5, do: 'burst', who: 'hits', where: 'feet', kind: 'mote', count: 16, speed: 14, spread: 6, dir: [0, -1], cone: 1.0 },
    { at: 0.5, do: 'outline', who: 'hits', color: PALE, time: 0.2 },
    { at: 0.5, do: 'apply', who: 'hits' },
    { at: 0.5, do: 'popup', who: 'hits', text: 'amount', color: 'heal' },
  ]);

  // Aid: "up to three creatures ... Hit Point maximum and current Hit Points increase by 5": warm gold light settles on each of
  // them, a small crown of motes rises, and they glow a little taller.
  restyle('aid', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.7 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'radiant', radius: 13, time: 0.6, power: 1 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 24, where: 'casterHand', speed: 20 },
    { at: 0.3, do: 'glow', who: 'hits', where: 'chest', type: 'radiant', radius: 20, time: 0.9, power: 1 },
    { at: 0.3, do: 'glow', who: 'hits', where: 'feet', type: 'healing', radius: 20, time: 0.8, power: 0.7, squash: 0.5 },
    { at: 0.3, do: 'column', who: 'hits', type: 'radiant', height: 20, time: 0.5 },
    { at: 0.3, do: 'burst', who: 'hits', where: 'feet', kind: 'mote', count: 26, speed: 16, spread: 6, dir: [0, -1], cone: 1.0 },
    { at: 0.45, do: 'burst', who: 'hits', where: 'chest', kind: 'heal', count: 18, speed: 14, spread: 5, dir: [0, -1], cone: 1.2 },
    { at: 0.35, do: 'outline', who: 'hits', color: GOLD, time: 0.3 },
    { at: 0.35, do: 'apply', who: 'hits' },
    { at: 0.35, do: 'popup', who: 'hits', text: '+5 HP', color: 'heal' },
  ]);

  // Lesser Restoration: "You touch a creature and end one condition on it": a green-white pulse sweeps up the body from the
  // feet, and the dark wisps of the affliction lift away and dissolve.
  restyle('lesserRestoration', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    ...gather('healing', 'heal', 11, 14, 12),
    { at: 0.15, do: 'burst', who: 'target', where: 'chest', kind: 'smoke', type: 'necrotic', count: 18, speed: 10, spread: 4, dir: [0, -1], cone: 0.8 },
    { at: 0.2, do: 'ring', type: 'healing', where: 'targetFeet', r0: 4, r1: 13, time: 0.35, thick: 2 },
    { at: 0.26, do: 'ring', type: 'healing', where: 'targetFeet', dy: -5, r0: 4, r1: 11, time: 0.3, thick: 2 },
    { at: 0.32, do: 'ring', type: 'radiant', where: 'targetFeet', dy: -10, r0: 3, r1: 9, time: 0.3, thick: 2 },
    { at: 0.38, do: 'ring', type: 'healing', where: 'targetFeet', dy: -15, r0: 2, r1: 7, time: 0.3, thick: 1 },
    { at: 0.2, do: 'glow', where: 'target', type: 'healing', radius: 22, time: 0.8, power: 1 },
    { at: 0.2, do: 'light', type: 'healing', where: 'target', radius: 22, time: 0.7, power: 1.1 },
    { at: 0.2, do: 'burst', who: 'target', where: 'feet', kind: 'heal', count: 26, speed: 20, spread: 5, dir: [0, -1], cone: 1.0 },
    { at: 0.35, do: 'burst', who: 'target', where: 'chest', kind: 'mote', count: 20, speed: 18, spread: 5 },
    { at: 0.25, do: 'flash', who: 'target', color: PALE, time: 0.08 },
    { at: 0.25, do: 'outline', who: 'target', color: PALE, time: 0.2 },
    { at: 0.25, do: 'apply', who: 'target' },
    { at: 0.25, do: 'popup', text: 'FREE', color: 'heal' },
  ]);

  // Spare the Dying: "The creature becomes Stable": a soft, steady gold-white glow settles on the fallen friend and beats
  // three times, slowly, like a heart; a few motes drift up and the breathing evens out.
  restyle('spareTheDying', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    ...gather('radiant', 'mote', 10, 12, 10),
    { at: 0.15, do: 'emit', kind: 'mote', where: 'targetFeet', rate: 36, time: 0.7, radius: 6, speed: 6 },
    { at: 0.18, do: 'glow', where: 'targetFeet', type: 'radiant', radius: 20, time: 0.9, power: 0.7, squash: 0.5 },
    { at: 0.2, do: 'glow', where: 'target', type: 'radiant', radius: 16, time: 0.35, power: 1 },
    { at: 0.2, do: 'ring', type: 'radiant', where: 'targetFeet', r0: 2, r1: 11, time: 0.4, thick: 1 },
    { at: 0.2, do: 'light', type: 'radiant', where: 'target', radius: 16, time: 0.7, power: 1 },
    { at: 0.38, do: 'glow', where: 'target', type: 'healing', radius: 16, time: 0.35, power: 1 },
    { at: 0.38, do: 'ring', type: 'healing', where: 'targetFeet', r0: 2, r1: 11, time: 0.4, thick: 1 },
    { at: 0.56, do: 'glow', where: 'target', type: 'radiant', radius: 14, time: 0.35, power: 0.8 },
    { at: 0.35, do: 'outline', who: 'target', color: HOLY, time: 0.3 },
    { at: 0.35, do: 'apply', who: 'target' },
    { at: 0.35, do: 'popup', text: 'STABLE', color: 'heal' },
  ]);

  // Spirit Guardians: "Protective spirits flit around you in a 15-foot Emanation": a stream of spirit-lights pours from the
  // symbol and fans out to fill a 15 ft (30 px) circle, which swells with gold light and is ringed twice.
  restyle('spiritGuardians', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.8 },
    { at: 0.05, do: 'glow', where: 'casterHand', type: 'radiant', radius: 14, time: 0.6, power: 1 },
    { at: 0.1, do: 'burst', kind: 'mote', where: 'casterHand', count: 60, speed: 50, spread: 2 },
    { at: 0.1, do: 'burst', kind: 'glow', type: 'radiant', where: 'casterHand', count: 24, speed: 60 },
    { at: 0.12, do: 'glow', where: 'casterFeet', type: 'radiant', radius: 30, time: 1.0, power: 0.7, squash: 0.6 },
    { at: 0.15, do: 'volume', shape: 'sphere', feet: 15, type: 'radiant', where: 'casterFeet', dy: 0, time: 0.8, light: 0.7, soft: 0.3 },
    { at: 0.15, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 4, r1: 30, time: 0.6, thick: 2 },
    { at: 0.3, do: 'ring', type: 'healing', where: 'casterFeet', r0: 4, r1: 30, time: 0.6, thick: 1 },
    { at: 0.15, do: 'emit', kind: 'mote', where: 'casterFeet', rate: 80, time: 0.8, radius: 30, speed: 12, big: 0.3 },
    { at: 0.15, do: 'light', type: 'radiant', where: 'caster', radius: 34, time: 0.8, power: 1.4 },
    { at: 0.4, do: 'apply', who: 'caster' },
    { at: 0.4, do: 'popup', who: 'caster', text: 'SPIRITS', color: 'radiant' },
  ]);

  // "On a failed save, the creature takes 3d8 Radiant damage": a spirit-light darts out from the emanation and stabs into the
  // creature in a burst of gold.
  restyle('guardiansBurn', [
    { at: 0, do: 'glow', where: 'casterFeet', type: 'radiant', radius: 30, time: 0.3, power: 0.5, squash: 0.6 },
    { at: 0, do: 'projectile', sprite: 'dart', type: 'radiant', from: 'casterHand', duration: 0.1, sure: true, glow: 8, streak: 10, trailRate: 80 },
    { at: 'hit', do: 'burst', who: 'hits', where: 'chest', kind: 'mote', count: 30, speed: 34 },
    { at: 'hit', do: 'burst', who: 'hits', where: 'chest', kind: 'spark', type: 'radiant', count: 12, speed: 50 },
    { at: 'hit', do: 'glow', who: 'hits', where: 'chest', type: 'radiant', radius: 22, time: 0.45, power: 1.1 },
    { at: 'hit', do: 'ring', type: 'radiant', where: 'targetFeet', r0: 2, r1: 12, time: 0.3, thick: 1 },
    { at: 'hit', do: 'light', type: 'radiant', where: 'target', radius: 18, time: 0.4, power: 1.2 },
    caught({ at: 'hit', flash: HOLY, knock: 1 }),
  ]);

  // "Up to six creatures ... regain Hit Points": a spoken word, a ring of green-white light rolling out from the caster, and a
  // bloom of rising light on every friend it reaches.
  restyle('massHealingWord', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'healing', radius: 14, time: 0.6, power: 1 },
    { at: 0.05, do: 'burst', kind: 'heal', where: 'casterHand', count: 30, speed: 26 },
    { at: 0.05, do: 'burst', kind: 'mote', where: 'mouth', count: 14, speed: 20 },
    { at: 0.1, do: 'ring', type: 'healing', where: 'casterFeet', r0: 3, r1: 55, time: 0.5, thick: 3 },
    { at: 0.18, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 3, r1: 55, time: 0.5, thick: 1 },
    { at: 0.1, do: 'glow', where: 'casterFeet', type: 'healing', radius: 36, time: 0.7, power: 0.7, squash: 0.6 },
    { at: 0.3, do: 'glow', who: 'hits', where: 'chest', type: 'healing', radius: 20, time: 0.9, power: 1 },
    { at: 0.3, do: 'glow', who: 'hits', where: 'feet', type: 'healing', radius: 22, time: 0.8, power: 0.7, squash: 0.5 },
    { at: 0.3, do: 'column', who: 'hits', type: 'healing', height: 22, time: 0.5 },
    { at: 0.3, do: 'burst', who: 'hits', where: 'feet', kind: 'heal', count: 26, speed: 18, spread: 6, dir: [0, -1], cone: 1.0 },
    { at: 0.42, do: 'burst', who: 'hits', where: 'chest', kind: 'mote', count: 18, speed: 14, spread: 5, dir: [0, -1], cone: 1.2 },
    { at: 0.3, do: 'outline', who: 'hits', color: PALE, time: 0.2 },
    { at: 0.3, do: 'apply', who: 'hits' },
    { at: 0.3, do: 'popup', who: 'hits', text: 'amount', color: 'heal' },
  ]);

  // "You touch a creature that has died within the last minute. That creature revives with 1 Hit Point": a thick shaft of gold
  // light drops on the fallen, rings of it roll out, motes rain upward and the whole spot flares white as they get up.
  restyle('revivify', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    ...gather('radiant', 'mote', 13, 20, 14),
    { at: 0.2, do: 'glow', where: 'targetFeet', dy: -34, type: 'radiant', radius: 20, time: 0.5, power: 0.8 },
    { at: 0.2, do: 'column', who: 'target', type: 'radiant', height: 40, time: 0.8 },
    { at: 0.2, do: 'column', who: 'target', type: 'radiant', height: 36, time: 0.7, dx: -2 },
    { at: 0.2, do: 'column', who: 'target', type: 'radiant', height: 36, time: 0.7, dx: 2 },
    { at: 0.2, do: 'column', who: 'target', type: 'healing', height: 30, time: 0.6, dx: -4 },
    { at: 0.2, do: 'column', who: 'target', type: 'healing', height: 30, time: 0.6, dx: 4 },
    { at: 0.25, do: 'glow', where: 'targetFeet', type: 'radiant', radius: 26, time: 1.0, power: 0.9, squash: 0.55 },
    { at: 0.3, do: 'glow', where: 'target', type: 'radiant', radius: 28, time: 0.9, power: 1.2 },
    { at: 0.3, do: 'light', type: 'radiant', where: 'target', radius: 30, time: 0.9, power: 1.6 },
    { at: 0.3, do: 'ring', type: 'radiant', where: 'targetFeet', r0: 2, r1: 20, time: 0.6, thick: 2 },
    { at: 0.45, do: 'ring', type: 'healing', where: 'targetFeet', r0: 2, r1: 26, time: 0.6, thick: 1 },
    { at: 0.3, do: 'emit', kind: 'mote', where: 'targetFeet', rate: 90, time: 0.7, radius: 9, speed: 18, big: 0.4 },
    { at: 0.3, do: 'emit', kind: 'heal', where: 'targetFeet', rate: 40, time: 0.7, radius: 7, speed: 14 },
    { at: 0.55, do: 'screenflash', color: [255, 240, 190], strength: 0.3, time: 0.15 },
    { at: 0.6, do: 'flash', who: 'target', color: WHITE, time: 0.12 },
    { at: 0.6, do: 'outline', who: 'target', color: GOLD, time: 0.3 },
    { at: 0.6, do: 'burst', who: 'target', where: 'chest', kind: 'mote', count: 50, speed: 44, spread: 4, size: 2 },
    { at: 0.6, do: 'burst', who: 'target', where: 'chest', kind: 'spark', type: 'radiant', count: 20, speed: 60 },
    { at: 0.6, do: 'apply', who: 'target' },
    { at: 0.6, do: 'popup', text: 'ALIVE', color: 'heal' },
  ]);
})();
