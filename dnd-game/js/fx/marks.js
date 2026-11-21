// Ground marks that fade: scorch, a fireball's blast, an acid puddle. Drawn into the map frame before the tint,
// so lights fall on them and things standing on the floor cover them.
const Marks = (() => {
  const SHAPES = {
    scorch: { radius: 4, colors: [[24, 18, 16], [44, 32, 26]], strength: 0.75, embers: 7, glow: 2.2, ember: 'fire' },
    blast:  { radius: 11, colors: [[20, 15, 14], [40, 30, 24]], strength: 0.8, embers: 22, glow: 3.5, ember: 'fire' },
    acid:   { radius: 4, colors: [[60, 110, 30], [90, 150, 40]], strength: 0.7, embers: 5, glow: 4, ember: 'acid' },
  };
  const live = [];

  // Leaves a mark centered on (x, y) map pixels, fading over fade seconds.
  function add(kind, x, y, fade, seed = Math.round(x * 7 + y * 13)) {
    live.push({ shape: SHAPES[kind], x: Math.round(x), y: Math.round(y), fade, age: 0, seed });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) if ((live[i].age += dt) >= live[i].fade) live.splice(i, 1);
  }

  // Every floor pixel the marks darken, in draw order, as a flat list [x, y, r, g, b, alpha, ...]: a ragged, flattened blob
  // (the floor is seen from above at a slant). The CPU path (drawFloor) and the GL floor pass both draw this list.
  function floorPoints(world) {
    const out = [];
    for (const m of live) {
      const s = m.shape, R = s.radius, k = s.strength * (1 - m.age / m.fade) ** 0.7;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R - 1; dx <= R + 1; dx++) {
          const x = m.x + dx, y = m.y + dy;
          if (x < 0 || y < 0 || x >= world.w || y >= world.h || Types.isWall(world.ground[y * world.w + x])) continue;
          const d = Math.hypot(dx * 0.85, dy * 1.5) / R + (Random.hash(x + m.seed * 31, y) - 0.5) * 0.5;
          if (d >= 1) continue;
          const c = s.colors[d < 0.5 ? 0 : 1];
          out.push(x, y, c[0], c[1], c[2], k * (d < 0.5 ? 1 : 0.6));
        }
      }
    }
    return out;
  }

  // Darkens the floor under the marks: frame = frame * (1 - alpha) + colour * alpha.
  function drawFloor(frame, world) {
    const pts = floorPoints(world);
    for (let n = 0; n < pts.length; n += 6) {
      const i = (pts[n + 1] * world.w + pts[n]) * 4, a = pts[n + 5];
      for (let j = 0; j < 3; j++) frame[i + j] = frame[i + j] * (1 - a) + pts[n + 2 + j] * a;
    }
  }
  drawFloor.points = floorPoints;       // Stage hands the GL floor pass the same points (a floor hook without .points runs on the CPU)

  // Embers still glowing in a fresh mark, at full brightness, dying out over the first seconds.
  function drawGlow(c2d) {
    for (const m of live) {
      const s = m.shape, k = 1 - m.age / s.glow;
      if (!s.embers || k <= 0) continue;
      for (let e = 0; e < s.embers; e++) {
        if (Random.hash(e * 7 + m.seed, Math.floor(m.age * 8)) > k + 0.15) continue;
        const ang = Random.hash(e, m.seed) * Math.PI * 2, r = Random.hash(m.seed, e) * s.radius * 0.9;
        const c = Palette.at(s.ember, 1 - k * (0.6 + 0.4 * Random.hash(e, m.seed + 1)));
        Shapes.px(c2d, m.x + Math.round(Math.cos(ang) * r), m.y + Math.round(Math.sin(ang) * r * 0.6), c);
      }
    }
  }

  return { add, update, floorPoints, drawFloor, drawGlow, clear: () => { live.length = 0; } };
})();
