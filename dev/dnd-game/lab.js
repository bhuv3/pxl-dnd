// The effects lab: a small dark dungeon room, five heroes and five monsters, and a button for every action.
// Each press is resolved by the rules (Rules: real dice, or a forced outcome for testing an effect), the dice tray
// shows the roll, the log says it in words, and Fx plays it; the lab keeps HP and starts deaths.
const Lab = (() => {
  const W = 150, H = 110;
  const rng = Dice.rng(2026);
  const AREA = { sphere: 40, line: 110, cone: 32, undead: 60, around: 15, circle: 40, splash: 10, cube: 30 };   // map pixels: 20 ft radius, 100 ft line, 15 ft cone, the 8 squares round, 30 ft, 5 ft radius, a 30 ft cube
  // For Shield: the attack each kind of monster shoots at the wizard, and its animation if it gets through.
  const RANGED = { skeleton: ['shortbow', 'skeletonArrow'], goblin: ['sling', 'goblinSling'], cultist: ['darkBolt', 'cultistBolt'], slime: ['acidSpit', 'slimeAcid'] };
  const LOG_LINES = 14;
  let outcome = 'dice', mode = 'normal', diceOn = true, namesOn = true, playing = false;
  const $ = id => document.getElementById(id);

  // A stone room (13 × 8 squares) with flagstones, two wall torches, and a brazier, underground and dark.
  function buildRoom() {
    const m = MapModel.create(W, H, 4242, Types.GROUND.STONE_WALL);
    for (let y = 20; y < 100; y++) for (let x = 10; x < 140; x++) m.ground[y * W + x] = Types.GROUND.FLAGSTONE;
    m.settings.underground = true;
    m.settings.ambient = 0.3;
    m.settings.wind = false;
    let id = 1;
    const put = (type, x, y) => m.objects.push({ id: id++, type, x, y, seed: 1000 + id * 37, scale: 1 });
    put('sconce', 45, 19);
    put('sconce', 105, 19);
    put('barrel', 15, 26);
    put('crate', 134, 94);
    put('brazier', 75, 94);
    m.nextId = id;
    return m;
  }

  // The first seed (from start) that passes test.
  function findSeed(start, test) {
    for (let s = start; s < start + 20000; s++) if (test(s)) return s;
    throw new Error('No seed found');
  }

  // Feet position for a grid square.
  const sq = (sx, sy) => ({ x: sx * Stage.SQUARE + 5, y: sy * Stage.SQUARE + 7 });

  // Heroes on the left facing right, monsters on the right facing left; melee pairs stand next to each other.
  // Each figure carries its creature (sheet or stat block) for the rules.
  function buildCast() {
    const add = (name, key, seed, at, o = {}) => {
      const creature = Creatures.make(key.replace('hero-', ''), name);
      return Figures.add({ name, key, seed, ...sq(...at), dir: o.side === 'enemy' ? 'west' : 'east', hp: creature.hp, maxHp: creature.maxHp, creature, ...o });
    };
    add('Paladin', 'hero-paladin', 1, [6, 3]);
    add('Wizard', 'hero-wizard', 1, [3, 4]);
    add('Fighter', 'hero-fighter', 1, [6, 5]);
    add('Cleric', 'hero-cleric', 1, [2, 6]);
    add('Rogue', 'hero-rogue', 1, [4, 8]);
    const enemy = { side: 'enemy' };
    add('Skeleton', 'skeleton', 3, [7, 3], enemy);
    add('Goblin 1', 'goblin', findSeed(1, s => !!CharacterArt.get('goblin', s).light), [7, 5], enemy);
    add('Goblin 2', 'goblin', 6, [11, 4], enemy);
    add('Cultist', 'cultist', findSeed(1, s => !!CharacterArt.get('cultist', s).light), [12, 6], enemy);
    add('Slime', 'slime', 4, [10, 8], enemy);
  }

  // ---------- Who ----------

  const alive = f => !f.dead;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const nearest = (f, list) => list.filter(alive).sort((a, b) => dist(a, f) - dist(b, f))[0];
  const side = s => Figures.list.filter(f => f.side === s);
  const byName = n => Figures.list.find(f => f.name === n);

  // The effect's caster and target, fixed up to make sense (a heal goes to a hero, a sword to the enemy next to you).
  function pick(info) {
    const caster = byName(info.by);
    let target = Figures.get(+$('target').value);
    if (info.reaction) return { caster: nearest(caster, side('enemy').filter(f => f.name !== 'Goblin 1')) || nearest(caster, side('enemy')), target: caster };
    if (info.on === 'self') return { caster, target: caster };
    const want = info.on === 'ally' || info.on === 'hero' ? 'hero' : 'enemy';
    if (info.on === 'ally' && (!target || target.side !== 'hero')) target = mostHurt();
    if (!target || target.side !== want || (target.dead && info.on !== 'ally')) target = nearest(caster, side(want));
    if (info.melee && target && dist(target, caster) > Stage.SQUARE * 1.5) target = nearest(caster, side(want)) || target;
    return { caster, target };
  }

  // The hero with the least health left (the one a healer would pick).
  function mostHurt() { return side('hero').sort((a, b) => Math.max(0, a.hp) / a.maxHp - Math.max(0, b.hp) / b.maxHp)[0]; }

  // Everyone an area effect catches (the lab keeps it to enemies, so friends stand clear).
  function caughtBy(info, caster, target) {
    const foes = side(caster.side === 'hero' ? 'enemy' : 'hero').filter(alive);
    const aim = info.area === 'line' ? Figures.chest(target) : target, from = info.area === 'line' ? Figures.hand(caster) : caster;
    const dir = [aim.x - from.x, aim.y - from.y], len = Math.hypot(...dir) || 1, u = [dir[0] / len, dir[1] / len];
    switch (info.area) {
      case 'sphere': return foes.filter(f => dist(f, target) <= AREA.sphere);
      case 'circle': return foes.filter(f => dist(f, target) <= AREA.circle);
      case 'splash': return foes.filter(f => dist(f, target) <= AREA.splash);
      case 'cube': return foes.filter(f => Math.abs(f.x - target.x) <= AREA.cube && Math.abs(f.y - target.y) <= AREA.cube);
      case 'around': return foes.filter(f => dist(f, caster) <= AREA.around);
      case 'line': {
        const from = Figures.hand(caster), reach = Math.min(lineReach(from, u), info.name === 'fireBreathLine' ? 60 : AREA.line);   // 30 ft breath
        return foes.filter(f => {
          const c = Figures.chest(f), dx = c.x - from.x, dy = c.y - from.y, along = dx * u[0] + dy * u[1];
          return along > 0 && along <= reach && Math.abs(dx * u[1] - dy * u[0]) <= 5;
        });
      }
      case 'cone': return foes.filter(f => {
        const dx = f.x - caster.x, dy = f.y - caster.y, d = Math.hypot(dx, dy);
        return d <= AREA.cone && (dx * u[0] + dy * u[1]) / (d || 1) >= Math.cos(0.5);
      });
      case 'undead': return foes.filter(f => f.key === 'skeleton' && dist(f, caster) <= AREA.undead);
      default: return [target];
    }
  }

  // How far a line runs from a point before it reaches a wall (as the lightning bolt draws it).
  function lineReach(from, u) {
    const world = Stage.getWorld();
    let len = 0;
    while (len < AREA.line) {
      const x = Math.round(from.x + u[0] * len), y = Math.round(from.y + u[1] * len + 6);
      if (x < 0 || y < 0 || x >= world.w || y >= world.h || Types.isWall(world.ground[y * world.w + x])) break;
      len += 2;
    }
    return len;
  }

  // ---------- Playing an action ----------

  async function cast(name) {
    if (playing) return;
    const info = Spells.list().find(s => s.name === name);
    const { caster, target } = pick(info);
    if (!caster || caster.dead || !target) { status(`${info.label}: ${caster && caster.dead ? caster.name + ' is down' : 'no one to target'}`); return; }
    const figsHit = info.area ? caughtBy(info, caster, target) : [target];
    const opts = { rng, mode, force: outcome === 'dice' ? null : outcome };
    let fx = name, res;
    if (info.reaction) {
      const [weapon, shot] = RANGED[caster.key];
      res = Rules.resolve('shield', caster.creature, [target.creature], { ...opts, with: weapon });
      if (res.outcome !== 'miss') fx = shot;                    // through the shield: the plain shot lands
    } else res = Rules.resolve(name, caster.creature, figsHit.map(f => f.creature), opts);
    const hits = res.hits.map((h, i) => ({ fig: figsHit[i] || target, amount: h.amount, parts: h.parts, saved: h.saved, heal: h.heal }));
    $('caster').value = caster.id;
    if (!info.area && info.on !== 'self') $('target').value = target.id;
    playing = true;
    refresh();
    log(res.log);
    status(res.log[0]);
    if (diceOn && res.rolls.length) await DiceTray.show(traySpec(res.rolls[0], res));
    const first = hits[0] || {};
    await Fx.play(fx, { caster, target, point: { x: target.x, y: target.y }, result: { outcome: res.outcome, amount: first.amount, parts: first.parts }, hits, onHit });
    playing = false;
    refresh();
  }

  // The tray's picture of a roll: the kept die, the other one (advantage, disadvantage, Lucky), the sum, the result.
  function traySpec(r, res) {
    const base = { value: r.d20.value, dropped: r.d20.dropped, bonus: r.bonus, vs: r.vs };
    if (r.kind === 'save') return { ...base, label: r.ability.toUpperCase() + ' SAVE', result: r.success ? 'SAVE' : 'FAIL' };
    const label = r.d20.lucky ? 'LUCKY' : 'ATTACK' + (r.mode === 'adv' ? ' ADV' : r.mode === 'dis' ? ' DIS' : '');
    return { ...base, label, result: res.shielded ? 'SHIELD' : r.outcome === 'crit' ? 'CRIT' : r.outcome === 'hit' ? 'HIT' : 'MISS' };
  }

  // Adds an action's lines to the roll log: newest action on top, its lines in order.
  function log(lines) {
    const el = $('log');
    for (const line of [...lines].reverse()) {
      const li = document.createElement('li');
      li.textContent = line.trim();
      if (line.startsWith('  ')) li.className = 'sub';
      el.prepend(li);
    }
    while (el.children.length > LOG_LINES) el.lastChild.remove();
  }

  // Damage or healing lands (called by Fx at the moment of the hit): HP goes down, and at 0 the figure dies.
  function onHit(hit, part) {
    const f = hit.fig, n = part !== undefined ? (hit.parts || [])[part] : hit.amount;
    if (n === undefined) return;
    if (hit.heal) {
      if (f.dead) { Deaths.revive(f); f.hp = 0; }
      f.hp = f.creature.hp = Math.min(f.maxHp, Math.max(0, f.hp) + n);
      return;
    }
    f.hp = f.creature.hp = f.hp - n;
    if (f.hp <= 0 && !f.dead) Deaths.start(f, Math.sign(f.x - Figures.get(+$('caster').value).x) || 1);
  }

  // Everyone back up, home, at full HP; marks cleared.
  function reset() {
    if (playing) return;
    for (const f of Figures.list) {
      Deaths.revive(f);
      f.creature.hp = f.maxHp;
      Object.assign(f, { x: f.base.x, y: f.base.y, hp: f.maxHp, alpha: 1, ghosts: [], pose: null, arm: null, dir: f.side === 'enemy' ? 'west' : 'east' });
    }
    Marks.clear();
    refresh();
    status('Reset');
  }

  // ---------- Panel ----------

  function status(text) { $('status').textContent = text; }

  // Buttons grouped by who does them; a group's buttons are off while its figure is down.
  function buildButtons() {
    const groups = new Map();
    for (const s of Spells.list().filter(s => !s.hidden)) {
      if (!groups.has(s.group)) groups.set(s.group, []);
      groups.get(s.group).push(s);
    }
    $('effects').innerHTML = [...groups].map(([g, list]) => `<div class="group"><h3>${g}</h3>` +
      list.map(s => `<button data-fx="${s.name}">${s.label}${s.group === 'Monsters' ? ` <small>${s.by}</small>` : ''}</button>`).join('') + '</div>').join('');
    $('effects').addEventListener('click', e => { const b = e.target.closest('button'); if (b) cast(b.dataset.fx); });
  }

  function refresh() {
    document.querySelectorAll('#effects button').forEach(b => {
      const info = Spells.list().find(s => s.name === b.dataset.fx), who = byName(info.by);
      b.disabled = playing || !who || !!who.dead;
    });
    const sel = $('target'), keep = sel.value;
    sel.innerHTML = Figures.list.map(f => `<option value="${f.id}">${f.name}${f.dead ? ' (down)' : ` (${Math.max(0, f.hp)}/${f.maxHp})`}</option>`).join('');
    sel.value = keep;
  }

  function fillSelects() {
    $('caster').innerHTML = Figures.list.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    $('caster').value = byName('Wizard').id;
    refresh();
    $('target').value = byName('Goblin 2').id;
  }

  // Segmented buttons: one on at a time.
  function segmented(el, fn) {
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      fn(b.dataset.v);
    });
  }

  // Clicking a figure on the stage makes it the target.
  function onStageClick(e) {
    const r = e.target.getBoundingClientRect(), c = Stage.cam;
    const f = Figures.at((e.clientX - r.left - c.panX) / c.zoom, (e.clientY - r.top - c.panY) / c.zoom);
    if (f) $('target').value = f.id;
  }

  // Names under the feet, small and dim (monsters' a line lower, so neighbors don't run together).
  function drawNames(c2d) {
    if (!namesOn) return;
    const s = Math.max(1, Math.round(Stage.cam.zoom / 3));
    for (const f of Figures.list) {
      if (f.dead) continue;
      const p = Stage.toScreen(f.x, f.y + (f.side === 'enemy' ? 5 : 2.5));
      Popups.text(c2d, f.name, Math.round(p.x), Math.round(p.y), s, 'rgba(232, 226, 214, 0.75)', 0.75);
    }
  }

  function wire() {
    segmented($('outcome'), v => { outcome = v; });
    segmented($('mode'), v => { mode = v; });
    segmented($('speed'), v => Fx.setTimeScale(+v));
    $('grid').addEventListener('change', e => Stage.setGrid(e.target.checked));
    $('dice').addEventListener('change', e => { diceOn = e.target.checked; });
    $('names').addEventListener('change', e => { namesOn = e.target.checked; });
    $('reset').addEventListener('click', reset);
    $('stage').addEventListener('click', onStageClick);
  }

  function start() {
    Stage.init($('stage'));
    Stage.setMap(buildRoom());
    buildCast();
    buildButtons();
    fillSelects();
    wire();
    Stage.on('update', dt => { Fx.update(dt); DiceTray.update(dt * Fx.getTimeScale()); });
    Stage.on('floor', Marks.drawFloor);
    Stage.on('lights', (world, night) => { Figures.addLights(world, night); Fx.addLights(world, night); });
    Stage.on('screen', c2d => { Marks.drawGlow(c2d); Figures.draw(c2d); drawNames(c2d); Fx.draw(c2d); DiceTray.draw(c2d); });
  }

  start();

  return { cast, reset, buildRoom, busy: () => playing };
})();
