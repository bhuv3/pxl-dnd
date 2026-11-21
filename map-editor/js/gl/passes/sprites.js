// Stage 'things': Details.draw (lily pads and stones, rugs, then every tuft, flower, reed and object back to front with
// wind sway) and Animals.draw, as instanced quads (see atlas.js for the sprites, the stream and the shaders).
//  - Draw 1: every thing in the CPU's draw order, one instance per sprite layer, painted over the picture without blending.
//  - Flags: tufts and flowers vanish where a footprint flattened them (Tracks.isTrodden), a door shows its open or its closed
//    sprite (Doors.isOpen). The CPU checks these each frame and writes them into a small texture the vertex shader reads.
//  - Draw 2 (when there are animals): for each animal, back to front, its shadow (or a duck's ripple), its sprite, and then
//    the things standing in front of it drawn again (a copy of their instances), exactly as Animals.draw does. This one is
//    blended: a shadow is 25% black over the picture, a ripple blends the foam colour.
// This pass draws flat maps (applies). Raised maps are drawn by the height pass (passes/height.js), which calls GlSprites:
//   GlSprites.drawFlat(c)                   the flat things (lily pads, stones, rugs) onto the picture, no lift
//   GlSprites.drawRaised(c, { depth })      the standing things and the animals, each lifted by Height.liftAt of its base and
//                                           hidden where the R16UI depth texture holds a row >= its base row + 2; things and
//                                           animals interleave by base row as Height.compose's drawUpTo does
// (c is the pass context). Both set up their own state, so they work without this pass ever being run.
const GlSprites = (() => {
  const VERTEX = `{{header}}
{{frame}}
{{things}}
in vec2 a_corner;
in vec4 a_i1;
in vec4 a_i2;
in vec4 a_i3;
in vec4 a_i4;
flat out vec4 v_1;
flat out vec4 v_2;
flat out vec4 v_3;
flat out vec4 v_4;
void main() {
  if (thingHidden(a_i1.w)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 lo, hi;
  float sway, dy;
  thingBox(a_i1, a_i2, a_i3, a_i4, lo, hi, sway, dy);
  vec2 origin = vec2(a_i1.x, a_i1.y + dy - a_i4.x);
  v_1 = vec4(origin, a_i1.z, sway);
  v_2 = a_i2;
  v_3 = a_i3;
  v_4 = a_i4;
  gl_Position = pxToClip(origin + lo + a_corner * (hi - lo));
}`;

  const FRAGMENT = `{{header}}
{{things}}
flat in vec4 v_1;
flat in vec4 v_2;
flat in vec4 v_3;
flat in vec4 v_4;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (u_depthTest != 0 && int(texelFetch(u_depth, p, 0).r) >= int(v_4.y + 0.5) + 2) discard;
  vec4 col;
  if (!thingPixel(p, v_1, v_2, v_3, v_4.x, col)) discard;
  o = col;
}`;

  const F = GlAtlas.FLOATS, STRIDE = GlAtlas.FLOATS * 4, LAYOUT = [4, 4, 4, 4];
  let program = null, base = null, dynamic = null, flagTex = null, dummyDepth = null, stream = null, flags = null, nonFlatY = null;
  let uploaded = -1, dyn = new Float32Array(F * 256), dynCount = 0, things = null;

  // Starts (or restarts after the GL state was dropped) and uploads once per rebuild.
  function ensure(c) {
    const p = GlShaders.program('things', { vs: VERTEX, fs: FRAGMENT });
    if (p !== program) { program = p; start(); uploaded = -1; }
    if (uploaded !== GpuWorld.revision()) { upload(c); uploaded = GpuWorld.revision(); }
  }

  // Forgets the old GL objects (a new context state).
  function start() {
    GlAtlas.reset();
    base = dynamic = flagTex = null;
    GlTex.free(dummyDepth);
    dummyDepth = GlTex.make(1, 1, 'R16UI', new Uint16Array(1));
  }

  // A vertex array over instance data (the old one is freed).
  function makeVao(old, data) {
    const gl = Gl.get();
    if (old) { gl.deleteVertexArray(old.vao); gl.deleteBuffer(old.buffer); }
    return GlShaders.instanced(data.length ? data : new Float32Array(F), LAYOUT, gl.STATIC_DRAW);
  }

  // Bakes the sprites, lists every thing as instances, and sets up the flags.
  function upload(c) {
    GlAtlas.build(c.world);
    stream = GlAtlas.stream(c.world);
    base = makeVao(base, stream.data);
    const f = stream.flags;
    flags = { x: f.x, y: f.y, door: f.door, value: new Uint8Array(Math.max(1, Math.ceil(f.x.length / GlAtlas.FLAG_WIDTH)) * GlAtlas.FLAG_WIDTH).fill(255) };
    GlTex.free(flagTex);
    flagTex = GlAtlas.flagTexture(flags.value);
    const list = c.world.things;
    nonFlatY = Float32Array.from(stream.nonFlat, i => list[i].y);
  }

  // Works out each flag (trodden tuft, open door) and uploads the texture when one changed.
  function updateFlags() {
    let changed = false;
    for (let k = 0; k < flags.x.length; k++) {
      const v = flags.door[k] ? (Doors.isOpen(flags.door[k]) ? 1 : 0) : (Tracks.isTrodden(flags.x[k], flags.y[k]) ? 1 : 0);
      if (v !== flags.value[k]) { flags.value[k] = v; changed = true; }
    }
    if (changed) GlTex.update(flagTex, flags.value);
  }

  // Binds the atlas, row table, flags and layers, and sets the uniforms. depth: the R16UI depth texture (raised maps) or null.
  function bindInputs(c, depth) {
    c.bindTarget();
    c.gl.disable(c.gl.BLEND);
    const shadow = c.texture('thingShadow'), water = c.texture('water');     // made first: making a texture binds it on the active unit
    GlTex.bind(0, GlAtlas.texture());
    GlTex.bind(1, GlAtlas.rowTexture());
    GlTex.bind(2, flagTex);
    GlTex.bind(3, shadow);
    GlTex.bind(4, water);
    GlTex.bind(5, depth || dummyDepth);
    GlShaders.use(program, {
      u_size: [c.w, c.h], u_atlas: ['i', 0], u_rows: ['i', 1], u_flags: ['i', 2], u_shadow: ['i', 3], u_water: ['i', 4],
      u_depth: ['i', 5], u_depthTest: ['i', depth ? 1 : 0], ...GlAtlas.uniforms(c.s, c.palette, c.time),
    });
  }

  // Draws instances [from, to) of the base stream (the attribute pointers start at the first one).
  function drawRange(gl, from, to) {
    if (to <= from) return;
    gl.bindVertexArray(base.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, base.buffer);
    LAYOUT.forEach((n, k) => gl.vertexAttribPointer(k + 1, n, gl.FLOAT, false, STRIDE, k * 16 + from * STRIDE));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, to - from);
  }

  // Makes room for n more floats in the per-frame list.
  function reserve(n) {
    if (dynCount * F + n <= dyn.length) return;
    const bigger = new Float32Array(Math.max(dyn.length * 2, dynCount * F + n));
    bigger.set(dyn.subarray(0, dynCount * F));
    dyn = bigger;
  }

  // Appends one instance to the per-frame list.
  function pushInstance(kind, x, y, b, cc, lift, row) {
    reserve(F);
    dyn.set([x, y, kind, 0, b[0], b[1], b[2], b[3], cc[0], cc[1], cc[2], cc[3], lift, row, 0, 0], dynCount * F);
    dynCount++;
  }

  // Appends copies of the base instances of the things standing in front of an animal (Animals.draw's redraw).
  function pushRedraws(a) {
    const ys = nonFlatY;
    let lo = 0, hi = ys.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ys[mid] <= a.y) lo = mid + 1; else hi = mid; }
    for (let k = lo; k < ys.length && ys[k] <= a.y + 200; k++) {         // the tallest thing is under 200 pixels
      const i = stream.nonFlat[k], t = things[i];
      if (!Animals.covers(t, a)) continue;
      const first = stream.first[i], n = stream.n[i];
      reserve(n * F);
      dyn.set(stream.data.subarray(first * F, (first + n) * F), dynCount * F);
      dynCount += n;
    }
  }

  // One animal: a soft shadow (a ripple for a swimming duck) and its sprite, drawn lift pixels up.
  function pushAnimal(c, a, lift) {
    const ax = Math.floor(a.x), ay = Math.floor(a.y), K = GlAtlas.KIND;
    const { layer, half } = GlAtlas.animal(a.type, Animals.frameOf(a));
    if (Animals.isAquatic(a.type)) {
      if (a.target && Math.floor(c.time * 2 + a.id) % 3 === 0) {
        for (const [x, y] of GlAtlas.rippleCells(c.world, ax, ay + 1 - lift, 3)) pushInstance(K.PLAIN, x, y, [...c.palette.foam, 0.35], [0, 0, 0, 0], 0, ay);
      }
    } else if (half > 1) pushInstance(K.SHADOW, ax - half + 1, ay + 1, [0, 0, 2 * half - 1, 0], [0, 0, 0, 0], lift, ay);
    const flip = a.dir < 0, ox = flip ? 1 - layer.ox - layer.aw : layer.ox;
    pushInstance(flip ? K.FLIP : K.SPRITE, ax, ay, [layer.ax, layer.ay, layer.aw, layer.ah], [ox, layer.oy, -1, 0], lift, ay);
  }

  // Draws the per-frame list (blended: shadows and ripples are partly transparent).
  function drawDynamic(gl) {
    if (!dynCount) return;
    if (!dynamic) dynamic = GlShaders.instanced(new Float32Array(F), LAYOUT, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(dynamic.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamic.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, dyn.subarray(0, dynCount * F), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dynCount);
    gl.disable(gl.BLEND);
    dynCount = 0;
  }

  // Updates what changes every frame: the flags and the windmills' sails.
  function prepare(c) {
    updateFlags();
    GlAtlas.updateSails(c.s, c.time);
  }

  // Flat maps: everything in the base stream, then each animal with the things in front of it (a second draw).
  function drawAll(c) {
    const gl = c.gl;
    ensure(c);
    prepare(c);
    bindInputs(c, null);
    drawRange(gl, 0, stream.count);
    const animals = Animals.list();
    if (!animals.length) return;
    things = c.world.things;
    animals.sort((p, q) => p.y - q.y);
    dynCount = 0;
    for (const a of animals) { pushAnimal(c, a, 0); pushRedraws(a); }
    drawDynamic(gl);
  }

  // Raised maps, before the projection: the flat things, drawn without lift.
  function drawFlat(c) {
    ensure(c);
    bindInputs(c, null);
    drawRange(c.gl, 0, stream.flatEnd);
  }

  // Raised maps, after the projection: standing things and animals at their lift, interleaved by base row.
  function drawRaised(c, { depth }) {
    const gl = c.gl;
    ensure(c);
    prepare(c);
    bindInputs(c, depth);
    const animals = c.world.preview ? [] : Animals.list().sort((p, q) => p.y - q.y);
    let cursor = stream.flatEnd, k = 0;
    for (const a of animals) {
      const row = Math.floor(a.y);
      while (k < nonFlatY.length && nonFlatY[k] <= row) k++;
      const end = k < nonFlatY.length ? stream.first[stream.nonFlat[k]] : stream.count;
      drawRange(gl, cursor, end);
      cursor = Math.max(cursor, end);
      pushAnimal(c, a, Height.liftAt(c.world, a.x, a.y));
      drawDynamic(gl);
    }
    drawRange(gl, cursor, stream.count);
  }

  return { drawFlat, drawRaised, drawAll };
})();

GlFrame.register({
  stage: 'things',
  applies: ctx => !ctx.world.raised,
  draw: c => GlSprites.drawAll(c),
});

// The shadow mask of the ground (where trees shade the grass), or an empty one when shadows are off.
GpuWorld.define('thingShadow', { format: 'R8UI', from: w => w.shadowMask || new Uint8Array(w.w * w.h) });
