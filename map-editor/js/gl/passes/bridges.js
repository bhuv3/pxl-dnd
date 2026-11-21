// Stage 'bridges' (phase G4): Bridges.draw on the GPU. The bridge pixels are baked on the CPU at a rebuild (Bridges.art:
// each pixel's colour, and the water pixels in a bridge's shadow). The pass draws them as single-pixel instances: the
// shadow pixels darken what is under them, then the bridge pixels overwrite it.
const BridgePass = (() => {
  const VS = `{{header}}
{{frame}}
in vec2 a_corner;
in vec2 a_i1;
in vec3 a_i2;
flat out vec3 v_color;
void main() {
  v_color = a_i2 / 255.0;
  gl_Position = pxToClip(a_i1 + a_corner);
}`;
  const FS = `{{header}}
flat in vec3 v_color;
out vec4 o;
void main() { o = vec4(v_color, 1.0); }`;

  let program = null, solid = null, shade = null;

  // Frees a vertex array made by GlShaders.instanced.
  function freeInstances(inst) {
    if (!inst) return;
    const gl = Gl.get();
    gl.deleteVertexArray(inst.vao);
    gl.deleteBuffer(inst.buffer);
  }

  // Instances (x, y, r, g, b) for a list of map indices; colours is one colour for all, or one per index.
  function instances(world, idx, colours) {
    const out = new Float32Array(idx.length * 5);
    idx.forEach((i, k) => {
      const c = colours.length === 3 && typeof colours[0] === 'number' ? colours : colours[k];
      out.set([i % world.w, (i / world.w) | 0, c[0], c[1], c[2]], k * 5);
    });
    return out;
  }

  // Makes the instance buffer, or null when there is nothing to draw.
  function make(floats) { return floats.length ? GlShaders.instanced(floats, [2, 3], Gl.get().STATIC_DRAW) : null; }

  // Draws one instance set.
  function drawSet(gl, inst) {
    gl.bindVertexArray(inst.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, inst.count);
  }

  return {
    init() {
      GlShaders.quad();                          // before any instanced() call: it makes the shared quad on first use
      program = GlShaders.program('bridges', { vs: VS, fs: FS });
    },
    upload(c) {
      freeInstances(solid); freeInstances(shade);
      solid = shade = null;
      if (!c.world.bridges || !c.world.bridges.length) return;
      const art = Bridges.art(c.world, c.s, c.palette);
      shade = make(instances(c.world, art.shade, Bridges.SHADE.map(v => v * 255)));
      solid = make(instances(c.world, art.idx, art.col));
    },
    draw(c) {
      const gl = c.gl;
      GlShaders.use(program, c.common());
      if (shade) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        drawSet(gl, shade);
        gl.disable(gl.BLEND);
      }
      if (solid) drawSet(gl, solid);
      gl.bindVertexArray(null);
    },
  };
})();

GlFrame.register({ stage: 'bridges', ...BridgePass });
