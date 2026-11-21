// The effect catalog: each effect is a list of steps for Fx (docs/dnd-game/effects.md section 8). A step starts at a time
// in seconds, or at an event ('hit': the projectile lands or the blade connects). if: only for these outcomes.
// who: 'caster', 'target' (the default), or 'hits' (everyone an area caught); hitIf: only hits that 'saved' or 'failed'.
const Spells = (() => {
  const catalog = new Map();
  const WHITE = [255, 255, 255], GOLD = [255, 211, 77], FIRE = [255, 232, 196], HOLY = [255, 244, 190];
  const VIOLET = [200, 150, 255], GREEN = [190, 255, 150], ACID = [210, 255, 140], DARK = [186, 130, 240];
  const HIT = ['hit', 'crit'];

  // Registers an effect. info: { label, by (the figure who does it), group (panel section), on: 'enemy' | 'ally'
  //   | 'hero' (a monster's target) | 'self', area, melee, roll: 'attack' | 'save', save (ability), reaction,
  //   hidden (not a lab button) }.
  function add(name, info, steps) { catalog.set(name, { name, group: info.by, ...info, steps: steps.flat() }); }
  function get(name) { return catalog.get(name).steps; }
  function list() { return [...catalog.values()]; }

  // Swaps an effect's steps for new ones and keeps what it is (its label, area, roll): a spell's look can change on its own.
  function restyle(name, steps) { catalog.get(name).steps = steps.flat(); }

  // A single target taking a blow at an event: hit-stop, flash, knockback, recoil, shake, damage, number;
  // bigger on a crit; a dodge and MISS on a miss.
  function struck(o = {}) {
    const at = o.at || 'hit', knock = o.knock ?? 1.5;
    return [
      { at, do: 'hitstop', time: o.stop ?? 0.07, if: 'hit' },
      { at, do: 'hitstop', time: 0.2, if: 'crit' },
      { at, do: 'flash', who: 'target', color: o.flash || WHITE, time: 0.07, if: HIT },
      { at, do: 'knock', who: 'target', dist: knock, time: 0.4, if: 'hit' },
      { at, do: 'knock', who: 'target', dist: knock + 1, time: 0.5, if: 'crit' },
      { at, do: 'pose', who: 'target', pose: 'hit', time: 0.4, if: HIT },
      { at, do: 'shake', strength: o.shake ?? 1, time: 0.15, if: 'hit' },
      { at, do: 'shake', strength: 3, time: 0.3, if: 'crit' },
      { at, do: 'apply', who: 'target', if: HIT },
      { at, do: 'popup', text: 'amount', color: 'damage', if: 'hit' },
      { at, do: 'popup', text: 'amount', color: 'crit', big: true, if: 'crit' },
      { at, do: 'popup', text: 'CRIT', color: 'crit', above: 7, if: 'crit' },
      { at, do: 'popup', text: 'MISS', color: 'miss', if: 'miss' },
    ];
  }

  // Everyone an area caught, at an event: flash, knocked away from the blast, recoil, damage, numbers
  // (grey with SAVE for those who saved).
  function caught(o = {}) {
    const at = o.at || 'hit';
    return [
      { at, do: 'flash', who: 'hits', color: o.flash || WHITE, time: o.flashTime || 0.08 },
      { at, do: 'knock', who: 'hits', dist: o.knock ?? 2, time: 0.45, from: o.from },
      { at, do: 'pose', who: 'hits', pose: 'hit', time: 0.45 },
      { at, do: 'apply', who: 'hits' },
      { at, do: 'popup', who: 'hits', text: 'amount', color: 'damage', delay: 0.05 },
    ];
  }

  // ---------- Wizard ----------

  add('fireBolt', { label: 'Fire Bolt', by: 'Wizard', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    { at: 0.05, do: 'burst', kind: 'ember', count: 6, where: 'casterHand', speed: 12 },
    { at: 0.05, do: 'light', type: 'fire', where: 'casterHand', radius: 12, time: 0.3, power: 1 },
    { at: 0.18, do: 'projectile', sprite: 'bead', type: 'fire', speed: 190, trailRate: 70, lightRadius: 18 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'fire', radius: 4, time: 0.22 },
    { at: 'hit', do: 'pop', type: 'fire', radius: 6, time: 0.3, if: 'crit' },
    { at: 'hit', do: 'burst', kind: 'ember', count: 10, speed: 38, spread: 1, size: 2 },
    { at: 'hit', do: 'burst', kind: 'ember', count: 16, speed: 46, spread: 1 },
    { at: 'hit', do: 'light', type: 'fire', radius: 28, time: 0.6, power: 1.6 },
    { at: 'hit', do: 'mark', kind: 'scorch', who: 'target', if: HIT, fade: 8 },
    { at: 'hit', do: 'mark', kind: 'scorch', where: 'impact', fade: 8, if: 'miss' },
    struck({ flash: FIRE }),
  ]);

  // Three darts that curve in from different sides and never miss; each lands with its own number.
  add('magicMissile', { label: 'Magic Missile', by: 'Wizard', on: 'enemy' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.7 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 8, where: 'casterHand', speed: 14 },
    ...[[0.15, 12, -2], [0.23, -10, 0], [0.31, 16, 2]].map(([at, curve, dy], n) => [
      { at, do: 'projectile', sprite: 'dart', type: 'force', speed: 140, curve, offset: [0, dy], sure: true, event: 'd' + n, lightRadius: 10, trailRate: 50 },
      { at: 'd' + n, do: 'pop', type: 'force', radius: 2.5, time: 0.14 },
      { at: 'd' + n, do: 'burst', kind: 'glow', type: 'force', count: 7, speed: 30 },
      { at: 'd' + n, do: 'flash', who: 'target', color: VIOLET, time: 0.05 },
      { at: 'd' + n, do: 'knock', who: 'target', dist: 1, time: 0.2 },
      { at: 'd' + n, do: 'apply', who: 'target', part: n },
      { at: 'd' + n, do: 'popup', text: 'amount', part: n, color: 'damage', dx: (n - 1) * 4 },
    ]),
    { at: 'd2', do: 'pose', who: 'target', pose: 'hit', time: 0.35 },
    { at: 'd2', do: 'shake', strength: 1, time: 0.15 },
  ]);

  // A bead arcs to the spot, then bursts in a ring of fire that catches everyone within 20 ft.
  add('fireball', { label: 'Fireball', by: 'Wizard', on: 'enemy', area: 'sphere', roll: 'save', save: 'DEX' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    { at: 0.05, do: 'burst', kind: 'ember', count: 10, where: 'casterHand', speed: 16 },
    { at: 0.2, do: 'projectile', sprite: 'bead', type: 'fire', to: 'point', speed: 130, arc: 10, sure: true, lightRadius: 14 },
    { at: 'hit', do: 'screenflash', color: [255, 190, 90], strength: 0.35, time: 0.12 },
    { at: 'hit', do: 'hitstop', time: 0.1 },
    { at: 'hit', do: 'pop', type: 'fire', radius: 14, time: 0.45 },
    { at: 'hit', do: 'ring', type: 'fire', r0: 6, r1: 26, time: 0.4, thick: 2 },
    { at: 'hit', do: 'burst', kind: 'ember', count: 40, speed: 75, spread: 6, size: 2 },
    { at: 'hit', do: 'burst', kind: 'dust', count: 16, speed: 30, spread: 8 },
    { at: 'hit', do: 'light', type: 'fire', radius: 60, time: 1.0, power: 1.9 },
    { at: 'hit', do: 'shake', strength: 3, time: 0.45 },
    { at: 'hit', do: 'mark', kind: 'blast', where: 'impact', fade: 20 },
    { at: 'hit', do: 'emit', kind: 'ember', where: 'impact', rate: 30, time: 0.9, radius: 12, speed: 6, delay: 0.2 },
    caught({ flash: FIRE, knock: 2.5, from: 'impact' }),
  ]);

  // A jagged bolt along a 100 ft line to the first wall; the room flashes and everyone in the line jolts.
  add('lightningBolt', { label: 'Lightning Bolt', by: 'Wizard', on: 'enemy', area: 'line', roll: 'save', save: 'DEX' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.7 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'lightning', count: 10, where: 'casterHand', speed: 18 },
    { at: 0.25, do: 'bolt', type: 'lightning', length: 110, time: 0.4 },
    { at: 'hit', do: 'screenflash', color: [220, 235, 255], strength: 0.55, time: 0.08 },
    { at: 'hit', do: 'hitstop', time: 0.06 },
    { at: 'hit', do: 'shake', strength: 2, time: 0.25 },
    { at: 'hit', do: 'burst', who: 'hits', where: 'chest', kind: 'glow', type: 'lightning', count: 10, speed: 40 },
    caught({ flash: WHITE, flashTime: 0.14, knock: 1 }),
  ]);

  // Reaction: an enemy shoots the wizard; a hexagon of force snaps up and the arrow glances off.
  add('shield', { label: 'Shield', by: 'Wizard', on: 'self', reaction: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.3 },
    { at: 0.18, do: 'projectile', sprite: 'arrow', speed: 170, sure: true, offset: [-4, 0] },
    { at: 0.26, do: 'pose', who: 'target', pose: 'cast', time: 0.6 },
    { at: 0.26, do: 'bubble', who: 'target', type: 'force', time: 1.0 },
    { at: 0.26, do: 'popup', who: 'target', text: 'SHIELD', color: 'info', above: 4 },
    { at: 'hit', do: 'hitstop', time: 0.06 },
    { at: 'hit', do: 'burst', kind: 'spark', count: 10, speed: 40 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'force', count: 8, speed: 30 },
    { at: 'hit', do: 'projectile', sprite: 'arrow', from: 'impact', to: 'deflect', speed: 110, arc: 4, sure: true, event: 'gone' },
    { at: 'hit', do: 'popup', text: 'MISS', color: 'miss' },
  ]);

  // Shield as a reaction in a fight: only the bubble and the word, played alongside the blocked attack.
  add('shieldUp', { label: 'Shield (reaction)', by: 'Wizard', on: 'self', hidden: true }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    { at: 0, do: 'bubble', who: 'caster', type: 'force', time: 0.9 },
    { at: 0, do: 'popup', who: 'caster', text: 'SHIELD', color: 'info', above: 4 },
  ]);

  // A pale beam of frost: a fast icy bead with a trail; the target frosts over and slows.
  add('rayOfFrost', { label: 'Ray of Frost', by: 'Wizard', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.45 },
    { at: 0.04, do: 'burst', kind: 'glow', type: 'cold', count: 8, where: 'casterHand', speed: 10 },
    { at: 0.04, do: 'light', type: 'cold', where: 'casterHand', radius: 12, time: 0.3, power: 1 },
    { at: 0.14, do: 'projectile', sprite: 'bead', type: 'cold', speed: 260, trailRate: 120, lightRadius: 16 },
    { at: 0.2, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'cold', radius: 4, time: 0.25 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'cold', count: 18, speed: 34, spread: 2 },
    { at: 'hit', do: 'burst', kind: 'shard', type: 'cold', count: 8, speed: 30, if: HIT },
    { at: 'hit', do: 'light', type: 'cold', radius: 22, time: 0.6, power: 1.4 },
    { at: 'hit', do: 'outline', who: 'target', color: [150, 220, 255], time: 0.5, if: HIT },
    { at: 'hit', do: 'popup', text: 'SLOWED', color: 'info', above: 7, if: HIT },
    struck({ flash: [210, 240, 255], knock: 1 }),
  ]);

  // Fire fans out of the open hands in a 15 ft cone; everyone in it burns (half on a DEX save).
  add('burningHands', { label: 'Burning Hands', by: 'Wizard', on: 'enemy', area: 'cone', roll: 'save', save: 'DEX' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.9 },
    { at: 0.05, do: 'burst', kind: 'ember', count: 10, where: 'casterHand', speed: 10 },
    { at: 0.15, do: 'cone', from: 'casterHand', kind: 'ember', type: 'fire', rate: 320, time: 0.55, speed: 70, spread: 0.6, length: 30, big: 0.5, lightRadius: 28, lightType: 'fire' },
    { at: 0.2, do: 'shake', strength: 1.5, time: 0.5 },
    { at: 0.4, do: 'mark', kind: 'scorch', who: 'hits', fade: 10 },
    caught({ at: 0.4, flash: FIRE, knock: 1.5 }),
  ]);

  // A boom rolls out of the caster: a ring of force, dust, a hard shake; whoever fails the CON save is hurled back
  // (the push itself is combat's: the figures slide after the effect).
  add('thunderwave', { label: 'Thunderwave', by: 'Wizard', on: 'enemy', area: 'around', roll: 'save', save: 'CON' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.15, do: 'screenflash', color: [210, 225, 255], strength: 0.25, time: 0.1 },
    { at: 0.15, do: 'hitstop', time: 0.06 },
    { at: 0.15, do: 'ring', type: 'lightning', where: 'casterFeet', r0: 4, r1: 30, time: 0.35, thick: 3 },
    { at: 0.15, do: 'ring', type: 'force', where: 'casterFeet', r0: 2, r1: 22, time: 0.3, thick: 1 },
    { at: 0.15, do: 'burst', kind: 'dust', count: 24, where: 'casterFeet', speed: 55, spread: 4 },
    { at: 0.15, do: 'shake', strength: 3.5, time: 0.4 },
    { at: 0.15, do: 'light', type: 'lightning', where: 'caster', radius: 30, time: 0.4, power: 1.3 },
    { at: 0.22, do: 'popup', who: 'caster', text: 'BOOM', color: 'info', above: 6 },
    caught({ at: 0.22, flash: WHITE, knock: 3 }),
  ]);

  // A shimmer of violet dust settles on a 5 ft spot: those who fail the Wisdom save sway, drowsy.
  add('sleep', { label: 'Sleep', by: 'Wizard', on: 'enemy', area: 'splash', roll: 'save', save: 'WIS' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.9 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 10, where: 'casterHand', speed: 12 },
    { at: 0.2, do: 'ring', type: 'force', where: 'point', r0: 3, r1: 12, time: 0.8, thick: 1 },
    { at: 0.2, do: 'emit', kind: 'glow', type: 'force', where: 'point', rate: 50, time: 0.9, radius: 10, speed: 3, big: 0.3 },
    { at: 0.2, do: 'light', type: 'force', where: 'point', radius: 18, time: 1.1, power: 0.8 },
    { at: 0.8, do: 'pose', who: 'hits', pose: 'shiver', time: 0.5, hitIf: 'failed' },
    { at: 0.9, do: 'apply', who: 'hits' },
    { at: 0.9, do: 'popup', who: 'hits', text: 'DROWSY', color: [200, 160, 255], hitIf: 'failed' },
    { at: 0.9, do: 'popup', who: 'hits', text: 'SAVE', color: 'miss', hitIf: 'saved' },
  ]);

  // A glob of acid lobs onto a spot and bursts, splashing everyone within 5 ft (DEX save each).
  add('acidSplash', { label: 'Acid Splash', by: 'Wizard', on: 'enemy', area: 'splash', roll: 'save', save: 'DEX' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.45 },
    { at: 0.05, do: 'burst', kind: 'drop', type: 'acid', count: 6, where: 'casterHand', speed: 10 },
    { at: 0.14, do: 'projectile', sprite: 'blob', type: 'acid', speed: 120, arc: 10, sure: true, lightRadius: 8 },
    { at: 'hit', do: 'pop', type: 'acid', radius: 5, time: 0.25 },
    { at: 'hit', do: 'burst', kind: 'drop', type: 'acid', count: 16, speed: 36, spread: 1 },
    { at: 'hit', do: 'burst', kind: 'drop', who: 'hits', where: 'chest', type: 'acid', count: 8, speed: 24 },
    { at: 'hit', do: 'mark', kind: 'acid', who: 'hits', fade: 8, hitIf: 'failed' },
    caught({ flash: ACID, knock: 1 }),
  ]);

  // A spat cloud of green poison flies at the target, 30 ft (a spell attack): it wheezes on a hit.
  add('poisonSpray', { label: 'Poison Spray', by: 'Wizard', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'strike', time: 0.5 },
    { at: 0.05, do: 'cone', from: 'casterHand', kind: 'smoke', type: 'acid', rate: 120, time: 0.2, speed: 30, spread: 0.4, length: 8, big: 0.3 },
    { at: 0.12, do: 'projectile', sprite: 'blob', type: 'acid', speed: 110, trailRate: 90, lightRadius: 6 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'smoke', type: 'acid', count: 18, speed: 18, big: 0.4 },
    { at: 'hit', do: 'burst', kind: 'drop', type: 'acid', count: 8, speed: 26, if: HIT },
    { at: 'hit', do: 'pose', who: 'target', pose: 'shiver', time: 0.5, if: HIT },
    struck({ flash: ACID, knock: 1 }),
  ]);

  // A crackling touch: a short arc of lightning from the hand, sparks; no opportunity attacks until its turn.
  add('shockingGrasp', { label: 'Shocking Grasp', by: 'Wizard', on: 'enemy', melee: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.25 },
    { at: 0.02, do: 'burst', kind: 'spark', where: 'casterHand', count: 8, speed: 14 },
    { at: 0.02, do: 'light', type: 'lightning', where: 'casterHand', radius: 12, time: 0.4, power: 1.2 },
    { at: 0.22, do: 'pose', who: 'caster', pose: 'strike', time: 0.4 },
    { at: 0.25, do: 'bolt', type: 'lightning', length: 12, time: 0.25 },
    { at: 'hit', do: 'burst', kind: 'spark', count: 16, speed: 40, if: HIT },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'lightning', count: 10, speed: 30, if: HIT },
    { at: 'hit', do: 'popup', text: 'SHOCK', color: 'info', above: 7, if: HIT },
    struck({ flash: WHITE, knock: 1 }),
  ]);

  // A touch of the grave: the hand goes dark and cold smoke wraps the target; its wounds won't close until the end
  // of the caster's next turn.
  add('chillTouch', { label: 'Chill Touch', by: 'Wizard', on: 'enemy', melee: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.3 },
    { at: 0.02, do: 'emit', kind: 'smoke', type: 'necrotic', where: 'casterHand', rate: 40, time: 0.35, radius: 2, speed: 4 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'necrotic', count: 8, where: 'casterHand', speed: 8 },
    { at: 0.28, do: 'pose', who: 'caster', pose: 'strike', time: 0.4 },
    { at: 0.32, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 0.34, do: 'burst', who: 'target', where: 'chest', kind: 'smoke', type: 'necrotic', count: 16, speed: 18, if: HIT },
    { at: 0.34, do: 'outline', who: 'target', color: DARK, time: 0.5, if: HIT },
    { at: 0.34, do: 'popup', text: 'CHILL', color: [190, 150, 240], above: 7, if: HIT },
    struck({ at: 0.34, flash: DARK, knock: 1 }),
  ]);

  // A glimpse of the opening, then the staff swings true: it glows with the chosen damage (radiant gold, or plain
  // steel-white for bludgeoning).
  add('trueStrike', { label: 'True Strike', by: 'Wizard', on: 'enemy', melee: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'burst', kind: 'glow', type: 'chosen', count: 8, where: 'casterHand', speed: 10 },
    { at: 0, do: 'outline', who: 'target', color: VIOLET, time: 0.2 },
    { at: 0.05, do: 'pose', who: 'caster', pose: 'windup', time: 0.22, in: 0.7, out: 0.3 },
    { at: 0.22, do: 'pose', who: 'caster', pose: 'strike', time: 0.4, in: 0.2, out: 0.5 },
    { at: 0.05, do: 'swing', blade: 'staff', a0: -1.2, a1: 2.2, contact: 1.0, windup: 0.18, strike: 0.11, hold: 0.18, type: 'chosen' },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 4, time: 0.22, if: HIT },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 14, speed: 40, who: 'target', where: 'chest', away: true, if: HIT },
    struck({ knock: 2 }),
  ]);

  // An orb of the chosen element (its colors come from the damage type the player picks).
  add('chromaticOrb', { label: 'Chromatic Orb', by: 'Wizard', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'chosen', count: 12, where: 'casterHand', speed: 12 },
    { at: 0.05, do: 'light', type: 'chosen', where: 'casterHand', radius: 14, time: 0.4, power: 1.2 },
    { at: 0.22, do: 'projectile', sprite: 'bead', type: 'chosen', speed: 150, trailRate: 80, lightRadius: 18 },
    { at: 0.32, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 6, time: 0.3 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 24, speed: 44, spread: 2 },
    { at: 'hit', do: 'light', type: 'chosen', radius: 30, time: 0.7, power: 1.6 },
    struck({ flash: WHITE, knock: 2 }),
  ]);

  // The orb bounding on from the first target to a second (no one casts it: it flies from the first target).
  add('chromaticOrbLeap', { label: 'Chromatic Orb (leap)', by: 'Wizard', on: 'enemy', roll: 'attack', hidden: true }, [
    { at: 0, do: 'burst', kind: 'glow', type: 'chosen', count: 10, where: 'casterHand', speed: 16 },
    { at: 0.05, do: 'projectile', sprite: 'bead', type: 'chosen', speed: 150, arc: 8, trailRate: 80, lightRadius: 18 },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 6, time: 0.3 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 24, speed: 44, spread: 2 },
    { at: 'hit', do: 'light', type: 'chosen', radius: 30, time: 0.7, power: 1.6 },
    struck({ flash: WHITE, knock: 2 }),
  ]);

  // Three rays of fire, one after another, each with its own roll: a hit bursts and shows its number, a miss says MISS.
  add('scorchingRay', { label: 'Scorching Ray', by: 'Wizard', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    { at: 0.05, do: 'burst', kind: 'ember', count: 10, where: 'casterHand', speed: 14 },
    ...[[0.15, -3], [0.27, 0], [0.39, 3]].map(([at, dy], n) => [
      { at, do: 'projectile', sprite: 'bead', type: 'fire', speed: 230, offset: [0, dy], sure: true, event: 'r' + n, trailRate: 90, lightRadius: 14 },
      { at: 'r' + n, do: 'pop', type: 'fire', radius: 3, time: 0.18, ifPart: n },
      { at: 'r' + n, do: 'burst', kind: 'ember', count: 12, speed: 36, ifPart: n },
      { at: 'r' + n, do: 'flash', who: 'target', color: FIRE, time: 0.05, ifPart: n },
      { at: 'r' + n, do: 'knock', who: 'target', dist: 1, time: 0.2, ifPart: n },
      { at: 'r' + n, do: 'apply', who: 'target', part: n },
      { at: 'r' + n, do: 'popup', text: 'amount', part: n, color: 'damage', zero: 'MISS', dx: (n - 1) * 5 },
    ]),
    { at: 'r2', do: 'pose', who: 'target', pose: 'hit', time: 0.35, if: HIT },
    { at: 'r2', do: 'mark', kind: 'scorch', who: 'target', fade: 8, if: HIT },
  ]);

  // A ringing crack at a point: a white shockwave, stone shards flying, everyone within 10 ft jolted (CON save).
  add('shatter', { label: 'Shatter', by: 'Wizard', on: 'enemy', area: 'sphere', roll: 'save', save: 'CON' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'lightning', count: 8, where: 'casterHand', speed: 12 },
    { at: 0.3, do: 'screenflash', color: [235, 240, 255], strength: 0.3, time: 0.08 },
    { at: 0.3, do: 'hitstop', time: 0.06 },
    { at: 0.3, do: 'ring', type: 'lightning', where: 'point', r0: 3, r1: 22, time: 0.3, thick: 2 },
    { at: 0.3, do: 'pop', type: 'lightning', where: 'point', radius: 8, time: 0.25 },
    { at: 0.3, do: 'burst', kind: 'shard', where: 'point', count: 26, speed: 60, spread: 4 },
    { at: 0.3, do: 'burst', kind: 'dust', where: 'point', count: 14, speed: 30, spread: 6 },
    { at: 0.3, do: 'shake', strength: 2.5, time: 0.35 },
    { at: 0.3, do: 'popup', who: 'caster', text: 'CRACK', color: 'info', above: 6 },
    caught({ at: 0.32, flash: WHITE, knock: 2 }),
  ]);

  // The caster's outline wavers: attacks against them have disadvantage while they concentrate.
  add('blur', { label: 'Blur', by: 'Wizard', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 14, where: 'caster', speed: 16 },
    { at: 0.1, do: 'fade', who: 'caster', to: 0.35, time: 0.7, in: 0.3, out: 0.5 },
    { at: 0.1, do: 'outline', who: 'caster', color: VIOLET, time: 0.5 },
    { at: 0.4, do: 'apply', who: 'caster' },
    { at: 0.4, do: 'popup', who: 'caster', text: 'BLUR', color: [200, 160, 255] },
  ]);

  // Silver mist swallows the caster (combat then moves them and plays mistyStepIn where they land).
  add('mistyStep', { label: 'Misty Step', by: 'Wizard', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.4 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'cold', count: 20, where: 'casterFeet', speed: 16, spread: 3 },
    { at: 0.05, do: 'emit', kind: 'dust', type: 'cold', where: 'casterFeet', rate: 60, time: 0.45, radius: 4, speed: 6 },
    { at: 0.05, do: 'light', type: 'cold', where: 'caster', radius: 14, time: 0.5, power: 1 },
    { at: 0.1, do: 'fade', who: 'caster', to: 0, time: 0.45, in: 0.8, out: 0 },
  ]);
  add('mistyStepIn', { label: 'Misty Step (arriving)', by: 'Wizard', on: 'self', hidden: true }, [
    { at: 0, do: 'fade', who: 'caster', to: 0, time: 0.45, in: 0, out: 0.9 },
    { at: 0, do: 'burst', kind: 'glow', type: 'cold', count: 20, where: 'casterFeet', speed: 16, spread: 3 },
    { at: 0, do: 'emit', kind: 'dust', type: 'cold', where: 'casterFeet', rate: 60, time: 0.35, radius: 4, speed: 6 },
    { at: 0, do: 'light', type: 'cold', where: 'caster', radius: 14, time: 0.5, power: 1 },
  ]);

  // ---------- Cleric ----------

  // Violet light settles on the one touched like a second skin: base AC 13 + Dex.
  add('mageArmor', { label: 'Mage Armor', by: 'Wizard', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 10, where: 'casterHand', speed: 10 },
    { at: 0.2, do: 'bubble', who: 'target', type: 'force', time: 0.7 },
    { at: 0.2, do: 'light', type: 'force', where: 'point', radius: 14, time: 0.7, power: 1 },
    { at: 0.25, do: 'outline', who: 'target', color: VIOLET, time: 0.35 },
    { at: 0.3, do: 'apply', who: 'target' },
    { at: 0.3, do: 'popup', who: 'target', text: 'ARMOR', color: [200, 160, 255] },
  ]);

  // Three shimmering copies split off the caster (Figures draws them drifting round until they're used up).
  add('mirrorImage', { label: 'Mirror Image', by: 'Wizard', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 16, where: 'caster', speed: 22, spread: 2 },
    { at: 0.05, do: 'fade', who: 'caster', to: 0.4, time: 0.5, in: 0.2, out: 0.5 },
    { at: 0.1, do: 'light', type: 'force', where: 'caster', radius: 16, time: 0.6, power: 1 },
    { at: 0.35, do: 'apply', who: 'caster' },
    { at: 0.35, do: 'popup', who: 'caster', text: '3 IMAGES', color: [200, 160, 255] },
  ]);

  // A duplicate takes the blow and bursts into glittering shards.
  add('mirrorImageHit', { label: 'Mirror Image (a duplicate hit)', by: 'Wizard', on: 'self', hidden: true }, [
    { at: 0.25, do: 'burst', kind: 'shard', type: 'force', where: 'caster', count: 14, speed: 36, spread: 3 },
    { at: 0.25, do: 'burst', kind: 'glow', type: 'force', where: 'caster', count: 8, speed: 20 },
    { at: 0.25, do: 'popup', who: 'caster', text: 'IMAGE', color: [200, 160, 255], above: 7 },
  ]);

  // A violet thread runs to a humanoid and binds it: a failed WIS save and it locks rigid (paralyzed).
  add('holdPerson', { label: 'Hold Person', by: 'Wizard', on: 'enemy', roll: 'save', save: 'WIS' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.7 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 8, where: 'casterHand', speed: 12 },
    { at: 0.15, do: 'projectile', sprite: 'dart', type: 'force', speed: 150, sure: true, trailRate: 60, lightRadius: 10 },
    { at: 'hit', do: 'ring', type: 'force', where: 'targetFeet', r0: 10, r1: 3, time: 0.5, thick: 1 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'force', count: 12, speed: 18 },
    { at: 'hit', do: 'light', type: 'force', where: 'target', radius: 16, time: 0.7, power: 1 },
    { at: 'hit', do: 'outline', who: 'target', color: VIOLET, time: 0.9, if: HIT },
    { at: 'hit', do: 'pose', who: 'target', pose: 'shiver', time: 0.6, if: HIT },
    { at: 'hit', do: 'apply', who: 'target', if: HIT },
    { at: 'hit', do: 'popup', text: 'HELD', color: [200, 160, 255], if: HIT },
    { at: 'hit', do: 'popup', text: 'SAVE', color: 'miss', if: 'miss' },
  ]);

  // A swirl of colors hangs in a 30 ft cube for a moment: those who fail the WIS save stand and stare.
  add('hypnoticPattern', { label: 'Hypnotic Pattern', by: 'Wizard', on: 'enemy', area: 'cube', roll: 'save', save: 'WIS' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 1 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'force', count: 10, where: 'casterHand', speed: 12 },
    ...['force', 'fire', 'cold', 'radiant'].map((type, k) => [
      { at: 0.15 + k * 0.08, do: 'emit', kind: 'glow', type, where: 'point', rate: 40, time: 0.9, radius: 26, speed: 3, big: 0.3 },
      { at: 0.15 + k * 0.12, do: 'ring', type, where: 'point', r0: 4 + k * 3, r1: 26, time: 0.7, thick: 1 },
    ]),
    { at: 0.2, do: 'light', type: 'force', where: 'point', radius: 34, time: 1.1, power: 1 },
    { at: 0.9, do: 'pose', who: 'hits', pose: 'shiver', time: 0.5, hitIf: 'failed' },
    { at: 1, do: 'apply', who: 'hits' },
    { at: 1, do: 'popup', who: 'hits', text: 'CHARMED', color: [200, 160, 255], hitIf: 'failed' },
    { at: 1, do: 'popup', who: 'hits', text: 'SAVE', color: 'miss', hitIf: 'saved' },
  ]);

  // A crackle of yellow light runs into a friend, who blurs with speed.
  add('haste', { label: 'Haste', by: 'Wizard', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'lightning', count: 10, where: 'casterHand', speed: 14 },
    { at: 0.15, do: 'projectile', sprite: 'dart', type: 'lightning', speed: 220, sure: true, trailRate: 80, lightRadius: 12 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'lightning', count: 16, speed: 30, spread: 2 },
    { at: 'hit', do: 'emit', kind: 'glow', type: 'lightning', where: 'targetFeet', rate: 40, time: 0.5, radius: 5, speed: 10 },
    { at: 'hit', do: 'light', type: 'lightning', where: 'target', radius: 18, time: 0.6, power: 1.2 },
    { at: 'hit', do: 'outline', who: 'target', color: [255, 240, 150], time: 0.4 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'HASTE', color: 'radiant' },
  ]);

  // A bead of fire lands on the floor and swells into a rolling ball of flame (which then stays, drawn by Fx).
  add('flamingSphere', { label: 'Flaming Sphere', by: 'Wizard', on: 'enemy' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'ember', count: 8, where: 'casterHand', speed: 12 },
    { at: 0.15, do: 'projectile', sprite: 'bead', type: 'fire', to: 'point', speed: 150, arc: 6, sure: true, trailRate: 60, lightRadius: 16 },
    { at: 'hit', do: 'pop', type: 'fire', where: 'point', radius: 6, time: 0.3 },
    { at: 'hit', do: 'burst', kind: 'ember', where: 'point', count: 18, speed: 34, spread: 2 },
    { at: 'hit', do: 'light', type: 'fire', where: 'point', radius: 30, time: 0.5, power: 1.5 },
    { at: 'hit', do: 'mark', kind: 'scorch', where: 'point', fade: 6 },
  ]);

  // The sphere's flames lick out at someone next to it (or that it rolled into): a DEX save, half on a success.
  add('sphereBurn', { label: 'Flaming Sphere (burning)', by: 'Wizard', on: 'enemy', roll: 'save', save: 'DEX', hidden: true }, [
    { at: 0, do: 'burst', kind: 'ember', where: 'point', count: 10, speed: 24 },
    { at: 0.05, do: 'projectile', sprite: 'bead', type: 'fire', from: 'point', speed: 120, sure: true, trailRate: 90, lightRadius: 14 },
    { at: 'hit', do: 'pop', type: 'fire', radius: 5, time: 0.25 },
    { at: 'hit', do: 'burst', kind: 'ember', count: 14, speed: 36, spread: 1 },
    { at: 'hit', do: 'mark', kind: 'scorch', who: 'hits', fade: 8 },
    caught({ at: 'hit', flash: FIRE, knock: 1 }),
  ]);

  add('cureWounds', { label: 'Cure Wounds', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.7 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 6, where: 'casterHand', speed: 8 },
    { at: 0.25, do: 'emit', kind: 'mote', where: 'targetFeet', rate: 40, time: 0.75, radius: 5, speed: 7, big: 0.5 },
    { at: 0.25, do: 'emit', kind: 'heal', where: 'targetFeet', rate: 14, time: 0.6, radius: 4, speed: 5 },
    { at: 0.25, do: 'light', type: 'radiant', where: 'target', radius: 20, time: 1.1, power: 1.2 },
    { at: 0.55, do: 'outline', who: 'target', color: GOLD, time: 0.14 },
    { at: 0.6, do: 'apply', who: 'target' },
    { at: 0.6, do: 'popup', text: 'amount', color: 'heal' },
  ]);

  // A spoken word: a green sparkle arcs to a friend up to 60 ft away.
  add('healingWord', { label: 'Healing Word', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.45 },
    { at: 0.1, do: 'projectile', sprite: 'dart', type: 'healing', speed: 95, arc: 10, sure: true, lightRadius: 10, trailRate: 40 },
    { at: 'hit', do: 'burst', kind: 'heal', count: 12, speed: 18 },
    { at: 'hit', do: 'burst', kind: 'mote', count: 8, speed: 14 },
    { at: 'hit', do: 'light', type: 'healing', radius: 16, time: 0.7, power: 1.1 },
    { at: 'hit', do: 'outline', who: 'target', color: GREEN, time: 0.12 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'amount', color: 'heal' },
  ]);

  // No projectile: a column of light drops onto the target (beside it, if it saves).
  add('sacredFlame', { label: 'Sacred Flame', by: 'Cleric', on: 'enemy', roll: 'save', save: 'DEX' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.7 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 8, where: 'casterHand', speed: 14 },
    { at: 0.28, do: 'column', who: 'target', type: 'radiant', height: 30, time: 0.5, if: HIT },
    { at: 0.28, do: 'column', who: 'target', type: 'radiant', height: 30, time: 0.4, dx: 7, if: 'miss' },
    { at: 0.24, do: 'pose', who: 'target', pose: 'dodge', time: 0.45, if: 'miss' },
    { at: 0.3, do: 'burst', who: 'target', where: 'feet', kind: 'mote', count: 14, speed: 24, if: HIT },
    { at: 0.32, do: 'flash', who: 'target', color: HOLY, time: 0.1, if: HIT },
    { at: 0.32, do: 'pose', who: 'target', pose: 'hit', time: 0.4, if: HIT },
    { at: 0.32, do: 'apply', who: 'target', if: HIT },
    { at: 0.32, do: 'popup', text: 'amount', color: 'damage', if: HIT },
    { at: 0.32, do: 'popup', text: 'SAVE', color: 'miss', if: 'miss' },
  ]);

  // The holy symbol raised: a gold wave rolls out 30 ft; undead it reaches shake, flash, and flee.
  add('turnUndead', { label: 'Turn Undead', by: 'Cleric', on: 'self', area: 'undead', roll: 'save', save: 'WIS' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 1.0 },
    { at: 0.1, do: 'light', type: 'radiant', where: 'caster', radius: 34, time: 1.1, power: 1.7 },
    { at: 0.1, do: 'burst', kind: 'mote', count: 14, where: 'casterHand', speed: 22 },
    { at: 0.2, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 3, r1: 60, time: 0.7, thick: 2 },
    { at: 0.5, do: 'flash', who: 'hits', color: HOLY, time: 0.1, hitIf: 'failed' },
    { at: 0.5, do: 'pose', who: 'hits', pose: 'shiver', time: 0.5 },
    { at: 0.5, do: 'knock', who: 'hits', dist: 2, time: 0.5, hitIf: 'failed' },
    { at: 0.55, do: 'popup', who: 'hits', text: 'TURNED', color: 'radiant', hitIf: 'failed' },
    { at: 0.55, do: 'popup', who: 'hits', text: 'SAVE', color: 'miss', hitIf: 'saved' },
    { at: 0.55, do: 'apply', who: 'hits' },
    { at: 0.6, do: 'popup', who: 'hits', text: 'amount', color: 'damage', hitIf: 'failed', above: 7 },
  ]);

  // A spark of divine light (or of death: the type picked) leaps from the holy symbol: a CON save, half on a save.
  add('divineSpark', { label: 'Divine Spark', by: 'Cleric', on: 'enemy', roll: 'save', save: 'CON' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 10, where: 'casterHand', speed: 14 },
    { at: 0.05, do: 'light', type: 'chosen', where: 'casterHand', radius: 14, time: 0.4, power: 1.2 },
    { at: 0.15, do: 'projectile', sprite: 'bead', type: 'chosen', speed: 170, sure: true, trailRate: 70, lightRadius: 14 },
    { at: 'hit', do: 'pop', type: 'chosen', radius: 5, time: 0.25 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'chosen', count: 16, speed: 30, spread: 1 },
    { at: 'hit', do: 'light', type: 'chosen', radius: 22, time: 0.5, power: 1.4 },
    { at: 'hit', do: 'flash', who: 'target', color: HOLY, time: 0.08 },
    { at: 'hit', do: 'knock', who: 'target', dist: 1.5, time: 0.4, if: HIT },
    { at: 'hit', do: 'pose', who: 'target', pose: 'hit', time: 0.4 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'amount', color: 'damage' },
    { at: 'hit', do: 'popup', text: 'SAVE', color: 'miss', above: 7, if: 'miss' },
  ]);

  // The same spark, healing: a gold-green mote lands on a friend.
  add('divineSparkHeal', { label: 'Divine Spark (heal)', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.5 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 10, where: 'casterHand', speed: 14 },
    { at: 0.15, do: 'projectile', sprite: 'dart', type: 'radiant', speed: 120, arc: 8, sure: true, lightRadius: 12, trailRate: 40 },
    { at: 'hit', do: 'burst', kind: 'heal', count: 14, speed: 18 },
    { at: 'hit', do: 'light', type: 'healing', radius: 18, time: 0.7, power: 1.2 },
    { at: 'hit', do: 'outline', who: 'target', color: GOLD, time: 0.15 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: 'amount', color: 'heal' },
  ]);

  // A flash of light streaks to the target; it stays lit, so the next attack against it has advantage.
  add('guidingBolt', { label: 'Guiding Bolt', by: 'Cleric', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.55 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 10, where: 'casterHand', speed: 16 },
    { at: 0.05, do: 'light', type: 'radiant', where: 'casterHand', radius: 16, time: 0.4, power: 1.3 },
    { at: 0.2, do: 'projectile', sprite: 'bead', type: 'radiant', speed: 170, trailRate: 90, lightRadius: 22 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'radiant', radius: 6, time: 0.3 },
    { at: 'hit', do: 'burst', kind: 'mote', count: 22, speed: 44, spread: 2 },
    { at: 'hit', do: 'light', type: 'radiant', radius: 36, time: 0.9, power: 1.8 },
    { at: 'hit', do: 'outline', who: 'target', color: GOLD, time: 0.6, if: HIT },
    { at: 'hit', do: 'popup', text: 'GUIDED', color: 'radiant', above: 7, if: HIT },
    struck({ flash: HOLY, knock: 2 }),
  ]);

  // A touch that withers: necrotic smoke bursts from the target (CON save: half damage, and it staggers less).
  add('inflictWounds', { label: 'Inflict Wounds', by: 'Cleric', on: 'enemy', melee: true, roll: 'save', save: 'CON' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.35 },
    { at: 0.02, do: 'emit', kind: 'smoke', type: 'necrotic', where: 'casterFeet', rate: 30, time: 0.3, radius: 3, speed: 4 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'necrotic', count: 10, where: 'casterHand', speed: 8 },
    { at: 0.3, do: 'pose', who: 'caster', pose: 'strike', time: 0.4 },
    { at: 0.36, do: 'burst', who: 'target', where: 'chest', kind: 'smoke', type: 'necrotic', count: 18, speed: 26 },
    { at: 0.36, do: 'burst', who: 'target', where: 'chest', kind: 'glow', type: 'necrotic', count: 14, speed: 34, if: HIT },
    { at: 0.36, do: 'light', type: 'necrotic', where: 'target', radius: 18, time: 0.5, power: 1.2 },
    { at: 0.36, do: 'flash', who: 'target', color: DARK, time: 0.08 },
    { at: 0.36, do: 'knock', who: 'target', dist: 1.5, time: 0.4, if: HIT },
    { at: 0.36, do: 'knock', who: 'target', dist: 0.7, time: 0.3, if: 'miss' },
    { at: 0.36, do: 'pose', who: 'target', pose: 'hit', time: 0.4 },
    { at: 0.36, do: 'shake', strength: 1, time: 0.15, if: HIT },
    { at: 0.36, do: 'apply', who: 'target' },
    { at: 0.36, do: 'popup', text: 'amount', color: 'damage' },
    { at: 0.36, do: 'popup', text: 'SAVE', color: 'miss', above: 7, if: 'miss' },
  ]);

  // Gold motes settle on each blessed friend, each lit for a moment.
  add('bless', { label: 'Bless', by: 'Cleric', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.9 },
    { at: 0.05, do: 'light', type: 'radiant', where: 'caster', radius: 26, time: 1.0, power: 1.4 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 12, where: 'casterHand', speed: 18 },
    { at: 0.3, do: 'column', who: 'hits', type: 'radiant', height: 16, time: 0.5 },
    { at: 0.35, do: 'burst', who: 'hits', where: 'chest', kind: 'mote', count: 10, speed: 12 },
    { at: 0.45, do: 'outline', who: 'hits', color: GOLD, time: 0.2 },
    { at: 0.45, do: 'apply', who: 'hits' },
    { at: 0.45, do: 'popup', who: 'hits', text: 'BLESS', color: 'radiant' },
  ]);

  // A shimmering gold shield wraps a friend: +2 AC.
  add('shieldOfFaith', { label: 'Shield of Faith', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    { at: 0.1, do: 'projectile', sprite: 'dart', type: 'radiant', speed: 110, arc: 8, sure: true, lightRadius: 10, trailRate: 40 },
    { at: 'hit', do: 'bubble', who: 'target', type: 'radiant', time: 0.9 },
    { at: 'hit', do: 'light', type: 'radiant', where: 'target', radius: 16, time: 0.8, power: 1.1 },
    { at: 'hit', do: 'outline', who: 'target', color: GOLD, time: 0.15 },
    { at: 'hit', do: 'apply', who: 'target' },
    { at: 'hit', do: 'popup', text: '+2 AC', color: 'radiant' },
  ]);

  // A friend shakes a sleeper by the shoulder.
  // Spiritual Weapon: the spectral hammer (drawn while it lasts) slams down on someone next to it.
  const spiritSlam = [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.5 },
    { at: 0.05, do: 'burst', kind: 'mote', where: 'point', count: 10, speed: 16 },
    { at: 0.25, do: 'pop', type: 'radiant', who: 'target', radius: 5, time: 0.25, if: HIT },
    { at: 0.25, do: 'burst', kind: 'glow', type: 'force', who: 'target', where: 'chest', count: 12, speed: 26, if: HIT },
    { at: 0.25, do: 'light', type: 'radiant', where: 'target', radius: 18, time: 0.4, power: 1.2 },
    struck({ at: 0.25, flash: HOLY, knock: 1.5 }),
  ];
  add('spiritualWeapon', { label: 'Spiritual Weapon', by: 'Cleric', on: 'enemy', roll: 'attack' }, spiritSlam);
  add('spiritualStrike', { label: 'Spiritual Weapon (again)', by: 'Cleric', on: 'enemy', roll: 'attack', hidden: true }, spiritSlam);

  // Preserve Life: a warm ring rolls out from the holy symbol; the bloodied nearby glow and heal.
  add('preserveLife', { label: 'Preserve Life', by: 'Cleric', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.9 },
    { at: 0.1, do: 'light', type: 'healing', where: 'caster', radius: 34, time: 1, power: 1.5 },
    { at: 0.15, do: 'ring', type: 'healing', where: 'casterFeet', r0: 3, r1: 60, time: 0.7, thick: 2 },
    { at: 0.5, do: 'burst', who: 'hits', where: 'feet', kind: 'heal', count: 12, speed: 14 },
    { at: 0.5, do: 'outline', who: 'hits', color: GREEN, time: 0.15 },
    { at: 0.5, do: 'apply', who: 'hits' },
    { at: 0.5, do: 'popup', who: 'hits', text: 'amount', color: 'heal' },
  ]);

  // Aid: gold motes settle on up to three friends: more HP for the fight.
  add('aid', { label: 'Aid', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.7 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 10, where: 'casterHand', speed: 14 },
    { at: 0.3, do: 'burst', who: 'hits', where: 'chest', kind: 'mote', count: 10, speed: 12 },
    { at: 0.35, do: 'outline', who: 'hits', color: GOLD, time: 0.2 },
    { at: 0.35, do: 'apply', who: 'hits' },
    { at: 0.35, do: 'popup', who: 'hits', text: '+5 HP', color: 'heal' },
  ]);

  // Lesser Restoration: a touch, a green glow, and the paralysis lifts.
  add('lesserRestoration', { label: 'Lesser Restoration', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    { at: 0.2, do: 'burst', who: 'target', where: 'chest', kind: 'heal', count: 12, speed: 14 },
    { at: 0.2, do: 'light', type: 'healing', where: 'target', radius: 16, time: 0.6, power: 1 },
    { at: 0.25, do: 'apply', who: 'target' },
    { at: 0.25, do: 'popup', text: 'FREE', color: 'heal' },
  ]);

  // Protection from Evil and Good: a faint gold ward closes round a friend.
  add('protectionFromEvil', { label: 'Protection from Evil', by: 'Paladin', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    { at: 0.2, do: 'bubble', who: 'target', type: 'radiant', time: 0.8 },
    { at: 0.25, do: 'apply', who: 'target' },
    { at: 0.25, do: 'popup', text: 'WARD', color: 'radiant' },
  ]);

  // Sacred Weapon: the longsword flares with holy light (and keeps glowing: the figure carries a light).
  add('sacredWeapon', { label: 'Sacred Weapon', by: 'Paladin', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.1, do: 'burst', kind: 'mote', where: 'casterHand', count: 14, speed: 18 },
    { at: 0.1, do: 'light', type: 'radiant', where: 'casterHand', radius: 30, time: 0.6, power: 1.6 },
    { at: 0.15, do: 'outline', who: 'caster', color: GOLD, time: 0.3 },
    { at: 0.2, do: 'apply', who: 'caster' },
    { at: 0.2, do: 'popup', who: 'caster', text: 'SACRED', color: 'radiant' },
  ]);

  // Steady Aim: the rogue goes still and lines up the shot.
  add('steadyAim', { label: 'Steady Aim', by: 'Rogue', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.5 },
    { at: 0.2, do: 'apply', who: 'caster' },
    { at: 0.2, do: 'popup', who: 'caster', text: 'AIM', color: 'info' },
  ]);

  // Spare the Dying: a soft gold glow settles on a fallen friend: stable.
  add('spareTheDying', { label: 'Spare the Dying', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
    { at: 0.15, do: 'emit', kind: 'mote', where: 'targetFeet', rate: 24, time: 0.5, radius: 4, speed: 4 },
    { at: 0.2, do: 'light', type: 'radiant', where: 'target', radius: 14, time: 0.6, power: 1 },
    { at: 0.35, do: 'apply', who: 'target' },
    { at: 0.35, do: 'popup', text: 'STABLE', color: 'heal' },
  ]);

  // Spirit Guardians: spirits stream out of the holy symbol and take up their circle (drawn while it lasts).
  add('spiritGuardians', { label: 'Spirit Guardians', by: 'Cleric', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.8 },
    { at: 0.1, do: 'burst', kind: 'mote', where: 'casterHand', count: 24, speed: 30, spread: 2 },
    { at: 0.15, do: 'ring', type: 'radiant', where: 'casterFeet', r0: 4, r1: 30, time: 0.6, thick: 1 },
    { at: 0.15, do: 'light', type: 'radiant', where: 'caster', radius: 34, time: 0.8, power: 1.4 },
    { at: 0.4, do: 'apply', who: 'caster' },
    { at: 0.4, do: 'popup', who: 'caster', text: 'SPIRITS', color: 'radiant' },
  ]);

  // A spirit dives at someone in the circle: a WIS save, 3d8 radiant, half on a save.
  add('guardiansBurn', { label: 'Spirit Guardians (strike)', by: 'Cleric', on: 'enemy', roll: 'save', save: 'WIS', hidden: true }, [
    { at: 0, do: 'burst', who: 'hits', where: 'chest', kind: 'mote', count: 12, speed: 24 },
    { at: 0.05, do: 'light', type: 'radiant', where: 'target', radius: 16, time: 0.4, power: 1.2 },
    caught({ at: 0.1, flash: HOLY, knock: 1 }),
  ]);

  // Mass Healing Word: a word, and green light lands on every hurt friend in range.
  add('massHealingWord', { label: 'Mass Healing Word', by: 'Cleric', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'raise', time: 0.6 },
    { at: 0.05, do: 'burst', kind: 'heal', where: 'casterHand', count: 14, speed: 20 },
    { at: 0.3, do: 'burst', who: 'hits', where: 'chest', kind: 'heal', count: 10, speed: 14 },
    { at: 0.3, do: 'outline', who: 'hits', color: GREEN, time: 0.12 },
    { at: 0.3, do: 'apply', who: 'hits' },
    { at: 0.3, do: 'popup', who: 'hits', text: 'amount', color: 'heal' },
  ]);

  // Revivify: a gold column over a fallen friend, who gets up.
  add('revivify', { label: 'Revivify', by: 'Cleric', on: 'ally' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.8 },
    { at: 0.2, do: 'column', who: 'target', type: 'radiant', height: 30, time: 0.6 },
    { at: 0.3, do: 'light', type: 'radiant', where: 'target', radius: 24, time: 0.8, power: 1.5 },
    { at: 0.6, do: 'apply', who: 'target' },
    { at: 0.6, do: 'popup', text: 'ALIVE', color: 'heal' },
  ]);

  add('shakeAwake', { label: 'Shake awake', by: 'Fighter', on: 'ally', hidden: true }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'strike', time: 0.35 },
    { at: 0.15, do: 'pose', who: 'target', pose: 'shiver', time: 0.4 },
    { at: 0.15, do: 'knock', who: 'target', dist: 0.5, time: 0.25 },
    { at: 0.3, do: 'apply', who: 'target' },
    { at: 0.3, do: 'popup', text: 'AWAKE', color: 'info' },
  ]);

  // ---------- Fighter ----------

  add('swordSwing', { label: 'Sword swing', by: 'Fighter', on: 'enemy', melee: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.22, in: 0.7, out: 0.3 },
    { at: 0.17, do: 'pose', who: 'caster', pose: 'strike', time: 0.4, in: 0.2, out: 0.5 },
    { at: 0, do: 'swing', a0: -1.2, a1: 2.2, contact: 1.0, windup: 0.18, strike: 0.11, hold: 0.18, type: 'steel', if: ['hit', 'miss'] },
    { at: 0, do: 'swing', a0: -1.4, a1: 2.4, contact: 1.0, windup: 0.22, strike: 0.1, hold: 0.22, type: 'radiant', if: 'crit' },
    { at: 0.1, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 6, speed: 45, who: 'target', where: 'chest', away: true, cone: 1.6, if: 'hit' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 12, speed: 60, who: 'target', where: 'chest', away: true, cone: 2, if: 'crit' },
    { at: 'hit', do: 'burst', kind: 'dust', count: 4, where: 'targetFeet', speed: 8, if: 'miss' },
    struck({ knock: 2 }),
  ]);

  // A breath and a second wind: a pale green aura and a heal.
  // Action Surge: a deep breath, a flash of red, and back in.
  add('actionSurge', { label: 'Action Surge', by: 'Fighter', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.4 },
    { at: 0.15, do: 'burst', kind: 'dust', where: 'casterFeet', count: 12, speed: 30, spread: 2 },
    { at: 0.15, do: 'outline', who: 'caster', color: [255, 120, 90], time: 0.3 },
    { at: 0.15, do: 'shake', strength: 1, time: 0.15 },
    { at: 0.2, do: 'popup', who: 'caster', text: 'SURGE', color: 'crit' },
  ]);

  add('secondWind', { label: 'Second Wind', by: 'Fighter', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.6 },
    { at: 0.1, do: 'emit', kind: 'heal', where: 'casterFeet', rate: 30, time: 0.5, radius: 4, speed: 6 },
    { at: 0.15, do: 'light', type: 'healing', where: 'caster', radius: 16, time: 0.6, power: 1 },
    { at: 0.3, do: 'outline', who: 'caster', color: [220, 255, 220], time: 0.12 },
    { at: 0.35, do: 'apply', who: 'caster' },
    { at: 0.35, do: 'popup', who: 'caster', text: 'amount', color: 'heal' },
  ]);

  // ---------- Rogue ----------

  // Blurs out, reappears behind the target, two quick red slashes, and darts back.
  add('sneakAttack', { label: 'Sneak Attack', by: 'Rogue', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'fade', who: 'caster', to: 0.2, time: 0.32, in: 0.25, out: 0.4 },
    { at: 1.0, do: 'fade', who: 'caster', to: 0.3, time: 0.26, in: 0.3, out: 0.4 },
    { at: 0.05, do: 'dash', to: 'behind', time: 0.22 },
    { at: 0.3, do: 'swing', blade: 'dagger', a0: -1.0, a1: 2.0, contact: 0.8, windup: 0.05, strike: 0.08, hold: 0.04, type: 'blood', event: 'cut1' },
    { at: 0.47, do: 'swing', blade: 'dagger', a0: -0.4, a1: 2.3, contact: 0.9, windup: 0.04, strike: 0.08, hold: 0.12, type: 'blood' },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.5, if: 'miss' },
    { at: 'cut1', do: 'flash', who: 'target', time: 0.05, if: HIT },
    { at: 'cut1', do: 'knock', who: 'target', dist: 1, time: 0.15, if: HIT },
    { at: 'hit', do: 'burst', kind: 'spark', count: 8, speed: 45, who: 'target', where: 'chest', away: true, type: 'blood', if: HIT },
    struck({ knock: 2, shake: 2, stop: 0.09 }),
    { at: 1.0, do: 'dash', to: 'home', time: 0.22 },
  ]);

  // Hide: the rogue ducks into cover and fades (HIDDEN on a success).
  add('hide', { label: 'Hide', by: 'Rogue', on: 'self' }, [
    { at: 0, do: 'pose', who: 'caster', pose: 'dodge', time: 0.4 },
    { at: 0.05, do: 'fade', who: 'caster', to: 0.45, time: 0.6, in: 0.3, out: 0.5, if: HIT },
    { at: 0.3, do: 'apply', who: 'caster' },
    { at: 0.3, do: 'popup', who: 'caster', text: 'HIDDEN', color: 'info', if: HIT },
    { at: 0.3, do: 'popup', who: 'caster', text: 'SEEN', color: 'miss', if: 'miss' },
  ]);

  add('throwDagger', { label: 'Thrown dagger', by: 'Rogue', on: 'enemy', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.2, in: 0.7 },
    { at: 0.16, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.18, do: 'projectile', sprite: 'dagger', speed: 170 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 5, speed: 35, if: HIT },
    { at: 'hit', do: 'burst', kind: 'dust', count: 4, speed: 10, if: 'miss' },
    struck({ knock: 1 }),
  ]);

  // ---------- Paladin ----------

  // The blade lights gold as it swings and bursts with holy light on the hit: the weapon's number, then the smite's.
  add('divineSmite', { label: 'Divine Smite', by: 'Paladin', on: 'enemy', melee: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.3, in: 0.7, out: 0.3 },
    { at: 0.24, do: 'pose', who: 'caster', pose: 'strike', time: 0.45, in: 0.2, out: 0.5 },
    { at: 0.05, do: 'burst', kind: 'mote', count: 8, where: 'casterHand', speed: 10 },
    { at: 0.05, do: 'light', type: 'radiant', where: 'casterHand', radius: 14, time: 0.4, power: 1.1 },
    { at: 0, do: 'swing', a0: -1.4, a1: 2.3, contact: 1.0, windup: 0.26, strike: 0.11, hold: 0.22, type: 'radiant' },
    { at: 0.15, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    { at: 'hit', do: 'hitstop', time: 0.12, if: 'hit' },
    { at: 'hit', do: 'hitstop', time: 0.22, if: 'crit' },
    { at: 'hit', do: 'pop', type: 'radiant', radius: 5, time: 0.25, if: HIT },
    { at: 'hit', do: 'burst', kind: 'mote', count: 18, speed: 50, if: HIT },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'radiant', count: 12, speed: 80, if: HIT },
    { at: 'hit', do: 'light', type: 'radiant', radius: 32, time: 0.8, power: 1.9, if: HIT },
    { at: 'hit', do: 'flash', who: 'target', color: HOLY, time: 0.1, if: HIT },
    { at: 'hit', do: 'knock', who: 'target', dist: 2.5, time: 0.45, if: HIT },
    { at: 'hit', do: 'pose', who: 'target', pose: 'hit', time: 0.45, if: HIT },
    { at: 'hit', do: 'shake', strength: 2, time: 0.25, if: HIT },
    { at: 'hit', do: 'apply', who: 'target', if: HIT },
    { at: 'hit', do: 'popup', text: 'amount', part: 0, color: 'damage', dx: -3, if: 'hit' },
    { at: 'hit', do: 'popup', text: 'amount', part: 0, color: 'crit', big: true, dx: -3, if: 'crit' },
    { at: 'hit', do: 'popup', text: 'amount', part: 1, plus: true, color: 'radiant', dx: 5, above: 2, delay: 0.12, if: HIT },
    { at: 'hit', do: 'popup', text: 'MISS', color: 'miss', if: 'miss' },
  ]);

  // Dragonborn breath: a breath in (embers at the mouth), then a 15 ft cone of fire.
  add('fireBreath', { label: 'Fire breath', by: 'Paladin', on: 'enemy', area: 'cone', roll: 'save', save: 'DEX' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.45, in: 0.8, out: 0.2 },
    { at: 0.05, do: 'emit', kind: 'ember', where: 'mouth', rate: 20, time: 0.35, radius: 1, speed: 3 },
    { at: 0.42, do: 'pose', who: 'caster', pose: 'strike', time: 0.75, in: 0.1, out: 0.3 },
    { at: 0.45, do: 'cone', kind: 'ember', type: 'fire', rate: 300, time: 0.6, speed: 75, spread: 0.85, length: 30, big: 0.45, lightRadius: 30, lightType: 'fire' },
    { at: 0.5, do: 'shake', strength: 2, time: 0.6 },
    { at: 0.6, do: 'mark', kind: 'scorch', who: 'hits', fade: 10 },
    caught({ at: 0.6, flash: FIRE, knock: 1.5 }),
  ]);

  // The other shape of the breath: a 30 ft line of fire, 5 ft wide (it stops at a wall).
  add('fireBreathLine', { label: 'Fire breath (line)', by: 'Paladin', on: 'enemy', area: 'line', roll: 'save', save: 'DEX' }, [
    { at: 0, do: 'face', only: true },
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.45, in: 0.8, out: 0.2 },
    { at: 0.05, do: 'emit', kind: 'ember', where: 'mouth', rate: 20, time: 0.35, radius: 1, speed: 3 },
    { at: 0.42, do: 'pose', who: 'caster', pose: 'strike', time: 0.75, in: 0.1, out: 0.3 },
    { at: 0.45, do: 'cone', kind: 'ember', type: 'fire', rate: 340, time: 0.6, speed: 210, spread: 0.1, length: 60, big: 0.45, lightRadius: 26, lightType: 'fire' },
    { at: 0.5, do: 'shake', strength: 2, time: 0.6 },
    { at: 0.7, do: 'mark', kind: 'scorch', who: 'hits', fade: 10 },
    caught({ at: 0.7, flash: FIRE, knock: 1.5 }),
  ]);

  // ---------- Monsters ----------

  add('goblinSling', { label: 'Sling', by: 'Goblin 2', group: 'Monsters', on: 'hero', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.4, in: 0.6 },
    { at: 0.32, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.34, do: 'projectile', sprite: 'stone', speed: 150, arc: 6 },
    { at: 0.45, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'shard', count: 6, speed: 25 },
    struck({ knock: 1 }),
  ]);

  add('goblinSpear', { label: 'Spear jab', by: 'Goblin 1', group: 'Monsters', on: 'hero', melee: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.2, in: 0.7 },
    { at: 0.15, do: 'pose', who: 'caster', pose: 'strike', time: 0.35 },
    { at: 0, do: 'thrust', blade: 'spear', reach: 6, windup: 0.16, strike: 0.07, hold: 0.1 },
    { at: 0.1, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 5, speed: 35, who: 'target', where: 'chest', away: true, if: HIT },
    struck({ knock: 1.5 }),
  ]);

  // The goblin minion's dagger: a quick stab, or thrown (20/60 ft).
  add('goblinDagger', { label: 'Dagger stab', by: 'Goblin 1', group: 'Monsters', on: 'hero', melee: true, roll: 'attack', hidden: true }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.16, in: 0.7 },
    { at: 0.12, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0, do: 'thrust', blade: 'dagger', reach: 5, windup: 0.12, strike: 0.06, hold: 0.08 },
    { at: 0.08, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 4, speed: 30, who: 'target', where: 'chest', away: true, if: HIT },
    struck({ knock: 1 }),
  ]);
  add('goblinThrow', { label: 'Thrown dagger', by: 'Goblin 2', group: 'Monsters', on: 'hero', roll: 'attack', hidden: true }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.2, in: 0.7 },
    { at: 0.16, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.18, do: 'projectile', sprite: 'dagger', speed: 170 },
    { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 5, speed: 35, if: HIT },
    struck({ knock: 1 }),
  ]);

  // The goblin boss's scimitar: a quick curved slash (Multiattack plays it twice).
  add('bossScimitar', { label: 'Scimitar', by: 'Goblin Boss', group: 'Monsters', on: 'hero', melee: true, roll: 'attack', hidden: true }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.18, in: 0.7 },
    { at: 0.14, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0, do: 'swing', blade: 'sword', a0: -1.0, a1: 2.0, contact: 0.9, windup: 0.14, strike: 0.09, hold: 0.12, type: 'steel' },
    { at: 0.08, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 5, speed: 35, who: 'target', where: 'chest', away: true, if: HIT },
    struck({ knock: 1.5 }),
  ]);

  // Stiff and jerky: the swing moves in a few big steps.
  add('skeletonSword', { label: 'Rusty sword', by: 'Skeleton', group: 'Monsters', on: 'hero', melee: true, roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.25, in: 0.8 },
    { at: 0.2, do: 'pose', who: 'caster', pose: 'strike', time: 0.35 },
    { at: 0, do: 'swing', blade: 'rusty', a0: -1.2, a1: 2.0, contact: 0.9, windup: 0.22, strike: 0.12, hold: 0.2, steps: 4, type: 'stone' },
    { at: 0.12, do: 'pose', who: 'target', pose: 'dodge', time: 0.4, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'spark', count: 5, speed: 35, who: 'target', where: 'chest', away: true, if: HIT },
    struck({ knock: 1.5 }),
  ]);

  add('skeletonArrow', { label: 'Bone arrow', by: 'Skeleton', group: 'Monsters', on: 'hero', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'windup', time: 0.4, in: 0.8 },
    { at: 0.36, do: 'projectile', sprite: 'arrow', speed: 190 },
    { at: 0.45, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'dust', count: 4, speed: 12, if: 'miss' },
    struck({ knock: 1 }),
  ]);

  // The slime squashes and spits a glob of acid that splashes and leaves a sizzling puddle.
  add('slimeAcid', { label: 'Acid spit', by: 'Slime', group: 'Monsters', on: 'hero', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'inhale', time: 0.4, in: 0.8 },
    { at: 0.35, do: 'pose', who: 'caster', pose: 'strike', time: 0.3 },
    { at: 0.36, do: 'projectile', sprite: 'blob', type: 'acid', speed: 110, arc: 12, trailRate: 30 },
    { at: 0.5, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'burst', kind: 'drop', count: 14, speed: 30 },
    { at: 'hit', do: 'mark', kind: 'acid', who: 'target', fade: 6, if: HIT },
    { at: 'hit', do: 'mark', kind: 'acid', where: 'impact', fade: 6, if: 'miss' },
    struck({ flash: ACID, knock: 1 }),
  ]);

  add('cultistBolt', { label: 'Dark bolt', by: 'Cultist', group: 'Monsters', on: 'hero', roll: 'attack' }, [
    { at: 0, do: 'face' },
    { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.55 },
    { at: 0.05, do: 'burst', kind: 'glow', type: 'necrotic', count: 8, where: 'casterHand', speed: 12 },
    { at: 0.22, do: 'projectile', sprite: 'bead', type: 'necrotic', speed: 150, trail: 'glow', trailRate: 50, lightRadius: 12 },
    { at: 0.35, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
    { at: 'hit', do: 'pop', type: 'necrotic', radius: 3.5, time: 0.25 },
    { at: 'hit', do: 'burst', kind: 'glow', type: 'necrotic', count: 12, speed: 35 },
    struck({ flash: DARK }),
  ]);

  return { add, get, list, restyle, struck, caught };
})();
