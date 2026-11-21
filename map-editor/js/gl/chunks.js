// Shared GLSL, pasted into a shader wherever it says {{name}}. A pass can add its own with GlChunks.add before its
// programs are compiled. Pixel coordinates everywhere: x to the right, y down, (0, 0) the map's top-left pixel.
const GlChunks = (() => {
  const chunks = {
    // The three-line header of every shader.
    header: `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
precision highp isampler2D;
precision highp sampler2D;
`,

    // u_size: the map's size in pixels. pxToClip turns a map pixel position into a clip position, so that the
    // frame texture's row y is map row y (reading it back needs no flip).
    frame: `
uniform vec2 u_size;
vec4 pxToClip(vec2 p) { return vec4(p.x / u_size.x * 2.0 - 1.0, p.y / u_size.y * 2.0 - 1.0, 0.0, 1.0); }
`,

    // Random.hash and the noise built on it (core/random.js), with the map's seed in u_seed. The hash uses 32-bit
    // integers like the JS; its result keeps 24 bits (the JS keeps 32), which only matters exactly on a threshold.
    noise: `
uniform int u_seed;
float hash(int x, int y) {
  uint h = uint(x) * 374761393u + uint(y) * 668265263u + uint(u_seed) * 144665u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h ^= h >> 16u;
  return float(h >> 8u) / 16777216.0;
}
float smooth01(float t) { return t * t * (3.0 - 2.0 * t); }
float valueNoise(float x, float y, int salt) {
  float fx = floor(x), fy = floor(y);
  int xi = int(fx), yi = int(fy);
  float xf = smooth01(x - fx), yf = smooth01(y - fy);
  float a = hash(xi + salt, yi), b = hash(xi + 1 + salt, yi), c = hash(xi + salt, yi + 1), d = hash(xi + 1 + salt, yi + 1);
  float top = a + (b - a) * xf, bottom = c + (d - c) * xf;
  return top + (bottom - top) * yf;
}
float noise(float x, float y, float size, int salt) {
  return valueNoise(x / size, y / (size * 0.7), salt) * 0.7 + valueNoise(x / (size * 0.35) + 50.0, y / (size * 0.35) + 50.0, salt) * 0.3;
}
float noise1D(float x, float size, int salt) {
  return valueNoise(x / size, 0.5, salt) * 0.7 + valueNoise(x / (size * 0.3), 3.5, salt) * 0.3;
}
`,

    // JS Math.round: halves go up. (GLSL round() may go to even.)
    round: `
int roundJs(float v) { return int(floor(v + 0.5)); }
float roundJsF(float v) { return floor(v + 0.5); }
`,
  };

  // Adds or replaces a chunk.
  function add(name, src) { chunks[name] = src; }

  // Replaces each {{name}} in a shader's source with its chunk.
  function expand(src) {
    return src.replace(/\{\{(\w+)\}\}/g, (m, name) => {
      if (!(name in chunks)) throw new Error('No GLSL chunk named ' + name);
      return chunks[name];
    });
  }

  return { add, expand, get: name => chunks[name] };
})();
