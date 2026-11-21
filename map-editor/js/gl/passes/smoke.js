// Stage 'smoke': puffs rising from campfires, braziers and chimneys, blended over the picture like Fire.draw. Each puff
// is up to four single pixels. The maths runs in the vertex shader from the puff's age; JS keeps only what a float32
// would lose (the key's phase and offset, the time within one puff life).
//
// This file also adds the 'points' chunk the life and weather passes share: a vertex shader writes one blended pixel
// with putPixel, and the fragment shader (pointsFrag) passes its colour and alpha on.
GlChunks.add('points', `
in vec2 a_corner;
out vec4 v_col;
void dropPixel() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); v_col = vec4(0.0); }
// Blends colour rgb (0-255) over map pixel p with alpha a; nothing happens outside the map or at alpha 0.
void putPixel(ivec2 p, vec3 rgb, float a) {
  if (a <= 0.0 || p.x < 0 || p.y < 0 || p.x >= int(u_size.x) || p.y >= int(u_size.y)) { dropPixel(); return; }
  gl_Position = pxToClip(vec2(p) + a_corner);
  v_col = vec4(rgb / 255.0, a);
}
`);
GlChunks.add('pointsFrag', `
in vec4 v_col;
out vec4 o;
void main() { o = v_col; }
`);

// Blends alpha-weighted pixels over the picture: colour * alpha + picture * (1 - alpha), picture alpha kept.
GlFrame.register({
  stage: 'smoke',
  PUFFS: 6,                       // mirrors Fire: puffs per source, seconds a puff lives, pixels it rises
  LIFE: 3.2,
  RISE: 14,
  STRENGTH: { campfire: 0.7, brazier: 0.45 },   // mirrors Fire.KINDS[kind].smoke (the other kinds make none)
  CHIMNEY: 0.85,

  init() {
    const { LIFE, RISE } = this;
    this.program = GlShaders.program('smoke', {
      vs: `{{header}}
{{frame}}
{{round}}
{{points}}
in vec4 a_i1;                     // x, y, phase (key + puff, mod 2 pi), strength
in vec2 a_i2;                     // the puff's offset in its life, which of its pixels (0 middle, 1 left, 2 right, 3 above)
uniform float u_t;                // time mod the puff life
uniform float u_wind;
uniform vec3 u_col;
void main() {
  float age = mod(u_t + a_i2.x, ${LIFE.toFixed(1)}) / ${LIFE.toFixed(1)};
  float x = a_i1.x + age * age * 6.0 * u_wind + sin(age * 7.0 + a_i1.z) * 0.8;
  float y = a_i1.y - 1.0 - age * ${RISE.toFixed(1)};
  float a = (1.0 - age * age) * a_i1.w;
  ivec2 p = ivec2(roundJs(x), roundJs(y));
  int slot = int(a_i2.y);
  if (slot > 0) {
    if (age <= 0.2) { dropPixel(); return; }
    a *= 0.6;
    p += slot == 1 ? ivec2(-1, 0) : slot == 2 ? ivec2(1, 0) : ivec2(0, -1);
  }
  putPixel(p, u_col, a);
}`,
      fs: `{{header}}
{{pointsFrag}}`,
    });
  },

  // Every smoking source (fires first, then chimneys) as one row per puff pixel; lifted ones are drawn higher.
  upload(c) {
    const gl = c.gl, world = c.world, rows = [];
    (world.fires || []).forEach(f => { if (this.STRENGTH[f.kind]) this.addSource(rows, f, this.STRENGTH[f.kind]); });
    (world.chimneys || []).forEach(f => this.addSource(rows, f, this.CHIMNEY));
    if (this.inst) { gl.deleteVertexArray(this.inst.vao); gl.deleteBuffer(this.inst.buffer); this.inst = null; }
    this.count = rows.length / 6;
    if (this.count) this.inst = GlShaders.instanced(new Float32Array(rows), [4, 2], gl.STATIC_DRAW);
  },

  // Adds the 6 puffs x 4 pixels of one source: its position (lifted), phase, strength, and offset in the puff life.
  addSource(rows, f, strength) {
    const TAU = Math.PI * 2, y = f.y - (f.lift || 0);
    for (let j = 0; j < this.PUFFS; j++) {
      const off = (((j * this.LIFE / this.PUFFS + f.key * 0.01) % this.LIFE) + this.LIFE) % this.LIFE;
      const phase = (((f.key + j) % TAU) + TAU) % TAU;
      for (let slot = 0; slot < 4; slot++) rows.push(f.x, y, phase, strength, off, slot);
    }
  },

  draw(c) {
    const s = c.s, gl = c.gl;
    if (!s.smoke || !c.world.fires || !this.count) return;
    const wind = s.wind ? 0.4 + s.windStrength : 0.3;
    GlShaders.use(this.program, { u_size: [c.w, c.h], u_t: c.time % this.LIFE, u_wind: wind, u_col: c.palette.smoke });
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.bindVertexArray(this.inst.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.disable(gl.BLEND);
  },
});
