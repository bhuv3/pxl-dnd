// Stage 'glow': flames and lit windows at full brightness, then fireflies (Fire.drawGlow, Life.drawGlow). The CPU code
// that decides where each flame pixel goes runs with Fire.collect, which hands back every blend it would have made
// as a point (x, y, colour, alpha). The pass draws the points, in the same order, as 1-pixel instanced quads with
// alpha blending (the CPU's blend(frame, i, colour, a)).
GlFrame.register({
  stage: 'glow',
  // Compiles the point program and makes the instance buffer (once per GL context).
  init() {
    this.program = GlShaders.program('glow.points', {
      vs: `{{header}}
{{frame}}
in vec2 a_corner;
in vec2 a_i1;
in vec4 a_i2;
flat out vec4 v_color;
void main() {
  v_color = a_i2;
  gl_Position = pxToClip(a_i1 + a_corner);
}`,
      fs: `{{header}}
flat in vec4 v_color;
out vec4 o;
void main() { o = v_color; }`,
    });
    this.inst = GlShaders.instanced(new Float32Array(6), [2, 4]);
  },

  // Fireflies, as Life.drawGlow draws them: each a blinking dot with a faint cross round it. Adds to the points.
  fireflies(c, out) {
    const { world, s, palette, time, dark } = c;
    if (!world.life) return;
    const night = Math.max(0, Math.min(1, (dark - 0.25) / 0.2));
    if (night <= 0 || Weather.isWet(s)) return;
    const list = world.life.fireflies;
    list.forEach((f, k) => {
      if (k / list.length >= night) return;
      const blink = Math.sin(time * 2.2 * f.speed + f.ph);
      if (blink < 0.1) return;
      const a = Math.min(1, (blink - 0.1) / 0.5), t = time * f.speed;
      const x = Math.round(f.x + Math.sin(t * 0.5 + f.ph) * 5 + (Random.valueNoise(t * 0.3 + f.ph * 4, 1.5, 320) - 0.5) * 8);
      const y = Math.round(f.y + Math.cos(t * 0.4 + f.ph * 2) * 3 + (Random.valueNoise(1.5, t * 0.3 + f.ph * 4, 321) - 0.5) * 6);
      this.point(c, out, x, y, palette.firefly, a);
      this.point(c, out, x - 1, y, palette.firefly, a * 0.35); this.point(c, out, x + 1, y, palette.firefly, a * 0.35);
      this.point(c, out, x, y - 1, palette.firefly, a * 0.35); this.point(c, out, x, y + 1, palette.firefly, a * 0.35);
    });
  },

  // Adds one blended pixel to the list (nothing when it falls outside the map).
  point(c, out, x, y, color, a) {
    if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
    out.push(x, y, color[0], color[1], color[2], a);
  },

  // Every pixel to blend this frame: x, y, r, g, b (0-255), alpha, six numbers each.
  gather(c) {
    const points = Fire.collect(c.world, () => Fire.drawGlow(null, c.world, c.palette, c.time, c.dark)).points;
    this.fireflies(c, points);
    return points;
  },

  // Draws every flame, window and firefly pixel over the picture, in order.
  draw(c) {
    const points = this.gather(c), n = points.length / 6;
    if (!n) return;
    const data = new Float32Array(points.length);
    for (let i = 0; i < points.length; i += 6) data.set([points[i], points[i + 1], points[i + 2] / 255, points[i + 3] / 255, points[i + 4] / 255, points[i + 5]], i);
    const gl = c.gl;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    GlShaders.use(this.program, c.common());
    gl.bindVertexArray(this.inst.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.disable(gl.BLEND);
  },
});
