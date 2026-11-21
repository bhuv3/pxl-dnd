// Stage 'lights': the warm, coloured and beam lights with walls blocking them (Fire.addLights, Details.addBeams,
// Characters.addLights, Fire.applyLights; or a page's own extraLights callback). The CPU gatherers run with Fire.collect, which hands back each light's
// position, power, colour and radius (flicker included); no line of sight is worked out on the CPU. Each light is one
// instanced quad. Its fragments do the wall ray march (as Fire.visibility) and add into two float buffers: buffer 0
// holds the colour sum in rgb and the combined amount in alpha (a + b * (1 - a), by the blend), buffer 1 the weight
// sum. A last full-frame draw undoes the tint where light fell, in the four dithered bands of Fire.applyLights.
GpuWorld.define('lightWall', { format: 'R8UI', from: world => {
  const out = new Uint8Array(world.w * world.h);
  for (let i = 0; i < out.length; i++) out[i] = Types.isWall(world.ground[i]) ? 1 : 0;
  return out;
} });

GlChunks.add('lightWall', `
uniform highp usampler2D u_wall;
bool isWallPx(ivec2 p) {
  ivec2 s = textureSize(u_wall, 0);
  return p.x < 0 || p.y < 0 || p.x >= s.x || p.y >= s.y || texelFetch(u_wall, p, 0).r != 0u;
}
`);

