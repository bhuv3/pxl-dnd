// Stage 'tracks' (phase G4): Tracks.drawPrints and Tracks.drawRings on the GPU. The CPU sim keeps the prints and rings;
// every frame the pass takes them from Tracks.glState and draws single-pixel instances. A print is a dent (the pixel
// multiplied by a factor below 1) and a lit rim under it (multiplied by 1 + k * 0.35). A ring is the water pixels
// around its centre (Water.ripplePixels), each blended toward the foam colour.
const TrackPass = (() => {
  const VS = `{{header}}
{{frame}}
in vec2 a_corner;
in vec2 a_i1;
in vec4 a_i2;
flat out vec4 v_value;
uniform float u_rimRow;
void main() {
  v_value = a_i2;
  gl_Position = pxToClip(a_i1 + vec2(0.0, u_rimRow) + a_corner);
}`;
  const DENT_FS = `{{header}}
flat in vec4 v_value;
out vec4 o;
void main() { o = vec4(v_value.rgb, 1.0); }`;
  const RIM_FS = `{{header}}
flat in vec4 v_value;
out vec4 o;
void main() { o = vec4(vec3(v_value.a), 1.0); }`;
  const RING_FS = `{{header}}
uniform vec3 u_foam;
flat in vec4 v_value;
out vec4 o;
void main() { o = vec4(u_foam / 255.0, v_value.a); }`;

  let dent = null, rim = null, ring = null;
  let printBuf = null, ringBuf = null;

  // A growable instance buffer: { vao, buffer, capacity, count } of floats laid out as [2, 4] per instance.
  function makeBuffer(capacity) {
    const inst = GlShaders.instanced(new Float32Array(capacity * 6), [2, 4], Gl.get().DYNAMIC_DRAW);
    return { vao: inst.vao, buffer: inst.buffer, capacity, count: 0 };
  }

  // Frees a buffer made by makeBuffer.
  function freeBuffer(b) {
    if (!b) return;
    const gl = Gl.get();
    gl.deleteVertexArray(b.vao);
    gl.deleteBuffer(b.buffer);
  }

  // Puts this frame's instance floats into the buffer, growing it first when they don't fit.
  function fill(b, floats) {
    const gl = Gl.get(), n = floats.length / 6;
    if (n > b.capacity) {
      freeBuffer(b);
      Object.assign(b, makeBuffer(Math.max(n, b.capacity * 2)));
    }
    gl.bindVertexArray(b.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, floats);
    b.count = n;
  }

  // Instance floats of every print: x, y, dent factors (r, g, b), rim strength.
  function printFloats(prints) {
    const out = new Float32Array(prints.length * 6), tint = Tracks.SNOW_TINT;
    prints.forEach((p, n) => {
      const t = p.snow ? tint : [1, 1, 1];
      out.set([p.x, p.y, 1 - p.k * t[0], 1 - p.k * t[1], 1 - p.k * t[2], p.k * 0.35], n * 6);
    });
    return out;
  }

  // Instance floats of every ring pixel (water only): x, y, 0, 0, 0, blend strength.
  function ringFloats(world, rings) {
    const out = [];
    for (const r of rings) {
      for (const i of Water.ripplePixels(world, r.x, r.y, r.r)) out.push(i % world.w, (i / world.w) | 0, 0, 0, 0, r.alpha);
    }
    return new Float32Array(out);
  }

  // Draws a buffer with the given program and blending, the rim one row down.
  function drawBuffer(c, program, b, row) {
    const gl = c.gl;
    if (!b.count) return;
    GlShaders.use(program, { ...c.common(), u_rimRow: row, u_foam: c.palette.foam });
    gl.bindVertexArray(b.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.count);
  }

  return {
    init() {
      GlShaders.quad();                          // before any instanced() call: it makes the shared quad on first use
      dent = GlShaders.program('tracks.dent', { vs: VS, fs: DENT_FS });
      rim = GlShaders.program('tracks.rim', { vs: VS, fs: RIM_FS });
      ring = GlShaders.program('tracks.ring', { vs: VS, fs: RING_FS });
      freeBuffer(printBuf); freeBuffer(ringBuf);
      printBuf = makeBuffer(64);
      ringBuf = makeBuffer(256);
    },
    draw(c) {
      const gl = c.gl, state = Tracks.glState(c.time);
      if (!state.prints.length && !state.rings.length) return;
      fill(printBuf, printFloats(state.prints));
      fill(ringBuf, ringFloats(c.world, state.rings));
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
      drawBuffer(c, dent, printBuf, 0);
      gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE, gl.ZERO, gl.ONE);
      drawBuffer(c, rim, printBuf, 1);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      drawBuffer(c, ring, ringBuf, 0);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
  };
})();

GlFrame.register({ stage: 'tracks', ...TrackPass });
