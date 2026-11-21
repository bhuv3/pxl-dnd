// The fight page (Step 4): a Fighter and a Wizard against two goblins in a small dungeon room. Sets up the room
// and the cast; CombatInput handles the player's controls.
const Fight = (() => {
  const W = 130, H = 100;
  const $ = id => document.getElementById(id);
  let seed = 7;

  // An 11 × 7 room with a broken line of crates and a pillar down the middle, two wall torches, and a brazier.
  function buildRoom() {
    const m = MapModel.create(W, H, 4242, Types.GROUND.STONE_WALL);
    for (let y = 20; y < 90; y++) for (let x = 10; x < 120; x++) m.ground[y * W + x] = Types.GROUND.FLAGSTONE;
    Object.assign(m.settings, { underground: true, ambient: 0.3, wind: false });
    let id = 1;
    const put = (type, sx, sy) => m.objects.push({ id: id++, type, x: sx * 10 + 5, y: sy * 10 + 7, seed: 1000 + id * 37, scale: 1 });
    m.objects.push({ id: id++, type: 'sconce', x: 35, y: 19, seed: 11, scale: 1 }, { id: id++, type: 'sconce', x: 95, y: 19, seed: 12, scale: 1 });
    put('crate', 6, 3);
    put('pillar', 6, 5);
    put('barrel', 6, 7);
    put('brazier', 1, 8);
    m.nextId = id;
    return m;
  }

  // Fighter and Wizard on the left; a goblin with a spear and a goblin archer on the right.
  function buildCast() {
    Figures.clear();
    const add = (name, key, sheet, seed, sx, sy, o = {}) => {
      const creature = Creatures.make(sheet, name);
      return Figures.add({ name, key, seed, ...Squares.feet(sx, sy), dir: o.side === 'enemy' ? 'west' : 'east', hp: creature.hp, maxHp: creature.maxHp, creature, ...o });
    };
    const torch = findSeed(s => !!CharacterArt.get('goblin', s).light);
    return [
      add('Fighter', 'hero-fighter', 'fighter', 1, 3, 4),
      add('Wizard', 'hero-wizard', 'wizard', 1, 2, 6),
      add('Goblin 1', 'goblin', 'goblin', torch, 9, 4, { side: 'enemy' }),
      add('Goblin 2', 'goblin', 'goblin', 6, 10, 7, { side: 'enemy', role: 'archer' }),
    ];
  }

  function findSeed(test) { for (let s = 1; s < 20000; s++) if (test(s)) return s; throw new Error('No seed found'); }

  // A new fight with the next seed (the same seed always plays out the same rolls). opts.level: the heroes' level
  // (else the page's Level picker).
  function begin(opts = {}) {
    seed++;
    CombatUI.clearLog();
    CombatUI.result(null);
    Marks.clear();
    const figs = buildCast(), level = opts.level || +$('level').value || 1;
    for (const f of figs) if (f.side !== 'enemy') { for (let l = 1; l < level; l++) Creatures.levelUp(f.creature); f.hp = f.maxHp = f.creature.maxHp; }
    CombatUI.log([`Fight ${seed}, the heroes at level ${level}.`]);
    Combat.start(figs, { rng: Dice.rng(seed), auto: opts.auto, dice: opts.dice });
  }

  // Names under the feet, small and dim.
  function drawNames(c2d) {
    const s = Math.max(1, Math.round(Stage.cam.zoom / 3));
    for (const f of Figures.list) {
      if (f.creature.slain) continue;
      const p = Stage.toScreen(f.x, f.y + 2.5);
      Popups.text(c2d, f.name, Math.round(p.x), Math.round(p.y), s, 'rgba(232, 226, 214, 0.7)', 0.7);
    }
  }

  function start() {
    Stage.init($('stage'));
    Stage.setMap(buildRoom());
    Stage.setGrid(true);
    Squares.setWorld(Stage.getWorld());
    CombatUI.init({ turnbar: $('turnbar'), actions: $('actions'), log: $('log'), result: $('result'), banner: $('banner') },
      { pick: id => CombatInput.pick(id), again: () => begin() });
    Combat.init();
    CombatInput.init({ stage: $('stage'), hint: $('hint') });
    Combat.on('log', lines => CombatUI.log(lines));
    Combat.on('over', outcome => setTimeout(() => CombatUI.result(outcome), 900));
    Stage.on('update', dt => { Fx.update(dt); DiceTray.update(dt * Fx.getTimeScale()); });
    Stage.on('floor', Marks.drawFloor);
    Stage.on('lights', (world, night) => { Figures.addLights(world, night); Fx.addLights(world, night); });
    Stage.on('screen', c2d => { GridOverlay.draw(c2d); Marks.drawGlow(c2d); Figures.draw(c2d); drawNames(c2d); Fx.draw(c2d); DiceTray.draw(c2d); });
    $('speed').addEventListener('change', e => Fx.setTimeScale(e.target.checked ? 2 : 1));
    $('level').innerHTML = Array.from({ length: Math.max(1, ...Object.keys(Creatures.LEVELS).map(Number)) }, (_, k) => `<option value="${k + 1}">Level ${k + 1}</option>`).join('');
    $('level').addEventListener('change', () => begin());
    begin();
  }

  start();

  return { begin };
})();
