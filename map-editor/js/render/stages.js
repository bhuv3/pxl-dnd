// The steps of one animated frame, in order, each with its CPU code (what Renderer.drawFrame used to do inline).
// The canvas backend runs every step on the CPU. The GL backend runs a step as a GL pass when one is registered for
// it (GlFrame.register) and on the CPU when not, moving the picture between the two as needed, so passes can be
// ported one at a time and in any order.
//
// ctx: { frame (RGBA bytes, the CPU picture), staticLayer, world, map, s (settings), palette, time, tint, dark }.
const Stages = (() => {
  // 'sim' steps only move things (animals, tracks) and never draw, so they stay on the CPU whatever the backend.
  const LIST = [
    { name: 'static',  cpu: c => c.frame.set(c.staticLayer) },
    { name: 'water',   cpu: c => Water.draw(c.frame, c.world, c.s, c.palette, c.time) },
    { name: 'bridges', cpu: c => Bridges.draw(c.frame, c.world, c.s, c.palette) },
    { name: 'sim', sim: true, cpu: c => { Animals.update(c.world, c.map, c.time); Tracks.update(c.world, c.s, c.time); } },
    { name: 'tracks',  cpu: c => { Tracks.drawPrints(c.frame, c.world, c.time); Tracks.drawRings(c.frame, c.world, c.palette, c.time); } },
    { name: 'things',  cpu: c => {
      if (c.world.raised) Height.compose(c.frame, c.world, c.s, c.palette, c.time);
      else { Details.draw(c.frame, c.world, c.s, c.palette, c.time); Animals.draw(c.frame, c.world, c.s, c.palette, c.time); }
    } },
    { name: 'smoke',   cpu: c => Fire.draw(c.frame, c.world, c.s, c.palette, c.time) },
    { name: 'life',    cpu: c => Life.draw(c.frame, c.world, c.s, c.palette, c.time, c.dark) },
    { name: 'weather', cpu: c => Weather.draw(c.frame, c.world, c.s, c.palette, c.time) },
    { name: 'tint',    cpu: c => Daylight.apply(c.frame, c.tint) },
    { name: 'lights',  cpu: c => {
      Fire.beginLights(c.world);
      Fire.addLights(c.world, c.time, c.dark);
      Details.addBeams(c.world, c.time, c.dark);
      Characters.addLights(c.world, c.dark);
      Fire.applyLights(c.frame, c.world, c.tint);
    } },
    { name: 'glow',    cpu: c => { Fire.drawGlow(c.frame, c.world, c.palette, c.time, c.dark); Life.drawGlow(c.frame, c.world, c.s, c.palette, c.time, c.dark); } },
  ];
  const NAMES = LIST.filter(st => !st.sim).map(st => st.name);

  // Works out the time-of-day tint and darkness for ctx.time and puts them in ctx.
  function prepare(ctx) {
    const s = ctx.s;
    ctx.tint = s.underground ? Daylight.underground(s.ambient) : Daylight.tint(Daylight.hour(s, ctx.time));
    ctx.dark = Daylight.darkness(ctx.tint);
    return ctx;
  }

  // Runs every step. With opts.gl the GL passes take their steps; returns where the picture ended up: 'cpu' (in
  // ctx.frame) or 'gpu' (in the GL frame). opts.glOnly: stage names to give the GL (the others stay on the CPU).
  // opts.list: another list of stages ({ name, cpu(ctx), sim? }, in order) instead of LIST: the game's frame has its own.
  function run(ctx, opts = {}) {
    const useGl = !!opts.gl && GlFrame.ready();
    let where = 'cpu';
    for (const st of opts.list || LIST) {
      const gpu = useGl && !st.sim && GlFrame.has(st.name, ctx) && (!opts.glOnly || opts.glOnly.includes(st.name));
      if (gpu) {
        if (where === 'cpu' && st.name !== 'static') GlFrame.uploadFrame(ctx.frame);    // hand the CPU picture to the GPU
        where = 'gpu';
        GlFrame.run(st.name, ctx);
      } else {
        if (where === 'gpu' && !st.sim) { GlFrame.readFrame(ctx.frame); where = 'cpu'; }   // and take it back
        st.cpu(ctx);
      }
    }
    return where;
  }

  // Shows the finished picture on the GL canvas (GL backend only), whichever side it is on.
  function finishGl(ctx, where) {
    if (where === 'cpu') GlFrame.uploadFrame(ctx.frame);
    GlFrame.present();
  }

  // Runs the whole frame on the CPU and keeps a copy of the picture just before and just after each of the named
  // steps (all of them when none are named): { before: { name: bytes }, after: { name: bytes } }. For parity tests.
  // list: another list of stages instead of LIST (see run).
  function capture(ctx, names, list = LIST) {
    const before = {}, after = {};
    for (const st of list) {
      const keep = !st.sim && (!names || names.includes(st.name));
      if (keep) before[st.name] = ctx.frame.slice();
      st.cpu(ctx);
      if (keep) after[st.name] = ctx.frame.slice();
    }
    return { before, after };
  }

  return { LIST, NAMES, prepare, run, finishGl, capture };
})();
