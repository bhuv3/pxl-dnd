// The GL frame: two RGBA8 textures the size of the map (the picture being drawn), the passes that draw into it, and the
// way the picture moves between the CPU and the GPU. Row y of the texture is map row y, so a read-back needs no flip.
//
// A pass is { stage, init(c), upload(c), draw(c) } registered with GlFrame.register. `stage` is one of Stages.NAMES;
// init runs once per GL context, upload after every rebuild (the world changed), draw every frame. `c` is the pass
// context: { gl, w, h, world, map, s, palette, time, tint, dark, seed } plus the helpers below. When draw runs, the
// picture so far is in the current target, which is already bound with the viewport set and blending off.
//   - Drawing over the picture (sprites, particles): just draw, with blending if needed.
//   - Reading the picture (lights, anything that changes a pixel from its old colour): wrap the draw in
//     c.rewrite(src => { ... }), which binds the old picture as texture `src`, draws into a fresh target, then swaps.
const GlFrame = (() => {
  const passes = {};
  let gl = null, w = 0, h = 0, targets = null, cur = 0, ready = false;
  let copyProgram = null, presentProgram = null;
  let lastCtx = null;

  // Registers a pass for its stage. A stage may have several (flat maps and raised maps draw 'things' differently): the
  // first one whose `applies(ctx)` is true (or that has no such test) draws the frame.
  function register(pass) { (passes[pass.stage] || (passes[pass.stage] = [])).push(pass); }
  // The pass that would draw this stage now (registered, not disabled, applies to ctx), or undefined. Without a ctx the
  // `applies` tests are skipped.
  const pass = (stage, ctx) => (passes[stage] || []).find(p => !p.disabled && (!p.applies || !ctx || p.applies(ctx)));
  // True when GL can draw this stage now.
  const has = (stage, ctx) => ready && !!pass(stage, ctx);
  const allPasses = () => Object.values(passes).flat();

  // Starts GL for a map of this size (a new size makes new targets). Returns false when GL can't run.
  function init(width, height) {
    if (!Gl.supported()) return false;
    gl = Gl.init(width, height);
    if (targets && (w !== width || h !== height)) free();
    w = width; h = height;
    if (!targets) targets = [GlTex.target(w, h), GlTex.target(w, h)];
    copyProgram = GlShaders.program('gl.copy', { fs: `{{header}}
uniform sampler2D u_src;
out vec4 o;
void main() { o = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0); }` });
    presentProgram = GlShaders.program('gl.present', { fs: `{{header}}
uniform sampler2D u_src;
uniform float u_h;
out vec4 o;
void main() { o = vec4(texelFetch(u_src, ivec2(int(gl_FragCoord.x), int(u_h) - 1 - int(gl_FragCoord.y)), 0).rgb, 1.0); }` });
    ready = true;
    return true;
  }

  function free() { if (targets) targets.forEach(GlTex.freeTarget); targets = null; }

  // Turns GL off and releases everything it made.
  function shutdown() { if (typeof GlGround !== 'undefined') GlGround.release(); free(); GpuWorld.clear(); GlShaders.clear(); ready = false; lastCtx = null; allPasses().forEach(p => { p.started = false; }); }

  // The pass context for one frame. ctx: { world, map, s, palette, time, tint, dark }.
  function context(ctx) {
    const c = {
      gl, w, h, ...ctx, seed: ctx.map.seed,
      // Uniforms nearly every pass wants: the map's size, seed, and time.
      common: () => ({ u_size: [w, h], u_seed: ['i', ctx.map.seed | 0], u_time: ctx.time }),
      rewrite, bindTarget, texture: GpuWorld.tex, bind: GlTex.bind,
      frameTexture: () => targets[cur].tex,
    };
    lastCtx = c;
    return c;
  }

  // Calls a pass's init (once) and upload (once per rebuild), then draws it.
  function run(stage, ctx) {
    const p = pass(stage, ctx), c = context(ctx);
    if (!p) throw new Error(`No GL pass applies to stage '${stage}'`);
    if (!p.started) { if (p.init) p.init(c); p.started = true; p.uploaded = -1; }
    if (p.uploaded !== GpuWorld.revision()) { if (p.upload) p.upload(c); p.uploaded = GpuWorld.revision(); }
    bindTarget();
    gl.disable(gl.BLEND);
    p.draw(c);
  }

  // Binds the current target as the framebuffer and sets the viewport.
  function bindTarget() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[cur].fbo);
    gl.viewport(0, 0, w, h);
  }

  // Draws a pass that reads the picture: fn(src) gets the old picture as a texture and must draw the whole frame; the
  // result becomes the picture.
  function rewrite(fn) {
    const src = targets[cur], dst = targets[1 - cur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    fn(src.tex);
    cur = 1 - cur;
  }

  // Replaces the picture with RGBA bytes from the CPU (w * h * 4).
  function uploadFrame(bytes) { GlTex.update(targets[cur].tex, bytes); }

  // The picture as RGBA bytes on the CPU, top row first. Stalls the GPU: for hand-offs, exports and tests.
  function readFrame(into) {
    const out = into || new Uint8ClampedArray(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[cur].fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
    return out;
  }

  // Reads a small rectangle of the picture (map pixels), top row first, clipped to the map.
  function readRegion(x, y, rw, rh) {
    x = Math.max(0, x); y = Math.max(0, y);
    rw = Math.min(rw, w - x); rh = Math.min(rh, h - y);
    const out = new Uint8Array(Math.max(0, rw * rh) * 4);
    if (rw <= 0 || rh <= 0) return { x, y, w: 0, h: 0, data: out };
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[cur].fbo);
    gl.readPixels(x, y, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return { x, y, w: rw, h: rh, data: out };
  }

  // Copies a texture (RGBA8, map size) into the picture.
  function copyInto(tex) {
    bindTarget();
    gl.disable(gl.BLEND);
    GlShaders.use(copyProgram);
    GlTex.bind(0, tex);
    gl.uniform1i(copyProgram.loc('u_src'), 0);
    GlShaders.drawFullscreen();
  }

  // Draws the picture onto the GL canvas (upright), where the 2D canvas can copy it from.
  function present() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    GlShaders.use(presentProgram, { u_h: h });
    GlTex.bind(0, targets[cur].tex);
    gl.uniform1i(presentProgram.loc('u_src'), 0);
    GlShaders.drawFullscreen();
  }

  return {
    register, has, pass, passes, init, shutdown, context, run, bindTarget, rewrite, uploadFrame, readFrame, readRegion,
    copyInto, present,
    ready: () => ready, size: () => ({ w, h }), canvas: () => Gl.canvas(), lastContext: () => lastCtx,
    // The picture's texture (the current target's): for a compositor that draws it to the screen itself.
    texture: () => targets[cur].tex,
  };
})();
