// The adventure page: plays an adventure from its data file (Adventures). The party explores a map (Explore),
// talks to people (Dialogue), walks off an exit to the next map (each map remembers its state), and fights when
// spotted (Combat, with CombatInput for the player's turns); a lost fight can be retried from where it began.
// The bag (gold, potions, quest flags) and the heroes go everywhere with the party.
// Which adventure: ?a=<id> (adventures/<id>.js), ?test (the adventure editor's Play button), or "The Cellar Key".
const Adventure = (() => {
  const $ = id => document.getElementById(id);
  const SEED = 51, TEST_KEY = 'dnd-game:play-test';
  let adv;
  const visits = {};                  // map id → { map (model), figs: { monsters, npcs }, saved (Explore state) }
  let rng, party = [], bag, here = null, fighting = null, checkpoint = null, ending = false, narrationTimer = null;

  // ---------- Figures ----------

  function makeHero(o) {
    const creature = Creatures.make(o.sheet, o.name);
    return Figures.add({ name: o.name, key: o.key, seed: 1, x: 0, y: 0, dir: 'east', side: 'hero', hp: creature.hp, maxHp: creature.maxHp, creature });
  }

  function makeMonster(o) {
    const creature = Creatures.make(o.sheet, o.name), seed = o.seed === 'torch' ? seedWhere(s => !!CharacterArt.get('goblin', s).light) : o.seed || 1;
    return Figures.add({ name: o.name, key: o.key, seed, ...Squares.feet(...o.sq), dir: 'west', side: 'enemy', hp: creature.hp, maxHp: creature.maxHp, creature, group: o.group, role: o.role });
  }

  // Townsfolk: a villager (of the right role, or a given look), with no stats (they don't fight). They talk with
  // a dialogue from the file, or just say their line.
  function makeNpc(o, lay) {
    const sq = lay.at(o.at), seed = o.seed || seedWhere(s => Villagers.roleOf(s) === o.role);
    return Figures.add({ name: o.name, key: o.key || 'villager', seed, ...Squares.feet(sq.sx, sq.sy), dir: 'south', side: 'npc', creature: { label: o.name }, talk: o.talk, line: o.line });
  }

  function seedWhere(test) { for (let s = 1; s < 20000; s++) if (test(s)) return s; return 1; }

  // The party around a square: the leader on it, the others on free squares beside.
  function placeParty(sq) {
    const taken = new Set(), offsets = [[0, 0], [-1, 0], [0, 1], [0, -1], [-1, 1], [-1, -1], [1, 0], [1, 1], [1, -1], [-2, 0]];
    const leader = (here.visit.saved && here.visit.saved.leader) || party[0];
    const leaderFirst = [leader, ...party.filter(f => f !== leader)];
    for (const f of leaderFirst) {
      const o = offsets.find(([dx, dy]) => !Squares.isSolid(sq.sx + dx, sq.sy + dy) && !taken.has(Squares.key(sq.sx + dx, sq.sy + dy)));
      const s = o ? { sx: sq.sx + o[0], sy: sq.sy + o[1] } : sq;
      taken.add(Squares.key(s.sx, s.sy));
      Object.assign(f, Squares.feet(s.sx, s.sy), { moving: false });
    }
  }

  // ---------- Maps ----------

  // Goes to a map (built the first time, as it was left after that), the party arriving at a spot.
  function enter(id, spot) {
    const data = adv.maps[id], v = visits[id] || (visits[id] = { map: Maps.build(data) });
    Stage.setMap(v.map);
    Squares.setWorld(Stage.getWorld());
    const lay = Maps.layout(data, v.map);
    here = { id, data, lay, visit: v };
    if (!v.figs) v.figs = { monsters: (data.monsters || []).map(makeMonster), npcs: (data.npcs || []).map(o => makeNpc(o, lay)) };
    placeParty(lay.spot(spot));
    Figures.restore([...party, ...v.figs.monsters, ...v.figs.npcs]);
    Stage.setGrid(false);
    $('title').textContent = data.name;
    v.saved = Explore.start(data, lay, { party, monsters: v.figs.monsters, npcs: v.figs.npcs }, rng, bag, v.saved);
  }

  function travel(exit) {
    CombatUI.log([`You head for ${adv.maps[exit.to].name}.`]);
    enter(exit.to, exit.at);
  }

  // ---------- Talking ----------

  function talk(npc) {
    const tree = (adv.dialogue || {})[npc.talk] || { name: npc.name, start: [{ node: 'line' }],
      nodes: { line: { text: npc.line || '...', choices: [{ text: 'Goodbye.', next: null }] } } };
    Dialogue.open(tree, { flags: bag.flags, act, check, close: () => {
      refresh();
      if (ending) finish();
    } });
  }

  // The end screen, once an 'end' action has run.
  function finish() {
    const end = adv.end || { title: `${adv.name}: complete`, text: '' };
    setTimeout(() => CombatUI.result('victory', { title: end.title, body: `${end.text} The party has ${bag.gold} gold.`.trim(), button: 'Play again' }), 400);
  }

  // A dialogue (or a beaten group's) action.
  function act([what, arg]) {
    if (what === 'flag') bag.flags.add(arg);
    else if (what === 'gold') { bag.gold += arg; CombatUI.log([`The party receives ${arg} gold.`]); }
    else if (what === 'say') narrate(arg);
    else if (what === 'levelUp') {
      const lines = party.filter(f => !f.creature.slain).map(f => {
        if (f.creature.hp <= 0) { Deaths.revive(f); f.creature.deathSaves = { s: 0, f: 0 }; f.creature.stable = false; }
        const line = Creatures.levelUp(f.creature);
        f.hp = f.creature.hp; f.maxHp = f.creature.maxHp;
        return '  ' + line;
      });
      CombatUI.log([arg || 'A long rest, and everyone levels up!', ...lines]);
    } else if (what === 'end') ending = true;
    renderParty();
  }

  // A dialogue check: the party member best at the skill rolls, in the tray.
  async function check(skill, dc) {
    const who = Explore.best(skill), r = Explore.rollCheck(who.creature, skill, dc, rng);
    CombatUI.log([r.text]);
    await DiceTray.show({ value: r.d20.value, dropped: r.d20.dropped, bonus: r.bonus, vs: r.vs, label: skill.toUpperCase().slice(0, 10), result: r.success ? 'SUCCESS' : 'FAIL' });
    return r.success;
  }

  // ---------- Fights ----------

  // A group spotted the party: remember everything (for a retry) and fight.
  function fight(group) {
    fighting = group;
    checkpoint = snapshot();
    Stage.setGrid(true);
    Combat.start([...party.filter(f => !f.creature.slain), ...group], { rng });
  }

  function onOver(outcome) {
    const group = fighting;
    setTimeout(() => {
      if (outcome === 'defeat') return CombatUI.result('defeat', { title: 'The party has fallen', body: 'Try this fight again from where it began.', button: 'Try again' });
      fighting = null;
      Stage.setGrid(false);
      CombatUI.log(['The fight is over.']);
      for (const a of (here.data.defeated || {})[group[0].group] || []) act(a);
      refresh();
      if (ending) finish();
    }, 900);
  }

  // The result screen's button: play again after the end, or retry a lost fight.
  function again(outcome) {
    if (outcome === 'victory') { location.reload(); return; }
    CombatUI.result(null);
    restore(checkpoint);
    CombatUI.log(['You try again...']);
    fight(fighting);
  }

  // Everyone's place and state (creatures copied), and the bag, to put back for a retry.
  function snapshot() {
    return { bag: { gold: bag.gold, potions: bag.potions, flags: new Set(bag.flags) },
      figs: [...party, ...here.visit.figs.monsters].map(f => ({ f, x: f.x, y: f.y, dir: f.dir, dead: f.dead ? { ...f.dead } : null, creature: structuredClone(f.creature) })) };
  }
  function restore(snap) {
    Object.assign(bag, { gold: snap.bag.gold, potions: snap.bag.potions, flags: new Set(snap.bag.flags) });
    for (const s of snap.figs) {
      Object.assign(s.f, { x: s.x, y: s.y, dir: s.dir, dead: s.dead ? { ...s.dead } : null, creature: structuredClone(s.creature), pose: null, arm: null, ghosts: [], alpha: 1, moving: false });
      s.f.hp = s.f.creature.hp;
    }
  }

  // ---------- Panels ----------

  // The party panel: each hero's HP (click to lead, a potion button when there are potions), the bag, Search, Short rest.
  function renderParty() {
    const A = Explore.state(), exploring = !CombatInput.live() && !Dialogue.active();
    if (!A) return;
    const busy = A.busy || !exploring;
    $('party').innerHTML = party.map((f, k) => {
      const c = f.creature, state = c.slain ? 'dead' : c.hp <= 0 ? 'down' : '';
      return `<li class="${f === A.leader ? 'leader' : ''} ${state}" data-k="${k}"><span class="name">${c.label}${c.level > 1 ? ` <small>L${c.level}</small>` : ''}</span>
        <span class="bar"><i style="width:${Math.max(0, c.hp) / c.maxHp * 100}%"></i></span><span class="hp">${c.slain ? 'dead' : `${Math.max(0, c.hp)}/${c.maxHp}`}</span>
        ${bag.potions > 0 && !c.slain && c.hp < c.maxHp ? `<button data-drink="${k}" ${busy ? 'disabled' : ''}>Potion</button>` : ''}</li>`;
    }).join('');
    const quest = (adv.quest || []).find(q => !q.if || bag.flags.has(q.if));
    $('stash').innerHTML = `${bag.gold} gold · ${bag.potions} potion${bag.potions === 1 ? '' : 's'} of healing${quest ? `<br>Quest: ${quest.text}` : ''}`;
    $('search').disabled = $('rest').disabled = busy;
  }

  // Shows a description over the map for a while, and in the log.
  function narrate(text) {
    const box = $('narration');
    box.textContent = text;
    box.hidden = false;
    clearTimeout(narrationTimer);
    narrationTimer = setTimeout(() => { box.hidden = true; }, 7000);
    CombatUI.log(['» ' + text]);
  }

  // The exploring view: a gold ring under the leader, crosses on found traps; the panels.
  function refresh() {
    const A = Explore.state();
    if (A && !CombatInput.live()) {
      if (!A.leader.creature.hp || A.leader.creature.slain) { const next = party.find(f => f.creature.hp > 0 && !f.creature.slain); if (next) A.leader = next; }
      GridOverlay.set({ current: A.leader, marks: A.traps.filter(t => t.found).map(t => ({ sx: t.sq[0], sy: t.sq[1] })), reach: null, path: [], targets: [] });
      $('hint').textContent = A.busy || Dialogue.active() ? '' : 'Click to walk. Click a door, chest, or person to use or talk to them. Click a hero in the party panel to lead.';
    }
    renderParty();
  }

  // Names under the feet, small and dim.
  function drawNames(c2d) {
    const s = Math.max(1, Math.round(Stage.cam.zoom / 3));
    for (const f of Figures.list) {
      if (f.creature.slain) continue;
      const p = Stage.toScreen(f.x, f.y + 2.5);
      Popups.text(c2d, f.name, Math.round(p.x), Math.round(p.y), s, f.side === 'npc' ? 'rgba(255, 220, 140, 0.85)' : 'rgba(232, 226, 214, 0.7)', 0.8);
    }
  }

  function wire() {
    $('stage').addEventListener('click', e => { if (!CombatInput.live() && !Dialogue.active()) { const u = CombatInput.under(e); Explore.click(u.sq.sx, u.sq.sy); } });
    $('party').addEventListener('click', e => {
      const drink = e.target.closest('[data-drink]'), li = e.target.closest('li');
      if (drink) Explore.drink(party[+drink.dataset.drink]);
      else if (li && !CombatInput.live()) Explore.setLeader(party[+li.dataset.k]);
    });
    $('search').addEventListener('click', () => Explore.search());
    $('rest').addEventListener('click', () => Explore.shortRest());
    $('speed').addEventListener('change', e => Fx.setTimeScale(e.target.checked ? 2 : 1));
    Explore.on('log', lines => CombatUI.log(lines));
    Explore.on('narrate', narrate);
    Explore.on('change', refresh);
    Explore.on('encounter', fight);
    Explore.on('talk', talk);
    Explore.on('travel', travel);
    Explore.on('roll', ({ spec, done }) => DiceTray.show(spec).then(done));
    Combat.on('log', lines => CombatUI.log(lines));
    Combat.on('change', renderParty);
    Combat.on('over', onOver);
  }

  // Finds the adventure (loading its file if the page doesn't have it), then starts it.
  function boot() {
    const q = new URLSearchParams(location.search);
    if (q.has('test')) {
      let t = null;
      try { t = JSON.parse(localStorage.getItem(TEST_KEY)); } catch (e) {}
      if (t) { Adventures.add(t.data); return start(t.data.id, t.from); }
    }
    const id = q.get('a') || 'cellar-key';
    if (Adventures.has(id)) return start(id);
    const script = document.createElement('script');
    script.src = `adventures/${encodeURIComponent(id)}.js`;
    script.onload = () => start(id);
    script.onerror = () => { $('hint').textContent = `There's no adventure file adventures/${id}.js.`; };
    document.head.appendChild(script);
  }

  // from: { map, at } to begin somewhere other than the adventure's start (the editor's "Play this map").
  function start(id, from) {
    adv = Adventures.get(id);
    document.title = adv.name;
    rng = Dice.rng(SEED);
    bag = { gold: 0, potions: 0, flags: new Set() };
    Stage.init($('stage'));
    party = adv.party.map(makeHero);
    CombatUI.init({ turnbar: $('turnbar'), actions: $('actions'), log: $('log'), result: $('result'), banner: $('banner') },
      { pick: id => CombatInput.pick(id), again });
    Dialogue.init($('dialogue'));
    Combat.init();
    CombatInput.init({ stage: $('stage'), hint: $('hint'), quiet: true });
    Stage.on('update', dt => { Fx.update(dt); DiceTray.update(dt * Fx.getTimeScale()); });
    Stage.on('floor', Marks.drawFloor);
    Stage.on('lights', (world, night) => { Figures.addLights(world, night); Fx.addLights(world, night); });
    Stage.on('screen', c2d => { GridOverlay.draw(c2d); Marks.drawGlow(c2d); Figures.draw(c2d); drawNames(c2d); Fx.draw(c2d); DiceTray.draw(c2d); });
    wire();
    CombatUI.log([`${adv.name}.`]);
    const where = from || adv.start;
    enter(where.map, where.at);
  }

  boot();

  return { party: () => party, bag: () => bag, here: () => here, enter, talk };
})();
