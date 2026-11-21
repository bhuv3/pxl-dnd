// Glowing ropes conjured round a figure (Hold Person): three coils wind up the body one after another, legs first, each a
// helix with its near side bright and its far side faint, then they pull tight and hold, pulsing. Drawn additively.
const Ropes = (() => {
  const TURNS = 1.6, STEPS = 64, RISE = 3.2;

  // The rope. o: { fig, time (how long it stays), type, wind (seconds to wind all the coils), coils (3), snap (the ropes burst
  // apart at the end instead of holding) }
  function wrap(o) {
    let t = 0, burst = false;
    const ramp = Palette.of(o.type).rgb, n = o.coils ?? 3, wind = o.wind ?? 0.6, f = o.fig;
    const done = wind + 0.1, tail = o.snap ? 0.3 : 0.25;                  // wound by `done`; the last `tail` seconds fade (or burst)
    return {
      update(dt) {
        t += dt;
        if (o.snap && !burst && t > done + 0.1) { burst = true; snap(f, o.type); }
        return t < o.time;
      },
      draw(c2d) {
        const h = Figures.head(f), H = Math.max(10, f.y - h.y + 2), left = o.time - t;
        const fade = left < tail ? Math.max(0, left / tail) : 1, pulse = t > done ? 0.85 + 0.15 * Math.sin(t * 9) : 1;
        const loose = o.snap && t > done + 0.1 ? Math.min(1, (t - done - 0.1) / 0.2) : 0;     // a snapping rope flies outward
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        c2d.globalAlpha = fade * pulse;
        for (let k = 0; k < n; k++) {
          const start = k * wind * 0.28, p = Math.max(0, Math.min(1, (t - start) / (wind * 0.55)));
          if (p <= 0) continue;
          const yc = f.y - H * (0.15 + 0.68 * k / Math.max(1, n - 1)), tight = Math.min(1, Math.max(0, (t - done) / 0.15));
          coil(c2d, f.x, yc, 5.2 + (1 - tight) * 2.2 + loose * 7, p, k * 1.3 + t * (t > done ? 0 : 2.5), ramp, o.type);
        }
        c2d.restore();
      },
      light(world, night) {
        const k = Math.min(1, t / done) * Math.min(1, (o.time - t) / tail);
        Shapes.lightAt(world, night, { x: f.x, y: f.y - 7 }, o.type, 20, 1.1 * Math.max(0, k));
      },
    };
  }

  // One coil of rope, wound up to progress p (0–1): the helix is drawn as half-pixel squares, flattened (the body is seen
  // from a slant), the near side in the bright ramp colours and the far side dim. Its leading end carries a small halo.
  function coil(c2d, cx, yc, R, p, phase, ramp, type) {
    let tip = null;
    const n = Math.max(2, Math.round(STEPS * p));
    for (let i = 0; i < n; i++) {
      const s = i / (STEPS - 1), a = phase + s * TURNS * Math.PI * 2;
      const x = cx + Math.cos(a) * R, y = yc - s * RISE + Math.sin(a) * R * 0.34, near = Math.sin(a) > 0;
      if (near) { Shapes.px(c2d, x, y, ramp[2], 1); Shapes.px(c2d, x, y - 0.5, ramp[1], 0.5); }
      else { c2d.globalAlpha *= 0.55; Shapes.px(c2d, x, y, ramp[3], 1); c2d.globalAlpha /= 0.55; }
      tip = { x, y };
    }
    if (p < 1 && tip) Glow.draw(c2d, tip.x, tip.y, 6, type, 0.7);
  }

  // The ropes breaking apart: sparks fly off round the body.
  function snap(f, type) {
    for (let k = 0; k < 3; k++) Particles.burst('spark', f.x, f.y - 3 - k * 5, 10, { speed: 50, spread: 3, type });
    Particles.burst('glow', f.x, f.y - 8, 20, { speed: 30, spread: 4, type });
  }

  return { wrap };
})();
