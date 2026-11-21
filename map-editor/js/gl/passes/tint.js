// Stage 'tint': multiplies every pixel by the time-of-day (or underground) tint, like Daylight.apply. The CPU stores each
// product in a Uint8ClampedArray (double-precision multiply, ties to even), and the lights then divide the tint back out,
// which magnifies a one-level difference to four or five. A float32 shader can't always round the same way (0.33 * 50 is
// exactly a tie in double precision and not in float32), so the CPU builds a 256-entry table per channel with the very same
// conversion and the shader only looks values up. The table is a 256 x 1 texture, rebuilt whenever the tint changes.
GlFrame.register({
  stage: 'tint',
  init() {
    this.program = GlShaders.program('tint', { fs: `{{header}}
uniform sampler2D u_src;
uniform sampler2D u_lut;                       // x = the input value 0-255, rgb = that value times the tint, rounded
out vec4 o;
void main() {
  ivec3 v = ivec3(floor(texelFetch(u_src, ivec2(gl_FragCoord.xy), 0).rgb * 255.0 + 0.5));
  o = vec4(texelFetch(u_lut, ivec2(v.r, 0), 0).r, texelFetch(u_lut, ivec2(v.g, 0), 0).g, texelFetch(u_lut, ivec2(v.b, 0), 0).b, 1.0);
}` });
    this.table = new Uint8ClampedArray(256 * 4);
    this.lut = GlTex.make(256, 1, 'RGBA8', null);
    this.key = '';
  },
  // Rebuilds the table for a tint (a no-op while the tint is unchanged).
  fillTable(t) {
    const key = t.join(',');
    if (key === this.key) return;
    this.key = key;
    for (let v = 0; v < 256; v++) {
      this.table[v * 4] = v * t[0]; this.table[v * 4 + 1] = v * t[1]; this.table[v * 4 + 2] = v * t[2]; this.table[v * 4 + 3] = 255;
    }
    GlTex.update(this.lut, new Uint8Array(this.table.buffer));
  },
  draw(c) {
    const t = c.tint;
    if (t[0] > 0.995 && t[1] > 0.995 && t[2] > 0.995) return;                // the CPU skips a clear noon too
    this.fillTable(t);
    c.rewrite(src => {
      GlShaders.use(this.program);
      c.bind(0, src);
      c.bind(1, this.lut);
      c.gl.uniform1i(this.program.loc('u_src'), 0);
      c.gl.uniform1i(this.program.loc('u_lut'), 1);
      GlShaders.drawFullscreen();
    });
  },
});
