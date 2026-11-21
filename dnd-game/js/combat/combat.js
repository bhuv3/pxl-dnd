// Combat: one turn-based fight (docs/dnd-game/combat.md). Rolls initiative, runs turns in order, and gives every creature
// the same moves: walk square by square (provoking opportunity attacks), act (Rules rolls, Fx shows it, damage
// lands on the effect's apply step), Dash, Disengage, Dodge, end the turn. Heroes wait for the player (the UI
// calls these); monsters, and heroes in auto mode, are played by CombatAI. Heroes at 0 HP make death saves.
// Spells leave conditions (Conditions): they tick at turn starts and ends, a creature that can't act skips its
// turn, some get a save to end them at the end of each turn, and a hurt caster may lose concentration. Area spells
// catch everyone on the squares of a cone, cube, or circle (areaOf). A Flaming Sphere sits on a square (in its
// caster's 'sphere' condition) and burns whoever ends a turn next to it. Haste gives an extra action for one
// weapon attack, Dash, or Disengage; Extra Attack makes the Attack action two attacks (turn.extra). Spirit Guardians
// burn enemies that come within 15 ft of the cleric or end a turn there. The fight ends when one side is down.
const Combat = (() => {
  const STEP_TIME = 0.16;                 // seconds per square walked
  const SACRED_LIGHT = { color: [1.5, 1.35, 0.9], radius: 40, power: 1.1, up: 6 };
  const WARDED_FROM = ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'];   // Protection from Evil and Good
  const PALETTE_OF = { poison: 'acid', thunder: 'force', bludgeoning: 'steel', slashing: 'steel', piercing: 'steel' };   // damage types drawn in another type's colors
  const anims = [];
  const listeners = { change: [], log: [], over: [] };
  let S = null;

  // ---------- Time ----------

  function init() { Stage.on('update', dt => tick(dt * Fx.getTimeScale())); }
  function tick(dt) {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.t += dt;
      a.fn(Math.min(1, a.t / a.time));
      if (a.t >= a.time) { anims.splice(i, 1); a.done(); }
    }
  }
  // Calls fn(k) with k going 0 → 1 over time seconds of the effect clock.
  function animate(time, fn) { return new Promise(done => anims.push({ t: 0, time, fn, done })); }
  const wait = s => animate(s, () => {});

  function on(name, fn) { listeners[name].push(fn); }
  function emit(name, arg) { if (name === 'change') showConditions(); listeners[name].forEach(fn => fn(arg)); }

  // The labels over each figure (ZZ, SLOW, BLESS...), from its creature's conditions, and its mirror images.
  function showConditions() {
    if (S) for (const f of S.figs) {
      f.status = f.creature.slain ? [] : Conditions.shown(f.creature);
      f.images = (Conditions.get(f.creature, 'mirrored') || {}).images || 0;
      f.light = Conditions.has(f.creature, 'sacredWeapon') ? SACRED_LIGHT : undefined;         // Sacred Weapon glows
    }
  }
  const everyone = () => S.figs.map(f => f.creature);
  function log(lines) { lines = [].concat(lines); if (lines.length) emit('log', lines); }

  // ---------- Start and the turn loop ----------

  // Starts a fight. figs: figures with .creature and .side ('hero' / 'enemy'). opts: { rng, auto (heroes play
  // themselves: for tests), dice (show rolls in the tray), practice (the practice page's switches, changed while it
  // runs: { unkillable: enemies get straight back up, passive: enemies just wait, endless: heroes get their
  // action, movement, slots, and uses back after everything they do }) }.
  function start(figs, opts) {
    S = { figs, order: [], index: -1, round: 0, turnNo: 0, rng: opts.rng, auto: !!opts.auto, dice: opts.dice !== false, turn: null, over: null, busy: false, wake: null, practice: opts.practice || null };
    for (const f of figs) f.full = { slots: structuredClone(f.creature.slots), uses: structuredClone(f.creature.uses) };
    for (const f of figs) { Object.assign(f.creature, { reaction: true, dodging: false, deathSaves: { s: 0, f: 0 }, stable: false, slain: false }); Conditions.clear(f.creature); }
    rollInitiative();
    run();
  }

  // d20 + Dex modifier each (+ proficiency with the Alert feat); monsters of the same kind share one roll. Highest
  // first; ties go to the higher Dex, then to the heroes.
  function rollInitiative() {
    const shared = new Map(), lines = ['Roll for initiative!'];
    for (const f of S.figs) {
      const c = f.creature, dex = Creatures.mod(c.abilities.dex) + ((c.traits || []).includes('alert') ? Creatures.prof(c.level) : 0);
      if (!c.hero && shared.has(c.id)) { f.init = shared.get(c.id); continue; }
      const d = Dice.d20(S.rng, { lucky: (c.traits || []).includes('lucky'), mode: (c.traits || []).includes('remarkableAthlete') ? 'adv' : 'normal' });
      f.init = d.value + dex;
      if (!c.hero) shared.set(c.id, f.init);
      lines.push(`  ${c.hero ? c.label : c.name + (S.figs.filter(o => o.creature.id === c.id).length > 1 ? 's' : '')}: ${d.value} ${dex < 0 ? '-' : '+'} ${Math.abs(dex)} = ${f.init}`);
    }
    S.order = [...S.figs].sort((a, b) => b.init - a.init || b.creature.abilities.dex - a.creature.abilities.dex || (b.side === 'hero') - (a.side === 'hero'));
    log(lines);
  }

  // The turn loop. A fight replaced by a newer one (Start again, Fight again) just stops.
  async function run() {
    const me = S;
    while (!S.over && S === me) {
      S.index = (S.index + 1) % S.order.length;
      if (S.index === 0) { S.round++; log(`Round ${S.round}`); }
      await takeTurn(S.order[S.index]);
      if (S !== me) return;
      checkEnd();
    }
    if (S !== me) return;
    S.turn = null;
    for (const f of S.figs) { Conditions.clear(f.creature); f.maxHp = f.creature.maxHp; f.hp = f.creature.hp; }   // Aid's HP goes
    emit('change');
    emit('over', S.over);
  }

  async function takeTurn(f) {
    const c = f.creature, me = S;
    if (c.slain || (c.hp <= 0 && (!c.hero || c.stable))) return;
    c.dodging = false;
    c.reaction = true;
    log(Conditions.turnStart(c, everyone()));
    S.turnNo++;
    // in squares (a diagonal step costs √2); slotSpell: a spell with a slot was cast (only one a turn); haste:
    // Haste's extra action is still there
    // extra: attacks left in this turn's Attack action (Extra Attack)
    S.turn = { fig: f, move: Conditions.speed(c) / 5, action: true, bonus: true, disengaged: false, slotSpell: false, haste: Conditions.has(c, 'hasted'), extra: 0 };
    if (Conditions.has(c, 'prone') && c.hp > 0 && !Conditions.incapacitated(c)) {          // getting up: half the movement
      Conditions.remove(c, 'prone');
      S.turn.move = Math.max(0, S.turn.move - Conditions.speed(c) / 10);
      log(`${c.label} gets up.`);
    }
    if (guardiansAround(f).length) { S.turn.move /= 2; log(`${c.label} wades through the spirits: half speed.`); }
    emit('change');
    spot(f);
    if (c.hp <= 0) await deathSave(f);
    else if (Conditions.has(c, 'turned')) { log(`${c.label} flees from ${Conditions.get(c, 'turned').by.label}!`); await CombatAI.flee(f, guarded(me), S.figs.find(o => o.creature === Conditions.get(c, 'turned').by)); }
    else if (Conditions.incapacitated(c)) { log(`${c.label} can't act: ${Conditions.why(c)}.`); await wait(0.4); }
    else if (practice('passive') && f.side === 'enemy') { log(`${c.label} waits.`); await wait(0.2); }
    else if (f.side === 'hero' && !S.auto) await new Promise(resolve => { S.wake = resolve; emit('change'); });
    else { await wait(0.3); if (S === me) await CombatAI.takeTurn(f, guarded(me)); }
    if (S !== me) return;                            // a newer fight started meanwhile: leave it alone
    await scorch(f);
    await guard(f);
    if (S !== me) return;
    if (Conditions.has(c, 'drowsy')) sleepAgain(f);
    if (!c.slain) saveAgain(f);
    log(Conditions.turnEnd(c, everyone()));
    S.turn = null;
  }

  // At the start of its turn, a creature that can see a hidden enemy finds it if its passive Perception reaches
  // the enemy's Stealth check.
  function spot(f) {
    if (f.creature.hp <= 0 || Conditions.incapacitated(f.creature)) return;
    for (const o of foesOf(f)) {
      const e = Conditions.get(o.creature, 'hidden');
      if (!e || !Squares.sight(Squares.of(f), Squares.of(o), true) || Creatures.passive(f.creature) < e.total) continue;
      Conditions.remove(o.creature, 'hidden');
      log(`${f.creature.label} spots ${o.creature.label} (passive Perception ${Creatures.passive(f.creature)} vs ${e.total}).`);
      emit('change');
    }
  }

  // A practice switch, if this fight has them.
  const practice = name => !!(S.practice && S.practice[name]);

  // Practice: a hero gets everything back after each thing they do.
  function refill(f) {
    if (!practice('endless') || f.side !== 'hero' || !S.turn || S.turn.fig !== f) return;
    Object.assign(S.turn, { action: true, bonus: true, slotSpell: false, extra: 0, haste: Conditions.has(f.creature, 'hasted'), move: Conditions.speed(f.creature) / 5 });
    Object.assign(f.creature, { reaction: true, slots: structuredClone(f.full.slots), uses: structuredClone(f.full.uses) });
  }

  function endTurn() { if (S && S.wake && !S.busy) { const w = S.wake; S.wake = null; w(); } }

  // Victory when every enemy is slain; defeat when no hero is still standing.
  function checkEnd() {
    if (S.over) return;
    if (side('enemy').every(f => f.creature.slain)) S.over = 'victory';
    else if (side('hero').every(f => f.creature.hp <= 0)) S.over = 'defeat';
    if (S.over === 'victory') {
      const down = side('hero').filter(f => f.creature.hp <= 0 && !f.creature.slain);
      down.forEach(f => { f.creature.stable = true; });
      log(['Victory!', ...down.map(f => `  ${f.creature.label} is bandaged up: stable at 0 HP.`)]);
    }
    if (S.over === 'defeat') log('The party has fallen.');
  }

  // ---------- Queries ----------

  const side = s => S.figs.filter(f => f.side === s);
  const standing = f => !f.creature.slain && f.creature.hp > 0;
  const foesOf = f => S.figs.filter(o => o.side !== f.side && !o.creature.slain);
  const current = () => S && S.turn ? S.turn.fig : null;

  // Where the current creature can walk with its movement left.
  function reachable(f = current()) { return Squares.reachable(f, S.turn.move + (S.turn.freeMove || 0), S.figs.filter(o => o !== f)); }

  // Can f use this action now, and on whom? Returns { ok, why, targets: [{ fig, chance, mode }] }.
  function options(f, id) {
    const c = f.creature, A = Actions.at(Actions.get(id), c.level), t = S.turn;
    const cost = A.cost || 'action';
    if (!t || t.fig !== f) return { ok: false, why: 'Not your turn' };
    if (cost === 'action' && !t.action && !(t.extra > 0 && attacky(A)) && !(t.haste && hasty(A))) return { ok: false, why: t.extra > 0 ? 'Only an attack is left' : t.haste ? 'Haste\'s action is for one weapon attack' : 'Action used' };
    if (A.area === 'roll' && !Conditions.has(c, 'sphere')) return { ok: false, why: 'No Flaming Sphere' };
    if (cost === 'bonus' && !t.bonus) return { ok: false, why: 'Bonus action used' };
    if (A.smite && !t.bonus) return { ok: false, why: 'Bonus action used' };
    const free = A.free && (c.uses || {})[A.free] > 0;                   // Paladin's Smite: no slot needed
    if (A.slot && !free && !((c.slots || {})[A.slot] > 0)) return { ok: false, why: 'No spell slots left' };
    if (A.slot && !free && t.slotSpell) return { ok: false, why: 'One spell with a slot a turn' };
    if (A.kind === 'surge' && t.action) return { ok: false, why: 'Use your action first' };
    if (A.kind === 'hide' && Conditions.has(c, 'hidden')) return { ok: false, why: 'Already hidden' };
    if (A.id === 'steadyAim' && t.moved) return { ok: false, why: 'You moved this turn' };
    if (A.id === 'sacredWeapon' && Conditions.has(c, 'sacredWeapon')) return { ok: false, why: 'Already glowing' };
    if (A.id === 'spiritualStrike' && !Conditions.has(c, 'spiritual')) return { ok: false, why: 'No Spiritual Weapon' };
    if (A.hurt) return hurtOf(f, A).length ? { ok: true, targets: [{ fig: f, chance: 1 }] } : { ok: false, why: 'No one hurt within range' };
    if (A.target === 'bloodied') return bloodiedOf(f, A).length ? { ok: true, targets: [{ fig: f, chance: 1 }] } : { ok: false, why: 'No one bloodied within 30 ft' };
    if (A.kind === 'hide' && foesOf(f).some(e => standing(e) && Squares.sight(Squares.of(e), Squares.of(f), true))) return { ok: false, why: 'An enemy can see you: get behind a wall, pillar, or crate' };
    if (A.uses && !((c.uses || {})[A.uses] > 0)) return { ok: false, why: 'Used up until a rest' };
    if (A.area) return { ok: true, area: A.area, targets: [] };
    if (A.target === 'self' || A.target === 'party') return { ok: true, targets: [{ fig: f, chance: 1 }] };
    if (A.target === 'sleeper') {
      const near = S.figs.filter(o => o !== f && o.side === f.side && Conditions.shakeable(o.creature) && inRange(f, o, A));
      return near.length ? { ok: true, targets: near.map(o => ({ fig: o, chance: 1 })) } : { ok: false, why: 'No sleeping friend next to you' };
    }
    const pool = A.only === 'dead' ? S.figs.filter(o => o.side === f.side && o.creature.slain) : A.target === 'ally' ? S.figs.filter(o => o.side === f.side && !o.creature.slain) : foesOf(f);
    const targets = pool.filter(o => (o === f ? !A.others : inRange(f, o, A)) && Actions.fits(A, o.creature) && (!A.ends || A.ends.some(id => Conditions.has(o.creature, id)))).map(o => ({ fig: o, ...odds(f, o, A) }));
    const who = A.only === 'dead' ? 'fallen friend' : A.only === 'dying' ? 'one dying' : A.ends ? 'one paralyzed' : A.only === 'humanoid' ? 'humanoid (goblins are fey)' : A.only === 'unarmored' ? 'one in no armor' : A.target === 'ally' ? 'ally' : 'enemy';
    return targets.length ? { ok: true, targets } : { ok: false, why: A.range === 'melee' ? `No ${who} within reach` : `No ${who} in range and sight` };
  }

  // What Haste's extra action can do: one weapon attack (not a cantrip, not a Multiattack). Dash and Disengage
  // are in spend().
  const hasty = A => A.kind === 'attack' && A.with !== 'spell' && !A.spellAbility && !(A.repeat > 1);
  // One attack of the Attack action (Extra Attack's second one can be any of these): a weapon attack, or the
  // dragonborn breath, which stands in for one.
  const attacky = A => hasty(A) || A.dc === 'breath';

  function inRange(f, o, A) {
    if (o.creature.slain && A.only !== 'dead') return false;
    if (A.id === 'spiritualStrike') { const w = Conditions.get(f.creature, 'spiritual').sq, at = Squares.of(o); return Squares.distance(w, at) * 5 <= A.range && Squares.sight(w, at); }
    const r = reach(f, A), d = Squares.distance(Squares.of(f), Squares.of(o));
    if (r.melee) return Squares.adjacent(f, o);
    return d * 5 <= (r.long || r.range) && Squares.sight(Squares.of(f), Squares.of(o));
  }

  // How far an action reaches: melee (the 8 squares around), or a range and a long range in feet, from the action
  // or else from its weapon on the sheet ("80/320"). No range anywhere means melee.
  function reach(f, A) {
    if (A.range === 'melee') return { melee: true };
    if (A.range) return { range: A.range, long: A.long };
    const w = (f.creature.attacks || {})[A.with], m = w && /^(\d+)\/(\d+)$/.exec(w.range || '');
    return m ? { range: +m[1], long: +m[2] } : { melee: true };
  }

  // Advantage and disadvantage for an attack, a melee hit on an unconscious target being a crit, and the chance to
  // hit (for a save, the chance the target fails it).
  // A sleeper counts as unconscious, and a paralyzed creature is as helpless (a hit from next to it is a crit); a
  // Guiding Bolt's light, or the attacker's own Vex, gives the next attack advantage; a sapped attacker has
  // disadvantage; an incapacitated enemy next to an archer doesn't hinder it.
  function odds(f, o, A) {
    const t = o.creature, r = reach(f, A), melee = !!r.melee || !!A.summon, d = Squares.distance(Squares.of(f), Squares.of(o));
    const helpless = t.hp <= 0 || Conditions.helpless(t);
    const adv = helpless || Conditions.has(t, 'guided') || (Conditions.get(t, 'vexed') || {}).by === f.creature || Conditions.has(f.creature, 'hidden') || Conditions.has(f.creature, 'aiming') ||
      (Conditions.has(t, 'prone') && Squares.adjacent(f, o));
    const warded = Conditions.has(t, 'warded') && (f.creature.tags || []).some(k => WARDED_FROM.includes(k));
    const dis = warded || Conditions.has(f.creature, 'poisoned') || Conditions.has(f.creature, 'prone') || (Conditions.has(t, 'prone') && !Squares.adjacent(f, o)) || (t.dodging && !helpless) || Conditions.has(t, 'blurred') || Conditions.has(f.creature, 'sapped') || Conditions.has(t, 'hidden') ||
      (!melee && foesOf(f).some(e => standing(e) && !Conditions.incapacitated(e.creature) && Squares.adjacent(e, f))) || (!melee && r.long && d * 5 > r.range);
    const mode = adv && !dis ? 'adv' : dis && !adv ? 'dis' : 'normal';
    const autoCrit = helpless && Squares.adjacent(f, o);
    let chance = 1;
    if (A.kind === 'save' || A.kind === 'condition') chance = Math.min(1, Math.max(0, (f.creature.spell.dc - 1 - Creatures.saveBonus(t, A.save)) / 20));
    if (A.kind === 'attack' || A.kind === 'rays') {
      const bonus = (A.with === 'spell' || A.kind === 'rays' ? f.creature.spell.attack : f.creature.attacks[A.with].bonus) + (Conditions.has(f.creature, 'blessed') ? 2.5 : 0);
      const p = Math.min(0.95, Math.max(0.05, (21 - (Conditions.ac(t) - bonus)) / 20));
      chance = mode === 'adv' ? 1 - (1 - p) ** 2 : mode === 'dis' ? p * p : p;
    }
    return { chance, mode, autoCrit };
  }

  // The squares an area spell covers when aimed at a square, and who's on them. A cone (15 ft: 3 squares out,
  // as wide as it is far) and a line (5 ft wide) point from the caster toward the square; 'around' is a cube
  // centred on the caster (15 ft: the 8 squares round it), whatever the square; a circle sits on the square,
  // which must be in range and sight, and so does a cube (30 ft: 6 × 6 squares, the square just off its middle);
  // a spot is one free square in range (Misty Step, a new Flaming Sphere); a roll is where the caster's sphere
  // can go (rollOf). Distances by Pythagoras; walls block. Friends are caught too, unless the spell lets the
  // caster choose (Sleep). Returns { ok, why, squares, figs }.
  function areaOf(f, id, sq) {
    const A = Actions.get(id), from = Squares.of(f), n = A.size / 5, squares = [];
    if (A.area === 'roll') return rollOf(f, sq);
    const keep = (sx, sy, seen) => { if (!Squares.isWall(sx, sy) && Squares.sight(seen, { sx, sy })) squares.push({ sx, sy }); };
    const dx = sq.sx - from.sx, dy = sq.sy - from.sy, len = Math.hypot(dx, dy);
    if (A.area === 'spot') {
      if (Squares.isSolid(sq.sx, sq.sy) || S.figs.some(o => o !== f && Squares.occupies(o) && !o.creature.slain && Squares.of(o).sx === sq.sx && Squares.of(o).sy === sq.sy)) return { ok: false, why: 'Pick a free square' };
      if (Squares.distance(from, sq) * 5 > A.range) return { ok: false, why: `Out of range (${A.range} ft)` };
      if (!Squares.sight(from, sq)) return { ok: false, why: 'You can\'t see there' };
      return { ok: true, squares: [sq], figs: [] };
    }
    if (A.area === 'circle' || A.area === 'cube') {
      if (Squares.isWall(sq.sx, sq.sy)) return { ok: false, why: 'Aim at open floor' };
      if (Squares.distance(from, sq) * 5 > A.range) return { ok: false, why: `Out of range (${A.range} ft)` };
      if (!Squares.sight(from, sq)) return { ok: false, why: 'You can\'t see there' };
      if (A.area === 'cube') { const lo = -Math.floor((n - 1) / 2); for (let y = lo; y < lo + n; y++) for (let x = lo; x < lo + n; x++) keep(sq.sx + x, sq.sy + y, sq); }
      else for (let y = -n; y <= n; y++) for (let x = -n; x <= n; x++) if (Math.hypot(x, y) <= n + 0.25) keep(sq.sx + x, sq.sy + y, sq);
    } else if (A.area === 'aura') {                 // all round the caster, as far as it sees: Turn Undead's 30 ft
      for (let y = -n; y <= n; y++) for (let x = -n; x <= n; x++) if ((x || y) && Math.hypot(x, y) <= n + 0.25) keep(from.sx + x, from.sy + y, from);
    } else if (A.area === 'around') {
      const r = (n - 1) / 2;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x || y) keep(from.sx + x, from.sy + y, from);
    } else {
      if (!len) return { ok: false, why: 'Point the way it goes' };
      if (A.area === 'line') {
        const ux = dx / len, uy = dy / len;
        for (let k = 0.5; k <= n; k += 0.5) {
          const sx = Math.round(from.sx + ux * k), sy = Math.round(from.sy + uy * k);
          if (Squares.isWall(sx, sy)) break;
          if (!squares.some(s => s.sx === sx && s.sy === sy)) squares.push({ sx, sy });
        }
      } else if (A.area === 'cone') {
        for (let y = -n; y <= n; y++) for (let x = -n; x <= n; x++) {
          const d = Math.hypot(x, y);
          if (d > 0 && d <= n + 0.25 && (x * dx + y * dy) / (d * len) >= 0.887) keep(from.sx + x, from.sy + y, from);
        }
      }
    }
    const on = new Set(squares.map(s => Squares.key(s.sx, s.sy)));
    const at = o => { const s = Squares.of(o); return on.has(Squares.key(s.sx, s.sy)); };
    const figs = S.figs.filter(o => !o.creature.slain && at(o) && (!A.choose || o.side !== f.side) && (A.area === 'circle' || A.area === 'cube' || o !== f) &&
      (A.kind !== 'turn' || (o.creature.tags || []).includes('undead')));
    return { ok: true, squares, figs };
  }

  // Where the caster's Flaming Sphere can roll: a square within 30 ft of it that it can see, straight along the
  // floor. The first creature on the way (anyone) is rammed: it saves, and the sphere stops on the square before.
  // Returns { ok, why, squares (the way it rolls), figs (the rammed creature), stop (where it ends) }.
  function rollOf(f, sq) {
    const e = Conditions.get(f.creature, 'sphere'), from = e.sq, len = Squares.distance(from, sq);
    if (Squares.isSolid(sq.sx, sq.sy)) return { ok: false, why: 'Roll it onto open floor' };
    if (!len) return { ok: false, why: 'Pick where it rolls' };
    if (len * 5 > 30) return { ok: false, why: 'Too far (30 ft)' };
    if (!Squares.sight(from, sq)) return { ok: false, why: 'Something is in the way' };
    const squares = [];
    let stop = from;
    for (let k = 0.5; k <= len + 0.01; k += 0.5) {
      const s = { sx: Math.round(from.sx + (sq.sx - from.sx) * k / len), sy: Math.round(from.sy + (sq.sy - from.sy) * k / len) };
      if ((s.sx === from.sx && s.sy === from.sy) || squares.some(q => q.sx === s.sx && q.sy === s.sy)) continue;
      squares.push(s);
      const who = S.figs.find(o => !o.creature.slain && Squares.occupies(o) && Squares.of(o).sx === s.sx && Squares.of(o).sy === s.sy);
      if (who) return { ok: true, squares, figs: [who], stop };
      stop = s;
    }
    return { ok: true, squares, figs: [], stop };
  }

  // Mass Healing Word's: the most hurt friends in range and sight (the fallen too), up to max.
  function hurtOf(f, A) {
    const ratio = o => Math.max(0, o.creature.hp) / o.creature.maxHp;
    return S.figs.filter(o => o.side === f.side && !o.creature.slain && o.creature.hp < o.creature.maxHp && (o === f || (Squares.distance(Squares.of(f), Squares.of(o)) * 5 <= A.range && Squares.sight(Squares.of(f), Squares.of(o)))))
      .sort((a, b) => ratio(a) - ratio(b)).slice(0, A.max);
  }

  // Preserve Life's: friends within range (the caster too, the fallen too) at half their HP or less.
  function bloodiedOf(f, A) {
    return S.figs.filter(o => o.side === f.side && !o.creature.slain && o.creature.hp <= o.creature.maxHp / 2 && (o === f || Squares.distance(Squares.of(f), Squares.of(o)) * 5 <= A.range));
  }

  // Bless's targets: the caster and the nearest standing allies within range, up to max.
  function partyOf(f, A) {
    const d = o => Squares.distance(Squares.of(f), Squares.of(o));
    return S.figs.filter(o => o.side === f.side && standing(o) && d(o) * 5 <= A.range).sort((a, b) => (a !== f) - (b !== f) || d(a) - d(b)).slice(0, A.max);
  }

  // ---------- Doing things ----------

  // Walks to a reachable square, one square at a time; leaving an enemy's reach provokes an opportunity attack.
  async function moveTo(sx, sy) {
    const f = current();
    if (!f || S.busy) return false;
    const map = reachable(f), dest = map.get(Squares.key(sx, sy));
    if (!dest || dest.through || dest.cost === 0) return false;
    S.busy = true;
    emit('change');
    for (const step of Squares.path(map, sx, sy)) {
      const from = Squares.of(f);
      const cost = step.sx !== from.sx && step.sy !== from.sy ? Math.SQRT2 : 1, free = (S.turn.freeMove || 0) >= cost - 1e-6;
      if (!S.turn.disengaged && !free) for (const e of foesOf(f)) {
        if (!standing(e) || !Conditions.canOpportunity(e.creature) || !Squares.touching(Squares.of(e), from) || Squares.touching(Squares.of(e), step)) continue;
        const melee = (e.creature.actions || []).find(id => { const A = Actions.get(id); return A.kind === 'attack' && A.with !== 'spell' && reach(e, A).melee; });   // a weapon, never a spell
        if (!melee) continue;
        e.creature.reaction = false;
        log(`${e.creature.label} gets an opportunity attack!`);
        await attack(e, melee, f);
        if (!standing(f)) break;
      }
      if (!standing(f)) break;
      await walk(f, step);
      const fromFree = Math.min(S.turn.freeMove || 0, cost);                // Remarkable Athlete's move first
      S.turn.freeMove = (S.turn.freeMove || 0) - fromFree;
      S.turn.move -= cost - fromFree;
      S.turn.moved = true;
      if (standing(f)) await guard(f, true);                              // into Spirit Guardians, or bringing them
    }
    f.moving = false;
    S.busy = false;
    refill(f);
    emit('change');
    return true;
  }

  // One square of walking, with the walk frames turning over and the figure facing the way it goes.
  async function walk(f, step) {
    const to = Squares.feet(step.sx, step.sy), from = { x: f.x, y: f.y };
    if (Math.abs(to.x - from.x) > 1) f.dir = to.x > from.x ? 'east' : 'west';
    f.moving = true;
    const startT = f.walkT;
    await animate(STEP_TIME, k => { f.x = from.x + (to.x - from.x) * k; f.y = from.y + (to.y - from.y) * k; f.walkT = startT + k * 2; });
    f.x = to.x; f.y = to.y;
  }

  // Uses an action on a target (a figure, or for an area spell the square it's aimed at): pays its cost, rolls,
  // and plays it. A concentration spell ends the caster's last one. Divine Smite pays its slot and bonus action
  // only if the blow lands.
  // choice: what the player picked for it (Chromatic Orb's and True Strike's { type }).
  async function act(id, target, choice = {}) {
    const f = current();
    if (!f || S.busy) return false;
    const o = options(f, id), A = Actions.get(id), c = f.creature;
    const area = o.ok && A.area ? areaOf(f, id, target) : null;
    if (!o.ok || (A.area ? !area.ok : !o.targets.some(t => t.fig === target))) return false;
    S.busy = true;
    if (A.cost === 'free') { /* Action Surge: costs nothing but its use */ }
    else if ((A.cost || 'action') === 'bonus') S.turn.bonus = false;
    else if (S.turn.extra > 0 && attacky(A)) S.turn.extra--;                 // Extra Attack's second attack
    else if (S.turn.haste && hasty(A)) S.turn.haste = false;                // Haste's action first, keeping the real one
    else { S.turn.action = false; if (attacky(A) && (c.traits || []).includes('extraAttack')) S.turn.extra = 1; }
    if (A.slot && !A.smite) { c.slots[A.slot]--; S.turn.slotSpell = true; }
    if (A.uses) c.uses[A.uses]--;
    const group = ['teleport', 'sphere'].includes(A.kind) ? null : A.area ? area.figs : A.hurt ? hurtOf(f, A) : A.target === 'party' ? partyOf(f, A) : A.target === 'bloodied' ? bloodiedOf(f, A) : null;
    if (A.concentration) log(Conditions.concentrate(c, A.name, (A.kind === 'sphere' ? [f] : group || [target]).map(o => o.creature), everyone()));
    emit('change');
    try {
      if (A.kind === 'teleport') await blink(f, id, target);
      else if (id === 'flamingSphere') await conjure(f, id, target);
      else if (id === 'sphereMove') await roll(f, id, area);
      else if (A.summon) { await summon(f, id, target); await attack(f, id, target, choice); }
      else if (group) await many(f, id, group, A.area ? target : null);
      else for (let k = 0; k < (A.repeat || 1) && (!target.creature.slain || A.only === 'dead') && standing(f); k++) {   // Multiattack; Revivify's target is dead
        const res = await attack(f, id, target, choice);
        if (A.smite) smitten(f, res);
      }
      if (A.kind === 'surge') S.turn.action = true;
      if (id === 'steadyAim') S.turn.move = S.turn.freeMove = 0;                // Steady Aim: speed 0 for the turn
      if (id === 'secondWind' && (c.traits || []).includes('tacticalShift')) freeMove(f, 'Tactical Shift');
      if (id === 'spiritGuardians') wardOn(f);
    } catch (e) { console.error(`${A.name || id} failed:`, e); }      // never leave the turn stuck busy
    if (A.concentration && c.concentration && !everyone().some(o => (o.effects || []).some(e => e.by === c && Conditions.KINDS[e.id].concentration))) {
      c.concentration = null;                                        // it took hold of no one: nothing to keep up
      log(`  ${A.name} takes hold of no one.`);
    }
    S.busy = false;
    refill(f);
    checkEnd();
    emit('change');
    return true;
  }

  // Divine Smite after the swing: a hit spends the slot and the bonus action (the smite is in its damage); a miss
  // spends neither.
  // Paladin's Smite (level 2): the free one goes first, and it uses no slot.
  function smitten(f, res) {
    const c = f.creature;
    if (!res || res.outcome === 'miss') { log(`  No smite: the blow missed (the slot is kept).`); return; }
    S.turn.bonus = false;
    if ((c.uses || {}).paladinsSmite > 0) { c.uses.paladinsSmite--; log(`  Paladin's Smite: no slot spent (once a long rest).`); return; }
    c.slots[1]--;
    S.turn.slotSpell = true;
  }

  // Misty Step: the caster fades out in silver mist and steps out of it on the square (no opportunity attacks).
  async function blink(f, id, sq) {
    log(Rules.resolve(id, f.creature, [f.creature], { rng: S.rng }).log);
    await Fx.play(id, { caster: f, target: f, result: { outcome: 'hit', amount: 0 } });
    f.alpha = 0;
    Object.assign(f, Squares.feet(sq.sx, sq.sy));
    await Fx.play('mistyStepIn', { caster: f, target: f, result: { outcome: 'hit', amount: 0 } });
    f.alpha = 1;
  }

  // Spiritual Weapon: it appears (casting) or flies (a later bonus action) to the free square next to the target
  // nearest to where it is, and stays (drawn by Fx) until the cleric's concentration ends.
  async function summon(f, id, target) {
    const c = f.creature, me = S, t = Squares.of(target);
    let e = Conditions.get(c, 'spiritual');
    const from = e ? e.sq : Squares.of(f), free = [];
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const sq = { sx: t.sx + x, sy: t.sy + y };
      if ((x || y) && !Squares.isSolid(sq.sx, sq.sy) && !S.figs.some(o => !o.creature.slain && Squares.occupies(o) && Squares.of(o).sx === sq.sx && Squares.of(o).sy === sq.sy)) free.push(sq);
    }
    const sq = free.sort((a, b) => Squares.distance(a, from) - Squares.distance(b, from))[0] || t, to = Squares.feet(sq.sx, sq.sy);
    if (!e) {
      Conditions.add(c, 'spiritual', { by: c, ends: 'never', sq, x: to.x, y: to.y });
      e = Conditions.get(c, 'spiritual');
      Fx.keep(Shapes.spectralWeapon({ at: () => e, alive: () => S === me && !S.over && Conditions.get(c, 'spiritual') === e }));
      emit('change');
      return;
    }
    const p = { x: e.x, y: e.y };
    await animate(0.25, k => { e.x = p.x + (to.x - p.x) * k; e.y = p.y + (to.y - p.y) * k; });
    e.sq = sq; Object.assign(e, to);
  }

  // Flaming Sphere: a bead of fire flies to the square and swells into the sphere, which stays (drawn by Fx)
  // until the caster's concentration ends.
  async function conjure(f, id, sq) {
    const c = f.creature, me = S;
    log(Rules.resolve(id, c, [], { rng: S.rng }).log);
    const p = Squares.feet(sq.sx, sq.sy), point = { ...p, knockX: 0, knockY: 0 };
    await Fx.play(id, { caster: f, target: point, point, result: { outcome: 'hit', amount: 0 } });
    Conditions.add(c, 'sphere', { by: c, ends: 'never', sq: { ...sq }, x: p.x, y: p.y });
    const e = Conditions.get(c, 'sphere');
    Fx.keep(Shapes.fireBall({ at: () => e, alive: () => S === me && !S.over && Conditions.get(c, 'sphere') === e }));
  }

  // Rolls the caster's sphere along the floor (a bonus action); if it runs into a creature, that one saves against
  // its fire and the sphere stops just before it.
  async function roll(f, id, area) {
    const e = Conditions.get(f.creature, 'sphere');
    log(Rules.resolve(id, f.creature, [], { rng: S.rng }).log);
    const way = area.figs.length ? area.squares.slice(0, -1) : area.squares;      // not into the rammed one's square
    for (const s of way) await glide(e, s);
    e.sq = { ...area.stop };
    Object.assign(e, Squares.feet(e.sq.sx, e.sq.sy));
    if (area.figs.length) await burn(f, area.figs[0], 'rams');
  }
  async function glide(e, s) {
    const to = Squares.feet(s.sx, s.sy), from = { x: e.x, y: e.y };
    await animate(0.07, k => { e.x = from.x + (to.x - from.x) * k; e.y = from.y + (to.y - from.y) * k; });
  }

  // The sphere's fire on one creature: a DEX save, 2d6 fire, half on a save. how: 'rams' or 'scorches'.
  async function burn(owner, victim, how) {
    const e = Conditions.get(owner.creature, 'sphere');
    if (!e || victim.creature.slain) return;
    log(`${owner.creature.label}'s Flaming Sphere ${how} ${victim.creature.label}!`);
    const res = Rules.resolve('sphereBurn', owner.creature, [victim.creature], { rng: S.rng });
    log(res.log);
    if (S.dice && res.rolls.length) await DiceTray.show(traySpec(res.rolls[0], res));
    const point = { x: e.x, y: e.y - 3, knockX: 0, knockY: 0 }, h = res.hits[0];
    await Fx.play('sphereBurn', { caster: owner, target: victim, point, result: { outcome: res.outcome, amount: h.amount }, hits: [{ fig: victim, amount: h.amount, saved: h.saved, by: owner.creature }], onHit: apply });
  }

  // At the end of a creature's turn, every Flaming Sphere within 5 ft of it burns it.
  async function scorch(f) {
    for (const o of S.figs) {
      const e = Conditions.get(o.creature, 'sphere'), at = Squares.of(f);
      if (!e || f.creature.slain || Math.max(Math.abs(at.sx - e.sq.sx), Math.abs(at.sy - e.sq.sy)) > 1) continue;
      await burn(o, f, 'scorches');
      checkEnd();
    }
  }

  // An action on several at once (an area, Bless): one roll for all, each saves on their own; then anyone pushed
  // slides back.
  async function many(f, id, group, sq) {
    const res = Rules.resolve(id, f.creature, group.map(o => o.creature), { rng: S.rng });
    log(res.log);
    if (S.dice && res.rolls.length) await DiceTray.show(traySpec(res.rolls[0], res));
    const at = sq ? { x: sq.sx * Squares.SIZE + 5, y: sq.sy * Squares.SIZE + 7 } : { x: f.x, y: f.y };
    const point = { x: at.x, y: at.y, knockX: 0, knockY: 0 };
    const hits = res.hits.map((h, i) => ({ fig: group[i], amount: h.amount, saved: h.saved, adds: h.adds, heal: h.heal, aid: h.aid, keepTurned: h.keepTurned, by: f.creature, push: h.push }));
    await Fx.play(id, { caster: f, target: sq ? point : f, point, result: { outcome: res.outcome, amount: 0 }, hits, onHit: apply });
    for (const h of hits) if (h.push && standing(h.fig)) await push(h.fig, f, h.push);
  }

  // Pushed straight away from someone, square by square, until a wall or a creature is in the way (no
  // opportunity attacks: it isn't moving itself).
  async function push(fig, from, squares) {
    const a = Squares.of(from), b = Squares.of(fig), ux = Math.sign(b.sx - a.sx), uy = Math.sign(b.sy - a.sy);
    if (!ux && !uy) return;
    for (let k = 0; k < squares; k++) {
      const here = Squares.of(fig), nx = here.sx + ux, ny = here.sy + uy;
      const blocked = Squares.isSolid(nx, ny) || (ux && uy && (Squares.isSolid(here.sx + ux, here.sy) || Squares.isSolid(here.sx, here.sy + uy))) ||
        S.figs.some(o => o !== fig && Squares.occupies(o) && !o.creature.slain && Squares.of(o).sx === nx && Squares.of(o).sy === ny);
      if (blocked) { if (k === 0) log(`${fig.creature.label} is slammed against something and doesn't move.`); break; }
      const to = Squares.feet(nx, ny), p = { x: fig.x, y: fig.y };
      await animate(0.1, t => { fig.x = p.x + (to.x - p.x) * t; fig.y = p.y + (to.y - p.y) * t; });
      fig.x = to.x; fig.y = to.y;
    }
  }

  // Rolls an action against a target and plays it (also used for opportunity attacks). A wizard with a slot and
  // a reaction left raises Shield against an attack that would hit by less than 5. Savage Attacker works once a
  // turn. A Chromatic Orb whose damage dice match leaps on to the nearest other enemy within 30 ft of the target.
  // Returns the rules result.
  async function attack(f, id, target, choice = {}, leapt = false) {
    const A = Actions.get(id), o = ['self', 'ally', 'sleeper'].includes(A.target) || A.kind === 'buff' ? { mode: 'normal' } : odds(f, target, A);
    const c = f.creature, savage = (c.traits || []).includes('savageAttacker') && c.savageTurn !== S.turnNo;
    const t = target.creature;
    const uncanny = A.kind === 'attack' && target.side !== f.side && (t.traits || []).includes('uncannyDodge') && Conditions.canReact(t) && t.hp > 0;
    const opts = { rng: S.rng, mode: o.mode, autoCrit: o.autoCrit, type: choice.type, strike: choice.strike, savage, noLeap: leapt, uncanny };
    if (['attack', 'rays'].includes(A.kind)) {
      if (Conditions.has(t, 'guided')) Conditions.remove(t, 'guided');                              // its light is used up
      if ((Conditions.get(t, 'vexed') || {}).by === c) Conditions.remove(t, 'vexed');              // so is a Vex
      if (Conditions.has(c, 'sapped')) Conditions.remove(c, 'sapped');                              // and a Sap
      if (Conditions.has(c, 'aiming')) Conditions.remove(c, 'aiming');                              // Steady Aim, once
      if (A.kind === 'rays') opts.restMode = odds(f, target, A).mode;                                // ...on the first ray only
      emit('change');
    }
    let res, shielded = false;
    if (A.kind === 'attack' && A.with !== 'spell' && (t.reactions || []).includes('shield') && Conditions.canReact(t) && (t.slots || {})[1] > 0 && t.hp > 0) {
      res = Rules.resolve('shield', f.creature, [t], { ...opts, with: A.with });
      if (res.shielded) { shielded = true; t.reaction = false; t.slots[1]--; }
    } else res = Rules.resolve(id, c, [t], opts);
    if (res.savage) c.savageTurn = S.turnNo;
    if (res.uncanny) { t.reaction = false; const h = Figures.head(target); Popups.add('DODGE', h.x, h.y - 7, { color: 'info' }); }
    log(res.log);
    if (Conditions.has(c, 'hidden') && A.kind !== 'hide') { Conditions.remove(c, 'hidden'); log(`${c.label} is no longer hidden.`); }
    if (res.decoys) loseImages(t, res.decoys);
    if (S.dice && res.rolls.length) await DiceTray.show(traySpec(res.rolls[0], res));
    const hits = res.hits.map(h => ({ fig: target, amount: h.amount, parts: h.parts, heal: h.heal, adds: h.adds, wakes: h.wakes, ends: h.ends, stabilize: h.stabilize, revive: h.revive, by: c, crit: res.outcome === 'crit' }));
    const dtype = PALETTE_OF[choice.type || A.type] || choice.type || A.type;
    const spirit = A.summon && Conditions.get(c, 'spiritual'), point = spirit ? { x: spirit.x, y: spirit.y - 6 } : { x: target.x, y: target.y };
    const play = Fx.play(leapt ? 'chromaticOrbLeap' : id, { caster: leapt || f, target, point, result: { outcome: res.outcome, amount: hits[0].amount, parts: hits[0].parts, dtype }, hits, onHit: apply });
    await Promise.all([play, shielded ? Fx.play('shieldUp', { caster: target, target, result: { outcome: 'hit' } }) : null,
      res.decoys ? Fx.play('mirrorImageHit', { caster: target, target, result: { outcome: 'hit' } }) : null]);
    if (res.withdraw && S.turn && S.turn.fig === f) freeMove(f, 'Withdraw');
    if (res.potent) { apply({ ...hits[0] }); const h = Figures.head(target); Popups.add(String(res.potent), h.x, h.y, { color: 'damage' }); Popups.add('POTENT', h.x, h.y - 7, { color: 'miss' }); }
    if (res.outcome === 'crit' && (c.traits || []).includes('remarkableAthlete') && S.turn && S.turn.fig === f) freeMove(f, 'Remarkable Athlete');
    if (res.leap) await leap(f, id, target, choice, A);
    return res;
  }

  // Half its speed of movement that provokes no opportunity attacks (Remarkable Athlete, Tactical Shift, Withdraw).
  function freeMove(f, why) {
    S.turn.freeMove = (S.turn.freeMove || 0) + Conditions.speed(f.creature) / 10;
    log(`  ${why}: ${f.creature.label} can move ${Conditions.speed(f.creature) / 2} ft without provoking.`);
    emit('change');
  }

  // Spirit Guardians: the casters whose spirits are within 15 ft of f and hostile to it.
  function guardiansAround(f) {
    return S.figs.filter(o => o.side !== f.side && !o.creature.slain && Conditions.has(o.creature, 'guardians') && Squares.distance(Squares.of(o), Squares.of(f)) <= 3);
  }

  // The spirits strike: each enemy (f, or with moving set, also every enemy a moving cleric's spirits now reach)
  // makes a WIS save, once a turn each, for 3d8 radiant (half on a save).
  async function guard(f, moving = false) {
    const pairs = guardiansAround(f).map(o => [o, f]);
    if (moving && Conditions.has(f.creature, 'guardians')) for (const e of foesOf(f)) if (standing(e) && Squares.distance(Squares.of(e), Squares.of(f)) <= 3) pairs.push([f, e]);
    for (const [owner, victim] of pairs) {
      const e = Conditions.get(owner.creature, 'guardians');
      if (!e || victim.creature.slain || e.struck.get(victim.creature) === S.turnNo) continue;
      e.struck.set(victim.creature, S.turnNo);
      log(`${owner.creature.label}'s Spirit Guardians strike ${victim.creature.label}!`);
      const res = Rules.resolve('guardiansBurn', owner.creature, [victim.creature], { rng: S.rng }), h = res.hits[0];
      log(res.log);
      await Fx.play('guardiansBurn', { caster: owner, target: victim, result: { outcome: res.outcome, amount: h.amount }, hits: [{ fig: victim, amount: h.amount, saved: h.saved, by: owner.creature }], onHit: apply });
      checkEnd();
    }
  }

  // Spirit Guardians cast: the spirits circle the cleric (drawn by Fx) while the spell lasts.
  function wardOn(f) {
    const c = f.creature, me = S, e = Conditions.get(c, 'guardians');
    if (!e) return;
    e.struck = new Map();
    Fx.keep(Shapes.guardians({ at: () => f, alive: () => S === me && !S.over && Conditions.get(c, 'guardians') === e && !c.slain }));
  }

  // Mirror Image: duplicates hit instead of the caster are gone; with none left, the spell ends.
  function loseImages(c, n) {
    const e = Conditions.get(c, 'mirrored');
    if (!e) return;
    e.images -= n;
    if (e.images <= 0) { Conditions.remove(c, 'mirrored'); log(`${c.label}'s last duplicate is gone: Mirror Image ends.`); }
    emit('change');
  }

  // Chromatic Orb's leap: on to the nearest other standing enemy within 30 ft of the first target (and in its
  // sight), with a new attack roll and damage roll; it doesn't leap again.
  async function leap(f, id, from, choice, A) {
    const at = Squares.of(from);
    const next = foesOf(f).filter(o => o !== from && standing(o) && Squares.distance(at, Squares.of(o)) * 5 <= A.leap && Squares.sight(at, Squares.of(o)))
      .sort((a, b) => Squares.distance(at, Squares.of(a)) - Squares.distance(at, Squares.of(b)))[0];
    if (!next) { log(`  The orb could leap, but no other enemy is within ${A.leap} ft of ${from.creature.label}.`); return; }
    log(`  The orb leaps from ${from.creature.label} to ${next.creature.label}!`);
    await attack(f, id, next, choice, from);
  }

  // bonus: as a bonus action (a rogue's Cunning Action).
  async function dash(bonus = false) { return spend(f => { S.turn.move += Conditions.speed(f.creature) / 5; return 'DASH'; }, bonus ? 'dashes (Cunning Action)' : 'dashes', bonus, true); }
  async function disengage(bonus = false) { return spend(() => { S.turn.disengaged = true; return 'DISENGAGE'; }, bonus ? 'disengages (Cunning Action)' : 'disengages', bonus, true); }
  async function dodge() { return spend(f => { f.creature.dodging = true; return 'DODGE'; }, 'takes the Dodge action'); }

  // Spends the action on a move that rolls nothing: Dash, Disengage, Dodge. bonus: use the bonus action instead
  // (a goblin's Nimble Escape). hasty: Haste's extra action can do it (Dash, Disengage), and goes first.
  function spend(fn, words, bonus = false, hasty = false) {
    const f = current();
    const haste = !bonus && hasty && S && S.turn && S.turn.haste;
    if (!f || S.busy || !(bonus ? S.turn.bonus : S.turn.action || haste)) return false;
    if (bonus) S.turn.bonus = false; else if (haste) S.turn.haste = false; else S.turn.action = false;
    const word = fn(f), h = Figures.head(f);
    Popups.add(word, h.x, h.y, { color: 'info' });
    log(`${f.creature.label} ${words}.`);
    if (word !== 'DASH') refill(f);
    emit('change');
    return true;
  }

  // Damage or healing lands (Fx's apply step). Heroes at 0 HP fall unconscious; hit while down, they fail death
  // saves (two for a crit), and damage of their maximum HP or more kills outright.
  // A condition that incapacitates (Sleep's, Hold Person's) ends the creature's own concentration; damage ends
  // Sleep and Hypnotic Pattern's charm.
  function apply(hit, part) {
    const f = hit.fig, c = f.creature, n = part !== undefined ? (hit.parts || [])[part] : hit.amount;
    if (hit.adds && part === undefined && !c.slain) {
      for (const a of hit.adds) Conditions.add(c, a.id, { ...a, by: hit.by });
      if (Conditions.incapacitated(c)) log(Conditions.drop(c, everyone(), 'incapacitated'));
      emit('change');
    }
    if (hit.wakes) { log(wakeUp(c)); emit('change'); }
    if (hit.revive && c.slain) {                                         // Revivify: back with 1 HP
      c.slain = false; c.hp = 1; f.hp = 1; c.stable = false; c.deathSaves = { s: 0, f: 0 };
      Deaths.revive(f); log(`${c.label} breathes again!`); emit('change'); return;
    }
    if (hit.stabilize && c.hp <= 0 && !c.slain) { c.stable = true; c.deathSaves = { s: 0, f: 0 }; log(`${c.label} is stable.`); emit('change'); }   // Spare the Dying
    if (hit.ends && part === undefined) { log(Conditions.release(c, hit.ends, everyone())); emit('change'); }   // Lesser Restoration
    if (hit.aid && part === undefined && !c.slain) {                  // Aid: a higher HP maximum for the fight
      Conditions.add(c, 'aided', { by: hit.by, ends: 'never', amount: hit.aid });
      c.maxHp += hit.aid; f.maxHp = c.maxHp;
      if (c.hp > 0) { c.hp += hit.aid; f.hp = c.hp; }
      emit('change');
    }
    if (n === undefined || n === null) return;
    if (hit.heal && n <= 0) return;
    if (hit.heal && Conditions.has(c, 'chilled')) { log(`${c.label} can't regain HP: Chill Touch.`); return; }
    if (hit.heal) {
      if (c.hp <= 0 && !c.slain) { Deaths.revive(f); c.deathSaves = { s: 0, f: 0 }; c.stable = false; log(`${c.label} is back on their feet.`); }
      c.hp = Math.min(c.maxHp, Math.max(0, c.hp) + n);
      f.hp = c.hp;
      return;
    }
    if (n <= 0 || c.slain) return;
    if (c.hp <= 0) {
      if (n >= c.maxHp) slay(f, 'is killed outright');
      else { c.deathSaves.f += hit.crit ? 2 : 1; c.stable = false; log(`${c.label} fails ${hit.crit ? 'two death saves' : 'a death save'} from the blow (${c.deathSaves.f}/3).`); if (c.deathSaves.f >= 3) slay(f, 'dies'); }
      return;
    }
    if (practice('unkillable') && f.side === 'enemy' && c.hp - n <= 0) {
      log(wakeUp(c));
      c.hp = c.maxHp; f.hp = c.hp;
      log(`${c.label} takes ${n}: that would have finished it, but it can't die here. Back to ${c.hp} HP.`);
      emit('change');
      return;
    }
    c.hp -= n;
    if (Conditions.shakeable(c)) log([`${c.label} ${Conditions.sleeping(c) ? 'wakes up' : 'snaps out of the pattern'}!`, ...wakeUp(c)]);
    if (Conditions.has(c, 'turned') && !hit.keepTurned) { Conditions.remove(c, 'turned'); log(`${c.label} is hurt and stops fleeing.`); }
    if (c.hp > 0) { f.hp = c.hp; keepConcentrating(c, n); emit('change'); return; }
    const over = -c.hp;
    c.hp = 0; f.hp = 0;
    log(Conditions.drop(c, everyone(), 'down'));
    if (!c.hero) { slay(f, 'falls'); Deaths.start(f, Math.sign(f.x - current().x) || 1); return; }
    if (over >= c.maxHp) { slay(f, 'is killed outright'); Deaths.start(f, -1); return; }
    c.deathSaves = { s: 0, f: 0 };
    Deaths.start(f, Math.sign(f.x - (current() || f).x) || -1);
    log(`${c.label} falls unconscious!`);
  }

  // Out of Sleep (drowsy or asleep) or Hypnotic Pattern's charm; the caster stops concentrating once nobody is
  // under the spell. Returns lines to log.
  function wakeUp(c) { return ['asleep', 'drowsy', 'entranced'].flatMap(id => Conditions.release(c, id, everyone())); }

  // Sleep's second save at the end of a drowsy creature's turn: asleep on a failure, awake on a success.
  function sleepAgain(f) {
    const c = f.creature, e = Conditions.get(c, 'drowsy'), r = Rules.sleepAgain(c, e.by, { rng: S.rng }), h = Figures.head(f);
    Conditions.remove(c, 'drowsy');
    if (!r.success) Conditions.add(c, 'asleep', { by: e.by, ends: 'never' });
    log(r.text);
    Popups.add(r.success ? 'AWAKE' : 'ZZZ', h.x, h.y, { color: r.success ? 'miss' : 'info' });
    emit('change');
  }

  // The saves a creature gets at the end of each of its turns to end a condition (Hold Person).
  function saveAgain(f) {
    const c = f.creature;
    for (const e of [...(c.effects || [])]) {
      if (!Conditions.KINDS[e.id].repeat || !e.by) continue;
      const r = Rules.repeatSave(c, e, { rng: S.rng }), h = Figures.head(f);
      log(r.text);
      if (r.success) { log(Conditions.release(c, e.id, everyone())); Popups.add('FREE', h.x, h.y, { color: 'info' }); }
      emit('change');
    }
  }

  // A slain cleric's Turn Undead ends too.
  function slay(f, words) {
    f.creature.slain = true;
    for (const o of everyone()) if ((Conditions.get(o, 'turned') || {}).by === f.creature) Conditions.remove(o, 'turned');
    log([`${f.creature.label} ${words}.`, ...Conditions.drop(f.creature, everyone())]);
  }

  // A hurt caster who's concentrating makes a CON save to keep the spell going.
  function keepConcentrating(c, damage) {
    if (!c.concentration) return;
    const r = Rules.concentrationSave(c, damage, { rng: S.rng });
    log(r.text);
    if (!r.success) log(Conditions.drop(c, everyone(), 'lost concentration'));
  }

  // A hero at 0 HP rolls at the start of their turn: three successes and they're stable, three failures and they
  // die; a natural 20 brings them back with 1 HP.
  async function deathSave(f) {
    const c = f.creature, r = Rules.deathSave(c, { rng: S.rng });
    if (r.result === 'success') c.deathSaves.s++;
    else if (r.result === 'fail') c.deathSaves.f++;
    else if (r.result === 'fail2') c.deathSaves.f += 2;
    const word = { success: 'Success', fail: 'Failure', fail2: 'Two failures', revive: 'Natural 20!' }[r.result];
    log(`${c.label} death save: ${r.total}. ${word} (${c.deathSaves.s} up, ${c.deathSaves.f} down).`);
    if (S.dice) await DiceTray.show({ label: 'DEATH SAVE', value: r.d20.value, dropped: r.d20.dropped, bonus: 0, vs: 'DC 10', result: r.result === 'success' || r.result === 'revive' ? 'SAVE' : 'FAIL' });
    if (r.result === 'revive') { c.hp = 1; f.hp = 1; c.deathSaves = { s: 0, f: 0 }; Deaths.revive(f); log(`${c.label} wakes with 1 HP!`); }
    else if (c.deathSaves.f >= 3) slay(f, 'dies');
    else if (c.deathSaves.s >= 3) { c.stable = true; log(`${c.label} is stable.`); }
    emit('change');
  }

  function traySpec(r, res) {
    const base = { value: r.d20.value, dropped: r.d20.dropped, bonus: r.bonus, vs: r.vs };
    if (r.kind === 'save') return { ...base, label: r.ability.toUpperCase() + ' SAVE' + (r.mode === 'adv' ? ' ADV' : ''), result: r.success ? 'SAVE' : 'FAIL' };
    const label = r.d20.lucky ? 'LUCK' : 'ATTACK' + (r.mode === 'adv' ? ' ADV' : r.mode === 'dis' ? ' DIS' : '');
    return { ...base, label, result: res.shielded ? 'SHIELD' : r.outcome === 'crit' ? 'CRIT' : r.outcome === 'hit' ? 'HIT' : 'MISS' };
  }

  // The moves for an AI turn in fight me: once a newer fight has started, they do nothing, so a turn still
  // playing out from the old one can't move or act in the new one.
  function guarded(me) {
    const out = {}, idle = { reachable: () => new Map(), options: () => ({ ok: false, targets: [] }), areaOf: () => ({ ok: false, squares: [], figs: [] }), foesOf: () => [], state: () => me };
    for (const [k, fn] of Object.entries(api)) out[k] = (...a) => S === me ? fn(...a) : idle[k] ? idle[k](...a) : false;
    return out;
  }

  // What the AI and the UI may call.
  const api = { state: () => S, reachable, options, areaOf, moveTo, act, dash, disengage, dodge, endTurn, foesOf, standing, nimble: () => spend(() => { S.turn.disengaged = true; return 'DISENGAGE'; }, 'slips away (Nimble Escape)', true) };

  return { init, start, on, current, animate, reachable, options, areaOf, moveTo, act, dash, disengage, dodge, endTurn, foesOf, standing,
    api, state: () => S, busy: () => !!S && (S.busy || !S.wake) && !S.over };
})();