GlFrame.register({
  stage: 'lights',
  FLOATS: 9,                                                                 // per light: x y visY see | r g b power | radius
  // Compiles the two programs and makes the instance buffer (once per GL context).
  init() {
    this.rt = null;
    this.splat = GlShaders.program('lights.splat', { vs: this.VS, fs: this.FS });
    this.compose = GlShaders.program('lights.compose', { fs: this.COMPOSE });
    this.inst = GlShaders.instanced(new Float32Array(this.FLOATS), [4, 4, 1]);
  },

  // Makes the two float buffers (and the framebuffer that draws into both) for this map size, once.
  buffers(c) {
    if (this.rt && this.rt.w === c.w && this.rt.h === c.h) return this.rt;
    const gl = c.gl, f32 = !!gl.getExtension('EXT_float_blend');
    if (this.rt) { GlTex.free(this.rt.sums); GlTex.free(this.rt.weight); gl.deleteFramebuffer(this.rt.fbo); }
    const sums = GlTex.make(c.w, c.h, f32 ? 'RGBA32F' : 'RGBA16F', null), weight = GlTex.make(c.w, c.h, f32 ? 'R32F' : 'RGBA16F', null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sums, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, weight, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('The light buffers are not supported');
    this.rt = { w: c.w, h: c.h, sums, weight, fbo };
    return this.rt;
  },

  // The lights this frame, as one row of floats each. A page with its own lights (the game) hands the pass
  // c.extraLights(world, night): it is called inside the recorder in place of Characters.addLights, and runs by day too
  // (effect lights shine a little then).
  gather(c) {
    const night = Fire.nightOf(c.dark);
    this.last = [];                                         // this frame's recorded lights, for a page that wants them on the CPU (the game's lightAt)
    if (night <= 0 && !c.extraLights) return null;
    const list = Fire.collect(c.world, () => {
      Fire.addLights(c.world, c.time, c.dark);
      Details.addBeams(c.world, c.time, c.dark);
      if (c.extraLights) c.extraLights(c.world, night); else Characters.addLights(c.world, c.dark);
    }).lights;
    this.last = list;
    if (!list.length) return null;
    const data = new Float32Array(list.length * this.FLOATS);
    list.forEach((l, k) => data.set([l.x, l.y, l.visY === null ? 0 : l.visY, l.visY === null ? 0 : 1, l.color[0], l.color[1], l.color[2], l.power, l.radius], k * this.FLOATS));
    return data;
  },

  // Adds every light into the two buffers.
  addAll(c, data) {
    const gl = c.gl, rt = this.buffers(c);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
    gl.viewport(0, 0, c.w, c.h);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    GlShaders.use(this.splat, c.common());
    c.bind(0, c.texture('lightWall'));
    gl.uniform1i(this.splat.loc('u_wall'), 0);
    gl.bindVertexArray(this.inst.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, data.length / this.FLOATS);
    gl.disable(gl.BLEND);
  },

  // Puts the light on the picture: untints and colours the lit pixels in bands.
  apply(c) {
    const rt = this.rt, gl = c.gl;
    c.rewrite(src => {
      GlShaders.use(this.compose, { u_tint: c.tint });
      c.bind(0, src); c.bind(1, rt.sums); c.bind(2, rt.weight);
      gl.uniform1i(this.compose.loc('u_src'), 0);
      gl.uniform1i(this.compose.loc('u_light'), 1);
      gl.uniform1i(this.compose.loc('u_weight'), 2);
      GlShaders.drawFullscreen();
    });
  },

  // Gathers the lights, adds them up, and applies them (nothing to do by day).
  draw(c) {
    const data = this.gather(c);
    if (!data) return;
    this.addAll(c, data);
    this.apply(c);
  },

  // One quad per light, just big enough for its ellipse. The ray's start is the first open pixel below the light.
  VS: `{{header}}
{{frame}}
{{lightWall}}
in vec2 a_corner;
in vec4 a_i1;
in vec4 a_i2;
in float a_i3;
flat out ivec4 v_pos;       // x, y of the light; x, y of the ray's start
flat out vec4 v_light;      // r g b power
flat out vec4 v_shape;      // reach, radius-based sight range, sees walls, visY
void main() {
  ivec2 at = ivec2(floor(a_i1.xy + 0.5));
  float reach = a_i3 * (0.9 + a_i2.w * 0.1);
  vec2 half_ = vec2(ceil(reach), ceil(reach / 1.4));
  int vy = int(floor(a_i1.z + 0.5));
  int ox = at.x, oy = vy;
  for (int k = 0; k < ${Fire.WALL_SEARCH}; k++) { if (isWallPx(ivec2(ox, oy))) oy++; }
  v_pos = ivec4(at, ox, oy);
  v_light = a_i2;
  v_shape = vec4(reach, ceil(a_i3) + 1.0, a_i1.w, float(vy));
  vec2 lo = vec2(at) - half_;
  gl_Position = pxToClip(lo + a_corner * (half_ * 2.0 + 1.0));
}`,

  FS: `{{header}}
{{lightWall}}
flat in ivec4 v_pos;
flat in vec4 v_light;
flat in vec4 v_shape;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
// Can the ray from origin to target (pixels) pass? It stops at the first wall pixel before the target.
bool canSee(ivec2 origin, ivec2 target) {
  ivec2 n = target - origin;
  int steps = max(abs(n.x), abs(n.y));
  for (int j = 1; j < steps; j++) {
    ivec2 p = (2 * (origin * steps + n * j) + steps + 8192 * steps) / (2 * steps) - 4096;
    if (isWallPx(p)) return false;
  }
  return true;
}
void main() {
  ivec2 d = ivec2(gl_FragCoord.xy) - v_pos.xy;
  float dist = length(vec2(float(d.x), float(d.y) * 1.4)) / v_shape.x;
  if (dist >= 1.0) discard;
  if (v_shape.z > 0.5) {
    int range = int(v_shape.y);
    if (abs(d.x) > range || abs(d.y) > range || !canSee(v_pos.zw, ivec2(v_pos.x, int(v_shape.w)) + d)) discard;
  }
  float t = 1.0 - dist;
  float a = t * sqrt(t) * v_light.w;
  o0 = vec4(v_light.rgb * a, a);
  o1 = vec4(a, 0.0, 0.0, 0.0);
}`,

  COMPOSE: `{{header}}
uniform sampler2D u_src;
uniform sampler2D u_light;
uniform sampler2D u_weight;
uniform vec3 u_tint;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(u_src, p, 0), l = texelFetch(u_light, p, 0);
  float v = l.a + (((p.x + p.y) & 1) == 1 ? 0.04 : -0.04);
  float a = v > 0.45 ? 0.9 : v > 0.2 ? 0.6 : v > 0.07 ? 0.3 : 0.0;
  if (a == 0.0) { o = s; return; }
  vec3 f = floor(s.rgb * 255.0 + 0.5);
  vec3 lit = min(vec3(255.0), f / u_tint * l.rgb / texelFetch(u_weight, p, 0).r);
  vec3 r = floor(f + (lit - f) * a + 0.5);
  o = vec4(mix(r, vec3(0.0), lessThanEqual(u_tint, vec3(0.0))) / 255.0, 1.0);
}`,
});
