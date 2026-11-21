// The practice room: pick a hero and try every attack and spell they have on a goblin, three goblins, a cultist
// (a Humanoid, for Hold Person), or a skeleton, in a medium dungeon room, with the real fight rules and controls.
// Switches make the enemies unkillable and harmless and give the hero their action, movement, and slots back
// after everything (Combat's practice switches, changed live).
const Practice = (() => {
  const W = 180, H = 130;
  const $ = id => document.getElementById(id);
  const KEY = 'dnd-game:practice-hero', FOE_KEY = 'dnd-game:practice-foe', LEVEL_KEY = 'dnd-game:practice-level';
  // Each hero with everything they can do here, including the spells and features they'd only get at higher
  // levels, and the slots for them.
  const HEROES = {
    fighter: { name: 'Fighter', actions: ['swordSwing', 'secondWind'] },
    wizard:  { name: 'Wizard', actions: ['fireBolt', 'rayOfFrost', 'acidSplash', 'poisonSpray', 'shockingGrasp', 'chillTouch', 'trueStrike',
      'magicMissile', 'chromaticOrb', 'burningHands', 'thunderwave', 'sleep', 'mageArmor', 'scorchingRay', 'shatter', 'blur', 'mistyStep', 'holdPerson', 'mirrorImage', 'flamingSphere',
      'fireball', 'lightningBolt', 'hypnoticPattern', 'haste'], slots: { 1: 4, 2: 3, 3: 2 } },
    cleric:  { name: 'Cleric', actions: ['sacredFlame', 'guidingBolt', 'inflictWounds', 'bless', 'shieldOfFaith', 'healingWord', 'cureWounds', 'holdPerson'], slots: { 1: 4, 2: 2 } },
    rogue:   { name: 'Rogue', actions: ['sneakAttack', 'throwDagger'] },
    paladin: { name: 'Paladin', actions: ['swordSwing', 'divineSmite', 'fireBreath', 'fireBreathLine', 'bless'], slots: { 1: 2 } },
  };
  // Who to practice on: [sheet, art] each, and where they stand.
  const FOES = {
    goblin:   { name: 'A goblin', cast: [['goblin', 12, 5]] },
    goblins:  { name: 'Three goblins', cast: [['goblin', 12, 5], ['goblin', 13, 3], ['goblin', 13, 7]] },
    cultist:  { name: 'A cultist', cast: [['cultist', 12, 5]] },
    skeleton: { name: 'A skeleton', cast: [['skeleton', 12, 5]] },
  };
  const rules = { unkillable: true, passive: true, endless: true };
  let hero = 'wizard', foe = 'goblin', level = 1, seed = 20;
  const topLevel = () => Math.max(1, ...Object.keys(Creatures.LEVELS).map(Number));     // the highest level built

  // A 16 × 11 room: two pillars, a brazier, a few crates and barrels, wall torches.
  function buildRoom() {
    const m = MapModel.create(W, H, 5151, Types.GROUND.STONE_WALL);
    for (let y = 20; y < 120; y++) for (let x = 10; x < 170; x++) m.ground[y * W + x] = Types.GROUND.FLAGSTONE;
    Object.assign(m.settings, { underground: true, ambient: 0.34, wind: false });
    let id = 1;
    const put = (type, sx, sy) => m.objects.push({ id: id++, type, x: sx * 10 + 5, y: sy * 10 + 7, seed: 2000 + id * 41, scale: 1 });
    for (const x of [35, 85, 135]) m.objects.push({ id: id++, type: 'sconce', x, y: 19, seed: 30 + x, scale: 1 });
    put('pillar', 6, 4); put('pillar', 11, 8);
    put('brazier', 8, 10);
    put('crate', 1, 2); put('crate', 2, 2); put('barrel', 15, 10); put('barrel', 15, 2);
    m.nextId = id;
    return m;
  }

  // The chosen hero at the chosen level on the left (the practice spells, plus what the level gives, and the more
  // slots of the two), the chosen enemies on the right (a goblin carries a torch).
  function buildCast() {
    Figures.clear();
    const h = HEROES[hero], c = Creatures.make(hero, h.name);
    for (let l = 1; l < level; l++) Creatures.levelUp(c);
    c.actions = [...new Set([...h.actions, ...(c.actions || [])])];
    if (h.slots) for (const [l, n] of Object.entries(h.slots)) c.slots[l] = c.maxSlots[l] = Math.max(n, c.maxSlots[l] || 0);
    const list = FOES[foe].cast;
    const torch = findSeed(s => !!CharacterArt.get('goblin', s).light);
    return [
      Figures.add({ name: h.name, key: 'hero-' + hero, seed: 1, ...Squares.feet(3, 6), dir: 'east', side: 'hero', hp: c.hp, maxHp: c.maxHp, creature: c }),
      ...list.map(([id, sx, sy], k) => {
        const name = Creatures.MONSTERS[id].name + (list.length > 1 ? ' ' + (k + 1) : ''), m = Creatures.make(id, name);
        return Figures.add({ name, key: id, seed: id === 'goblin' && !k ? torch : 7 + k * 13, ...Squares.feet(sx, sy), dir: 'west', side: 'enemy', hp: m.hp, maxHp: m.maxHp, creature: m });
      }),
    ];
  }

  function findSeed(test) { for (let s = 1; s < 20000; s++) if (test(s)) return s; return 1; }

  // A fresh start with the chosen hero.
  function begin() {
    seed++;
    CombatUI.clearLog();
    CombatUI.result(null);
    Marks.clear();
    renderPicker();
    CombatUI.log([`Practice: the level ${level} ${HEROES[hero].name} against ${FOES[foe].name.toLowerCase()}.`]);
    Combat.start(buildCast(), { rng: Dice.rng(seed), dice: $('dice').checked, practice: rules });
  }

  function pick(id) {
    hero = id;
    try { localStorage.setItem(KEY, id); } catch (e) {}
    begin();
  }
  function pickLevel(n) {
    level = n;
    try { localStorage.setItem(LEVEL_KEY, String(n)); } catch (e) {}
    begin();
  }
  function pickFoe(id) {
    foe = id;
    try { localStorage.setItem(FOE_KEY, id); } catch (e) {}
    begin();
  }

  function renderPicker() {
    $('heroes').innerHTML = Object.entries(HEROES).map(([id, h]) => `<button data-hero="${id}" class="${id === hero ? 'on' : ''}">${h.name}</button>`).join('');
    $('levels').innerHTML = Array.from({ length: topLevel() }, (_, k) => `<button data-level="${k + 1}" class="${k + 1 === level ? 'on' : ''}">${k + 1}</button>`).join('');
    $('foes').innerHTML = Object.entries(FOES).map(([id, o]) => `<button data-foe="${id}" class="${id === foe ? 'on' : ''}">${o.name}</button>`).join('');
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

  function wire() {
    $('heroes').addEventListener('click', e => { const b = e.target.closest('[data-hero]'); if (b) pick(b.dataset.hero); });
    $('levels').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b) pickLevel(+b.dataset.level); });
    $('foes').addEventListener('click', e => { const b = e.target.closest('[data-foe]'); if (b) pickFoe(b.dataset.foe); });
    for (const k of Object.keys(rules)) $(k).addEventListener('change', e => { rules[k] = e.target.checked; CombatInput.refresh(); });
    $('dice').addEventListener('change', e => { const s = Combat.state(); if (s) s.dice = e.target.checked; });
    $('speed').addEventListener('change', e => Fx.setTimeScale(e.target.checked ? 2 : 1));
    $('reset').addEventListener('click', begin);
  }

  function start() {
    try { const saved = localStorage.getItem(KEY), against = localStorage.getItem(FOE_KEY); if (HEROES[saved]) hero = saved; if (FOES[against]) foe = against;
      const lv = +localStorage.getItem(LEVEL_KEY); if (lv >= 1 && lv <= topLevel()) level = lv; } catch (e) {}
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
    wire();
    begin();
  }

  start();

  return { begin, pick, pickFoe, pickLevel, rules, heroes: () => HEROES };
})();
