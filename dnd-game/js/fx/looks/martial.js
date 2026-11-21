// New looks (2024 text) for the Paladin, Rogue, Fighter and monster effects. Spell-like features follow their 2024 text (area
// shape, damage colour, how the figure behaves); weapon attacks stay readable physical hits: a streak or smear, impact sparks
// and a small glow. Each restyle keeps the effect's rules (label, area, roll, and every apply / popup / struck / caught).
(() => {
  const { struck, caught, restyle } = Spells;
  const HIT = ['hit', 'crit'];
  const HOLY = [255, 244, 190], FIRE = [255, 232, 196], ACID = [210, 255, 140], DARK = [186, 130, 240], GOLD = [255, 211, 77];
  const GREEN = [190, 255, 150];

  // A weapon hit that lands: sparks flying away from the blow, a small flash and glow, and what it hits splinters or not.
  // o: { type (spark colours), n (spark count), glow (radius) }
  const impact = (o = {}) => [
    { at: 'hit', do: 'burst', kind: 'spark', type: o.type, count: o.n ?? 10, speed: 70, who: 'target', where: 'chest', away: true, cone: 1.8, if: 'hit' },
    { at: 'hit', do: 'burst', kind: 'spark', type: o.type, count: (o.n ?? 10) * 2, speed: 90, who: 'target', where: 'chest', away: true, cone: 2.4, if: 'crit' },
    { at: 'hit', do: 'pop', type: o.pop || 'steel', radius: 3, time: 0.14, if: 'hit' },
    { at: 'hit', do: 'pop', type: o.pop || 'steel', radius: 5, time: 0.2, if: 'crit' },
    { at: 'hit', do: 'glow', type: o.glowType || 'spark', radius: o.glow ?? 9, time: 0.2, power: 0.9, if: HIT },
  ];

  // A blow that misses: the blade or shot whiffs, dust kicked up where it lands.
  const whiff = (kind = 'dust') => ({ at: 'hit', do: 'burst', kind, count: 6, speed: 14, where: 'targetFeet', if: 'miss' });

  // ---------- Paladin ----------

  // "One willing creature you touch is protected against Aberrations, Celestials, Elementals, Fey, Fiends and Undead" (a flask of
  // Holy Water, consumed): holy water sprays on the friend, a gold ward swells, rings, a pillar of light and rising motes.
  restyle('protectionFromEvil', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'mote', where: 'casterHand', count: 12, speed: 16 },
    { at: 0.05, do: 'glow', where: 'casterHand', type: 'radiant', radius: 10, time: 0.4, power: 0.8 },
    { at: 0.15, do: 'burst', who: 'target', where: 'chest', kind: 'glow', type: 'radiant', count: 18, speed: 26, spread: 4 },
    { at: 0.2, do: 'bubble', who: 'target', type: 'radiant', time: 1.1 },
    { at: 0.2, do: 'glow', who: 'target', type: 'radiant', radius: 18, time: 0.9, power: 0.8 },
    { at: 0.2, do: 'ring', who: 'target', where: 'targetFeet', type: 'radiant', r0: 3, r1: 14, time: 0.5, thick: 2 },
    { at: 0.35, do: 'ring', where: 'targetFeet', type: 'radiant', r0: 3, r1: 18, time: 0.6, thick: 1 },
    { at: 0.2, do: 'column', who: 'target', type: 'radiant', height: 26, time: 0.5 },
    { at: 0.2, do: 'emit', kind: 'mote', where: 'targetFeet', rate: 55, time: 0.8, radius: 7, speed: 10 },
    { at: 0.2, do: 'light', type: 'radiant', where: 'target', radius: 22, time: 0.9, power: 1.2 },
    { at: 0.25, do: 'apply', who: 'target' },
    { at: 0.25, do: 'popup', text: 'WARD', color: 'radiant' },
  ]);

  // Sacred Weapon: "for 10 minutes, the weapon emits bright light in a 20-foot radius" and strikes as Radiant: the sword flares
  // gold, a 20 ft wave of light rolls out, and the blade keeps shedding sparks of light.
  restyle('sacredWeapon', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.7 },
    { at: 0.1, do: 'burst', kind: 'mote', where: 'casterHand', count: 26, speed: 22, spread: 2 },
    { at: 0.1, do: 'glow', where: 'casterHand', type: 'radiant', radius: 22, time: 0.9, power: 1 },
    { at: 0.15, do: 'ring', where: 'casterFeet', type: 'radiant', r0: 4, r1: 40, time: 0.7, thick: 2 },
    { at: 0.1, do: 'light', type: 'radiant', where: 'casterHand', radius: 40, time: 0.9, power: 1.8 },
    { at: 0.1, do: 'emit', kind: 'mote', where: 'casterHand', rate: 60, time: 0.6, radius: 4, speed: 14 },
    { at: 0.15, do: 'outline', who: 'caster', color: GOLD, time: 0.35 },
    { at: 0.15, do: 'column', who: 'caster', type: 'radiant', height: 22, time: 0.35 },
    { at: 0.2, do: 'apply', who: 'caster' },
    { at: 0.2, do: 'popup', who: 'caster', text: 'SACRED', color: 'radiant' },
  ]);

  // "The target takes an extra 2d8 Radiant damage from the attack": the blade ignites with gold light as it swings; the hit
  // detonates in a radiant burst with a rising pillar, a floor ring and bright motes; the smite's number follows the weapon's.
  restyle('divineSmite', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.3, in: 0.7, out: 0.3 },
    { at: 0.24, do: 'pose', who: 'caster', pose: 'strike', time: 0.45, in: 0.2, out: 0.5 },
    { at: 0.03, do: 'burst', kind: 'mote', count: 14, where: 'casterHand', speed: 14 },
    { at: 0.03, do: 'glow', type: 'radiant', where: 'casterHand', radius: 16, time: 0.5, power: 1 },
    { at: 0.03, do: 'light', type: 'radiant', where: 'casterHand', radius: 16, time: 0.4, power: 1.2 },
    { at: 0, do: 'swing', a0: -1.4, a1: 2.3, contact: 1.0, windup: 0.26, strike: 0.11, hold: 0.22, type: 'radiant' },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    { at: 'hit', do: 'hitstop', time: 0.12, if: 'hit' },
    { at: 'hit', do: 'hitstop', time: 0.22, if: 'crit' },
    { at: 'hit', do: 'screenflash', color: HOLY, strength: 0.3, time: 0.1, if: HIT },
    { at: 'hit', do: 'pop', type: 'radiant', radius: 7, time: 0.3, if: HIT },
    { at: 'hit', do: 'glow', type: 'radiant', radius: 24, time: 0.7, power: 1, if: HIT },
    { at: 'hit', do: 'column', who: 'target', type: 'radiant', height: 30, time: 0.5, if: HIT },
    { at: 'hit', do: 'ring', where: 'targetFeet', type: 'radiant', r0: 3, r1: 22, time: 0.5, thick: 2, if: HIT },
    { at: 'hit', do: 'burst', kind: 'mote', count: 30, speed: 55, spread: 3, if: HIT },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'radiant', count: 24, speed: 90, if: HIT },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'radiant', count: 14, speed: 80, if: HIT },
    { at: 'hit', do: 'burst', kind: 'mote', count: 24, speed: 70, if: 'crit' },
    { at: 'hit', do: 'light', type: 'radiant', radius: 34, time: 0.8, power: 2, if: HIT },
    { at: 'hit', do: 'flash', who: 'target', color: HOLY, time: 0.1, if: HIT },
    { at: 'hit', do: 'knock', who: 'target', dist: 2.5, time: 0.45, if: HIT },
    { at: 'hit', do: 'pose', who: 'target', pose: 'hit', time: 0.45, if: HIT },
    { at: 'hit', do: 'shake', strength: 2, time: 0.25, if: 'hit' },
    { at: 'hit', do: 'shake', strength: 3.5, time: 0.35, if: 'crit' },
    { at: 'hit', do: 'apply', who: 'target', if: HIT },
    { at: 'hit', do: 'popup', text: 'amount', part: 0, color: 'damage', dx: -3, if: 'hit' },
    { at: 'hit', do: 'popup', text: 'amount', part: 0, color: 'crit', big: true, dx: -3, if: 'crit' },
    { at: 'hit', do: 'popup', text: 'amount', part: 1, plus: true, color: 'radiant', dx: 5, above: 2, delay: 0.12, if: HIT },
    { at: 'hit', do: 'popup', text: 'MISS', color: 'miss', if: 'miss' },
  ]);

  // Dragonborn Breath Weapon, a "15-foot Cone": a breath drawn in (embers pulled to the mouth), then a true 15 ft cone of fire
  // (30 map px, as wide at the far end as it is long) roaring from the mouth, with sparks and heat shimmer, scorching what it hits.
  restyle('fireBreath', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.45, in: 0.8, out: 0.2 },
    { at: 0.05, do: 'emit', kind: 'ember', where: 'mouth', rate: 40, time: 0.35, radius: 5, speed: 6 },
    { at: 0.25, do: 'glow', where: 'mouth', type: 'fire', radius: 10, time: 0.3, power: 0.9 },
    { at: 0.42, do: 'pose', who: 'caster', pose: 'strike', time: 0.75, in: 0.1, out: 0.3 },
    { at: 0.45, do: 'volume', shape: 'cone', feet: 15, type: 'fire', time: 0.8, from: 'mouth' },
    { at: 0.45, do: 'cone', kind: 'ember', type: 'fire', rate: 420, time: 0.6, speed: 85, spread: 0.85, length: 30, big: 0.5, lightRadius: 34, lightType: 'fire' },
    { at: 0.45, do: 'cone', kind: 'spark', type: 'fire', rate: 120, time: 0.5, speed: 110, spread: 0.7, length: 30 },
    { at: 0.5, do: 'screenflash', color: [255, 160, 70], strength: 0.18, time: 0.1 },
    { at: 0.5, do: 'shake', strength: 2.5, time: 0.6 },
    { at: 0.6, do: 'glow', who: 'hits', type: 'fire', radius: 14, time: 0.5, power: 0.9 },
    { at: 0.6, do: 'burst', who: 'hits', where: 'chest', kind: 'ember', count: 14, speed: 40 },
    { at: 0.6, do: 'burst', who: 'hits', where: 'chest', kind: 'smoke', count: 6, speed: 14, delay: 0.2 },
    { at: 0.6, do: 'mark', kind: 'scorch', who: 'hits', fade: 10 },
    caught({ at: 0.6, flash: FIRE, knock: 1.5 }),
  ]);

  // The breath as a "30-foot Line, 5 feet wide": a bright 5 ft beam of fire, 30 ft long (60 px, stopping at a wall) with a
  // jet of embers and sparks along it.
  restyle('fireBreathLine', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.45, in: 0.8, out: 0.2 },
    { at: 0.05, do: 'emit', kind: 'ember', where: 'mouth', rate: 40, time: 0.35, radius: 5, speed: 6 },
    { at: 0.25, do: 'glow', where: 'mouth', type: 'fire', radius: 10, time: 0.3, power: 0.9 },
    { at: 0.42, do: 'pose', who: 'caster', pose: 'strike', time: 0.75, in: 0.1, out: 0.3 },
    { at: 0.45, do: 'volume', shape: 'line', feet: 30, wide: 5, type: 'fire', time: 0.8, from: 'mouth' },
    { at: 0.45, do: 'cone', kind: 'ember', type: 'fire', rate: 380, time: 0.6, speed: 210, spread: 0.12, length: 60, big: 0.5, lightRadius: 28, lightType: 'fire' },
    { at: 0.45, do: 'cone', kind: 'spark', type: 'fire', rate: 100, time: 0.5, speed: 230, spread: 0.16, length: 60 },
    { at: 0.5, do: 'screenflash', color: [255, 160, 70], strength: 0.18, time: 0.1 },
    { at: 0.5, do: 'shake', strength: 2.5, time: 0.6 },
    { at: 0.7, do: 'glow', who: 'hits', type: 'fire', radius: 14, time: 0.5, power: 0.9 },
    { at: 0.7, do: 'burst', who: 'hits', where: 'chest', kind: 'ember', count: 14, speed: 40 },
    { at: 0.7, do: 'burst', who: 'hits', where: 'chest', kind: 'smoke', count: 6, speed: 14, delay: 0.2 },
    { at: 0.7, do: 'mark', kind: 'scorch', who: 'hits', fade: 10 },
    caught({ at: 0.7, flash: FIRE, knock: 1.5 }),
  ]);

  // ---------- Rogue ----------

  // Steady Aim: "Advantage on your next attack roll this turn... your Speed is 0": the rogue plants their feet and goes still;
  // two thin rings close in to a bright point of focus at the eye, and a held glow shows the aim locked.
  restyle('steadyAim', [
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'dust', where: 'casterFeet', count: 8, speed: 10, spread: 3 },
    { at: 0.05, do: 'ring', where: 'caster', type: 'steel', r0: 20, r1: 3, time: 0.4, thick: 1 },
    { at: 0.18, do: 'ring', where: 'caster', type: 'steel', r0: 14, r1: 2, time: 0.3, thick: 1 },
    { at: 0.35, do: 'glow', where: 'caster', type: 'lightning', radius: 9, time: 0.5, power: 0.8, dy: -3 },
    { at: 0.35, do: 'burst', kind: 'spark', type: 'steel', where: 'caster', count: 8, speed: 14, spread: 1 },
    { at: 0.2, do: 'apply', who: 'caster' },
    { at: 0.2, do: 'popup', who: 'caster', text: 'AIM', color: 'info' },
  ]);

  // Sneak Attack: "extra damage" on a precise blow. The rogue melts into a puff of shadow, reappears behind the target, cuts twice
  // with red-edged slashes and darts home; each cut throws sparks and blood.
  restyle('sneakAttack', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'fade', who: 'caster', to: 0.2, time: 0.32, in: 0.25, out: 0.4 },
    { at: 1.0, do: 'fade', who: 'caster', to: 0.3, time: 0.26, in: 0.3, out: 0.4 },
    { at: 0, do: 'burst', kind: 'smoke', where: 'casterFeet', count: 10, speed: 14, spread: 3 },
    { at: 0.05, do: 'dash', to: 'behind', time: 0.22 },
    { at: 0.27, do: 'burst', kind: 'smoke', who: 'target', where: 'feet', count: 8, speed: 12, spread: 3 },
    { at: 0.3, do: 'swing', blade: 'dagger', a0: -1.0, a1: 2.0, contact: 0.8, windup: 0.05, strike: 0.08, hold: 0.04, type: 'blood', event: 'cut1' },
    { at: 0.47, do: 'swing', blade: 'dagger', a0: -0.4, a1: 2.3, contact: 0.9, windup: 0.04, strike: 0.08, hold: 0.12, type: 'blood' },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.5, if: 'miss' },
    { at: 'cut1', do: 'flash', who: 'target', time: 0.05, if: HIT },
    { at: 'cut1', do: 'knock', who: 'target', dist: 1, time: 0.15, if: HIT },
    { at: 'cut1', do: 'burst', kind: 'spark', count: 8, speed: 60, who: 'target', where: 'chest', away: true, cone: 1.8, if: HIT },
    { at: 'cut1', do: 'burst', kind: 'drop', type: 'blood', count: 6, speed: 40, who: 'target', where: 'chest', away: true, cone: 2, if: HIT },
    { at: 'cut1', do: 'glow', who: 'target', type: 'blood', radius: 8, time: 0.18, power: 0.9, if: HIT },
    { at: 'hit', do: 'burst', kind: 'spark', count: 12, speed: 70, who: 'target', where: 'chest', away: true, type: 'blood', cone: 2, if: HIT },
    { at: 'hit', do: 'burst', kind: 'drop', type: 'blood', count: 12, speed: 50, who: 'target', where: 'chest', away: true, cone: 2.4, if: HIT },
    { at: 'hit', do: 'pop', type: 'blood', radius: 4, time: 0.2, if: HIT },
    { at: 'hit', do: 'glow', type: 'blood', radius: 12, time: 0.25, power: 1, if: HIT },
    { at: 'hit', do: 'burst', kind: 'dust', count: 5, where: 'targetFeet', speed: 10, if: 'miss' },
    struck({ knock: 2, shake: 2, stop: 0.09 }),
    { at: 1.0, do: 'dash', to: 'home', time: 0.22 },
    { at: 1.0, do: 'burst', kind: 'smoke', where: 'casterFeet', count: 6, speed: 10, spread: 3 },
  ]);

  // Cunning Action: Hide (a Stealth check): the rogue ducks and vanishes in a swirl of shadow smoke; fails: a poof and SEEN.
  restyle('hide', [
    { at: 0, do: 'pose', who: 'caster', pose: 'dodge', time: 0.5 },
    { at: 0.05, do: 'burst', kind: 'smoke', where: 'casterFeet', count: 26, speed: 24, spread: 5, size: 2 },
    { at: 0.05, do: 'burst', kind: 'dust', where: 'casterFeet', count: 14, speed: 24, spread: 4 },
    { at: 0.1, do: 'burst', kind: 'smoke', where: 'caster', count: 14, speed: 14, spread: 4, delay: 0.1 },
    { at: 0.1, do: 'burst', kind: 'glow', type: 'necrotic', where: 'caster', count: 14, speed: 22, spread: 3, if: HIT },
    { at: 0.15, do: 'ring', where: 'casterFeet', type: 'necrotic', r0: 3, r1: 16, time: 0.4, thick: 2, if: HIT },
    { at: 0.05, do: 'fade', who: 'caster', to: 0.45, time: 0.6, in: 0.3, out: 0.5, if: HIT },
    { at: 0.3, do: 'apply', who: 'caster' },
    { at: 0.3, do: 'popup', who: 'caster', text: 'HIDDEN', color: 'info', if: HIT },
    { at: 0.3, do: 'popup', who: 'caster', text: 'SEEN', color: 'miss', if: 'miss' },
  ]);

  // A thrown dagger (Finesse, Thrown): a spinning blade with a steel streak; it bites with sparks, or sticks in the floor.
  restyle('throwDagger', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.2, in: 0.7 },
    { at: 0.16, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.18, do: 'projectile', sprite: 'dagger', type: 'steel', speed: 170, glow: 4, streak: 8 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    impact({ n: 8, glow: 8 }),
    { at: 'hit', do: 'burst', kind: 'spark', count: 6, speed: 40, if: 'miss' },
    whiff(),
    struck({ knock: 1 }),
  ]);

  // ---------- Fighter ----------

  // A longsword swing: the steel crescent (gold-white on a crit); the blow throws a fan of sparks, a flash and a small glow.
  restyle('swordSwing', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.22, in: 0.7, out: 0.3 },
    { at: 0.17, do: 'pose', who: 'caster', pose: 'strike', time: 0.4, in: 0.2, out: 0.5 },
    { at: 0, do: 'swing', a0: -1.2, a1: 2.2, contact: 1.0, windup: 0.18, strike: 0.11, hold: 0.18, type: 'steel', if: ['hit', 'miss'] },
    { at: 0, do: 'swing', a0: -1.4, a1: 2.4, contact: 1.0, windup: 0.22, strike: 0.1, hold: 0.22, type: 'radiant', if: 'crit' },
    { at: 0.1, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    impact({ n: 9, glow: 10 }),
    { at: 'hit', do: 'glow', type: 'radiant', radius: 16, time: 0.3, power: 0.9, if: 'crit' },
    { at: 'hit', do: 'screenflash', color: HOLY, strength: 0.2, time: 0.08, if: 'crit' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 5, speed: 30, if: 'miss' },
    whiff(),
    struck({ knock: 2 }),
  ]);

  // Action Surge: "you can take one additional action": a deep breath, then a burst of fierce red-gold energy: two quick rings,
  // a flare round the body, sparks leaping up and a thud of force.
  restyle('actionSurge', [
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.45 },
    { at: 0.05, do: 'emit', kind: 'ember', where: 'casterFeet', rate: 40, time: 0.2, radius: 6, speed: 8 },
    { at: 0.15, do: 'burst', kind: 'dust', where: 'casterFeet', count: 16, speed: 34, spread: 2 },
    { at: 0.15, do: 'ring', where: 'casterFeet', type: 'fire', r0: 3, r1: 22, time: 0.45, thick: 2 },
    { at: 0.25, do: 'ring', where: 'casterFeet', type: 'radiant', r0: 3, r1: 30, time: 0.5, thick: 1 },
    { at: 0.15, do: 'glow', who: 'caster', type: 'fire', radius: 22, time: 0.5, power: 1 },
    { at: 0.15, do: 'outline', who: 'caster', color: [255, 120, 90], time: 0.3 },
    { at: 0.15, do: 'burst', kind: 'spark', where: 'caster', count: 30, speed: 80, spread: 3 },
    { at: 0.15, do: 'burst', kind: 'ember', where: 'caster', count: 26, speed: 50, spread: 4 },
    { at: 0.15, do: 'light', type: 'fire', where: 'caster', radius: 26, time: 0.5, power: 1.5 },
    { at: 0.15, do: 'screenflash', color: [255, 150, 90], strength: 0.18, time: 0.1 },
    { at: 0.15, do: 'shake', strength: 1.5, time: 0.2 },
    { at: 0.2, do: 'popup', who: 'caster', text: 'SURGE', color: 'crit' },
  ]);

  // Second Wind: "you regain Hit Points": a slow breath in, then green-gold healing motes stream up and a soft glow swells.
  restyle('secondWind', [
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.6 },
    { at: 0.05, do: 'ring', where: 'casterFeet', type: 'healing', r0: 14, r1: 3, time: 0.4, thick: 1 },
    { at: 0.1, do: 'emit', kind: 'heal', where: 'casterFeet', rate: 70, time: 0.6, radius: 6, speed: 12 },
    { at: 0.15, do: 'glow', who: 'caster', type: 'healing', radius: 20, time: 0.8, power: 0.9 },
    { at: 0.15, do: 'light', type: 'healing', where: 'caster', radius: 20, time: 0.6, power: 1.2 },
    { at: 0.3, do: 'burst', kind: 'heal', where: 'caster', count: 24, speed: 28, spread: 3 },
    { at: 0.3, do: 'outline', who: 'caster', color: [220, 255, 220], time: 0.14 },
    { at: 0.3, do: 'ring', where: 'casterFeet', type: 'healing', r0: 3, r1: 18, time: 0.5, thick: 2 },
    { at: 0.35, do: 'apply', who: 'caster' },
    { at: 0.35, do: 'popup', who: 'caster', text: 'amount', color: 'heal' },
  ]);

  // Shake awake: a firm shove, a puff of dust and a small jolt of light as the friend comes round.
  restyle('shakeAwake', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'strike', time: 0.35 },
    { at: 0.15, do: 'pose', who: 'target', pose: 'shiver', time: 0.4 },
    { at: 0.15, do: 'knock', who: 'target', dist: 0.5, time: 0.25 },
    { at: 0.15, do: 'burst', kind: 'dust', where: 'targetFeet', count: 10, speed: 18, spread: 3 },
    { at: 0.2, do: 'burst', kind: 'spark', type: 'steel', who: 'target', where: 'chest', count: 8, speed: 28 },
    { at: 0.2, do: 'glow', who: 'target', type: 'healing', radius: 10, time: 0.3, power: 0.6 },
    { at: 0.3, do: 'apply', who: 'target' },
    { at: 0.3, do: 'popup', text: 'AWAKE', color: 'info' },
  ]);

  // ---------- Monsters ----------

  // A sling stone: a streak of dust-grey light, a chip-and-dust hit, a crack of sparks.
  restyle('goblinSling', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.4, in: 0.6 },
    { at: 0.3, do: 'burst', kind: 'dust', where: 'casterHand', count: 3, speed: 8 },
    { at: 0.32, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.34, do: 'projectile', sprite: 'stone', type: 'spark', speed: 150, arc: 6, streak: 6, glow: 3 },
    { at: 0.45, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'shard', count: 10, speed: 35, if: HIT },
    { at: 'hit', do: 'burst', kind: 'dust', count: 6, speed: 16, if: HIT },
    { at: 'hit', do: 'burst', kind: 'spark', count: 6, speed: 50, if: HIT },
    { at: 'hit', do: 'burst', kind: 'shard', count: 6, speed: 25, if: 'miss' },
    whiff(),
    struck({ knock: 1 }),
  ]);

  // A spear jab: the thrust's speed lines, then a bright pinprick of sparks at the point.
  restyle('goblinSpear', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.2, in: 0.7 },
    { at: 0.15, do: 'pose', who: 'caster', pose: 'strike', time: 0.35 },
    { at: 0, do: 'thrust', blade: 'spear', reach: 6, windup: 0.16, strike: 0.07, hold: 0.1 },
    { at: 0.1, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    impact({ n: 7, glow: 8 }),
    whiff(),
    struck({ knock: 1.5 }),
  ]);

  // The minion's quick dagger stab.
  restyle('goblinDagger', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.16, in: 0.7 },
    { at: 0.12, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0, do: 'thrust', blade: 'dagger', reach: 5, windup: 0.12, strike: 0.06, hold: 0.08 },
    { at: 0.08, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    impact({ n: 6, glow: 7 }),
    whiff(),
    struck({ knock: 1 }),
  ]);

  // The minion's thrown dagger: a spinning blade with a steel streak.
  restyle('goblinThrow', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.2, in: 0.7 },
    { at: 0.16, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.18, do: 'projectile', sprite: 'dagger', type: 'steel', speed: 170, glow: 4, streak: 8 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    impact({ n: 8, glow: 8 }),
    { at: 'hit', do: 'burst', kind: 'spark', count: 6, speed: 40, if: 'miss' },
    whiff(),
    struck({ knock: 1 }),
  ]);

  // The boss's scimitar: a heavy curved steel slash with a bigger spray of sparks than a minion's.
  restyle('bossScimitar', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.18, in: 0.7 },
    { at: 0.14, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0, do: 'swing', blade: 'sword', a0: -1.0, a1: 2.0, contact: 0.9, windup: 0.14, strike: 0.09, hold: 0.12, type: 'steel' },
    { at: 0.08, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    impact({ n: 10, glow: 10 }),
    { at: 'hit', do: 'screenflash', color: [255, 255, 255], strength: 0.12, time: 0.06, if: 'crit' },
    whiff(),
    struck({ knock: 1.5 }),
  ]);

  // The skeleton's rusty sword: a stiff dull-grey smear; it hits in rust-brown sparks and flying bone chips.
  restyle('skeletonSword', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.25, in: 0.8 },
    { at: 0.2, do: 'pose', who: 'caster', pose: 'strike', time: 0.35 },
    { at: 0, do: 'swing', blade: 'rusty', a0: -1.2, a1: 2.0, contact: 0.9, windup: 0.22, strike: 0.12, hold: 0.2, steps: 4, type: 'stone' },
    { at: 0.12, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    impact({ type: 'dust', pop: 'bone', n: 8, glow: 7 }),
    { at: 'hit', do: 'burst', kind: 'dust', type: 'bone', count: 8, speed: 30, who: 'target', where: 'chest', away: true, if: HIT },
    { at: 'hit', do: 'burst', kind: 'shard', type: 'bone', count: 6, speed: 40, who: 'target', where: 'chest', away: true, cone: 2, if: HIT },
    whiff(),
    struck({ knock: 1.5 }),
  ]);

  // A bone arrow: a pale streak; it thuds in with splinters and dust, or sticks in the floor.
  restyle('skeletonArrow', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.4, in: 0.8 },
    { at: 0.36, do: 'projectile', sprite: 'arrow', type: 'bone', speed: 190, streak: 10, glow: 3 },
    { at: 0.45, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'shard', type: 'bone', count: 8, speed: 36, if: HIT },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'spark', count: 6, speed: 45, if: HIT },
    { at: 'hit', do: 'pop', type: 'bone', radius: 3, time: 0.15, if: HIT },
    { at: 'hit', do: 'glow', type: 'spark', radius: 8, time: 0.18, power: 0.7, if: HIT },
    { at: 'hit', do: 'burst', kind: 'dust', count: 8, speed: 14, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'shard', type: 'bone', count: 5, speed: 22, if: 'miss' },
    struck({ knock: 1 }),
  ]);

  // The slime's acid spit (Acid damage, green): a glowing glob with a dripping trail; it splashes in a ring of droplets and
  // leaves a sizzling puddle.
  restyle('slimeAcid', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.4, in: 0.8 },
    { at: 0.3, do: 'burst', kind: 'drop', type: 'acid', where: 'casterHand', count: 6, speed: 20 },
    { at: 0.35, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.36, do: 'projectile', sprite: 'blob', type: 'acid', speed: 110, arc: 12, trailRate: 45, glow: 7, streak: 5, lightRadius: 12 },
    { at: 0.5, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'drop', count: 22, speed: 40, spread: 2 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'acid', count: 14, speed: 40 },
    { at: 'hit', do: 'pop', type: 'acid', radius: 4, time: 0.25 },
    { at: 'hit', do: 'glow', type: 'acid', radius: 16, time: 0.5, power: 0.9 },
    { at: 'hit', do: 'ring', type: 'acid', r0: 2, r1: 12, time: 0.35, thick: 1, dy: 5 },
    { at: 'hit', do: 'emit', kind: 'glow', type: 'acid', where: 'impact', rate: 20, time: 0.6, radius: 6, speed: 8, delay: 0.1 },
    { at: 'hit', do: 'mark', kind: 'acid', who: 'target', fade: 6, if: HIT },
    { at: 'hit', do: 'mark', kind: 'acid', where: 'impact', fade: 6, if: 'miss' },
    struck({ flash: ACID, knock: 1 }),
  ]);

  // The cultist's dark bolt (Necrotic): a violet-black bead with a smoky trail and a halo; it bursts in drained purple light.
  restyle('cultistBolt', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.55 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'necrotic', count: 14, where: 'casterHand', speed: 14 },
    { at: 0.05, do: 'glow', where: 'casterHand', type: 'necrotic', radius: 10, time: 0.4, power: 1 },
    { at: 0.1, do: 'burst', kind: 'smoke', where: 'casterHand', count: 4, speed: 8 },
    { at: 0.22, do: 'projectile', sprite: 'bead', type: 'necrotic', speed: 150, trail: 'glow', trailRate: 70, lightRadius: 14, glow: 9, streak: 10 },
    { at: 0.35, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'necrotic', radius: 5, time: 0.28 },
    { at: 'hit', do: 'glow', type: 'necrotic', radius: 20, time: 0.5, power: 1 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'necrotic', count: 22, speed: 50 },
    { at: 'hit', do: 'burst', kind: 'smoke', count: 8, speed: 16, spread: 2 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'necrotic', count: 8, speed: 60 },
    struck({ flash: DARK }),
  ]);
})();
