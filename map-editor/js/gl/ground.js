// Ground on the GPU (phase G6): Ground.bake's picture (the static layer every frame starts from) made by one fragment
// shader, and a partial redraw after an edit. The shader is a pixel-for-pixel port of render/ground.js: groundColor for
// every ground type, the wall contact shade, addPebbles, darkenRings, Height.shadeEdges and applyShadows, in that order,
// rounding to a whole 0-255 step wherever the CPU stores into its Uint8ClampedArray (round half to even, as there).
//
// The inputs are the CPU world's layers (ground, water, deck, chasm, toWall, seaDist, lift, ramp, soft, the shadow
// mask) kept as textures that live as long as the map's size does, so that after a rebuild only the tiles whose inputs
// changed are uploaded and re-shaded (see update). The shadow mask is still made on the CPU (Ground.shadowMask): it is
// a few ovals per tree, the CPU water, sprite and height code read it as world.shadowMask anyway, and putting the
// ovals on the GPU would save nothing. The fairy rings (world.rings) go to the shader as a small texture.
const GlGround = (() => {
  const TILE = 64;          // partial updates work in tiles of this size
  const MARGIN = 6;         // how far a changed input can change the picture: faceDepth looks 4 rows down, shading 2 up
  const FULL_ABOVE = 0.6;   // above this share of dirty tiles a full bake is cheaper than many small ones
  const FORMATS = {
    R8UI: { internal: 'R8UI', format: 'RED_INTEGER', type: 'UNSIGNED_BYTE' },
    R16I: { internal: 'R16I', format: 'RED_INTEGER', type: 'SHORT' },
    R32F: { internal: 'R32F', format: 'RED', type: 'FLOAT' },
  };
  const zeros = new Map();
  const zero = (Type, n) => { const k = Type.name + n; if (!zeros.has(k)) zeros.set(k, new Type(n)); return zeros.get(k); };

  // The world layers the shader reads. `from` gives the layer's array. `limit` (floats only) says which values can
  // change the picture: distances above it all look the same (toWall matters up to 2, seaDist up to waveReach + 0.5).
  const INPUTS = [
    { name: 'ground',  format: 'R8UI', from: (w, n) => w.ground },
    { name: 'water',   format: 'R8UI', from: (w, n) => w.water },
    { name: 'deck',    format: 'R8UI', from: (w, n) => w.deck },
    { name: 'chasm',   format: 'R8UI', from: (w, n) => w.chasm },
    { name: 'ramp',    format: 'R8UI', from: (w, n) => w.ramp || zero(Uint8Array, n) },
    { name: 'soft',    format: 'R8UI', from: (w, n) => w.soft || zero(Uint8Array, n) },
    { name: 'shadow',  format: 'R8UI', from: (w, n) => w.shadowMask || zero(Uint8Array, n) },
    { name: 'lift',    format: 'R16I', from: (w, n) => w.lift || zero(Int16Array, n) },
    { name: 'toWall',  format: 'R32F', from: (w, n) => w.toWall, limit: () => 2 },
    { name: 'seaDist', format: 'R32F', from: (w, n) => w.seaDist, limit: s => s.waveReach >= 1 ? s.waveReach + 0.5 : -1 },
  ];
  // Settings the shader reads (a change redraws everything), besides the palette and the seed.
  const SETTINGS = ['grassLip', 'grassPatchSize', 'waveReach', 'shading', 'flagMoss', 'underground', 'lightAngle', 'pebbleAmount', 'levelHeight'];

  let state = null;         // { gl, w, h, tex, target, rings, ringsKey, prev, uniforms }
  let disabled = false;     // a shader or GL error switched the GPU ground off for this session

  // Cell noise (Random.cells): nearest and second-nearest of jittered grid points, with the nearest one's id and the
  // offset to it. The 3 x 3 neighbourhood and the jitter are the JS, line for line. The tiny bias keeps a point that
  // sits exactly on a cell boundary (x a multiple of size) in the right cell when the GPU divides by multiplying.
  GlChunks.add('cells', `
struct Cell { float d1, d2, id, ox, oy; };
Cell cells(float x, float y, float size, int salt) {
  int gx = int(floor(x / size + 1e-4)), gy = int(floor(y / size + 1e-4));
  Cell c = Cell(1e9, 1e9, 0.0, 0.0, 0.0);
  for (int cy = gy - 1; cy <= gy + 1; cy++) {
    for (int cx = gx - 1; cx <= gx + 1; cx++) {
      float px = (float(cx) + 0.15 + hash(cx + salt, cy) * 0.7) * size;
      float py = (float(cy) + 0.15 + hash(cx, cy + salt) * 0.7) * size;
      float dx = x + 0.5 - px, dy = y + 0.5 - py;
      float d = length(vec2(dx, dy));
      if (d < c.d1) { c.d2 = c.d1; c.d1 = d; c.id = hash(cx + salt * 3, cy + 17); c.ox = dx; c.oy = dy; }
      else if (d < c.d2) c.d2 = d;
    }
  }
  return c;
}
`);

  // The shader body. Palette colours are the uniforms p_<name> (0-255 floats); the declarations are made from the
  // names the body uses, so adding a colour to a ground type needs no list.
  const BODY = `
ivec2 SZ;
bool inb(ivec2 q) { return q.x >= 0 && q.y >= 0 && q.x < SZ.x && q.y < SZ.y; }
int gAt(ivec2 q) { return int(texelFetch(u_ground, q, 0).r); }
int gOr(ivec2 q, int d) { return inb(q) ? gAt(q) : d; }
bool wallG(int g) { return g == 10 || g == 11; }
bool wetOrDeck(ivec2 q) { return texelFetch(u_water, q, 0).r != 0u || texelFetch(u_deck, q, 0).r != 0u; }
vec3 store(vec3 v) { return roundEven(clamp(v, 0.0, 255.0)); }

// Ground.atEdge: a 4-neighbour is another ground type, or off the map.
bool atEdge(ivec2 p) {
  int g = gAt(p);
  return p.x == 0 || p.y == 0 || p.x == SZ.x - 1 || p.y == SZ.y - 1 ||
    gAt(p + ivec2(-1, 0)) != g || gAt(p + ivec2(1, 0)) != g || gAt(p + ivec2(0, -1)) != g || gAt(p + ivec2(0, 1)) != g;
}

// How much a point offset from a stone's centre faces the light: -1 to 1.
float facing(float ox, float oy) {
  float len = length(vec2(ox, oy));
  if (len == 0.0) len = 1.0;
  return (ox * u_cosA - oy * u_sinA) / len;
}

// Rows below until the ground stops being wall: 1 = the wall's bottom row, 0 = none within mx.
int faceDepth(ivec2 p, int mx) {
  for (int k = 1; k <= 4; k++) {
    if (k > mx) break;
    if (p.y + k >= SZ.y) return 0;
    if (!wallG(gAt(ivec2(p.x, p.y + k)))) return k;
  }
  return 0;
}

// True when a 4-neighbour is not wall.
bool wallEdge(ivec2 p) {
  return (p.x > 0 && !wallG(gAt(p + ivec2(-1, 0)))) || (p.x < SZ.x - 1 && !wallG(gAt(p + ivec2(1, 0)))) ||
    (p.y > 0 && !wallG(gAt(p + ivec2(0, -1)))) || (p.y < SZ.y - 1 && !wallG(gAt(p + ivec2(0, 1))));
}

bool isDeck(ivec2 q, uint dk) { return inb(q) && texelFetch(u_deck, q, 0).r == dk; }
vec3 deckColor(ivec2 p, float r) {
  uint dk = texelFetch(u_deck, p, 0).r;
  bool vertical = dk == 1u;
  ivec2 a = vertical ? ivec2(1, 0) : ivec2(0, 1);
  if (!isDeck(p - a, dk) || !isDeck(p + a, dk)) return p_woodDark;
  if (((vertical ? p.y : p.x) % 3) == 2) return p_woodDark;
  return r < 0.12 ? p_woodLight : p_wood;
}

vec3 cobbleColor(ivec2 p) {
  if (atEdge(p)) return p_cobbleGap;
  Cell c = cells(float(p.x), float(p.y), 5.0, 401);
  float gap = c.d2 - c.d1;
  if (gap < 0.8) return p_cobbleGap;
  bool rim = gap < 2.2;
  float lit = facing(c.ox, c.oy);
  if (u_shading == 1 && rim && lit > 0.35) return p_cobbleLight;
  if (u_shading == 1 && rim && lit < -0.35) return p_cobbleDark;
  return c.id < 0.5 ? p_cobble : p_cobbleAlt;
}

vec3 gravelColor(ivec2 p, float r) {
  if (atEdge(p) && r < 0.6) return p_gravelDark;
  float n = noise(float(p.x), float(p.y), 6.0, 412);
  if (r < 0.1 + n * 0.08) return p_gravelDark;
  if (r > 0.9) return p_gravelLight;
  if (r > 0.84) return p_gravelWarm;
  return p_gravel;
}

vec3 flagstoneColor(ivec2 p, float r) {
  if (atEdge(p)) return p_flagGap;
  Cell c = cells(float(p.x), float(p.y), 8.0, 433);
  float gap = c.d2 - c.d1;
  if (gap < 1.0) return (u_flagMoss == 1 && noise(float(p.x), float(p.y), 9.0, 434) > 0.55) ? p_grassDark : p_flagGap;
  bool rim = gap < 2.0;
  float lit = facing(c.ox, c.oy);
  if (u_shading == 1 && rim && lit > 0.4) return p_flagLight;
  if (u_shading == 1 && rim && lit < -0.4) return p_flagDark;
  if (r < 0.04) return p_flagDark;
  return c.id < 0.5 ? p_flag : p_flagAlt;
}

vec3 rockColor(ivec2 p) {
  int k = faceDepth(p, 4);
  bool streak = hash(p.x + 71, 909) < 0.3;
  if (k == 1) return p_rockOutline;
  if (k == 2) return streak ? p_rockOutline : p_rockDark;
  if (k == 3) return streak ? p_rockDark : p_rockMid;
  if (k == 4) return p_rockLight;
  if (wallEdge(p)) return p_rockOutline;
  Cell c = cells(float(p.x), float(p.y), 16.0, 451);
  if (c.d2 - c.d1 < 0.7 && c.id < 0.35) return p_rockOutline;
  float r = hash(p.x + 13, p.y + 457);
  if (r < 0.03) return p_rockMid;
  float t = noise(float(p.x), float(p.y), 10.0, 452) + (r - 0.5) * 0.08;
  return t < 0.56 ? p_rockDark : t < 0.72 ? p_rockMid : p_rockLight;
}

vec3 stoneWallColor(ivec2 p, float r) {
  int k = faceDepth(p, 3);
  if (k == 1) return p_stoneMortar;
  if (k == 2) return ((p.x + (p.y % 2) * 2) % 4 == 0) ? p_stoneMortar : p_stoneDark;
  if (k == 3) return p_stoneLight;
  if (wallEdge(p)) return p_stoneMortar;
  if ((p.x + (p.y / 3) * 2) % 5 == 0 || p.y % 3 == 0) return p_stoneDark;
  return r < 0.08 ? p_stoneDark : p_stone;
}

vec3 woodFloorColor(ivec2 p, float r) {
  int row = p.y / 3;
  if (p.y % 3 == 2 || (p.x + row * 7) % 11 == 0) return p_woodDark;
  if (r < 0.06) return p_woodLight;
  return hash((p.x + row * 7) / 11, row + 5) < 0.5 ? p_woodAlt : p_wood;
}

vec3 tileColor(ivec2 p, float r) {
  int light = ((p.x >> 2) + (p.y >> 2)) & 1;
  if (light == 0) return r < 0.05 ? p_rockOutline : p_tileDark;
  if ((p.y & 3) == 3 || (p.x & 3) == 3) return p_flagDark;
  return r < 0.04 ? p_flag : p_tileLight;
}

vec3 slateColor(ivec2 p, float r) {
  int u = p.x % 6, v = p.y % 6;
  if (u == 5 || v == 5) return p_slateGap;
  if (u == 0 || v == 0) return p_slateLight;
  if (r < 0.05) return p_slateGap;
  return hash(p.x / 6, p.y / 6 + 3) < 0.5 ? p_slate : p_slateAlt;
}

vec3 dryEarthColor(ivec2 p, float r) {
  Cell c = cells(float(p.x), float(p.y), 9.0, 481);
  if (c.d2 - c.d1 < 0.55) return p_dryEarthDark;
  if (r < 0.03) return p_dryEarthDark;
  if (r > 0.97) return p_dryEarthLight;
  return noise(float(p.x), float(p.y), 14.0, 482) < 0.45 ? p_dryEarthLight : p_dryEarth;
}

vec3 chasmColor(ivec2 p, float r) {
  if (r > 0.996) return p_chasmStar;
  if (r > 0.99) return p_chasmMid;
  float n = noise(float(p.x), float(p.y), 18.0, 471) + (((p.x + p.y) & 1) == 1 ? 0.03 : -0.03);
  return n > 0.62 ? p_chasmMid : p_chasm;
}

vec3 caveFloorColor(ivec2 p, float r) {
  if (r < 0.04) return p_caveFloorDark;
  if (r > 0.985) return p_caveFloorLight;
  Cell c = cells(float(p.x), float(p.y), 14.0, 463);
  if (c.d2 - c.d1 < 0.6 && c.id < 0.3) return p_caveFloorShadow;
  return noise(float(p.x), float(p.y), 12.0, 461) < 0.45 ? p_caveFloorDark : p_caveFloor;
}

// Ground.baseColor: the colour of one ground pixel from its type and neighbours.
vec3 baseColor(ivec2 p) {
  int g = gAt(p);
  float r = hash(p.x + 101, p.y + 57);
  float x = float(p.x), y = float(p.y);
  int above = gOr(p + ivec2(0, -1), g), below = gOr(p + ivec2(0, 1), g);
  if (texelFetch(u_deck, p, 0).r != 0u) return deckColor(p, r);
  switch (g) {
    case 1:
      if (u_grassLip == 1 && below != 1) return p_grassLip;
      return noise(x, y, u_patch, 0) < 0.42 ? p_grassDark : p_grassLight;
    case 2:
      if (u_waveReach >= 1.0 && texelFetch(u_seaDist, p, 0).r <= u_waveReach + 0.5) return p_wetSand;
      return r < 0.05 ? p_sandDark : p_sand;
    case 9:
      return p_shallow;
    case 3: {
      int left = gOr(p + ivec2(-1, 0), g), right = gOr(p + ivec2(1, 0), g);
      if (above != g || below != g || left != g || right != g) return p_pathEdge;
      return r < 0.06 ? p_pathSpeck : p_path;
    }
    case 5: return cobbleColor(p);
    case 6: return gravelColor(p, r);
    case 7: return flagstoneColor(p, r);
    case 12: return woodFloorColor(p, r);
    case 13: return tileColor(p, r);
    case 16: return slateColor(p, r);
    case 15: return dryEarthColor(p, r);
    case 14: return chasmColor(p, r);
    case 8: return caveFloorColor(p, r);
    case 10: return rockColor(p);
    case 11: return stoneWallColor(p, r);
    case 4: return noise(x, y, 5.0, 60) < 0.5 ? p_mudDark : p_mud;
    default:
      if (u_grassLip == 1 && above == 1) return p_dirtShadow;
      if (r < 0.04) return p_dirtSpeck;
      if (r > 0.985) return p_dirtLight;
      return noise(x, y, 10.0, 40) < 0.45 ? p_dirtDark : p_dirt;
  }
  return p_dirt;
}

// Ground.groundColor: darkened next to walls (not on water, decks and chasms).
vec3 groundColor(ivec2 p) {
  vec3 c = baseColor(p);
  float d = texelFetch(u_toWall, p, 0).r;
  if (d > 2.0 || d == 0.0 || wetOrDeck(p) || texelFetch(u_chasm, p, 0).r != 0u) return c;
  float f = d <= 1.0 ? 0.72 : (((p.x + p.y) & 1) == 1 ? 0.86 : 0.93);
  return c * f;
}

// Chance of a pebble per pixel by ground type, before pebbleAmount (Ground.PEBBLE_CHANCE).
float pebbleChance(int g) {
  switch (g) {
${Object.entries(Ground.PEBBLE_CHANCE).map(([g, c]) => `    case ${g}: return ${c.toFixed(6)};`).join('\n')}
  }
  return 0.0;
}

// True when a 2 x 2 pebble starts at this pixel (Ground.addPebbles).
bool pebbleOrigin(ivec2 o) {
  if (o.x < 0 || o.y < 0 || o.x >= SZ.x - 1 || o.y >= SZ.y - 1) return false;
  int g = gAt(o);
  float chance = pebbleChance(g) * u_pebble * 2.0;
  if (chance == 0.0 || hash(o.x + 211, o.y + 97) >= chance) return false;
  ivec2 e = o + ivec2(1, 0), s = o + ivec2(0, 1), se = o + ivec2(1, 1);
  if (gAt(e) != g || gAt(s) != g || gAt(se) != g) return false;
  return !(wetOrDeck(o) || wetOrDeck(e) || wetOrDeck(s) || wetOrDeck(se));
}

// Height.shadeEdges: lift and ledge helpers.
int liftAt(ivec2 q) { return texelFetch(u_lift, q, 0).r; }
bool softAt(ivec2 q) { return texelFetch(u_soft, q, 0).r != 0u; }
bool ledge(ivec2 a, ivec2 b, int d) { return d <= u_step && softAt(a) && softAt(b); }
bool canStep(ivec2 a, ivec2 b) { int d = abs(liftAt(a) - liftAt(b)); return d <= ${Height.CLIMB} || ledge(a, b, d); }
// Pixel b is lower than a: across a cliff, or one hillside ledge down.
bool lower(ivec2 a, ivec2 b, bool cliff) {
  if (!inb(a) || !inb(b)) return false;
  int la = liftAt(a), lb = liftAt(b);
  if (lb >= la) return false;
  return cliff ? !canStep(a, b) : ledge(a, b, la - lb);
}

float edgeFactor(ivec2 p) {
  int L = liftAt(p);
  ivec2 N = p + ivec2(0, -1), S = p + ivec2(0, 1), W = p + ivec2(-1, 0), E = p + ivec2(1, 0);
  bool ramp = texelFetch(u_ramp, p, 0).r != 0u;
  float f = (softAt(p) && L > 0) ? 1.0 + min(${Height.TINT_MAX.toFixed(4)}, float(L) / float(u_step) * ${Height.TINT.toFixed(4)}) : 1.0;
  if (lower(p, W, true) || lower(p, E, true) || lower(p, N, true)) f *= 0.6;
  else if (lower(p, S, true)) f *= 1.15;
  else if (lower(p, S, false) && !ramp) f *= 1.22;
  else if (ramp && inb(S) && liftAt(S) < L) f *= 1.12;
  else if (lower(p, N, false)) f *= 1.12;
  else if (lower(p, W, false)) f *= 1.08;
  else if (lower(p, E, false)) f *= 0.8;
  if (lower(N, p, true)) f *= 0.7;
  else if (lower(N, p, false)) f *= 0.78;
  else if (lower(p + ivec2(0, -2), p, true)) f *= (((p.x + p.y) & 1) == 1) ? 0.84 : 0.9;
  return f;
}

void main() {
  SZ = ivec2(u_size);
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 col = store(groundColor(p));

  // addPebbles: the last pebble in raster order wins where two overlap, so the pixel's own origin comes first.
  if (pebbleOrigin(p)) col = p_pebbleLight;
  else if (pebbleOrigin(p + ivec2(-1, 0))) col = store((p_pebbleLight + p_pebbleDark) * 0.5);
  else if (pebbleOrigin(p + ivec2(0, -1))) col = p_pebbleDark;
  else if (pebbleOrigin(p + ivec2(-1, -1))) col = p_pebbleDark;

  // darkenRings: fairy rings darken the grass along an oval.
  if (gAt(p) == 1) {
    for (int k = 0; k < u_ringCount; k++) {
      vec4 r = texelFetch(u_rings, ivec2(k, 0), 0);
      float x = float(p.x), y = float(p.y);
      if (x < floor(r.x - r.z - 2.0) || x > r.x + r.z + 2.0 || y < floor(r.y - r.w - 2.0) || y > r.y + r.w + 2.0) continue;
      float d = length(vec2((x - r.x) / r.z, (y - r.y) / r.w));
      if (abs(d - 1.0) < 1.3 / r.z) col = p_grassLip;
    }
  }

  if (u_raised == 1 && texelFetch(u_water, p, 0).r == 0u && texelFetch(u_chasm, p, 0).r == 0u) {
    col = store(min(col * edgeFactor(p), 255.0));
  }
  if (texelFetch(u_shadow, p, 0).r != 0u) col = store(col * u_shade);
  o = vec4(col / 255.0, 1.0);
}
`;
  const PALETTE_KEYS = [...new Set([...BODY.matchAll(/\bp_(\w+)/g)].map(m => m[1]))];
  const SHADER = `{{header}}
{{frame}}
{{noise}}
{{cells}}
uniform usampler2D u_ground, u_water, u_deck, u_chasm, u_ramp, u_soft, u_shadow;
uniform isampler2D u_lift;
uniform sampler2D u_toWall, u_seaDist, u_rings;
uniform int u_ringCount, u_raised, u_step, u_grassLip, u_shading, u_flagMoss;
uniform float u_patch, u_waveReach, u_pebble, u_cosA, u_sinA;
uniform vec3 u_shade;
${PALETTE_KEYS.map(k => `uniform vec3 p_${k};`).join('\n')}
out vec4 o;
${BODY}`;

  // ---------- GPU objects ----------

  function makeTexture(gl, format, w, h) {
    const f = FORMATS[format], t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[f.internal], w, h, 0, gl[f.format], gl[f.type], null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // Copies a rectangle (map pixels; the whole layer when rect is null) of a layer's array into its texture.
  function uploadLayer(st, input, data, rect) {
    const gl = st.gl, f = FORMATS[input.format];
    gl.bindTexture(gl.TEXTURE_2D, st.tex[input.name]);
    if (!rect) { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, st.w, st.h, gl[f.format], gl[f.type], data); return; }
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, st.w);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, rect.x);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, rect.y);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, rect.x, rect.y, rect.w, rect.h, gl[f.format], gl[f.type], data);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  }

  // The textures and render target for a map of this size, made once and kept (a new size or a new context makes new).
  function ensure(w, h) {
    const gl = Gl.get();
    if (state && (state.gl !== gl || state.w !== w || state.h !== h)) { release(); state = null; }
    if (state) return state;
    const tex = {};
    for (const input of INPUTS) tex[input.name] = makeTexture(gl, input.format, w, h);
    state = { gl, w, h, tex, target: GlTex.target(w, h), rings: null, ringsKey: '', prev: null, uniforms: null };
    return state;
  }

  // Frees the GPU objects (a new map size, or the backend turning off).
  function release() {
    if (!state) return;
    const gl = state.gl;
    if (gl === Gl.get() && !gl.isContextLost()) {
      for (const k in state.tex) gl.deleteTexture(state.tex[k]);
      GlTex.freeTarget(state.target);
      if (state.rings) gl.deleteTexture(state.rings);
    }
    state = null;
  }

  // ---------- What changed since the last bake ----------

  // Calls mark(i) for every index where two typed arrays differ, comparing 32 bits at a time first.
  function compareWords(a, b, mark) {
    const n = a.length, per = 4 / a.BYTES_PER_ELEMENT, words = Math.floor(n / per);
    if (a.byteOffset % 4 || b.byteOffset % 4) { for (let i = 0; i < n; i++) if (a[i] !== b[i]) mark(i); return; }
    const x = new Int32Array(a.buffer, a.byteOffset, words), y = new Int32Array(b.buffer, b.byteOffset, words);
    for (let k = 0; k < words; k++) {
      if (x[k] === y[k]) continue;
      for (let i = k * per; i < k * per + per; i++) if (a[i] !== b[i]) mark(i);
    }
    for (let i = words * per; i < n; i++) if (a[i] !== b[i]) mark(i);
  }

  // Same for distances: only values up to `limit` can change the picture.
  function compareDistances(a, b, limit, mark) {
    if (limit < 0) return;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && (a[i] <= limit || b[i] <= limit)) mark(i);
  }

  const ringsKey = world => JSON.stringify(world.rings || []);

  // The tiles whose picture can differ from the last bake: every tile within MARGIN of a changed input pixel.
  function dirtyTiles(st, layers, world, s, key) {
    const { w, h } = st, prev = st.prev;
    const tw = Math.ceil(w / TILE), th = Math.ceil(h / TILE), flags = new Uint8Array(tw * th);
    const rect = (x0, y0, x1, y1) => {
      const a = Math.max(0, (x0 - MARGIN) >> 6), b = Math.min(tw - 1, (x1 + MARGIN) >> 6);
      const c = Math.max(0, (y0 - MARGIN) >> 6), d = Math.min(th - 1, (y1 + MARGIN) >> 6);
      for (let ty = c; ty <= d; ty++) for (let tx = a; tx <= b; tx++) flags[ty * tw + tx] = 1;
    };
    const mark = i => { const x = i % w, y = (i - x) / w; rect(x, y, x, y); };
    for (const input of INPUTS) {
      const a = prev.layers[input.name], b = layers[input.name];
      if (a === b) continue;
      if (input.limit) compareDistances(a, b, input.limit(s), mark);
      else compareWords(a, b, mark);
    }
    if (key !== prev.ringsKey) {
      for (const r of [...JSON.parse(prev.ringsKey), ...(world.rings || [])]) rect(Math.floor(r.x - r.rx - 3), Math.floor(r.y - r.ry - 3), Math.ceil(r.x + r.rx + 3), Math.ceil(r.y + r.ry + 3));
    }
    let count = 0;
    for (let i = 0; i < flags.length; i++) count += flags[i];
    return { flags, tw, th, count, total: flags.length };
  }

  // Like dirtyTiles, when the caller knows the world changed only inside `rect` ({ x0, y0, x1, y1 }, x1 and y1 exclusive;
  // Resolve.runWindow's interior): the tiles near the rectangle are dirty, and only the shadow mask (made on the CPU from the
  // things, never in place) is still compared everywhere, along with the fairy rings.
  function hintedTiles(st, layers, world, key, rect) {
    const { w, h } = st, prev = st.prev;
    const tw = Math.ceil(w / TILE), th = Math.ceil(h / TILE), flags = new Uint8Array(tw * th);
    const mark = (x0, y0, x1, y1) => {
      const a = Math.max(0, (x0 - MARGIN) >> 6), b = Math.min(tw - 1, (x1 + MARGIN) >> 6);
      const c = Math.max(0, (y0 - MARGIN) >> 6), d = Math.min(th - 1, (y1 + MARGIN) >> 6);
      for (let ty = c; ty <= d; ty++) for (let tx = a; tx <= b; tx++) flags[ty * tw + tx] = 1;
    };
    if (rect.x1 > rect.x0) mark(rect.x0, rect.y0, rect.x1 - 1, rect.y1 - 1);       // an empty rectangle: the terrain did not change
    compareWords(prev.layers.shadow, layers.shadow, i => { const x = i % w, y = (i - x) / w; mark(x, y, x, y); });
    if (key !== prev.ringsKey) {
      for (const r of [...JSON.parse(prev.ringsKey), ...(world.rings || [])]) mark(Math.floor(r.x - r.rx - 3), Math.floor(r.y - r.ry - 3), Math.ceil(r.x + r.rx + 3), Math.ceil(r.y + r.ry + 3));
    }
    let count = 0;
    for (let i = 0; i < flags.length; i++) count += flags[i];
    return { flags, tw, th, count, total: flags.length };
  }

  // Horizontal runs of dirty tiles as pixel rectangles (one draw each).
  function runsOf(d, w, h) {
    const out = [];
    for (let ty = 0; ty < d.th; ty++) {
      for (let tx = 0; tx < d.tw; tx++) {
        if (!d.flags[ty * d.tw + tx]) continue;
        let end = tx;
        while (end + 1 < d.tw && d.flags[ty * d.tw + end + 1]) end++;
        out.push({ x: tx * TILE, y: ty * TILE, w: Math.min(w, (end + 1) * TILE) - tx * TILE, h: Math.min(h, (ty + 1) * TILE) - ty * TILE });
        tx = end;
      }
    }
    return out;
  }

  // ---------- Baking ----------

  const signature = (world, map, palette) => JSON.stringify([
    world.w, world.h, map.seed | 0, SETTINGS.map(k => map.settings[k]),
    PALETTE_KEYS.map(k => palette[k]),
  ]);

  function uniformsFor(world, map, palette) {
    const s = map.settings, a = s.lightAngle * Math.PI / 180;
    const u = {
      u_size: [world.w, world.h], u_seed: ['i', map.seed | 0], u_raised: ['i', world.raised ? 1 : 0], u_step: ['i', world.step | 0],
      u_grassLip: ['i', s.grassLip ? 1 : 0], u_shading: ['i', s.shading ? 1 : 0], u_flagMoss: ['i', s.flagMoss && !s.underground ? 1 : 0],
      u_patch: s.grassPatchSize, u_waveReach: s.waveReach, u_pebble: s.pebbleAmount, u_cosA: Math.cos(a), u_sinA: Math.sin(a),
      u_shade: Ground.SHADE,
    };
    for (const k of PALETTE_KEYS) u['p_' + k] = palette[k];
    return u;
  }

  // Uploads the fairy rings (x, y, rx, ry per ring) as a one-row texture.
  function uploadRings(st, world) {
    const rings = world.rings || [], gl = st.gl;
    const data = new Float32Array(Math.max(1, rings.length) * 4);
    rings.forEach((r, k) => data.set([r.x, r.y, r.rx, r.ry], k * 4));
    if (st.rings) gl.deleteTexture(st.rings);
    st.rings = GlTex.make(Math.max(1, rings.length), 1, 'RGBA32F', data);
    st.ringCount = rings.length;
  }

  // Draws the shader over the given pixel rectangles (all of the map when null) into the render target.
  function draw(st, rects) {
    const gl = st.gl, program = GlShaders.program('ground.bake', { fs: SHADER });
    gl.bindFramebuffer(gl.FRAMEBUFFER, st.target.fbo);
    gl.viewport(0, 0, st.w, st.h);
    gl.disable(gl.BLEND);
    GlShaders.use(program, { ...st.uniforms, u_ringCount: ['i', st.ringCount] });
    INPUTS.forEach((input, unit) => { GlTex.bind(unit, st.tex[input.name]); gl.uniform1i(program.loc('u_' + input.name), unit); });
    GlTex.bind(INPUTS.length, st.rings);
    gl.uniform1i(program.loc('u_rings'), INPUTS.length);
    if (rects) gl.enable(gl.SCISSOR_TEST);
    for (const r of rects || [null]) {
      if (r) gl.scissor(r.x, r.y, r.w, r.h);
      GlShaders.drawFullscreen();
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  // Makes the static layer for a rebuilt world on the GPU and hands it to GpuWorld (GpuWorld.begin must have run).
  // The first bake, a new map size, a new palette or a changed setting bakes everything. Otherwise only the tiles
  // near an input that differs from the last bake are uploaded and redrawn, which is what a paint stroke needs:
  // the CPU Resolve has made the whole new world, and its layers are compared with the old world's here.
  // opts.full forces a full bake. Also sets world.shadowMask (made on the CPU) like Ground.bake.
  // Returns { mode: 'full' | 'partial' | 'none', tiles, of, diffMs, ms } (ms: CPU time to issue the work, not GPU time;
  // diffMs: the part of it spent finding what changed).
  function update(world, map, palette, opts = {}) {
    const t0 = performance.now();
    const { w, h } = world, n = w * h, s = map.settings;
    const st = ensure(w, h);
    world.shadowMask = Ground.shadowMask(world, s);
    const layers = {};
    for (const input of INPUTS) layers[input.name] = input.from(world, n);
    const sig = signature(world, map, palette), key = ringsKey(world);
    let mode = 'full', rects = null, tiles = 0, of = 1, diffMs = 0, hinted = false;
    if (!opts.full && st.prev && st.prev.sig === sig) {
      const d = opts.rect ? hintedTiles(st, layers, world, key, opts.rect) : dirtyTiles(st, layers, world, s, key);
      hinted = !!opts.rect;
      diffMs = performance.now() - t0;
      tiles = d.count; of = d.total;
      if (d.count === 0) mode = 'none';
      else if (d.count <= d.total * FULL_ABOVE) { mode = 'partial'; rects = runsOf(d, w, h); }
    }
    if (mode !== 'none') {
      for (const input of INPUTS) {
        if (rects) for (const r of rects) uploadLayer(st, input, layers[input.name], r);
        else uploadLayer(st, input, layers[input.name], null);
      }
      if (!rects || key !== st.ringsKey) uploadRings(st, world);
      st.uniforms = uniformsFor(world, map, palette);
      draw(st, rects);
    }
    // The previous bake's layers are kept as copies, not references: Resolve.runWindow updates the world's arrays in place, so
    // the next update would otherwise compare the world with itself and see no change. After a hinted partial update only the
    // rectangle that changed is copied (the shadow mask is a new array each time, so it is kept as it is).
    if (hinted && mode !== 'full') {
      const r = opts.rect;
      for (const k in layers) {
        if (k === 'shadow') { st.prev.layers.shadow = layers.shadow; continue; }
        for (let y = r.y0; y < r.y1; y++) st.prev.layers[k].set(layers[k].subarray(y * w + r.x0, y * w + r.x1), y * w + r.x0);
      }
      st.prev.ringsKey = key;
    } else {
      const kept = {};
      for (const k in layers) kept[k] = layers[k].slice();
      st.prev = { sig, layers: kept, ringsKey: key };
    }
    st.ringsKey = key;
    GpuWorld.setStaticTexture(st.target.tex);
    return { mode, tiles: mode === 'full' ? of : tiles, of, diffMs, ms: performance.now() - t0 };
  }

  // Full bake: Ground.bake on the GPU. Returns the RGBA8 texture (also GpuWorld's static layer).
  function bake(world, map, palette) { update(world, map, palette, { full: true }); return state.target.tex; }

  // Redraws a rectangle {x, y, w, h} (plus MARGIN around it) from the layers already on the GPU, for an edit the
  // caller has already put in them. update does this by itself for what it finds changed.
  function rebake(rect) {
    if (!state || !state.uniforms) throw new Error('GlGround.rebake: nothing has been baked yet');
    const x0 = Math.max(0, rect.x - MARGIN), y0 = Math.max(0, rect.y - MARGIN);
    const x1 = Math.min(state.w, rect.x + rect.w + MARGIN), y1 = Math.min(state.h, rect.y + rect.h + MARGIN);
    draw(state, [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }]);
  }

  // True when the GPU ground can run now.
  function available() { return !disabled && typeof Gl !== 'undefined' && GlFrame.ready() && !Gl.isLost(); }

  // For Renderer.rebuildNow: update, but a failure (a shader that doesn't compile on this GPU, say) turns the GPU
  // ground off for the session and returns null, so the caller bakes on the CPU instead.
  function run(world, map, palette, opts) {
    if (!available()) return null;
    try { return update(world, map, palette, opts); } catch (e) {
      disabled = true;
      console.warn('GlGround off:', e);
      return null;
    }
  }

  // The static layer as RGBA bytes on the CPU (top row first), or null when it isn't on the GPU. Stalls the GPU.
  function readBack(into) {
    if (!state || !available()) return null;
    const out = into || new Uint8ClampedArray(state.w * state.h * 4), gl = state.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.target.fbo);
    gl.readPixels(0, 0, state.w, state.h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
    return out;
  }

  // ---------- Parity ----------

  // Waits for the GPU to finish (reads one pixel), for timing.
  function waitForGpu() {
    if (!state) return;
    state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, state.target.fbo);
    state.gl.readPixels(0, 0, 1, 1, state.gl.RGBA, state.gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  // Adds a count of mismatched pixels per ground type to a GlParity.diff result, to see which type is below target.
  function byGround(gl, cpu, world, w, h) {
    const counts = {};
    for (let i = 0; i < w * h; i++) {
      const p = i * 4;
      if (Math.max(Math.abs(gl[p] - cpu[p]), Math.abs(gl[p + 1] - cpu[p + 1]), Math.abs(gl[p + 2] - cpu[p + 2])) > GlParity.TOLERANCE) counts[world.ground[i]] = (counts[world.ground[i]] || 0) + 1;
    }
    return counts;
  }

  // A built map (GlParity.build) baked on the GPU in full and compared with its CPU static layer. One 'ground' row.
  // Leaves the GPU bake as GpuWorld's static layer, so the frame rows that follow run on it.
  function parity(built) {
    const { world, map, palette, w, h } = built;
    const t0 = performance.now();
    update(world, map, palette, { full: true });
    waitForGpu();
    const glMs = +(performance.now() - t0).toFixed(1);
    const gl = readBack();
    const row = { map: built.name, size: `${w}x${h}`, stage: 'ground', ...GlParity.diff(gl, built.staticLayer, w, h), glMs };
    if (row.mismatched) row.byGround = byGround(gl, built.staticLayer, world, w, h);
    return row;
  }

  // A paint stroke on a built map (a block of mixed ground, a pond and a hill on a copy of its map), rebuilt on the CPU
  // and baked by update(), which must find the changed tiles by itself, against a full CPU bake of the same world.
  // Leaves the built map's own bake as the static layer again.
  function parityStroke(built) {
    const { map, palette, w, h } = built;
    const copy = { ...map, ground: map.ground.slice(), water: map.water.slice(), scatter: map.scatter.slice(), elevation: map.elevation.slice(),
      terrace: map.terrace.slice(), rivers: structuredClone(map.rivers), objects: structuredClone(map.objects) };
    const x0 = Math.max(0, (w >> 1) - 32), y0 = Math.max(0, (h >> 1) - 32);
    const paint = (layer, value, ax, ay, size) => {
      for (let y = y0 + ay; y < Math.min(h, y0 + ay + size); y++) for (let x = x0 + ax; x < Math.min(w, x0 + ax + size); x++) copy[layer][y * w + x] = value;
    };
    paint('ground', Types.GROUND.COBBLE, 0, 0, 32); paint('ground', Types.GROUND.ROCK, 32, 0, 32);
    paint('ground', Types.GROUND.SAND, 0, 32, 32); paint('ground', Types.GROUND.WOOD_FLOOR, 32, 32, 32);
    paint('water', Types.WATER.LAKE, 40, 40, 12);
    paint('elevation', 2, 8, 40, 20);
    Random.setSeed(copy.seed);
    const world = Resolve.run(copy);
    Details.place(world, copy, palette);
    Life.place(world, copy.settings);
    const cpu = Ground.bake(world, copy, palette);
    GpuWorld.begin(world, copy, null);
    const t0 = performance.now();
    const info = update(world, copy, palette);
    waitForGpu();
    const glMs = +(performance.now() - t0).toFixed(1);
    const row = { map: built.name, size: `${w}x${h}`, stage: 'ground stroke', ...GlParity.diff(readBack(), cpu, w, h), mode: info.mode, tiles: `${info.tiles}/${info.of}`, glMs };
    GpuWorld.begin(built.world, map, null);
    update(built.world, map, palette, { full: true });
    return row;
  }

  return { bake, update, rebake, run, available, readBack, waitForGpu, release, parity, parityStroke, TILE, MARGIN, paletteKeys: PALETTE_KEYS };
})();
