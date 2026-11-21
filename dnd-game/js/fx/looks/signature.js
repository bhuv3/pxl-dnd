// The new looks for the three signature spells, after their 2024 text: Fireball (a 20-foot-radius Sphere), Lightning Bolt
// (a 100-foot-long, 5-foot-wide Line) and Magic Missile (three glowing darts of force). They keep each spell's rules (its label,
// area and roll) and replace only its steps, using the area modules at true scale (5 ft = 10 map pixels).
(() => {
  const { struck, caught, restyle } = Spells;
  const FIRE = [255, 232, 196], WHITE = [255, 255, 255], VIOLET = [200, 150, 255];

  // "A bright streak flashes from your pointing finger to a point you choose ... then blossoms with a low roar into an
  // explosion of flame": a bead flies to the point, then a 20 ft sphere of fire swells, rimmed, with tongues rising.
  restyle('fireball', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'fire', radius: 11, time: 0.4, power: 0.9 },
    { at: 0.05, do: 'burst', kind: 'ember', count: 14, where: 'casterHand', speed: 18 },
    { at: 0.2, do: 'projectile', sprite: 'bead', type: 'fire', to: 'point', speed: 130, arc: 10, sure: true, lightRadius: 14, glow: 10, streak: 9, trailRate: 90 },
    { at: 'hit', do: 'screenflash', color: [255, 190, 90], strength: 0.4, time: 0.14 },
    { at: 'hit', do: 'hitstop', time: 0.1 },
    { at: 'hit', do: 'volume', shape: 'sphere', feet: 20, type: 'fire', time: 1.1, light: 1.9 },
    { at: 'hit', do: 'ring', type: 'fire', r0: 6, r1: 42, time: 0.5, thick: 2, dy: 5 },
    { at: 'hit', do: 'burst', kind: 'ember', count: 110, speed: 95, spread: 14, size: 2 },
    { at: 'hit', do: 'burst', kind: 'spark', count: 40, speed: 120, spread: 8 },
    { at: 'hit', do: 'burst', kind: 'smoke', count: 26, speed: 26, spread: 22, size: 2, delay: 0.15 },
    { at: 'hit', do: 'burst', kind: 'dust', count: 30, speed: 45, spread: 12 },
    { at: 'hit', do: 'shake', strength: 3.5, time: 0.5 },
    { at: 'hit', do: 'mark', kind: 'blast', where: 'impact', fade: 20 },
    { at: 'hit', do: 'emit', kind: 'ember', where: 'impact', rate: 60, time: 1.0, radius: 32, speed: 9, delay: 0.2 },
    caught({ flash: FIRE, knock: 2.5, from: 'impact' }),
  ]);

  // "A bolt of lightning forming a 100-foot-long, 5-foot-wide Line emanates from you": a bright 5 ft beam along the whole
  // line, two crooked strokes through it, a white flash, and sparks on everyone it crosses.
  restyle('lightningBolt', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.7 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'lightning', radius: 12, time: 0.3, power: 0.9 },
    { at: 0.05, do: 'burst', kind: 'spark', type: 'lightning', count: 16, where: 'casterHand', speed: 26 },
    { at: 0.25, do: 'volume', shape: 'line', feet: 100, wide: 5, type: 'lightning', time: 0.45 },
    { at: 0.25, do: 'arc', feet: 100, type: 'lightning', time: 0.45, forks: 6, jag: 0.14, glow: 14 },
    { at: 0.25, do: 'arc', feet: 100, type: 'lightning', time: 0.45, forks: 3, jag: 0.3, glow: 10 },
    { at: 'hit', do: 'screenflash', color: [220, 235, 255], strength: 0.6, time: 0.09 },
    { at: 'hit', do: 'hitstop', time: 0.06 },
    { at: 'hit', do: 'shake', strength: 2.5, time: 0.3 },
    { at: 'hit', do: 'glow', who: 'hits', type: 'lightning', radius: 14, time: 0.3, power: 1 },
    { at: 'hit', do: 'burst', who: 'hits', where: 'chest', kind: 'spark', type: 'lightning', count: 18, speed: 60 },
    { at: 'hit', do: 'burst', who: 'hits', where: 'chest', kind: 'glow', type: 'lightning', count: 10, speed: 40 },
    caught({ flash: WHITE, flashTime: 0.14, knock: 1 }),
  ]);

  // "You create three glowing darts of magical force": each streams in on its own curve, trailing light, and lands with its
  // own flash and number.
  restyle('magicMissile', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.7 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'force', radius: 12, time: 0.5, power: 0.9 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 14, where: 'casterHand', speed: 16 },
    ...[[0.15, 12, -2], [0.23, -10, 0], [0.31, 16, 2]].map(([at, curve, dy], n) => [
      { at, do: 'projectile', sprite: 'dart', type: 'force', speed: 140, curve, offset: [0, dy], sure: true, event: 'd' + n, lightRadius: 12, trailRate: 60, glow: 7, streak: 14 },
      { at: 'd' + n, do: 'glow', type: 'force', radius: 11, time: 0.22, power: 1 },
      { at: 'd' + n, do: 'pop', type: 'force', radius: 3, time: 0.16 },
      { at: 'd' + n, do: 'burst', kind: 'glow', type: 'force', count: 12, speed: 34 },
      { at: 'd' + n, do: 'burst', kind: 'spark', type: 'force', count: 5, speed: 40 },
      { at: 'd' + n, do: 'flash', who: 'target', color: VIOLET, time: 0.05 },
      { at: 'd' + n, do: 'knock', who: 'target', dist: 1, time: 0.2 },
      { at: 'd' + n, do: 'apply', who: 'target', part: n },
      { at: 'd' + n, do: 'popup', text: 'amount', part: n, color: 'damage', dx: (n - 1) * 4 },
    ]),
    { at: 'd2', do: 'pose', who: 'target', pose: 'hit', time: 0.35 },
    { at: 'd2', do: 'shake', strength: 1, time: 0.15 },
  ]);
})();
