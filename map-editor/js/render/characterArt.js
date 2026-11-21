// Character sprites: decodes the 8 facing images, fakes a 4-frame walk, finds the glowing orb.
// Characters drawn in code (villagers, monsters) are families: every seed is a different one, built when first needed,
// and each draws its own standing pose and 4 walking poses. A family member's pixels with alpha 254 glow: they stay
// bright at night.
const CharacterArt = (() => {
  const SIZE = 32;
  const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const FAMILY_CACHE = 400;   // built characters kept per family
  const chars = new Map();
  const families = new Map();
  const readyFns = [];

  // Registers a character from data URLs and decodes it in the background.
  function add(key, name, rotations) {
    const ch = { key, name, dirs: null, ghost: null };
    chars.set(key, ch);
    Types.addObject('Characters', key, name, '#5a6fb8');
    Promise.all(DIRS.map(d => decode(rotations[d]))).then(images => {
      ch.dirs = {};
      DIRS.forEach((d, k) => { ch.dirs[d] = buildDir(images[k], d); });
      ch.ghost = makeGhost(ch.dirs.south);
      ch.hasOrb = DIRS.some(d => ch.dirs[d].orb);   // facing away, the orb is hidden but still shines
      readyFns.forEach(fn => fn(key));
    });
  }

  // Registers a character family drawn in code. make(seed) returns, for each of DIRS, RGBA pixels (SIZE × SIZE) or
  // { stand, walk: [4 frames] } drawn in walking poses (see Villagers.kit.WALK), and optionally light: { color, radius, power, up } for one that carries a light. opts.group: library section;
  // opts.walk: { speed, roam, patrol } for how it strolls (patrol: share that range further, end to end).
  function addGenerated(key, name, color, make, opts = {}) {
    families.set(key, { key, name, make, walk: opts.walk || null, built: new Map() });
    Types.addObject(opts.group || 'Characters', key, name, color);
  }

  // The family member for a seed, built and cached on first use.
  function member(f, seed) {
    let ch = f.built.get(seed);
    if (ch) return ch;
    const images = f.make(seed);
    ch = { key: f.key, name: f.name, dirs: {}, hasOrb: false, light: images.light || null };
    DIRS.forEach(d => { const v = images[d]; ch.dirs[d] = v.stand ? buildDir(v.stand, d, false, v.walk) : buildDir(v, d, false); });
    ch.ghost = makeGhost(ch.dirs.south);
    if (f.built.size >= FAMILY_CACHE) f.built.delete(f.built.keys().next().value);
    f.built.set(seed, ch);
    return ch;
  }

  // Data URL → RGBA pixels (data URLs never taint the canvas, even on file://).
  function decode(url) {
    const img = new Image();
    img.src = url;
    return img.decode().then(() => {
      const c = document.createElement('canvas');
      c.width = c.height = SIZE;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, SIZE, SIZE).data;
    });
  }

  const alphaAt = (px, x, y) => px[(y * SIZE + x) * 4 + 3];

  // Feet row (lowest opaque row), the feet's center column, the orb pixels (if orbs), the standing frame, and 4 walk
  // frames: walk if drawn, else faked from the standing one.
  function buildDir(px, dir, orbs = true, walk = null) {
    let bottom = 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (alphaAt(px, x, y)) bottom = y;
    let sum = 0, n = 0;
    for (let y = bottom - 2; y <= bottom; y++) for (let x = 0; x < SIZE; x++) if (alphaAt(px, x, y)) { sum += x; n++; }
    const footX = n ? sum / n : SIZE / 2;
    const side = dir === 'east' ? 1 : dir === 'west' ? -1 : 0;
    const frames = walk || [px, step(px, bottom, footX, side, 1), px, step(px, bottom, footX, side, -1)];
    return { stand: px, frames, bottom, footX, orb: orbs ? findOrb(px) : null };
  }

  // One walking frame: the body bobs up a pixel and one foot lifts (or, side-on, the feet spread).
  function step(px, bottom, footX, side, phase) {
    const out = new Uint8ClampedArray(px.length);
    const from = (x, y) => (y * SIZE + x) * 4;
    const copy = (sx, sy, dx, dy) => {
      if (dx < 0 || dy < 0 || dx >= SIZE || dy >= SIZE) return;
      out.set(px.subarray(from(sx, sy), from(sx, sy) + 4), from(dx, dy));
    };
    const footTop = bottom - 3;
    for (let y = 0; y < footTop; y++) for (let x = 0; x < SIZE; x++) if (alphaAt(px, x, y)) copy(x, y, x, y - 1);
    for (let y = footTop; y <= bottom; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!alphaAt(px, x, y)) continue;
        const left = x < footX;
        if (side) {
          const front = (x > footX) === (side > 0);
          copy(x, y, x + (front ? phase : -phase) * side, y - 1);
        } else {
          const lifted = left === (phase > 0);
          copy(x, y, x, y - (lifted ? 2 : 1));
        }
      }
    }
    return out;
  }

  // Bright cyan-white pixels (the staff's orb) and their center.
  function findOrb(px) {
    const pixels = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = (y * SIZE + x) * 4;
        if (px[i + 3] && px[i + 2] >= 200 && px[i + 1] >= 170 && px[i] <= 210) pixels.push([x, y]);
      }
    }
    if (!pixels.length) return null;
    const cx = pixels.reduce((a, p) => a + p[0], 0) / pixels.length;
    const cy = pixels.reduce((a, p) => a + p[1], 0) / pixels.length;
    return { x: cx, y: cy, set: new Set(pixels.map(([x, y]) => y * SIZE + x)) };
  }

  // Half-size map-pixel sprite for the stamp ghost, drag ghost, and hit tests. Base = the feet.
  function makeGhost(d) {
    const px = [];
    const fx = Math.round(d.footX / 2), fy = Math.floor(d.bottom / 2);
    for (let y = 0; y < SIZE / 2; y++) {
      for (let x = 0; x < SIZE / 2; x++) {
        const src = d.stand;
        const i = [[1, 1], [0, 1], [1, 0], [0, 0]].map(([ox, oy]) => ((y * 2 + oy) * SIZE + x * 2 + ox) * 4).find(k => src[k + 3]);
        if (i !== undefined) px.push({ x: x - fx, y: y - fy, c: [src[i], src[i + 1], src[i + 2]], w: 0 });
      }
    }
    const box = { minX: -fx, maxX: SIZE / 2 - 1 - fx, minY: -fy, maxY: SIZE / 2 - 1 - fy };
    return { px, box, hit: new Set(px.map(p => p.x + ',' + p.y)), shadowR: 0 };
  }

  const EMPTY = { px: [], box: { minX: 0, maxX: 0, minY: 0, maxY: 0 }, hit: new Set(), shadowR: 0 };

  function has(key) { return chars.has(key) || families.has(key); }
  function isGenerated(key) { return families.has(key); }
  // How a family strolls: { speed, roam, patrol }, or null.
  function walk(key) { const f = families.get(key); return f ? f.walk : null; }
  // The character for a type (and, for a family, a seed), or null while it's still decoding.
  function get(key, seed) {
    if (families.has(key)) return member(families.get(key), seed);
    const ch = chars.get(key);
    return ch && ch.dirs ? ch : null;
  }
  function ghost(key, seed) { const ch = get(key, seed); return ch ? ch.ghost : EMPTY; }
  function onReady(fn) { readyFns.push(fn); }

  return { SIZE, DIRS, add, addGenerated, has, isGenerated, walk, get, ghost, onReady };
})();
