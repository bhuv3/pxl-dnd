// Glowing effect pieces that stay in place: impact bursts, rings, lightning, columns of light, the shield
// bubble, fading lights, and particle emitters. Each is an "active": update(dt) returns false when it's done;
// draw(c2d) draws it in screen space; light(world, night) adds its light.
const Shapes = (() => {
  // A map-pixel square (or a half-pixel one when size is 0.5) in screen space.
  function px(c2d, x, y, color, size = 1) {
    const z = Stage.cam.zoom, q = Stage.toScreen(Math.floor(x / size) * size, Math.floor(y / size) * size);
    c2d.fillStyle = Palette.css(color);
    c2d.fillRect(q.x, q.y, size * z, size * z);
  }

  // A pool of a type's light at a point, blocked by walls (dimmer in daylight, where it matters less).
  function lightAt(world, night, p, type, radius, power) {
    const color = Palette.light(type);
    if (!p || !color || power <= 0) return;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= world.w || y >= world.h) return;
    Fire.addLight(world, x, y, power * Math.max(night, 0.35), color, radius, Fire.sight(world, x, y, radius));
  }

  // A light at a fixed point that fades out (impact flashes, heals).
  function flare(o) {
    let t = 0;
    return {
      update(dt) { t += dt; return t < o.time; },
      draw() {},
      light(world, night) { lightAt(world, night, o.at, o.type, o.radius, (o.power || 1.4) * (1 - t / o.time) ** 1.5); },
    };
  }

  // Spawns particles over time: rising from a flattened ring round a point (o.radius), or shot out in a cone
  // (o.dir, o.cone, o.speed) like a fire breath.
  function emitter(o) {
    let t = 0, acc = 0;
    const rng = Random.makeRng(o.seed || 1);
    return {
      update(dt) {
        t += dt;
        acc += dt * o.rate;
        for (; acc >= 1; acc--) {
          const ang = rng() * Math.PI * 2, r = (o.radius || 0) * (0.4 + rng() * 0.6);
          Particles.burst(o.kind, o.at.x + Math.cos(ang) * r, o.at.y + Math.sin(ang) * r * 0.5, 1,
            { speed: o.speed ?? 4, dir: o.dir || [0, -1], cone: o.cone ?? 0.6, size: rng() < (o.big ?? 0) ? 2 : 1, type: o.type });
        }
        return t < o.time;
      },
      draw() {},
      light(world, night) {
        if (!o.lightRadius) return;
        const d = o.dir || [0, 0], reach = o.lightAhead || 0;
        lightAt(world, night, { x: o.at.x + d[0] * reach, y: o.at.y + d[1] * reach }, o.lightType || o.type, o.lightRadius, 1.3);
      },
    };
  }

  // A burst that swells and breaks up: a disc of the type's colors, hot in the middle, ragged at the edge.
  function pop(o) {
    let t = 0;
    const rng = Random.makeRng(o.seed || 3);
    return {
      update(dt) { t += dt; return t < o.time; },
      draw(c2d) {
        const k = t / o.time, R = o.radius * (0.5 + 0.5 * easeOut(Math.min(1, k * 2))), r = Palette.of(o.type).rgb;
        const Ri = Math.ceil(R);
        for (let dy = -Ri; dy <= Ri; dy++) {
          for (let dx = -Ri; dx <= Ri; dx++) {
            const d = Math.hypot(dx, dy * 1.2) / R + (rng() - 0.5) * 0.35;
            if (d > 1 || (k > 0.5 && rng() < (k - 0.5) * 1.6)) continue;
            const band = Math.max(0, Math.min(3, Math.floor(d * 2.2 + k * 2.2)));
            px(c2d, o.at.x + dx, o.at.y + dy, r[band]);
          }
        }
      },
      light() {},
    };
  }

  // An expanding ring on the floor (flattened: the floor is seen at a slant): a shockwave or a holy wave.
  // o: { at, r0, r1, time, type, thick }
  function ring(o) {
    let t = 0;
    return {
      update(dt) { t += dt; return t < o.time; },
      draw(c2d) {
        const k = t / o.time, R = o.r0 + (o.r1 - o.r0) * easeOut(k), ramp = Palette.of(o.type).rgb;
        const n = Math.ceil(R * 7);
        for (let i = 0; i < n; i++) {
          if (k > 0.55 && (i & 1)) continue;                       // breaks up as it fades
          const a = (i / n) * Math.PI * 2;
          for (let w = 0; w < (o.thick || 1); w++) {
            const r = R - w * 0.5;
            px(c2d, o.at.x + Math.cos(a) * r, o.at.y + Math.sin(a) * r * 0.6, ramp[Math.min(3, Math.floor(k * 3) + w)], 0.5);
          }
        }
      },
      light() {},
    };
  }

  // A jagged bolt of lightning from a point along a direction until a wall (or length), re-jagged every few
  // frames, with a few side forks. o: { from, dir [ux, uy], length, time, type, seed }
  function bolt(o) {
    let t = 0, path = [], forks = [];
    const rng = Random.makeRng(o.seed || 5), world = Stage.getWorld();
    let len = 0;
    while (len < o.length) {                                       // stops at the first wall
      const x = Math.round(o.from.x + o.dir[0] * len), y = Math.round(o.from.y + o.dir[1] * len + 6);
      if (x < 0 || y < 0 || x >= world.w || y >= world.h || Types.isWall(world.ground[y * world.w + x])) break;
      len += 2;
    }
    const jag = () => {
      const nx = -o.dir[1], ny = o.dir[0];
      path = [];
      for (let s = 0; s <= len; s += 4) {
        const off = s === 0 ? 0 : (rng() - 0.5) * 4;
        path.push({ x: o.from.x + o.dir[0] * s + nx * off, y: o.from.y + o.dir[1] * s + ny * off });
      }
      forks = [1, 2].map(() => {
        const p = path[1 + Math.floor(rng() * (path.length - 2))] || path[0], a = Math.atan2(o.dir[1], o.dir[0]) + (rng() - 0.5) * 2;
        return [p, { x: p.x + Math.cos(a) * 5, y: p.y + Math.sin(a) * 5 }];
      });
    };
    jag();
    let last = 0;
    return {
      length: len,
      update(dt) { t += dt; if (t - last > 0.04) { last = t; jag(); } return t < o.time; },
      draw(c2d) {
        if (t > o.time * 0.6 && (Math.floor(t * 30) & 1)) return;   // flickers out
        const ramp = Palette.of(o.type).rgb;
        for (let i = 1; i < path.length; i++) line(c2d, path[i - 1], path[i], ramp);
        for (const [a, b] of forks) line(c2d, a, b, ramp, true);
      },
      light(world, night) {
        for (const k of [0.25, 0.6, 0.95]) lightAt(world, night, { x: o.from.x + o.dir[0] * len * k, y: o.from.y + o.dir[1] * len * k + 6 }, o.type, 26, 1.4);
      },
    };
  }

  // A line of half-pixels with a glow either side (thin: the core only).
  function line(c2d, a, b, ramp, thin) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let i = 0; i <= n; i++) {
      const x = a.x + (b.x - a.x) * (i / n), y = a.y + (b.y - a.y) * (i / n);
      if (!thin) { px(c2d, x - 0.5, y, ramp[2], 0.5); px(c2d, x + 0.5, y, ramp[2], 0.5); px(c2d, x, y - 0.5, ramp[1], 0.5); }
      px(c2d, x, y, ramp[0], 0.5);
    }
  }

  // A column of light dropping onto a spot from above: grows down, holds, thins away. o: { at (feet), height, time, type }
  function column(o) {
    let t = 0;
    return {
      update(dt) { t += dt; return t < o.time; },
      draw(c2d) {
        const k = t / o.time, ramp = Palette.of(o.type).rgb, H = o.height || 28;
        const reach = Math.min(1, t / 0.08), top = o.at.y - H, bottom = top + H * reach;
        const half = k < 0.7 ? 1.5 : 1.5 * (1 - (k - 0.7) / 0.3);
        for (let y = top; y <= bottom; y += 0.5) {
          for (let x = -2; x <= 2; x += 0.5) {
            const d = Math.abs(x);
            if (d > half + 0.5) continue;
            const band = d < half * 0.35 ? 0 : d < half * 0.75 ? 1 : 2;
            if (band === 2 && ((x * 2 + y * 2) & 1)) continue;
            px(c2d, o.at.x + x, y, ramp[band], 0.5);
          }
        }
      },
      light(world, night) { lightAt(world, night, o.at, o.type, 22, 1.5 * (1 - t / o.time)); },
    };
  }

  // A hexagon of force round a figure: snaps on, flares when struck (struck() turns true), fades.
  // o: { fig, time, type, struck }
  function bubble(o) {
    let t = 0, hitAt = null;
    return {
      update(dt) { t += dt; if (hitAt === null && o.struck && o.struck()) hitAt = t; return t < o.time; },
      draw(c2d) {
        const f = o.fig, c = { x: f.x, y: f.y - 7 }, ramp = Palette.of(o.type).rgb;
        const k = t / o.time, flare = hitAt !== null && t - hitAt < 0.12;
        if (k > 0.7 && (Math.floor(t * 24) & 1)) return;
        const R = 8 * Math.min(1, t / 0.06), pts = [0, 1, 2, 3, 4, 5].map(i => ({ x: c.x + Math.cos(i * Math.PI / 3) * R, y: c.y + Math.sin(i * Math.PI / 3) * R * 1.1 }));
        for (let i = 0; i < 6; i++) line(c2d, pts[i], pts[(i + 1) % 6], flare ? [ramp[0], ramp[0], ramp[1]] : [ramp[1], ramp[2], ramp[2]], !flare);
        if (flare) for (const p of pts) px(c2d, p.x, p.y, ramp[0]);
      },
      light(world, night) { lightAt(world, night, { x: o.fig.x, y: o.fig.y }, o.type, 14, 0.8 * (1 - t / o.time)); },
    };
  }

  // A ball of fire that stays until the spell ends (Flaming Sphere): 5 ft across (10 px), a flickering disc a little off the
  // floor, shedding embers, with a glow round it and a wide warm light. o: { at() (where it is now: its feet on the floor), alive() }.
  function fireBall(o) {
    let t = 0, acc = 0;
    const rng = Random.makeRng(7), r = Palette.of('fire').rgb;
    return {
      update(dt) {
        t += dt;
        acc += dt * 18;
        const p = o.at();
        for (; acc >= 1; acc--) Particles.burst('ember', p.x + (rng() - 0.5) * 8, p.y - 5 - rng() * 4, 1, { speed: 9, dir: [0, -1], cone: 0.7, size: rng() < 0.3 ? 2 : 1, type: 'fire' });
        return o.alive();
      },
      draw(c2d) {
        const p = o.at(), cy = p.y - 5.5 + Math.sin(t * 5) * 0.5;
        Glow.draw(c2d, p.x, cy, 16, 'fire', 0.55, 0.9);
        for (let dy = -5; dy <= 5; dy++) {
          for (let dx = -5; dx <= 5; dx++) {
            const d = Math.hypot(dx, dy) / 5.2 + (rng() - 0.5) * 0.3;
            if (d > 1) continue;
            px(c2d, p.x + dx, cy + dy, r[Math.max(0, Math.min(3, Math.floor(d * 3.4)))]);
          }
        }
      },
      light(world, night) { const p = o.at(); lightAt(world, night, { x: p.x, y: p.y - 5 }, 'fire', 46, 1.25 + Math.sin(t * 9) * 0.1); },
    };
  }

  // A spectral hammer floating over a square (Spiritual Weapon), bobbing and glowing gold, until the spell ends.
  // o: { at() (its feet position), alive() }.
  function spectralWeapon(o) {
    let t = 0;
    const r = Palette.of('radiant').rgb, HAMMER = ['.###.', '#####', '.###.', '..#..', '..#..', '..#..', '..#..'];
    return {
      update(dt) { t += dt; if (Math.random() < dt * 6) { const p = o.at(); Particles.burst('mote', p.x, p.y - 6, 1, { speed: 4, dir: [0, -1], cone: 1, type: 'radiant' }); } return o.alive(); },
      draw(c2d) {
        const p = o.at(), top = p.y - 10 + Math.round(Math.sin(t * 3));
        c2d.globalAlpha = 0.85;
        HAMMER.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') px(c2d, p.x - 2 + x, top + y, r[y < 3 ? (x === 2 ? 0 : 1) : 2]); }));
        c2d.globalAlpha = 1;
      },
      light(world, night) { const p = o.at(); lightAt(world, night, { x: p.x, y: p.y - 6 }, 'radiant', 18, 1); },
    };
  }

  // Spirit Guardians: a ring of small gold spirits circling a figure 15 ft out, flickering, while the spell lasts.
  // o: { at() (the figure), alive() }.
  function guardians(o) {
    let t = 0;
    const r = Palette.of('radiant').rgb;
    return {
      update(dt) { t += dt; return o.alive(); },
      draw(c2d) {
        const f = o.at();
        for (let k = 0; k < 9; k++) {
          const a = t * 0.9 + k * Math.PI * 2 / 9, x = f.x + Math.cos(a) * 26, y = f.y - 3 + Math.sin(a) * 13 + Math.sin(t * 4 + k) * 1.5;
          c2d.globalAlpha = 0.55 + 0.35 * Math.sin(t * 6 + k * 2);
          px(c2d, x, y, r[1]); px(c2d, x, y - 1, r[0]); px(c2d, x - Math.cos(a + 1.6), y - Math.sin(a + 1.6) * 0.5, r[2]);
        }
        c2d.globalAlpha = 1;
      },
      light(world, night) { const f = o.at(); lightAt(world, night, { x: f.x, y: f.y - 3 }, 'radiant', 32, 0.7); },
    };
  }

  function easeOut(k) { return 1 - (1 - k) ** 3; }

  return { px, lightAt, flare, emitter, pop, ring, bolt, column, bubble, fireBall, spectralWeapon, guardians, line, easeOut };
})();
