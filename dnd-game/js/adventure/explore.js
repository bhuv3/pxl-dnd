// Exploring (docs/dnd-game/vision.md section 4): the party walks in real time, the leader where the player clicks and the
// others following in a line; doors open, a locked one can be forced, chests opened, traps found or sprung,
// townsfolk talked to; room descriptions show the first time in; stepping onto an exit leaves the map. Monsters
// that see a hero call a fight (the caller runs Combat). The party's gold, potions, and quest flags are the bag.
const Explore = (() => {
  const STEP_TIME = 0.2;               // seconds per square walked
  const listeners = { log: [], narrate: [], encounter: [], change: [], roll: [], talk: [], travel: [] };
  let A = null;

  function on(name, fn) { listeners[name].push(fn); }
  function emit(name, arg) { listeners[name].forEach(fn => fn(arg)); }
  const log = lines => emit('log', [].concat(lines));

  // Starts exploring a map. data: the map's data; lay: Maps.layout; figs: { party, monsters, npcs } (figures);
  // bag: { gold, potions, flags (a Set) }, shared by every map; saved: this map's state from an earlier visit.
  function start(data, lay, figs, rng, bag, saved) {
    A = saved || {
      doors: (data.doors || []).map(d => ({ ...d, open: false })), chests: (data.chests || []).map(c => ({ ...c, opened: false })),
      traps: (data.traps || []).map(t => ({ ...t, found: false, sprung: false })), areas: lay.areas.map(a => ({ ...a, seen: false })),
      engaged: new Set(),
    };
    Object.assign(A, { data, lay, party: figs.party, monsters: figs.monsters, npcs: figs.npcs, rng, bag, busy: false, stop: false });
    A.leader = A.leader && A.party.includes(A.leader) ? A.leader : A.party.find(up) || A.party[0];
    A.doors.forEach(d => Squares.setClosed(d.sq[0], d.sq[1], !d.open));
    A.traps.filter(t => t.found).forEach(t => Squares.setAvoid(t.sq[0], t.sq[1], true));
    const things = Stage.getWorld().things;
    A.doors.filter(d => d.open).forEach(d => { const t = things.find(t => t.type === 'door' && t.id === d.id); if (t) t.sprite = t.open; });
    enterAreas();
    emit('change');
    return A;
  }

  // ---------- Walking ----------

  const heroes = () => A.party.filter(f => !f.creature.slain);
  const up = f => !f.creature.slain && f.creature.hp > 0;
  const atSq = (f, sq) => { const s = Squares.of(f); return s.sx === sq[0] && s.sy === sq[1]; };
  const sqOf = f => { const s = Squares.of(f); return [s.sx, s.sy]; };

  // Walks the leader to a square (or next to a door, chest, or person clicked), the others following; then acts on it.
  async function click(sx, sy) {
    if (!A || A.busy || !up(A.leader)) return;
    const door = A.doors.find(d => d.sq[0] === sx && d.sq[1] === sy && !d.open), chest = A.chests.find(c => c.sq[0] === sx && c.sq[1] === sy && !c.opened);
    const npc = A.npcs.find(n => atSq(n, [sx, sy]));
    const sq = door ? door.sq : chest ? chest.sq : npc ? sqOf(npc) : null;
    A.busy = true;
    emit('change');
    if (sq) {
      if (!next(A.leader, sq)) await walkTo(nearestBeside(sq));
      if (!A.stop && next(A.leader, sq)) {
        if (door) await useDoor(door);
        else if (chest) openChest(chest);
        else { face(A.leader, npc); face(npc, A.leader); A.busy = false; emit('talk', npc); }
      }
    } else await walkTo({ sx, sy });
    A.busy = false;
    A.stop = false;
    emit('change');
  }

  const next = (f, sq) => Squares.touching(Squares.of(f), { sx: sq[0], sy: sq[1] });
  function face(f, o) { if (Math.abs(o.x - f.x) > 1) f.dir = o.x > f.x ? 'east' : 'west'; }

  // The free square beside a thing that the leader can reach soonest.
  function nearestBeside(sq) {
    const map = Squares.reachable(A.leader, 300, others(A.leader));
    let best = null;
    for (const n of map.values()) if (!n.through && Squares.touching(n, { sx: sq[0], sy: sq[1] }) && (!best || n.cost < best.cost)) best = n;
    return best;
  }

  const others = f => [...A.party, ...A.monsters, ...A.npcs].filter(o => o !== f && Squares.occupies(o));

  // The leader walks the path square by square; each follower steps toward the square the one ahead just left.
  // Every step checks for traps underfoot, new rooms, exits, and monsters noticing the party.
  async function walkTo(dest) {
    if (!dest) return;
    const map = Squares.reachable(A.leader, 300, others(A.leader)), node = map.get(Squares.key(dest.sx, dest.sy));
    if (!node || node.through) return;
    for (const step of Squares.path(map, dest.sx, dest.sy)) {
      if (A.stop) break;
      const line = heroes().filter(up).sort((a, b) => (a === A.leader ? -1 : b === A.leader ? 1 : 0));
      const targets = [{ sx: step.sx, sy: step.sy }];
      for (let k = 1; k < line.length; k++) targets.push(Squares.of(line[k - 1]));
      await Promise.all(line.map((f, k) => stepToward(f, targets[k])));
      line.forEach(f => { f.moving = false; });
      for (const f of line) await checkTrap(f);
      spotTraps();
      enterAreas();
      emit('change');
      if (noticed() || leaving()) break;
    }
  }

  // One square toward a target square (along a real path if it isn't next door).
  async function stepToward(f, t) {
    const here = Squares.of(f);
    if (here.sx === t.sx && here.sy === t.sy) return;
    let step = t;
    if (!Squares.touching(here, t)) {
      const map = Squares.reachable(f, 40, others(f)), p = Squares.path(map, t.sx, t.sy);
      if (!p.length) return;
      step = p[0];
    }
    if (others(f).some(o => atSq(o, [step.sx, step.sy]) && o.side !== 'hero')) return;
    const to = Squares.feet(step.sx, step.sy), from = { x: f.x, y: f.y };
    if (Math.abs(to.x - from.x) > 1) f.dir = to.x > from.x ? 'east' : 'west';
    f.moving = true;
    const t0 = f.walkT;
    await Combat.animate(STEP_TIME, k => { f.x = from.x + (to.x - from.x) * k; f.y = from.y + (to.y - from.y) * k; f.walkT = t0 + k * 2; });
    f.x = to.x; f.y = to.y;
  }

  // ---------- Rooms, exits, monsters ----------

  // The first time a hero stands in an area, its description is read out.
  function enterAreas() {
    for (const a of A.areas) {
      if (a.seen) continue;
      const [x0, y0, x1, y1] = a.rect;
      if (heroes().some(f => { const s = Squares.of(f); return s.sx >= x0 && s.sx <= x1 && s.sy >= y0 && s.sy <= y1; })) { a.seen = true; emit('narrate', a.text); }
    }
  }

  // The leader on an exit square: leave (if the party has what the exit needs), or be told why not.
  function leaving() {
    const here = Squares.of(A.leader), exit = A.lay.exits.find(e => e.squares.some(s => s.sx === here.sx && s.sy === here.sy));
    if (!exit) return false;
    A.stop = true;
    if (exit.needs && !A.bag.flags.has(exit.needs)) { log(exit.refused || 'You can\'t leave yet.'); return true; }
    emit('travel', exit);
    return true;
  }

  // A monster that sees a standing hero within sight range calls its whole group to fight. True if a fight starts.
  function noticed() {
    for (const m of A.monsters) {
      if (m.creature.slain || A.engaged.has(m.group)) continue;
      const seen = heroes().filter(up).find(h => Squares.distance(Squares.of(m), Squares.of(h)) <= (A.data.sight || 7) && Squares.sight(Squares.of(m), Squares.of(h)));
      if (seen) {
        A.engaged.add(m.group);
        A.stop = true;
        log(`${m.creature.label} spots ${seen.creature.label}!`);
        emit('encounter', A.monsters.filter(o => o.group === m.group && !o.creature.slain));
        return true;
      }
    }
    return false;
  }

  // ---------- Doors, chests, traps ----------

  // Opens a door; a locked one is forced with a check by the hero best at it (one try per click).
  async function useDoor(d) {
    if (d.locked) {
      const who = best(d.locked.skill);
      log(d.locked.text);
      const r = rollCheck(who.creature, d.locked.skill, d.locked.dc, A.rng);
      log(`${r.text}${r.success ? ' The door bursts open.' : ' It holds. Try again?'}`);
      await rolled(checkSpec(r));
      if (!r.success) return;
      d.locked = null;
    }
    d.open = true;
    Squares.setClosed(d.sq[0], d.sq[1], false);
    const t = Stage.getWorld().things.find(t => t.type === 'door' && t.id === d.id);
    if (t) t.sprite = t.open;
    log('The door creaks open.');
    noticed();
  }

  // An ability check; a fighter's Tactical Mind spends a Second Wind if it turned a failure into a success.
  function rollCheck(c, skill, dc, rng) {
    const r = Rules.check(c, skill, dc, { rng });
    if (r.tactical && r.tactical.spent) c.uses.secondWind--;
    return r;
  }

  // The standing hero best at a skill.
  function best(skill) { return heroes().filter(up).sort((a, b) => Creatures.skillBonus(b.creature, skill) - Creatures.skillBonus(a.creature, skill))[0]; }
  function checkSpec(r) { return { value: r.d20.value, dropped: r.d20.dropped, bonus: r.bonus, vs: r.vs, label: r.skill.toUpperCase().slice(0, 10), result: r.success ? 'SUCCESS' : 'FAIL' }; }

  function openChest(c) {
    c.opened = true;
    A.bag.gold += c.gold || 0;
    A.bag.potions += c.potions || 0;
    log(`The chest holds ${c.gold} gold and ${c.potions} potions of healing.`);
  }

  // The best passive Perception in the party spots a hidden trap within 2 squares of anyone.
  function spotTraps() {
    const top = Math.max(...heroes().filter(up).map(f => Creatures.passive(f.creature)));
    for (const t of A.traps) {
      if (t.found || t.sprung || top < t.find) continue;
      if (heroes().some(f => Squares.distance(Squares.of(f), { sx: t.sq[0], sy: t.sq[1] }) <= 2)) reveal(t, 'You spot');
    }
  }

  // Search (outside fights): the leader makes an active Perception check against every hidden trap within 3 squares.
  async function search() {
    if (!A || A.busy || !up(A.leader)) return;
    A.busy = true;
    const near = A.traps.filter(t => !t.found && !t.sprung && Squares.distance(Squares.of(A.leader), { sx: t.sq[0], sy: t.sq[1] }) <= 3);
    const dc = near.length ? Math.min(...near.map(t => t.find)) : 14;
    const r = rollCheck(A.leader.creature, 'perception', dc, A.rng);
    log(`${A.leader.creature.label} searches. ${r.text}`);
    await rolled(checkSpec(r));
    if (r.success && near.length) near.forEach(t => reveal(t, 'You find')); else log('You find nothing.');
    A.busy = false;
    emit('change');
  }

  function reveal(t, words) {
    t.found = true;
    Squares.setAvoid(t.sq[0], t.sq[1], true);
    log(`${words} a ${t.name} stretched across the floor! You step around it.`);
    emit('change');
  }

  // A hidden trap springs under a hero: a save, or the damage.
  async function checkTrap(f) {
    const t = A.traps.find(t => !t.found && !t.sprung && atSq(f, t.sq));
    if (!t) return;
    t.sprung = true;
    A.stop = true;
    const c = f.creature, bonus = Creatures.saveBonus(c, t.save.ability), d = Dice.d20(A.rng, { lucky: (c.traits || []).includes('lucky') });
    const saved = d.value + bonus >= t.save.dc, dmg = saved ? 0 : Rules.adjust(c, Dice.roll(t.damage, A.rng).total, t.type).amount;
    log(`Click! ${c.label} trips a ${t.name}. ${t.save.ability.toUpperCase()} save: ${d.value} + ${bonus} = ${d.value + bonus} vs DC ${t.save.dc}. ${saved ? 'Dodged!' : `Darts hit for ${dmg} ${t.type} damage.`}`);
    await rolled({ value: d.value, dropped: d.dropped, bonus, vs: 'DC ' + t.save.dc, label: t.save.ability.toUpperCase() + ' SAVE', result: saved ? 'SAVE' : 'FAIL' });
    if (dmg) {
      const h = Figures.head(f);
      Popups.add(dmg, h.x, h.y, { color: 'damage' });
      Particles.burst('spark', f.x, f.y - 6, 8, { speed: 30 });
      c.hp = Math.max(0, c.hp - dmg); f.hp = c.hp;
      if (c.hp === 0) { c.stable = true; Deaths.start(f, -1); log(`${c.label} drops, but is stable.`); }
    }
  }

  // Shows a roll in the dice tray and waits for it to land.
  function rolled(spec) { return new Promise(done => emit('roll', { spec, done })); }

  // ---------- Resting and potions ----------

  // A short rest: everyone spends their hit die (a fallen, stable hero gets up first); some features come back.
  async function shortRest() {
    if (!A || A.busy) return;
    const lines = ['The party takes a short rest.'];
    for (const f of heroes()) {
      const c = f.creature;
      if (c.hp <= 0) { c.hp = 1; c.stable = false; c.deathSaves = { s: 0, f: 0 }; Deaths.revive(f); lines.push(`  ${c.label} comes round.`); }
      if ((c.hitDice ?? c.level) > 0 && c.hp < c.maxHp) {
        const r = Dice.roll(`1${c.hitDie}+${Creatures.mod(c.abilities.con)}`, A.rng), gain = Math.max(1, r.total);
        c.hitDice = (c.hitDice ?? c.level) - 1;
        c.hp = Math.min(c.maxHp, c.hp + gain);
        lines.push(`  ${c.label} spends a hit die: +${gain} HP (${c.hp}/${c.maxHp}).`);
      }
      f.hp = c.hp;
      lines.push(...Creatures.shortRest(c));
    }
    log(lines);
    emit('change');
  }

  // A potion of healing for a hero (2d4 + 2), outside fights.
  function drink(f) {
    if (!A || A.busy || A.bag.potions <= 0 || f.creature.slain) return;
    const c = f.creature, r = Dice.roll('2d4+2', A.rng);
    A.bag.potions--;
    if (c.hp <= 0) { Deaths.revive(f); c.stable = false; c.deathSaves = { s: 0, f: 0 }; }
    c.hp = Math.min(c.maxHp, Math.max(0, c.hp) + r.total);
    f.hp = c.hp;
    const h = Figures.head(f);
    Popups.add('+' + r.total, h.x, h.y, { color: 'heal' });
    Particles.burst('heal', f.x, f.y - 4, 10, { speed: 14 });
    log(`${c.label} drinks a potion of healing: +${r.total} HP.`);
    emit('change');
  }

  function setLeader(f) { if (A && !A.busy && up(f)) { A.leader = f; emit('change'); } }

  return { on, start, click, search, shortRest, drink, setLeader, best, rollCheck, noticed, state: () => A };
})();
