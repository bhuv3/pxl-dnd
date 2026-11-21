// Particles: single map pixels that fly, fall, rise, and fade along a color ramp. Drawn in screen space over
// the figures, at full brightness when they glow, tinted like the map when they don't.
const Particles = (() => {
  const MAX = 4000;
  const KINDS = {
    ember: { type: 'fire', glow: true, add: true, gravity: -6, drag: 2.5, life: [0.35, 0.8] },
    spark: { type: 'spark', glow: true, add: true, streak: true, gravity: 30, drag: 3, life: [0.15, 0.35] },
    mote:  { type: 'radiant', glow: true, add: true, gravity: -10, drag: 1.5, life: [0.6, 1.1] },
    heal:  { type: 'healing', glow: true, add: true, gravity: -8, drag: 1.5, life: [0.6, 1.0] },
    dust:  { type: 'dust', glow: false, gravity: -2, drag: 4, life: [0.3, 0.6] },
    glow:  { type: 'force', glow: true, add: true, gravity: 0, drag: 4, life: [0.2, 0.45] },    // takes its colors from o.type
    drop:  { type: 'acid', glow: false, gravity: 60, drag: 1, life: [0.3, 0.6] },
    smoke: { type: 'smoke', glow: false, grow: 2.2, gravity: -9, drag: 2, life: [0.8, 1.4] },
    shard: { type: 'stone', glow: false, gravity: 70, drag: 1.5, life: [0.25, 0.5] },
  };
  const live = [];
  let rng = Random.makeRng(7);

  // Spawns count particles of a kind at (x, y) map pixels.
  // o: { speed, spread (radius), dir [dx, dy], cone (radians), size, type (colors other than the kind's) }.
  function burst(kind, x, y, count, o = {}) {
    const k = o.type ? { ...KINDS[kind], type: o.type } : KINDS[kind], speed = o.speed ?? 30;
    for (let n = 0; n < count && live.length < MAX; n++) {
      const base = o.dir ? Math.atan2(o.dir[1], o.dir[0]) : 0;
      const ang = o.dir ? base + (rng() - 0.5) * (o.cone ?? 1.2) : rng() * Math.PI * 2;
      const v = speed * (0.4 + rng() * 0.8), r = (o.spread ?? 0) * Math.sqrt(rng());
      const ra = rng() * Math.PI * 2;
      live.push({ kind: k, x: x + Math.cos(ra) * r, y: y + Math.sin(ra) * r, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        age: 0, life: k.life[0] + rng() * (k.life[1] - k.life[0]), size: o.size || 1 });
    }
  }

  // Moves and ages every particle.
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i], k = p.kind, d = Math.exp(-k.drag * dt);
      p.vx *= d; p.vy = p.vy * d + k.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.age += dt;
      if (p.age >= p.life) live.splice(i, 1);
    }
  }

  // Draws them as map-pixel squares (half a map pixel when small, like the characters' pixels). The glowing kinds are
  // drawn last and additively, so embers and sparks light up what is behind them; smoke grows as it rises.
  function draw(c2d) {
    const z = Stage.cam.zoom, tint = Stage.getTint(), o = Stage.toScreen(0, 0);
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) { c2d.save(); c2d.globalCompositeOperation = 'lighter'; }
      for (const p of live) {
        if (!!p.kind.add !== (pass === 1)) continue;
        const t = p.age / p.life;
        let c = Palette.at(p.kind.type, t);
        if (!p.kind.glow) c = c.map((v, k) => v * tint[k]);
        const grow = p.kind.grow ? 1 + p.kind.grow * t : 1, s = p.size * z / 2 * grow;
        const x = Math.floor(p.x * 2) / 2 * z + o.x, y = Math.floor(p.y * 2) / 2 * z + o.y;
        c2d.fillStyle = Palette.css(c);
        if (p.kind.add) c2d.globalAlpha = 1 - t * t;                       // fades out as it burns down
        else if (p.kind.grow) c2d.globalAlpha = 0.8 * (1 - t);
        c2d.fillRect(x, y, s, s);
        if (p.kind.streak) c2d.fillRect(x - p.vx * 0.035 * z, y - p.vy * 0.035 * z, s, s);   // a short streak behind a spark
      }
      c2d.globalAlpha = 1;
      if (pass === 1) c2d.restore();
    }
  }

  return { KINDS, burst, update, draw, count: () => live.length, clear: () => { live.length = 0; } };
})();
