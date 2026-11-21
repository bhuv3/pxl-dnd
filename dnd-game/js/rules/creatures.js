// Character sheets and stat blocks: the five level 1 heroes (docs/dnd-game/classes.md) and the monsters (docs/dnd-game/monsters.md),
// as data, plus ability modifiers, proficiency, and saving throw bonuses (the 2024 rules, SRD 5.2). Attack bonuses
// and damage already include the modifiers, as on a sheet. actions / reactions: what combat offers (ids in
// Actions); slots: spell slots by level; uses: limited features at their most (refilled by rests); traits: species
// traits, feats, and class features that change rolls or turns (lucky, alert, savageAttacker, trance,
// dwarvenToughness, tacticalMind, cunningAction, improvedCritical, remarkableAthlete, potentCantrip, discipleOfLife,
// extraAttack, tacticalShift, searUndead, cunningStrike, uncannyDodge). A weapon's mastery
// (vex, sap) is on the sheet only for heroes who have it; a hero's weapon names its ability when it isn't Strength
// (finesse and thrown: dex). acDex: the armor's AC adds the full Dex modifier (light armor, none). advDamage: a monster's extra damage when its attack roll
// had advantage. tags: creature types that spells care about (humanoid, undead, fey, fiend). unarmored: wears no
// armor (Mage Armor works). immune: damage types, and conditions it can't have (charmed). senses: blindsight
// (Mirror Image doesn't fool it).
const Creatures = (() => {
  const HEROES = {
    fighter: { name: 'Fighter', level: 1, race: 'Human', background: 'Soldier', abilities: { str: 17, dex: 13, con: 15, int: 8, wis: 12, cha: 10 },
      tags: ['humanoid'], hp: 12, ac: 19, speed: 30, saves: ['str', 'con'], skills: ['athletics', 'intimidation', 'perception', 'insight'], hitDie: 'd10',
      traits: ['savageAttacker', 'alert'], uses: { secondWind: 2 }, actions: ['swordSwing', 'secondWind'],
      attacks: { longsword: { name: 'Longsword', bonus: 5, damage: '1d8+3', type: 'slashing', mastery: 'sap' } } },
    wizard: { name: 'Wizard', level: 1, race: 'Elf (high elf)', background: 'Sage', abilities: { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 },
      tags: ['humanoid'], unarmored: true, hp: 8, ac: 12, speed: 30, saves: ['int', 'wis'], skills: ['arcana', 'investigation', 'perception'], hitDie: 'd6', spell: { ability: 'int', attack: 5, dc: 13 }, slots: { 1: 2 },
      traits: ['trance', 'feyAncestry'], uses: { arcaneRecovery: 1 }, actions: ['fireBolt', 'rayOfFrost', 'shockingGrasp', 'magicMissile', 'burningHands', 'thunderwave', 'sleep'], reactions: ['shield'],
      attacks: { quarterstaff: { name: 'Quarterstaff', bonus: 1, damage: '1d6-1', type: 'bludgeoning' },
        dagger: { name: 'Dagger', bonus: 4, damage: '1d4+2', type: 'piercing', range: '20/60', ability: 'dex' } }, acDex: true },
    cleric: { name: 'Cleric', level: 1, race: 'Dwarf', background: 'Acolyte', abilities: { str: 13, dex: 10, con: 14, int: 8, wis: 17, cha: 13 },
      tags: ['humanoid'], hp: 11, ac: 18, speed: 30, saves: ['wis', 'cha'], skills: ['insight', 'religion', 'medicine', 'persuasion'], hitDie: 'd8', resist: ['poison'], traits: ['dwarvenToughness'],
      spell: { ability: 'wis', attack: 5, dc: 13 }, slots: { 1: 2 }, actions: ['sacredFlame', 'guidingBolt', 'bless', 'shieldOfFaith', 'healingWord', 'cureWounds'],
      attacks: { mace: { name: 'Mace', bonus: 3, damage: '1d6+1', type: 'bludgeoning' } } },
    rogue: { name: 'Rogue', level: 1, race: 'Halfling', background: 'Criminal', abilities: { str: 8, dex: 17, con: 15, int: 12, wis: 13, cha: 10 },
      tags: ['humanoid'], hp: 10, ac: 14, speed: 30, saves: ['dex', 'int'], skills: ['stealth', 'sleightOfHand', 'perception', 'acrobatics', 'investigation', 'deception'], expertise: ['stealth', 'perception'],
      hitDie: 'd8', traits: ['lucky', 'alert'], sneak: '1d6', actions: ['sneakAttack', 'throwDagger'],
      attacks: { shortsword: { name: 'Shortsword', bonus: 5, damage: '1d6+3', type: 'piercing', mastery: 'vex', ability: 'dex' },
        dagger: { name: 'Dagger', bonus: 5, damage: '1d4+3', type: 'piercing', range: '20/60', ability: 'dex' } }, acDex: true },
    paladin: { name: 'Paladin', level: 1, race: 'Dragonborn (red)', background: 'Soldier', abilities: { str: 17, dex: 10, con: 14, int: 8, wis: 12, cha: 14 },
      tags: ['humanoid'], hp: 12, ac: 18, speed: 30, saves: ['wis', 'cha'], skills: ['athletics', 'intimidation', 'religion', 'persuasion'], hitDie: 'd10', resist: ['fire'], traits: ['savageAttacker'],
      spell: { ability: 'cha', attack: 4, dc: 12 }, slots: { 1: 2 }, breath: { dc: 12, type: 'fire', save: 'dex' }, uses: { breath: 2 },
      actions: ['swordSwing', 'divineSmite', 'fireBreath', 'fireBreathLine', 'bless'],
      attacks: { longsword: { name: 'Longsword', bonus: 5, damage: '1d8+3', type: 'slashing', mastery: 'sap' } } },
  };
  const MONSTERS = {
    goblin: { name: 'Goblin', block: 'Goblin Warrior', cr: '1/4', xp: 50, abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 }, hp: 10, ac: 15, speed: 30,
      tags: ['fey'], actions: ['goblinSpear', 'goblinSling'], traits: ['nimble'],
      attacks: { scimitar: { name: 'Scimitar', bonus: 4, damage: '1d6+2', type: 'slashing', advDamage: '1d4' },
        spear: { name: 'Spear', bonus: 4, damage: '1d6+2', type: 'piercing', advDamage: '1d4' },
        sling: { name: 'Sling', bonus: 4, damage: '1d4+2', type: 'bludgeoning', range: '30/120', advDamage: '1d4' },
        shortbow: { name: 'Shortbow', bonus: 4, damage: '1d6+2', type: 'piercing', range: '80/320', advDamage: '1d4' } } },
    goblinMinion: { name: 'Goblin Minion', cr: '1/8', xp: 25, abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 }, hp: 7, ac: 12, speed: 30,
      tags: ['fey'], actions: ['goblinDagger', 'goblinThrow'], traits: ['nimble'],
      attacks: { dagger: { name: 'Dagger', bonus: 4, damage: '1d4+2', type: 'piercing', range: '20/60' } } },
    goblinBoss: { name: 'Goblin Boss', cr: '1', xp: 200, abilities: { str: 10, dex: 15, con: 10, int: 10, wis: 8, cha: 10 }, hp: 21, ac: 17, speed: 30,
      tags: ['fey'], actions: ['bossScimitar'], traits: ['nimble'], skills: ['stealth'],
      attacks: { scimitar: { name: 'Scimitar', bonus: 4, damage: '1d6+2', type: 'slashing', advDamage: '1d4' },
        shortbow: { name: 'Shortbow', bonus: 4, damage: '1d6+2', type: 'piercing', range: '80/320', advDamage: '1d4' } } },
    skeleton: { name: 'Skeleton', cr: '1/4', xp: 50, abilities: { str: 10, dex: 16, con: 15, int: 6, wis: 8, cha: 5 }, hp: 13, ac: 14, speed: 30,
      tags: ['undead'], vulnerable: ['bludgeoning'], immune: ['poison'],
      attacks: { shortsword: { name: 'Shortsword', bonus: 5, damage: '1d6+3', type: 'piercing' },
        shortbow: { name: 'Shortbow', bonus: 5, damage: '1d6+3', type: 'piercing', range: '80/320' } } },
    slime: { name: 'Slime', cr: '1/2', xp: 100, abilities: { str: 12, dex: 6, con: 16, int: 1, wis: 6, cha: 2 }, hp: 22, ac: 9, speed: 10,
      resist: ['acid', 'cold', 'fire'], immune: ['charmed'], senses: ['blindsight'],
      attacks: { pseudopod: { name: 'Pseudopod', bonus: 3, damage: '2d8+1', type: 'acid' },
        acidSpit: { name: 'Acid spit', bonus: 3, damage: '2d6', type: 'acid', range: '20' } } },
    cultist: { name: 'Cultist', cr: '1/8', xp: 25, abilities: { str: 11, dex: 12, con: 10, int: 10, wis: 11, cha: 10 }, hp: 9, ac: 12, speed: 30, saves: ['wis'], tags: ['humanoid'],
      attacks: { sickle: { name: 'Ritual sickle', bonus: 3, damage: '1d4+1', type: 'slashing', extra: { damage: '1', type: 'necrotic' } },
        darkBolt: { name: 'Dark bolt', bonus: 3, damage: '1d8', type: 'necrotic', range: '60' } } },
  };

  function mod(score) { return Math.floor((score - 10) / 2); }
  function prof(level = 1) { return level >= 5 ? 3 : 2; }

  // A fresh creature from its sheet: full HP, every use left. label: the name shown in logs ("Goblin 2").
  function make(id, label) {
    const src = HEROES[id] || MONSTERS[id];
    if (!src) throw new Error('No sheet for ' + id);
    return { id, ...structuredClone(src), label: label || src.name, maxHp: src.hp, hero: !!HEROES[id], maxUses: structuredClone(src.uses || {}), maxSlots: structuredClone(src.slots || {}) };
  }

  // Saving throw bonus: the ability modifier, plus proficiency if the creature is proficient in that save.
  function saveBonus(c, ability) { return mod(c.abilities[ability]) + ((c.saves || []).includes(ability) ? prof(c.level) : 0); }

  // Skill bonus (docs/dnd-game/rules.md section 3): the skill's ability modifier, plus proficiency if trained (twice it with
  // Expertise).
  const SKILL_ABILITY = { athletics: 'str', acrobatics: 'dex', sleightOfHand: 'dex', stealth: 'dex', arcana: 'int', investigation: 'int',
    religion: 'int', insight: 'wis', medicine: 'wis', perception: 'wis', deception: 'cha', intimidation: 'cha', persuasion: 'cha' };
  function skillBonus(c, skill) {
    const trained = (c.skills || []).includes(skill) ? ((c.expertise || []).includes(skill) ? 2 : 1) : 0;
    return mod(c.abilities[SKILL_ABILITY[skill]]) + trained * prof(c.level);
  }
  // Passive Perception: 10 + the Perception bonus.
  function passive(c) { return 10 + skillBonus(c, 'perception'); }

  // Up a level (docs/dnd-game/classes.md): more HP (the hit die's average + Con, +1 for a dwarf), a hit die back, and what
  // the level gives each class (LEVELS: slots, limited uses, actions, traits, Expertise); fully rested. Returns the
  // line to show.
  const AVERAGE = { d6: 4, d8: 5, d10: 6 };
  const LEVELS = {
    2: {
      fighter: { uses: { actionSurge: 1 }, actions: ['actionSurge'], traits: ['tacticalMind'], feature: 'Action Surge (one more action, once per short rest) and Tactical Mind' },
      wizard: { slots: { 1: 3 }, actions: ['chromaticOrb'], expertise: 'arcana', feature: 'a third spell slot, Chromatic Orb prepared, Scholar (Expertise in Arcana)' },
      cleric: { slots: { 1: 3 }, uses: { channelDivinity: 2 }, actions: ['inflictWounds', 'divineSpark', 'divineSparkHeal', 'turnUndead'], feature: 'a third spell slot, Inflict Wounds prepared, Channel Divinity twice per rest: Divine Spark and Turn Undead' },
      rogue: { actions: ['hide'], traits: ['cunningAction'], feature: 'Cunning Action: Dash, Disengage, or Hide as a bonus action' },
      paladin: { uses: { paladinsSmite: 1 }, actions: ['sacredFlame', 'cureWounds', 'shieldOfFaith'], feature: 'Blessed Warrior (Sacred Flame), Paladin\'s Smite (one free Divine Smite a long rest), Cure Wounds and Shield of Faith prepared' },
    },
    3: {
      fighter: { traits: ['improvedCritical', 'remarkableAthlete'], feature: 'Champion: Improved Critical (crits on 19–20) and Remarkable Athlete' },
      wizard: { slots: { 1: 4, 2: 2 }, actions: ['scorchingRay'], traits: ['potentCantrip'], feature: 'Evoker: Potent Cantrip; 2nd-level slots; Scorching Ray prepared' },
      cleric: { slots: { 1: 4, 2: 2 }, actions: ['spiritualWeapon', 'aid', 'lesserRestoration', 'preserveLife'], traits: ['discipleOfLife'], feature: 'Life Domain: Disciple of Life, Preserve Life, Aid and Lesser Restoration; 2nd-level slots; Spiritual Weapon prepared' },
      rogue: { sneak: '2d6', actions: ['steadyAim'], feature: 'Thief; Sneak Attack 2d6; Steady Aim' },
      paladin: { slots: { 1: 3 }, uses: { channelDivinity: 2 }, actions: ['sacredWeapon', 'protectionFromEvil'], feature: 'Oath of Devotion: Channel Divinity (Sacred Weapon), Protection from Evil and Good; a third spell slot' },
    },
    4: {
      fighter: { improve: { str: 2 }, uses: { secondWind: 3 }, feature: 'Ability Score Improvement (Strength 19); Second Wind three times' },
      wizard: { improve: { int: 2 }, slots: { 1: 4, 2: 3 }, actions: ['acidSplash', 'mistyStep'], feature: 'Ability Score Improvement (Intelligence 19); a third 2nd-level slot; Acid Splash and Misty Step' },
      cleric: { improve: { wis: 2 }, slots: { 1: 4, 2: 3 }, actions: ['spareTheDying', 'holdPerson'], feature: 'Ability Score Improvement (Wisdom 19); a third 2nd-level slot; Spare the Dying and Hold Person' },
      rogue: { improve: { dex: 2 }, feature: 'Ability Score Improvement (Dexterity 19)' },
      paladin: { improve: { str: 2 }, feature: 'Ability Score Improvement (Strength 19)' },
    },
    5: {
      fighter: { traits: ['extraAttack', 'tacticalShift'], feature: 'Extra Attack and Tactical Shift; proficiency +3' },
      wizard: { slots: { 1: 4, 2: 3, 3: 2 }, actions: ['fireball', 'haste'], feature: '3rd-level slots; Fireball and Haste prepared; cantrips stronger; proficiency +3' },
      cleric: { slots: { 1: 4, 2: 3, 3: 2 }, traits: ['searUndead'], actions: ['spiritGuardians', 'massHealingWord', 'revivify'], feature: 'Sear Undead; 3rd-level slots; Spirit Guardians, Mass Healing Word and Revivify; cantrips stronger; proficiency +3' },
      rogue: { sneak: '3d6', traits: ['cunningStrike', 'uncannyDodge'], feature: 'Sneak Attack 3d6, Cunning Strike, Uncanny Dodge; proficiency +3' },
      paladin: { slots: { 1: 4, 2: 2 }, uses: { breath: 3 }, traits: ['extraAttack'], actions: ['aid'], feature: 'Extra Attack; 2nd-level slots; Aid prepared; the breath 2d10, three times; proficiency +3' },
    },
  };
  function levelUp(c) {
    c.level = (c.level || 1) + 1;
    const gain = AVERAGE[c.hitDie] + mod(c.abilities.con) + ((c.traits || []).includes('dwarvenToughness') ? 1 : 0);
    c.maxHp += gain;
    c.hp = c.maxHp;
    c.hitDice = c.level;
    const up = (LEVELS[c.level] || {})[c.id];
    if (up && up.slots) c.maxSlots = { ...c.maxSlots, ...up.slots };
    if (up && up.uses) c.maxUses = { ...(c.maxUses || {}), ...up.uses };
    if (up && up.actions) c.actions = [...(c.actions || []), ...up.actions.filter(a => !(c.actions || []).includes(a))];
    if (up && up.traits) c.traits = [...(c.traits || []), ...up.traits];
    if (up && up.expertise) c.expertise = [...(c.expertise || []), up.expertise];
    if (up && up.sneak) c.sneak = up.sneak;
    if (up && up.improve) for (const [ability, n] of Object.entries(up.improve)) improve(c, ability, n);
    const dp = prof(c.level) - prof(c.level - 1);              // level 5: proficiency +3 on everything it adds to
    if (dp && c.hero) {
      for (const w of Object.values(c.attacks || {})) w.bonus += dp;
      if (c.spell) { c.spell.attack += dp; c.spell.dc += dp; }
      if (c.breath) c.breath.dc += dp;
    }
    c.slots = structuredClone(c.maxSlots || {});
    c.uses = structuredClone(c.maxUses || {});
    return `${c.label} reaches level ${c.level}: +${gain} HP (${c.maxHp})${up ? '. ' + up.feature : ''}.`;
  }

  // The Ability Score Improvement: an ability goes up (to 20 at most), and every number on the sheet that comes from
  // its modifier with it: weapon attacks and damage that use it, the spell attack and DC, AC with light armor or
  // none (Dex). Saves, skills, and initiative are worked out from the scores already.
  function improve(c, ability, n) {
    const before = mod(c.abilities[ability]);
    c.abilities[ability] = Math.min(20, c.abilities[ability] + n);
    const d = mod(c.abilities[ability]) - before;
    if (!d) return;
    for (const w of Object.values(c.attacks || {})) {
      if ((w.ability || 'str') !== ability) continue;
      w.bonus += d;
      w.damage = w.damage.replace(/^(\d*d\d+)([+-]\d+)?$/, (m, dice, plus) => { const k = (+plus || 0) + d; return dice + (k ? (k > 0 ? '+' : '') + k : ''); });
    }
    if (c.spell && c.spell.ability === ability) { c.spell.attack += d; c.spell.dc += d; }
    if (ability === 'dex' && c.acDex) c.ac += d;
  }

  // What a short rest gives back: one use of Second Wind and of Channel Divinity, all of Action Surge (breath
  // and slots wait for a long rest). A wizard's Arcane Recovery (once per long rest) brings back spent slots worth
  // up to half the level, rounded up, the highest that fit first. Returns lines to log.
  const SHORT_REST = { secondWind: 1, channelDivinity: 1, actionSurge: 99 };   // a paladin's Channel Divinity too
  function shortRest(c) {
    for (const [k, n] of Object.entries(SHORT_REST)) if (c.uses && k in c.uses) c.uses[k] = Math.min(c.maxUses[k], c.uses[k] + n);
    if (!(c.uses && c.uses.arcaneRecovery > 0)) return [];
    let budget = Math.ceil((c.level || 1) / 2);
    const back = [];
    for (const lvl of Object.keys(c.maxSlots || {}).map(Number).sort((a, b) => b - a)) {
      while (lvl <= budget && c.slots[lvl] < c.maxSlots[lvl]) { c.slots[lvl]++; budget -= lvl; back.push(lvl); }
    }
    if (!back.length) return [];
    c.uses.arcaneRecovery--;
    return [`  ${c.label} studies the spellbook (Arcane Recovery): ${back.length === 1 ? 'a level ' + back[0] + ' slot' : back.length + ' slots'} back.`];
  }

  return { HEROES, MONSTERS, SKILL_ABILITY, LEVELS, make, mod, prof, saveBonus, skillBonus, passive, levelUp, improve, shortRest };
})();
