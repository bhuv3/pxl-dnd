// Branching lightning: a crooked main stroke from one point to another with forks off it, re-rolled every few frames so it
// crawls, drawn additively (a wide faint glow, a coloured body, a white core) with halos where it starts and ends.
const Arcs = (() => {
  // How far a straight line from a point goes before a wall (or max), in map pixels. The line is taken at chest height.
  function reach(from, dir, max) {
    const world = Stage.getWorld();
    let len = 0;
    while (len < max) {
      const x = Math.round(from.x + dir[0] * len), y = Math.round(from.y + dir[1] * len + 6);
      if (x < 0 || y < 0 || x >= world.w || y >= world.h || Types.isWall(world.ground[y * world.w + x])) break;
      len += 2;
    }
    return len;
  }

  // The points of a crooked stroke from a to b, by repeatedly nudging the middle sideways.
  function stroke(a, b, spread, rng, out) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 3) { out.push(b); return; }
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len, off = (rng() - 0.5) * spread;
    const m = { x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off };
    stroke(a, m, spread * 0.55, rng, out);
    stroke(m, b, spread * 0.55, rng, out);
  }

  // The main stroke and its forks, rolled afresh. Returns a list of { pts, thin }.
  function roll(o, rng) {
    const main = [o.from];
    stroke(o.from, o.to, Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y) * (o.jag ?? 0.3), rng, main);
    const out = [{ pts: main, thin: false }], ang = Math.atan2(o.to.y - o.from.y, o.to.x - o.from.x), total = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
    for (let i = 0; i < (o.forks ?? 3); i++) {
      const p = main[1 + Math.floor(rng() * Math.max(1, main.length - 2))], a = ang + (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.6), L = total * (0.12 + rng() * 0.2);
      const fork = [p];
      stroke(p, { x: p.x + Math.cos(a) * L, y: p.y + Math.sin(a) * L }, L * 0.35, rng, fork);
      out.push({ pts: fork, thin: true });
    }
    return out;
  }

  // Draws a polyline as half-pixel squares: ramp[3] haze, ramp[1] body, ramp[0] core.
  function trace(c2d, pts, ramp, thin) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
      for (let s = 0; s <= n; s++) {
        const x = a.x + (b.x - a.x) * s / n, y = a.y + (b.y - a.y) * s / n;
        if (!thin) { Shapes.px(c2d, x - 1, y, ramp[3], 0.5); Shapes.px(c2d, x + 1, y, ramp[3], 0.5); Shapes.px(c2d, x, y - 1, ramp[2], 0.5); Shapes.px(c2d, x, y + 1, ramp[2], 0.5); }
        if (!thin || (s & 1)) { Shapes.px(c2d, x - 0.5, y, ramp[1], 0.5); Shapes.px(c2d, x, y, ramp[0], 0.5); }
      }
    }
  }

  // A lightning stroke. o: { from, to, time, type, forks, jag (how crooked, 0.3), seed, glow (halo radius) }
  function strike(o) {
    let t = 0, last = 0;
    const rng = Random.makeRng(o.seed || 5), ramp = Palette.of(o.type).rgb;
    let parts = roll(o, rng);
    return {
      update(dt) { t += dt; if (t - last > 0.045) { last = t; parts = roll(o, rng); } return t < o.time; },
      draw(c2d) {
        const k = t / o.time;
        if (k > 0.55 && (Math.floor(t * 30) & 1)) return;                // flickers out
        const fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
        Glow.draw(c2d, o.from.x, o.from.y, o.glow ?? 12, o.type, 0.9 * fade);
        Glow.draw(c2d, o.to.x, o.to.y, (o.glow ?? 12) * 0.8, o.type, 0.7 * fade);
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        c2d.globalAlpha = fade;
        for (const p of parts) trace(c2d, p.pts, ramp, p.thin);
        c2d.restore();
      },
      light(world, night) {
        const k = 1 - t / o.time;
        for (const q of [0.1, 0.35, 0.65, 0.9]) Shapes.lightAt(world, night, { x: o.from.x + (o.to.x - o.from.x) * q, y: o.from.y + (o.to.y - o.from.y) * q }, o.type, 24, 1.4 * k);
      },
    };
  }

  return { reach, strike };
})();
