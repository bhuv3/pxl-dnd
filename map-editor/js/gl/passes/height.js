// Stage 'things' on raised maps (phase G5): Height.compose on the GPU.
//
// The CPU draws row by row from the top of the map; a pixel of row y goes to row y - lift, and below it a front face fills
// the (lift - lift of the row below) rows down to where the next row's pixel starts; later rows cover earlier ones. So the
// colour at an output pixel (x, d) comes from the LARGEST source row y whose span [y - L(y), y - L(y+1)] holds d (and that
// really writes there: a bridge gap's deeper face rows write nothing). One fragment shader finds that row by searching up
// the column, then works out the colour exactly as Height.drawRow does (the pixel itself with waterfall foam, a stretched
// copy of it, a hillside ledge, or a cliff / stair / waterfall / chasm face), and also writes the winning row to a depth
// texture. Things and animals are drawn afterwards at their own lift, and a thing whose base row is b is hidden wherever
// that depth is b + 2 or more: a nearer cliff covers it, as on the CPU.
//
// The flat picture (ground, water, bridges, flat things) is what the earlier stages left in the frame. The CPU's world.depth
// and world.srcY (what a click maps to, what hides a walking character) are still filled by one CPU compose at each rebuild.
const GlHeight = (() => {
  const PAL = ['foam', 'glint', 'shallow', 'mid', 'woodDark', 'trunkDark', 'stoneMortar', 'stoneDark', 'dirtShadow', 'pathEdge',
    'rockOutline', 'rockLight', 'rockDark', 'rockMid', 'mudDark', 'grassLip', 'dirtLight', 'dirtDark', 'dirt', 'woodLight',
    'trunkMid', 'chasm'];
  let program = null, target = null, minL = 0, maxUp = 0, palette = null;

  GpuWorld.define('hLift',    { format: 'R16I', from: w => w.lift });
  GpuWorld.define('hRamp',    { format: 'R8UI', from: w => w.ramp });
  GpuWorld.define('hSoft',    { format: 'R8UI', from: w => w.soft });
  GpuWorld.define('hFall',    { format: 'R8UI', from: w => w.fall });
  GpuWorld.define('hChasm',   { format: 'R8UI', from: w => w.chasm });
  // 1 where a bridge deck or rail hangs over water or a chasm (its face shows what is under it, not earth).
  GpuWorld.define('hGapSpan', { format: 'R8UI', from: w => {
    const out = new Uint8Array(w.w * w.h);
    for (let i = 0; i < out.length; i++) out[i] = w.span[i] && Bridges.gap(w, i) ? 1 : 0;
    return out;
  } });

  const FS = `{{header}}
{{noise}}
{{round}}
uniform sampler2D u_flat;
uniform isampler2D u_lift;
uniform usampler2D u_ramp, u_soft, u_fall, u_gapSpan, u_chasm, u_water, u_ground;
uniform vec3 u_pal[22];
uniform vec2 u_size;
uniform float u_time;
uniform int u_step, u_maxUp, u_minL;
layout(location = 0) out vec4 o;
layout(location = 1) out uint oDepth;

const int P_FOAM = 0, P_GLINT = 1, P_SHALLOW = 2, P_MID = 3, P_WOODDARK = 4, P_TRUNKDARK = 5, P_STONEMORTAR = 6, P_STONEDARK = 7,
  P_DIRTSHADOW = 8, P_PATHEDGE = 9, P_ROCKOUTLINE = 10, P_ROCKLIGHT = 11, P_ROCKDARK = 12, P_ROCKMID = 13, P_MUDDARK = 14,
  P_GRASSLIP = 15, P_DIRTLIGHT = 16, P_DIRTDARK = 17, P_DIRT = 18, P_WOODLIGHT = 19, P_TRUNKMID = 20, P_CHASM = 21;

int liftAt(int x, int y) { return texelFetch(u_lift, ivec2(x, y), 0).r; }
uint at8(usampler2D t, int x, int y) { return texelFetch(t, ivec2(x, y), 0).r; }
vec3 flatRgb(int x, int y) { return floor(texelFetch(u_flat, ivec2(x, y), 0).rgb * 255.0 + 0.5); }

// Height.copyPixel: a ground pixel moved to its lifted spot; water under a waterfall churns with foam.
vec3 pixelColour(int x, int y) {
  vec3 c = flatRgb(x, y);
  int f = int(at8(u_fall, x, y));
  if (f != 0 && hash(x + int(floor(u_time * 8.0)) * 13, y * int(u_size.x) + x) < (f == 2 ? 0.8 : 0.4)) c = u_pal[P_FOAM];
  return c;
}

// Height.ledgeColor: the face of a hillside ledge, its own ground shaded.
vec3 ledgeColour(int x, int y, int k, int n) {
  float f = k == n ? 0.42 : (k == 1 ? 0.72 : 0.62) * (hash(x, 91) < 0.25 ? 0.9 : 1.0);
  return flatRgb(x, y) * f;
}

// Height.chasmWall: lit rock at the lip, streaked rock below, fading into the dark with depth.
vec3 chasmWall(int x, int k, int n) {
  bool streak = hash(x + 31, 404) < 0.3;
  vec3 c = k == 1 ? u_pal[P_ROCKLIGHT] : streak ? u_pal[P_ROCKDARK]
    : ((int(floor((float(k) + hash(x, 405) * 3.0) / 3.0)) & 1) == 1 ? u_pal[P_ROCKMID] : u_pal[P_ROCKDARK]);
  float t = clamp(float(k - 2) / float(max(1, n - 3)), 0.0, 1.0);
  float f = t * t * (3.0 - 2.0 * t) + (((x + k) & 1) == 1 ? 0.06 : -0.06) * ((t > 0.1 && t < 0.9) ? 1.0 : 0.0);
  float a = clamp(f, 0.0, 1.0);
  return c + (u_pal[P_CHASM] - c) * a;
}

// Height.logPiles: under a raised wooden deck, a beam, then a row of round log ends.
vec3 logPiles(int x, int k, int n) {
  if (k == 1) return u_pal[P_WOODDARK];
  if (k == n) return u_pal[P_TRUNKDARK];
  float rows = float(max(1, n - 2)), u = float(x & 3), v = float(k - 2);
  float d = length(vec2((u - 1.5) / 2.0, (v - (rows - 1.0) / 2.0) / (rows / 2.0)));
  if (d > 0.95) return u_pal[P_TRUNKDARK];
  if (d > 0.62) return u_pal[P_TRUNKMID];
  return d < 0.25 ? u_pal[P_WOODDARK] : u_pal[P_WOODLIGHT];
}

bool rocky(uint g) { return g == 8u || g == 10u || g == 11u || g == 5u || g == 6u || g == 7u || g == 13u || g == 16u; }
bool stoneSteps(uint g) { return g == 5u || g == 6u || g == 7u || g == 13u || g == 16u; }

// Height.faceColor: false when the face row draws nothing (a bridge's deeper rows: what is under it shows through).
bool faceColour(int x, int y, int k, int n, out vec3 col) {
  int H = int(u_size.y), yj = y + 1 < H ? y + 1 : y;
  uint g = at8(u_ground, x, y);
  if (at8(u_gapSpan, x, y) != 0u) {
    if (k == 1) { col = u_pal[P_WOODDARK]; return true; }
    if (k == 2) { col = u_pal[P_TRUNKDARK]; return true; }
    return false;
  }
  if (at8(u_chasm, x, yj) != 0u && at8(u_chasm, x, y) == 0u) { col = chasmWall(x, k, n); return true; }
  if (at8(u_water, x, y) != 0u && at8(u_water, x, yj) != 0u) {
    float t = float(k) - u_time * 18.0 + hash(x, 71) * 9.0;
    if (k == n) { col = u_pal[P_FOAM]; return true; }
    float r = hash(x, int(floor(t / 3.0)));
    int a = x + int(floor(t / 4.0)), m = a - 3 * (a / 3);
    col = r < 0.15 ? u_pal[P_FOAM] : r < 0.4 ? u_pal[P_GLINT] : (m != 0 ? u_pal[P_SHALLOW] : u_pal[P_MID]);
    return true;
  }
  bool rampI = at8(u_ramp, x, y) != 0u, rampJ = at8(u_ramp, x, yj) != 0u;
  if (rampI || rampJ) {
    uint kind = rampI ? g : at8(u_ground, x, yj);
    if (stoneSteps(kind)) col = k == n ? u_pal[P_STONEMORTAR] : u_pal[P_STONEDARK];
    else if (kind == 12u) col = k == n ? u_pal[P_TRUNKDARK] : u_pal[P_WOODDARK];
    else col = k == n ? u_pal[P_DIRTSHADOW] : u_pal[P_PATHEDGE];
    return true;
  }
  if (g == 12u) { col = logPiles(x, k, n); return true; }
  int fromBottom = n - k + 1;
  bool streak = hash(x + 31, 404) < 0.3;
  if (rocky(g)) {
    if (fromBottom == 1) col = u_pal[P_ROCKOUTLINE];
    else if (k == 1) col = u_pal[P_ROCKLIGHT];
    else col = streak ? u_pal[P_ROCKDARK] : ((int(floor((float(k) + hash(x, 405) * 3.0) / 3.0)) & 1) == 1 ? u_pal[P_ROCKMID] : u_pal[P_ROCKDARK]);
    return true;
  }
  if (fromBottom == 1) col = u_pal[P_MUDDARK];
  else if (k == 1) col = g == 1u ? u_pal[P_GRASSLIP] : u_pal[P_DIRTLIGHT];
  else if (streak) col = u_pal[P_DIRTSHADOW];
  else col = ((k + int(floor(hash(x, 406) * 2.0))) & 3) == 0 ? u_pal[P_DIRTDARK] : u_pal[P_DIRT];
  return true;
}

void main() {
  int x = int(gl_FragCoord.x), d = int(gl_FragCoord.y), H = int(u_size.y);
  vec3 col = flatRgb(x, d);
  uint depth = uint(d);
  int ymax = min(H - 1, d + u_maxUp), ymin = max(0, d + u_minL);
  for (int s = 0; s < 400; s++) {
    int y = ymax - s;
    if (y < ymin) break;
    int L = liftAt(x, y), n = L - (y + 1 < H ? liftAt(x, y + 1) : 0), top = y - L;
    if (d == top) { col = pixelColour(x, y); depth = uint(y); break; }
    if (n > 0 && d > top && d <= top + n && d >= 1) {
      int k = d - top;
      bool below = y + 1 < H;
      bool rampI = at8(u_ramp, x, y) != 0u, rampB = below && at8(u_ramp, x, y + 1) != 0u;
      bool ledge = below && !rampI && !rampB && n <= u_step && at8(u_soft, x, y) != 0u && at8(u_soft, x, y + 1) != 0u;
      bool stretch = !ledge && n <= 2 && !rampI && !rampB;
      vec3 c;
      bool write = true;
      if (stretch) c = pixelColour(x, y);
      else if (ledge) c = ledgeColour(x, y, k, n);
      else write = faceColour(x, y, k, n, c);
      if (write) { col = c; depth = uint(y); break; }
    }
  }
  o = vec4(floor(col + 0.5) / 255.0, 1.0);
  oDepth = depth;
}`;

  // The two-attachment target: the composed picture and, per pixel, the map row that drew it.
  function ensureTarget(c) {
    const gl = c.gl;
    if (target && target.w === c.w && target.h === c.h) return;
    freeTarget();
    const color = GlTex.make(c.w, c.h, 'RGBA8', null), depth = GlTex.make(c.w, c.h, 'R16UI', null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, depth, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('The height target is not supported');
    target = { w: c.w, h: c.h, color, depth, fbo };
  }

  function freeTarget() {
    if (!target) return;
    const gl = Gl.get();
    gl.deleteFramebuffer(target.fbo); GlTex.free(target.color); GlTex.free(target.depth);
    target = null;
  }

  // Projects the flat picture in the frame: ground rows lifted, faces filled; the picture becomes the result.
  function compose(c) {
    const gl = c.gl, world = c.world;
    ensureTarget(c);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, c.w, c.h);
    gl.disable(gl.BLEND);
    GlShaders.use(program, { ...c.common(), u_pal: ['v3', palette], u_step: ['i', world.step], u_maxUp: ['i', maxUp], u_minL: ['i', minL] });
    const inputs = [['u_flat', c.frameTexture()], ['u_lift', c.texture('hLift')], ['u_ramp', c.texture('hRamp')], ['u_soft', c.texture('hSoft')],
      ['u_fall', c.texture('hFall')], ['u_gapSpan', c.texture('hGapSpan')], ['u_chasm', c.texture('hChasm')], ['u_water', c.texture('water')],
      ['u_ground', c.texture('ground')]];
    inputs.forEach(([name, tex], unit) => { c.bind(unit, tex); gl.uniform1i(program.loc(name), unit); });
    GlShaders.drawFullscreen();
    GlFrame.copyInto(target.color);
  }

  // What the sprites pass offers for raised maps (see atlas.js): flat things first, things and animals after the projection.
  const sprites = () => (typeof GlSprites !== 'undefined' ? GlSprites : null);

  GlFrame.register({
    stage: 'things',
    // Only once the sprites pass can draw things at their lift; until then raised maps keep the CPU path.
    applies: ctx => !!ctx.world.raised && !!sprites() && !!sprites().drawRaised,
    init(c) { program = GlShaders.program('height.compose', { fs: FS }); },
    upload(c) {
      const lift = c.world.lift;
      minL = 0; maxUp = 0;
      for (let i = 0; i < lift.length; i++) { if (lift[i] > maxUp) maxUp = lift[i]; if (lift[i] < minL) minL = lift[i]; }
      palette = new Float32Array(PAL.length * 3);
      PAL.forEach((k, n) => { const col = c.palette[k] || [255, 0, 255]; palette.set([col[0], col[1], col[2]], n * 3); });
      // World.depth and world.srcY (clicks, characters hidden behind things) come from one CPU compose per rebuild.
      Height.compose(new Uint8ClampedArray(c.w * c.h * 4), c.world, c.s, c.palette, 0);
    },
    draw(c) {
      const sp = sprites();
      if (sp && sp.drawFlat) sp.drawFlat(c);
      compose(c);
      if (sp && sp.drawRaised) sp.drawRaised(c, { depth: target.depth });
    },
  });

  // The ground projection alone against Height.compose with no things or animals (for testing before the sprites exist):
  // a parity row. built: GlParity.build(...) of a raised map.
  function groundParity(built, time) {
    const world = built.world, realList = Animals.list, saved = [world.things, world.standing, world.flat];
    world.things = []; world.standing = []; world.flat = []; Animals.list = () => [];
    try {
      const ctx = GlParity.context(built, time);
      ctx.frame.set(built.staticLayer);
      const before = ctx.frame.slice();
      Height.compose(ctx.frame, world, ctx.s, ctx.palette, time);
      GlFrame.uploadFrame(before);
      const c = GlFrame.context(ctx);
      const entry = GlFrame.pass('things', ctx);
      if (!entry.started) { entry.init(c); entry.started = true; }
      entry.upload(c);
      GlFrame.bindTarget();
      compose(c);
      return { map: built.name, size: `${built.w}x${built.h}`, time, stage: 'things (ground only)', ...GlParity.diff(GlFrame.readFrame(), ctx.frame, built.w, built.h) };
    } finally { world.things = saved[0]; world.standing = saved[1]; world.flat = saved[2]; Animals.list = realList; }
  }

  return { groundParity, depthTexture: () => target && target.depth };
})();
