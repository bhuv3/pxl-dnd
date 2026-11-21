// Stage 'life': fish, butterflies, birds and gulls (Life.draw). There are only a few dozen creatures, so the CPU
// works out where each one is this frame (Life.drawWith, the same code the canvas backend runs) and records its
// pixels as a list of blended points, in the order the CPU draws them; one instanced draw puts them over the picture.
// A pixel is a blend toward a colour with an alpha: put is alpha 1, shade (multiply by f) is black at alpha 1 - f.
GlFrame.register({
  stage: 'life',
  FLOATS: 6,                      // per point: x, y, r, g, b, alpha

  init() {
    this.program = GlShaders.program('life', {
      vs: `{{header}}
{{frame}}
{{points}}
in vec2 a_i1;                     // the map pixel
in vec4 a_i2;                     // colour 0-255 and alpha
void main() { putPixel(ivec2(a_i1), a_i2.rgb, a_i2.a); }`,
      fs: `{{header}}
{{pointsFrag}}`,
    });
    this.data = new Float32Array(this.FLOATS * 512);
    this.n = 0;
    this.inst = GlShaders.instanced(this.data, [2, 4]);
    this.bytes = new Uint8ClampedArray(1);
  },

  // The writers Life.drawWith draws through: each call appends points for the world in c.
  writers(world) {
    const w = world.w, h = world.h, water = world.water, self = this, add = (x, y, r, g, b, a) => self.add(w, h, x, y, r, g, b, a);
    return {
      put: (x, y, col) => add(x, y, self.byte(col[0]), self.byte(col[1]), self.byte(col[2]), 1),
      shade: (x, y, f) => add(x, y, 0, 0, 0, 1 - f),
      blend: (x, y, col, a) => add(x, y, col[0], col[1], col[2], a),
      // mirrors Water.ripple: a ring (ry = 0.6 r) of points, water pixels only, never the same pixel twice in a row
      ripple(x, y, r, alpha, col) {
        const steps = Math.max(8, Math.round(r * 7));
        let last = -1;
        for (let k = 0; k < steps; k++) {
          const a = k / steps * Math.PI * 2;
          const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r * 0.6);
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const i = py * w + px;
          if (i === last || !water[i]) continue;
          last = i;
          add(px, py, col[0], col[1], col[2], alpha);
        }
      },
    };
  },

  // A colour channel the way storing it in the CPU frame (a Uint8ClampedArray) rounds it.
  byte(v) { this.bytes[0] = v; return this.bytes[0]; },

  // Appends one point (dropping it outside the map), growing the list when it is full.
  add(w, h, x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if ((this.n + 1) * this.FLOATS > this.data.length) { const bigger = new Float32Array(this.data.length * 2); bigger.set(this.data); this.data = bigger; }
    const d = this.data, o = this.n * this.FLOATS;
    d[o] = x; d[o + 1] = y; d[o + 2] = r; d[o + 3] = g; d[o + 4] = b; d[o + 5] = a;
    this.n++;
  },

  draw(c) {
    const gl = c.gl;
    if (!c.world.life) return;
    this.n = 0;
    Life.drawWith(this.writers(c.world), c.world, c.s, c.palette, c.time, c.dark);
    if (!this.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * this.FLOATS), gl.DYNAMIC_DRAW);
    GlShaders.use(this.program, { u_size: [c.w, c.h] });
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.bindVertexArray(this.inst.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    gl.disable(gl.BLEND);
  },
});
