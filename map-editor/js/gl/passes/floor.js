// Stage 'floor' (the game): ground marks that fade (scorch, blast, acid), drawn between the water and the objects. The page
// hands the pass its pixels as c.floorPoints(world): a flat list [x, y, r, g, b, alpha, ...] in draw order (the game's
// Marks.floorPoints, which its CPU path draws too), each one the CPU's frame = frame * (1 - a) + colour * a. The pass
// draws them as 1-pixel instanced quads with alpha blending, through the shared 'points' chunk. A page without
// c.floorPoints (the editor, or a floor hook that only draws on the CPU) leaves the stage to the CPU.
GlFrame.register({
  stage: 'floor',
  applies: ctx => typeof ctx.floorPoints === 'function',
  // Compiles the point program and makes the instance buffer (once per GL context).
  init() {
    this.program = GlShaders.program('floor.points', {
      vs: `{{header}}
{{frame}}
{{points}}
in vec2 a_i1;                     // x, y
in vec4 a_i2;                     // r g b (0-255), alpha
void main() { putPixel(ivec2(a_i1), a_i2.rgb, a_i2.a); }`,
      fs: `{{header}}
{{pointsFrag}}`,
    });
    this.inst = GlShaders.instanced(new Float32Array(6), [2, 4]);
  },
  // Draws every mark pixel over the picture, in order (nothing when there are no marks).
  draw(c) {
    const points = c.floorPoints(c.world), n = points.length / 6;
    if (!n) return;
    const gl = c.gl;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    GlShaders.use(this.program, { u_size: [c.w, c.h] });
    gl.bindVertexArray(this.inst.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.disable(gl.BLEND);
  },
});
