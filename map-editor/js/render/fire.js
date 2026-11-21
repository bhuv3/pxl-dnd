// Flames of campfires, braziers, torches, candles, and lanterns, smoke, and warm light at night or underground.
// Light stops at walls: each light keeps a mask of the pixels it can see.
const Fire = (() => {
  const PUFFS = 6;
  const SMOKE_LIFE = 3.2;   // seconds for a puff to rise and fade
  const SMOKE_RISE = 14;
  const WARM = [1.4, 0.98, 0.62];
  // radius: light reach; flame: 4 a campfire's, 3 big, 2 torch, 1 candle; smoke: puff strength (0 = none); flicker: light wobble.
  const KINDS = {
    campfire: { radius: 38, flame: 4, smoke: 0.7, flicker: 0.1 },
    brazier: { radius: 34, flame: 4, smoke: 0.45, flicker: 0.1 },
    torch: { radius: 30, flame: 3, smoke: 0, flicker: 0.12 },
    candle: { radius: 10, flame: 1, smoke: 0, flicker: 0.1 },
    lantern: { radius: 34, flame: 1, smoke: 0, flicker: 0.05 },
  };
  const WALL_SEARCH = 6;    // a light on a wall shines from the first open pixel below it
  let light = null;         // this frame's light buffer (beginLights)
  let record = null;        // GL backend: while set, lights and flame pixels are noted here instead of drawn (collect)

  // Pixel index into the frame, or -1 when outside the map.
  function idx(world, x, y) {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= world.w || y >= world.h ? -1 : (y * world.w + x) * 4;
  }

  // A fire, chimney, or window where it's drawn: raised ground shifts it up by its lift.
  function shown(f) { return f.lift ? { ...f, y: f.y - f.lift } : f; }

  function blend(frame, i, c, a) {
    if (i < 0) return;
    if (record) { const p = i >> 2; record.points.push(p % record.w, (p / record.w) | 0, c[0], c[1], c[2], a); return; }
    for (let k = 0; k < 3; k++) frame[i + k] += (c[k] - frame[i + k]) * a;
  }

  // Smoke, drawn before the daylight tint so it darkens at night like everything else.
  function draw(frame, world, s, pal, time) {
    if (!s.smoke || !world.fires) return;
    world.fires.forEach(f => { const k = KINDS[f.kind]; if (k.smoke) drawSmoke(frame, world, s, pal, time, shown(f), k.smoke); });
    world.chimneys.forEach(c => drawSmoke(frame, world, s, pal, time, shown(c), 0.85));
  }

  // A loop of puffs that rise, drift with the wind, grow, and fade.
  function drawSmoke(frame, world, s, pal, time, src, strength) {
    const wind = s.wind ? 0.4 + s.windStrength : 0.3;
    for (let j = 0; j < PUFFS; j++) {
      const age = ((time + j * SMOKE_LIFE / PUFFS + src.key * 0.01) % SMOKE_LIFE) / SMOKE_LIFE;
      const x = src.x + age * age * 6 * wind + Math.sin(age * 7 + src.key + j) * 0.8;
      const y = src.y - 1 - age * SMOKE_RISE;
      const a = (1 - age * age) * strength;
      blend(frame, idx(world, x, y), pal.smoke, a);
      if (age > 0.2) {
        const b = a * 0.6;
        blend(frame, idx(world, x - 1, y), pal.smoke, b);
        blend(frame, idx(world, x + 1, y), pal.smoke, b);
        blend(frame, idx(world, x, y - 1), pal.smoke, b);
      }
    }
  }

  // Runs fn with lights and blended pixels recorded instead of drawn (for the GL backend, which draws them itself).
  // Returns { lights: [{ x, y, visY, power, color, radius }], points: [x, y, r, g, b, a, ...] }. visY is the row the
  // light's line of sight is measured from (null: the light isn't blocked by walls).
  function collect(world, fn) {
    record = { w: world.w, lights: [], points: [] };
    try { fn(); return record; } finally { record = null; }
  }

  // 0 by day, 1 at night or underground: how strongly lights shine.
  function nightOf(dark) { return Math.max(0, Math.min(1, (dark - 0.15) / 0.3)); }

  // Clears the light buffer for a new frame. Lights add to it; applyLights brightens the frame once.
  function beginLights(world) {
    const n = world.w * world.h;
    if (!light || light.amount.length !== n) light = { amount: new Float32Array(n), color: new Float32Array(n * 3), weight: new Float32Array(n), touched: [] };
    for (const i of light.touched) { light.amount[i] = 0; light.weight[i] = 0; light.color[i * 3] = light.color[i * 3 + 1] = light.color[i * 3 + 2] = 0; }
    light.touched = [];
  }

  // Every fire, torch, and candle adds its light (they flicker a little).
  function addLights(world, time, dark) {
    const night = nightOf(dark);
    if (!world.fires || night <= 0) return;
    const tick = Math.floor(time * 10);
    world.fires.forEach((f, k) => {
      const kind = KINDS[f.kind];
      const power = night * (1 - kind.flicker + kind.flicker * Random.hash(tick, k + 400));
      if (record) { noteLight(f.x, f.y - (f.lift || 0), f.y, power, WARM, kind.radius); return; }
      if (!f.vis) f.vis = visibility(world, f.x, f.y, kind.radius);
      addLight(world, f.x, f.y - (f.lift || 0), power, WARM, kind.radius, f.vis);
    });
  }

  // Notes a light for the GL backend. visY: the row its line of sight starts from (null: not blocked by walls).
  function noteLight(x, y, visY, power, color, radius) { record.lights.push({ x, y, visY, power, color, radius }); }

  // Line of sight for a light at (x, y): what addLight wants as vis. The GL backend works it out on the GPU, so while
  // recording this is just true.
  function sight(world, x, y, radius) { return record ? true : visibility(world, x, y, radius); }

  // Adds a pool of light around (fx, fy). Overlapping lights combine instead of stacking.
  // vis (optional, from visibility or sight) keeps the light from passing through walls.
  function addLight(world, fx, fy, power, color, radius, vis) {
    if (record) { noteLight(fx, fy, vis ? fy : null, power, color, radius); return; }
    const { w, h } = world;
    const R = radius * (0.9 + power * 0.1), Ri = Math.ceil(R);
    for (let dy = -Ri; dy <= Ri; dy++) {
      for (let dx = -Ri; dx <= Ri; dx++) {
        const x = fx + dx, y = fy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const d = Math.hypot(dx, dy * 1.4) / R;
        if (d >= 1) continue;
        if (vis && (Math.abs(dx) > vis.R || Math.abs(dy) > vis.R || !vis.mask[(dy + vis.R) * vis.n + dx + vis.R])) continue;
        const a = (1 - d) ** 1.5 * power, i = y * w + x;
        if (!light.weight[i]) light.touched.push(i);
        light.amount[i] += a * (1 - light.amount[i]);
        light.weight[i] += a;
        for (let k = 0; k < 3; k++) light.color[i * 3 + k] += color[k] * a;
      }
    }
  }

  // Undoes the tint where light fell and colors it, in a few flat steps (pixel-art bands).
  function applyLights(frame, world, tint) {
    const { w } = world;
    for (const i of light.touched) {
      const dither = ((i % w + ((i / w) | 0)) & 1) ? 0.04 : -0.04;
      const v = light.amount[i] + dither;
      const a = v > 0.45 ? 0.9 : v > 0.2 ? 0.6 : v > 0.07 ? 0.3 : 0;
      if (!a) continue;
      const p = i * 4, wt = light.weight[i];
      for (let k = 0; k < 3; k++) {
        const lit = Math.min(255, frame[p + k] / tint[k] * light.color[i * 3 + k] / wt);
        frame[p + k] += (lit - frame[p + k]) * a;
      }
    }
  }

  // After the light: flames at full brightness, and lit windows.
  function drawGlow(frame, world, pal, time, dark) {
    if (!world.fires) return;
    const tick = Math.floor(time * 10);
    world.fires.forEach((f, k) => {
      const kind = KINDS[f.kind];
      if (kind.flame >= 3) drawFlames(frame, world, pal, shown(f), tick, k, kind.flame === 4);
      else drawSmallFlame(frame, world, pal, shown(f), tick, k, kind.flame);
    });
    const night = nightOf(dark);
    if (night > 0) drawWindows(frame, world, pal, night);
  }

  // Which pixels within radius a light at (fx, fy) can reach: rays stop at the first wall pixel (which is lit).
  function visibility(world, fx, fy, radius) {
    const { w, h, ground } = world;
    const R = Math.ceil(radius) + 1, n = R * 2 + 1;
    const wall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || Types.isWall(ground[y * w + x]);
    let ox = Math.round(fx), oy = Math.round(fy);
    for (let k = 0; k < WALL_SEARCH && wall(ox, oy); k++) oy++;
    const mask = new Uint8Array(n * n);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const tx = Math.round(fx) + dx, ty = Math.round(fy) + dy;
        const steps = Math.max(Math.abs(tx - ox), Math.abs(ty - oy));
        let open = true;
        for (let j = 1; j < steps && open; j++) {
          if (wall(Math.round(ox + (tx - ox) * j / steps), Math.round(oy + (ty - oy) * j / steps))) open = false;
        }
        if (open) mask[(dy + R) * n + dx + R] = 1;
      }
    }
    return { R, n, mask };
  }

  // A torch flame (a flickering core and tip, 2–3 pixels) or a candle flame (one pixel that flickers).
  function drawSmallFlame(frame, world, pal, f, tick, k, size) {
    const r = Random.hash(tick, k + 650);
    if (size === 1) { blend(frame, idx(world, f.x, f.y - 1), r < 0.7 ? pal.fire1 : pal.fire2, 1); return; }
    const height = 2 + (r < 0.5 ? 1 : 0);
    const lean = Random.hash(tick, k + 660) < 0.3 ? (Random.hash(tick, k + 670) < 0.5 ? -1 : 1) : 0;
    for (let j = 0; j < height; j++) {
      const col = j === 0 ? pal.fire1 : j === height - 1 ? pal.fire3 : pal.fire2;
      blend(frame, idx(world, f.x + (j === height - 1 ? lean : 0), f.y - 1 - j), col, 1);
    }
    if (r > 0.6) blend(frame, idx(world, f.x + (r > 0.8 ? -1 : 1), f.y - 1), pal.fire2, 0.8);
  }

  // Three flickering flame columns (five, and taller, for a campfire): a bright core, orange body, red tips, and the odd spark.
  function drawFlames(frame, world, pal, f, tick, k, wide) {
    const h = wide ? c => (c === 0 ? 5 : Math.abs(c) === 1 ? 3 : 1) + Math.floor(Random.hash(tick + c * 31, k + 500) * (c === 0 ? 4 : 3))
      : c => (c === 0 ? 3 : 1) + Math.floor(Random.hash(tick + c * 31, k + 500) * (c === 0 ? 3 : 2));
    for (const c of wide ? [-2, -1, 0, 1, 2] : [-1, 0, 1]) {
      const height = h(c);
      for (let j = 0; j < height; j++) {
        const t = j / Math.max(1, height - 1);
        const col = c === 0 && t < 0.4 ? pal.fire1 : t < 0.7 ? pal.fire2 : pal.fire3;
        const sway = j === height - 1 && Random.hash(tick, k + c + 600) < 0.4 ? (Random.hash(tick, k + 700) < 0.5 ? -1 : 1) : 0;
        blend(frame, idx(world, f.x + c + sway, f.y - j), col, 1);
      }
    }
    const spark = (tick % 7) / 7;
    if (Random.hash(Math.floor(tick / 7), k + 800) < 0.6) {
      blend(frame, idx(world, f.x + Math.round(Math.sin(tick + k) * 1.5), f.y - (wide ? 9 : 5) - spark * 6), pal.fire1, 1 - spark);
    }
  }

  // Window pixels glow warm. More windows light up as it gets darker.
  function drawWindows(frame, world, pal, night) {
    for (const w of world.windows) {
      const wn = shown(w);
      if (Random.hash(wn.key, 901) > night * 1.15) continue;
      blend(frame, idx(world, wn.x, wn.y), pal.windowLit, 1);
      blend(frame, idx(world, wn.x, wn.y + 2), pal.windowLit, 0.18 * night);
    }
  }

  return { draw, beginLights, addLights, addLight, applyLights, drawGlow, visibility, sight, collect, nightOf, WARM, WALL_SEARCH };
})();
