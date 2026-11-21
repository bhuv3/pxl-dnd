// Rules tests: loads the rules (and the editor's Random) into a sandbox and checks dice, odds, saves, damage
// types, and every action. Run: node tests/dnd-game/rules-test.js
const fs = require('fs'), vm = require('vm');
const root = require('path').join(__dirname, '..', '..') + '/';
const ctx = { structuredClone, console };
vm.createContext(ctx);
for (const f of ['map-editor/js/core/random.js', 'dnd-game/js/rules/dice.js', 'dnd-game/js/rules/creatures.js', 'dnd-game/js/rules/actions.js', 'dnd-game/js/rules/conditions.js', 'dnd-game/js/rules/rules.js'])
  vm.runInContext(fs.readFileSync(root + f, 'utf8') + '\n;globalThis.__x = 1;', ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);
const out = run(`(() => {
  const ok = [], bad = [], check = (name, cond, info) => (cond ? ok : bad).push(name + (cond ? '' : ' :: ' + JSON.stringify(info)));
  const rng = Dice.rng(7);
  // Dice
  check('parse 2d6+3', JSON.stringify(Dice.parse('2d6+3')) === '{"count":2,"sides":6,"plus":3}');
  check('parse d20', Dice.parse('d20').count === 1);
  let min = 99, max = 0; for (let i = 0; i < 5000; i++) { const t = Dice.roll('2d6+3', rng).total; min = Math.min(min, t); max = Math.max(max, t); }
  check('2d6+3 range 5..15', min === 5 && max === 15, [min, max]);
  check('crit doubles dice', Dice.roll('1d8+5', rng, true).rolls.length === 2);
  let adv = 0, dis = 0, nrm = 0; for (let i = 0; i < 20000; i++) { adv += Dice.d20(rng, { mode: 'adv' }).value; dis += Dice.d20(rng, { mode: 'dis' }).value; nrm += Dice.d20(rng).value; }
  check('adv mean ~13.8', Math.abs(adv / 20000 - 13.82) < 0.2, adv / 20000);
  check('dis mean ~7.2', Math.abs(dis / 20000 - 7.18) < 0.2, dis / 20000);
  check('normal mean ~10.5', Math.abs(nrm / 20000 - 10.5) < 0.2, nrm / 20000);
  let ones = 0; for (let i = 0; i < 20000; i++) if (Dice.d20(rng, { lucky: true }).value === 1) ones++;
  check('lucky: 1s ~0.25%', ones / 20000 < 0.006, ones / 20000);
  // Modifiers and saves
  check('mod 15 = +2, 8 = -1', Creatures.mod(15) === 2 && Creatures.mod(8) === -1);
  const fighter = Creatures.make('fighter'), goblin = Creatures.make('goblin', 'Goblin 1'), wizard = Creatures.make('wizard');
  check('fighter CON save +4', Creatures.saveBonus(fighter, 'con') === 4);
  check('goblin DEX save +2', Creatures.saveBonus(goblin, 'dex') === 2);
  // Fighter vs goblin: needs 10+ on d20 (bonus 5, AC 15) -> 55% hit, 5% crit; longsword 1d8+3
  let hits = 0, crits = 0, dmgOk = true; for (let i = 0; i < 20000; i++) { const r = Rules.resolve('swordSwing', fighter, [goblin], { rng }); if (r.outcome !== 'miss') hits++; if (r.outcome === 'crit') crits++; const a = r.hits[0].amount; if (r.outcome === 'hit' && (a < 4 || a > 11)) dmgOk = false; if (r.outcome === 'crit' && (a < 5 || a > 19)) dmgOk = false; }
  check('fighter hit rate ~55%', Math.abs(hits / 20000 - 0.55) < 0.015, hits / 20000);
  check('crit rate ~5%', Math.abs(crits / 20000 - 0.05) < 0.007, crits / 20000);
  check('longsword damage ranges', dmgOk);
  // Forced outcomes
  for (const f of ['hit', 'miss', 'crit']) { let good = true; for (let i = 0; i < 300; i++) if (Rules.resolve('swordSwing', fighter, [goblin], { rng, force: f }).outcome !== f) good = false; check('force ' + f, good); }
  // Magic Missile: 3 darts of 1d4+1, always hits
  const mm = Rules.resolve('magicMissile', wizard, [goblin], { rng });
  check('magic missile 3 parts 2..5', mm.hits[0].parts.length === 3 && mm.hits[0].parts.every(p => p >= 2 && p <= 5) && mm.outcome === 'hit', mm.hits[0]);
  // Fireball: one damage roll, half on a save
  const g2 = Creatures.make('goblin', 'Goblin 2'), cult = Creatures.make('cultist');
  const fb = Rules.resolve('fireball', wizard, [g2, cult], { rng });
  const full = fb.hits.find(h => !h.saved), half = fb.hits.find(h => h.saved);
  check('fireball two hits', fb.hits.length === 2 && fb.rolls.length === 2);
  if (full && half) check('fireball half on save', half.amount === Math.floor(full.amount / 2), fb.hits);
  // Resistances
  const skel = Creatures.make('skeleton'), slime = Creatures.make('slime'), paladin = Creatures.make('paladin');
  check('skeleton vulnerable to bludgeoning', Rules.adjust(skel, 5, 'bludgeoning').amount === 10);
  check('skeleton immune to poison', Rules.adjust(skel, 5, 'poison').amount === 0);
  check('slime resists acid', Rules.adjust(slime, 7, 'acid').amount === 3);
  const br = Rules.resolve('fireBreath', paladin, [skel], { rng, force: 'hit' });
  check('breath DC 12, save failed when forced hit', br.rolls[0].vs === 'DC 12' && br.rolls[0].success === false, br.rolls[0]);
  // Divine Smite vs undead: parts [weapon, smite incl. +1d8]
  const ds = Rules.resolve('divineSmite', paladin, [skel], { rng, force: 'hit' });
  check('smite split parts, smite 3..24', ds.hits[0].parts.length === 2 && ds.hits[0].parts[1] >= 3 && ds.hits[0].parts[1] <= 24, ds.hits[0]);
  // Shield: hits between AC and AC+4 are blocked (wizard AC 12)
  let blocked = 0, through = 0, n = 0; for (let i = 0; i < 5000; i++) { const r = Rules.resolve('shield', skel, [wizard], { rng, with: 'shortbow' }); const t = r.rolls[0].total, nat = r.rolls[0].d20.value; if (r.shielded) { blocked++; if (!(t >= 12 && t < 17 && nat !== 20)) n++; } if (r.outcome !== 'miss') { through++; if (!(t >= 17 || nat === 20)) n++; } }
  check('shield blocks 12..16 only', n === 0 && blocked > 0 && through > 0, { blocked, through, n });
  // Turn undead, heal, sacred flame on a save
  const tu = Rules.resolve('turnUndead', Creatures.make('cleric'), [skel], { rng, force: 'hit' });
  check('turn undead forced: turned', tu.hits[0].turned === true && tu.outcome === 'hit');
  const sf = Rules.resolve('sacredFlame', Creatures.make('cleric'), [goblin], { rng, force: 'miss' });
  check('sacred flame saved: 0 damage, miss', sf.hits[0].amount === 0 && sf.outcome === 'miss', sf);
  const cw = Rules.resolve('cureWounds', Creatures.make('cleric'), [fighter], { rng });
  check('cure wounds 2d8+3: 5..19', cw.hits[0].heal && cw.hits[0].amount >= 5 && cw.hits[0].amount <= 19 && cw.log[0].includes('2d8+3'), cw.log);
  // Every action resolves
  const cast = { Wizard: wizard, Cleric: Creatures.make('cleric'), Fighter: fighter, Rogue: Creatures.make('rogue'), Paladin: paladin };
  const by = { fireBolt: 'Wizard', magicMissile: 'Wizard', fireball: 'Wizard', lightningBolt: 'Wizard', rayOfFrost: 'Wizard', burningHands: 'Wizard', thunderwave: 'Wizard', sleep: 'Wizard', acidSplash: 'Wizard', poisonSpray: 'Wizard', shockingGrasp: 'Wizard', chillTouch: 'Wizard', trueStrike: 'Wizard', chromaticOrb: 'Wizard', scorchingRay: 'Wizard', shatter: 'Wizard', blur: 'Wizard', mistyStep: 'Wizard', mageArmor: 'Wizard', holdPerson: 'Wizard', mirrorImage: 'Wizard', flamingSphere: 'Wizard', sphereMove: 'Wizard', sphereBurn: 'Wizard', hypnoticPattern: 'Wizard', haste: 'Wizard', divineSpark: 'Cleric', divineSparkHeal: 'Cleric', actionSurge: 'Fighter', hide: 'Rogue', steadyAim: 'Rogue', spiritualWeapon: 'Cleric', spiritualStrike: 'Cleric', preserveLife: 'Cleric', aid: 'Cleric', lesserRestoration: 'Cleric', sacredWeapon: 'Paladin', protectionFromEvil: 'Paladin', spareTheDying: 'Cleric', spiritGuardians: 'Cleric', guardiansBurn: 'Cleric', massHealingWord: 'Cleric', revivify: 'Cleric', cureWounds: 'Cleric', healingWord: 'Cleric', sacredFlame: 'Cleric', turnUndead: 'Cleric', guidingBolt: 'Cleric', inflictWounds: 'Cleric', bless: 'Cleric', shieldOfFaith: 'Cleric', shakeAwake: 'Fighter', swordSwing: 'Fighter', secondWind: 'Fighter', sneakAttack: 'Rogue', throwDagger: 'Rogue', divineSmite: 'Paladin', fireBreath: 'Paladin', fireBreathLine: 'Paladin' };
  const minion = Creatures.make('goblinMinion');
  const mon = { goblinSling: goblin, goblinSpear: goblin, goblinDagger: minion, goblinThrow: minion, bossScimitar: Creatures.make('goblinBoss'), skeletonSword: skel, skeletonArrow: skel, slimeAcid: slime, cultistBolt: cult };
  let all = true; for (const id of Object.keys(Actions.ACTIONS)) { if (id === 'shield') continue; try { const actor = cast[by[id]] || mon[id], tgt = mon[id] ? fighter : (['heal', 'buff', 'teleport', 'preserve', 'aid', 'restore', 'revive'].includes(Actions.get(id).kind) ? fighter : Creatures.make('goblin')); const r = Rules.resolve(id, actor, [tgt], { rng }); if (!r.log.length) all = false; } catch (e) { all = false; bad.push(id + ': ' + e.message); } }
  check('every action resolves with a log', all);
  // Death saves: 10+ succeeds, natural 20 revives, natural 1 is two failures
  const ds20 = Rules.deathSave(fighter, { rng, fixed: 20 }).result, ds1 = Rules.deathSave(fighter, { rng, fixed: 1 }).result;
  const ds10 = Rules.deathSave(fighter, { rng, fixed: 10 }).result, ds9 = Rules.deathSave(fighter, { rng, fixed: 9 }).result;
  check('death saves 20 / 1 / 10 / 9', ds20 === 'revive' && ds1 === 'fail2' && ds10 === 'success' && ds9 === 'fail', [ds20, ds1, ds10, ds9]);
  // A hit on an unconscious target is a crit
  let allCrit = true; for (let i = 0; i < 200; i++) { const r = Rules.resolve('goblinSpear', goblin, [wizard], { rng, force: 'hit', autoCrit: true }); if (r.outcome !== 'crit') allCrit = false; }
  check('autoCrit turns hits into crits', allCrit);
  // Skills and checks: fighter Athletics +5, cleric passive Perception 13
  check('fighter athletics +5', Creatures.skillBonus(fighter, 'athletics') === 5);
  check('cleric passive perception 13', Creatures.passive(Creatures.make('cleric')) === 13);
  const ck = Rules.check(fighter, 'athletics', 12, { rng, fixed: 7 });
  check('check 7 + 5 = 12 vs DC 12 succeeds', ck.total === 12 && ck.success, ck);
  // Level 2: fighter +8 HP (6 + Con 2), wizard 3 slots, cleric +8 (5 + 2 + dwarf 1), 2 Channel Divinity
  const lf = Creatures.make('fighter'), lw = Creatures.make('wizard'), lc = Creatures.make('cleric');
  Creatures.levelUp(lf); Creatures.levelUp(lw); Creatures.levelUp(lc);
  check('level 2: fighter 20 HP, wizard 3 slots, cleric 19 HP', lf.maxHp === 20 && lf.level === 2 && lw.slots[1] === 3 && lc.maxHp === 19 && lc.uses.channelDivinity === 2, [lf.maxHp, lw.slots, lc.maxHp, lc.uses]);
  check('level 2: fighter keeps 2 Second Winds, gets Action Surge', lf.uses.secondWind === 2 && lf.uses.actionSurge === 1, lf.uses);
  check('level 2: wizard Scholar, Arcana +7', Creatures.skillBonus(lw, 'arcana') === 7);
  const sw = Rules.resolve('secondWind', fighter, [fighter], { rng });
  check('second wind 1d10+1: 2..11, "uses"', sw.hits[0].amount >= 2 && sw.hits[0].amount <= 11 && sw.log[0].includes('uses Second Wind: 1d10+1'), sw.log);
  // Short rest: one Second Wind back (of 2), never more than 2
  const rf2 = Creatures.make('fighter'); rf2.uses.secondWind = 0; Creatures.shortRest(rf2); const one = rf2.uses.secondWind; Creatures.shortRest(rf2); Creatures.shortRest(rf2);
  check('short rest: one Second Wind back, at most 2', one === 1 && rf2.uses.secondWind === 2, rf2.uses);

  // ---------- Step 7: conditions and the new spells ----------
  const cl = Creatures.make('cleric'), gA = () => Creatures.make('goblin', 'Goblin A');
  // Sleep (2024): a WIS save or drowsy; undead and elves (Trance) are unaffected; a second save or asleep
  const s1 = gA(), s2 = Creatures.make('goblin', 'Goblin B'), sk = Creatures.make('skeleton'), elf = Creatures.make('wizard');
  const sl = Rules.resolve('sleep', wizard, [s1, s2, sk, elf], { rng, force: 'hit' });
  check('sleep: goblins drowsy, skeleton and elf not', sl.hits[0].slept && sl.hits[1].slept && !sl.hits[2].slept && !sl.hits[3].slept && sl.hits[0].adds[0].id === 'drowsy' && sl.rolls.length === 2, sl.log);
  let drowsy = 0; for (let i = 0; i < 4000; i++) if (Rules.resolve('sleep', wizard, [gA()], { rng }).hits[0].slept) drowsy++;
  check('sleep: goblin (WIS -1) fails DC 13 ~65%', Math.abs(drowsy / 4000 - 0.65) < 0.03, drowsy / 4000);
  const again = Rules.sleepAgain(gA(), wizard, { rng });
  check('sleep: the second save is WIS vs DC 13', again.vs === 'DC 13' && again.ability === 'wis' && again.text.includes('Sleep'), again);
  const dz = gA(); Conditions.add(dz, 'drowsy', { by: wizard, ends: 'endOfSelf' });
  check('drowsy: incapacitated, no reactions', Conditions.incapacitated(dz) && !Conditions.canReact({ ...dz, reaction: true }));
  // Asleep: STR and DEX saves fail
  const zz = gA(); Conditions.add(zz, 'asleep', { ends: 'never' });
  let fails = true; for (let i = 0; i < 100; i++) if (Rules.resolve('burningHands', wizard, [zz], { rng }).hits[0].saved) fails = false;
  check('a sleeper fails DEX saves', fails);
  // Bless: +1d4 on attacks (fighter vs goblin 55% -> ~67.5%), shown in the log
  const bf = Creatures.make('fighter'); Conditions.add(bf, 'blessed', { by: cl, ends: 'never' });
  let bh = 0; for (let i = 0; i < 20000; i++) if (Rules.resolve('swordSwing', bf, [gA()], { rng }).outcome !== 'miss') bh++;
  check('bless: hit rate ~67.5%', Math.abs(bh / 20000 - 0.675) < 0.015, bh / 20000);
  check('bless in the log', Rules.resolve('swordSwing', bf, [gA()], { rng }).log[0].includes('(Bless)'));
  // Shield of Faith: +2 AC
  const sof = Creatures.make('fighter'); Conditions.add(sof, 'faith', { by: cl, ends: 'never' });
  check('shield of faith: AC 21', Conditions.ac(sof) === 21 && Rules.resolve('goblinSpear', gA(), [sof], { rng }).rolls[0].vs === 'AC 21');
  // Ray of Frost slows; the slow ends at the start of the caster's next turn
  const rf = Rules.resolve('rayOfFrost', wizard, [gA()], { rng, force: 'hit' });
  check('ray of frost: hit adds slowed', rf.hits[0].adds && rf.hits[0].adds[0].id === 'slowed');
  const slow = gA(); Conditions.add(slow, 'slowed', { by: wizard, ends: 'startOfBy' });
  check('slowed: speed 20', Conditions.speed(slow) === 20);
  Conditions.turnStart(wizard, [slow, wizard]);
  check('slow ends on the casters turn', Conditions.speed(slow) === 30);
  // Thunderwave: pushed 2 squares on a failed save only
  const tw = Rules.resolve('thunderwave', wizard, [gA(), gA()], { rng, force: 'hit' }), tw2 = Rules.resolve('thunderwave', wizard, [gA()], { rng, force: 'miss' });
  check('thunderwave: failed save pushes 2 squares, saved does not', tw.hits.every(h => h.push === 2) && tw2.hits[0].push === 0, [tw.hits, tw2.hits]);
  // Guiding Bolt marks; concentration: a new spell ends the old one; a CON save DC 10 or half the damage
  check('guiding bolt adds guided', Rules.resolve('guidingBolt', cl, [gA()], { rng, force: 'hit' }).hits[0].adds[0].id === 'guided');
  const kf = Creatures.make('fighter'), kc = Creatures.make('cleric');
  Conditions.add(kf, 'blessed', { by: kc, ends: 'never' }); Conditions.concentrate(kc, 'Bless', [kf], [kf, kc]);
  Conditions.concentrate(kc, 'Shield of Faith', [kf], [kf, kc]); Conditions.add(kf, 'faith', { by: kc, ends: 'never' });
  check('a new concentration spell ends the old one', !Conditions.has(kf, 'blessed') && Conditions.has(kf, 'faith') && kc.concentration.spell === 'Shield of Faith', kf.effects);
  check('concentration DC 10 or half', Rules.concentrationSave(kc, 8, { rng }).vs === 'DC 10' && Rules.concentrationSave(kc, 30, { rng }).vs === 'DC 15');
  Conditions.add(kf, 'faith', { by: kc, ends: 'never' }); Conditions.concentrate(kc, 'Shield of Faith', [kf], [kf, kc]);
  Conditions.drop(kc, [kf, kc]);
  check('dropping concentration ends its conditions', !Conditions.has(kf, 'faith') && !kc.concentration);
  // Sleep lasts while the wizard concentrates
  const nap = gA(), nw = Creatures.make('wizard'); Conditions.add(nap, 'asleep', { by: nw, ends: 'never' }); Conditions.concentrate(nw, 'Sleep', [nap], [nap, nw]);
  for (let i = 0; i < 12; i++) Conditions.turnEnd(nap, [nap, nw]);
  const still = Conditions.asleep(nap); Conditions.drop(nw, [nap, nw]);
  check('sleep lasts until concentration ends', still && !Conditions.asleep(nap));

  // ---------- Step 7c: the easy batch ----------
  // Guiding Bolt's light outlasts the end of the cleric's own turn and goes at the end of the next one
  const gc = Creatures.make('cleric'), gt = gA(); Conditions.add(gt, 'guided', { by: gc, ends: 'endOfBy', skip: 1 });
  Conditions.turnEnd(gc, [gc, gt]); const kept = Conditions.has(gt, 'guided'); Conditions.turnEnd(gc, [gc, gt]);
  check('guided lasts until the end of the casters next turn', kept && !Conditions.has(gt, 'guided'));
  // Shocking Grasp: no opportunity attacks (other reactions are fine) until the target's own next turn
  const sh = gA(); sh.reaction = true; Conditions.add(sh, 'shocked', { by: wizard, ends: 'startOfSelf' });
  const noOA = !Conditions.canOpportunity(sh) && Conditions.canReact(sh); Conditions.turnStart(wizard, [sh, wizard]); const stillShocked = Conditions.has(sh, 'shocked'); Conditions.turnStart(sh, [sh, wizard]);
  check('shocked: no opportunity attacks until its own turn', noOA && stillShocked && Conditions.canOpportunity(sh));
  // Scorching Ray: three rolls, three parts
  const sr = Rules.resolve('scorchingRay', wizard, [gA()], { rng });
  check('scorching ray: 3 rolls and 3 parts', sr.rolls.length === 3 && sr.hits[0].parts.length === 3 && sr.hits[0].amount === sr.hits[0].parts.reduce((a, b) => a + b, 0), sr);
  let rayHits = 0; for (let i = 0; i < 4000; i++) rayHits += Rules.resolve('scorchingRay', wizard, [gA()], { rng }).hits[0].parts.filter(n => n > 0).length;
  check('scorching ray: each ray ~55% vs AC 15', Math.abs(rayHits / 12000 - 0.55) < 0.02, rayHits / 12000);
  // Chromatic Orb takes the picked type: cold on a goblin is plain, poison on a skeleton does nothing
  const co = Rules.resolve('chromaticOrb', wizard, [Creatures.make('skeleton')], { rng, force: 'hit', type: 'poison' });
  check('chromatic orb: picked type (poison vs skeleton = 0)', co.hits[0].amount === 0 && co.log[0].includes('(poison)'), co.log);
  check('chromatic orb: unknown type falls back to fire', Rules.resolve('chromaticOrb', wizard, [gA()], { rng, type: 'banana' }).log[0].includes('(fire)'));
  // Acid Splash is a 5 ft sphere, a save each; Poison Spray is a spell attack (1d12)
  const as2 = Rules.resolve('acidSplash', wizard, [gA(), gA()], { rng });
  check('acid splash: two saves', as2.hits.length === 2 && as2.rolls.length === 2 && Actions.get('acidSplash').area === 'circle' && Actions.get('acidSplash').size === 5);
  const ps = Rules.resolve('poisonSpray', wizard, [Creatures.make('skeleton')], { rng, force: 'hit' });
  check('poison spray: an attack roll, skeleton immune', ps.rolls[0].kind === 'attack' && ps.hits[0].amount === 0, ps);

  // ---------- Step 7d: the 2024 rules ----------
  // The sheets
  const rogue = Creatures.make('rogue');
  check('2024 sheets: fighter AC 19 (Defense), wizard 8 HP / AC 12, cleric 11 HP, paladin 12 HP', fighter.ac === 19 && wizard.hp === 8 && wizard.ac === 12 && cl.hp === 11 && paladin.hp === 12);
  check('rogue Expertise: Stealth +7, Perception +5', Creatures.skillBonus(rogue, 'stealth') === 7 && Creatures.skillBonus(rogue, 'perception') === 5);
  check('goblin warrior: 10 HP, Dex 15, fey; minion 7 HP AC 12', goblin.hp === 10 && goblin.abilities.dex === 15 && goblin.tags.includes('fey') && minion.hp === 7 && minion.ac === 12);
  check('skeleton: AC 14, +5 1d6+3', skel.ac === 14 && skel.attacks.shortsword.bonus === 5 && skel.attacks.shortsword.damage === '1d6+3');
  // Goblins: +1d4 with advantage
  let advOk = true; for (let i = 0; i < 200; i++) { const r = Rules.resolve('goblinSpear', gA(), [fighter], { rng, force: 'hit', mode: 'adv' }); if (r.hits[0].amount < 4 || r.hits[0].amount > 12) advOk = false; }
  const plain = Rules.resolve('goblinSpear', gA(), [fighter], { rng, force: 'hit' }).log[0], withAdv = Rules.resolve('goblinSpear', gA(), [fighter], { rng, force: 'hit', mode: 'adv' }).log[0];
  check('goblin: +1d4 only with advantage', advOk && !plain.includes('1d4') && withAdv.includes('1d4'), [plain, withAdv]);
  // Chill Touch: touch, 1d10, no healing until the end of the casters next turn
  const ct = Actions.get('chillTouch'), cht = gA(); Conditions.add(cht, 'chilled', { by: wizard, ...ct.adds });
  Conditions.turnEnd(wizard, [wizard, cht]); const chillKept = Conditions.has(cht, 'chilled'); Conditions.turnEnd(wizard, [wizard, cht]);
  check('chill touch: melee 1d10, lasts to the end of the casters next turn', ct.range === 'melee' && ct.damage === '1d10' && chillKept && !Conditions.has(cht, 'chilled'));
  // True Strike: the quarterstaff with Int (+5, 1d6+3), radiant or bludgeoning
  let tsOk = true; for (let i = 0; i < 300; i++) { const r = Rules.resolve('trueStrike', wizard, [gA()], { rng, force: 'hit' }); if (r.hits[0].amount < 4 || r.hits[0].amount > 9) tsOk = false; }
  const ts = Rules.resolve('trueStrike', wizard, [Creatures.make('skeleton')], { rng, force: 'hit', type: 'bludgeoning' });
  check('true strike: staff with Int, 1d6+3', tsOk && ts.rolls[0].bonus === 5 && ts.log[0].includes('1d6+3'), ts.log);
  check('true strike: bludgeoning on a skeleton is doubled', ts.hits[0].note === 'vulnerable' && ts.log[0].includes('bludgeoning'), ts.log);
  check('true strike: radiant by default', Rules.resolve('trueStrike', wizard, [gA()], { rng, force: 'hit' }).log[0].includes('radiant'));
  // Chromatic Orb: matching dice make it leap (not again on the second target)
  let leaps = 0, noLeapOk = true; for (let i = 0; i < 4000; i++) { const r = Rules.resolve('chromaticOrb', wizard, [gA()], { rng, force: 'hit' }); if (r.leap) leaps++; if (Rules.resolve('chromaticOrb', wizard, [gA()], { rng, force: 'hit', noLeap: true }).leap) noLeapOk = false; }
  check('chromatic orb: leaps when two of 3d8 match (~34%)', Math.abs(leaps / 4000 - 0.34) < 0.03 && noLeapOk, leaps / 4000);
  // Inflict Wounds: a CON save, 2d10, half on a save
  const iw = Rules.resolve('inflictWounds', cl, [gA()], { rng, force: 'miss' });
  check('inflict wounds: CON save, half on a save', iw.rolls[0].kind === 'save' && iw.rolls[0].ability === 'con' && iw.hits[0].saved && iw.hits[0].amount >= 1 && iw.hits[0].amount <= 10, iw);
  // Healing Word 2d4 + Wis 3
  const hw = Rules.resolve('healingWord', cl, [fighter], { rng });
  check('healing word: 2d4+3 (5..11)', hw.hits[0].amount >= 5 && hw.hits[0].amount <= 11 && hw.log[0].includes('2d4+3'), hw.log);
  // Divine Smite: +2d8 radiant, +1d8 against undead or fiends
  const smiteFey = Rules.resolve('divineSmite', paladin, [gA()], { rng, force: 'hit' }).log[0], smiteUndead = Rules.resolve('divineSmite', paladin, [skel], { rng, force: 'hit' }).log[0];
  check('divine smite: +1d8 only against undead or fiends', !smiteFey.includes('1d8 =') && smiteUndead.includes('1d8 ='), [smiteFey, smiteUndead]);
  check('divine smite: spends its slot only on a hit', Actions.get('divineSmite').smite === true);
  // Breath: 1d10, cone or line, 2 uses
  check('breath: 1d10 cone 15 / line 30, 2 uses', Actions.get('fireBreath').damage === '1d10' && Actions.get('fireBreathLine').size === 30 && paladin.uses.breath === 2);
  // Weapon mastery: the fighter's longsword saps, the rogue's shortsword vexes
  const sap = Rules.resolve('swordSwing', fighter, [gA()], { rng, force: 'hit' }), vex = Rules.resolve('sneakAttack', rogue, [gA()], { rng, force: 'hit' });
  check('mastery: longsword Sap, shortsword Vex', sap.hits[0].adds[0].id === 'sapped' && vex.hits[0].adds[0].id === 'vexed', [sap.hits[0].adds, vex.hits[0].adds]);
  check('mastery: monsters have none', !Rules.resolve('skeletonSword', skel, [fighter], { rng, force: 'hit' }).hits[0].adds);
  // Savage Attacker: the weapon dice twice, the higher kept (mean of 1d8 -> ~5.8)
  let sv = 0, svLog = ''; for (let i = 0; i < 6000; i++) { const r = Rules.resolve('swordSwing', fighter, [gA()], { rng, force: 'hit', savage: true }); sv += r.hits[0].amount - 3; svLog = r.log[0]; }
  check('savage attacker: best of two 1d8 ~5.81', Math.abs(sv / 6000 - 5.81) < 0.12 && svLog.includes('Savage Attacker'), [sv / 6000, svLog]);
  check('savage attacker: not on spells', !Rules.resolve('fireBolt', wizard, [gA()], { rng, force: 'hit', savage: true }).savage);
  // ---------- Step 7e: the medium batch ----------
  const wz = () => Creatures.make('wizard'), cu = () => Creatures.make('cultist', 'Cultist A');
  // Mage Armor: 13 + Dex on someone in no armor
  const ma = wz(); Conditions.add(ma, 'mageArmor', { ends: 'never' });
  check('mage armor: wizard AC 12 -> 15', Conditions.ac(wz()) === 12 && Conditions.ac(ma) === 15, Conditions.ac(ma));
  check('mage armor: only on someone in no armor', Actions.fits(Actions.get('mageArmor'), wz()) && !Actions.fits(Actions.get('mageArmor'), fighter));
  // Hold Person: humanoids only (2024 goblins are fey); a failed WIS save paralyzes
  check('hold person: cultist and heroes yes, goblin / skeleton / slime no', ['cultist', 'fighter', 'wizard'].every(id => Actions.fits(Actions.get('holdPerson'), Creatures.make(id))) &&
    ['goblin', 'goblinBoss', 'skeleton', 'slime'].every(id => !Actions.fits(Actions.get('holdPerson'), Creatures.make(id))));
  const hp1 = Rules.resolve('holdPerson', wizard, [cu()], { rng, force: 'hit' }), hpG = Rules.resolve('holdPerson', wizard, [gA()], { rng, force: 'hit' });
  check('hold person: a failed save paralyzes', hp1.outcome === 'hit' && hp1.hits[0].adds[0].id === 'paralyzed' && hp1.rolls[0].ability === 'wis', hp1);
  check('hold person: a goblin is unaffected', hpG.outcome === 'miss' && !hpG.hits[0].adds && hpG.log[1].includes('not a humanoid'), hpG.log);
  const held = cu(); Conditions.add(held, 'paralyzed', { by: wizard, ends: 'never' });
  check('paralyzed: incapacitated, helpless, speed 0', Conditions.incapacitated(held) && Conditions.helpless(held) && Conditions.speed(held) === 0);
  let autoFail = true; for (let i = 0; i < 300; i++) if (Rules.resolve('burningHands', wizard, [held], { rng }).hits[0].saved) autoFail = false;
  check('paralyzed: fails DEX saves', autoFail);
  let frees = 0; for (let i = 0; i < 4000; i++) if (Rules.repeatSave(held, Conditions.get(held, 'paralyzed'), { rng }).success) frees++;
  check('hold person: the repeat save ends it ~50% (WIS +2 vs DC 13)', Math.abs(frees / 4000 - 0.5) < 0.03, frees / 4000);
  // Hypnotic Pattern: WIS save or charmed (incapacitated); elves save with advantage; the slime can't be charmed
  const pat = Rules.resolve('hypnoticPattern', wizard, [gA(), slime, wz()], { rng, force: 'hit' });
  check('hypnotic pattern: charms, not the slime', pat.hits[0].adds[0].id === 'entranced' && !pat.hits[1].adds && pat.log[2].includes("can't be charmed"), pat.log);
  check('hypnotic pattern: an elf saves with advantage (Fey Ancestry)', pat.rolls[1].mode === 'adv' && pat.rolls[0].mode === 'normal', pat.rolls);
  const sleeper = gA(); Conditions.add(sleeper, 'asleep', { ends: 'never' });
  check("hypnotic pattern: a sleeper can't see it", !Rules.resolve('hypnoticPattern', wizard, [sleeper], { rng, force: 'hit' }).hits[0].adds);
  const tranced = gA(); Conditions.add(tranced, 'entranced', { by: wizard, ends: 'never' });
  check('charmed by the pattern: incapacitated, speed 0, can be shaken', Conditions.incapacitated(tranced) && Conditions.speed(tranced) === 0 && Conditions.shakeable(tranced) && !Conditions.helpless(tranced));
  // Mirror Image: a hit rolls a d6 per duplicate; any 3+ and a duplicate takes it
  const mir = () => { const w = wz(); Conditions.add(w, 'mirrored', { ends: 'never', images: 3 }); return w; };
  let fool3 = 0; for (let i = 0; i < 4000; i++) if (Rules.resolve('goblinSpear', goblin, [mir()], { rng, force: 'hit' }).decoys) fool3++;
  check('mirror image: 3 duplicates take a hit ~96%', Math.abs(fool3 / 4000 - 0.963) < 0.015, fool3 / 4000);
  const lone = wz(); Conditions.add(lone, 'mirrored', { ends: 'never', images: 1 });
  let fool1 = 0; for (let i = 0; i < 4000; i++) if (Rules.resolve('goblinSpear', goblin, [lone], { rng, force: 'hit' }).decoys) fool1++;
  check('mirror image: 1 duplicate ~67%', Math.abs(fool1 / 4000 - 0.667) < 0.03, fool1 / 4000);
  const fooledHit = (() => { for (let i = 0; i < 50; i++) { const r = Rules.resolve('goblinSpear', goblin, [mir()], { rng, force: 'hit' }); if (r.decoys) return r; } })();
  check('mirror image: a duplicate hit does no damage, a miss outcome', fooledHit.outcome === 'miss' && fooledHit.hits[0].amount === 0 && fooledHit.log[0].includes('duplicate'), fooledHit.log);
  check("mirror image: misses don't touch the duplicates", !Rules.resolve('goblinSpear', goblin, [mir()], { rng, force: 'miss' }).decoys);
  let blind = 0; for (let i = 0; i < 200; i++) if (Rules.resolve('slimeAcid', slime, [mir()], { rng, force: 'hit' }).decoys) blind++;
  check('mirror image: blindsight sees through it (the slime)', blind === 0);
  const rayDecoys = Rules.resolve('scorchingRay', wizard, [mir()], { rng, force: 'hit' });
  check('mirror image: each ray can hit a duplicate', rayDecoys.decoys >= 1 && rayDecoys.hits[0].parts.length === 3, rayDecoys);
  // Haste: +2 AC, double speed, advantage on DEX saves, then lethargy when it ends
  const quick = Creatures.make('fighter'), caster = wz();
  Conditions.add(quick, 'hasted', { by: caster, ends: 'never' }); caster.concentration = { spell: 'Haste', on: [quick] };
  check('haste: AC 19 -> 21, speed 60', Conditions.ac(quick) === 21 && Conditions.speed(quick) === 60, [Conditions.ac(quick), Conditions.speed(quick)]);
  check('haste: advantage on DEX saves', Rules.resolve('burningHands', wizard, [quick], { rng }).rolls[0].mode === 'adv');
  const people = [quick, caster], dropLines = Conditions.drop(caster, people, 'lost concentration');
  check('haste ends: lethargic (incapacitated, speed 0)', !Conditions.has(quick, 'hasted') && Conditions.incapacitated(quick) && Conditions.speed(quick) === 0 && dropLines.length === 2, dropLines);
  Conditions.turnStart(quick, people); Conditions.turnEnd(quick, people);
  check('lethargy lasts to the end of its next turn', !Conditions.has(quick, 'lethargic'));
  const own = Creatures.make('fighter'), c2 = wz();
  Conditions.add(own, 'hasted', { by: c2, ends: 'never' }); c2.concentration = { spell: 'Haste', on: [own] };
  Conditions.turnStart(own, [own, c2]); Conditions.drop(c2, [own, c2]); Conditions.turnEnd(own, [own, c2]);
  const stillOn = Conditions.has(own, 'lethargic');
  Conditions.turnStart(own, [own, c2]); Conditions.turnEnd(own, [own, c2]);
  check('lethargy put on during its own turn lasts through the next one', stillOn && !Conditions.has(own, 'lethargic'));
  // Concentration ends when nobody is under the spell any more (a held target saves)
  const hc = wz(), ht = cu(); Conditions.add(ht, 'paralyzed', { by: hc, ends: 'never' }); hc.concentration = { spell: 'Hold Person', on: [ht] };
  const rel = Conditions.release(ht, 'paralyzed', [hc, ht]);
  check("release: the last one free ends the caster's concentration", !hc.concentration && rel[0].includes('Hold Person ends'), rel);
  // Flaming Sphere: a DEX save, 2d6 fire, half on a save
  const sb = Rules.resolve('sphereBurn', wizard, [gA()], { rng, force: 'miss' }), sbF = Rules.resolve('sphereBurn', wizard, [gA()], { rng, force: 'hit' });
  check('flaming sphere: DEX save, 2d6 fire, half on a save', sb.rolls[0].ability === 'dex' && sb.hits[0].saved && sb.hits[0].amount <= 6 && sbF.hits[0].amount >= 2 && sbF.hits[0].amount <= 12 && sb.log[0].includes('Flaming Sphere burns'), [sb.log, sbF.log]);
  check('flaming sphere: concentration, a bonus action to roll it 30 ft', Actions.get('flamingSphere').concentration && Actions.get('sphereMove').cost === 'bonus' && Actions.get('sphereMove').size === 30);
  check('mirror image: not concentration; haste and hold person are', !Actions.get('mirrorImage').concentration && Actions.get('haste').concentration && Actions.get('holdPerson').concentration && Actions.get('haste').slot === 3);
  // ---------- Step 10a: level 2 ----------
  const at2 = id => { const c = Creatures.make(id); Creatures.levelUp(c); return c; };
  const f2 = at2('fighter'), w2 = at2('wizard'), c2l = at2('cleric'), r2 = at2('rogue'), p2 = at2('paladin');
  check('level 2 fighter: Action Surge once a rest, Tactical Mind, 20 HP', f2.actions.includes('actionSurge') && f2.uses.actionSurge === 1 && f2.traits.includes('tacticalMind') && f2.maxHp === 20, f2);
  check('level 2 wizard: 3 slots, Chromatic Orb, Expertise in Arcana', w2.slots[1] === 3 && w2.maxSlots[1] === 3 && w2.actions.includes('chromaticOrb') && Creatures.skillBonus(w2, 'arcana') === 3 + 4, w2.slots);
  check('level 2 cleric: Channel Divinity twice, Divine Spark, Turn Undead, Inflict Wounds', c2l.uses.channelDivinity === 2 && ['divineSpark', 'divineSparkHeal', 'turnUndead', 'inflictWounds'].every(a => c2l.actions.includes(a)) && c2l.slots[1] === 3);
  check('level 2 rogue: Cunning Action and Hide', r2.traits.includes('cunningAction') && r2.actions.includes('hide') && r2.actions.includes('sneakAttack'));
  check("level 2 paladin: Paladin's Smite, Sacred Flame (Blessed Warrior), 2 slots", p2.uses.paladinsSmite === 1 && p2.actions.includes('sacredFlame') && p2.slots[1] === 2 && Actions.get('divineSmite').free === 'paladinsSmite');
  const psf = Rules.resolve('sacredFlame', p2, [gA()], { rng, force: 'hit' });
  check('paladin Sacred Flame uses Charisma: DC 12', psf.log[0].includes('DC 12'), psf.log);
  // Arcane Recovery: half the level (rounded up) in slot levels, once per long rest
  const ar = at2('wizard'); ar.slots[1] = 0;
  const arL = Creatures.shortRest(ar), ar2 = Creatures.shortRest(ar);
  check('arcane recovery: one level 1 slot back at level 2, once', ar.slots[1] === 1 && ar.uses.arcaneRecovery === 0 && arL.length === 1 && !ar2.length, [ar.slots, arL]);
  const arFull = at2('wizard');
  check('arcane recovery: not used when no slot is spent', !Creatures.shortRest(arFull).length && arFull.uses.arcaneRecovery === 1);
  // Tactical Mind: a failed check adds 1d10 if a Second Wind is left; spent only if it then succeeds
  let tmSpent = 0, tmSeen = 0; for (let i = 0; i < 3000; i++) { const r = Rules.check(f2, 'athletics', 10, { rng, fixed: 1 }); if (r.tactical) tmSeen++; if (r.tactical && r.tactical.spent) tmSpent++; }
  check('tactical mind: 1 + 5 vs DC 10, +1d10 succeeds ~70%', tmSeen === 3000 && Math.abs(tmSpent / 3000 - 0.7) < 0.03, tmSpent / 3000);
  const noWind = at2('fighter'); noWind.uses.secondWind = 0;
  check('tactical mind: needs a Second Wind left', !Rules.check(noWind, 'athletics', 10, { rng, fixed: 1 }).tactical && !Rules.check(Creatures.make('fighter'), 'athletics', 10, { rng, fixed: 1 }).tactical);
  // Divine Spark: 1d8 + Wis (3), CON save, the type picked, half on a save; or heal another creature
  const dsN = Rules.resolve('divineSpark', c2l, [gA()], { rng, force: 'hit', type: 'necrotic' }), dsS = Rules.resolve('divineSpark', c2l, [gA()], { rng, force: 'miss' });
  check('divine spark: 1d8+3 necrotic, CON save, half on a save', dsN.log[0].includes('1d8+3') && dsN.log[0].includes('necrotic') && dsN.rolls[0].ability === 'con' && dsN.hits[0].amount >= 4 && dsN.hits[0].amount <= 11 && dsS.hits[0].amount <= 5, [dsN.log, dsS.log]);
  const dsH = Rules.resolve('divineSparkHeal', c2l, [fighter], { rng });
  check('divine spark: heals 1d8+3, not on yourself', dsH.hits[0].heal && dsH.hits[0].amount >= 4 && dsH.hits[0].amount <= 11 && Actions.get('divineSparkHeal').others, dsH);
  // Turn Undead: WIS save or turned
  const tu2 = Rules.resolve('turnUndead', c2l, [Creatures.make('skeleton')], { rng, force: 'hit' });
  check('turn undead: turned (incapacitated, flees)', tu2.hits[0].adds[0].id === 'turned' && Conditions.KINDS.turned.incapacitated && Actions.get('turnUndead').uses === 'channelDivinity', tu2);
  // Hide: Stealth +7 (Expertise) vs DC 15; hidden with the total
  let hid = 0, hidTot = true; for (let i = 0; i < 3000; i++) { const r = Rules.resolve('hide', r2, [r2], { rng }); if (r.hits[0].adds) { hid++; if (r.hits[0].adds[0].total < 15) hidTot = false; } }
  check('hide: Stealth +7 vs DC 15 ~65% (Luck a bit more)', Math.abs(hid / 3000 - 0.66) < 0.035 && hidTot && Creatures.skillBonus(r2, 'stealth') === 7, hid / 3000);
  check('action surge: a free use, the action back', Actions.get('actionSurge').cost === 'free' && Rules.resolve('actionSurge', f2, [f2], { rng }).log[0].includes('Action Surge'));
  // ---------- Step 10b: level 3 ----------
  const at3 = id => { const c = Creatures.make(id); Creatures.levelUp(c); Creatures.levelUp(c); return c; };
  const f3 = at3('fighter'), w3 = at3('wizard'), c3 = at3('cleric'), r3 = at3('rogue'), p3 = at3('paladin');
  check('level 3: HP 28 / 20 / 27 / 24 / 28', [f3, w3, c3, r3, p3].map(c => c.maxHp).join() === '28,20,27,24,28', [f3, w3, c3, r3, p3].map(c => c.maxHp));
  // Champion: crits on 19-20 with weapons, not spells
  let c19 = 0, sp19 = 0; for (let i = 0; i < 20000; i++) { if (Rules.resolve('swordSwing', f3, [gA()], { rng }).outcome === 'crit') c19++; if (Rules.resolve('fireBolt', w3, [gA()], { rng }).outcome === 'crit') sp19++; }
  check('improved critical: ~10% crits with the sword', Math.abs(c19 / 20000 - 0.1) < 0.01 && Math.abs(sp19 / 20000 - 0.05) < 0.008, [c19 / 20000, sp19 / 20000]);
  check('remarkable athlete: advantage on Athletics', Rules.check(f3, 'athletics', 10, { rng }).d20.dropped != null && Rules.check(f2, 'athletics', 10, { rng, fixed: 15 }).d20.dropped == null);
  // Evoker: slots 4 / 2, Potent Cantrip (half on a miss or a save, nothing else)
  check('level 3 wizard: slots 4 / 2, Scorching Ray, Potent Cantrip', w3.slots[1] === 4 && w3.slots[2] === 2 && w3.actions.includes('scorchingRay') && w3.traits.includes('potentCantrip'));
  const pc = Rules.resolve('rayOfFrost', w3, [gA()], { rng, force: 'miss' });
  check('potent cantrip: a missed Ray of Frost does half, no slow', pc.potent >= 0 && pc.hits[0].amount === pc.potent && !pc.hits[0].adds && pc.log[0].includes('Potent Cantrip'), pc.log);
  check('potent cantrip: not for level 2 wizards or spells with slots', !Rules.resolve('rayOfFrost', w2, [gA()], { rng, force: 'miss' }).potent && !Rules.resolve('chromaticOrb', w3, [gA()], { rng, force: 'miss' }).potent);
  let pcs = 0; for (let i = 0; i < 300; i++) { const r = Rules.resolve('acidSplash', w3, [gA()], { rng, force: 'miss' }); if (r.hits[0].saved && r.hits[0].amount > 3) pcs++; }
  check('potent cantrip: a saved Acid Splash does half (at most 3)', pcs === 0 && Rules.resolve('acidSplash', w3, [Creatures.make('cultist')], { rng, force: 'miss' }).hits[0].saved);
  // Life Domain: Disciple of Life (+2 + slot level), Preserve Life (15 HP among the bloodied, up to half max)
  const cw3 = Rules.resolve('cureWounds', c3, [fighter], { rng });
  check('disciple of life: Cure Wounds 2d8+3+3 (8..22)', cw3.hits[0].amount >= 8 && cw3.hits[0].amount <= 22 && cw3.log[0].includes('Disciple of Life'), cw3.log);
  check('disciple of life: not on Divine Spark (no slot) or before level 3', !Rules.resolve('divineSparkHeal', c3, [fighter], { rng }).log[0].includes('Disciple') && !Rules.resolve('cureWounds', c2l, [fighter], { rng }).log[0].includes('Disciple'));
  const hurtA = Creatures.make('fighter'), hurtB = Creatures.make('wizard'), fine3 = Creatures.make('rogue'); hurtA.hp = 1; hurtB.hp = 0;
  const pl = Rules.resolve('preserveLife', c3, [hurtA, hurtB], { rng });
  check('preserve life: up to half max each (fighter 1 -> 6, wizard 0 -> 4)', pl.hits[0].amount === 5 && pl.hits[1].amount === 4 && pl.hits.every(h => h.heal), pl.log);
  check('level 3 cleric: slots 4 / 2, Spiritual Weapon, Aid, Lesser Restoration, Preserve Life', c3.slots[2] === 2 && ['spiritualWeapon', 'aid', 'lesserRestoration', 'preserveLife'].every(a => c3.actions.includes(a)));
  const spw = Rules.resolve('spiritualWeapon', c3, [gA()], { rng, force: 'hit' });
  check('spiritual weapon: melee spell attack, 1d8+3 force', spw.log[0].includes('1d8+3') && spw.log[0].includes('force') && spw.hits[0].amount >= 4 && spw.hits[0].amount <= 11 && Actions.get('spiritualWeapon').concentration, spw.log);
  const ad = Rules.resolve('aid', c3, [fighter, wizard], { rng });
  check('aid: +5 HP maximum each', ad.hits.every(h => h.aid === 5));
  const aidBack = Creatures.make('fighter'); aidBack.maxHp += 5; aidBack.hp = 17; Conditions.add(aidBack, 'aided', { ends: 'never', amount: 5 }); Conditions.clear(aidBack);
  check('aid: the extra goes when the fight ends', aidBack.maxHp === 12 && aidBack.hp === 12);
  const heldF = Creatures.make('fighter'); Conditions.add(heldF, 'paralyzed', { by: wizard, ends: 'never' });
  check('lesser restoration: ends paralysis', Rules.resolve('lesserRestoration', c3, [heldF], { rng }).hits[0].ends === 'paralyzed');
  // Thief: Sneak Attack 2d6, Steady Aim
  check('level 3 rogue: Sneak Attack 2d6, Steady Aim', r3.sneak === '2d6' && r3.actions.includes('steadyAim') && Rules.resolve('sneakAttack', r3, [gA()], { rng, force: 'hit' }).log[0].includes('2d6'));
  // Devotion: Sacred Weapon (+Cha 2 to hit), Protection from Evil and Good, 3 slots, Channel Divinity twice
  const pSac = at3('paladin'); Conditions.add(pSac, 'sacredWeapon', { ends: 'never' });
  const sacLog = Rules.resolve('swordSwing', pSac, [gA()], { rng }).log[0];
  check('sacred weapon: longsword +7 (+2 Cha)', sacLog.includes('+ 7 = ') && sacLog.includes('sacred'), sacLog);
  check('level 3 paladin: 3 slots, Channel Divinity 2, Sacred Weapon, Protection from Evil', p3.slots[1] === 3 && p3.uses.channelDivinity === 2 && p3.actions.includes('sacredWeapon') && p3.actions.includes('protectionFromEvil'));
  // ---------- Step 10c: level 4 ----------
  const at4 = id => { const c = Creatures.make(id); for (let l = 1; l < 4; l++) Creatures.levelUp(c); return c; };
  const f4 = at4('fighter'), w4 = at4('wizard'), c4 = at4('cleric'), r4 = at4('rogue'), p4 = at4('paladin');
  check('level 4 HP 36 / 26 / 35 / 31 / 36', [f4, w4, c4, r4, p4].map(c => c.maxHp).join() === '36,26,35,31,36', [f4, w4, c4, r4, p4].map(c => c.maxHp));
  check('ASI fighter: Str 19, longsword +6 1d8+4, Second Wind 3', f4.abilities.str === 19 && f4.attacks.longsword.bonus === 6 && f4.attacks.longsword.damage === '1d8+4' && f4.uses.secondWind === 3, f4.attacks.longsword);
  check('ASI wizard: Int 19, spell +6 DC 14, slots 4 / 3, Acid Splash, Misty Step', w4.abilities.int === 19 && w4.spell.attack === 6 && w4.spell.dc === 14 && w4.slots[2] === 3 && w4.actions.includes('acidSplash') && w4.actions.includes('mistyStep') && w4.attacks.quarterstaff.damage === '1d6-1');
  check('ASI cleric: Wis 19, DC 14, Cure Wounds +4, Spare the Dying, Hold Person', c4.abilities.wis === 19 && c4.spell.dc === 14 && Rules.resolve('cureWounds', c4, [fighter], { rng }).log[0].includes('2d8+4') && c4.actions.includes('spareTheDying') && c4.actions.includes('holdPerson'));
  check('ASI rogue: Dex 19, shortsword +6 1d6+4, dagger 1d4+4, AC 15, Stealth +8', r4.abilities.dex === 19 && r4.attacks.shortsword.bonus === 6 && r4.attacks.shortsword.damage === '1d6+4' && r4.attacks.dagger.damage === '1d4+4' && r4.ac === 15 && Creatures.skillBonus(r4, 'stealth') === 8, [r4.attacks, r4.ac]);
  check('ASI paladin: Str 19, longsword +6, spell DC still 12', p4.abilities.str === 19 && p4.attacks.longsword.bonus === 6 && p4.spell.dc === 12);
  check('improve: never past 20', (() => { const c = Creatures.make('fighter'); Creatures.improve(c, 'str', 2); Creatures.improve(c, 'str', 2); return c.abilities.str === 20 && c.attacks.longsword.damage === '1d8+5'; })());
  const fallen = Creatures.make('fighter'); fallen.hp = 0;
  check('spare the dying: only someone dying', Actions.fits(Actions.get('spareTheDying'), fallen) && !Actions.fits(Actions.get('spareTheDying'), fighter) && Rules.resolve('spareTheDying', c4, [fallen], { rng }).hits[0].stabilize);
  // ---------- Step 10d: level 5 ----------
  const at5 = id => { const c = Creatures.make(id); for (let l = 1; l < 5; l++) Creatures.levelUp(c); return c; };
  const f5 = at5('fighter'), w5 = at5('wizard'), c5 = at5('cleric'), r5 = at5('rogue'), p5 = at5('paladin');
  check('level 5 HP 44 / 32 / 43 / 38 / 44', [f5, w5, c5, r5, p5].map(c => c.maxHp).join() === '44,32,43,38,44', [f5, w5, c5, r5, p5].map(c => c.maxHp));
  check('proficiency +3: longsword +7, spell +7 DC 15, rogue +7, paladin DC 13, breath DC 13', f5.attacks.longsword.bonus === 7 && w5.spell.attack === 7 && w5.spell.dc === 15 && c5.spell.dc === 15 && r5.attacks.shortsword.bonus === 7 && p5.spell.dc === 13 && p5.breath.dc === 13 && Creatures.saveBonus(f5, 'str') === 7, [f5.attacks.longsword, w5.spell, p5.breath]);
  const fb5 = Rules.resolve('fireBolt', w5, [gA()], { rng, force: 'hit' }), sf5 = Rules.resolve('sacredFlame', c5, [gA()], { rng, force: 'hit' }), br5 = Rules.resolve('fireBreath', p5, [gA()], { rng, force: 'hit' });
  check('cantrips grow at 5: Fire Bolt 2d10, Sacred Flame 2d8, breath 2d10 x3', fb5.log[0].includes('2d10') && sf5.log[0].includes('2d8') && br5.log[0].includes('2d10') && p5.uses.breath === 3 && Rules.resolve('fireBolt', w4, [gA()], { rng, force: 'hit' }).log[0].includes('1d10 ='), [fb5.log, sf5.log, br5.log]);
  check('true strike at 5: +1d6 radiant; Spare the Dying 30 ft', Rules.resolve('trueStrike', w5, [gA()], { rng, force: 'hit' }).log[0].includes('1d6 =') && Actions.at(Actions.get('spareTheDying'), 5).range === 30 && Actions.at(Actions.get('spareTheDying'), 4).range === 15);
  check('level 5: Extra Attack (fighter, paladin), Tactical Shift, 3rd-level slots, Fireball, Haste', f5.traits.includes('extraAttack') && f5.traits.includes('tacticalShift') && p5.traits.includes('extraAttack') && w5.slots[3] === 2 && w5.actions.includes('fireball') && w5.actions.includes('haste') && p5.slots[2] === 2 && p5.actions.includes('aid'));
  // Sear Undead: 4d8 radiant to undead that fail, and they stay turned
  const sear = Rules.resolve('turnUndead', c5, [Creatures.make('skeleton'), Creatures.make('skeleton')], { rng, force: 'hit' });
  check('sear undead: 4d8 radiant on a failed save, keeps them turned', sear.log[0].includes('Sear Undead 4d8') && sear.hits.every(h => h.amount >= 4 && h.keepTurned && h.adds), sear.log);
  check('no sear before level 5', Rules.resolve('turnUndead', c4, [Creatures.make('skeleton')], { rng, force: 'hit' }).hits[0].amount === undefined);
  const sg = Rules.resolve('guardiansBurn', c5, [gA()], { rng, force: 'miss' });
  check('spirit guardians: WIS save, 3d8 radiant, half on a save', sg.rolls[0].ability === 'wis' && sg.hits[0].saved && sg.hits[0].amount <= 12 && sg.log[0].includes('3d8') && Actions.get('spiritGuardians').concentration);
  const mhw = Rules.resolve('massHealingWord', c5, [Creatures.make('fighter'), Creatures.make('wizard'), Creatures.make('rogue')], { rng });
  check('mass healing word: each heals 2d4+4+5 (11..17)', mhw.hits.length === 3 && mhw.hits.every(h => h.heal && h.amount >= 11 && h.amount <= 17), mhw.log);
  const deadF = Creatures.make('fighter'); deadF.slain = true;
  check('revivify: only a dead friend', Actions.fits(Actions.get('revivify'), deadF) && !Actions.fits(Actions.get('revivify'), fighter) && Rules.resolve('revivify', c5, [deadF], { rng }).hits[0].revive);
  // Rogue: Sneak Attack 3d6, Cunning Strike, Uncanny Dodge
  const sa5 = Rules.resolve('sneakAttack', r5, [gA()], { rng, force: 'hit' }).log[0], tripR = Rules.resolve('sneakAttack', r5, [gA()], { rng, force: 'hit', strike: 'trip' });
  check('cunning strike: trip gives up a die (2d6), DC 15 DEX save', sa5.includes('3d6') && tripR.log[0].includes('2d6') && tripR.log[0].includes('DC 15') && tripR.rolls[1].ability === 'dex', [sa5, tripR.log]);
  let proneN = 0, poisN = 0, hitsN = 0; for (let i = 0; i < 4000; i++) { const t = Rules.resolve('sneakAttack', r5, [gA()], { rng, strike: 'trip' }), p = Rules.resolve('sneakAttack', r5, [gA()], { rng, strike: 'poison' }); if (t.outcome === 'miss' || p.outcome === 'miss') continue; hitsN++; if ((t.hits[0].adds || []).some(a => a.id === 'prone')) proneN++; if ((p.hits[0].adds || []).some(a => a.id === 'poisoned' && a.dc === 15)) poisN++; }
  check('cunning strike: goblin DEX +2 vs 15 fails 60%, CON +0 fails 70%', Math.abs(proneN / hitsN - 0.6) < 0.04 && Math.abs(poisN / hitsN - 0.7) < 0.04, [proneN / hitsN, poisN / hitsN]);
  check('cunning strike: withdraw; nothing before level 5', Rules.resolve('sneakAttack', r5, [gA()], { rng, force: 'hit', strike: 'withdraw' }).withdraw && !Rules.resolve('sneakAttack', r4, [gA()], { rng, force: 'hit', strike: 'trip' }).rolls[1]);
  const ud = Rules.resolve('goblinSpear', goblin, [r5], { rng, force: 'hit', uncanny: true }), udMiss = Rules.resolve('goblinSpear', goblin, [r5], { rng, force: 'miss', uncanny: true });
  check('uncanny dodge: a hit halved, a miss untouched', ud.uncanny && ud.log[0].includes('Uncanny Dodge') && ud.hits[0].amount <= 5 && !udMiss.uncanny, ud.log);
  const pz = Creatures.make('goblin'); Conditions.add(pz, 'poisoned', { ends: 'never', dc: 15, by: r5 });
  check('poisoned: disadvantage on checks; the repeat save is against the rogue DC', Rules.check(pz, 'stealth', 10, { rng }).d20.dropped != null && Rules.repeatSave(pz, Conditions.get(pz, 'poisoned'), { rng }).text.includes('DC 15'));
  let luckLine = null; for (let i = 0; i < 3000 && !luckLine; i++) { const r = Rules.resolve('throwDagger', r5, [gA()], { rng, mode: 'dis' }); if (r.rolls[0].d20.lucky) luckLine = r.log[0]; }
  check('luck log: disadvantage names the other die, then the rerolled 1', luckLine && luckLine.includes('(disadvantage, other ') && luckLine.includes('; Luck rerolled a 1)'), luckLine);
  return { ok: ok.length, bad, sample: [Rules.resolve('swordSwing', fighter, [goblin], { rng, force: 'crit' }).log, fb.log, Rules.resolve('sneakAttack', cast.Rogue, [goblin], { rng, mode: 'adv' }).log, ds.log, Rules.resolve('shield', skel, [wizard], { rng, with: 'shortbow', force: 'hit' }).log, sl.log, iw.log, ts.log, tw.log, Rules.resolve('swordSwing', bf, [gA()], { rng }).log, sr.log, co.log] };
})()`);
console.log(`${out.ok} passed, ${out.bad.length} failed`);
out.bad.forEach(b => console.log('FAIL ' + b));
if (process.argv.includes('--samples')) console.log(out.sample.flat().join('\n'));
process.exit(out.bad.length ? 1 : 0);
