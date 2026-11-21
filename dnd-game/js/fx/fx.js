// The effect player: runs an effect (a list of timed steps, see Spells) on its own clock, with slow motion and
// hit-stop, and resolves a Promise when it's over. It shows outcomes; it never decides them.
const Fx = (() => {
  const POSES = {                      // character-pixel offsets: lean toward the target, lift off the ground
    windup: { lean: -2, lift: 0 },
    strike: { lean: 3, lift: 0 },
    cast:   { lean: 1, lift: 1 },
    raise:  { lean: 0, lift: 2 },
    inhale: { lean: -1, lift: 1 },
    hit:    { lean: -2, lift: 0 },
    dodge:  { lean: -3, lift: 1 },
    shiver: { lean: -1, lift: 0 },
  };
  const HANDLERS = {};
  const runs = [], actives = [];
  let timeScale = 1, freeze = 0, shake = { strength: 0, time: 0, left: 0 }, screen = null;
  const rng = Random.makeRng(99);

  // Plays a named effect. ctx: { caster, target, point, result: { outcome: 'hit'|'miss'|'crit', amount, parts,
  //   dtype (the colors for a step whose type is 'chosen': Chromatic Orb) }, hits: [{ fig, amount, parts, saved }]
  //   (defaults to the target alone), onHit(hit, part) (applies damage) }.
  // A step with ifPart: n plays only if part n did damage (one of Scorching Ray's rays hit).
  function play(name, ctx) {
    ctx.hits = ctx.hits || [{ fig: ctx.target, amount: ctx.result.amount, parts: ctx.result.parts }];
    const parts = (ctx.hits[0] && ctx.hits[0].parts) || ctx.result.parts || [];
    const steps = Spells.get(name)
      .filter(s => (!s.if || [].concat(s.if).includes(ctx.result.outcome)) && (s.ifPart === undefined || parts[s.ifPart] > 0))
      .map(s => s.type === 'chosen' ? { ...s, type: ctx.result.dtype || 'fire' } : s);
    return new Promise(done => runs.push({ steps, ctx, t: 0, started: new Set(), events: new Map(), done, mine: [] }));
  }

  // Advances everything by real seconds dt (slowed by timeScale, stopped during hit-stop except the shake).
  function update(dt) {
    dt *= timeScale;
    updateShake(dt);
    if (screen && (screen.left -= dt) <= 0) screen = null;
    if (freeze > 0) { freeze -= dt; return; }
    for (let i = actives.length - 1; i >= 0; i--) if (!actives[i].update(dt)) actives.splice(i, 1);
    Particles.update(dt);
    Popups.update(dt);
    Marks.update(dt);
    Deaths.update(dt);
    Figures.update(dt);
    for (let i = runs.length - 1; i >= 0; i--) if (advance(runs[i], dt)) { runs[i].done(); runs.splice(i, 1); }
  }

  // Starts the steps whose time (or event) has come. True when the run is over.
  function advance(run, dt) {
    run.t += dt;
    let pending = false;
    run.steps.forEach((s, k) => {
      if (run.started.has(k)) return;
      const when = typeof s.at === 'number' ? s.at : run.events.has(s.at) ? run.events.get(s.at) + (s.delay || 0) : null;
      if (when === null) return;                 // its event hasn't happened (and may never: a miss has no 'hit')
      if (run.t < when) { pending = true; return; }
      run.started.add(k);
      let made = [];
      try { made = [].concat(HANDLERS[s.do](s, run) || []); }
      catch (e) { console.error(`Effect step '${s.do}' failed; skipped.`, e); }          // a broken step can't stall the run
      made.forEach(a => { actives.push(a); run.mine.push(a); });
    });
    // Over when nothing is left to start and nothing it started is still playing (only actives emit events).
    return !pending && !run.mine.some(a => actives.includes(a));
  }

  // Marks an event (like 'hit') as happened now, so steps waiting on it can start.
  function emit(run, name) { if (!run.events.has(name)) run.events.set(name, run.t); }

  // A named point: the caster's hand, chest, feet, or mouth; the target's chest or feet; the aimed point; or
  // where the last projectile landed.
  function where(name, run, f) {
    const { caster, target } = run.ctx;
    switch (name) {
      case 'casterHand': return Figures.hand(caster);
      case 'caster': return Figures.chest(caster);
      case 'casterFeet': return { x: caster.x, y: caster.y };
      case 'mouth': { const h = Figures.head(caster); return { x: caster.x + Figures.facing(caster) * 2, y: h.y + 5 }; }
      case 'targetFeet': return { x: target.x, y: target.y };
      case 'image': { const c = Figures.chest(caster), s = Figures.imageSlot(caster.images || 0); return { x: c.x + s[0], y: c.y + s[1] }; }    // where the next duplicate stands
      case 'point': return run.ctx.point || Figures.chest(target);
      case 'impact': return run.impact || Figures.chest(target);
      case 'feet': return { x: f.x, y: f.y };                     // of each figure, with who
      case 'chest': return Figures.chest(f);
      default: return Figures.chest(target);
    }
  }

  // The figures a step acts on: the caster, the target, or every figure hit.
  function figs(name, run) {
    if (name === 'caster') return [run.ctx.caster];
    if (name === 'hits') return run.ctx.hits.map(h => h.fig);
    return [run.ctx.target];
  }
  const hitOf = (run, f) => run.ctx.hits.find(h => h.fig === f) || { fig: f, amount: run.ctx.result.amount, parts: run.ctx.result.parts };

  // Unit vector from a point (the caster by default) toward a figure.
  function away(run, f, from) {
    const a = from || run.ctx.caster, b = f || run.ctx.target, d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return [(b.x - a.x) / d, (b.y - a.y) / d];
  }

  // Animates a value from 0 to 1 and back: in over the first part of time, back over the last.
  function tween(time, set, inK = 0.25, outK = 0.35) {
    let t = 0;
    const value = k => k >= 1 ? 0 : k < inK ? Shapes.easeOut(k / inK) : k > 1 - outK ? Math.max(0, (1 - k) / outK) : 1;
    set(value(0));                     // shows at once, even if a hit-stop freezes the next updates
    return {
      update(dt) { t += dt; set(value(t / time)); return t < time; },
      draw() {}, light() {},
    };
  }

  // Calls fn for each figure the step names (hitIf: only those who 'saved' or 'failed'); collects any actives.
  const each = (s, run, fn) => figs(s.who, run)
    .filter(f => !(f.dead && s.alive) && (!s.hitIf || !!hitOf(run, f).saved === (s.hitIf === 'saved')))
    .map(fn).filter(Boolean);

  HANDLERS.face = (s, run) => {
    const { caster, target } = run.ctx;
    if (target !== caster) { Figures.face(caster, target.x); if (!s.only) Figures.face(target, caster.x); }
  };

  // A pose for a while: its name (drawn by Poses) while it's held, and a screen-space lean and lift for art
  // without poses. The latest pose wins; one that ends only clears the name if it's still its own.
  HANDLERS.pose = (s, run) => each(s, run, f => {
    const p = POSES[s.pose], mine = {};
    return tween(s.time, v => {
      if (f.dead) return;
      f.lean = p.lean * v; f.lift = p.lift * v;
      if (v > 0.3) { f.pose = s.pose; f.poseOwner = mine; } else if (f.poseOwner === mine) f.pose = null;
    }, s.in, s.out);
  });

  HANDLERS.projectile = (s, run) => {
    const from = where(s.from || 'casterHand', run), off = s.offset || [0, 0];
    let to = s.to === 'point' ? where('point', run) : Figures.chest(run.ctx.target);
    to = { x: to.x + off[0], y: to.y + off[1] };
    if (run.ctx.result.outcome === 'miss' && !s.sure) {
      const [ux, uy] = away(run);
      to = { x: to.x + ux * 14 - uy * 4, y: to.y + uy * 14 + ux * 4 + 3 };
    }
    if (s.to === 'deflect') {                    // off the shield, up and away
      const [ux] = away(run);
      to = { x: from.x - ux * 18, y: from.y - 14 };
    }
    return Projectiles.fly({ ...s, from, to, onArrive: p => { run.impact = p; emit(run, s.event || 'hit'); } });
  };

  HANDLERS.swing = (s, run) => Blades.swing({ ...s, fig: run.ctx.caster, onContact: () => { run.impact = Figures.chest(run.ctx.target); emit(run, s.event || 'hit'); } });

  HANDLERS.thrust = (s, run) => Blades.thrust({ ...s, fig: run.ctx.caster, at: Figures.chest(run.ctx.target), onContact: () => { run.impact = Figures.chest(run.ctx.target); emit(run, s.event || 'hit'); } });

  HANDLERS.bolt = (s, run) => {
    const from = where('casterHand', run), aim = Figures.chest(run.ctx.target), d = Math.hypot(aim.x - from.x, aim.y - from.y) || 1;
    const ux = (aim.x - from.x) / d, uy = (aim.y - from.y) / d;
    const b = Shapes.bolt({ ...s, from, dir: [ux, uy], seed: run.t * 1000 | 0 });
    run.impact = { x: from.x + ux * b.length, y: from.y + uy * b.length };
    emit(run, 'hit');
    return b;
  };

  // A glow (a halo that swells and fades) at a point, or on each figure the step names.
  HANDLERS.glow = (s, run) => {
    const one = p => Glow.flash({ ...s, at: { x: p.x + (s.dx || 0), y: p.y + (s.dy || 0) } });
    return s.who ? each(s, run, f => one(where(s.where || 'chest', run, f))) : one(where(s.where || 'impact', run));
  };

  // An area at its real size (feet; 5 ft = 10 map pixels): a sphere blast, a cone from the caster, a cube, or a line.
  HANDLERS.volume = (s, run) => {
    const feet = s.feet * 2, dir = away(run), from = where(s.from || 'casterHand', run), seed = run.t * 1000 + 1 | 0;
    if (s.shape === 'sphere') {
      const c = where(s.where || 'impact', run);
      return Volumes.sphere({ ...s, at: { x: c.x, y: c.y + (s.dy ?? 5) }, radius: feet, seed });
    }
    if (s.shape === 'cube') { const c = where(s.where || 'impact', run); return Volumes.cube({ ...s, at: { x: c.x, y: c.y + (s.dy ?? 5) }, size: feet, seed }); }
    const length = s.shape === 'line' ? Math.min(feet, Arcs.reach(from, dir, feet)) : feet;
    if (s.shape === 'line') { run.impact = { x: from.x + dir[0] * length, y: from.y + dir[1] * length }; emit(run, 'hit'); }
    return (s.shape === 'line' ? Volumes.line : Volumes.cone)({ ...s, from, dir, length, width: (s.wide || 5) * 2, seed });
  };

  // Branching lightning from the caster's hand to the target (to: 'target') or along a line to the first wall (feet long).
  HANDLERS.arc = (s, run) => {
    const from = where(s.from || 'casterHand', run), dir = away(run);
    const to = s.to === 'target' ? where('point', run) : (() => { const L = Arcs.reach(from, dir, s.feet * 2); return { x: from.x + dir[0] * L, y: from.y + dir[1] * L }; })();
    run.impact = to;
    emit(run, 'hit');
    return Arcs.strike({ ...s, from, to, seed: run.t * 1000 | 0 });
  };

  HANDLERS.hitstop = s => { freeze = Math.max(freeze, s.time); };

  HANDLERS.burst = (s, run) => {
    const at = f => where(s.where || 'impact', run, f);
    const fire = (p, f) => Particles.burst(s.kind, p.x, p.y, s.count,
      { speed: s.speed, spread: s.spread, size: s.size, dir: s.away ? away(run, f) : s.dir, cone: s.cone, type: s.type });
    if (s.who) each(s, run, f => { fire(at(f), f); }); else fire(at());
  };

  // Mirror Image's duplicates for a while (count of them, or extra on top of the ones it has): they split off the figure and
  // hold, then merge back unless the spell keeps them (combat's own images take over).
  HANDLERS.images = (s, run) => each(s, run, f => tween(s.time, v => {
    f.fxImages = v > 0 ? s.count ?? (f.images || 0) + (s.extra || 0) : 0;
    f.imageSpread = v;
  }, s.in, s.out));

  // Glowing ropes wind round each figure the step names (Hold Person): see Ropes.
  HANDLERS.rope = (s, run) => each(s, run, f => Ropes.wrap({ ...s, fig: f }));

  HANDLERS.flash = (s, run) => each(s, run, f => tween(s.time, v => { f.flash = v > 0 ? s.color || [255, 255, 255] : null; }, 0, 0));

  HANDLERS.outline = (s, run) => each(s, run, f => tween(s.time, v => { f.outline = v > 0 ? s.color : null; }, 0, 0));

  HANDLERS.fade = (s, run) => each(s, run, f => tween(s.time, v => { f.alpha = 1 - (1 - s.to) * v; }, s.in ?? 0.3, s.out ?? 0.3));

  // Knocked away from the caster (or from where the blast landed, from: 'impact').
  HANDLERS.knock = (s, run) => each(s, run, f => {
    const [ux, uy] = away(run, f, s.from === 'impact' ? where('impact', run) : null);
    return tween(s.time, v => { f.knockX = Math.round(ux * s.dist * v * 2) / 2; f.knockY = Math.round(uy * s.dist * v * 2) / 2; }, 0.15, 0.6);
  });

  // The caster darts to a spot next to the target (behind it, or the near side) or back home, leaving afterimages.
  HANDLERS.dash = (s, run) => {
    const f = run.ctx.caster, t = run.ctx.target, from = { x: f.x, y: f.y };
    const side = Math.sign(t.x - f.base.x) || 1;
    const to = s.to === 'home' ? f.base : { x: t.x + (s.to === 'behind' ? side : -side) * 8, y: t.y };
    let time = 0, lastGhost = 0;
    return {
      update(dt) {
        time += dt;
        const k = Math.min(1, time / s.time), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2;
        f.x = from.x + (to.x - from.x) * e; f.y = from.y + (to.y - from.y) * e;
        if (time - lastGhost > 0.025) { lastGhost = time; f.ghosts.push({ x: f.x, y: f.y, age: 0 }); }
        if (k >= 1) { Figures.face(f, t.x); return false; }
        return true;
      },
      draw() {}, light() {},
    };
  };

  HANDLERS.shake = s => { shake = { strength: s.strength, time: s.time, left: s.time }; };

  HANDLERS.screenflash = s => { screen = { color: s.color, strength: s.strength ?? 0.5, time: s.time, left: s.time }; };

  HANDLERS.mark = (s, run) => {
    const put = p => Marks.add(s.kind, p.x + (s.dx || 0), p.y + (s.where === 'impact' ? 3 : 0), s.fade);
    if (s.who) each(s, run, f => { put(where(s.where || 'feet', run, f)); }); else put(where(s.where || 'impact', run));
  };

  HANDLERS.light = (s, run) => Shapes.flare({ ...s, at: where(s.where || 'impact', run) });

  HANDLERS.pop = (s, run) => {
    const one = p => Shapes.pop({ ...s, at: p, seed: run.t * 1000 + p.x | 0 });
    return s.who ? each(s, run, f => one(where(s.where || 'chest', run, f))) : one(where(s.where || 'impact', run));
  };

  HANDLERS.ring = (s, run) => { const p = where(s.where || 'impact', run); return Shapes.ring({ ...s, at: { x: p.x, y: p.y + (s.dy || 0) } }); };

  HANDLERS.column = (s, run) => each(s, run, f => Shapes.column({ ...s, at: { x: f.x + (s.dx || 0), y: f.y } }));

  // Runs away from the caster (turned undead) and stays there.
  HANDLERS.flee = (s, run) => each(s, run, f => {
    const [ux, uy] = away(run, f), from = { x: f.x, y: f.y };
    let t = 0, lastGhost = 0;
    return {
      update(dt) {
        t += dt;
        const k = Math.min(1, t / s.time);
        f.x = from.x + ux * s.dist * k; f.y = from.y + uy * s.dist * k * 0.5;
        if (t - lastGhost > 0.06) { lastGhost = t; f.ghosts.push({ x: f.x, y: f.y, age: 0 }); }
        return k < 1;
      },
      draw() {}, light() {},
    };
  });

  HANDLERS.bubble = (s, run) => each(s, run, f => Shapes.bubble({ ...s, fig: f, struck: () => run.events.has(s.on || 'hit') }));

  HANDLERS.emit = (s, run) => Shapes.emitter({ ...s, at: where(s.where || 'targetFeet', run), seed: run.t * 1000 | 0 });

  // A cone of particles from the caster's mouth toward the target (a breath weapon).
  HANDLERS.cone = (s, run) => {
    const dir = away(run), at = where(s.from || 'mouth', run);
    run.impact = { x: at.x + dir[0] * s.length * 0.6, y: at.y + dir[1] * s.length * 0.6 };
    emit(run, 'hit');
    return Shapes.emitter({ ...s, at, dir, cone: s.spread, seed: run.t * 1000 | 0, lightAhead: s.length * 0.5 });
  };

  // Damage or healing lands now (the caller's onHit applies it; part: which dart).
  HANDLERS.apply = (s, run) => { if (run.ctx.onHit) each(s, run, f => { run.ctx.onHit(hitOf(run, f), s.part); }); };

  HANDLERS.popup = (s, run) => each(s, run, f => {
    const h = hitOf(run, f), head = Figures.head(f);
    const n = s.part !== undefined ? (h.parts || [])[s.part] : h.amount;
    const text = s.text === 'amount' ? (n === 0 && s.zero ? s.zero : (s.color === 'heal' || s.plus ? '+' : '') + n) : s.text;
    if (s.text === 'amount' && n === undefined) return;
    Popups.add(text, head.x + (s.dx || 0), head.y - (s.above || 0), { color: (h.saved || (n === 0 && s.zero)) && s.text === 'amount' ? 'miss' : s.color, big: s.big, delay: s.delay });
    if (h.saved && s.text === 'amount' && s.part === undefined) Popups.add('SAVE', head.x, head.y - 7, { color: 'miss' });
  });

  // Camera shake: a random whole-pixel offset that dies away.
  function updateShake(dt) {
    shake.left = Math.max(0, shake.left - dt);
    const k = shake.time ? shake.left / shake.time : 0, s = shake.strength * k * Stage.cam.zoom / 2;
    Stage.cam.shakeX = s ? Math.round((rng() - 0.5) * 2 * s) : 0;
    Stage.cam.shakeY = s ? Math.round((rng() - 0.5) * 2 * s) : 0;
  }

  // Effects over the figures, then the text, then a whole-screen flash (lightning) on top.
  function draw(c2d) {
    actives.forEach(a => a.draw(c2d));
    Particles.draw(c2d);
    Popups.draw(c2d);
    if (screen) {
      c2d.save();
      c2d.setTransform(1, 0, 0, 1, 0, 0);
      c2d.fillStyle = Palette.css(screen.color, screen.strength * screen.left / screen.time);
      c2d.fillRect(0, 0, c2d.canvas.width, c2d.canvas.height);
      c2d.restore();
    }
  }

  function addLights(world, night) { actives.forEach(a => a.light(world, night)); }

  // Keeps something on screen outside any effect, until its update returns false (a Flaming Sphere).
  function keep(active) { actives.push(active); }

  return {
    POSES, play, update, draw, addLights, keep,
    setTimeScale: k => { timeScale = k; }, getTimeScale: () => timeScale, busy: () => runs.length > 0,
  };
})();
