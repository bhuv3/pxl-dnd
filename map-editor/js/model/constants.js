// Type IDs and the list of paintable materials.
const Types = (() => {
  // MUD only comes from Resolve. 9 is Resolve.UNDERWATER. CHASM is never painted on the ground layer:
  // Resolve puts it where the water layer holds WATER.CHASM.
  const GROUND = {
    DIRT: 0, GRASS: 1, SAND: 2, PATH: 3, MUD: 4, COBBLE: 5, GRAVEL: 6, FLAGSTONE: 7,
    CAVE_FLOOR: 8, ROCK: 10, STONE_WALL: 11, WOOD_FLOOR: 12, TILE: 13, CHASM: 14, DRY_EARTH: 15, SLATE: 16,
  };
  const PATHS = new Set([GROUND.PATH, GROUND.COBBLE, GROUND.GRAVEL, GROUND.FLAGSTONE, GROUND.WOOD_FLOOR, GROUND.TILE, GROUND.SLATE]);
  const WALLS = new Set([GROUND.ROCK, GROUND.STONE_WALL]);
  const BUILT = new Set([GROUND.STONE_WALL, GROUND.WOOD_FLOOR, GROUND.TILE, GROUND.SLATE]);   // drawn exactly: no edge wobble
  // RIVER only comes from Resolve. CHASM lives on the water layer so a path under it becomes a bridge, like a river.
  const WATER = { NONE: 0, LAKE: 1, SEA: 2, RIVER: 3, CHASM: 4 };
  const SCATTER = { NONE: 0, FOREST: 1, PINES: 2, ROCKY: 3, FLOWERS: 4, BUSHES: 5 };
  // Stampable objects by toolbar section, with their Plan view dot colors and names.
  const OBJECT_GROUPS = {
    Objects: ['tree', 'pine', 'palm', 'bush', 'deadtree', 'rock', 'rubble', 'log', 'stump', 'mushrooms', 'ring', 'ruinwall', 'headstone', 'boat'],
    Buildings: ['house', 'tavern', 'temple', 'smithy', 'tower', 'windmill', 'cabin', 'hut', 'tent', 'campfire', 'well',
      'keep', 'gatehouse', 'walltower', 'lighthouse', 'crypt', 'stilthut'],
    Furniture: ['door', 'table', 'longtable', 'roundtable', 'bench', 'stool', 'bed', 'bedroll', 'chest', 'barrel', 'crate', 'sacks',
      'bookshelf', 'weaponrack', 'rug', 'roundrug', 'tub', 'altar', 'fence', 'haybale', 'planter', 'statue', 'pillar', 'vat', 'anvil',
      'banner', 'cauldron', 'ironfence'],
    Lights: ['torch', 'sconce', 'brazier', 'candles', 'lantern', 'oven'],
  };
  const OBJECTS = Object.values(OBJECT_GROUPS).flat();
  const OBJECT_COLORS = {
    tree: '#3f7d32', pine: '#2b6347', palm: '#5c9e3a', bush: '#5c9e3a', rock: '#8a8994', rubble: '#a8a49c',
    log: '#6b4429', stump: '#8a5a35', mushrooms: '#c8443a', ring: '#e6dccb',
    house: '#c46f4a', tavern: '#b0603a', temple: '#d8d2c4', smithy: '#5e5a54', tower: '#a8a49c', windmill: '#efe6cc', cabin: '#a5533a', hut: '#c9a659', tent: '#d8cdb0', campfire: '#ffa23a', well: '#a8a49c',
    door: '#6e4a2a', table: '#9a6b3f', longtable: '#9a6b3f', roundtable: '#9a6b3f', bench: '#8c6038', stool: '#8c6038',
    bed: '#c46f4a', bedroll: '#5c8a4a', chest: '#b9864f', barrel: '#6e4a2a', crate: '#8c6038', sacks: '#c9a659', bookshelf: '#4a2f1e',
    weaponrack: '#8c9099', rug: '#a5533a', roundrug: '#2a6597', tub: '#3f8fbf', altar: '#c8302a', fence: '#6e4a2a',
    haybale: '#d1a54a', planter: '#3f7d32', statue: '#c6c2b9', pillar: '#a8a49c', vat: '#c4753a', anvil: '#4f4e57',
    torch: '#ffd36b', sconce: '#ffd36b', brazier: '#ffa23a', candles: '#f2ece0', lantern: '#ffd36b', oven: '#d9442a',
    deadtree: '#4e4640', ruinwall: '#8f8b83', headstone: '#9a9ca4', boat: '#9a6b3f', keep: '#a8a49c', gatehouse: '#a8a49c',
    walltower: '#a8a49c', lighthouse: '#e6e2d6', crypt: '#807c75', stilthut: '#5a5a3a', banner: '#a82830', cauldron: '#2a2a30', ironfence: '#4a4c54',
  };
  const OBJECT_NAMES = { tree: 'Tree', pine: 'Pine', palm: 'Palm', bush: 'Bush', rock: 'Rock', rubble: 'Rubble', log: 'Log', stump: 'Stump', mushrooms: 'Mushrooms', ring: 'Fairy ring',
    house: 'House', tavern: 'Tavern', temple: 'Temple', smithy: 'Smithy', tower: 'Watchtower', windmill: 'Windmill', cabin: 'Cabin', hut: 'Hut', tent: 'Tent', campfire: 'Campfire', well: 'Well',
    door: 'Door', table: 'Table', longtable: 'Long table', roundtable: 'Round table', bench: 'Bench', stool: 'Stool',
    bed: 'Bed', bedroll: 'Bedroll', chest: 'Chest', barrel: 'Barrel', crate: 'Crate', sacks: 'Sacks', bookshelf: 'Bookshelf',
    weaponrack: 'Weapon rack', rug: 'Rug', roundrug: 'Round rug', tub: 'Bathtub', altar: 'Altar', fence: 'Fence',
    haybale: 'Hay bale', planter: 'Planter', statue: 'Statue', pillar: 'Pillar', vat: 'Brewing vat', anvil: 'Anvil',
    torch: 'Torch', sconce: 'Wall torch', brazier: 'Brazier', candles: 'Candles', lantern: 'Lantern', oven: 'Oven',
    deadtree: 'Dead tree', ruinwall: 'Ruined wall', headstone: 'Headstone', boat: 'Boat', keep: 'Castle keep', gatehouse: 'Gatehouse',
    walltower: 'Wall tower', lighthouse: 'Lighthouse', crypt: 'Crypt', stilthut: 'Hut on stilts', banner: 'Banner', cauldron: 'Cauldron', ironfence: 'Iron fence' };

  // plan: flat color used in Plan view and stroke previews. group: toolbar section.
  const MATERIALS = [
    { id: 'dirt',      name: 'Dirt',        group: 'Ground', layer: 'ground',  value: GROUND.DIRT,      plan: '#8a6a45', key: '1' },
    { id: 'grass',     name: 'Grass',       group: 'Ground', layer: 'ground',  value: GROUND.GRASS,     plan: '#56a13a', key: '2' },
    { id: 'sand',      name: 'Sand',        group: 'Ground', layer: 'ground',  value: GROUND.SAND,      plan: '#d9c58a', key: '3' },
    { id: 'cavefloor', name: 'Cave floor',  group: 'Ground', layer: 'ground',  value: GROUND.CAVE_FLOOR, plan: '#8c8478', key: '' },
    { id: 'dryearth',  name: 'Dry earth',   group: 'Ground', layer: 'ground',  value: GROUND.DRY_EARTH, plan: '#cdb48a', key: '' },
    { id: 'path',      name: 'Sand path',   group: 'Paths',  layer: 'ground',  value: GROUND.PATH,      plan: '#c4a57a', key: '4' },
    { id: 'cobble',    name: 'Cobblestone', group: 'Paths',  layer: 'ground',  value: GROUND.COBBLE,    plan: '#85807a', key: '' },
    { id: 'gravel',    name: 'Gravel',      group: 'Paths',  layer: 'ground',  value: GROUND.GRAVEL,    plan: '#a59d90', key: '' },
    { id: 'flagstone', name: 'Flagstones',  group: 'Paths',  layer: 'ground',  value: GROUND.FLAGSTONE, plan: '#b3a993', key: '' },
    { id: 'woodfloor', name: 'Wood floor',  group: 'Paths',  layer: 'ground',  value: GROUND.WOOD_FLOOR, plan: '#9a6b3f', key: '' },
    { id: 'tile',      name: 'Tile floor',  group: 'Paths',  layer: 'ground',  value: GROUND.TILE,      plan: '#cfc6b2', key: '' },
    { id: 'slate',     name: 'Slate floor', group: 'Paths',  layer: 'ground',  value: GROUND.SLATE,     plan: '#6f7682', key: '' },
    { id: 'rock',      name: 'Rock wall',   group: 'Walls',  layer: 'ground',  value: GROUND.ROCK,      plan: '#4f4e57', key: '' },
    { id: 'stonewall', name: 'Stone wall',  group: 'Walls',  layer: 'ground',  value: GROUND.STONE_WALL, plan: '#a7a39b', key: '' },
    { id: 'chasm',     name: 'Chasm',       group: 'Walls',  layer: 'water',   value: WATER.CHASM,      plan: '#1a1530', key: '' },
    { id: 'raise',     name: 'Raise',       group: 'Height', layer: 'elevation', value: 1, op: 'add', plan: '#e3d6b0', key: '' },
    { id: 'lower',     name: 'Lower',       group: 'Height', layer: 'elevation', value: -1, op: 'add', plan: '#6f6656', key: '' },
    { id: 'flatten',   name: 'Flatten',     group: 'Height', layer: 'terrace', value: 0, op: 'flat', plan: '#a89c80', key: '' },
    { id: 'lake',      name: 'Lake',        group: 'Water',  layer: 'water',   value: WATER.LAKE,       plan: '#3f8fbf', key: '5' },
    { id: 'sea',       name: 'Sea',         group: 'Water',  layer: 'water',   value: WATER.SEA,        plan: '#1d4470', key: '6' },
    { id: 'forest',    name: 'Forest',      group: 'Areas',  layer: 'scatter', value: SCATTER.FOREST,   plan: '#2d5a2b', key: '7' },
    { id: 'pines',     name: 'Pines',       group: 'Areas',  layer: 'scatter', value: SCATTER.PINES,    plan: '#1e4535', key: '8' },
    { id: 'bushes',    name: 'Bushes',      group: 'Areas',  layer: 'scatter', value: SCATTER.BUSHES,   plan: '#5c9e3a', key: '' },
    { id: 'rocky',     name: 'Rocky',       group: 'Areas',  layer: 'scatter', value: SCATTER.ROCKY,    plan: '#8a8994', key: '9' },
    { id: 'flowers',   name: 'Flowers',     group: 'Areas',  layer: 'scatter', value: SCATTER.FLOWERS,  plan: '#e8738a', key: '0' },
  ];

  const RIVER_PLAN = '#2a6597';
  const MAX_LEVEL = 7;   // height levels 0–7
  const MAX_DROPS = 3;   // a river can be lowered this many levels

  // Adds a stampable object type at runtime (used by characters as they load).
  function addObject(group, id, name, color) {
    (OBJECT_GROUPS[group] = OBJECT_GROUPS[group] || []).push(id);
    OBJECTS.push(id);
    OBJECT_NAMES[id] = name;
    OBJECT_COLORS[id] = color;
  }

  // True for every kind of path: they all get bridges and stay clear of plants.
  function isPath(g) { return PATHS.has(g); }

  // True for rock and stone walls: solid, nothing grows or walks there.
  function isWall(g) { return WALLS.has(g); }

  // True for the bottomless drop Resolve makes from a painted chasm: nothing stands or grows there.
  function isChasm(g) { return g === GROUND.CHASM; }

  // True for built ground (stone walls, wood floors), which keeps its exact painted shape.
  function isBuilt(g) { return BUILT.has(g); }

  // Finds a material by id.
  function material(id) { return MATERIALS.find(m => m.id === id); }

  // Finds the material that a layer value belongs to.
  function materialFor(layer, value) { return MATERIALS.find(m => m.layer === layer && m.value === value); }

  return { GROUND, WATER, MAX_LEVEL, MAX_DROPS, isPath, isWall, isChasm, isBuilt, addObject, SCATTER, OBJECTS, OBJECT_GROUPS, OBJECT_COLORS, OBJECT_NAMES, MATERIALS, RIVER_PLAN, material, materialFor };
})();
