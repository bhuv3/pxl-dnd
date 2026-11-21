// What each action does in rules terms (the 2024 rules, SRD 5.2: docs/dnd-game/rules.md, docs/dnd-game/classes.md). Ids match the
// effects in Spells, so an action and its animation share a name. kinds:
//   attack:   an attack roll with a weapon on the sheet (with) or a spell attack (with: 'spell'); extra dice on a hit
//   auto:     always hits (Magic Missile's darts)
//   save:     targets roll a save against the spell DC (dc: 'spell') or the breath DC; half on a save if half
//   heal:     restores HP (heal dice, plus the spellcasting modifier or the level: plus)
//   turn:     undead roll a Wisdom save or are turned
//   reaction: Shield: the attacker's own attack (opts.with) against the wizard, who gets +5 AC if it would hit
//   sleep:    a Wisdom save or drowsy (Sleep); creatures that don't sleep are unaffected
//   buff:     puts a condition (adds) on the targets
//   wake:     shakes a sleeping friend awake
//   rays:     several attack rolls (rays) at one target, each with its own damage (Scorching Ray)
//   teleport: moves the caster to a square (Misty Step); no roll
//   condition: targets roll a save (save) or get a condition (adds); no damage (Hold Person, Hypnotic Pattern)
//   sphere:   makes a Flaming Sphere on a square (sphereMove rolls it; sphereBurn is its fire)
//   surge:    Action Surge: the action comes back (combat)
//   hide:     a DC 15 Stealth check to be hidden (combat checks no enemy can see you)
//   preserve: Preserve Life: a pool of healing shared among bloodied friends (pool: times the level)
//   aid:      Aid: + hp to the HP maximum and HP of each target
//   restore:  Lesser Restoration: ends a condition (ends) on a friend
//   stabilize: Spare the Dying: a creature at 0 HP becomes stable
//   revive:   Revivify: a friend who died this fight comes back with 1 HP
// For combat: cost ('action' by default, 'bonus', or 'free'), range (feet; 'melee' = 5 ft reach; long: the far range with
// disadvantage), target ('enemy' by default, 'self', 'ally', 'party': up to max allies in range, nearest first,
// 'sleeper': a sleeping friend), slot (spell level it uses), uses (a limited feature), repeat (attacks per action:
// Multiattack), area ('cone' from the caster toward a square, 'around' the caster on every side (a cube centred
// on it), 'circle' round a square in range, 'line' from the caster toward a square; size in feet), choose (an
// area spell that catches only the creatures the caster chooses: Sleep, so never friends), adds (a condition a
// hit or buff leaves: Conditions), push (feet, on a failed save), concentration, types (damage types the player
// picks from: Chromatic Orb, True Strike), spellAbility (a weapon attack made with the spellcasting ability: True
// Strike), leap (Chromatic Orb: matching damage dice send it on to a second target), smite (Divine Smite: the
// slot and the bonus action are spent only on a hit), only (who it works on: 'humanoid', or 'unarmored' for Mage
// Armor, 'dying' for Spare the Dying; fits() checks), area 'cube' (a cube on a square in range), 'roll' (where the caster's sphere can roll),
// 'aura' (every square within size feet of the caster: Turn Undead), others (not on yourself: Divine Spark), plus
// on a save (the spellcasting modifier added to the damage), free (a use that can stand in for the slot:
// Paladin's Smite), cantrip (Potent Cantrip), summon (Spiritual Weapon: the attack comes from a spectral weapon
// placed by the target; spiritualStrike moves it and attacks again), target 'bloodied' (friends within range at half
// their HP or less, the caster too), hurt (a 'party' of the most hurt friends, the fallen too: Mass Healing Word),
// upgrade ({ 5: { damage } }: what changes at a level: cantrips, the breath; at() applies it).
const Actions = (() => {
  const ACTIONS = {
    fireBolt:      { kind: 'attack', with: 'spell', name: 'Fire Bolt', damage: '1d10', type: 'fire', range: 120 , cantrip: true, upgrade: { 5: { damage: '2d10' } } },
    magicMissile:  { kind: 'auto', name: 'Magic Missile', darts: 3, damage: '1d4+1', type: 'force', range: 120, slot: 1 },
    fireball:      { kind: 'save', name: 'Fireball', save: 'dex', dc: 'spell', damage: '8d6', type: 'fire', half: true, area: 'circle', size: 20, range: 150, slot: 3 },
    lightningBolt: { kind: 'save', name: 'Lightning Bolt', save: 'dex', dc: 'spell', damage: '8d6', type: 'lightning', half: true, area: 'line', size: 100, slot: 3 },
    shield:        { kind: 'reaction', name: 'Shield', ac: 5 },
    acidSplash:    { kind: 'save', name: 'Acid Splash', save: 'dex', dc: 'spell', damage: '1d6', type: 'acid', half: false, area: 'circle', size: 5, range: 60 , cantrip: true, upgrade: { 5: { damage: '2d6' } } },
    poisonSpray:   { kind: 'attack', with: 'spell', name: 'Poison Spray', damage: '1d12', type: 'poison', range: 30 , cantrip: true, upgrade: { 5: { damage: '2d12' } } },
    shockingGrasp: { kind: 'attack', with: 'spell', name: 'Shocking Grasp', damage: '1d8', type: 'lightning', range: 'melee', adds: { id: 'shocked', ends: 'startOfSelf' } , cantrip: true, upgrade: { 5: { damage: '2d8' } } },
    chillTouch:    { kind: 'attack', with: 'spell', name: 'Chill Touch', damage: '1d10', type: 'necrotic', range: 'melee', adds: { id: 'chilled', ends: 'endOfBy', skip: 1 } , cantrip: true, upgrade: { 5: { damage: '2d10' } } },
    trueStrike:    { kind: 'attack', with: 'quarterstaff', spellAbility: true, name: 'True Strike', types: ['radiant', 'bludgeoning'], type: 'radiant', range: 'melee', cantrip: true, upgrade: { 5: { extra: { damage: '1d6', type: 'radiant' } } } },
    chromaticOrb:  { kind: 'attack', with: 'spell', name: 'Chromatic Orb', damage: '3d8', type: 'fire', types: ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder'], range: 90, slot: 1, leap: 30 },
    scorchingRay:  { kind: 'rays', name: 'Scorching Ray', rays: 3, damage: '2d6', type: 'fire', range: 120, slot: 2 },
    shatter:       { kind: 'save', name: 'Shatter', save: 'con', dc: 'spell', damage: '3d8', type: 'thunder', half: true, area: 'circle', size: 10, range: 60, slot: 2 },
    blur:          { kind: 'buff', name: 'Blur', adds: { id: 'blurred', ends: 'never' }, target: 'self', concentration: true, slot: 2 },
    mistyStep:     { kind: 'teleport', name: 'Misty Step', area: 'spot', range: 30, cost: 'bonus', slot: 2 },
    mageArmor:     { kind: 'buff', name: 'Mage Armor', adds: { id: 'mageArmor', ends: 'never' }, target: 'ally', only: 'unarmored', range: 'melee', slot: 1 },
    holdPerson:    { kind: 'condition', name: 'Hold Person', save: 'wis', adds: { id: 'paralyzed', ends: 'never' }, only: 'humanoid', range: 60, slot: 2, concentration: true },
    mirrorImage:   { kind: 'buff', name: 'Mirror Image', adds: { id: 'mirrored', ends: 'never', images: 3 }, target: 'self', slot: 2 },
    flamingSphere: { kind: 'sphere', name: 'Flaming Sphere', area: 'spot', range: 60, slot: 2, concentration: true },
    sphereMove:    { kind: 'sphere', name: 'Roll the sphere', area: 'roll', size: 30, cost: 'bonus' },
    sphereBurn:    { kind: 'save', name: 'Flaming Sphere', save: 'dex', dc: 'spell', damage: '2d6', type: 'fire', half: true },
    hypnoticPattern: { kind: 'condition', name: 'Hypnotic Pattern', save: 'wis', adds: { id: 'entranced', ends: 'never' }, area: 'cube', size: 30, range: 120, slot: 3, concentration: true },
    haste:         { kind: 'buff', name: 'Haste', adds: { id: 'hasted', ends: 'never' }, target: 'ally', range: 30, slot: 3, concentration: true },
    rayOfFrost:    { kind: 'attack', with: 'spell', name: 'Ray of Frost', damage: '1d8', type: 'cold', range: 60, adds: { id: 'slowed', ends: 'startOfBy' } , cantrip: true, upgrade: { 5: { damage: '2d8' } } },
    burningHands:  { kind: 'save', name: 'Burning Hands', save: 'dex', dc: 'spell', damage: '3d6', type: 'fire', half: true, area: 'cone', size: 15, slot: 1 },
    thunderwave:   { kind: 'save', name: 'Thunderwave', save: 'con', dc: 'spell', damage: '2d8', type: 'thunder', half: true, area: 'around', size: 15, push: 10, slot: 1 },
    sleep:         { kind: 'sleep', name: 'Sleep', save: 'wis', area: 'circle', size: 5, range: 60, choose: true, slot: 1, concentration: true },
    cureWounds:    { kind: 'heal', name: 'Cure Wounds', heal: '2d8', plus: 'spell', range: 'melee', slot: 1, target: 'ally' },
    healingWord:   { kind: 'heal', name: 'Healing Word', heal: '2d4', plus: 'spell', range: 60, cost: 'bonus', slot: 1, target: 'ally' },
    sacredFlame:   { kind: 'save', name: 'Sacred Flame', save: 'dex', dc: 'spell', damage: '1d8', type: 'radiant', half: false, range: 60 , cantrip: true, upgrade: { 5: { damage: '2d8' } } },
    guidingBolt:   { kind: 'attack', with: 'spell', name: 'Guiding Bolt', damage: '4d6', type: 'radiant', range: 120, slot: 1, adds: { id: 'guided', ends: 'endOfBy', skip: 1 } },
    inflictWounds: { kind: 'save', name: 'Inflict Wounds', save: 'con', dc: 'spell', damage: '2d10', type: 'necrotic', half: true, range: 'melee', slot: 1 },
    bless:         { kind: 'buff', name: 'Bless', adds: { id: 'blessed', ends: 'never' }, target: 'party', max: 3, range: 30, slot: 1, concentration: true },
    shieldOfFaith: { kind: 'buff', name: 'Shield of Faith', adds: { id: 'faith', ends: 'never' }, target: 'ally', range: 60, cost: 'bonus', slot: 1, concentration: true },
    spareTheDying: { kind: 'stabilize', name: 'Spare the Dying', range: 15, target: 'ally', only: 'dying', others: true, upgrade: { 5: { range: 30 } } },
    spiritGuardians: { kind: 'buff', name: 'Spirit Guardians', adds: { id: 'guardians', ends: 'never' }, target: 'self', size: 15, slot: 3, concentration: true },
    guardiansBurn: { kind: 'save', name: 'Spirit Guardians', save: 'wis', dc: 'spell', damage: '3d8', type: 'radiant', half: true },
    massHealingWord: { kind: 'heal', name: 'Mass Healing Word', heal: '2d4', plus: 'spell', target: 'party', hurt: true, max: 6, range: 60, cost: 'bonus', slot: 3 },
    revivify:      { kind: 'revive', name: 'Revivify', target: 'ally', only: 'dead', range: 'melee', slot: 3 },
    shakeAwake:    { kind: 'wake', name: 'Shake awake', range: 'melee', target: 'sleeper' },
    turnUndead:    { kind: 'turn', name: 'Turn Undead', save: 'wis', dc: 'spell', area: 'aura', size: 30, choose: true, uses: 'channelDivinity' },
    divineSpark:   { kind: 'save', name: 'Divine Spark', save: 'con', dc: 'spell', damage: '1d8', plus: 'spell', types: ['radiant', 'necrotic'], type: 'radiant', half: true, range: 30, uses: 'channelDivinity' },
    divineSparkHeal: { kind: 'heal', name: 'Divine Spark (heal)', heal: '1d8', plus: 'spell', range: 30, target: 'ally', others: true, uses: 'channelDivinity' },
    actionSurge:   { kind: 'surge', name: 'Action Surge', cost: 'free', target: 'self', uses: 'actionSurge' },
    hide:          { kind: 'hide', name: 'Hide', cost: 'bonus', target: 'self', dc: 15 },
    steadyAim:     { kind: 'buff', name: 'Steady Aim', adds: { id: 'aiming', ends: 'endOfSelf' }, cost: 'bonus', target: 'self' },
    spiritualWeapon: { kind: 'attack', with: 'spell', name: 'Spiritual Weapon', damage: '1d8', plus: 'spell', type: 'force', range: 65, cost: 'bonus', slot: 2, concentration: true, summon: true },
    spiritualStrike: { kind: 'attack', with: 'spell', name: 'Spiritual Weapon', damage: '1d8', plus: 'spell', type: 'force', range: 25, cost: 'bonus', summon: true },
    preserveLife:  { kind: 'preserve', name: 'Preserve Life', pool: 5, range: 30, target: 'bloodied', uses: 'channelDivinity' },
    aid:           { kind: 'aid', name: 'Aid', hp: 5, target: 'party', max: 3, range: 30, slot: 2 },
    lesserRestoration: { kind: 'restore', name: 'Lesser Restoration', ends: ['paralyzed'], target: 'ally', range: 'melee', cost: 'bonus', slot: 2 },
    sacredWeapon:  { kind: 'buff', name: 'Sacred Weapon', adds: { id: 'sacredWeapon', ends: 'never' }, cost: 'free', target: 'self', uses: 'channelDivinity' },
    protectionFromEvil: { kind: 'buff', name: 'Protection from Evil and Good', adds: { id: 'warded', ends: 'never' }, target: 'ally', range: 'melee', slot: 1, concentration: true },
    swordSwing:    { kind: 'attack', with: 'longsword', range: 'melee' },
    secondWind:    { kind: 'heal', name: 'Second Wind', heal: '1d10', plus: 'level', feature: true, cost: 'bonus', target: 'self', uses: 'secondWind' },
    sneakAttack:   { kind: 'attack', with: 'shortsword', extra: { damage: 'sneak', type: 'piercing' }, name: 'Sneak Attack', range: 'melee' },
    throwDagger:   { kind: 'attack', with: 'dagger', name: 'Thrown dagger' },
    divineSmite:   { kind: 'attack', with: 'longsword', extra: { damage: '2d8', vs: ['undead', 'fiend'], more: '1d8', type: 'radiant' }, split: true, name: 'Divine Smite', range: 'melee', slot: 1, smite: true, free: 'paladinsSmite' },
    fireBreath:    { kind: 'save', name: 'Fire breath', save: 'dex', dc: 'breath', damage: '1d10', type: 'fire', half: true, area: 'cone', size: 15, uses: 'breath', upgrade: { 5: { damage: '2d10' } } },
    fireBreathLine: { kind: 'save', name: 'Fire breath (line)', save: 'dex', dc: 'breath', damage: '1d10', type: 'fire', half: true, area: 'line', size: 30, uses: 'breath', upgrade: { 5: { damage: '2d10' } } },
    goblinSling:   { kind: 'attack', with: 'sling', range: 30, long: 120 },
    goblinSpear:   { kind: 'attack', with: 'spear', range: 'melee' },
    goblinDagger:  { kind: 'attack', with: 'dagger', range: 'melee' },
    goblinThrow:   { kind: 'attack', with: 'dagger', name: 'Thrown dagger', range: 20, long: 60 },
    bossScimitar:  { kind: 'attack', with: 'scimitar', range: 'melee', repeat: 2, name: 'Multiattack' },
    skeletonSword: { kind: 'attack', with: 'shortsword' },
    skeletonArrow: { kind: 'attack', with: 'shortbow' },
    slimeAcid:     { kind: 'attack', with: 'acidSpit' },
    cultistBolt:   { kind: 'attack', with: 'darkBolt' },
  };

  function get(id) { const a = ACTIONS[id]; if (!a) throw new Error('No action ' + id); return { id, ...a }; }

  // Whether an action can work on a creature at all: Hold Person on a Humanoid, Mage Armor on someone in no armor.
  function fits(A, c) {
    if (A.only === 'humanoid') return (c.tags || []).includes('humanoid');
    if (A.only === 'unarmored') return !!c.unarmored;
    if (A.only === 'dying') return c.hp <= 0 && !c.slain && !c.stable;
    if (A.only === 'dead') return c.slain && c.hero;
    return true;
  }

  // An action as a creature of this level has it: the upgrades for its level and below laid over it.
  function at(A, level = 1) {
    if (!A.upgrade) return A;
    return Object.entries(A.upgrade).filter(([l]) => level >= +l).reduce((a, [, u]) => ({ ...a, ...u }), A);
  }

  return { ACTIONS, get, at, fits };
})();
