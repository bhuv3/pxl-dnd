// Conditions on a creature (docs/dnd-game/rules.md section 7): what a spell leaves behind, how long it lasts, and what it
// changes. Each is { id, by (the caster), ends ('startOfBy' | 'endOfBy': the caster's turn; 'startOfSelf': its own
// next turn; 'never'), skip (turns of that kind to let pass first: "the end of your NEXT turn"), next (with
// 'endOfSelf': not the turn it was put on, if that was its own: Haste's lethargy) }; they live in creature.effects. Concentration (one spell at a time, broken by a failed
// CON save when hurt) is creature.concentration: { spell, on: [creatures] }. Rules only: no figures, no screen.
const Conditions = (() => {
  // What each condition is called and does. ac: added to AC; speed: feet off; incapacitated: no actions, bonus
  // actions, or reactions, and it loses its own concentration; blessed: +1d4 to attacks and saves; guided: the next
  // attack roll against it has advantage; drowsy: Sleep's first failed save (another save at the end of its next
  // turn, or it falls asleep); asleep: unconscious until hurt or shaken; shocked: no opportunity attacks; chilled:
  // can't regain HP; blurred: attacks against it have disadvantage; vexed: the attacker's next attack against it
  // has advantage (Vex); sapped: its next attack roll has disadvantage (Sap); paralyzed: Hold Person (helpless:
  // fails STR and DEX saves, attacks against it have advantage and crit from within 5 ft; repeat: the save it makes
  // again at the end of each of its turns); entranced: Hypnotic Pattern's charm (incapacitated, speed 0; damage or
  // a shake ends it); hasted: Haste (speed doubled, +2 AC, advantage on DEX saves, an extra action; after: what's
  // left when the spell ends); lethargic: after Haste; mageArmor: base AC 13 + Dex; mirrored: Mirror Image's
  // duplicates (images left); sphere: the caster's Flaming Sphere (sq: its square; not shown over anyone); turned:
  // Turn Undead (it flees on its turns; damage ends it); hidden: Hide (total: the Stealth check an enemy must
  // reach; attacks against it have disadvantage, its own advantage); aiming: Steady Aim (its next attack this turn
  // has advantage); aided: Aid (amount: added to the HP maximum, taken off again when it ends); warded: Protection
  // from Evil and Good (fey, undead, fiends... attack it at disadvantage); sacredWeapon: + Cha to weapon attacks;
  // spiritual: the caster's Spiritual Weapon (sq: where it floats; not shown over anyone); guardians: Spirit
  // Guardians round the caster (struck: who has saved against them on which turn); poisoned: disadvantage on attack
  // rolls and checks (a rogue's Cunning Strike: dc, saved against again at the end of each turn); prone: its
  // attacks at disadvantage, attacks from next to it at advantage, from farther at disadvantage; it gets up at the
  // start of its turn for half its movement.
  // still: speed 0; as: the 2024 condition it counts as, for immunities (the slime can't be charmed).
  const KINDS = {
    drowsy:  { name: 'drowsy (incapacitated)', short: 'DROWSY', color: 'force', concentration: true, incapacitated: true },
    asleep:  { name: 'asleep', short: 'ZZ', color: 'force', concentration: true, incapacitated: true },
    slowed:  { name: 'slowed', short: 'SLOW', color: 'cold', speed: 10 },
    guided:  { name: 'lit by a Guiding Bolt', short: 'GUIDED', color: 'radiant' },
    blessed: { name: 'blessed', short: 'BLESS', color: 'radiant', concentration: true },
    faith:   { name: 'shielded by faith', short: '+2 AC', color: 'radiant', ac: 2, concentration: true },
    shocked: { name: 'shocked (no opportunity attacks)', short: 'SHOCK', color: 'lightning' },
    chilled: { name: 'chilled (no healing)', short: 'CHILL', color: 'necrotic' },
    blurred: { name: 'blurred', short: 'BLUR', color: 'force', concentration: true },
    vexed:   { name: 'vexed', short: 'VEX', color: 'steel' },
    sapped:  { name: 'sapped', short: 'SAP', color: 'steel' },
    paralyzed: { name: 'paralyzed', short: 'HELD', color: 'force', concentration: true, incapacitated: true, helpless: true, still: true, repeat: 'wis', as: 'paralyzed' },
    entranced: { name: 'charmed by the pattern (incapacitated)', short: 'CHARMED', color: 'force', concentration: true, incapacitated: true, still: true, as: 'charmed' },
    hasted:    { name: 'hasted', short: 'HASTE', color: 'lightning', ac: 2, concentration: true, double: true, after: 'lethargic' },
    lethargic: { name: 'lethargic (incapacitated)', short: 'SLUGGISH', color: 'lightning', incapacitated: true, still: true },
    mageArmor: { name: 'in Mage Armor', short: 'ARMOR', color: 'force', base: 13 },
    mirrored:  { name: 'three duplicates appear', short: e => 'IMAGES ' + e.images, color: 'force' },
    sphere:    { name: 'tending a Flaming Sphere', short: null, color: 'fire', concentration: true },
    turned:    { name: 'turned (frightened, fleeing)', short: 'TURNED', color: 'radiant', incapacitated: true, as: 'frightened' },
    hidden:    { name: 'hidden', short: 'HIDDEN', color: 'steel' },
    aiming:    { name: 'taking steady aim', short: 'AIM', color: 'steel' },
    aided:     { name: 'aided (+5 HP maximum)', short: 'AID', color: 'radiant' },
    warded:    { name: 'warded from evil', short: 'WARD', color: 'radiant', concentration: true },
    sacredWeapon: { name: 'wielding a sacred weapon', short: 'SACRED', color: 'radiant' },
    spiritual: { name: 'directing a Spiritual Weapon', short: null, color: 'force', concentration: true },
    guardians: { name: 'surrounded by Spirit Guardians', short: 'SPIRITS', color: 'radiant', concentration: true },
    poisoned:  { name: 'poisoned', short: 'POISON', color: 'acid', repeat: 'con', as: 'poisoned' },
    prone:     { name: 'prone', short: 'PRONE', color: 'steel', as: 'prone' },
  };

  const list = c => c.effects || (c.effects = []);
  const has = (c, id) => list(c).some(e => e.id === id);
  const get = (c, id) => list(c).find(e => e.id === id);

  // Puts a condition on (replacing the same one).
  function add(c, id, o = {}) {
    remove(c, id);
    list(c).push({ id, ...o });
  }
  function remove(c, id) { c.effects = list(c).filter(e => e.id !== id); }

  // AC (Mage Armor's base instead of the sheet's), speed, and whether the creature can act, with its conditions.
  function ac(c) {
    const base = list(c).find(e => KINDS[e.id].base);
    return (base ? KINDS[base.id].base + Creatures.mod(c.abilities.dex) : c.ac) + list(c).reduce((t, e) => t + (KINDS[e.id].ac || 0), 0);
  }
  function speed(c) {
    if (list(c).some(e => KINDS[e.id].still)) return 0;
    const feet = Math.max(0, c.speed - list(c).reduce((t, e) => t + (KINDS[e.id].speed || 0), 0));
    return list(c).some(e => KINDS[e.id].double) ? feet * 2 : feet;
  }
  const asleep = c => has(c, 'asleep');
  const incapacitated = c => list(c).some(e => KINDS[e.id].incapacitated);
  // The first condition keeping it from acting (for the log).
  const why = c => (KINDS[(list(c).find(e => KINDS[e.id].incapacitated) || {}).id] || {}).name;
  // Asleep or paralyzed: fails STR and DEX saves; attacks against it have advantage, and crit from within 5 ft.
  const helpless = c => asleep(c) || list(c).some(e => KINDS[e.id].helpless);
  // Under Sleep, drowsy or asleep: a friend can shake it out of the spell.
  const sleeping = c => has(c, 'asleep') || has(c, 'drowsy');
  // Out of it in a way a friend's shake ends: Sleep, or Hypnotic Pattern's charm.
  const shakeable = c => sleeping(c) || has(c, 'entranced');

  // Conditions that end when a creature's turn starts or ends: the ones it timed (Ray of Frost's slow, a Guiding
  // Bolt's light) on everyone, and its own (Shocking Grasp's shock). Returns the lines to log. At its turn's start
  // its own conditions are marked seen, so one that lasts "until the end of its next turn" (next) knows whether
  // this turn counts.
  function turnStart(c, everyone) { for (const e of list(c)) e.seen = true; return tick(c, everyone, 'startOfBy'); }
  function turnEnd(c, everyone) { return tick(c, everyone, 'endOfBy'); }
  function tick(c, everyone, when) {
    const lines = [];
    const own = when.replace('By', 'Self');
    for (const o of everyone) {
      for (const e of [...list(o)]) {
        if (!((e.by === c && e.ends === when) || (o === c && e.ends === own))) continue;
        if (e.skip > 0) { e.skip--; continue; }
        if (e.next && !e.seen) continue;
        remove(o, e.id);
        lines.push(`${o.label} is no longer ${KINDS[e.id].name}.`);
      }
    }
    return lines;
  }

  // Starts concentrating on a spell's conditions (ending any other one first). Returns lines to log.
  function concentrate(c, spell, on, everyone) {
    const lines = c.concentration ? drop(c, everyone) : [];
    c.concentration = { spell, on };
    return lines;
  }

  // Ends concentration: the spell's conditions come off everyone it was on, leaving what they leave behind
  // (Haste's lethargy, which in turn ends that creature's own concentration).
  function drop(c, everyone, why) {
    const k = c.concentration;
    if (!k) return [];
    c.concentration = null;
    const lines = [`${c.label}'s ${k.spell} ends${why ? ' (' + why + ')' : ''}.`];
    for (const o of everyone) for (const e of [...list(o)]) {
      if (e.by !== c || !KINDS[e.id].concentration) continue;
      remove(o, e.id);
      const after = KINDS[e.id].after;
      if (!after || o.slain || o.hp <= 0) continue;
      add(o, after, { by: c, ends: 'endOfSelf', next: true });
      lines.push(`${o.label} is ${KINDS[after].name} until the end of its next turn.`);
      if (KINDS[after].incapacitated && o.concentration) lines.push(...drop(o, everyone, 'incapacitated'));
    }
    return lines;
  }

  // Takes a spell's condition off one creature (it saved, woke, was shaken); the caster stops concentrating if
  // nobody is under the spell any more. Returns lines to log.
  function release(c, id, everyone) {
    const e = get(c, id);
    if (!e) return [];
    remove(c, id);
    const by = e.by;
    if (KINDS[id].concentration && by && by.concentration && !everyone.some(o => list(o).some(x => x.by === by && KINDS[x.id].concentration))) return drop(by, everyone);
    return [];
  }

  // Everything off at the end of a fight (the simplification: spell durations don't carry into exploring); Aid's
  // extra HP maximum goes with it.
  function clear(c) {
    const aid = get(c, 'aided');
    if (aid) { c.maxHp -= aid.amount; c.hp = Math.min(c.hp, c.maxHp); }
    c.effects = []; c.concentration = null;
  }

  // The labels to show over a figure: { short, color }.
  const shown = c => list(c).filter(e => KINDS[e.id].short).map(e => { const k = KINDS[e.id]; return { short: typeof k.short === 'function' ? k.short(e) : k.short, color: k.color }; });

  // Can it take a reaction (Shield)? An opportunity attack too (not while shocked)?
  const canReact = c => c.reaction && !incapacitated(c);
  const canOpportunity = c => canReact(c) && !has(c, 'shocked');

  return { KINDS, add, remove, has, get, ac, speed, asleep, sleeping, shakeable, helpless, incapacitated, why, canReact, canOpportunity, turnStart, turnEnd, concentrate, drop, release, clear, shown };
})();
