// Seeded randomness and value noise. Everything here is repeatable for a given seed.
const Random = (() => {
  let seed = 1;

  // Sets the seed used by hash and all noise functions.
  function setSeed(s) { seed = s | 0; }

  // Position → repeatable pseudo-random number in [0, 1).
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263 + seed * 144665) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // Sequential generator (mulberry32) started from any integer.
  function makeRng(start) {
    let a = start | 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  // Random values on an integer grid, smoothly blended in between.
  function valueNoise(x, y, salt) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
    const a = hash(xi + salt, yi), b = hash(xi + 1 + salt, yi);
    const c = hash(xi + salt, yi + 1), d = hash(xi + 1 + salt, yi + 1);
    const top = a + (b - a) * xf, bottom = c + (d - c) * xf;
    return top + (bottom - top) * yf;
  }

  // Big blobs plus a little detail. size is roughly the blob size in pixels.
  function noise(x, y, size, salt) {
    return valueNoise(x / size, y / (size * 0.7), salt) * 0.7
         + valueNoise(x / (size * 0.35) + 50, y / (size * 0.35) + 50, salt) * 0.3;
  }

  // Noise along a line (coastlines, river meanders).
  function noise1D(x, size, salt) {
    return valueNoise(x / size, 0.5, salt) * 0.7 + valueNoise(x / (size * 0.3), 3.5, salt) * 0.3;
  }

  // Fresh random seed for new maps and placed objects.
  function newSeed() { return Math.floor(Math.random() * 2147483646) + 1; }

  // Cell noise: nearest and second-nearest of jittered grid points. Gives stone and tile shapes.
  // d1/d2: distances, id: the nearest cell, ox/oy: offset from that cell's point.
  function cells(x, y, size, salt) {
    const gx = Math.floor(x / size), gy = Math.floor(y / size);
    let d1 = Infinity, d2 = Infinity, id = 0, ox = 0, oy = 0;
    for (let cy = gy - 1; cy <= gy + 1; cy++) {
      for (let cx = gx - 1; cx <= gx + 1; cx++) {
        const px = (cx + 0.15 + hash(cx + salt, cy) * 0.7) * size;
        const py = (cy + 0.15 + hash(cx, cy + salt) * 0.7) * size;
        const dx = x + 0.5 - px, dy = y + 0.5 - py;
        const d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; id = hash(cx + salt * 3, cy + 17); ox = dx; oy = dy; }
        else if (d < d2) d2 = d;
      }
    }
    return { d1, d2, id, ox, oy };
  }

  return { setSeed, hash, makeRng, valueNoise, noise, noise1D, cells, newSeed };
})();
