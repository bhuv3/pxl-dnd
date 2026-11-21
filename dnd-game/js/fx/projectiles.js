// Things that fly from A to B: fire beads, magic darts, sling stones, arrows, spinning daggers, acid blobs.
// Each is an active (see Shapes): it moves, leaves a trail, may carry a light, and calls onArrive at the end.
const Projectiles = (() => {
  const WOOD = [140, 98, 60], STEEL = [206, 212, 222], FLETCH = [236, 232, 220], GRIP = [92, 60, 38];
  const TRAILS = { bead: 'ember', dart: 'glow', blob: 'drop', stone: null, arrow: null, dagger: null };

  // o: { from, to, speed or duration, sprite, type (colors), arc (px up), curve (px sideways), trail, trailRate,
  //      lightRadius, onArrive(point) }
  function fly(o) {
    const dx = o.to.x - o.from.x, dy = o.to.y - o.from.y, dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;                       // sideways, for curving darts
    const dur = o.duration || Math.max(0.12, dist / o.speed);
    const sprite = o.sprite || 'bead', trail = o.trail === undefined ? TRAILS[sprite] : o.trail;
    let t = 0, pos = { ...o.from }, prev = { ...o.from }, acc = 0;
    const tail = [];                                            // recent positions, for a streak (o.streak: how many)
    const at = k => {
      const side = Math.sin(k * Math.PI) * (o.curve || 0), up = Math.sin(k * Math.PI) * (o.arc || 0);
      return { x: o.from.x + dx * k + nx * side, y: o.from.y + dy * k + ny * side - up };
    };
    return {
      update(dt) {
        t += dt;
        const k = Math.min(1, t / dur);
        prev = pos;
        pos = at(k);
        if (o.streak) { tail.push(pos); if (tail.length > o.streak) tail.shift(); }
        acc += dt * (o.trailRate || 60);
        for (; trail && acc >= 1; acc--) Particles.burst(trail, pos.x, pos.y, 1, { speed: 6, spread: 0.6, type: trail === 'glow' ? o.type : undefined });
        if (k >= 1) { o.onArrive && o.onArrive(pos); return false; }
        return true;
      },
      draw(c2d) {
        if (o.glow) Glow.draw(c2d, pos.x, pos.y, o.glow, o.type, 0.85);
        if (tail.length) streak(c2d, tail, o.type);
        const vx = pos.x - prev.x, vy = pos.y - prev.y, v = Math.hypot(vx, vy) || 1;
        SPRITES[sprite](c2d, pos, [vx / v, vy / v], t, o);
      },
      light(world, night) { if (o.lightRadius) Shapes.lightAt(world, night, pos, o.type, o.lightRadius, 1.1); },
    };
  }

  // A fading streak of glowing half-pixels along the last positions.
  function streak(c2d, tail, type) {
    const r = Palette.of(type).rgb;
    c2d.save();
    c2d.globalCompositeOperation = 'lighter';
    tail.forEach((p, i) => { c2d.globalAlpha = (i + 1) / tail.length * 0.8; Shapes.px(c2d, p.x - 0.5, p.y - 0.5, r[i > tail.length * 0.6 ? 0 : 1], 1); });
    c2d.restore();
  }

  // Lit like the floor under it, so arrows and stones show in torchlight and fade in the dark.
  function lit(c, p) { const l = Stage.lightAt(p.x, p.y + 8); return c.map((v, k) => v * Math.max(0.45, l[k])); }

  const SPRITES = {
    // A 5-pixel diamond of fire (or any type) with a short tail.
    bead(c2d, p, u, t, o) {
      const flick = Math.floor(t * 30) & 1, r = Palette.of(o.type).rgb;
      const ux = Math.round(u[0] * 1.4), uy = Math.round(u[1] * 1.4);
      Shapes.px(c2d, p.x - ux * 3, p.y - uy * 3, r[3]);
      Shapes.px(c2d, p.x - ux * 2, p.y - uy * 2, r[2]);
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const d = Math.abs(ox) + Math.abs(oy);
          if (d > 2 || (d === 2 && ((ox + oy + flick) & 1))) continue;
          Shapes.px(c2d, p.x + ox, p.y + oy, r[d === 0 ? 0 : d === 1 ? 1 : 2]);
        }
      }
    },
    // A small bright dart: a hot core and a fading tail of half-pixels.
    dart(c2d, p, u, t, o) {
      const r = Palette.of(o.type).rgb;
      for (let k = 4; k >= 1; k--) Shapes.px(c2d, p.x - u[0] * k * 0.5, p.y - u[1] * k * 0.5, r[Math.min(3, k - 1)], 0.5);
      Shapes.px(c2d, p.x - 0.5, p.y - 0.5, r[0]);
    },
    stone(c2d, p) { Shapes.px(c2d, p.x, p.y, lit([150, 142, 130], p)); },
    // Shaft along the flight, steel tip in front, pale fletching behind.
    arrow(c2d, p, u) {
      Shapes.px(c2d, p.x, p.y, lit(STEEL, p), 0.5);
      for (let k = 1; k <= 5; k++) Shapes.px(c2d, p.x - u[0] * k * 0.5, p.y - u[1] * k * 0.5, lit(k === 5 ? FLETCH : WOOD, p), 0.5);
    },
    // A short blade turning end over end.
    dagger(c2d, p, u, t) {
      const a = t * 28, sx = Math.cos(a), sy = Math.sin(a);
      for (let k = -2; k <= 2; k++) Shapes.px(c2d, p.x + sx * k * 0.5, p.y + sy * k * 0.5, lit(k < -1 ? GRIP : STEEL, p), 0.5);
    },
    // A wobbling glob: a bright middle and a ring of darker half-pixels.
    blob(c2d, p, u, t, o) {
      const r = Palette.of(o.type).rgb, wob = Math.floor(t * 20) & 1;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) Shapes.px(c2d, p.x + ox * (0.5 + wob * 0.5), p.y + oy * 0.5, r[2], 0.5);
      Shapes.px(c2d, p.x - 0.25, p.y - 0.25, r[1]);
    },
  };

  return { fly };
})();
