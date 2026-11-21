// CombatAI: plays a turn through the same moves the player has (docs/dnd-game/combat.md section 4). Melee fighters walk to
// a target and strike; archers (and anyone without a melee attack, or whose only one is a touch spell) keep their
// distance, slip away when cornered (a goblin's Nimble Escape), and shoot. Goblins pick the hero with the lowest AC; heroes in auto mode pick the
// most hurt enemy, use Second Wind when low, and cast a spell that uses a slot when it's worth it (spells()).
const CombatAI = (() => {
  async function takeTurn(f, api) {
    const c = f.creature, acts = c.actions || [];
    const harm = acts.filter(id => { const A = Actions.get(id); return !['ally', 'self', 'party'].includes(A.target) && !A.slot && !A.area && A.kind !== 'buff'; });
    const melee = harm.find(id => Actions.get(id).range === 'melee'), ranged = harm.find(id => typeof Actions.get(id).range === 'number');
    if (acts.includes('secondWind') && c.hp <= c.maxHp / 2 && api.options(f, 'secondWind').ok) await api.act('secondWind', f);
    await heal(f, api, acts);
    const sleeper = api.options(f, 'shakeAwake');
    if (sleeper.ok) return api.act('shakeAwake', sleeper.targets[0].fig);   // a sleeping friend next to it: wake them
    const foes = api.foesOf(f).filter(api.standing);
    if (!foes.length) return api.endTurn();
    if (f.side === 'hero' && await spells(f, api, acts, foes)) return;
    if (ranged && (f.role === 'archer' || !melee || Actions.get(melee).with === 'spell')) await archer(f, api, ranged, foes);
    else await brawler(f, api, melee, ranged, foes);
    await more(f, api, melee, ranged);
    if (acts.includes('actionSurge') && api.standing(f) && api.options(f, 'actionSurge').ok && api.foesOf(f).some(o => api.standing(o) && Squares.adjacent(o, f))) {
      await api.act('actionSurge', f);                                    // Action Surge: swing again
      await brawler(f, api, melee, ranged, api.foesOf(f).filter(api.standing));
      await more(f, api, melee, ranged);
    }
  }

  // The attacks a turn still has: Extra Attack's second one, Haste's extra action; each on someone next to it
  // (or in range) if there is one.
  async function more(f, api, melee, ranged) {
    for (let n = 0; n < 4; n++) {
      const t = api.state().turn;
      if (!t || t.fig !== f || !api.standing(f) || !(t.extra > 0 || t.haste)) return;
      let done = false;
      for (const id of [melee, ranged].filter(id => id && Actions.get(id).with !== 'spell')) {
        const o = api.options(f, id), ts = o.ok && o.targets.filter(t => api.standing(t.fig));
        if (ts && ts.length) { done = await api.act(id, pick(f, ts)); break; }
      }
      if (!done) return;
    }
  }

  // A healer helps the friend in the worst shape: a fallen one first, or one below a third of their HP. With two
  // or more friends bloodied (half HP or less), a Life cleric uses Preserve Life first.
  async function heal(f, api, acts) {
    const dead = acts.includes('revivify') && api.options(f, 'revivify');                       // a friend died: Revivify
    if (dead && dead.ok) { await api.act('revivify', dead.targets[0].fig); return; }
    if (acts.includes('massHealingWord') && api.options(f, 'massHealingWord').ok &&
      api.state().figs.filter(o => o.side === f.side && !o.creature.slain && o.creature.hp <= o.creature.maxHp / 3).length >= 2) await api.act('massHealingWord', f);
    if (acts.includes('preserveLife') && api.options(f, 'preserveLife').ok &&
      api.state().figs.filter(o => o.side === f.side && !o.creature.slain && o.creature.hp <= o.creature.maxHp / 2 && Squares.distance(Squares.of(o), Squares.of(f)) <= 6).length >= 2) { await api.act('preserveLife', f); return; }
    for (const id of acts.filter(id => Actions.get(id).target === 'ally' && Actions.get(id).kind === 'heal')) {
      const o = api.options(f, id);
      if (!o.ok) continue;
      const need = o.targets.map(t => t.fig).filter(a => a.creature.hp <= a.creature.maxHp / 3).sort((a, b) => a.creature.hp - b.creature.hp)[0];
      if (need) { await api.act(id, need); return; }
    }
    const dying = acts.includes('spareTheDying') && api.options(f, 'spareTheDying');           // no healing left: stabilize
    if (dying && dying.ok) await api.act('spareTheDying', dying.targets[0].fig);
  }

  // A spell worth a slot, if there is one now: Bless early in a fight with friends near; an area spell aimed where
  // it catches the most enemies (2 or more, and no friends); Guiding Bolt when a slot is still spare for healing.
  // True if it cast something with its action.
  async function spells(f, api, acts, foes) {
    const c = f.creature, slots = (c.slots || {})[1] || 0, ok = id => acts.includes(id) && api.options(f, id).ok;
    if (ok('spiritGuardians') && !(c.concentration && c.concentration.spell === 'Spirit Guardians') && foes.filter(o => Squares.distance(Squares.of(o), Squares.of(f)) <= 3).length >= 2) { await api.act('spiritGuardians', f); return true; }
    if (ok('bless') && !c.concentration && api.state().round <= 2 && friendsNear(f, api, 30) >= 2) { await api.act('bless', f); return true; }
    let top = null;
    for (const id of acts.filter(id => Actions.get(id).area && ok(id))) {
      for (const sq of aims(f, id, foes)) {
        const r = api.areaOf(f, id, sq);
        if (!r.ok || r.figs.some(o => o.side === f.side)) continue;
        const caught = r.figs.filter(o => o.side !== f.side && api.standing(o) && !(id === 'sleep' && sleepless(o.creature)));
        if (caught.length >= 2 && (!top || caught.length > top.n)) top = { id, sq, n: caught.length };
      }
    }
    if (top) { await api.act(top.id, top.sq); return true; }
    if (ok('guidingBolt') && slots >= 2) {
      const o = api.options(f, 'guidingBolt');
      const t = choose(f, o.targets.map(t => t.fig).filter(api.standing));
      if (t) { await api.act('guidingBolt', t); return true; }
    }
    return false;
  }

  // Squares to try aiming an area at: each enemy (a circle), the caster's own (all round it), or the 8 ways out
  // from the caster (a cone or a line).
  function aims(f, id, foes) {
    const area = Actions.get(id).area;
    if (area === 'circle' || area === 'cube') return foes.map(o => Squares.of(o));
    if (area === 'around' || area === 'aura') return [Squares.of(f)];
    const s = Squares.of(f), out = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) out.push({ sx: s.sx + dx, sy: s.sy + dy });
    return out;
  }

  // Sleep is wasted on it: already under it, undead, or an elf.
  const sleepless = c => Conditions.sleeping(c) || (c.tags || []).includes('undead') || (c.traits || []).includes('trance');

  function friendsNear(f, api, feet) { return api.state().figs.filter(o => o.side === f.side && api.standing(o) && Squares.distance(Squares.of(o), Squares.of(f)) * 5 <= feet).length; }

  // Turned (Turn Undead): it runs as far from the cleric as its movement takes it.
  async function flee(f, api, from) {
    if (!from) return;
    await moveTo(f, api, best(f, api, [], sq => Squares.distance(sq, Squares.of(from))));
  }

  // The target this creature would pick: goblins go for the softest armor, heroes for the most hurt enemy;
  // ties go to the nearest; a hidden one only if there's no one else.
  function choose(f, foes) {
    const seen = foes.filter(o => !Conditions.has(o.creature, 'hidden'));
    if (seen.length) foes = seen;
    const d = o => Squares.distance(Squares.of(f), Squares.of(o));
    const score = o => f.side === 'enemy' ? o.creature.ac * 10 + d(o) : (o.creature.hp / o.creature.maxHp) * 100 + d(o);
    return [...foes].sort((a, b) => score(a) - score(b))[0];
  }

  // Walks next to the target (or as close as it can, dashing if it can't attack anyway) and strikes.
  async function brawler(f, api, melee, ranged, foes) {
    const adjacent = foes.filter(o => Squares.adjacent(o, f));
    let target = adjacent.length ? choose(f, adjacent) : choose(f, foes);
    if (!Squares.adjacent(target, f)) await approach(f, api, target);
    if (!api.standing(f)) return;
    target = Squares.adjacent(target, f) ? target : (foes.filter(o => api.standing(o) && Squares.adjacent(o, f))[0] || target);
    if (melee && tryAct(f, api, melee, target)) return api.act(melee, target);
    if (ranged && tryAct(f, api, ranged, target)) return api.act(ranged, target);
    const within = melee && api.options(f, melee);
    if (within && within.ok) { const t = (within.targets.find(t => api.standing(t.fig)) || within.targets[0]).fig; return api.act(melee, t); }
    if (api.dash()) await approach(f, api, target);
  }

  // Keeps its distance and shoots. Cornered, a goblin slips away first (Nimble Escape, a bonus action); anyone
  // else stays and shoots at disadvantage rather than give up the attack.
  async function archer(f, api, ranged, foes) {
    const cornered = foes.some(o => Squares.adjacent(o, f));
    const slipped = cornered && (f.creature.traits || []).includes('nimble') && api.nimble();
    if (slipped || (!cornered && !api.options(f, ranged).ok)) await moveTo(f, api, best(f, api, foes, sq => safety(sq, foes) + (sees(sq, choose(f, foes)) ? 4 : 0)));
    const o = api.options(f, ranged);
    if (o.ok) return api.act(ranged, pick(f, o.targets));
  }

  // Walks to the reachable square next to the target that's cheapest to get to, or else the one closest to it.
  async function approach(f, api, target) {
    const t = Squares.of(target);
    const next = best(f, api, [], sq => (Squares.touching(sq, t) ? 100 : 0) - Squares.distance(sq, t) * 3 - sq.cost * 0.1);
    if (next) await moveTo(f, api, next);
  }

  // The reachable square (where it can stop) with the highest score, or null if staying put is as good.
  function best(f, api, foes, score) {
    const here = Squares.of(f);
    let top = null, topScore = score({ ...here, cost: 0 });
    for (const sq of api.reachable(f).values()) {
      if (sq.through || sq.cost === 0) continue;
      const s = score(sq);
      if (s > topScore) { top = sq; topScore = s; }
    }
    return top;
  }

  async function moveTo(f, api, sq) { if (sq) await api.moveTo(sq.sx, sq.sy); }

  // How far a square is from the nearest foe (more is safer for an archer, up to 6 squares).
  function safety(sq, foes) { return Math.min(6, ...foes.map(o => Squares.distance(sq, Squares.of(o)))); }
  function sees(sq, o) { return Squares.sight(sq, Squares.of(o)); }
  function tryAct(f, api, id, target) { const o = api.options(f, id); return o.ok && o.targets.some(t => t.fig === target); }
  function pick(f, targets) { const want = choose(f, targets.map(t => t.fig)); return want; }

  return { takeTurn, flee };
})();
