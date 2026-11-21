// The map data: painted layers, rivers, objects, and render settings.
const MapModel = (() => {
  const VERSION = 1;

  // Render settings every new map starts with.
  function defaultSettings() {
    return {
      // Ground
      edgeWobble: 2.5,
      grassPatchSize: 14,
      tuftDensity: 1.6,
      flowerAmount: 0.15,
      pebbleAmount: 0.5,
      raggedEdges: true,
      grassLip: true,
      flagMoss: true,          // grass grows in some flagstone gaps (never underground)
      // Water
      bandWidth: 3,
      seaBandWidth: 4,
      dither: true,
      shimmer: 0.8,
      foamWidth: 1,
      foamBreakup: 0.35,
      waveReach: 3,
      waveSpeed: 1.2,
      flowSpeed: 1.5,
      glintDensity: 1.2,
      beachWidth: 8,
      mudBanks: true,
      lakeSandRim: false,
      reeds: true,
      lilyPads: true,
      beachRocks: true,
      bridges: true,
      bridgeStyle: 'auto',
      steppingStones: true,
      // Rivers (defaults for new rivers)
      riverWidth: 8,
      riverMeander: 8,
      riverBendSize: 40,
      riverWidthWobble: 0.3,
      // Vegetation
      forestDensity: 0.8,
      forestSpacing: 1,
      treeSize: 8,
      sizeVariation: 0.25,
      treeBlobs: 5,
      leafTexture: 0.35,
      pineSize: 6,
      bushSize: 4,
      rockSize: 5,
      fruitChance: 0.25,
      forestFloor: 0.5,
      // Light
      lightAngle: 135,
      shading: true,
      outline: true,
      shadows: true,
      shadowLength: 1,
      // Wind
      wind: true,
      windStrength: 0.7,
      windSpeed: 1.3,
      fps: 11,
      // Time and life
      timeOfDay: 12,
      underground: false,
      ambient: 0.15,
      dayCycle: false,
      dayLength: 180,
      butterflies: 12,
      birds: 2,
      gulls: 0,
      fireflies: 60,
      fish: 6,
      smoke: true,
      // Weather
      weather: 'clear',
      precipitation: 0.5,
      clouds: true,
      cloudAmount: 0.35,
      cloudDarkness: 0.1,
      cloudSpeed: 1,
      fog: 0,
      // Height
      levelHeight: 6,
      stairs: true,
      // Grid and tabletop
      grid: false,
      gridSize: 10,
      gridFeet: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      gridOpacity: 0.3,
      // Season and colors
      season: 'summer',
      snow: false,
      colors: { ...Colors.DEFAULTS },
    };
  }

  // A blank map filled with one ground type.
  function create(width, height, seed, startGround) {
    const n = width * height;
    return {
      version: VERSION,
      name: 'Untitled map',
      width,
      height,
      seed,
      ground: new Uint8Array(n).fill(startGround),
      water: new Uint8Array(n),
      scatter: new Uint8Array(n),
      elevation: new Uint8Array(n),   // slope height level, 0–Types.MAX_LEVEL
      terrace: new Uint8Array(n),     // flattened ground: 0 = none, else its level + 1 (edges are cliffs)
      rivers: [],
      objects: [],
      nextId: 1,
      settings: defaultSettings(),
    };
  }

  // Unique id for a new river or object.
  function nextId(map) { return map.nextId++; }

  // Copy of everything the user can change, for undo.
  function snapshot(map) {
    return {
      ground: map.ground.slice(),
      water: map.water.slice(),
      scatter: map.scatter.slice(),
      elevation: map.elevation.slice(),
      terrace: map.terrace.slice(),
      rivers: JSON.parse(JSON.stringify(map.rivers)),
      objects: JSON.parse(JSON.stringify(map.objects)),
    };
  }

  // Puts a snapshot back into the map.
  function restore(map, snap) {
    map.ground = snap.ground.slice();
    map.water = snap.water.slice();
    map.scatter = snap.scatter.slice();
    map.elevation = snap.elevation.slice();
    map.terrace = snap.terrace.slice();
    map.rivers = JSON.parse(JSON.stringify(snap.rivers));
    map.objects = JSON.parse(JSON.stringify(snap.objects));
  }

  // Uint8Array → base64 string.
  function toBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // base64 string → Uint8Array.
  function fromBase64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  // Map → plain JSON-safe object.
  function serialize(map) {
    return {
      version: map.version, name: map.name, width: map.width, height: map.height, seed: map.seed,
      ground: toBase64(map.ground), water: toBase64(map.water), scatter: toBase64(map.scatter), elevation: toBase64(map.elevation),
      terrace: toBase64(map.terrace),
      rivers: map.rivers, objects: map.objects, nextId: map.nextId, settings: map.settings,
    };
  }

  // Plain object → map. Throws if the data doesn't look like a map.
  function deserialize(data) {
    if (!data || !data.width || !data.height || !data.ground) throw new Error('Not a map file');
    const map = create(data.width, data.height, data.seed || 1, 0);
    const n = data.width * data.height;
    const layer = s => { const a = fromBase64(s || ''); return a.length === n ? a : new Uint8Array(n); };
    map.name = data.name || 'Untitled map';
    map.ground = layer(data.ground);
    map.water = layer(data.water);
    map.scatter = layer(data.scatter);
    map.elevation = layer(data.elevation);
    map.terrace = layer(data.terrace);
    map.rivers = data.rivers || [];
    map.objects = data.objects || [];
    map.nextId = data.nextId || 1;
    const defaults = defaultSettings();
    map.settings = { ...defaults, ...(data.settings || {}) };
    map.settings.colors = { ...defaults.colors, ...((data.settings || {}).colors || {}) };
    return map;
  }

  return { defaultSettings, create, nextId, snapshot, restore, serialize, deserialize };
})();
