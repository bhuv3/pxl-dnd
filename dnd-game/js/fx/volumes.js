// The areas of spells at their true size, drawn as glowing pixels (10 map pixels = 5 ft): a sphere (a blast on the floor,
// radius in map pixels), a cone, a cube and a line. Each is an "active" (see Shapes) and takes its colors from a Palette type.
const Volumes = (() => {
  // A repeatable random 0–1 for a cell and a frame, so a flame flickers the same way every time.
  function h2(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 144665)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // The ramp band (0 = white-hot … 3 = ember red) for a heat from 0 to 1, or -1 when too cold to show.
  function band(heat) { return heat > 0.78 ? 0 : heat > 0.52 ? 1 : heat > 0.28 ? 2 : heat > 0.1 ? 3 : -1; }

  // A sphere on the floor: a swelling fireball of ragged flame with a bright shock rim and tongues of fire rising from it.
  // o: { at (its centre on the floor), radius, time, type, seed, light, soft (0–1: a calm dome of light, for healing and
  //      holy areas, with no flames and only that share of the brightness) }
  function sphere(o) {
    let t = 0;
    const r = Palette.of(o.type).rgb, seed = o.seed || 1;
    return {
      update(dt) { t += dt; return t < o.time; },
      draw(c2d) {
        const k = t / o.time, grow = Shapes.easeOut(Math.min(1, k * 4)), R = o.radius * (0.2 + 0.8 * grow), fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
        const calm = o.soft ?? 1;
        Glow.draw(c2d, o.at.x, o.at.y - 2, R * 1.25, o.type, 0.5 * fade * calm, 0.6);
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        c2d.globalAlpha = 0.6 * fade * calm;
        floorBody(c2d, o.at, R, k, r, Math.floor(t * 24), seed);
        c2d.globalAlpha = fade * Math.max(0.35, calm);
        rim(c2d, o.at, R, k, r);
        if (!o.soft) tongues(c2d, o.at, o.radius, grow, k, r, seed);
        c2d.restore();
      },
      light(world, night) {
        const p = { x: o.at.x, y: o.at.y - 4 }, k = t / o.time;
        Shapes.lightAt(world, night, p, o.type, o.radius * 1.5, (o.light ?? 1.7) * (k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7));
      },
    };
  }

  // The flickering heat inside the blast, hottest at the centre and cooling as the blast ages (the floor is seen at a slant: 0.6).
  function floorBody(c2d, at, R, k, r, frame, seed) {
    const Ri = Math.ceil(R), Rv = Math.ceil(R * 0.6);
    for (let dy = -Rv; dy <= Rv; dy++) {
      for (let dx = -Ri; dx <= Ri; dx++) {
        const d = Math.hypot(dx / R, dy / (R * 0.6));
        if (d > 1) continue;
        const b = band((1 - d * d) * (0.85 - k * 0.6) + (h2(dx, dy, frame + seed) - 0.5) * 0.7 - d * 0.15);
        if (b >= 0) Shapes.px(c2d, at.x + dx, at.y + dy, r[b]);
      }
    }
  }

  // A bright thin ring at the edge of the blast, brightest while the blast is young.
  function rim(c2d, at, R, k, r) {
    const n = Math.ceil(R * 6);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      Shapes.px(c2d, at.x + Math.cos(a) * R, at.y + Math.sin(a) * R * 0.6, r[k < 0.35 ? 0 : 1], 0.5);
    }
  }

  // Tongues of flame rising out of the blast and shrinking as it dies.
  function tongues(c2d, at, radius, grow, k, r, seed) {
    for (let i = 0; i < 22; i++) {
      const x = at.x + (h2(i, 1, seed) - 0.5) * 2 * radius * 0.8 * grow, y = at.y + (h2(i, 2, seed) - 0.5) * radius * 0.7 * grow;
      const flick = 0.75 + 0.25 * Math.sin(k * 40 + i * 2.3), H = (7 + 15 * h2(i, 3, seed)) * Math.sin(Math.min(1, k * 1.6) * Math.PI) * flick;
      for (let h = 0; h < H; h += 1) {
        const w = Math.max(0, (1 - h / H) * 1.5);
        Shapes.px(c2d, x - w / 2, y - h, r[h < H * 0.3 ? 1 : h < H * 0.65 ? 2 : 3], Math.max(0.5, w > 1 ? 1 : 0.5));
      }
    }
  }

  // A cone of flame from a point along a direction (its width at the far end equals its length, as in the 2024 rules).
  // o: { from, dir [ux, uy], length, time, type, seed }
  function cone(o) {
    let t = 0;
    const r = Palette.of(o.type).rgb, seed = o.seed || 1, nx = -o.dir[1], ny = o.dir[0];
    return {
      update(dt) { t += dt; return t < o.time; },
      draw(c2d) {
        const k = t / o.time, reach = o.length * Shapes.easeOut(Math.min(1, k * 4)), fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5, frame = Math.floor(t * 28);
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        c2d.globalAlpha = 0.8 * fade;
        for (let u = 0; u <= reach; u++) {
          const half = u / 2 * (0.9 + 0.1 * Math.sin(u * 0.5 + t * 20));
          for (let v = -half; v <= half; v++) {
            const edge = Math.abs(v) / (half || 1), along = u / o.length;
            const heat = (1 - along * 0.7) * (1 - edge * 0.8) + (h2(Math.round(u), Math.round(v), frame + seed) - 0.5) * 0.7;
            const b = band(heat);
            if (b >= 0) Shapes.px(c2d, o.from.x + o.dir[0] * u + nx * v, o.from.y + o.dir[1] * u + ny * v, r[b]);
          }
        }
        c2d.restore();
        const tip = { x: o.from.x + o.dir[0] * reach * 0.6, y: o.from.y + o.dir[1] * reach * 0.6 };
        Glow.draw(c2d, tip.x, tip.y, Math.max(8, reach * 0.55), o.type, 0.7 * fade);
      },
      light(world, night) {
        const k = t / o.time, f = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
        for (const q of [0.3, 0.7]) Shapes.lightAt(world, night, { x: o.from.x + o.dir[0] * o.length * q, y: o.from.y + o.dir[1] * o.length * q }, o.type, o.length * 0.6, 1.3 * f);
      },
    };
  }

  // A cube on the floor (the floor is seen at a slant, so its top is a squashed square): the edge lights up first, then the
  // fill, with motes rising. o: { at (its centre), size, time, type, seed }
  function cube(o) {
    let t = 0;
    const r = Palette.of(o.type).rgb, seed = o.seed || 1;
    return {
      update(dt) { t += dt; if (t < o.time * 0.8) Particles.burst('mote', o.at.x + (h2(Math.floor(t * 90), 1, seed) - 0.5) * o.size, o.at.y + (h2(Math.floor(t * 90), 2, seed) - 0.5) * o.size * 0.6, 1, { speed: 8, dir: [0, -1], cone: 0.5, type: o.type }); return t < o.time; },
      draw(c2d) {
        const k = t / o.time, fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5, half = o.size / 2, frame = Math.floor(t * 20);
        Glow.draw(c2d, o.at.x, o.at.y, o.size * 0.85, o.type, 0.6 * fade, 0.6);
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        c2d.globalAlpha = fade;
        for (let dy = -half * 0.6; dy <= half * 0.6; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const edge = Math.max(Math.abs(dx) / half, Math.abs(dy) / (half * 0.6)) > 0.93;
            if (edge) Shapes.px(c2d, o.at.x + dx, o.at.y + dy, r[(Math.floor(dx + dy + t * 14) & 3) === 0 ? 0 : 1], 0.5);
            else if (h2(Math.round(dx), Math.round(dy), frame + seed) < 0.3) Shapes.px(c2d, o.at.x + dx, o.at.y + dy, r[2], 0.5);
          }
        }
        c2d.restore();
      },
      light(world, night) { Shapes.lightAt(world, night, o.at, o.type, o.size, 1.1 * (1 - t / o.time)); },
    };
  }

  // A beam along a line (width across, length along): a bright core with a glow either side and halos along it.
  // o: { from, dir [ux, uy], length, width, time, type }
  function line(o) {
    let t = 0;
    const r = Palette.of(o.type).rgb, nx = -o.dir[1], ny = o.dir[0], half = o.width / 2;
    return {
      update(dt) { t += dt; return t < o.time; },
      draw(c2d) {
        const k = t / o.time, reach = o.length * Shapes.easeOut(Math.min(1, k * 8)), fade = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7, frame = Math.floor(t * 30);
        for (let u = 6; u < reach; u += 14) Glow.draw(c2d, o.from.x + o.dir[0] * u, o.from.y + o.dir[1] * u, 12, o.type, 0.4 * fade);
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        c2d.globalAlpha = fade;
        for (let u = 0; u <= reach; u++) {
          for (let v = -half; v <= half; v++) {
            const d = Math.abs(v) / half, b = d < 0.3 ? 0 : d < 0.65 ? 1 : 2;
            if (b === 2 && h2(u, Math.round(v), frame) < 0.5) continue;
            Shapes.px(c2d, o.from.x + o.dir[0] * u + nx * v, o.from.y + o.dir[1] * u + ny * v, r[b], 0.5);
          }
        }
        c2d.restore();
      },
      light(world, night) { for (const q of [0.2, 0.5, 0.8]) Shapes.lightAt(world, night, { x: o.from.x + o.dir[0] * o.length * q, y: o.from.y + o.dir[1] * o.length * q }, o.type, 24, 1.3 * (1 - t / o.time)); },
    };
  }

  return { sphere, cone, cube, line, h2 };
})();
