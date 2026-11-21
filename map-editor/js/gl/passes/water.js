// Stage 'water' (phase G4): Water.draw on the GPU. One full-frame pass paints every water pixel (depth bands, shimmer,
// foam, the dark shade under docks) and the sea waves on the beach; two small instanced draws add the lake glints
// and the glints drifting down the rivers. Anything that darkens in an object's shadow reads the shadow flag.
//
// Layers: water kind, waterDist, seaDist, flowX, flowY, and 'waterFlags' (bit 1 shadow, bit 2 under a deck, bit 4 wash).
GpuWorld.define('flowX', { format: 'R32F', from: w => w.flowX });
GpuWorld.define('flowY', { format: 'R32F', from: w => w.flowY });
GpuWorld.define('waterFlags', { format: 'R8UI', from: world => WaterPass.flags(world) });

const WaterPass = (() => {
  const SHADOW = 1, UNDER_DECK = 2, WASH = 4;
  const POINTS_WIDTH = 2048;                   // river points texture: two texels per point, rows of this width

  // Shared GLSL: shaded colour output and the water layers every water shader reads.
  GlChunks.add('waterCommon', `
uniform usampler2D u_water;
uniform usampler2D u_flags;
uniform sampler2D u_dist;
uniform vec3 u_shade;
// A colour (0-255) as the output, darkened when the pixel lies in an object's shadow.
vec3 shaded(vec3 c, uint fl) { return ((fl & 1u) != 0u ? c * u_shade : c) / 255.0; }
`);

  const FULL_FS = `{{header}}
{{frame}}
{{noise}}
{{waterCommon}}
uniform sampler2D u_sea, u_flowX, u_flowY;
uniform float u_time, u_flow, u_shimmer, u_foamWidth, u_foamBreakup, u_lakeBand, u_seaBand, u_wave;
uniform bool u_dither;
uniform vec3 u_shallow, u_mid, u_deep, u_foam, u_dark;
out vec4 o;

// The band colour of a water pixel: depth plus moving noise, foam on the shore, dithered between bands.
vec3 waterColor(ivec2 p, uint kind) {
  float x = float(p.x), y = float(p.y);
  bool river = kind == 3u;
  float tx = river ? texelFetch(u_flowX, p, 0).r * u_flow : u_time * 0.6;
  float ty = river ? texelFetch(u_flowY, p, 0).r * u_flow : -u_time * 0.3;
  float d = texelFetch(u_dist, p, 0).r;
  if (u_shimmer > 0.0) d += (valueNoise(x / 4.0 - tx, y / 3.0 - ty, 77) - 0.5) * 2.0 * u_shimmer;
  if (d <= u_foamWidth && valueNoise(x / 3.0 - tx * 0.5, y / 3.0 + u_time * 0.5, 55) > u_foamBreakup) return u_foam;
  float t = d / (kind == 2u ? u_seaBand : u_lakeBand);
  float band = floor(t + 0.0001);
  if (u_dither && t - band > 0.75 && ((p.x + p.y) & 1) == 0) band += 1.0;
  return band < 0.5 ? u_shallow : band < 1.5 ? u_mid : u_deep;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  uint kind = texelFetch(u_water, p, 0).r;
  uint fl = texelFetch(u_flags, p, 0).r;
  vec3 c;
  if (kind != 0u) {
    c = (fl & 2u) != 0u ? u_dark : waterColor(p, kind);
  } else if ((fl & 4u) != 0u) {
    float d = texelFetch(u_sea, p, 0).r;
    if (d > u_wave) discard;
    c = d > u_wave - 1.2 ? u_foam : u_shallow;
  } else {
    discard;
  }
  o = vec4(shaded(c, fl), 1.0);
}`;

  // Lake glints: a dash of 1 or 3 pixels while sin(time) is high. Instance: x, y, phase, speed.
  const GLINT_VS = `{{header}}
{{frame}}
uniform float u_time;
in vec2 a_corner;
in vec4 a_i1;
void main() {
  float v = sin(u_time * 2.0 * a_i1.w + a_i1.z);
  if (v < 0.4) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float len = v > 0.75 ? 3.0 : 1.0;
  float x0 = a_i1.x - (len > 2.0 ? 1.0 : 0.0);
  gl_Position = pxToClip(vec2(x0 + a_corner.x * len, a_i1.y + a_corner.y));
}`;

  // River glints: one pixel of a short line across the river path, drifting downstream. Instance: path start in the
  // points texture, path length, start offset u0, side; then speed, phase, k (-1, 0 or 1: the pixel along the line).
  const RIVER_VS = `{{header}}
{{frame}}
uniform float u_time, u_flowSpeed;
uniform sampler2D u_points;
in vec2 a_corner;
in vec4 a_i1;
in vec4 a_i2;
vec4 point(int n) { return texelFetch(u_points, ivec2(n % ${POINTS_WIDTH}, n / ${POINTS_WIDTH}), 0); }
void main() {
  float v = sin(u_time * 1.5 * a_i2.x + a_i2.y);
  if (v < 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float len = a_i1.y;
  float u = mod(mod(a_i1.z + u_time * u_flowSpeed * 5.0 * a_i2.x, len) + len, len);
  int n = int(a_i1.x) + min(int(floor(u)), int(len) - 1);
  vec4 pt = point(n * 2);
  float hw = point(n * 2 + 1).x;
  float cx = pt.x - pt.w * a_i1.w * hw, cy = pt.y + pt.z * a_i1.w * hw;
  vec2 px = floor(vec2(cx + pt.z * a_i2.z, cy + pt.w * a_i2.z) + 0.5);
  gl_Position = pxToClip(px + a_corner);
}`;

  const GLINT_FS = `{{header}}
{{waterCommon}}
uniform vec3 u_glint;
uniform float u_minDist;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (texelFetch(u_water, p, 0).r == 0u || texelFetch(u_dist, p, 0).r < u_minDist) discard;
  o = vec4(shaded(u_glint, texelFetch(u_flags, p, 0).r), 1.0);
}`;

  let full = null, lake = null, river = null, glints = null, riverGlints = null, points = null, rows = null;

  // Flag layer: shadow, under a deck (dark strip), wash (land the waves reach), per map pixel.
  function flags(world) {
    const out = new Uint8Array(world.w * world.h);
    if (world.shadowMask) for (let i = 0; i < out.length; i++) if (world.shadowMask[i]) out[i] |= SHADOW;
    for (const i of world.underDeck) out[i] |= UNDER_DECK;
    for (const i of world.washIdx) out[i] |= WASH;
    return out;
  }

  // The path points as RGBA32F texels (x, y, tx, ty; then hw) and where each path starts.
  function pathPoints(world) {
    const starts = [], total = world.riverPaths.reduce((n, p) => n + p.pts.length, 0);
    const height = Math.max(1, Math.ceil(total * 2 / POINTS_WIDTH));
    const data = new Float32Array(POINTS_WIDTH * height * 4);
    let n = 0;
    for (const path of world.riverPaths) {
      starts.push(n);
      for (const p of path.pts) {
        data.set([p.x, p.y, p.tx, p.ty, p.hw, 0, 0, 0], n * 8);
        n++;
      }
    }
    return { data, height, starts };
  }

  // Instance floats for every river glint (three pixels each): path start, length, u0, side, speed, phase, k, 0.
  function riverInstances(world, starts) {
    const out = [];
    for (const g of world.riverGlints || []) {
      const path = world.riverPaths[g.path];
      if (!path || path.pts.length < 2) continue;
      for (let k = -1; k <= 1; k++) out.push(starts[g.path], path.pts.length, g.u0, g.side, g.speed, g.phase, k, 0);
    }
    return new Float32Array(out);
  }

  // Frees a vertex array made by GlShaders.instanced.
  function freeInstances(inst) {
    if (!inst) return;
    const gl = Gl.get();
    gl.deleteVertexArray(inst.vao);
    gl.deleteBuffer(inst.buffer);
  }

  // Instance buffer of the lake and sea glints (an empty one when the map has none).
  function uploadLake(world, gl) {
    const list = (world.glints || []).flatMap(g => [g.x, g.y, g.phase, g.speed]);
    glints = GlShaders.instanced(new Float32Array(list.length ? list : [0, 0, 0, 0]), [4], gl.STATIC_DRAW);
    if (!list.length) glints.count = 0;
  }

  // The river points texture and the river glint instances.
  function uploadRiver(world, gl) {
    const pp = pathPoints(world), inst = riverInstances(world, pp.starts);
    points = GlTex.make(POINTS_WIDTH, pp.height, 'RGBA32F', pp.data);
    riverGlints = GlShaders.instanced(inst.length ? inst : new Float32Array(8), [4, 4], gl.STATIC_DRAW);
    if (!inst.length) riverGlints.count = 0;
  }

  // The rows (top, bottom) that hold water or wash, so the full-frame pass skips the rest.
  function rowRange(world) {
    const { w, waterIdx, washIdx } = world;
    const lists = [waterIdx, washIdx].filter(a => a.length);
    if (!lists.length) return null;
    const first = lists.map(a => (a[0] / w) | 0), last = lists.map(a => (a[a.length - 1] / w) | 0);
    return { y0: Math.min(...first), y1: Math.max(...last) };
  }

  // Binds the water layers to units 0 to 5 (all fetched first: making a layer's texture binds it to the active unit).
  function bindLayers(c, program) {
    const gl = c.gl;
    const units = { u_water: 'water', u_flags: 'waterFlags', u_dist: 'waterDist', u_sea: 'seaDist', u_flowX: 'flowX', u_flowY: 'flowY' };
    const names = Object.keys(units), textures = names.map(name => c.texture(units[name]));
    names.forEach((name, k) => {
      c.bind(k, textures[k]);
      gl.uniform1i(program.loc(name), k);
    });
  }

  // The full-frame pass over the rows that have water.
  function drawFull(c) {
    const { gl, s, palette: pal } = c;
    if (!rows) return;
    const wave = s.waveReach > 0 ? (Math.sin(c.time * s.waveSpeed) * 0.5 + 0.5) * s.waveReach : -1;
    GlShaders.use(full, {
      ...c.common(), u_flow: c.time * s.flowSpeed * 2, u_shimmer: s.shimmer, u_foamWidth: s.foamWidth,
      u_foamBreakup: s.foamBreakup, u_lakeBand: s.bandWidth, u_seaBand: s.seaBandWidth, u_wave: wave, u_dither: !!s.dither,
      u_shallow: pal.shallow, u_mid: pal.mid, u_deep: pal.deep, u_foam: pal.foam, u_dark: Colors.darken(pal.deep, 0.75),
      u_shade: Ground.SHADE,
    });
    bindLayers(c, full);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, rows.y0, c.w, rows.y1 - rows.y0 + 1);
    GlShaders.drawFullscreen();
    gl.disable(gl.SCISSOR_TEST);
  }

  // Instanced glints (lake and sea dashes, then the river ones).
  function drawGlints(c) {
    const { gl, palette: pal } = c;
    const common = { ...c.common(), u_glint: pal.glint, u_minDist: 2, u_shade: Ground.SHADE };
    if (glints.count) {
      GlShaders.use(lake, common);
      bindLayers(c, lake);
      gl.bindVertexArray(glints.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, glints.count);
    }
    if (riverGlints.count) {
      GlShaders.use(river, { ...common, u_minDist: -1, u_flowSpeed: c.s.flowSpeed });
      bindLayers(c, river);
      c.bind(6, points);
      gl.uniform1i(river.loc('u_points'), 6);
      gl.bindVertexArray(riverGlints.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, riverGlints.count);
    }
  }

  return {
    flags,
    init() {
      GlShaders.quad();                          // before any instanced() call: it makes the shared quad on first use
      full = GlShaders.program('water.full', { fs: FULL_FS });
      lake = GlShaders.program('water.glint', { vs: GLINT_VS, fs: GLINT_FS });
      river = GlShaders.program('water.riverGlint', { vs: RIVER_VS, fs: GLINT_FS });
    },
    upload(c) {
      freeInstances(glints); freeInstances(riverGlints); GlTex.free(points);
      uploadLake(c.world, c.gl);
      uploadRiver(c.world, c.gl);
      rows = rowRange(c.world);
    },
    draw(c) {
      drawFull(c);
      drawGlints(c);
      c.gl.bindVertexArray(null);
    },
  };
})();

GlFrame.register({ stage: 'water', ...WaterPass });
