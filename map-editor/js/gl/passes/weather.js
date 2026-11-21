// Stage 'weather': the rain darkening, cloud shadows, fog, and the rain or snow, as Weather.draw does them.
//  - The picture-wide steps (rain shade, clouds, fog) are one full-frame shader that rounds to whole 0-255 steps after
//    each step, as the CPU does when it stores each one. The cloud and fog noise is sampled every 8 pixels, so a small
//    float target holds that grid (one noise value per grid point), filled first.
//  - Rain drops, splashes and snowflakes are one-pixel points whose positions are a function of time and Random.hash
//    (the same expressions as the CPU, with the hash in GLSL); instance i is a drop and which of its pixels it is.
GlFrame.register({
  stage: 'weather',
  GRID: 8,                        // mirrors Weather: the noise grid step, noise sizes and the colours
  CLOUD_SIZE: 70,
  FOG_SIZE: 60,
  CLOUD_TINT: [1, 0.95, 0.6],
  RAIN_SHADE: [0.9, 0.92, 0.96],
  RAIN: [196, 214, 230],
  FLAKE: [246, 250, 252],
  FOG: [204, 212, 208],
  RIPPLE_SLOTS: 21,               // the most points a splash ring has (radius 3: round(3 * 7))

  init() {
    this.gridProgram = GlShaders.program('weather.grid', { fs: this.gridShader() });
    this.screenProgram = GlShaders.program('weather.screen', { fs: this.screenShader() });
    this.rainProgram = GlShaders.program('weather.rain', { vs: this.rainShader(), fs: '{{header}}\n{{pointsFrag}}' });
    this.splashProgram = GlShaders.program('weather.splash', { vs: this.splashShader(), fs: '{{header}}\n{{pointsFrag}}' });
    this.snowProgram = GlShaders.program('weather.snow', { vs: this.snowShader(), fs: '{{header}}\n{{pointsFrag}}' });
  },

  // The noise grid: x = column, y = row of grid points; red the cloud noise, green the fog noise.
  gridShader() {
    return `{{header}}
{{noise}}
uniform vec2 u_cloudOff;
uniform vec2 u_fogOff;
uniform int u_clouds;
uniform int u_fog;
out vec4 o;
void main() {
  vec2 g = floor(gl_FragCoord.xy) * ${this.GRID}.0;
  float cloud = u_clouds != 0 ? noise(g.x - u_cloudOff.x, g.y - u_cloudOff.y, ${this.CLOUD_SIZE}.0, 1500) : 0.0;
  float mist = u_fog != 0 ? noise(g.x - u_fogOff.x, g.y - u_fogOff.y, ${this.FOG_SIZE}.0, 1501) : 0.0;
  o = vec4(cloud, mist, 0.0, 1.0);
}`;
  },

  // The picture-wide steps. v is the 0-255 colour; every step is stored rounded (half to even, like a Uint8ClampedArray).
  screenShader() {
    const col = v => `vec3(${v.join(', ')})`;
    return `{{header}}
{{noise}}
uniform sampler2D u_src;
uniform sampler2D u_grid;
uniform int u_shade;
uniform int u_clouds;
uniform int u_fog;
uniform float u_edge;
uniform float u_fogAmount;
uniform vec3 u_cloudShade;
out vec4 o;
// The grid noise at this pixel, bilinear between the 4 grid points around it (channel 0 clouds, 1 fog).
float gridAt(ivec2 p, int channel) {
  ivec2 g = p / ${this.GRID};
  vec2 f = vec2(p - g * ${this.GRID}) / ${this.GRID}.0;
  float a = texelFetch(u_grid, g, 0)[channel], b = texelFetch(u_grid, g + ivec2(1, 0), 0)[channel];
  float c = texelFetch(u_grid, g + ivec2(0, 1), 0)[channel], d = texelFetch(u_grid, g + ivec2(1, 1), 0)[channel];
  float top = a + (b - a) * f.x, bottom = c + (d - c) * f.x;
  return top + (bottom - top) * f.y;
}
float fogAlpha(float v) { return v > 0.6 ? 0.6 : v > 0.42 ? 0.45 : v > 0.25 ? 0.3 : v > 0.1 ? 0.15 : 0.0; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 v = floor(texelFetch(u_src, p, 0).rgb * 255.0 + 0.5);
  if (u_shade != 0) v = roundEven(v * ${col(this.RAIN_SHADE)});
  if (u_clouds != 0) {
    float n = gridAt(p, 0);
    bool dither = ((p.x + p.y) & 1) != 0;
    if (!(n < u_edge || (n < u_edge + 0.02 && dither))) v = roundEven(v * u_cloudShade);
  }
  if (u_fog != 0) {
    float grain = (hash(p.x, p.y) - 0.5) * 0.12;
    float a = fogAlpha(u_fogAmount * (0.25 + max(0.0, gridAt(p, 1) - 0.3) * 1.4) + grain);
    v = roundEven(v + (${col(this.FOG)} - v) * a);
  }
  o = vec4(v / 255.0, 1.0);
}`;
  },

  // Rain streaks: instance i is drop i / 3 and its pixel i % 3 (3 pixels up and to the left, fading).
  rainShader() {
    return `{{header}}
{{frame}}
{{noise}}
{{round}}
{{points}}
uniform float u_time;
uniform float u_slant;
void main() {
  int k = gl_InstanceID / 3, j = gl_InstanceID % 3;
  float span = u_size.y + 20.0;
  float y = mod(hash(k, 1602) * span + u_time * (70.0 + hash(k, 1601) * 40.0), span) - 10.0;
  float x = mod(hash(k, 1603) * u_size.x + y * u_slant, u_size.x);
  putPixel(ivec2(roundJs(x - float(j) * u_slant), roundJs(y - float(j))), ${this.colour(this.RAIN)}, 0.4 - float(j) * 0.1);
}`;
  },

  // Splashes: instance i is splash i / RIPPLE_SLOTS and its point i % RIPPLE_SLOTS. On water a ring of foam (as
  // Water.ripple); on land one pixel, then two.
  splashShader() {
    return `{{header}}
{{frame}}
{{noise}}
{{round}}
{{points}}
const int SLOTS = ${this.RIPPLE_SLOTS};
uniform float u_time;
uniform usampler2D u_water;
uniform vec3 u_foam;
bool isWater(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < int(u_size.x) && p.y < int(u_size.y) && texelFetch(u_water, p, 0).r != 0u; }
ivec2 ringPoint(ivec2 o, int k, int steps, float r) {
  float a = float(k) / float(steps) * 6.2831853;
  return ivec2(roundJs(float(o.x) + cos(a) * r), roundJs(float(o.y) + sin(a) * r * 0.6));
}
// One point of the ring, unless it is off the water or the same pixel as the point before it.
void ring(ivec2 o, int slot, float age) {
  float r = 0.6 + age * 2.4;
  int steps = max(8, roundJs(r * 7.0));
  ivec2 p = ringPoint(o, slot, steps, r);
  if (slot >= steps || !isWater(p) || (slot > 0 && p == ringPoint(o, slot - 1, steps, r))) { dropPixel(); return; }
  putPixel(p, u_foam, (1.0 - age) * 0.4);
}
// The spatter on land: a pixel at first, then two above the sides.
void spatter(ivec2 o, int slot, float age) {
  if (slot > 1 || age >= 0.25 || (age < 0.12 && slot > 0)) { dropPixel(); return; }
  if (age < 0.12) putPixel(o, ${this.colour(this.RAIN)}, 0.5);
  else putPixel(o + ivec2(slot == 0 ? -1 : 1, -1), ${this.colour(this.RAIN)}, 0.35);
}
void main() {
  int k = gl_InstanceID / SLOTS, slot = gl_InstanceID % SLOTS;
  float t = u_time / (0.6 + hash(k, 1604) * 0.4) + hash(k, 1605);
  int loop = int(floor(t));
  float age = t - floor(t);
  ivec2 o = min(ivec2(floor(vec2(hash(k, loop * 7 + 1606), hash(k, loop * 7 + 1607)) * u_size)), ivec2(u_size) - 1);
  if (isWater(o)) ring(o, slot, age); else spatter(o, slot, age);
}`;
  },

  // Snowflakes: instance i is flake i / 3 and its pixel i % 3 (the flake, then the extra pixels of a near one).
  snowShader() {
    return `{{header}}
{{frame}}
{{noise}}
{{round}}
{{points}}
uniform float u_time;
uniform float u_drift;
void main() {
  int k = gl_InstanceID / 3, j = gl_InstanceID % 3;
  bool near = hash(k, 1701) < 0.25;
  float speed = near ? 14.0 + hash(k, 1702) * 6.0 : 6.0 + hash(k, 1702) * 4.0;
  float span = u_size.y + 10.0;
  float y = mod(hash(k, 1703) * span + u_time * speed, span) - 5.0;
  float sway = sin(u_time * (0.8 + hash(k, 1704)) + float(k)) * (near ? 2.5 : 1.5);
  float x = mod(hash(k, 1705) * u_size.x + sway + u_time * u_drift, u_size.x);
  ivec2 p = ivec2(roundJs(x), roundJs(y));
  if (j == 1) p.x += 1;
  if (j == 2) p.y += 1;
  if (j > 0 && !near) { dropPixel(); return; }
  putPixel(p, ${this.colour(this.FLAKE)}, j > 0 ? 0.5 : near ? 0.95 : 0.6);
}`;
  },

  // A colour as a GLSL vec3 literal.
  colour(v) { return `vec3(${v.map(n => n.toFixed(1)).join(', ')})`; },

  // The noise grid for this time, in a float target made for the map's size (kept until the size changes).
  makeGrid(c) {
    const gw = Math.ceil(c.w / this.GRID) + 1, gh = Math.ceil(c.h / this.GRID) + 1;
    if (this.grid && (this.grid.w !== gw || this.grid.h !== gh)) { GlTex.freeTarget(this.grid); this.grid = null; }
    if (!this.grid) this.grid = GlTex.target(gw, gh, 'RGBA32F');
    const gl = c.gl, s = c.s;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.grid.fbo);
    gl.viewport(0, 0, gw, gh);
    GlShaders.use(this.gridProgram, {
      u_seed: ['i', c.map.seed | 0], u_clouds: this.clouds(s), u_fog: s.fog > 0,
      u_cloudOff: [c.time * s.cloudSpeed * 3, c.time * s.cloudSpeed * 1.2], u_fogOff: [c.time * 1.6, c.time * 0.4],
    });
    GlShaders.drawFullscreen();
  },

  // True when cloud shadows are drawn.
  clouds(s) { return !!(s.clouds && s.cloudAmount > 0); },

  // Rain shade, clouds and fog in one pass over the whole picture.
  drawScreen(c) {
    const s = c.s, gl = c.gl, clouds = this.clouds(s), fog = s.fog > 0, shade = s.weather === 'rain';
    if (!shade && !clouds && !fog) return;
    if (clouds || fog) this.makeGrid(c);
    c.rewrite(src => {
      GlShaders.use(this.screenProgram, {
        u_seed: ['i', c.map.seed | 0], u_src: ['i', 0], u_grid: ['i', 1], u_shade: shade, u_clouds: clouds, u_fog: fog,
        u_edge: 0.75 - s.cloudAmount * 0.45, u_fogAmount: s.fog, u_cloudShade: this.CLOUD_TINT.map(k => 1 - s.cloudDarkness * k),
      });
      c.bind(0, src);
      if (this.grid) c.bind(1, this.grid.tex);
      GlShaders.drawFullscreen();
    });
    c.bindTarget();
  },

  // Draws instanced one-pixel points over the picture with alpha blending.
  points(c, program, count, uniforms) {
    const gl = c.gl;
    if (count <= 0) return;
    GlShaders.use(program, { ...c.common(), ...uniforms });
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.bindVertexArray(GlShaders.quad().vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.disable(gl.BLEND);
  },

  // Rain: the streaks, then the splashes (the water layer says where a ring may go).
  drawRain(c) {
    const s = c.s, slant = s.wind ? 0.25 + s.windStrength * 0.15 : 0.15;
    this.points(c, this.rainProgram, Math.round(c.w * c.h / 400 * s.precipitation) * 3, { u_slant: slant });
    c.bind(0, c.texture('water'));
    const splashes = Math.round(c.w * c.h / 900 * s.precipitation);
    this.points(c, this.splashProgram, splashes * this.RIPPLE_SLOTS, { u_water: ['i', 0], u_foam: c.palette.foam });
  },

  // Snow: flakes, drifting faster with the wind.
  drawSnow(c) {
    const s = c.s, drift = s.wind ? s.windStrength * 4 : 1;
    this.points(c, this.snowProgram, Math.round(c.w * c.h / 220 * s.precipitation) * 3, { u_drift: drift });
  },

  draw(c) {
    this.drawScreen(c);
    if (c.s.weather === 'rain') this.drawRain(c);
    if (c.s.weather === 'snow') this.drawSnow(c);
  },
});
