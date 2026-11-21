// Small creatures: butterflies, birds and gulls by day, fireflies at night, fish jumping any time.
// Butterflies, birds, gulls and fireflies hide in rain or snow.
const Life = (() => {
  const { GROUND, SCATTER } = Types;
  const BODY = [45, 35, 35];
  const GULL = [240, 240, 234], GULL_TIP = [86, 90, 100];

  // Picks home spots and flight paths. Runs on rebuild.
  function place(world, s) {
    world.life = {
      butterflies: placeButterflies(world, s.butterflies),
      flocks: placeFlocks(world, s.birds),
      fireflies: placeFireflies(world, s.fireflies),
      fish: placeFish(world, s.fish),
      gulls: placeGulls(world, s.gulls || 0),
    };
  }

  // Random land spots that pass a test, up to count.
  function pick(world, count, salt, test) {
    const { w, h } = world;
    const out = [];
    for (let k = 0; k < count * 40 && out.length < count; k++) {
      const x = Math.floor(Random.hash(k + salt, 1) * w), y = Math.floor(Random.hash(k + salt, 2) * h);
      if (world.water[y * w + x] || !test(x, y, y * w + x)) continue;
      out.push({ x, y, ph: Random.hash(k + salt, 3) * Math.PI * 2, speed: 0.6 + Random.hash(k + salt, 4) * 0.8, color: Math.floor(Random.hash(k + salt, 5) * 4) });
    }
    return out;
  }

  // Butterflies live over grass, near flower patches when possible.
  function placeButterflies(world, count) {
    return pick(world, count, 7000, (x, y, i) =>
      (world.ground[i] === GROUND.GRASS || world.scatter[i] === SCATTER.FLOWERS) &&
      (world.scatter[i] === SCATTER.FLOWERS || Random.noise(x, y, 20, 1300) > 0.42));
  }

  // Fireflies gather over grass, forests, and near fresh water.
  function placeFireflies(world, count) {
    return pick(world, count, 9000, (x, y, i) =>
      world.ground[i] === GROUND.GRASS || world.scatter[i] || world.freshDist[i] < 15);
  }

  // Flocks of 3–5 birds that cross the map.
  function placeFlocks(world, count) {
    const out = [];
    for (let k = 0; k < count; k++) {
      out.push({
        x0: Random.hash(k, 8101) * world.w,
        y0: 10 + Random.hash(k, 8102) * (world.h - 20),
        dir: Random.hash(k, 8103) < 0.5 ? 1 : -1,
        speed: 8 + Random.hash(k, 8104) * 8,
        n: 3 + Math.floor(Random.hash(k, 8105) * 3),
        ph: Random.hash(k, 8106) * Math.PI * 2,
      });
    }
    return out;
  }

  // Gulls circle over the water near the shore (any water if there's no sea). Each has a middle, a radius and a pace.
  function placeGulls(world, count) {
    const { w, h } = world, out = [];
    const sea = world.seaDist.some(d => d === 0);
    for (let k = 0; k < count * 60 && out.length < count; k++) {
      const x = Math.floor(Random.hash(k, 9201) * w), y = Math.floor(Random.hash(k, 9202) * h), i = y * w + x;
      const near = sea ? world.seaDist[i] < 4 : world.water[i];
      if (!near || world.landDist[i] > 30) continue;
      out.push({ x, y, r: 10 + Random.hash(k, 9203) * 22, speed: (0.25 + Random.hash(k, 9204) * 0.3) * (Random.hash(k, 9205) < 0.5 ? 1 : -1), ph: Random.hash(k, 9206) * Math.PI * 2 });
    }
    return out;
  }

  // Fish jump slots, plus open-water spots they can jump from (3+ pixels from the shore).
  function placeFish(world, count) {
    const { w, h } = world;
    const spots = [];
    for (let k = 0; k < 4000 && spots.length < 300; k++) {
      const x = Math.floor(Random.hash(k, 9101) * w), y = Math.floor(Random.hash(k, 9102) * h);
      const i = y * w + x;
      if (world.water[i] && world.waterDist[i] >= 3 && !(i >= w && world.deck[i - w]) && !nearSpan(world, x, y)) spots.push([x, y]);
    }
    return { count: spots.length ? count : 0, spots };
  }

  // True if a bridge is within 3 pixels (fish don't jump under it).
  function nearSpan(world, x, y) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < world.w && ny < world.h && world.span[ny * world.w + nx]) return true;
      }
    }
    return false;
  }

  // Pixel helpers for the frame. ripple (rings on the water) needs the world, so only draw passes one.
  function makeWriters(frame, w, h, world) {
    const idx = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : (y * w + x) * 4);
    return {
      ripple(x, y, r, a, c) { Water.ripple(frame, world, x, y, r, a, c); },
      put(x, y, c) { const i = idx(x, y); if (i >= 0) { frame[i] = c[0]; frame[i + 1] = c[1]; frame[i + 2] = c[2]; } },
      shade(x, y, f) { const i = idx(x, y); if (i >= 0) { frame[i] *= f; frame[i + 1] *= f; frame[i + 2] *= f; } },
      blend(x, y, c, a) {
        const i = idx(x, y);
        if (i < 0) return;
        for (let k = 0; k < 3; k++) frame[i + k] += (c[k] - frame[i + k]) * a;
      },
    };
  }

  // How much of the daytime life is out: 1 by day, 0 at night.
  function dayAmount(dark) { return Math.max(0, Math.min(1, (0.35 - dark) / 0.15)); }

  // Draws butterflies and birds (before the tint).
  function draw(frame, world, s, pal, time, dark) {
    if (world.life) drawWith(makeWriters(frame, world.w, world.h, world), world, s, pal, time, dark);
  }

  // The drawing itself, through any pixel writers (put, shade, blend, ripple): the frame's, or the GL pass's recorder.
  function drawWith(px, world, s, pal, time, dark) {
    drawFish(px, world, pal, time);
    const day = dayAmount(dark);
    if (day <= 0 || Weather.isWet(s)) return;
    const bf = world.life.butterflies;
    bf.forEach((b, k) => { if (k / bf.length < day) drawButterfly(px, b, pal, time); });
    world.life.flocks.forEach((f, k) => { if (k / world.life.flocks.length < day) drawFlock(px, f, world.w, pal, time); });
    const gulls = world.life.gulls || [];
    gulls.forEach((g, k) => { if (k / gulls.length < day) drawGull(px, g, time); });
  }

  // A gull gliding round in a wide loop, wings out, now and then flapping, its shadow far below.
  function drawGull(px, g, time) {
    const a = time * g.speed + g.ph;
    const x = Math.round(g.x + Math.cos(a) * g.r), y = Math.round(g.y + Math.sin(a) * g.r * 0.6 + Math.sin(time * 0.4 + g.ph) * 3);
    for (let d = -1; d <= 1; d++) px.shade(x + 8 + d, y + 14, 0.8);
    const up = Math.sin(time * 6 + g.ph * 5) > 0.75 ? 1 : 0;
    px.put(x, y, GULL);
    px.put(x - 1, y - 1, GULL); px.put(x + 1, y - 1, GULL);
    px.put(x - 2, y - up, GULL_TIP); px.put(x + 2, y - up, GULL_TIP);
  }

  // A butterfly drifting around its home spot, flapping between two frames.
  function drawButterfly(px, b, pal, time) {
    const t = time * b.speed;
    const x = Math.round(b.x + Math.sin(t * 0.7 + b.ph) * 6 + (Random.valueNoise(t * 0.4 + b.ph * 7, 0.5, 310) - 0.5) * 16);
    const y = Math.round(b.y + Math.cos(t * 0.5 + b.ph * 1.3) * 4 + (Random.valueNoise(0.5, t * 0.4 + b.ph * 5, 311) - 0.5) * 10);
    const c = [pal.butterfly, pal.flower1, pal.flower2, pal.flower3][b.color];
    px.shade(x, y + 3, 0.7);
    if (Math.floor(time * 7 * b.speed + b.ph * 3) % 2) {
      px.put(x - 1, y, c); px.put(x + 1, y, c); px.put(x, y, BODY);
    } else {
      px.put(x, y - 1, c); px.put(x, y, BODY);
    }
  }

  // A loose V of birds crossing the map, with shadows far below.
  function drawFlock(px, f, w, pal, time) {
    const travel = w + 80;
    const fx = ((f.x0 + time * f.speed * f.dir) % travel + travel) % travel - 40;
    const fy = f.y0 + Math.sin(time * 0.3 + f.ph) * 6;
    for (let k = 0; k < f.n; k++) {
      const rank = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
      const x = Math.round(fx - f.dir * rank * 4), y = Math.round(fy + side * rank * 3);
      for (let d = -1; d <= 1; d++) px.shade(x + 10 + d, y + 18, 0.75);
      if (Math.floor(time * 5 + k * 0.7 + f.ph) % 2) {
        px.put(x - 1, y - 1, pal.bird); px.put(x + 1, y - 1, pal.bird); px.put(x, y, pal.bird);
      } else {
        px.put(x - 1, y, pal.bird); px.put(x, y, pal.bird); px.put(x + 1, y, pal.bird);
        px.put(x - 2, y + 1, pal.bird); px.put(x + 2, y + 1, pal.bird);
      }
    }
  }

  // Each slot loops on its own period: a jump along an arc, splashes, then a spreading ripple.
  function drawFish(px, world, pal, time) {
    const { count, spots } = world.life.fish;
    const tail = pal.fish.map(v => v * 0.6);
    for (let k = 0; k < count; k++) {
      const period = 6 + Random.hash(k, 9201) * 6;
      const t = time / period + Random.hash(k, 9202);
      const loop = Math.floor(t), u = (t - loop) * period;
      if (u > 2.4) continue;
      const [sx, sy] = spots[Math.floor(Random.hash(k, loop + 9203) * spots.length)];
      const dir = Random.hash(k, loop + 9204) < 0.5 ? -1 : 1;
      const lx = sx + dir * 2;
      if (u < 1) px.ripple(sx - dir * 2, sy, 1 + u * 3, (1 - u) * 0.4, pal.foam);
      if (u < 0.8) {
        const p = u / 0.8;
        const x = Math.round(sx + dir * (p * 4 - 2)), y = Math.round(sy - Math.sin(p * Math.PI) * 4);
        px.put(x, y, pal.fish);
        px.put(x - dir, y + (p < 0.5 ? 1 : p > 0.6 ? -1 : 0), tail);
        if (u < 0.15) { px.blend(sx - dir * 2 - 1, sy, pal.foam, 0.9); px.blend(sx - dir * 2 + 1, sy, pal.foam, 0.9); }
      } else {
        const v = (u - 0.8) / 1.6;
        if (v < 0.12) {
          px.blend(lx - 1, sy, pal.foam, 1); px.blend(lx + 1, sy, pal.foam, 1); px.blend(lx, sy - 1, pal.foam, 1);
        }
        px.ripple(lx, sy, 1 + v * 5, (1 - v) * 0.7, pal.foam);
      }
    }
  }

  // Fireflies: drawn after the tint at full brightness, with a soft glow around them.
  function drawGlow(frame, world, s, pal, time, dark) {
    if (!world.life) return;
    const night = Math.max(0, Math.min(1, (dark - 0.25) / 0.2));
    if (night <= 0 || Weather.isWet(s)) return;
    const px = makeWriters(frame, world.w, world.h);
    const list = world.life.fireflies;
    list.forEach((f, k) => {
      if (k / list.length >= night) return;
      const blink = Math.sin(time * 2.2 * f.speed + f.ph);
      if (blink < 0.1) return;
      const a = Math.min(1, (blink - 0.1) / 0.5);
      const t = time * f.speed;
      const x = Math.round(f.x + Math.sin(t * 0.5 + f.ph) * 5 + (Random.valueNoise(t * 0.3 + f.ph * 4, 1.5, 320) - 0.5) * 8);
      const y = Math.round(f.y + Math.cos(t * 0.4 + f.ph * 2) * 3 + (Random.valueNoise(1.5, t * 0.3 + f.ph * 4, 321) - 0.5) * 6);
      px.blend(x, y, pal.firefly, a);
      px.blend(x - 1, y, pal.firefly, a * 0.35); px.blend(x + 1, y, pal.firefly, a * 0.35);
      px.blend(x, y - 1, pal.firefly, a * 0.35); px.blend(x, y + 1, pal.firefly, a * 0.35);
    });
  }

  return { place, draw, drawWith, drawGlow };
})();
