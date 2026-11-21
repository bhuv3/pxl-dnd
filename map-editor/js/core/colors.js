// Palette defaults, seasons, and color helpers.
const Colors = (() => {
  const DEFAULTS = {
    dirt: '#8a6a45', dirtDark: '#7d5f3d', dirtSpeck: '#6a4f33', dirtLight: '#9c7b52', dirtShadow: '#5e4630',
    mud: '#5e4630', mudDark: '#4d3826',
    grassDark: '#4b9334', grassLight: '#56a13a', grassLip: '#3a7a2e',
    tuftShadow: '#3a7a2e', bladeRoot: '#6db544', bladeMid: '#8fcc52', bladeTip: '#b4e06a',
    flower1: '#f2e35c', flower2: '#f0f0eb', flower3: '#e8738a',
    sand: '#d9c58a', sandDark: '#c8b277', wetSand: '#b39d66',
    path: '#c4a57a', pathEdge: '#a3845a', pathSpeck: '#b2936a',
    cobbleLight: '#b5afa5', cobble: '#9a948b', cobbleAlt: '#8c867d', cobbleDark: '#716b63', cobbleGap: '#57524c',
    gravel: '#a39b8e', gravelLight: '#b6aea1', gravelDark: '#857e72', gravelWarm: '#9a8b76',
    flag: '#b8ae9a', flagAlt: '#aaa08b', flagLight: '#cbc2b0', flagDark: '#8f8674', flagGap: '#6c6556',
    caveFloor: '#7f776c', caveFloorDark: '#716a60', caveFloorLight: '#8d8579', caveFloorShadow: '#5a544c',
    stone: '#a8a49c', stoneLight: '#c6c2b9', stoneDark: '#807c75', stoneMortar: '#5e5a54',
    woodAlt: '#8c6038',
    pebbleLight: '#a39a8d', pebbleDark: '#6f675d',
    deep: '#1d4470', mid: '#2a6597', shallow: '#3f8fbf', foam: '#e6f4f7', glint: '#bfe6f2',
    reedDark: '#3f6b2a', reedLight: '#5f8f34', reedTop: '#7a5230',
    lily: '#5ca23c', lilyDark: '#3d7a2a', lilyFlower: '#f0a6c0',
    canopyOutline: '#1f3d22', canopyDark: '#2d5a2b', canopyMid: '#3f7d32', canopyLight: '#5c9e3a', canopyHighlight: '#86c24a',
    fruit: '#d94c3d', trunkDark: '#4a2f1e', trunkMid: '#6b4429', trunkLight: '#8a5a35',
    pineOutline: '#132b24', pineDark: '#1e4535', pineMid: '#2b6347', pineLight: '#3f8259', snow: '#eef4f7',
    rockOutline: '#2e2d33', rockDark: '#4f4e57', rockMid: '#706f78', rockLight: '#9393a0', rockHighlight: '#b9b9c4',
    mossDark: '#4d7a2a', mossLight: '#78a83a',
    wood: '#9a6b3f', woodDark: '#6e4a2a', woodLight: '#b9864f',
    mushroomCap: '#c8443a', mushroomBrown: '#9a6a44', mushroomSpot: '#f2ece0', mushroomStem: '#e6dccb',
    roof: '#a5533a', roofDark: '#7b3a29', roofLight: '#c46f4a',
    thatch: '#c9a659', thatchDark: '#977538', thatchLight: '#e3c67e',
    windowDay: '#34445a', windowLit: '#ffd36b',
    fire1: '#fff2a8', fire2: '#ffa23a', fire3: '#d9442a', smoke: '#c4c4c8',
    butterfly: '#f29b38', bird: '#2b2b33', firefly: '#f6f08a', fish: '#c3ced4',
    tileLight: '#d9d2bf', tileDark: '#4f4842',
    chasm: '#0b0a12', chasmMid: '#17132a', chasmStar: '#7d78b0',
    canvas: '#d8cdb0', canvasLight: '#efe6cc', canvasDark: '#a89c7e',
    purple: '#8a4a9a', purpleLight: '#b37ac2', purpleDark: '#5a2a6a',
    hay: '#d1a54a', hayLight: '#ecc66a', hayDark: '#9c7630',
    dryEarth: '#cdb48a', dryEarthLight: '#dcc69e', dryEarthDark: '#a88f68',
    slate: '#6f7682', slateAlt: '#676d79', slateLight: '#858c98', slateGap: '#464b55',
    copper: '#c4753a', copperLight: '#e39a5a', copperDark: '#8a4a22',
    iron: '#4a4c54', ironLight: '#7c7f8a',
  };

  // Labels for the color pickers, in display order.
  const LABELS = {
    dirt: 'Dirt', dirtDark: 'Dirt dark', dirtSpeck: 'Dirt speck', dirtLight: 'Dirt light', dirtShadow: 'Dirt shadow',
    mud: 'Mud', mudDark: 'Mud dark',
    grassDark: 'Grass dark', grassLight: 'Grass light', grassLip: 'Grass edge',
    tuftShadow: 'Tuft shadow', bladeRoot: 'Blade root', bladeMid: 'Blade middle', bladeTip: 'Blade tip',
    flower1: 'Flower 1', flower2: 'Flower 2', flower3: 'Flower 3',
    sand: 'Sand', sandDark: 'Sand dark', wetSand: 'Wet sand',
    path: 'Sand path', pathEdge: 'Sand path edge', pathSpeck: 'Sand path speck',
    cobbleLight: 'Cobble light', cobble: 'Cobble', cobbleAlt: 'Cobble 2', cobbleDark: 'Cobble dark', cobbleGap: 'Cobble gaps',
    gravel: 'Gravel', gravelLight: 'Gravel light', gravelDark: 'Gravel dark', gravelWarm: 'Gravel warm',
    flag: 'Flagstone', flagAlt: 'Flagstone 2', flagLight: 'Flagstone light', flagDark: 'Flagstone dark', flagGap: 'Flagstone gaps',
    caveFloor: 'Cave floor', caveFloorDark: 'Cave floor dark', caveFloorLight: 'Cave floor light', caveFloorShadow: 'Cave floor shadow',
    stone: 'Stone wall', stoneLight: 'Stone wall light', stoneDark: 'Stone wall dark', stoneMortar: 'Stone wall mortar',
    woodAlt: 'Wood plank 2',
    pebbleLight: 'Pebble light', pebbleDark: 'Pebble dark',
    deep: 'Deep water', mid: 'Middle water', shallow: 'Shallow water', foam: 'Foam', glint: 'Glint',
    reedDark: 'Reed dark', reedLight: 'Reed light', reedTop: 'Cattail',
    lily: 'Lily pad', lilyDark: 'Lily pad shade', lilyFlower: 'Lily flower',
    canopyOutline: 'Canopy outline', canopyDark: 'Canopy dark', canopyMid: 'Canopy middle',
    canopyLight: 'Canopy light', canopyHighlight: 'Canopy highlight',
    fruit: 'Fruit', trunkDark: 'Trunk dark', trunkMid: 'Trunk middle', trunkLight: 'Trunk light',
    pineOutline: 'Pine outline', pineDark: 'Pine dark', pineMid: 'Pine middle', pineLight: 'Pine light', snow: 'Snow',
    rockOutline: 'Rock outline', rockDark: 'Rock dark', rockMid: 'Rock middle', rockLight: 'Rock light', rockHighlight: 'Rock highlight',
    mossDark: 'Moss dark', mossLight: 'Moss light',
    wood: 'Wood', woodDark: 'Wood dark', woodLight: 'Wood light',
    mushroomCap: 'Mushroom red', mushroomBrown: 'Mushroom brown', mushroomSpot: 'Mushroom spots', mushroomStem: 'Mushroom stem',
    roof: 'Roof', roofDark: 'Roof dark', roofLight: 'Roof light',
    thatch: 'Thatch', thatchDark: 'Thatch dark', thatchLight: 'Thatch light',
    windowDay: 'Window', windowLit: 'Window at night',
    fire1: 'Flame core', fire2: 'Flame', fire3: 'Flame tip', smoke: 'Smoke',
    butterfly: 'Butterfly', bird: 'Bird', firefly: 'Firefly', fish: 'Fish',
    tileLight: 'Tile light', tileDark: 'Tile dark',
    chasm: 'Chasm', chasmMid: 'Chasm haze', chasmStar: 'Chasm specks',
    canvas: 'Tent canvas', canvasLight: 'Tent canvas light', canvasDark: 'Tent canvas dark',
    purple: 'Purple cloth', purpleLight: 'Purple cloth light', purpleDark: 'Purple cloth dark',
    hay: 'Hay', hayLight: 'Hay light', hayDark: 'Hay dark',
    dryEarth: 'Dry earth', dryEarthLight: 'Dry earth light', dryEarthDark: 'Dry earth cracks',
    slate: 'Slate', slateAlt: 'Slate 2', slateLight: 'Slate light', slateGap: 'Slate gaps',
    copper: 'Copper', copperLight: 'Copper light', copperDark: 'Copper dark',
    iron: 'Iron', ironLight: 'Iron light',
  };

  // Each season overrides some colors and may turn on snow.
  const SEASONS = {
    summer: {
      snow: false,
      colors: {
        grassDark: '#4b9334', grassLight: '#56a13a', grassLip: '#3a7a2e', tuftShadow: '#3a7a2e',
        bladeRoot: '#6db544', bladeMid: '#8fcc52', bladeTip: '#b4e06a',
        canopyOutline: '#1f3d22', canopyDark: '#2d5a2b', canopyMid: '#3f7d32', canopyLight: '#5c9e3a', canopyHighlight: '#86c24a',
        fruit: '#d94c3d', mossDark: '#4d7a2a', mossLight: '#78a83a', lily: '#5ca23c', lilyDark: '#3d7a2a',
        reedDark: '#3f6b2a', reedLight: '#5f8f34',
      },
    },
    autumn: {
      snow: false,
      colors: {
        grassDark: '#7a8a3a', grassLight: '#869744', grassLip: '#5f6e2c', tuftShadow: '#5f6e2c',
        bladeRoot: '#9aaa4a', bladeMid: '#b8b85a', bladeTip: '#d6c86a',
        canopyOutline: '#4a2414', canopyDark: '#8a3b1c', canopyMid: '#c2582a', canopyLight: '#e08a3a', canopyHighlight: '#f2c25c',
        fruit: '#7a2a1a', mossDark: '#6f7a2a', mossLight: '#a0a83a', lily: '#8a9a3c', lilyDark: '#5f6e2c',
        reedDark: '#6b5a2a', reedLight: '#9a8a44',
      },
    },
    winter: {
      snow: true,
      colors: {
        grassDark: '#dbe5ec', grassLight: '#e8eff4', grassLip: '#b7c6d4', tuftShadow: '#b7c6d4',
        bladeRoot: '#b9c8d2', bladeMid: '#cfdae2', bladeTip: '#f2f7fa',
        canopyOutline: '#1c3530', canopyDark: '#2c4f45', canopyMid: '#3f6b5c', canopyLight: '#9fb8b8', canopyHighlight: '#eef4f7',
        fruit: '#c23b3b', mossDark: '#c9d6df', mossLight: '#eef4f7', lily: '#4f7a5c', lilyDark: '#3a5f48',
        reedDark: '#6b6a55', reedLight: '#8f8c70',
      },
    },
  };

  // "#rrggbb" → [r, g, b].
  function hexToRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16)); }

  // Multiplies a color's channels by f (below 1 darkens).
  function darken(rgb, f) { return [rgb[0] * f, rgb[1] * f, rgb[2] * f]; }

  // Settings colors as RGB arrays, ready for drawing.
  function build(colors) {
    const out = {};
    for (const k in DEFAULTS) out[k] = hexToRgb(colors[k] || DEFAULTS[k]);
    return out;
  }

  return { DEFAULTS, LABELS, SEASONS, hexToRgb, darken, build };
})();
