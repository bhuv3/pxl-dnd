// Draws animated water each frame: depth bands, shimmer, foam, waves, and glints.
const Water = (() => {
  const { WATER } = Types;

  let shadow = null;

  // Paints water, sea waves, and glints into the frame.
  function draw(frame, world, s, pal, time) {
    shadow = world.shadowMask;
    drawWater(frame, world, s, pal, time);
    drawUnderDeck(frame, world, pal);
    drawWaves(frame, world, s, pal, time);
    drawGlints(frame, world, s, pal, time);
    drawRiverGlints(frame, world, s, pal, time);
  }

  // Writes one pixel, darker if it lies in an object's shadow.
  function write(frame, i, c) {
    const p = i * 4;
    if (shadow && shadow[i]) {
      const f = Ground.SHADE;
      frame[p] = c[0] * f[0]; frame[p + 1] = c[1] * f[1]; frame[p + 2] = c[2] * f[2];
    } else {
      frame[p] = c[0]; frame[p + 1] = c[1]; frame[p + 2] = c[2];
    }
  }

  // Every water pixel: depth from the shore, nudged by moving noise, turned into a band.
  function drawWater(frame, world, s, pal, time) {
    const { w, water, waterDist, flowX, flowY, waterIdx } = world;
    const bands = [pal.shallow, pal.mid, pal.deep];
    const flow = time * s.flowSpeed * 2;
    for (let k = 0; k < waterIdx.length; k++) {
      const i = waterIdx[k];
      const x = i % w, y = (i / w) | 0;
      const kind = water[i];
      const tx = kind === WATER.RIVER ? flowX[i] * flow : time * 0.6;
      const ty = kind === WATER.RIVER ? flowY[i] * flow : -time * 0.3;
      let d = waterDist[i];
      if (s.shimmer > 0) d += (Random.valueNoise(x / 4 - tx, y / 3 - ty, 77) - 0.5) * 2 * s.shimmer;
      if (d <= s.foamWidth && Random.valueNoise(x / 3 - tx * 0.5, y / 3 + time * 0.5, 55) > s.foamBreakup) {
        write(frame, i, pal.foam);
        continue;
      }
      const bw = kind === WATER.SEA ? s.seaBandWidth : s.bandWidth;
      const t = d / bw;
      let band = Math.floor(t);
      if (s.dither && t - band > 0.75 && (x + y) % 2 === 0) band++;
      write(frame, i, bands[Math.max(0, Math.min(2, band))]);
    }
  }

  // Dark strip of shade on the water just below bridges and docks.
  function drawUnderDeck(frame, world, pal) {
    const dark = Colors.darken(pal.deep, 0.75);
    for (let k = 0; k < world.underDeck.length; k++) write(frame, world.underDeck[k], dark);
  }

  // Sea waves washing up the beach and back. The front edge is foam.
  function drawWaves(frame, world, s, pal, time) {
    if (s.waveReach <= 0) return;
    const { seaDist, washIdx } = world;
    const wave = (Math.sin(time * s.waveSpeed) * 0.5 + 0.5) * s.waveReach;
    for (let k = 0; k < washIdx.length; k++) {
      const i = washIdx[k];
      const d = seaDist[i];
      if (d <= wave) write(frame, i, d > wave - 1.2 ? pal.foam : pal.shallow);
    }
  }

  // Short light dashes that twinkle on lakes and the sea.
  function drawGlints(frame, world, s, pal, time) {
    const { w, water, waterDist } = world;
    for (const g of world.glints || []) {
      const v = Math.sin(time * 2 * g.speed + g.phase);
      if (v < 0.4) continue;
      const len = v > 0.75 ? 3 : 1;
      for (let k = 0; k < len; k++) {
        const x = g.x + k - (len >> 1);
        const i = g.y * w + x;
        if (x >= 0 && x < w && water[i] && waterDist[i] >= 2) write(frame, i, pal.glint);
      }
    }
  }

  // Glints that drift downstream along each river path, fading in and out.
  function drawRiverGlints(frame, world, s, pal, time) {
    const { w, h, water } = world;
    for (const g of world.riverGlints || []) {
      const path = world.riverPaths[g.path];
      if (!path || path.length < 2) continue;
      if (Math.sin(time * 1.5 * g.speed + g.phase) < 0.2) continue;
      const u = ((g.u0 + time * s.flowSpeed * 5 * g.speed) % path.length + path.length) % path.length;
      const p = path.pts[Math.floor(u)];
      const cx = p.x - p.ty * g.side * p.hw, cy = p.y + p.tx * g.side * p.hw;
      for (let k = -1; k <= 1; k++) {
        const x = Math.round(cx + p.tx * k), y = Math.round(cy + p.ty * k);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (water[i]) write(frame, i, pal.glint);
      }
    }
  }

  // The water pixels (map indices, in drawing order) a ring of radius r around (x, y) touches (ry = 0.6 × r).
  function ripplePixels(world, x, y, r) {
    const { w, h, water } = world;
    const out = [];
    const steps = Math.max(8, Math.round(r * 7));
    let last = -1;
    for (let k = 0; k < steps; k++) {
      const a = k / steps * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r * 0.6);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const i = py * w + px;
      if (i === last || !water[i]) continue;
      last = i;
      out.push(i);
    }
    return out;
  }

  // A ring on the water (ry = 0.6 × r), blended in. Only water pixels are touched.
  function ripple(frame, world, x, y, r, alpha, c) {
    for (const i of ripplePixels(world, x, y, r)) {
      for (let ch = 0; ch < 3; ch++) frame[i * 4 + ch] += (c[ch] - frame[i * 4 + ch]) * alpha;
    }
  }

  return { draw, ripple, ripplePixels };
})();
