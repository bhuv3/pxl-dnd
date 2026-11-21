// Furniture and light sprites for rooms and dungeons, drawn from small pixel templates.
// Template letters map to palette colors; the bottom row is the object's base, centered on x = 0.
// Props marked turn can be turned a quarter (an object's turn: 1): their own turned template, or the pixels transposed.
const Props = (() => {
  const KEY = {
    o: 'trunkDark', d: 'woodDark', w: 'wood', a: 'woodAlt', L: 'woodLight', K: 'trunkMid',
    x: 'rockOutline', i: 'rockDark', M: 'rockMid', I: 'rockLight',
    s: 'stone', S: 'stoneLight', k: 'stoneDark', m: 'stoneMortar',
    r: 'roof', R: 'roofLight', q: 'roofDark',
    p: 'mushroomStem', P: 'mushroomSpot', g: 'windowLit', G: 'fire2', F: 'fire3', t: 'thatch', T: 'thatchDark', u: 'thatchLight',
    h: 'hay', H: 'hayLight', y: 'hayDark', n: 'canopyDark', v: 'canopyMid', V: 'canopyLight',
    b: 'shallow', B: 'mid', W: 'glint',
    c: 'copper', C: 'copperLight', e: 'copperDark', j: 'iron', J: 'ironLight',
  };
  // Cloth colors (bed blankets, rugs): swaps for r, R, q.
  const CLOTHS = [['roof', 'roofLight', 'roofDark'], ['mid', 'shallow', 'deep'], ['pineMid', 'pineLight', 'pineDark']];
  const BEDROLLS = CLOTHS.concat([['thatch', 'thatchLight', 'thatchDark'], ['canvas', 'canvasLight', 'canvasDark']]);
  const RUG_STONE = ['stoneDark', 'stoneLight', 'stoneMortar'];   // a stone floor medallion instead of cloth
  const BOOKS = ['fruit', 'pineLight', 'mid', 'thatch', 'roofLight', 'lilyFlower', 'mushroomStem'];

  const ART = {
    barrel: [
      '  oooo  ',
      ' oLLLLo ',
      'oLwddwLo',
      'oodLLdoo',
      'owLwwawo',
      'ojjjjjjo',
      'owLwwado',
      'owLwwado',
      'ojjjjjjo',
      'odLwwado',
      ' oooooo ',
    ],
    crate: [
      'oooooooooo',
      'oLLLLLLLLo',
      'oLwwwwwwLo',
      'oLLLLLLLLo',
      'oooooooooo',
      'odwwwwwwdo',
      'owdwwwwdwo',
      'owwdwwdwwo',
      'owwwddwwwo',
      'owwdwwdwwo',
      'owdwwwwdwo',
      'oooooooooo',
    ],
    chest: [
      ' oooooooo ',
      'oLLjLLjLLo',
      'owwjwwjwwo',
      'odwjwwjwdo',
      'oxxxxxxxxo',
      'owwjggjwwo',
      'owwjwgjwwo',
      'odwjwwjwdo',
      'oooooooooo',
    ],
    table: [
      'ooooooooooooooooo',
      'oLLLLLLLLLLLLLLLo',
      'oLwwwwwwwwwwwwwLo',
      'oLwawwwwawwwwawLo',
      'oLwwwwwwwwwwwwwLo',
      'oLwwawwwwwwawwwLo',
      'oLLLLLLLLLLLLLLLo',
      'ooooooooooooooooo',
      'odddddddddddddddo',
      ' oo           oo ',
      ' oo           oo ',
      ' oo           oo ',
    ],
    bed: [
      'ooooooooooooo',
      'oLLLLLLLLLLLo',
      'odwdwdwdwdwdo',
      'ooooooooooooo',
      'oPPPPPPPPPPPo',
      'oPPpPPPPPpPPo',
      'oPpPPPPPPPpPo',
      'oPPPPPPPPPPPo',
      'oqqqqqqqqqqqo',
      'oRRRRRRRRRRRo',
      'orrrrrrrrrrro',
      'orRrrrrrrrrro',
      'orrrrrRrrrrro',
      'orrrrrrrrrrro',
      'orrRrrrrrrrro',
      'orrrrrrrrRrro',
      'orrrrrrrrrrro',
      'orrrrrrrrrrro',
      'oqqqqqqqqqqqo',
      'ooooooooooooo',
      'odwdwdwdwdwdo',
      'ooooooooooooo',
    ],
    torch: [
      ' x x ',
      'xIGIx',
      'xiiix',
      ' xix ',
      '  d  ',
      '  d  ',
      '  d  ',
      '  d  ',
      '  o  ',
      '  o  ',
      '  o  ',
      ' ooo ',
      'o o o',
    ],
    sconce: [
      ' xdx ',
      ' xdx ',
      '  x  ',
      ' jxj ',
      '  j  ',
    ],
    brazier: [
      'xiiiiiiix',
      'xGFGFGFGx',
      'xIiiiiikx',
      ' xIiiikx ',
      '  xxxxx  ',
      '   xix   ',
      '  x x x  ',
      '  x x x  ',
      ' x  x  x ',
      ' x  x  x ',
    ],
    bench: [
      'ooooooooooooooo',
      'oLLLLLLLLLLLLLo',
      'owwwwawwwwawwwo',
      'odddddddddddddo',
      ' oo         oo ',
      ' oo         oo ',
    ],
    stool: [
      ' ooooo ',
      'oLLLLLo',
      'oLwwwLo',
      'odddddo',
      ' o   o ',
      ' o   o ',
      ' o   o ',
    ],
    roundtable: [
      '    ooooooo    ',
      '  ooLLLLLLLoo  ',
      ' oLLwwwwwwwLLo ',
      'oLwwwwawwwwwwLo',
      'oLwwwwwwwawwwLo',
      'oLwwawwwwwwwwLo',
      ' oLLwwwwwwwLLo ',
      '  ooLLLLLLLoo  ',
      '  odddddddddo  ',
      '    ooooooo    ',
      '      ooo      ',
      '     ooooo     ',
    ],
    bedroll: [
      '  oooo  ',
      ' oPPPPo ',
      'oPPppPPo',
      ' oPPPPo ',
      'oqqqqqqo',
      'oRrrrrro',
      'orrrrrro',
      'orRrrrro',
      'orrrrrro',
      'orrrRrro',
      'orrrrrro',
      'oRrrrrro',
      'orrrrrro',
      'orrRrrro',
      'orrrrrro',
      'oqqqqqqo',
      ' oooooo ',
    ],
    well: [
      '       ooooo       ',
      '     ooRRRRRoo     ',
      '   ooRRRrrrRRRoo   ',
      ' ooRRrrrrrrrrrRRoo ',
      'oqqqrrrrrrrrrrrqqqo',
      'ooooooooooooooooooo',
      '  oL           Lo  ',
      '  oLoooooooooooLo  ',
      '  oLdwwdwwdwwdwLo  ',
      '  oLoooooKoooooLo  ',
      '  oL     K     Lo  ',
      '  oL     K     Lo  ',
      '  oL    jJj    Lo  ',
      '   xxxxxxxxxxxxx   ',
      ' xxSSSSSSSSSSSSSxx ',
      'xSSkxxxxxxxxxxxkSSx',
      'xSkxBBBBBBBBBBBxkSx',
      'xSkxBbBBWBBBbBBxkSx',
      'xSSkxBBBBBBBBBxkSSx',
      'xsSSSkxxxxxxxkSSSsx',
      'xmsSSSSSSSSSSSSSsmx',
      'xsmsmsmsmsmsmsmsmsx',
      'xmsmsmsmsmsmsmsmsmx',
      ' xxxxxxxxxxxxxxxxx ',
    ],
    altar: [
      'xxxxxxxxxxxxxxx',
      'xqqqqqqqqqqqqqx',
      'xrRrrrgggrrrRrx',
      'xrrrrrgrgrrrrrx',
      'xrRrrrgggrrrRrx',
      'xqqqqqqqqqqqqqx',
      'xxxxxxxxxxxxxxx',
      'xqgqSsSsSsSqgqx',
      'xqqqsSsSsSsqqqx',
      'xSsSsSsSsSsSsSx',
      'xkskskskskskskx',
      'xxxxxxxxxxxxxxx',
    ],
    tub: [
      '    ooooooooooo    ',
      '  ooLLLLLLLLLLLoo  ',
      ' oLLbbbbbbWbbbbLLo ',
      'oLbbbWbbbbbbbbbbbLo',
      'oLbbbbbbbbbbWbbbbLo',
      'oLLbbbbbbbbbbbbbLLo',
      ' oLLLLLLLLLLLLLLLo ',
      ' owdwdwdwdwdwdwdwo ',
      ' ojjjjjjjjjjjjjjjo ',
      ' owdwdwdwdwdwdwdwo ',
      '  owdwdwdwdwdwdwo  ',
      '   ooooooooooooo   ',
    ],
    haybale: [
      '   yyyyyyy   ',
      ' yyhHHHHhhyy ',
      'yhHHhyyhhHhhy',
      'yHhhyHHhyhhhy',
      'yhhyyhhyyhhHy',
      'yhHhhhhhhhhhy',
      'yhhhytttyhhhy',
      'yHhhhhhhhhHhy',
      'yhhyhhhyhhhhy',
      ' yhyhyhyhyhy ',
      ' ytytytytyty ',
      '  yyyyyyyyy  ',
    ],
    oven: [
      '      xxxxx      ',
      '    xxSSSssxx    ',
      '  xxSSSsssssskx  ',
      ' xSSSssssssssskx ',
      ' xSSsssssssssskx ',
      'xSSssxxxxxxxsskkx',
      'xSsssxqqFqqxssskx',
      'xSssxqFGGGFqxsskx',
      'xSssxFGgggGFxsskx',
      'xsssxGggggGgxsskx',
      'xsssxxxxxxxxxsskx',
      'xksssssssssssskkx',
      'xkmkmkmkmkmkmkmkx',
      'xkkkkkkkkkkkkkkkx',
      'xxxxxxxxxxxxxxxxx',
    ],
    statue: [
      '   SSs   ',
      '  SSssk  ',
      '  SSssk  ',
      '   Ssk   ',
      '  SSSsk  ',
      ' SSSsssk ',
      'SSSsssskk',
      'SS Sss kk',
      'SS Sssk k',
      ' S Sssk  ',
      '   Sssk  ',
      '  SSsssk ',
      '  SSsssk ',
      '  SSsssk ',
      '  SSsssk ',
      ' SSSssskk',
      ' SSSssskk',
      'xxxxxxxxx',
      'xSSSssskx',
      'xmmmmmmmx',
      'xSSsssskx',
      'xSSsssskx',
      'xkkkkkkkx',
      'xxxxxxxxx',
    ],
    pillar: [
      'xxxxxxxx',
      'xSSssskx',
      'xmmmmmmx',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      ' xSsskx ',
      'xmmmmmmx',
      'xSSssskx',
      'xkkkkkkx',
      'xxxxxxxx',
    ],
    vat: [
      '    eeeeeeeee    ',
      '  eeCCCCCCCCCee  ',
      ' eCCddddddddddce ',
      'eCCdwawwawwawdcce',
      'eCCddddddddddccce',
      ' eCCCCCCCCCCccce ',
      ' ecCCcccccccccce ',
      ' ecCCcccccccccce ',
      ' jjjjjjjjjjjjjjj ',
      ' ecCCcccccccccce ',
      ' ecCCcccccccccce ',
      ' ecCCcccccccccJJ ',
      ' ecCCcccccccccjJ ',
      ' jjjjjjjjjjjjjjj ',
      ' ecCCcccccccccce ',
      ' ecCCcccccccccce ',
      '  eecccccccccee  ',
      '    eeeeeeeee    ',
    ],
    anvil: [
      'jJJJJJJJjj',
      'jJJJJJJjjj',
      ' jjJJJjjj ',
      '   jJjj   ',
      '   jJjj   ',
      '  jjJjjj  ',
      ' oKKKKKKo ',
      ' oKLKKKdo ',
      ' oooooooo ',
    ],
    lantern: [
      '  j  ',
      ' jjj ',
      ' jJj ',
      'jgggj',
      'jgPgj',
      'jgggj',
      'jjjjj',
      ' jjj ',
    ],
    sack: [
      '   TT   ',
      '  tTTt  ',
      '  tuut  ',
      ' tuuutt ',
      'tuuutttt',
      'tuuttttT',
      'tutttttT',
      'ttttttTT',
      ' TTTTTT ',
    ],
  };

  // Turned templates, where transposing the upright one wouldn't read well.
  const TURNED = {
    bench: [
      'oooooo',
      'oLLwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oLwwdo',
      'oddddo',
      'oooooo',
    ],
  };

  // Shadow size, blocked footprint depth (rows above the base), and light for each prop.
  const INFO = {
    barrel: { shadowR: 4, footprint: 4 },
    crate: { shadowR: 5, footprint: 5 },
    chest: { shadowR: 5, footprint: 4 },
    table: { shadowR: 8, footprint: 9 },
    bed: { shadowR: 6, footprint: 20 },
    bookshelf: { shadowR: 8, footprint: 3 },
    torch: { shadowR: 2, light: [0, -12, 'torch'] },
    sconce: { shadowR: 0, light: [0, -5, 'torch'], blocks: [] },
    brazier: { shadowR: 4, footprint: 3, light: [0, -9, 'brazier'] },
    candles: { shadowR: 0, blocks: [] },
    rug: { shadowR: 0, blocks: [], flat: true, turn: true },
    bench: { shadowR: 5, footprint: 3, turn: true },
    stool: { shadowR: 3, footprint: 3 },
    roundtable: { shadowR: 7, footprint: 9 },
    longtable: { shadowR: 9, footprint: 10, turn: true },
    bedroll: { shadowR: 0, blocks: [], flat: true, turn: true },
    sacks: { shadowR: 5, footprint: 4 },
    well: { shadowR: 9, footprint: 9 },
    altar: { shadowR: 7, footprint: 7 },
    tub: { shadowR: 9, footprint: 7 },
    weaponrack: { shadowR: 6, footprint: 2, turn: true },
    fence: { shadowR: 0, footprint: 1, turn: true },
    haybale: { shadowR: 6, footprint: 7 },
    planter: { shadowR: 6, footprint: 3, turn: true },
    oven: { shadowR: 8, footprint: 8, light: [0, -5, 'torch'] },
    lantern: { shadowR: 0, blocks: [], light: [0, -3, 'lantern'] },
    statue: { shadowR: 4, footprint: 4 },
    pillar: { shadowR: 4, footprint: 3 },
    vat: { shadowR: 8, footprint: 9 },
    anvil: { shadowR: 5, footprint: 3 },
    rubble: { shadowR: 5, footprint: 2 },
    roundrug: { shadowR: 0, blocks: [], flat: true },
  };
  INFO.bed.turn = true;

  const TYPES = Object.keys(INFO);
  function has(type) { return TYPES.includes(type); }

  // True for props (and ruined walls and iron fences) that can be turned a quarter.
  // How many ways an object can face: 4 for a house or a cabin (front, right, back, left), 2 for furniture, fences and
  // ruined walls (a quarter turn), 1 for the rest.
  function turns(type) { return type === 'house' || type === 'cabin' ? 4 : (INFO[type] && INFO[type].turn) || Structures.canTurn(type) ? 2 : 1; }
  function canTurn(type) { return turns(type) > 1; }

  // Turns template rows into sprite pixels. swap renames palette keys (cloth colors).
  function fromArt(rows, P, swap) {
    const px = [];
    const half = Math.floor(rows[0].length / 2), base = rows.length - 1;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ' ' || !KEY[ch]) return;
      const key = (swap && swap[ch]) || KEY[ch];
      px.push({ x: x - half, y: y - base, c: P[key], w: 0 });
    }));
    return px;
  }

  // Cloth color swap picked by the rng.
  function cloth(rng) { return clothFrom(rng, CLOTHS); }

  function clothFrom(rng, list) {
    const [r, R, q] = list[Math.floor(rng() * list.length)];
    return { r, R, q };
  }

  // Adds one pixel; a later pixel at the same spot replaces it (things in front).
  function putter(px, P) {
    const at = new Map(px.map((p, k) => [p.x + ',' + p.y, k]));
    return (x, y, key) => {
      const p = { x, y, c: P[key] || key, w: 0 }, k = at.get(x + ',' + y);
      if (k === undefined) { at.set(x + ',' + y, px.length); px.push(p); } else px[k] = p;
    };
  }

  // Long banquet table with planks along its length, on trestle legs, set with plates, mugs, loaves, and a candle or two.
  // Turned, it runs up and down the map.
  function longTable(rng, P, turn, scale) {
    const len = Math.max(21, Math.round(33 * scale)), W = turn ? 13 : len, H = turn ? len : 10;
    const px = [], put = putter(px, P), half = Math.floor(W / 2), top = -(H + 4);
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const edge = tx === 0 || ty === 0 || tx === W - 1 || ty === H - 1;
        const rim = tx === 1 || ty === 1 || tx === W - 2 || ty === H - 2;
        const along = turn ? ty : tx, across = turn ? tx : ty;
        const plank = Math.floor(across / 2) % 2 ? 'wood' : 'woodAlt';
        put(tx - half, top + ty, edge ? 'trunkDark' : rim ? 'woodLight' : along % 11 === 5 ? 'woodDark' : plank);
      }
    }
    for (let tx = 0; tx < W; tx++) { put(tx - half, -4, tx === 0 || tx === W - 1 ? 'trunkDark' : 'woodDark'); put(tx - half, -3, tx === 0 || tx === W - 1 ? 'trunkDark' : 'woodDark'); }
    for (const lx of [1 - half, 2 - half, W - 3 - half, W - 2 - half]) for (let y = -2; y <= 0; y++) put(lx, y, 'trunkDark');
    let light = null;
    const n = Math.max(3, Math.floor(len / 6));
    for (let k = 0; k < n; k++) {
      const a = 3 + Math.floor((k + 0.5) * (len - 7) / n), side = rng() < 0.5 ? 2 : (turn ? W : H) - 5;
      const [x, y] = turn ? [side - half, top + a] : [a - half, top + side];
      const r = rng();
      if (r < 0.4) { for (let c = 0; c < 3; c++) { put(x + c, y, 'stoneLight'); put(x + c, y + 1, c === 1 ? 'stoneLight' : 'stone'); } }                 // a plate
      else if (r < 0.65) { for (let rr = 0; rr < 3; rr++) { put(x, y + rr, rr ? 'rockMid' : 'rockLight'); put(x + 1, y + rr, rr ? 'rockDark' : 'rockMid'); } }      // a mug
      else if (r < 0.85) { for (let c = 0; c < 3; c++) { put(x + c, y, 'thatchLight'); put(x + c, y + 1, c === 2 ? 'thatchDark' : 'thatch'); } }        // a loaf
      else if (!light) {
        const [cx, cy] = turn ? [0, top + a] : [a - half, top + 5];
        put(cx - 1, cy, 'copper'); put(cx, cy, 'copperLight'); put(cx + 1, cy, 'copper');
        put(cx, cy - 1, 'mushroomStem'); put(cx, cy - 2, 'mushroomStem'); put(cx, cy - 3, 'mushroomSpot');
        light = [cx, cy - 3, 'candle'];
      }
    }
    return { px, light };
  }

  // Rack of spears, swords, and axes. Upright it stands against a back wall; turned, against a side wall.
  function weaponRack(rng, P, turn) {
    const px = [], put = putter(px, P);
    const weapons = [0, 1, 2, 3].map(() => Math.floor(rng() * 3));
    if (!turn) {
      for (let y = -13; y <= 0; y++) for (const x of [-8, -7, 7, 8]) put(x, y, Math.abs(x) === 8 ? 'trunkDark' : 'woodDark');
      for (let x = -6; x <= 6; x++) { put(x, -10, 'woodDark'); put(x, -9, 'trunkDark'); put(x, -2, 'woodDark'); put(x, -1, 'woodDark'); put(x, 0, 'trunkDark'); }
      weapons.forEach((kind, k) => {
        const x = -5 + k * 3;
        if (kind === 0) { put(x, -17, 'rockHighlight'); put(x, -16, 'rockLight'); put(x, -15, 'rockLight'); put(x + 1, -15, 'rockMid'); for (let y = -14; y <= -1; y++) put(x, y, 'woodLight'); }        // a spear
        else if (kind === 1) { for (let y = -16; y <= -6; y++) { put(x, y, y === -16 ? 'rockHighlight' : 'rockLight'); put(x + 1, y, 'rockMid'); } for (let c = -1; c <= 2; c++) put(x + c, -5, 'windowLit'); put(x, -4, 'trunkDark'); put(x, -3, 'trunkDark'); put(x + 1, -4, 'trunkMid'); put(x + 1, -3, 'trunkMid'); }        // a sword
        else { for (let y = -15; y <= -1; y++) put(x, y, 'woodLight'); for (let r = 0; r < 4; r++) { put(x + 1, -15 + r, 'rockLight'); put(x + 2, -15 + r, r === 0 || r === 3 ? 'rockMid' : 'rockLight'); } }        // an axe
      });
      return px;
    }
    for (let x = -3; x <= 3; x++) { put(x, -20, 'trunkDark'); put(x, -19, 'woodDark'); put(x, -1, 'woodDark'); put(x, 0, 'trunkDark'); }
    for (let y = -18; y <= -2; y++) { put(-3, y, 'woodDark'); put(3, y, 'trunkDark'); }
    weapons.forEach((kind, k) => {
      const y = -16 + k * 4;
      if (kind === 0) { put(-5, y, 'rockHighlight'); put(-4, y, 'rockLight'); for (let x = -3; x <= 5; x++) put(x, y, 'woodLight'); }
      else if (kind === 1) { for (let x = -5; x <= 2; x++) { put(x, y, 'rockLight'); put(x, y + 1, 'rockMid'); } for (let r = -1; r <= 2; r++) put(3, y + r, 'windowLit'); put(4, y, 'trunkDark'); put(5, y, 'trunkDark'); }
      else { for (let x = -3; x <= 5; x++) put(x, y, 'woodLight'); for (let c = 0; c < 3; c++) { put(-4 + c, y - 1, 'rockLight'); put(-4 + c, y - 2, c === 1 ? 'rockLight' : 'rockMid'); } }
    });
    return px;
  }

  // Wooden fence, waist-high to a person: posts every 5 pixels with two rails. Turned, it runs up and down the map.
  function fence(P, turn, scale) {
    const len = Math.max(6, Math.round(11 * scale)), px = [], put = putter(px, P), half = Math.floor(len / 2);
    if (!turn) {
      for (let k = 0; k < len; k++) {
        const x = k - half, post = k % 5 === 0 || k === len - 1;
        if (post) { put(x, -9, 'woodLight'); for (let y = -8; y <= 0; y++) put(x, y, 'trunkDark'); continue; }
        put(x, -7, 'woodLight'); put(x, -6, 'wood'); put(x, -5, 'woodDark'); put(x, -3, 'wood'); put(x, -2, 'woodDark');
      }
      return px;
    }
    for (let k = 0; k < len; k++) {
      const y = k - (len - 1), post = k % 5 === 0 || k === len - 1;
      if (post) { put(-1, y, 'trunkDark'); put(0, y, 'woodLight'); put(1, y, 'trunkDark'); put(0, y + 1, 'trunkDark'); put(0, y - 2, 'woodLight'); put(0, y - 1, 'trunkDark'); continue; }
      put(0, y, 'wood'); put(1, y, 'woodDark');
    }
    return px;
  }

  // Wooden box of leafy plants, some in flower. Turned, it runs up and down the map.
  function planter(rng, P, turn) {
    const px = [], put = putter(px, P);
    const leaf = () => rng() < 0.12 ? ['flower1', 'flower2', 'flower3'][Math.floor(rng() * 3)] : ['canopyDark', 'canopyMid', 'canopyLight'][Math.floor(rng() * 3)];
    const W = turn ? 8 : 15, H = turn ? 15 : 5, half = Math.floor(W / 2);
    for (let y = -H - 3; y < -3; y++) for (let x = -half; x <= half; x++) {
      const edge = x === -half || x === half;
      put(x, y, turn && edge ? 'trunkDark' : leaf());
    }
    for (let x = -half; x <= half; x++) {
      if (!turn && rng() < 0.6) { put(x, -H - 4, leaf()); if (rng() < 0.4) put(x, -H - 5, leaf()); }
      const side = x === -half || x === half;
      put(x, -3, side ? 'trunkDark' : 'woodLight'); put(x, -2, side ? 'trunkDark' : x % 2 ? 'wood' : 'woodDark'); put(x, -1, side ? 'trunkDark' : x % 2 ? 'wood' : 'woodDark');
      put(x, 0, 'trunkDark');
    }
    return px;
  }

  // Round rug: border, a gold ring, and a bright middle; sometimes a stone floor medallion instead.
  function roundRug(rng, P, scale) {
    const stone = rng() < 0.25, c = stone ? null : cloth(rng);
    const [body, mid, edge] = stone ? RUG_STONE : [c.r, c.R, c.q];
    const rx = Math.max(5, Math.round(11 * scale)), ry = Math.max(4, Math.round(rx * 0.72));
    const px = [];
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = Math.hypot(x / (rx + 0.5), y / (ry + 0.5));
        if (d > 1) continue;
        const a = Math.atan2(y, x), spoke = Math.abs(Math.sin(a * 4)) < 0.18 && d > 0.3 && d < 0.75;
        const key = d > 0.82 ? edge : Math.abs(d - 0.62) < 0.08 || spoke ? (stone ? 'stoneMortar' : 'thatch') : d < 0.22 ? mid : body;
        px.push({ x, y: y - ry, c: P[key], w: 0 });
      }
    }
    return px;
  }

  // Two or three grain sacks leaning together.
  function sacks(rng, P) {
    const px = [], put = putter(px, P);
    const spots = rng() < 0.5 ? [[-3, -4], [3, -3], [0, 0]] : [[-2, -1], [3, 0]];
    for (const [ox, oy] of spots) ART.sack.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== ' ') put(ox + x - 4, oy + y - 8, KEY[ch]);
    }));
    return px;
  }

  // Broken masonry: a heap of blocks and chips, lit on top, dark below.
  function rubble(rng, P, scale) {
    const px = [], put = putter(px, P), n = Math.max(4, Math.round((6 + rng() * 5) * scale));
    const spread = Math.max(4, Math.round(8 * scale));
    const blocks = [];
    for (let k = 0; k < n; k++) blocks.push([Math.round((rng() - 0.5) * 2 * spread), -Math.floor(rng() * spread * 0.6), 2 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 3)]);
    blocks.sort((a, b) => a[1] - b[1]);
    for (const [bx, by, bw, bh] of blocks) {
      for (let x = bx; x < bx + bw; x++) {
        put(x, by - bh, 'stoneLight');
        for (let y = by - bh + 1; y < by; y++) put(x, y, x === bx + bw - 1 ? 'stoneDark' : 'stone');
        put(x, by, 'stoneDark');
      }
    }
    return px;
  }

  // Stone altar under a red cloth with a gold sign, and a tall candle on each corner (one gives the light).
  function altar(P) {
    const px = fromArt(ART.altar, P), put = putter(px, P);
    for (const x of [-6, 6]) { put(x, -12, 'mushroomStem'); put(x, -13, 'mushroomStem'); put(x, -14, 'mushroomSpot'); }
    return { px, light: [6, -14, 'candle'] };
  }

  // Pixels turned a quarter: columns become rows, and the old right edge becomes the new base row.
  function turnPx(px) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of px) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const W = maxX - minX + 1, H = maxY - minY + 1;
    return px.map(p => ({ ...p, x: p.y - minY - Math.floor(H / 2), y: p.x - minX - (W - 1) }));
  }

  // Builds a prop sprite: { px, shadowR, footprint?, blocks?, anchors?, flat? }. turn: 1 for a quarter-turned prop.
  function build(type, rng, scale, P, turn) {
    const info = INFO[type];
    turn = turn && info.turn ? 1 : 0;
    let px, light = info.light;
    if (type === 'bookshelf') px = bookshelf(rng, P);
    else if (type === 'candles') ({ px, light } = candles(rng, P));
    else if (type === 'rug') px = rug(rng, P);
    else if (type === 'table') ({ px, light } = table(rng, P));
    else if (type === 'longtable') ({ px, light } = longTable(rng, P, turn, scale));
    else if (type === 'weaponrack') px = weaponRack(rng, P, turn);
    else if (type === 'fence') px = fence(P, turn, scale);
    else if (type === 'planter') px = planter(rng, P, turn);
    else if (type === 'roundrug') px = roundRug(rng, P, scale);
    else if (type === 'sacks') px = sacks(rng, P);
    else if (type === 'altar') ({ px, light } = altar(P));
    else if (type === 'rubble') px = rubble(rng, P, scale);
    else if (TURNED[type] && turn) px = fromArt(TURNED[type], P);
    else px = fromArt(ART[type], P, type === 'bed' ? cloth(rng) : type === 'bedroll' ? clothFrom(rng, BEDROLLS) : null);
    const handTurned = TURNED[type] || ['longtable', 'weaponrack', 'fence', 'planter'].includes(type);
    if (turn && !handTurned) px = turnPx(px);
    const sprite = { px, shadowR: info.shadowR };
    if (info.footprint) sprite.footprint = turn ? Math.max(1, -Math.min(...px.map(p => p.y)) - 1) : info.footprint;
    if (info.blocks) sprite.blocks = info.blocks;
    if (info.flat) sprite.flat = true;
    if (light) sprite.anchors = { light };
    return sprite;
  }

  // Table, sometimes with a candle in a holder (a small light), a mug, a plate or a loaf on top.
  function table(rng, P) {
    const px = fromArt(ART.table, P), put = putter(px, P), top = -11;
    let light = null;
    if (rng() < 0.5) {
      const cx = Math.round((rng() - 0.5) * 8);
      put(cx - 1, top + 4, 'copper'); put(cx, top + 4, 'copperLight'); put(cx + 1, top + 4, 'copper');
      put(cx, top + 3, 'mushroomStem'); put(cx, top + 2, 'mushroomStem'); put(cx, top + 1, 'mushroomSpot');
      light = [cx, top + 1, 'candle'];
    }
    if (rng() < 0.6) { const mx = rng() < 0.5 ? -6 : 5; for (let r = 0; r < 3; r++) { put(mx, top + 2 + r, r ? 'rockMid' : 'rockLight'); put(mx + 1, top + 2 + r, r ? 'rockDark' : 'rockMid'); } }
    if (rng() < 0.5) { const sx = Math.round((rng() - 0.5) * 6); for (let c = 0; c < 3; c++) { put(sx + c, top + 5, 'stoneLight'); put(sx + c, top + 6, c === 1 ? 'stoneLight' : 'stone'); } }
    return { px, light };
  }

  // Tall shelf: a top, then three rows of books in random colors and heights, some leaning, a gap here and there.
  function bookshelf(rng, P) {
    const W = 18, rows = ['o'.repeat(W), 'o' + 'L'.repeat(W - 2) + 'o', 'o'.repeat(W)];
    const px = fromArt(rows.concat(Array(18).fill('o'.repeat(W))), P);
    const put = (x, y, c) => { const p = px.find(q => q.x === x && q.y === y); if (p) p.c = c; };
    const half = W / 2;
    for (const y0 of [-17, -11, -5]) {
      for (let x = -half + 1; x < half - 1; x++) {
        const tall = rng() < 0.7, gap = rng() < 0.1;
        const c = P[BOOKS[Math.floor(rng() * BOOKS.length)]];
        for (let y = y0; y <= y0 + 4; y++) put(x, y, gap || (!tall && y === y0) ? P.rockOutline : y === y0 + 1 && rng() < 0.3 ? P.thatchLight : c);
      }
      for (let x = -half + 1; x < half - 1; x++) put(x, y0 + 5, P.woodDark);
    }
    return px;
  }

  // Two or three candles of different heights on a dish; the tallest one gives the light.
  function candles(rng, P) {
    const px = [];
    const n = rng() < 0.5 ? 2 : 3;
    let light = null, tallest = 0;
    for (let x = -n; x <= n; x++) px.push({ x, y: 0, c: Math.abs(x) === n ? P.copperDark : P.copper, w: 0 });
    for (let k = 0; k < n; k++) {
      const x = Math.round((k - (n - 1) / 2) * 2), h = 3 + Math.floor(rng() * 4);
      for (let y = 1; y <= h; y++) px.push({ x, y: -y, c: y === h ? P.mushroomSpot : P.mushroomStem, w: 0 });
      if (h > tallest) { tallest = h; light = [x, -h, 'candle']; }
    }
    return { px, light };
  }

  // Woven rug: fringed ends, a dark border, a gold band, and diamonds down the middle.
  function rug(rng, P) {
    const W = 23, H = 14, c = cloth(rng);
    const px = [];
    const cx = 11, cy = 6.5;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let key;
        if (x === 0 || x === W - 1) { if (y % 2) continue; key = 'mushroomStem'; }
        else if (x === 1 || x === W - 2 || y === 0 || y === H - 1) key = c.q;
        else if (x === 3 || x === W - 4 || y === 2 || y === H - 3) key = 'thatch';
        else {
          const d = Math.abs(((x - cx + 22) % 8) - 4) + Math.abs(y - cy);
          key = d < 1.6 ? c.R : Math.abs(d - 3) < 0.6 ? 'thatch' : c.r;
        }
        px.push({ x: x - cx, y: y - (H - 1), c: P[key], w: 0 });
      }
    }
    return px;
  }

  return { TYPES, has, canTurn, turns, build };
})();
