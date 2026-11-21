// New looks (2024 text) for the Wizard's blasts, bolts, touches and areas. Each keeps the spell's rules (its label, area and
// roll) and its event structure (hit, ifPart, apply, popup, struck, caught); only the picture changes, at true scale
// (5 ft = 10 map pixels), with halos, streaks and many more particles.
(() => {
  const { struck, caught, restyle } = Spells;
  const HIT = ['hit', 'crit'];
  const FIRE = [255, 232, 196], WHITE = [255, 255, 255], ICE = [210, 240, 255], ACID = [210, 255, 140], DARK = [186, 130, 240];

  // The caster's hand lights up before any cast: a halo and a puff of the spell's own colour.
  const charge = (type, kind, count, radius, at = 0.02) => [
    { at, do: 'glow', where: 'casterHand', type, radius, time: 0.45, power: 0.9 },
    { at: at + 0.03, do: 'burst', kind, type, count, where: 'casterHand', speed: 16, spread: 2 },
  ];

  // "You hurl a mote of fire at a creature or an object within range": a small hot bead with a fiery tail; it bursts into
  // flame, and a creature it strikes keeps smouldering (a flammable object starts burning).
  restyle('fireBolt', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    charge('fire', 'ember', 16, 10),
    { at: 0.18, do: 'projectile', sprite: 'bead', type: 'fire', speed: 210, trailRate: 120, lightRadius: 20, glow: 8, streak: 9 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'fire', radius: 5, time: 0.26 },
    { at: 'hit', do: 'pop', type: 'fire', radius: 8, time: 0.34, if: 'crit' },
    { at: 'hit', do: 'glow', type: 'fire', radius: 16, time: 0.4, power: 1 },
    { at: 'hit', do: 'glow', type: 'fire', radius: 26, time: 0.5, power: 1, if: 'crit' },
    { at: 'hit', do: 'burst', kind: 'ember', count: 30, speed: 50, spread: 2, size: 2 },
    { at: 'hit', do: 'burst', kind: 'ember', count: 28, speed: 64, spread: 1 },
    { at: 'hit', do: 'burst', kind: 'spark', count: 14, speed: 80, spread: 1 },
    { at: 'hit', do: 'burst', kind: 'smoke', count: 6, speed: 14, spread: 3, delay: 0.1, if: HIT },
    { at: 'hit', do: 'light', type: 'fire', radius: 32, time: 0.7, power: 1.7 },
    { at: 'hit', do: 'emit', kind: 'ember', where: 'targetFeet', rate: 50, time: 0.7, radius: 5, speed: 12, big: 0.3, delay: 0.1, if: HIT },
    { at: 'hit', do: 'mark', kind: 'scorch', who: 'target', if: HIT, fade: 8 },
    { at: 'hit', do: 'mark', kind: 'scorch', where: 'impact', fade: 8, if: 'miss' },
    struck({ flash: FIRE }),
  ]);

  // "A frigid beam of blue-white light streaks toward a creature": a very fast icy streak, then a straight beam that lingers
  // between hand and target; a hit frosts over (a ring of rime on the floor, ice shards) and slows it.
  restyle('rayOfFrost', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.45 },
    charge('cold', 'glow', 18, 12, 0.04),
    { at: 0.14, do: 'projectile', sprite: 'bead', type: 'cold', speed: 340, trailRate: 200, lightRadius: 22, glow: 10, streak: 28 },
    { at: 0.2, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'arc', to: 'target', type: 'cold', time: 0.3, forks: 0, jag: 0.03, glow: 10, if: HIT },
    { at: 'hit', do: 'pop', type: 'cold', radius: 5, time: 0.28 },
    { at: 'hit', do: 'glow', type: 'cold', radius: 20, time: 0.5, power: 1 },
    { at: 'hit', do: 'ring', type: 'cold', where: 'targetFeet', r0: 3, r1: 16, time: 0.5, thick: 1, if: HIT },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'cold', count: 36, speed: 44, spread: 2 },
    { at: 'hit', do: 'burst', kind: 'shard', type: 'cold', count: 20, speed: 40, spread: 2, if: HIT },
    { at: 'hit', do: 'burst', kind: 'mote', type: 'cold', count: 16, speed: 12, spread: 6, if: HIT },
    { at: 'hit', do: 'light', type: 'cold', radius: 26, time: 0.7, power: 1.5 },
    { at: 'hit', do: 'outline', who: 'target', color: [150, 220, 255], time: 0.9, if: HIT },
    { at: 'hit', do: 'popup', text: 'SLOWED', color: 'info', above: 7, if: HIT },
    struck({ flash: ICE, knock: 1 }),
  ]);

  // "A thin sheet of flames shoots forth from you. Each creature in a 15-foot Cone": a true 15 ft cone of flame (30 px, as wide
  // as it is long) fanning from the open hands, with a spray of embers and a flicker of smoke above it.
  restyle('burningHands', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.9 },
    charge('fire', 'ember', 18, 12),
    { at: 0.15, do: 'volume', shape: 'cone', feet: 15, type: 'fire', time: 0.8, light: 1.6 },
    { at: 0.15, do: 'cone', from: 'casterHand', kind: 'ember', type: 'fire', rate: 520, time: 0.55, speed: 80, spread: 0.9, length: 30, big: 0.5, lightRadius: 30, lightType: 'fire' },
    { at: 0.2, do: 'cone', from: 'casterHand', kind: 'spark', type: 'fire', rate: 120, time: 0.4, speed: 100, spread: 0.7, length: 30 },
    { at: 0.3, do: 'cone', from: 'casterHand', kind: 'smoke', type: 'smoke', rate: 40, time: 0.5, speed: 24, spread: 0.6, length: 30 },
    { at: 0.2, do: 'shake', strength: 1.8, time: 0.5 },
    { at: 0.4, do: 'glow', who: 'hits', type: 'fire', radius: 14, time: 0.4, power: 1 },
    { at: 0.4, do: 'burst', who: 'hits', where: 'chest', kind: 'ember', type: 'fire', count: 16, speed: 40 },
    { at: 0.4, do: 'mark', kind: 'scorch', who: 'hits', fade: 10 },
    caught({ at: 0.4, flash: FIRE, knock: 1.5 }),
  ]);

  // "A wave of thunderous energy. Each creature in a 15-foot Cube originating from you ... pushed 10 feet away": a 15 ft
  // cube (the game centres it on the caster) lights up, three shock rings roll out of it, dust billows, the screen shakes.
  restyle('thunderwave', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.05, do: 'glow', where: 'caster', type: 'lightning', radius: 14, time: 0.3, power: 0.8 },
    { at: 0.15, do: 'screenflash', color: [210, 225, 255], strength: 0.3, time: 0.1 },
    { at: 0.15, do: 'hitstop', time: 0.06 },
    { at: 0.15, do: 'volume', shape: 'cube', feet: 15, type: 'lightning', where: 'casterFeet', dy: -1, time: 0.5, light: 1.4 },
    { at: 0.15, do: 'ring', type: 'lightning', where: 'casterFeet', r0: 4, r1: 34, time: 0.4, thick: 3 },
    { at: 0.2, do: 'ring', type: 'force', where: 'casterFeet', r0: 2, r1: 28, time: 0.4, thick: 2 },
    { at: 0.27, do: 'ring', type: 'lightning', where: 'casterFeet', r0: 2, r1: 22, time: 0.35, thick: 1 },
    { at: 0.15, do: 'glow', where: 'casterFeet', type: 'lightning', radius: 30, time: 0.4, power: 0.45, dy: -3 },
    { at: 0.15, do: 'burst', kind: 'dust', count: 60, where: 'casterFeet', speed: 70, spread: 8 },
    { at: 0.15, do: 'burst', kind: 'spark', type: 'lightning', count: 36, where: 'casterFeet', speed: 90, spread: 4 },
    { at: 0.15, do: 'burst', kind: 'smoke', count: 12, where: 'casterFeet', speed: 22, spread: 8 },
    { at: 0.15, do: 'shake', strength: 4, time: 0.45 },
    { at: 0.15, do: 'light', type: 'lightning', where: 'caster', radius: 34, time: 0.45, power: 1.4 },
    { at: 0.22, do: 'popup', who: 'caster', text: 'BOOM', color: 'info', above: 6 },
    { at: 0.22, do: 'burst', who: 'hits', where: 'chest', kind: 'dust', count: 14, speed: 40 },
    caught({ at: 0.22, flash: WHITE, knock: 3 }),
  ]);

  // "You create an acidic bubble at a point within range, where it explodes in a 5-foot-radius Sphere": a bubble lobbed to the
  // point, then a true 5 ft sphere of green acid bursts, with drops flying and acid pooling on the floor.
  restyle('acidSplash', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.45 },
    charge('acid', 'drop', 10, 9, 0.04),
    { at: 0.14, do: 'projectile', sprite: 'blob', type: 'acid', to: 'point', speed: 120, arc: 10, sure: true, lightRadius: 12, glow: 7, streak: 6, trailRate: 60 },
    { at: 'hit', do: 'volume', shape: 'sphere', feet: 5, type: 'acid', time: 0.8, light: 1.4 },
    { at: 'hit', do: 'pop', type: 'acid', radius: 8, time: 0.3 },
    { at: 'hit', do: 'ring', type: 'acid', r0: 3, r1: 12, time: 0.4, thick: 1, dy: 4 },
    { at: 'hit', do: 'burst', kind: 'drop', type: 'acid', count: 40, speed: 50, spread: 2 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'acid', count: 24, speed: 36, spread: 3 },
    { at: 'hit', do: 'burst', kind: 'smoke', type: 'acid', count: 10, speed: 14, spread: 4, delay: 0.1 },
    { at: 'hit', do: 'burst', kind: 'drop', who: 'hits', where: 'chest', type: 'acid', count: 14, speed: 28 },
    { at: 'hit', do: 'mark', kind: 'acid', where: 'impact', fade: 10 },
    { at: 'hit', do: 'mark', kind: 'acid', who: 'hits', fade: 8, hitIf: 'failed' },
    caught({ flash: ACID, knock: 1 }),
  ]);

  // "You spray toxic mist at a creature within range": a green-yellow cloud sprays out of the hand and rolls to the creature,
  // leaving a drifting trail of mist; on a hit it engulfs the target in a poison cloud that lingers.
  restyle('poisonSpray', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'strike', time: 0.5 },
    { at: 0.04, do: 'glow', where: 'casterHand', type: 'acid', radius: 10, time: 0.4, power: 0.8 },
    { at: 0.05, do: 'cone', from: 'casterHand', kind: 'smoke', type: 'acid', rate: 260, time: 0.3, speed: 44, spread: 0.7, length: 16, big: 0.5 },
    { at: 0.07, do: 'cone', from: 'casterHand', kind: 'glow', type: 'acid', rate: 100, time: 0.25, speed: 50, spread: 0.6, length: 16 },
    { at: 0.12, do: 'projectile', sprite: 'blob', type: 'acid', speed: 120, trail: 'smoke', trailRate: 160, lightRadius: 12, glow: 9, streak: 10 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'glow', type: 'acid', radius: 18, time: 0.6, power: 0.9 },
    { at: 'hit', do: 'burst', kind: 'smoke', type: 'acid', count: 48, speed: 26, spread: 5, size: 2 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'acid', count: 24, speed: 30, spread: 3 },
    { at: 'hit', do: 'burst', kind: 'drop', type: 'acid', count: 18, speed: 30, if: HIT },
    { at: 'hit', do: 'emit', kind: 'smoke', type: 'acid', where: 'targetFeet', rate: 40, time: 0.9, radius: 6, speed: 8, big: 0.4, if: HIT },
    { at: 'hit', do: 'light', type: 'acid', radius: 22, time: 0.7, power: 1.2 },
    { at: 'hit', do: 'pose', who: 'target', pose: 'shiver', time: 0.6, if: HIT },
    struck({ flash: ACID, knock: 1 }),
  ]);

  // "Lightning springs from you to a creature that you try to touch": crooked, branching lightning leaps from the hand to the
  // creature and crawls over it (sparks, a jolt); on a miss it only fizzles in the air beside it.
  restyle('shockingGrasp', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.25 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'lightning', radius: 13, time: 0.45, power: 1 },
    { at: 0.02, do: 'burst', kind: 'spark', type: 'lightning', where: 'casterHand', count: 18, speed: 24, spread: 2 },
    { at: 0.22, do: 'pose', who: 'caster', pose: 'strike', time: 0.4 },
    { at: 0.25, do: 'arc', to: 'target', type: 'lightning', time: 0.3, forks: 5, jag: 0.35, glow: 13, if: HIT },
    { at: 0.28, do: 'arc', to: 'target', type: 'lightning', time: 0.26, forks: 3, jag: 0.5, glow: 9, if: HIT },
    { at: 0.25, do: 'arc', feet: 5, type: 'lightning', time: 0.25, forks: 3, jag: 0.4, glow: 10, if: 'miss' },
    { at: 0.25, do: 'light', type: 'lightning', where: 'target', radius: 22, time: 0.4, power: 1.5, if: HIT },
    { at: 'hit', do: 'glow', who: 'target', type: 'lightning', radius: 15, time: 0.4, power: 1, if: HIT },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'lightning', who: 'target', where: 'chest', count: 36, speed: 60, spread: 3, if: HIT },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'lightning', who: 'target', where: 'chest', count: 16, speed: 34, if: HIT },
    { at: 'hit', do: 'screenflash', color: [220, 235, 255], strength: 0.25, time: 0.07, if: HIT },
    { at: 'hit', do: 'outline', who: 'target', color: [190, 220, 255], time: 0.4, if: HIT },
    { at: 'hit', do: 'pose', who: 'target', pose: 'shiver', time: 0.5, if: 'hit' },
    { at: 'hit', do: 'popup', text: 'SHOCK', color: 'info', above: 7, if: HIT },
    struck({ flash: WHITE, knock: 1 }),
  ]);

  // "Channeling the chill of the grave ... melee spell attack": the hand goes dark and breathes violet-black smoke; the touch
  // wraps the target in grave-cold mist and rising wisps, and a pale outline stays while its wounds can't close.
  restyle('chillTouch', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.3 },
    { at: 0.02, do: 'emit', kind: 'smoke', type: 'necrotic', where: 'casterHand', rate: 90, time: 0.4, radius: 3, speed: 8, big: 0.4 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'necrotic', radius: 13, time: 0.5, power: 0.9 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'necrotic', count: 16, where: 'casterHand', speed: 12, spread: 2 },
    { at: 0.28, do: 'pose', who: 'caster', pose: 'strike', time: 0.4 },
    { at: 0.32, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 0.34, do: 'glow', who: 'target', type: 'necrotic', radius: 18, time: 0.7, power: 1, if: HIT },
    { at: 0.34, do: 'ring', type: 'necrotic', where: 'targetFeet', r0: 3, r1: 15, time: 0.5, thick: 1, if: HIT },
    { at: 0.34, do: 'burst', who: 'target', where: 'chest', kind: 'smoke', type: 'necrotic', count: 36, speed: 24, spread: 3, size: 2, if: HIT },
    { at: 0.34, do: 'burst', who: 'target', where: 'chest', kind: 'glow', type: 'necrotic', count: 22, speed: 30, if: HIT },
    { at: 0.34, do: 'emit', kind: 'mote', type: 'necrotic', where: 'targetFeet', rate: 40, time: 0.9, radius: 6, speed: 14, if: HIT },
    { at: 0.34, do: 'emit', kind: 'smoke', type: 'necrotic', where: 'targetFeet', rate: 30, time: 0.8, radius: 5, speed: 10, if: HIT },
    { at: 0.34, do: 'outline', who: 'target', color: DARK, time: 1.1, if: HIT },
    { at: 0.34, do: 'popup', text: 'CHILL', color: [190, 150, 240], above: 7, if: HIT },
    struck({ at: 0.34, flash: DARK, knock: 1 }),
  ]);

  // "Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type of orb": a swirling ball of the chosen element grows in
  // the hand, is hurled, and bursts in a ring in that element's colours.
  restyle('chromaticOrb', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.02, do: 'glow', where: 'casterHand', type: 'chosen', radius: 16, time: 0.5, power: 1 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'chosen', count: 26, where: 'casterHand', speed: 22, spread: 3 },
    { at: 0.1, do: 'emit', kind: 'glow', type: 'chosen', where: 'casterHand', rate: 60, time: 0.12, radius: 4, speed: 12 },
    { at: 0.22, do: 'projectile', sprite: 'bead', type: 'chosen', speed: 160, trailRate: 120, lightRadius: 22, glow: 12, streak: 12 },
    { at: 0.32, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 8, time: 0.34 },
    { at: 'hit', do: 'glow', type: 'chosen', radius: 24, time: 0.5, power: 1 },
    { at: 'hit', do: 'ring', type: 'chosen', r0: 3, r1: 18, time: 0.4, thick: 2 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 54, speed: 56, spread: 3 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'chosen', count: 22, speed: 72, spread: 2 },
    { at: 'hit', do: 'light', type: 'chosen', radius: 34, time: 0.8, power: 1.7 },
    struck({ flash: WHITE, knock: 2 }),
  ]);

  // "the orb leaps to a different target within 30 feet": the same orb, bounding on in a high arc from the first target.
  restyle('chromaticOrbLeap', [
    { at: 0, do: 'glow', where: 'casterHand', type: 'chosen', radius: 14, time: 0.4, power: 1 },
    { at: 0, do: 'burst', kind: 'glow', type: 'chosen', count: 22, where: 'casterHand', speed: 26, spread: 2 },
    { at: 0.05, do: 'projectile', sprite: 'bead', type: 'chosen', speed: 150, arc: 14, trailRate: 120, lightRadius: 22, glow: 12, streak: 14 },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 8, time: 0.34 },
    { at: 'hit', do: 'glow', type: 'chosen', radius: 24, time: 0.5, power: 1 },
    { at: 'hit', do: 'ring', type: 'chosen', r0: 3, r1: 18, time: 0.4, thick: 2 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 54, speed: 56, spread: 3 },
    { at: 'hit', do: 'burst', kind: 'spark', type: 'chosen', count: 22, speed: 72, spread: 2 },
    { at: 'hit', do: 'light', type: 'chosen', radius: 34, time: 0.8, power: 1.7 },
    struck({ flash: WHITE, knock: 2 }),
  ]);

  // "You hurl three fiery rays ... a ranged spell attack for each ray": three long streaks of fire one after another, fanned a
  // little apart; each hit bursts in flame with its own number, each miss only says MISS.
  restyle('scorchingRay', [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    charge('fire', 'ember', 24, 13, 0.04),
    ...[[0.15, -3], [0.27, 0], [0.39, 3]].map(([at, dy], n) => [
      { at: at - 0.03, do: 'glow', where: 'casterHand', type: 'fire', radius: 9, time: 0.2, power: 1 },
      { at, do: 'projectile', sprite: 'bead', type: 'fire', speed: 300, offset: [0, dy], sure: true, event: 'r' + n, trailRate: 140, lightRadius: 18, glow: 9, streak: 20 },
      { at: 'r' + n, do: 'pop', type: 'fire', radius: 4, time: 0.2, ifPart: n },
      { at: 'r' + n, do: 'glow', type: 'fire', radius: 16, time: 0.35, power: 1, ifPart: n },
      { at: 'r' + n, do: 'burst', kind: 'ember', count: 26, speed: 46, spread: 2, size: 2, ifPart: n },
      { at: 'r' + n, do: 'burst', kind: 'spark', count: 10, speed: 70, ifPart: n },
      { at: 'r' + n, do: 'burst', kind: 'smoke', count: 4, speed: 12, spread: 2, delay: 0.1, ifPart: n },
      { at: 'r' + n, do: 'flash', who: 'target', color: FIRE, time: 0.05, ifPart: n },
      { at: 'r' + n, do: 'knock', who: 'target', dist: 1, time: 0.2, ifPart: n },
      { at: 'r' + n, do: 'apply', who: 'target', part: n },
      { at: 'r' + n, do: 'popup', text: 'amount', part: n, color: 'damage', zero: 'MISS', dx: (n - 1) * 5 },
    ]),
    { at: 'r2', do: 'pose', who: 'target', pose: 'hit', time: 0.35, if: HIT },
    { at: 'r2', do: 'mark', kind: 'scorch', who: 'target', fade: 8, if: HIT },
  ]);

  // "A loud noise erupts from a point ... a 10-foot-radius Sphere": a bright flash of ringing sound at the point: a true 10 ft
  // sphere of white-blue force, shock rings, glass-like shards flying, dust, and a hard shake.
  restyle('shatter', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    charge('lightning', 'glow', 14, 11, 0.05),
    { at: 0.3, do: 'screenflash', color: [235, 240, 255], strength: 0.4, time: 0.09 },
    { at: 0.3, do: 'hitstop', time: 0.06 },
    { at: 0.3, do: 'volume', shape: 'sphere', feet: 10, type: 'lightning', where: 'point', time: 0.8, light: 1.2 },
    { at: 0.3, do: 'ring', type: 'lightning', where: 'point', r0: 3, r1: 24, time: 0.35, thick: 3, dy: 5 },
    { at: 0.36, do: 'ring', type: 'force', where: 'point', r0: 3, r1: 20, time: 0.35, thick: 1, dy: 5 },
    { at: 0.3, do: 'pop', type: 'lightning', where: 'point', radius: 10, time: 0.3 },
    { at: 0.3, do: 'glow', type: 'lightning', where: 'point', radius: 22, time: 0.4, power: 0.5 },
    { at: 0.3, do: 'burst', kind: 'shard', type: 'steel', where: 'point', count: 70, speed: 80, spread: 6 },
    { at: 0.3, do: 'burst', kind: 'spark', type: 'lightning', where: 'point', count: 40, speed: 100, spread: 4 },
    { at: 0.3, do: 'burst', kind: 'dust', where: 'point', count: 36, speed: 40, spread: 10 },
    { at: 0.3, do: 'shake', strength: 3.5, time: 0.45 },
    { at: 0.3, do: 'popup', who: 'caster', text: 'CRACK', color: 'info', above: 6 },
    { at: 0.32, do: 'burst', who: 'hits', where: 'chest', kind: 'shard', type: 'steel', count: 10, speed: 40 },
    caught({ at: 0.32, flash: WHITE, knock: 2 }),
  ]);

  // "Each creature of your choice in a 5-foot-radius Sphere ... Wisdom saving throw or Incapacitated": a soft violet sphere of
  // drifting dust and rising motes settles at the point; those who fail it sway, drowsy; those who save shrug it off.
  restyle('sleep', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.9 },
    charge('force', 'glow', 16, 11, 0.05),
    { at: 0.2, do: 'volume', shape: 'sphere', feet: 5, type: 'force', where: 'point', time: 1.1, light: 1.1 },
    { at: 0.2, do: 'glow', where: 'point', type: 'force', radius: 24, time: 1.1, power: 0.8, dy: 3 },
    { at: 0.2, do: 'ring', type: 'force', where: 'point', r0: 2, r1: 12, time: 0.9, thick: 1, dy: 4 },
    { at: 0.2, do: 'emit', kind: 'glow', type: 'force', where: 'point', rate: 90, time: 1, radius: 11, speed: 5, big: 0.3 },
    { at: 0.2, do: 'emit', kind: 'mote', type: 'force', where: 'point', rate: 36, time: 1, radius: 10, speed: 8 },
    { at: 0.2, do: 'light', type: 'force', where: 'point', radius: 22, time: 1.2, power: 1 },
    { at: 0.8, do: 'glow', who: 'hits', type: 'force', radius: 12, time: 0.5, power: 0.9, hitIf: 'failed' },
    { at: 0.8, do: 'pose', who: 'hits', pose: 'shiver', time: 0.5, hitIf: 'failed' },
    { at: 0.8, do: 'burst', who: 'hits', where: 'chest', kind: 'mote', type: 'force', count: 12, speed: 12, hitIf: 'failed' },
    { at: 0.9, do: 'apply', who: 'hits' },
    { at: 0.9, do: 'popup', who: 'hits', text: 'DROWSY', color: [200, 160, 255], hitIf: 'failed' },
    { at: 0.9, do: 'popup', who: 'hits', text: 'SAVE', color: 'miss', hitIf: 'saved' },
  ]);

  // "You create a 5-foot-diameter sphere of fire in an unoccupied space on the ground within range ... Bright Light in a
  // 20-foot radius": nothing is thrown. A ring of fire draws itself on the floor at the spot and closes in, flames erupt out
  // of the ground and gather into the ball (Fx keeps it there, 5 ft across), and its warm light floods 20 ft (40 px).
  restyle('flamingSphere', [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    charge('fire', 'ember', 16, 11, 0.05),
    { at: 0.25, do: 'ring', type: 'fire', where: 'point', r0: 22, r1: 4, time: 0.45, thick: 1, dy: 3 },
    { at: 0.3, do: 'ring', type: 'fire', where: 'point', r0: 14, r1: 3, time: 0.4, thick: 1, dy: 3 },
    { at: 0.25, do: 'emit', kind: 'ember', type: 'fire', where: 'point', rate: 70, time: 0.5, radius: 14, speed: 14, dy: 3 },
    { at: 0.25, do: 'glow', type: 'fire', where: 'point', radius: 14, time: 0.6, power: 0.7 },
    { at: 0.6, do: 'volume', shape: 'sphere', feet: 5, type: 'fire', where: 'point', dy: 3, time: 0.7, light: 1.6 },
    { at: 0.6, do: 'pop', type: 'fire', where: 'point', radius: 7, time: 0.32 },
    { at: 0.6, do: 'ring', type: 'fire', where: 'point', r0: 3, r1: 16, time: 0.5, thick: 1, dy: 3 },
    { at: 0.6, do: 'glow', type: 'fire', where: 'point', radius: 40, time: 0.9, power: 0.8 },
    { at: 0.6, do: 'burst', kind: 'ember', where: 'point', count: 46, speed: 44, spread: 3, size: 2 },
    { at: 0.6, do: 'burst', kind: 'spark', where: 'point', count: 20, speed: 60, spread: 2 },
    { at: 0.6, do: 'light', type: 'fire', where: 'point', radius: 40, time: 0.9, power: 1.6 },
    { at: 0.6, do: 'mark', kind: 'scorch', where: 'point', fade: 6 },
  ]);

  // "Any creature that ends its turn within 5 feet of the sphere makes a Dexterity saving throw": a tongue of flame licks out of
  // the ball to the creature and flares on it (half damage on a save, as the numbers show).
  restyle('sphereBurn', [
    { at: 0, do: 'glow', where: 'point', type: 'fire', radius: 14, time: 0.3, power: 1 },
    { at: 0, do: 'burst', kind: 'ember', where: 'point', count: 24, speed: 30, spread: 2 },
    { at: 0.05, do: 'projectile', sprite: 'bead', type: 'fire', from: 'point', speed: 130, sure: true, trailRate: 130, lightRadius: 16, glow: 8, streak: 12 },
    { at: 'hit', do: 'pop', type: 'fire', radius: 6, time: 0.28 },
    { at: 'hit', do: 'glow', type: 'fire', radius: 18, time: 0.4, power: 1 },
    { at: 'hit', do: 'burst', kind: 'ember', count: 30, speed: 44, spread: 2, size: 2 },
    { at: 'hit', do: 'burst', kind: 'spark', count: 10, speed: 60 },
    { at: 'hit', do: 'mark', kind: 'scorch', who: 'hits', fade: 8 },
    caught({ at: 'hit', flash: FIRE, knock: 1 }),
  ]);
})();
