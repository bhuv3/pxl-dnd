// The rules: resolves an action by rolling the dice (docs/dnd-game/rules.md) and returns what happened, without changing
// anything: the rolls (for the dice tray), the outcome, how much each target takes after resistances, and the
// log in plain words. Never touches the screen; Fx shows the result and the caller applies it.
const Rules = (() => {
  const ABILITY = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

  // opts: { rng (required), mode: 'normal' | 'adv' | 'dis', force: 'hit' | 'miss' | 'crit' (picks a d20 that gives
  //   that outcome: for the lab and tests), with (a reaction's attack), autoCrit (a hit is a crit: a melee attack
  //   on an unconscious creature), type (the damage type picked, for an action with types), savage (Savage
  //   Attacker is ready: weapon damage dice are rolled twice, keeping the higher), noLeap (Chromatic Orb's second
  //   target: it doesn't leap again), strike (a rogue's Cunning Strike: 'poison' | 'trip' | 'withdraw'), uncanny
  //   (the target halves the damage with Uncanny Dodge) }. The action is taken as the actor's level has it
  //   (Actions.at: cantrips grow at 5).
  // Returns { id, outcome: 'hit' | 'miss' | 'crit', rolls: [...], hits: [{ target, amount, parts, saved, heal,
  //   turned, slept, adds (conditions to put on it when the hit lands), push (squares), note }] (one per target,
  //   same order), shielded, savage (Savage Attacker was used), leap (Chromatic Orb may leap), decoys (Mirror
  //   Image duplicates hit instead: the caller removes them), log: [lines] }.
  function resolve(id, actor, targets, opts) {
    const A = Actions.at(Actions.get(id), actor.level || 1), res = { id, outcome: 'hit', rolls: [], hits: [], log: [] };
    const run = { attack, auto, save, heal, turn, reaction, sleep, buff, wake, rays, teleport, condition, sphere, surge, hide, preserve, aid, restore, stabilize, revive }[A.kind];
    run(A, actor, targets, opts, res);
    return res;
  }

  // ---------- Kinds ----------

  // A weapon or spell attack. On a hit: the weapon's damage (rolled twice with Savage Attacker), its extra
  // damage, a monster's extra die when it had advantage, the action's extra (Sneak Attack, Divine Smite), and the
  // conditions it leaves (the spell's, the weapon mastery's).
  // A Champion's weapon attacks crit on 19 or 20; an Evoker's damaging cantrip that misses still does half
  // (Potent Cantrip: res.potent, with nothing else it would leave).
  function attack(A, actor, targets, opts, res) {
    const target = targets[0], w = weapon(A, actor, opts), critOn = has(actor, 'improvedCritical') && A.with !== 'spell' ? 19 : 20;
    const r = attackRoll(actor, w.bonus, target, { ...opts, critOn });
    res.rolls.push(r);
    res.outcome = r.outcome;
    let line = `${actor.label} attacks ${target.label}${w.name ? ' with ' + w.name : ''}: ${rollText(r)} vs AC ${Conditions.ac(target)}. ${word(r.outcome)}${r.outcome === 'crit' && r.d20.value < 20 ? ' (19: Improved Critical)' : ''}.`;
    if (r.outcome === 'miss' && A.cantrip && has(actor, 'potentCantrip') && w.damage) {
      const d = damage(w.damage, w.type, target, opts.rng), half = Math.floor(d.amount / 2);
      res.potent = half;
      res.hits.push({ target, amount: half, potent: true });
      res.log.push(`${line} Potent Cantrip: half of ${d.text} = ${half} damage.`);
      return;
    }
    if (r.outcome === 'miss') { res.hits.push({ target, amount: 0 }); res.log.push(line); return; }
    const fake = decoy(actor, target, images(target), opts.rng);
    if (fake && fake.fooled) { fooled(res, target, line + fake.text); return; }
    if (fake) line += fake.text;
    const crit = r.outcome === 'crit', main = damage(w.damage, w.type, target, opts.rng, crit), parts = [main];
    if (opts.savage && A.with !== 'spell') {
      const again = damage(w.damage, w.type, target, opts.rng, crit), keep = again.amount > main.amount ? again : main;
      parts[0] = { ...keep, text: `${keep.text} (Savage Attacker: ${main.amount} or ${again.amount})` };
      res.savage = true;
    }
    if (w.extra) parts.push(damage(w.extra.damage, w.extra.type, target, opts.rng, crit));
    if (w.advDamage && r.mode === 'adv') parts.push(damage(w.advDamage, w.type, target, opts.rng, crit));
    const cunning = A.extra && A.extra.damage === 'sneak' && has(actor, 'cunningStrike') && ['poison', 'trip', 'withdraw'].includes(opts.strike) ? opts.strike : null;
    if (A.extra) {
      const dice = A.extra.damage === 'sneak' ? (cunning ? actor.sneak.replace(/^(\d+)/, n => n - 1) : actor.sneak) : A.extra.damage;
      const extra = damage(dice, A.extra.type, target, opts.rng, crit);
      if (A.extra.vs && A.extra.vs.some(t => (target.tags || []).includes(t))) {
        const more = damage(A.extra.more, A.extra.type, target, opts.rng, crit);
        extra.amount += more.amount; extra.text += ' + ' + more.text;
      }
      parts.push(extra);
    }
    if (A.leap && !opts.noLeap && new Set(main.rolls).size < main.rolls.length) res.leap = true;
    const adds = [A.adds, mastery(w, actor)].filter(Boolean);
    let amount = parts.reduce((t, p) => t + p.amount, 0), after = '';
    if (opts.uncanny && amount > 0) { amount = Math.floor(amount / 2); res.uncanny = true; after += ` ${target.label} dodges: Uncanny Dodge halves it to ${amount}.`; }
    if (cunning) after += cunningStrike(cunning, actor, target, opts, res, adds);
    res.hits.push({ target, amount, parts: A.split && !res.uncanny ? [parts[0].amount, parts.slice(1).reduce((t, p) => t + p.amount, 0)] : undefined, note: notes(parts), adds: adds.length ? adds : undefined });
    res.log.push(line + ' ' + parts.map(p => p.text).join(' + ') + (parts.length > 1 ? ` = ${parts.reduce((t, p) => t + p.amount, 0)}` : '') + ' damage.' + after +
      adds.map(a => ` ${target.label} is ${Conditions.KINDS[a.id].name}.`).join('') + (res.leap ? ' Two dice match: the orb can leap!' : ''));
  }

  // Cunning Strike (a rogue, level 5): one Sneak Attack die given up for Poison (a CON save or poisoned, saving
  // again at the end of each of its turns), Trip (a DEX save or prone), or Withdraw (res.withdraw: combat gives half
  // the rogue's speed of movement with no opportunity attacks). DC 8 + Dex + proficiency. Returns the log text.
  function cunningStrike(kind, actor, target, opts, res, adds) {
    if (kind === 'withdraw') { res.withdraw = true; return ' Cunning Strike: Withdraw.'; }
    const dc = 8 + Creatures.mod(actor.abilities.dex) + Creatures.prof(actor.level), ability = kind === 'poison' ? 'con' : 'dex';
    const s = saveRoll(target, ability, dc, opts), id = kind === 'poison' ? 'poisoned' : 'prone';
    res.rolls.push(s);
    const immune = (target.immune || []).includes(id);
    if (!s.success && !immune) adds.push(kind === 'poison' ? { id, ends: 'never', dc } : { id, ends: 'never' });
    return ` Cunning Strike (${kind === 'poison' ? 'Poison' : 'Trip'}): ${ABILITY[ability]} save ${rollText(s)} vs DC ${dc}. ${immune ? `Immune to being ${id}.` : s.success ? 'Saved.' : 'Failed.'}`;
  }

  // Mirror Image: an attack roll that hits a creature with duplicates left rolls a d6 for each; if any comes up 3
  // or higher, a duplicate is hit instead and vanishes. Blindsight isn't fooled. Returns null (no duplicates, or
  // the attacker sees through them) or { fooled, text }.
  const images = c => (Conditions.get(c, 'mirrored') || {}).images || 0;
  function decoy(actor, target, left, rng) {
    if (!left || (actor.senses || []).includes('blindsight')) return null;
    const d = [];
    for (let k = 0; k < left; k++) d.push(Dice.roll('1d6', rng).total);
    const fooled = d.some(v => v >= 3);
    return { fooled, text: ` Mirror Image (d6: ${d.join(', ')}): ${fooled ? 'a duplicate is hit instead and vanishes' : 'it hits the real one'}.` };
  }
  function fooled(res, target, line) {
    res.outcome = 'miss';
    res.decoys = 1;
    res.hits.push({ target, amount: 0, decoy: true });
    res.log.push(line);
  }

  // The condition a weapon's mastery leaves on a hit (only heroes' sheets list one): Vex, the attacker's next
  // attack on it has advantage until the end of the attacker's next turn; Sap, its next attack roll has
  // disadvantage until the start of the attacker's next turn.
  function mastery(w, actor) {
    if (w.mastery === 'vex') return { id: 'vexed', ends: 'endOfBy', skip: 1 };
    if (w.mastery === 'sap') return { id: 'sapped', ends: 'startOfBy' };
    return null;
  }

  // Magic Missile: every dart hits; each rolls its own damage.
  function auto(A, actor, targets, opts, res) {
    const target = targets[0], darts = [];
    for (let k = 0; k < A.darts; k++) darts.push(damage(A.damage, A.type, target, opts.rng));
    const amount = darts.reduce((t, d) => t + d.amount, 0);
    res.hits.push({ target, amount, parts: darts.map(d => d.amount) });
    res.log.push(`${actor.label} casts ${A.name} at ${target.label}: ${A.darts} darts, ${darts.map(d => d.amount).join(' + ')} = ${amount} ${A.type} damage.`);
  }

  // One damage roll; each target saves on its own and takes all, half, or none.
  // An Evoker's cantrip (Potent Cantrip) does half on a save instead of nothing.
  function save(A, actor, targets, opts, res) {
    const halves = A.half || (A.cantrip && has(actor, 'potentCantrip'));
    const dc = A.dc === 'breath' ? actor.breath.dc : actor.spell.dc, type = A.types && A.types.includes(opts.type) ? opts.type : A.type;
    const expr = A.damage + plusOf(A, actor), roll = Dice.roll(expr, opts.rng), who = A.id === 'sphereBurn' ? `${actor.label}'s ${A.name} burns` : `${actor.label} ${A.dc === 'breath' ? 'breathes' : 'casts'} ${A.name}`;
    res.log.push(`${who} (DC ${dc} ${ABILITY[A.save]} save): ${expr} = ${roll.total} ${type}.`);
    for (const target of targets) {
      const s = saveRoll(target, A.save, dc, opts);
      res.rolls.push(s);
      const base = s.success ? (halves ? Math.floor(roll.total / 2) : 0) : roll.total;
      const d = adjust(target, base, type), push = A.push && !s.success ? A.push / 5 : 0;
      res.hits.push({ target, amount: d.amount, saved: s.success, note: d.note, push });
      res.log.push(`  ${target.label} ${ABILITY[A.save]} save: ${rollText(s)} vs DC ${dc}. ${s.success ? 'Saved' : 'Failed'}: ${d.amount} damage${d.note ? ' (' + d.note + ')' : ''}${push ? `, pushed ${A.push} ft` : ''}.`);
    }
    if (targets.length === 1) res.outcome = res.hits[0].saved ? 'miss' : 'hit';
    if (!targets.length) res.log.push('  It catches no one.');
  }

  // What an action adds to its dice: '+3' for the spellcasting modifier (plus: 'spell') or the level (plus:
  // 'level', Second Wind), or ''.
  function plusOf(A, actor) {
    const n = A.plus === 'spell' ? Creatures.mod(actor.abilities[actor.spell.ability]) : A.plus === 'level' ? actor.level || 1 : 0;
    return n ? (n < 0 ? '' : '+') + n : '';
  }

  // Healing dice plus the spellcasting modifier (a spell) or the level (Second Wind). Disciple of Life (Life
  // Domain): a healing spell cast with a slot heals 2 + the slot level more.
  // Several targets (Mass Healing Word) each roll their own.
  function heal(A, actor, targets, opts, res) {
    const expr = A.heal + plusOf(A, actor), more = A.slot && has(actor, 'discipleOfLife') ? 2 + A.slot : 0, hows = [];
    for (const target of targets) {
      const r = Dice.roll(expr, opts.rng), total = r.total + more;
      res.hits.push({ target, amount: total, heal: true });
      hows.push(`${expr} = ${r.total}${more ? ` + ${more} (Disciple of Life) = ${total}` : ''} HP`);
    }
    if (A.feature) res.log.push(`${actor.label} uses ${A.name}: ${hows[0]}.`);
    else if (targets.length === 1) res.log.push(`${actor.label} casts ${A.name} on ${targets[0].label}: ${hows[0]}.`);
    else res.log.push(`${actor.label} casts ${A.name}: ${targets.map((t, i) => `${t.label} ${hows[i]}`).join('; ')}.`);
  }

  // Revivify: back from the dead with 1 HP (combat brings the figure back).
  function revive(A, actor, targets, opts, res) {
    res.hits.push({ target: targets[0], amount: 0, revive: true });
    res.log.push(`${actor.label} casts ${A.name} on ${targets[0].label}: back with 1 HP!`);
  }

  // Preserve Life: 5 × the cleric's level in HP, shared among the targets (bloodied friends), the most hurt first,
  // none raised above half its HP maximum.
  function preserve(A, actor, targets, opts, res) {
    let pool = A.pool * (actor.level || 1);
    const give = new Map(targets.map(t => [t, 0]));
    for (let left = true; pool > 0 && left;) {
      left = false;
      for (const t of [...targets].sort((a, b) => (Math.max(0, a.hp) + give.get(a)) / a.maxHp - (Math.max(0, b.hp) + give.get(b)) / b.maxHp)) {
        if (pool <= 0) break;
        if (Math.max(0, t.hp) + give.get(t) >= Math.floor(t.maxHp / 2)) continue;
        give.set(t, give.get(t) + 1); pool--; left = true;
      }
    }
    for (const t of targets) res.hits.push({ target: t, amount: give.get(t), heal: true });
    res.log.push(`${actor.label} presents the holy symbol: Preserve Life (${A.pool * (actor.level || 1)} HP to share). ${targets.length ? targets.map(t => `${t.label} +${give.get(t)}`).join(', ') : 'No one is bloodied'}.`);
  }

  // Aid: each target's HP maximum and HP go up (once: a second Aid doesn't add more).
  function aid(A, actor, targets, opts, res) {
    for (const t of targets) res.hits.push({ target: t, amount: 0, aid: Conditions.has(t, 'aided') ? 0 : A.hp });
    res.log.push(`${actor.label} casts ${A.name} on ${targets.map(t => t.label).join(', ')}: +${A.hp} HP maximum and HP.`);
  }

  // Spare the Dying: the dying creature is stable (no more death saves).
  function stabilize(A, actor, targets, opts, res) {
    res.hits.push({ target: targets[0], amount: 0, stabilize: true });
    res.log.push(`${actor.label} casts ${A.name} on ${targets[0].label}: stable.`);
  }

  // Lesser Restoration: ends one condition it can end (paralysis) on the target.
  function restore(A, actor, targets, opts, res) {
    const t = targets[0], id = A.ends.find(id => Conditions.has(t, id));
    res.hits.push({ target: t, amount: 0, ends: id });
    res.log.push(`${actor.label} casts ${A.name} on ${t.label}${id ? `: no longer ${Conditions.KINDS[id].name}` : ''}.`);
  }

  // Sleep: each creature in the area makes a Wisdom save or is drowsy (incapacitated) until the end of its next
  // turn, when it saves again or falls asleep (sleepAgain). Creatures that don't sleep (elves' Trance) or can't be
  // exhausted (undead) are unaffected; anyone already down is skipped.
  function sleep(A, actor, targets, opts, res) {
    const dc = actor.spell.dc;
    res.log.push(`${actor.label} casts ${A.name} (DC ${dc} WIS save).`);
    for (const t of targets) {
      const why = t.hp <= 0 ? 'already down' : has(t, 'trance') ? 'an elf: magic can\'t put elves to sleep' : (t.tags || []).includes('undead') ? 'undead never sleep' : null;
      if (why) { res.hits.push({ target: t, saved: true }); res.log.push(`  ${t.label}: unaffected, ${why}.`); continue; }
      const s = saveRoll(t, 'wis', dc, opts);
      res.rolls.push(s);
      res.hits.push({ target: t, slept: !s.success, saved: s.success, adds: s.success ? undefined : [{ id: 'drowsy', ends: 'endOfSelf' }] });
      res.log.push(`  ${t.label} WIS save: ${rollText(s)} vs DC ${dc}. ${s.success ? 'Saved: stays awake' : 'Failed: drowsy, it can\'t act'}.`);
    }
    if (!targets.length) res.log.push('  It catches no one.');
    res.outcome = res.hits.some(h => h.slept) ? 'hit' : 'miss';
  }

  // Sleep's second save, at the end of a drowsy creature's turn: a failure and it's asleep (unconscious) until the
  // spell ends, it's hurt, or someone shakes it. Returns { success, text }.
  function sleepAgain(c, caster, opts) {
    const dc = caster.spell.dc, s = saveRoll(c, 'wis', dc, opts);
    return { ...s, text: `${c.label} WIS save against Sleep: ${rollText(s)} vs DC ${dc}. ${s.success ? 'Saved: it shakes off the drowsiness' : 'Failed: it falls asleep'}.` };
  }

  // A save or a condition (Hold Person: paralyzed; Hypnotic Pattern: charmed). Unaffected: a creature it doesn't
  // work on (Hold Person needs a Humanoid), one immune to the condition (the slime can't be charmed), and for a
  // pattern, one that can't see it (asleep, or down).
  function condition(A, actor, targets, opts, res) {
    const dc = actor.spell.dc, K = Conditions.KINDS[A.adds.id];
    res.log.push(`${actor.label} casts ${A.name} (DC ${dc} ${ABILITY[A.save]} save).`);
    for (const t of targets) {
      const why = !Actions.fits(A, t) ? `not a ${A.only}` : (t.immune || []).includes(K.as) ? `can't be ${K.as}` :
        A.area && (t.hp <= 0 || Conditions.asleep(t)) ? 'can\'t see it' : null;
      if (why) { res.hits.push({ target: t, saved: true }); res.log.push(`  ${t.label}: unaffected, ${why}.`); continue; }
      const s = saveRoll(t, A.save, dc, { ...opts, against: A.adds.id });
      res.rolls.push(s);
      res.hits.push({ target: t, saved: s.success, adds: s.success ? undefined : [A.adds] });
      res.log.push(`  ${t.label} ${ABILITY[A.save]} save: ${rollText(s)} vs DC ${dc}. ${s.success ? 'Saved' : 'Failed: ' + K.name}.`);
    }
    if (!targets.length) res.log.push('  It catches no one.');
    res.outcome = res.hits.some(h => h.adds) ? 'hit' : 'miss';
  }

  // The save a condition allows again at the end of each of the creature's turns (Hold Person): a success ends it.
  // e: the condition. Returns { success, text }.
  function repeatSave(c, e, opts) {
    const K = Conditions.KINDS[e.id], dc = e.dc || e.by.spell.dc, s = saveRoll(c, K.repeat, dc, { ...opts, against: e.id });
    return { ...s, text: `${c.label} ${ABILITY[K.repeat]} save to end ${K.name}: ${rollText(s)} vs DC ${dc}. ${s.success ? 'Saved: free' : 'Failed'}.` };
  }

  // Action Surge: one more action this turn (combat gives it back).
  function surge(A, actor, targets, opts, res) {
    res.hits.push({ target: actor, amount: 0 });
    res.log.push(`${actor.label} pushes on: Action Surge, one more action.`);
  }

  // Hide: a DC 15 Dexterity (Stealth) check; the total is what an enemy's Perception must reach to find it.
  function hide(A, actor, targets, opts, res) {
    const r = check(actor, 'stealth', A.dc, opts);
    res.rolls.push(r);
    res.outcome = r.success ? 'hit' : 'miss';
    res.hits.push({ target: actor, amount: 0, adds: r.success ? [{ id: 'hidden', ends: 'never', total: r.total }] : undefined });
    res.log.push(`${actor.label} tries to hide. ${r.text}${r.success ? ' Hidden.' : ' Still seen.'}`);
  }

  // Flaming Sphere appearing, or rolled (its fire is sphereBurn, a save).
  function sphere(A, actor, targets, opts, res) {
    res.log.push(A.id === 'flamingSphere' ? `${actor.label} casts Flaming Sphere: a ball of fire rolls out onto the floor.` : `${actor.label} rolls the Flaming Sphere.`);
  }

  // A spell that puts a condition on its targets (Bless, Shield of Faith).
  function buff(A, actor, targets, opts, res) {
    for (const target of targets) res.hits.push({ target, amount: 0, adds: [A.adds] });
    res.log.push(`${actor.label} casts ${A.name}${A.target === 'self' ? '' : ' on ' + targets.map(t => t.label).join(', ')}: ${Conditions.KINDS[A.adds.id].name}.`);
  }

  // Scorching Ray: an attack roll per ray, each hitting for its own damage (parts: one per ray, 0 for a miss).
  // opts.restMode: the mode after the first ray, when something gave only the first attack advantage.
  function rays(A, actor, targets, opts, res) {
    const target = targets[0], parts = [], words = [];
    let left = images(target);
    for (let k = 0; k < A.rays; k++) {
      const r = attackRoll(actor, actor.spell.attack, target, k && opts.restMode ? { ...opts, mode: opts.restMode } : opts);
      res.rolls.push(r);
      const fake = r.outcome === 'miss' ? null : decoy(actor, target, left, opts.rng);
      if (fake && fake.fooled) { left--; res.decoys = (res.decoys || 0) + 1; parts.push(0); words.push(`ray ${k + 1}: ${rollText(r)}, a duplicate`); continue; }
      const d = r.outcome === 'miss' ? null : damage(A.damage, A.type, target, opts.rng, r.outcome === 'crit');
      parts.push(d ? d.amount : 0);
      words.push(`ray ${k + 1}: ${rollText(r)}, ${d ? `${word(r.outcome).toLowerCase()} for ${d.amount}` : 'miss'}`);
    }
    const amount = parts.reduce((t, n) => t + n, 0);
    res.outcome = parts.some(n => n > 0) ? 'hit' : 'miss';
    res.hits.push({ target, amount, parts });
    res.log.push(`${actor.label} casts ${A.name} at ${target.label} (vs AC ${Conditions.ac(target)}): ${words.join('; ')}. ${amount} fire damage in all.`);
  }

  // Misty Step: the caster steps through silver mist to the square (combat moves them).
  function teleport(A, actor, targets, opts, res) {
    res.hits.push({ target: actor, amount: 0 });
    res.log.push(`${actor.label} casts ${A.name} and vanishes in silver mist.`);
  }

  // Shaking a sleeping friend awake (an action, no roll).
  function wake(A, actor, targets, opts, res) {
    res.hits.push({ target: targets[0], amount: 0, wakes: true });
    res.log.push(`${actor.label} shakes ${targets[0].label} awake.`);
  }

  // Concentration after taking damage: a CON save, DC 10 or half the damage if that's more.
  function concentrationSave(c, damage, opts) {
    const dc = Math.max(10, Math.floor(damage / 2)), s = saveRoll(c, 'con', dc, opts);
    return { ...s, text: `  ${c.label} keeps concentrating? CON save: ${rollText(s)} vs DC ${dc}. ${s.success ? 'Yes' : 'No'}.` };
  }

  // A death saving throw (docs/dnd-game/rules.md section 5): d20, 10 or more succeeds; a natural 20 wakes with 1 HP, a
  // natural 1 counts as two failures. Returns { d20, total, result: 'success' | 'fail' | 'fail2' | 'revive' }.
  function deathSave(creature, opts) {
    const d = Dice.d20(opts.rng, { lucky: has(creature, 'lucky'), fixed: opts.fixed ?? null });
    const result = d.value === 20 ? 'revive' : d.value === 1 ? 'fail2' : d.value >= 10 ? 'success' : 'fail';
    return { kind: 'death', d20: d, bonus: 0, total: d.value, vs: 'DC 10', result };
  }

  // Turn Undead: each undead rolls a Wisdom save against the spell DC; on a failure it's turned (it flees).
  // Sear Undead (level 5): the undead that fail also take Wis-modifier d8s of radiant (one roll), which doesn't end
  // the turning (hit.keepTurned).
  function turn(A, actor, targets, opts, res) {
    const dc = actor.spell.dc, sear = has(actor, 'searUndead') ? Math.max(1, Creatures.mod(actor.abilities.wis)) + 'd8' : null;
    const burn = sear ? Dice.roll(sear, opts.rng) : null;
    res.log.push(`${actor.label} presents the holy symbol: Turn Undead (DC ${dc} WIS save)${burn ? `; Sear Undead ${sear} = ${burn.total} radiant` : ''}.`);
    for (const target of targets) {
      const s = saveRoll(target, A.save, dc, opts), d = burn && !s.success ? adjust(target, burn.total, 'radiant') : null;
      res.rolls.push(s);
      res.hits.push({ target, saved: s.success, turned: !s.success, amount: d ? d.amount : undefined, keepTurned: true, adds: s.success ? undefined : [{ id: 'turned', ends: 'never' }] });
      res.log.push(`  ${target.label} WIS save: ${rollText(s)} vs DC ${dc}. ${s.success ? 'Saved' : 'Turned'}${d ? `, ${d.amount} radiant` : ''}.`);
    }
    if (!targets.length) res.log.push('  No undead within 30 ft.');
    res.outcome = res.hits.some(h => h.turned) ? 'hit' : 'miss';
  }

  // Shield: the enemy's attack is rolled against the wizard's AC. If it would hit, Shield adds 5 to AC (a natural
  // 20 still hits); a roll that beats AC + 5 gets through.
  function reaction(A, actor, targets, opts, res) {
    const target = targets[0], w = actor.attacks[opts.with], r = attackRoll(actor, w.bonus, target, opts);
    res.rolls.push(r);
    const ac = Conditions.ac(target), blocked = r.outcome === 'hit' && r.total < ac + A.ac;
    res.shielded = blocked;
    let line = `${actor.label} attacks ${target.label} with ${w.name}: ${rollText(r)} vs AC ${ac}.`;
    if (blocked) line += ` ${target.label} casts Shield: AC ${ac + A.ac}. Miss.`;
    res.outcome = blocked ? 'miss' : r.outcome;
    if (res.outcome === 'miss') { res.hits.push({ target, amount: 0 }); res.log.push(blocked ? line : line + ' Miss.'); return; }
    const fake = decoy(actor, target, images(target), opts.rng);
    if (fake && fake.fooled) { fooled(res, target, line + fake.text); return; }
    if (fake) line += fake.text;
    const d = damage(w.damage, w.type, target, opts.rng, r.outcome === 'crit');
    res.hits.push({ target, amount: d.amount, note: d.note });
    res.log.push(`${line} ${word(r.outcome)}${r.outcome === 'hit' ? ' (too high for Shield to stop)' : ''}. ${d.text} damage.`);
  }

  // ---------- Rolls ----------

  // The weapon (or spell) an attack uses: { name, bonus, damage, type, extra, advDamage, mastery }. An action with
  // types takes the one picked (opts.type). True Strike swings the weapon with the spellcasting ability instead of
  // Strength or Dexterity.
  function weapon(A, actor, opts) {
    const type = A.types && A.types.includes(opts.type) ? opts.type : A.type;
    if (A.with === 'spell') return { name: A.types ? `${A.name} (${type})` : A.name, bonus: actor.spell.attack, damage: A.damage + plusOf(A, actor), type };
    const base = actor.attacks[A.with];
    if (!base) throw new Error(`${actor.label} has no ${A.with}`);
    const sacred = Conditions.has(actor, 'sacredWeapon') && !/\//.test(base.range || '') ? Math.max(1, Creatures.mod(actor.abilities.cha)) : 0;
    const w = sacred ? { ...base, bonus: base.bonus + sacred, name: base.name + ', sacred' } : base;   // Sacred Weapon: + Cha
    if (A.spellAbility) {
      const m = Creatures.mod(actor.abilities[actor.spell.ability]), dice = /^\d*d\d+/.exec(w.damage)[0];
      return { ...w, name: `${A.name} (${w.name}, ${type})`, bonus: actor.spell.attack, damage: dice + (m < 0 ? m : '+' + m), type: type || w.type };
    }
    return A.name ? { ...w, name: A.name + ` (${w.name})` } : w;
  }

  // d20 + bonus (+ 1d4 if blessed) against AC (with Shield of Faith): a natural 20 is a crit, a natural 1 always
  // misses.
  // opts.critOn: the lowest natural roll that crits (19 with Improved Critical).
  function attackRoll(actor, bonus, target, opts) {
    const ac = Conditions.ac(target), bless = blessing(actor, opts), need = ac - bonus - bless;
    const d = Dice.d20(opts.rng, { mode: opts.mode, lucky: has(actor, 'lucky'), fixed: opts.force ? forced(opts.force, need, opts.rng) : null });
    const total = d.value + bonus + bless;
    let outcome = d.value >= (opts.critOn || 20) ? 'crit' : d.value === 1 ? 'miss' : total >= ac ? 'hit' : 'miss';
    if (outcome === 'hit' && opts.autoCrit) outcome = 'crit';
    return { kind: 'attack', d20: d, bonus: bonus + bless, bless, total, vs: 'AC ' + ac, outcome, mode: opts.mode };
  }

  // Bless's 1d4, or 0.
  const blessing = (c, opts) => Conditions.has(c, 'blessed') ? Dice.roll('1d4', opts.rng).total : 0;

  // d20 + save bonus (+ 1d4 if blessed) against a DC (no automatic success or failure on saves, except that a
  // sleeper or a paralyzed creature fails STR and DEX saves). Advantage: Haste on DEX saves, Fey Ancestry (elves)
  // against being charmed (opts.against: the condition the save is against). Forcing 'hit' means the effect
  // lands: the save fails.
  function saveRoll(target, ability, dc, opts) {
    const bless = blessing(target, opts), bonus = Creatures.saveBonus(target, ability) + bless, need = dc - bonus;
    const fixed = opts.force ? forced(opts.force === 'miss' ? 'hit' : 'miss', need, opts.rng) : null;
    const charm = opts.against && Conditions.KINDS[opts.against].as === 'charmed' && has(target, 'feyAncestry');
    const mode = (ability === 'dex' && Conditions.has(target, 'hasted')) || charm ? 'adv' : 'normal';
    const d = Dice.d20(opts.rng, { mode, lucky: has(target, 'lucky'), fixed });
    const total = d.value + bonus, helpless = Conditions.helpless(target) && (ability === 'str' || ability === 'dex');
    return { kind: 'save', ability, d20: d, bonus, bless, total, vs: 'DC ' + dc, mode, success: total >= dc && !helpless };
  }

  // A d20 that gives an outcome: need is the lowest roll that succeeds.
  function forced(force, need, rng) {
    if (force === 'crit') return 20;
    const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    if (force === 'hit') return between(Math.min(19, Math.max(2, need)), 19);
    return need <= 2 ? 1 : between(1, Math.min(19, need - 1));
  }

  // Damage dice against a target: { amount (after resistance), rolls (the dice), text, note }.
  function damage(expr, type, target, rng, crit) {
    const r = Dice.roll(expr, rng, crit), d = adjust(target, r.total, type);
    return { amount: d.amount, rolls: r.rolls, note: d.note, text: `${crit ? expr.replace(/^(\d*)d/, (m, n) => (2 * (+n || 1)) + 'd') : expr} = ${r.total} ${type}${d.note ? ` (${d.note}: ${d.amount})` : ''}` };
  }

  // Immunity cancels damage, resistance halves it (rounded down), vulnerability doubles it.
  function adjust(target, amount, type) {
    if ((target.immune || []).includes(type)) return { amount: 0, note: 'immune' };
    if ((target.resist || []).includes(type)) return { amount: Math.floor(amount / 2), note: 'resisted' };
    if ((target.vulnerable || []).includes(type)) return { amount: amount * 2, note: 'vulnerable' };
    return { amount };
  }

  const has = (c, trait) => (c.traits || []).includes(trait);
  const notes = parts => parts.map(p => p.note).filter(Boolean).join(', ') || undefined;
  const word = o => o === 'crit' ? 'Critical hit' : o === 'hit' ? 'Hit' : 'Miss';
  // "14 + 5 = 19" (with the other die for advantage, or the rerolled 1 for Lucky).
  function rollText(r) {
    const d = r.d20, two = r.mode === 'adv' || r.mode === 'dis', luck = d.lucky ? (two ? '; Luck rerolled a 1' : 'Luck, rerolled a 1') : '';
    const other = two && d.dropped != null ? ` (${r.mode === 'adv' ? 'advantage' : 'disadvantage'}, other ${d.dropped}${luck})` : luck ? ` (${luck})` : '';
    const bonus = r.bless ? r.bonus - r.bless : r.bonus, bless = r.bless ? ` + ${r.bless} (Bless)` : '';
    return `${d.value}${other} ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}${bless} = ${r.total}`;
  }

  // An ability check (docs/dnd-game/rules.md section 3): d20 + the skill's bonus (or the ability modifier) against a DC.
  // Returns { kind: 'check', d20, bonus, total, vs, success, label }.
  // Tactical Mind (a fighter, level 2): a failed check can add 1d10 by spending a Second Wind, which is spent only
  // if that turns it into a success (r.tactical: the caller spends it).
  function check(creature, skillOrAbility, dc, opts) {
    const skill = Creatures.SKILL_ABILITY[skillOrAbility];
    const bonus = skill ? Creatures.skillBonus(creature, skillOrAbility) : Creatures.mod(creature.abilities[skillOrAbility]);
    const adv = skillOrAbility === 'athletics' && has(creature, 'remarkableAthlete'), dis = Conditions.has(creature, 'poisoned');   // a Champion; poison
    const mode = adv && !dis ? 'adv' : dis && !adv ? 'dis' : adv ? 'normal' : opts.mode;
    const d = Dice.d20(opts.rng, { mode, lucky: has(creature, 'lucky'), fixed: opts.fixed ?? null });
    let total = d.value + bonus, text = `${creature.label} ${skillOrAbility} check: ${d.value} ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)} = ${total} vs DC ${dc}.`, tactical = null;
    if (total < dc && has(creature, 'tacticalMind') && ((creature.uses || {}).secondWind || 0) > 0) {
      const extra = Dice.roll('1d10', opts.rng).total;
      tactical = { roll: extra, spent: total + extra >= dc };
      text += ` Tactical Mind: +${extra} = ${total + extra}${tactical.spent ? ' (a Second Wind spent)' : ' (still short: the Second Wind is kept)'}.`;
      if (tactical.spent) total += extra;
    }
    return { kind: 'check', d20: d, bonus: total - d.value, total, vs: 'DC ' + dc, success: total >= dc, skill: skillOrAbility, tactical,
      text: `${text} ${total >= dc ? 'Success' : 'Failure'}.` };
  }

  return { resolve, adjust, deathSave, check, concentrationSave, sleepAgain, repeatSave };
})();
