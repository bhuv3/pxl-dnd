// New looks (2024 text) for the Wizard's defensive and illusion spells: Shield, True Strike, Blur, Misty Step, Mage Armor,
// Mirror Image, Hold Person, Hypnotic Pattern and Haste. Each keeps its spell's rules (label, roll, events, apply/popup steps)
// and replaces only the look, built from glows, floor rings stacked into bands and domes, bigger particle bursts and emitters.
(() => {
  const { struck, restyle } = Spells;
  const VIOLET = [200, 160, 255], GOLD = [255, 240, 150], HIT = ['hit', 'crit'];

  // Rings stacked up a body, one after another (a scan, a binding, a dome): each at its height dy above the feet.
  // o: { at (first start), step (delay between), heights [dy...], r (radius or a list), r0, time, thick, type, where, if }
  function bands(o) {
    return o.heights.map((dy, i) => ({
      at: o.at + i * (o.step || 0.05), do: 'ring', type: o.type, where: o.where, dy: -dy, time: o.time, thick: o.thick || 1,
      r0: o.r0 ?? [].concat(o.r)[i % [].concat(o.r).length], r1: [].concat(o.r)[i % [].concat(o.r).length], ...(o.if ? { if: o.if } : {}),
    }));
  }

  // A sphere of force round a body: latitude rings from the feet to the head that swell out and shimmer (radii follow a ball).
  const dome = (at, where, time, type = 'force') => bands({ at, step: 0.025, heights: [1, 4, 7, 10, 13, 16], r: [7, 10, 11.5, 11.5, 10, 7], r0: 3, time, thick: 2, type, where });

  // Sparkle motes shot out sideways from the body (a smear of afterimage light): both ways, in several waves.
  const smear = (at, type, count, who = 'caster') => [-1, 1].map(d => ({ at, do: 'burst', kind: 'glow', type, where: who, count, speed: 55, dir: [d, 0], cone: 0.25, spread: 3 }));

  // "An imperceptible barrier of magical force protects you ... +5 bonus to AC, including against the triggering attack":
  // a ball of violet force snaps up round the wizard just as the arrow lands, flares where it strikes, and the arrow glances off.
  restyle('shield', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.3 },
    { at: 0.18, do: 'projectile', sprite: 'arrow', speed: 170, sure: true, offset: [-4, 0] },
    { at: 0.26, do: 'pose', who: 'target', pose: 'cast', time: 0.6 },
    { at: 0.26, do: 'glow', who: 'target', type: 'force', radius: 22, time: 0.9, power: 0.9 },
    { at: 0.26, do: 'bubble', who: 'target', type: 'force', time: 1.0 },
    ...dome(0.26, 'targetFeet', 0.85),
    { at: 0.26, do: 'ring', type: 'force', where: 'targetFeet', r0: 4, r1: 20, time: 0.4, thick: 2 },
    { at: 0.26, do: 'burst', kind: 'glow', type: 'force', where: 'target', count: 36, speed: 38, spread: 7 },
    { at: 0.26, do: 'burst', kind: 'mote', type: 'force', where: 'target', count: 20, speed: 14, spread: 9 },
    { at: 0.26, do: 'light', type: 'force', where: 'target', radius: 22, time: 0.9, power: 1.3 },
    { at: 0.26, do: 'popup', who: 'target', text: 'SHIELD', color: 'info', above: 4 },
    { at: 'hit', do: 'hitstop', time: 0.06 },
    { at: 'hit', do: 'glow', type: 'force', radius: 18, time: 0.3, power: 1.1 },
    { at: 'hit', do: 'pop', type: 'force', radius: 5, time: 0.2 },
    { at: 'hit', do: 'ring', type: 'force', r0: 2, r1: 10, time: 0.25, thick: 2 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'force', count: 26, speed: 60 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'force', count: 22, speed: 40 },
    { at: 'hit', do: 'projectile', sprite: 'arrow', from: 'impact', to: 'deflect', speed: 110, arc: 4, sure: true, event: 'gone' },
    { at: 'hit', do: 'popup', text: 'MISS', color: 'miss' },
  ]);

  // The reaction version: only the ball of force and the word, played beside the blocked attack.
  restyle('shieldUp', [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    { at: 0, do: 'glow', who: 'caster', type: 'force', radius: 22, time: 0.9, power: 0.9 },
    { at: 0, do: 'bubble', who: 'caster', type: 'force', time: 0.9 },
    ...dome(0, 'casterFeet', 0.8),
    { at: 0, do: 'ring', type: 'force', where: 'casterFeet', r0: 4, r1: 20, time: 0.4, thick: 2 },
    { at: 0, do: 'burst', kind: 'glow', type: 'force', where: 'caster', count: 36, speed: 38, spread: 7 },
    { at: 0, do: 'burst', kind: 'mote', type: 'force', where: 'caster', count: 20, speed: 14, spread: 9 },
    { at: 0, do: 'light', type: 'force', where: 'caster', radius: 22, time: 0.9, power: 1.3 },
    { at: 0, do: 'popup', who: 'caster', text: 'SHIELD', color: 'info', above: 4 },
  ]);

  // "Guided by a flash of magical insight, you make one attack with the weapon": a gold flash of insight marks the foe (a
  // column of light, rings closing in like a sight), then the staff swings true, glowing with the chosen damage.
  restyle('trueStrike', [
    { at: 0, do: 'face' },
    { at: 0, do: 'glow', where: 'casterHand', type: 'radiant', radius: 14, time: 0.4, power: 1 },
    { at: 0, do: 'burst', kind: 'glow', type: 'radiant', count: 14, where: 'casterHand', speed: 14 },
    { at: 0, do: 'outline', who: 'target', color: GOLD, time: 0.25 },
    { at: 0, do: 'column', who: 'target', type: 'radiant', height: 24, time: 0.4 },
    { at: 0, do: 'glow', who: 'target', type: 'radiant', radius: 16, time: 0.4, power: 0.9 },
    { at: 0, do: 'ring', type: 'radiant', where: 'targetFeet', r0: 16, r1: 3, time: 0.3, thick: 2 },
    { at: 0.1, do: 'ring', type: 'radiant', where: 'targetFeet', r0: 11, r1: 3, time: 0.25, thick: 1 },
    { at: 0.05, do: 'emit', kind: 'glow', type: 'chosen', where: 'casterHand', rate: 70, time: 0.3, radius: 3, speed: 12 },
    { at: 0.05, do: 'pose', who: 'caster', pose: 'windup', time: 0.22, in: 0.7, out: 0.3 },
    { at: 0.22, do: 'pose', who: 'caster', pose: 'strike', time: 0.4, in: 0.2, out: 0.5 },
    { at: 0.05, do: 'swing', blade: 'staff', a0: -1.2, a1: 2.2, contact: 1.0, windup: 0.18, strike: 0.11, hold: 0.18, type: 'chosen' },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    { at: 'hit', do: 'glow', type: 'chosen', radius: 18, time: 0.35, power: 1, if: HIT },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 5, time: 0.24, if: HIT },
    { at: 'hit', do: 'pop', type: 'radiant', radius: 8, time: 0.3, if: 'crit' },
    { at: 'hit', do: 'ring', type: 'chosen', r0: 2, r1: 14, time: 0.3, thick: 2, if: HIT },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 34, speed: 50, who: 'target', where: 'chest', away: true, if: HIT },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'chosen', count: 16, speed: 70, who: 'target', where: 'chest', away: true, if: HIT },
    struck({ knock: 2 }),
  ]);

  // "Your body becomes blurred": the wizard flickers in and out of sight in three pulses of violet outline, smearing
  // sparkling light sideways each time, so attackers can't pin them down.
  restyle('blur', [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.03, do: 'glow', who: 'caster', type: 'force', radius: 16, time: 0.9, power: 0.8 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 30, where: 'caster', speed: 20, spread: 4 },
    ...[0.1, 0.32, 0.48].flatMap((at, k) => [
      { at, do: 'fade', who: 'caster', to: k === 1 ? 0.65 : 0.3, time: k === 2 ? 0.3 : 0.22, in: 0.4, out: 0.4 },
      { at, do: 'outline', who: 'caster', color: VIOLET, time: 0.18 },
      ...smear(at, 'force', 16),
      { at, do: 'burst', kind: 'mote', type: 'force', where: 'caster', count: 10, speed: 20, spread: 5 },
    ]),
    { at: 0.1, do: 'light', type: 'force', where: 'caster', radius: 16, time: 0.8, power: 1 },
    { at: 0.4, do: 'apply', who: 'caster' },
    { at: 0.4, do: 'popup', who: 'caster', text: 'BLUR', color: VIOLET },
  ]);

  // "Briefly surrounded by silvery mist, you teleport up to 30 feet": a silver mist swirls up round the wizard, thick
  // with glittering motes, and swallows them (combat then moves them and plays mistyStepIn where they land).
  restyle('mistyStep', [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.4 },
    { at: 0.03, do: 'glow', who: 'caster', type: 'cold', radius: 20, time: 0.7, power: 0.9 },
    { at: 0.05, do: 'ring', type: 'cold', where: 'casterFeet', r0: 16, r1: 3, time: 0.4, thick: 2 },
    { at: 0.05, do: 'burst', kind: 'smoke', type: 'steel', count: 44, where: 'casterFeet', speed: 12, spread: 7, size: 2 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'cold', count: 50, where: 'caster', speed: 22, spread: 6 },
    { at: 0.05, do: 'burst', kind: 'mote', type: 'steel', count: 30, where: 'casterFeet', speed: 18, spread: 6 },
    { at: 0.05, do: 'emit', kind: 'smoke', type: 'steel', where: 'casterFeet', rate: 80, time: 0.5, radius: 7, speed: 10 },
    { at: 0.05, do: 'emit', kind: 'glow', type: 'cold', where: 'casterFeet', rate: 120, time: 0.5, radius: 6, speed: 14, big: 0.3 },
    { at: 0.05, do: 'light', type: 'cold', where: 'caster', radius: 20, time: 0.6, power: 1.3 },
    { at: 0.1, do: 'fade', who: 'caster', to: 0, time: 0.45, in: 0.8, out: 0 },
  ]);

  // The same mist opens where the wizard lands: it rushes out from a point, glitters, and thins away as they fade in.
  restyle('mistyStepIn', [
    { at: 0, do: 'fade', who: 'caster', to: 0, time: 0.45, in: 0, out: 0.9 },
    { at: 0, do: 'glow', who: 'caster', type: 'cold', radius: 22, time: 0.7, power: 1 },
    { at: 0, do: 'ring', type: 'cold', where: 'casterFeet', r0: 3, r1: 18, time: 0.4, thick: 2 },
    { at: 0, do: 'burst', kind: 'smoke', type: 'steel', count: 44, where: 'casterFeet', speed: 22, spread: 3, size: 2 },
    { at: 0, do: 'burst', kind: 'glow', type: 'cold', count: 50, where: 'caster', speed: 34, spread: 3 },
    { at: 0, do: 'burst', kind: 'mote', type: 'steel', count: 30, where: 'casterFeet', speed: 22, spread: 5 },
    { at: 0, do: 'emit', kind: 'smoke', type: 'steel', where: 'casterFeet', rate: 70, time: 0.4, radius: 6, speed: 8 },
    { at: 0, do: 'emit', kind: 'glow', type: 'cold', where: 'casterFeet', rate: 110, time: 0.4, radius: 6, speed: 14, big: 0.3 },
    { at: 0, do: 'light', type: 'cold', where: 'caster', radius: 22, time: 0.6, power: 1.3 },
  ]);

  // "Until the spell ends, the target's base AC becomes 13 plus its Dexterity modifier": a shimmer of violet force is
  // smoothed over the body from feet to head like a second skin, and a faint sheen stays.
  restyle('mageArmor', [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.03, do: 'glow', where: 'casterHand', type: 'force', radius: 12, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 20, where: 'casterHand', speed: 14 },
    { at: 0.2, do: 'glow', who: 'target', type: 'force', radius: 20, time: 0.9, power: 0.8 },
    ...bands({ at: 0.2, step: 0.055, heights: [0, 3, 6, 9, 12, 15, 18], r: 7.5, r0: 7, time: 0.3, thick: 2, type: 'force', where: 'targetFeet' }),
    { at: 0.2, do: 'emit', kind: 'glow', type: 'force', where: 'targetFeet', rate: 120, time: 0.5, radius: 6, speed: 16, big: 0.3 },
    { at: 0.2, do: 'emit', kind: 'mote', type: 'force', where: 'targetFeet', rate: 50, time: 0.9, radius: 7, speed: 10 },
    { at: 0.5, do: 'bubble', who: 'target', type: 'force', time: 0.6 },
    { at: 0.2, do: 'light', type: 'force', where: 'point', radius: 18, time: 0.9, power: 1.2 },
    { at: 0.25, do: 'outline', who: 'target', color: VIOLET, time: 0.3 },
    { at: 0.6, do: 'outline', who: 'target', color: [150, 110, 220], time: 0.3 },
    { at: 0.3, do: 'apply', who: 'target' },
    { at: 0.3, do: 'popup', who: 'target', text: 'ARMOR', color: VIOLET },
  ]);

  // "Three illusory duplicates of yourself appear in your space": the wizard stays solid while three translucent copies split
  // off to either side and behind (Figures draws them; they stay as Mirror Image's condition while the spell lasts), each
  // with a flash of violet light and a ripple on the floor.
  restyle('mirrorImage', [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.03, do: 'glow', who: 'caster', type: 'force', radius: 18, time: 0.8, power: 0.9 },
    { at: 0.1, do: 'images', who: 'caster', count: 3, time: 1.6, in: 0.15, out: 0.2 },
    ...[-8, 8, 0].map((dx, k) => ({ at: 0.12 + k * 0.06, do: 'glow', who: 'caster', dx, type: 'force', radius: 12, time: 0.6, power: 1 })),
    ...[0, 1, 2].map(k => ({ at: 0.1 + k * 0.1, do: 'ring', type: 'force', where: 'casterFeet', r0: 3, r1: 11 + k * 2, time: 0.45, thick: 2 })),
    ...smear(0.1, 'force', 24), ...smear(0.25, 'force', 16),
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', where: 'caster', count: 40, speed: 24, spread: 3 },
    { at: 0.1, do: 'burst', kind: 'mote', type: 'force', where: 'caster', count: 24, speed: 16, spread: 6 },
    { at: 0.1, do: 'light', type: 'force', where: 'caster', radius: 18, time: 0.7, power: 1.2 },
    { at: 0.35, do: 'apply', who: 'caster' },
    { at: 0.35, do: 'popup', who: 'caster', text: '3 IMAGES', color: VIOLET },
  ]);

  // "One of the duplicates is hit instead of you, and the duplicate is destroyed": the copy that was struck is still there for
  // a moment, then flares and bursts into glittering violet shards and a puff of light.
  restyle('mirrorImageHit', [
    { at: 0, do: 'images', who: 'caster', extra: 1, time: 0.3, in: 0, out: 0 },
    { at: 0.25, do: 'glow', where: 'image', type: 'force', radius: 14, time: 0.3, power: 1.1 },
    { at: 0.25, do: 'pop', where: 'image', type: 'force', radius: 5, time: 0.2 },
    { at: 0.25, do: 'burst', kind: 'shard', type: 'force', where: 'image', count: 30, speed: 44, spread: 4 },
    { at: 0.25, do: 'burst', kind: 'spark', type: 'force', where: 'image', count: 26, speed: 60, spread: 3 },
    { at: 0.25, do: 'burst', kind: 'glow', type: 'force', where: 'image', count: 24, speed: 28, spread: 3 },
    { at: 0.25, do: 'popup', who: 'caster', text: 'IMAGE', color: VIOLET, above: 7 },
  ]);

  // "The target must succeed on a Wisdom saving throw or have the Paralyzed condition": nothing is shot. A circle of force
  // draws itself on the floor under the target and glowing ropes are conjured round it, three coils winding up its legs, body
  // and shoulders; on a failed save they pull tight and hold it rigid, on a success they snap apart.
  restyle('holdPerson', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    { at: 0.03, do: 'glow', where: 'casterHand', type: 'force', radius: 13, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 20, where: 'casterHand', speed: 16 },
    { at: 0.2, do: 'ring', type: 'force', where: 'targetFeet', r0: 16, r1: 5, time: 0.5, thick: 1 },
    { at: 0.25, do: 'ring', type: 'force', where: 'targetFeet', r0: 10, r1: 4, time: 0.4, thick: 1 },
    { at: 0.2, do: 'glow', who: 'target', type: 'force', radius: 16, time: 1.2, power: 0.3 },
    { at: 0.2, do: 'emit', kind: 'mote', type: 'force', where: 'targetFeet', rate: 30, time: 0.5, radius: 9, speed: 12 },
    { at: 0.2, do: 'light', type: 'force', where: 'target', radius: 20, time: 1.2, power: 0.6 },
    { at: 0.3, do: 'rope', who: 'target', type: 'force', wind: 0.6, time: 2.0, if: HIT },
    { at: 0.3, do: 'rope', who: 'target', type: 'force', wind: 0.6, time: 1.2, snap: true, if: 'miss' },
    { at: 0.95, do: 'burst', kind: 'spark', type: 'force', where: 'target', count: 12, speed: 40, spread: 4, if: HIT },
    { at: 0.95, do: 'outline', who: 'target', color: VIOLET, time: 1.2, if: HIT },
    { at: 0.95, do: 'pose', who: 'target', pose: 'shiver', time: 0.6, if: HIT },
    { at: 0.95, do: 'apply', who: 'target', if: HIT },
    { at: 0.95, do: 'popup', text: 'HELD', color: VIOLET, if: HIT },
    { at: 1.05, do: 'popup', text: 'SAVE', color: 'miss', if: 'miss' },
  ]);

  // "A twisting pattern of colors in a 30-foot Cube": four colored cubes of light fill the true 60-pixel square one after
  // another, rings of every color sweep out and back in a spiral, and a rainbow of motes swirls; whoever fails the save
  // stands and stares, with colored lights drifting off their heads.
  restyle('hypnoticPattern', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 1 },
    { at: 0.03, do: 'glow', where: 'casterHand', type: 'force', radius: 12, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 20, where: 'casterHand', speed: 14 },
    ...['force', 'fire', 'cold', 'radiant'].map((type, k) => [
      { at: 0.15 + k * 0.2, do: 'volume', shape: 'cube', feet: 30, type, where: 'point', time: 0.32, light: 0.3 },
      { at: 0.15 + k * 0.2, do: 'emit', kind: 'glow', type, where: 'point', rate: 40, time: 0.5, radius: 28, speed: 6, big: 0.2 },
    ]),
    ...['force', 'fire', 'cold', 'radiant', 'force', 'fire', 'cold', 'radiant'].map((type, k) => (
      { at: 0.15 + k * 0.08, do: 'ring', type, where: 'point', r0: k % 2 ? 28 : 3, r1: k % 2 ? 3 : 28, time: 0.6, thick: 2, dy: 5 })),
    { at: 0.2, do: 'light', type: 'force', where: 'point', radius: 40, time: 1.1, power: 0.5 },
    { at: 0.9, do: 'pose', who: 'hits', pose: 'shiver', time: 0.5, hitIf: 'failed' },
    ...['force', 'fire', 'cold', 'radiant'].map((type, k) => (
      { at: 0.85 + k * 0.04, do: 'burst', who: 'hits', where: 'chest', kind: 'glow', type, count: 10, speed: 22, spread: 3, hitIf: 'failed' })),
    { at: 0.9, do: 'glow', who: 'hits', type: 'force', radius: 14, time: 0.6, power: 0.9, hitIf: 'failed' },
    { at: 0.9, do: 'outline', who: 'hits', color: VIOLET, time: 0.6, hitIf: 'failed' },
    { at: 1, do: 'apply', who: 'hits' },
    { at: 1, do: 'popup', who: 'hits', text: 'CHARMED', color: VIOLET, hitIf: 'failed' },
    { at: 1, do: 'popup', who: 'hits', text: 'SAVE', color: 'miss', hitIf: 'saved' },
  ]);

  // "The target's Speed is doubled ... and it gains an additional action": gold lightning crackles from the caster to a
  // willing friend, who is wrapped in quick gold bands rising feet to head, trailing speed lines both ways and crackling at the heels.
  restyle('haste', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.03, do: 'glow', where: 'casterHand', type: 'lightning', radius: 13, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'lightning', count: 24, where: 'casterHand', speed: 18 },
    { at: 0.05, do: 'burst', kind: 'spark', type: 'lightning', count: 14, where: 'casterHand', speed: 40 },
    { at: 0.15, do: 'projectile', sprite: 'dart', type: 'lightning', speed: 240, curve: 8, sure: true, event: 'x1', trailRate: 90, glow: 7, streak: 16 },
    { at: 0.15, do: 'projectile', sprite: 'dart', type: 'lightning', speed: 220, sure: true, trailRate: 90, lightRadius: 14, glow: 8, streak: 18 },
    { at: 'hit', do: 'arc', to: 'target', type: 'lightning', time: 0.3, forks: 4, jag: 0.2, glow: 10 },
    { at: 'hit', do: 'glow', who: 'target', type: 'radiant', radius: 22, time: 0.8, power: 1 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'radiant', count: 36, speed: 34, spread: 3 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'radiant', count: 30, speed: 150, dir: [-1, 0], cone: 0.2, spread: 4 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'radiant', count: 30, speed: 150, dir: [1, 0], cone: 0.2, spread: 4 },
    { at: 'hit', do: 'burst', kind: 'dust', where: 'targetFeet', count: 16, speed: 30, spread: 3 },
    ...bands({ at: 0, step: 0.04, heights: [0, 4, 8, 12, 16, 2, 6, 10, 14], r: 8, r0: 6, time: 0.25, thick: 2, type: 'radiant', where: 'targetFeet' }).map(s => ({ ...s, at: 'hit', delay: s.at })),
    { at: 'hit', do: 'emit', kind: 'spark', type: 'radiant', where: 'targetFeet', rate: 70, time: 0.7, radius: 5, speed: 34 },
    { at: 'hit', do: 'emit', kind: 'glow', type: 'radiant', where: 'targetFeet', rate: 80, time: 0.6, radius: 6, speed: 14, big: 0.3 },
    { at: 'hit', do: 'light', type: 'radiant', where: 'target', radius: 22, time: 0.8, power: 1.3 },
    ...[0, 0.18, 0.36].map(delay => ({ at: 'hit', do: 'outline', who: 'target', color: GOLD, time: 0.12, delay })),
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'HASTE', color: 'radiant' },
  ]);
})();
