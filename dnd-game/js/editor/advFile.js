// Adventure files for the editor: a new adventure, reading an adventure .js file, adding a map (from a map editor
// .json file or the generator), writing the .js file back out, and handing the adventure to adventure.html to play.
const AdvFile = (() => {
  const TEST_KEY = 'dnd-game:play-test';
  const MONSTER_ART = { goblinBoss: 'goblin', goblinMinion: 'goblin' };

  // An empty adventure: the three heroes from "The Cellar Key", no maps yet.
  function blank() {
    return {
      id: 'my-adventure', name: 'My adventure', start: { map: '', at: '' },
      party: [
        { name: 'Fighter', key: 'hero-fighter', sheet: 'fighter' },
        { name: 'Cleric', key: 'hero-cleric', sheet: 'cleric' },
        { name: 'Wizard', key: 'hero-wizard', sheet: 'wizard' },
      ],
      maps: {}, dialogue: {}, quest: [], end: { title: 'My adventure: complete', text: '' },
    };
  }

  // The data an adventure file registers. The file is a script that calls Adventures.add({ ... }).
  function read(text) {
    let out = null;
    new Function('Adventures', text)({ add: d => { out = d; } });
    if (!out || !out.maps) throw new Error('No adventure in that file');
    return out;
  }

  // The adventure as a .js file: objects one key per line, short lists on one line.
  function write(adv) {
    const clean = JSON.parse(JSON.stringify(adv));
    for (const m of Object.values(clean.maps)) for (const k of ['doors', 'chests']) for (const o of m[k] || []) delete o.id;
    return `// "${adv.name}", made in the adventure editor (adventure-editor.html). Format: docs/dnd-game/adventures.md section 4.\n` +
      `Adventures.add(${pretty(clean, '')});\n`;
  }

  function pretty(v, pad) {
    const flat = inline(v);
    if (flat.length < 100 || !v || typeof v !== 'object' || (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object'))) return flat;
    if (Array.isArray(v)) return '[\n' + v.map(x => pad + '  ' + pretty(x, pad + '  ')).join(',\n') + ',\n' + pad + ']';
    return '{\n' + Object.entries(v).map(([k, x]) => `${pad}  ${key(k)}: ${pretty(x, pad + '  ')}`).join(',\n') + ',\n' + pad + '}';
  }
  function inline(v) {
    if (Array.isArray(v)) return '[' + v.map(inline).join(', ') + ']';
    if (v && typeof v === 'object') { const e = Object.entries(v); return e.length ? '{ ' + e.map(([k, x]) => `${key(k)}: ${inline(x)}`).join(', ') + ' }' : '{}'; }
    return JSON.stringify(v);
  }
  const key = k => /^[a-zA-Z_]\w*$/.test(k) ? k : JSON.stringify(k);

  // A new map's data from a map editor map (already a MapModel): the map packed in, and what the map editor
  // placed on it brought in as adventure things: monsters, villagers as townsfolk, doors, chests.
  function fromEditorMap(model) {
    const data = { name: model.name || 'Map', map: Maps.pack(model), spots: {}, monsters: [], npcs: [], doors: [], chests: [], traps: [], exits: [], areas: [] };
    adopt(data, model);
    return data;
  }

  // A new map from the editor's generator.
  function fromGenerator(biome, width, height, seed) {
    const data = { name: biome[0].toUpperCase() + biome.slice(1), generate: { biome, width, height, seed, settings: {} }, spots: {}, monsters: [], npcs: [], doors: [], chests: [], traps: [], exits: [], areas: [] };
    adopt(data, Generate.landscape(width, height, seed, biome));
    return data;
  }

  // Turns a map's own characters, doors, and chests into adventure things.
  function adopt(data, model) {
    const sq = o => [Math.floor(o.x / 10), Math.floor(o.y / 10)];
    const count = {};
    for (const o of model.objects) {
      const sheet = Creatures.MONSTERS[o.type] ? o.type : null;
      if (sheet) {
        count[sheet] = (count[sheet] || 0) + 1;
        data.monsters.push({ name: `${Creatures.MONSTERS[sheet].name} ${count[sheet]}`, key: o.type, sheet, seed: o.seed, sq: sq(o), group: 'group1' });
      } else if (o.type === 'villager') data.npcs.push({ name: `Villager ${data.npcs.length + 1}`, key: 'villager', seed: o.seed, at: { sq: sq(o) }, line: '' });
      else if (o.type === 'door') data.doors.push({ sq: sq(o) });
      else if (o.type === 'chest') data.chests.push({ sq: sq(o), gold: 0, potions: 0 });
    }
  }

  const artOf = sheet => MONSTER_ART[sheet] || sheet;

  // Downloads text as a file.
  function download(text, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Opens adventure.html playing this adventure (from its start, or from a map's spot), without exporting.
  function play(adv, from) {
    try { localStorage.setItem(TEST_KEY, JSON.stringify({ data: adv, from: from || null })); }
    catch (e) { return false; }
    window.open('adventure.html?test=1', 'dnd-game-play');
    return true;
  }

  return { blank, read, write, fromEditorMap, fromGenerator, artOf, download, play };
})();
