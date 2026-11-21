// Melee weapons in motion: a swing (the blade turns round the hand and leaves a crescent smear) and a thrust
// (a spear or dagger jabs straight at the target). Both are actives (see Shapes) and call onContact when they land.
const Blades = (() => {
  const SMEAR = 0.08;                 // seconds a smear lingers
  // Lengths in character pixels. len: swung from a point in front of the chest (longer than a held blade: motion
  // exaggerates); hero: beyond a hero's hand, whose arm already reaches out.
  const KINDS = {
    sword:  { len: 14, hero: 10, steel: [206, 212, 222], tip: [240, 244, 250], guard: [196, 160, 72] },
    dagger: { len: 9,  hero: 6,  steel: [200, 206, 216], tip: [236, 240, 248], guard: [120, 90, 60] },
    rusty:  { len: 12, hero: 9,  steel: [150, 130, 110], tip: [176, 156, 130], guard: [96, 80, 66] },
    staff:  { len: 15, hero: 11, steel: [138, 100, 62], tip: [176, 138, 92], guard: [110, 78, 48] },
  };
  const SHAFT = [140, 98, 60];

  // Where the hand is (map pixels): a little in front of the body, at chest height, following the pose.
  function hand(f, dir) { return { x: f.x + f.knockX + dir * (1.5 + f.lean / 2), y: f.y + f.knockY - 4.5 - f.lift / 2 }; }

  // o: { fig, blade, a0, a1 (radians from straight up, positive = forward), contact, windup, strike, hold,
  //      type (smear colors), steps (whole angle steps per swing, for a stiff skeleton), onContact }
  // A hero's own arm swings (f.arm) and the blade turns round the shoulder beyond the hand; for others the blade
  // turns round a point in front of the chest.
  function swing(o) {
    const f = o.fig, dir = Figures.facing(f) || 1, hero = Heroes.has(f.key), base = KINDS[o.blade || 'sword'];
    const kind = hero ? { ...base, len: base.hero } : base;
    let t = 0, contacted = false;
    const hist = [];
    const angleAt = t => {
      let a = t < o.windup ? o.a0 * Shapes.easeOut(t / o.windup) : o.a0 + (o.a1 - o.a0) * Shapes.easeOut(Math.min(1, (t - o.windup) / o.strike));
      if (o.steps) { const q = (o.a1 - o.a0) / o.steps; a = Math.round(a / q) * q; }
      return a;
    };
    // The pivot and how far out the blade starts (character pixels): the shoulder and the arm's length for a hero.
    const pivot = () => hero ? Heroes.shoulder(f, f.pose) : { ...hand(f, dir), arm: 0 };
    return {
      update(dt) {
        t += dt;
        const a = angleAt(t);
        hist.push([t, a]);
        while (hist.length && hist[0][0] < t - SMEAR) hist.shift();
        if (!contacted && t >= o.windup && a >= o.contact) { contacted = true; o.onContact && o.onContact(); }
        const on = t < o.windup + o.strike + o.hold;
        f.hideHeld = on;
        if (hero) f.arm = on ? a : null;
        return on;
      },
      draw(c2d) {
        const p = pivot(), a = angleAt(t), tint = Stage.lightAt(f.x, f.y + 1), r0 = Math.round(p.arm * 2);
        if (t > o.windup && t < o.windup + o.strike + SMEAR && hist.length > 1) drawSmear(c2d, p, dir, hist[0][1], a, kind.len, o.type || 'steel', r0);
        drawBlade(c2d, p, dir, a, kind, tint, r0);
      },
      light() {},
    };
  }

  // The blade as a line of half-pixels outward from r0 (the hand), with a crossguard.
  function drawBlade(c2d, p, dir, a, kind, tint, r0 = 0) {
    const sx = Math.sin(a) * dir, sy = -Math.cos(a), lit = c => c.map((v, k) => v * tint[k]);
    for (let r = 1; r <= kind.len; r++) Shapes.px(c2d, p.x + sx * (r0 + r) / 2, p.y + sy * (r0 + r) / 2, lit(r === kind.len ? kind.tip : r === 1 ? kind.guard : kind.steel), 0.5);
    Shapes.px(c2d, p.x + sx * (r0 + 1) / 2 + (sy * dir) / 2, p.y + sy * (r0 + 1) / 2 - (sx * dir) / 2, lit(kind.guard), 0.5);
  }

  // A crescent of light between two blade angles: thick and bright at the leading edge, thin at the tail.
  function drawSmear(c2d, p, dir, from, to, len, type, r0 = 0) {
    if (to - from < 0.05) return;
    const ramp = Palette.of(type).rgb, steps = Math.ceil((to - from) * len * 1.2);
    for (let s = 0; s <= steps; s++) {
      const a = from + (to - from) * (s / steps), lead = s / steps;
      const sx = Math.sin(a) * dir, sy = -Math.cos(a);
      for (let r = Math.round(len - 1 - lead * len * 0.5); r <= len + 1; r++) {
        const edge = r >= len ? 0 : r >= len - 2 ? 1 : 2;
        const band = lead > 0.85 ? edge : Math.min(3, edge + (lead > 0.5 ? 1 : 2));
        if (band >= 3 && (r + s) & 1) continue;
        Shapes.px(c2d, p.x + sx * (r0 + r) / 2, p.y + sy * (r0 + r) / 2, ramp[band], 0.5);
      }
    }
  }

  // A jab at a point: pull back, shoot forward with speed lines, hold, pull in. o: { fig, at (point), reach (px),
  //   windup, strike, hold, blade ('spear' draws a long shaft), type, onContact }
  function thrust(o) {
    const f = o.fig, dir = Figures.facing(f) || 1;
    let t = 0, contacted = false;
    const ext = t => t < o.windup ? -2 * Shapes.easeOut(t / o.windup)
      : t < o.windup + o.strike ? -2 + (o.reach + 2) * Shapes.easeOut((t - o.windup) / o.strike)
      : t < o.windup + o.strike + o.hold ? o.reach : o.reach * Math.max(0, 1 - (t - o.windup - o.strike - o.hold) / 0.12);
    const end = o.windup + o.strike + o.hold + 0.12;
    return {
      update(dt) {
        t += dt;
        if (!contacted && t >= o.windup + o.strike) { contacted = true; o.onContact && o.onContact(); }
        f.hideHeld = t < end;
        return t < end;
      },
      draw(c2d) {
        const p = hand(f, dir), dx = o.at.x - p.x, dy = o.at.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        const e = ext(t), tint = Stage.lightAt(f.x, f.y + 1), lit = c => c.map((v, k) => v * tint[k]);
        const tip = { x: p.x + ux * (e + 4), y: p.y + uy * (e + 4) };
        const back = o.blade === 'spear' ? 7 : 1;
        for (let k = -back * 2; k <= 0; k++) Shapes.px(c2d, tip.x + ux * (k - 2) / 2, tip.y + uy * (k - 2) / 2, lit(SHAFT), 0.5);
        Shapes.px(c2d, tip.x - ux * 0.5, tip.y - uy * 0.5, lit(KINDS.dagger.steel), 0.5);
        Shapes.px(c2d, tip.x, tip.y, lit(KINDS.dagger.tip), 0.5);
        if (t > o.windup && t < o.windup + o.strike + 0.05) {
          const ramp = Palette.of(o.type || 'steel').rgb;
          for (const side of [-1, 1]) for (let k = 2; k <= 6; k++) Shapes.px(c2d, tip.x - ux * k + uy * side, tip.y - uy * k - ux * side, ramp[Math.min(3, k - 2)], 0.5);
        }
      },
      light() {},
    };
  }

  return { swing, thrust };
})();
