// Parity tests: does each GL pass draw the same picture as the CPU code it replaces? For every map and time, the whole
// frame runs on the CPU with a copy of the picture kept before and after each step (Stages.capture). Then each GL
// pass is given the "before" picture, draws its step, and is compared with the "after" picture. A pixel matches when
// every colour channel is within TOLERANCE levels. Used by dev/gltest.html (and by hand in the console).
const GlParity = (() => {
  const TOLERANCE = 2;
  const MAPS = [
    '/samples/maps/canyon-hideout.json', '/samples/maps/desert-fortress.json',
    '/samples/maps/grand-arena.json', '/samples/maps/underdark-warren.json',
  ];

  // Compares two RGBA byte arrays. Only RGB counts. Returns { pixels, mismatched, matchPercent, maxError, first }.
  function diff(a, b, w, h) {
    let bad = 0, max = 0;
    const first = [];
    for (let i = 0; i < w * h; i++) {
      const p = i * 4;
      const e = Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]));
      if (e > max) max = e;
      if (e > TOLERANCE) {
        bad++;
        if (first.length < 5) first.push({ x: i % w, y: (i / w) | 0, cpu: [b[p], b[p + 1], b[p + 2]], gl: [a[p], a[p + 1], a[p + 2]] });
      }
    }
    return { pixels: w * h, mismatched: bad, matchPercent: +(100 * (1 - bad / (w * h))).toFixed(4), maxError: max, first };
  }

  // Loads a map (a JSON file path, or a map object already) and sets everything up the way Renderer.rebuildNow does.
  // settings (optional) are put into the map's settings before anything is built; a season also brings its colours.
  async function build(source, settings) {
    const data = typeof source === 'string' ? await (await fetch(source)).json() : source;
    const map = MapModel.deserialize(data);
    if (settings) {
      const season = settings.season && Colors.SEASONS[settings.season];
      Object.assign(map.settings, settings, { colors: map.settings.colors });
      if (season) { map.settings.snow = season.snow; Object.assign(map.settings.colors, season.colors); }
      Object.assign(map.settings.colors, settings.colors || {});
    }
    Random.setSeed(map.seed);
    const palette = Colors.build(map.settings.colors);
    const world = Resolve.run(map);
    Details.place(world, map, palette);
    Life.place(world, map.settings);
    const staticLayer = Ground.bake(world, map, palette);
    if (!GlFrame.init(map.width, map.height)) throw new Error('GL is not available');
    GpuWorld.begin(world, map, staticLayer);
    return { name: map.name, map, world, palette, staticLayer, w: map.width, h: map.height };
  }

  // A fresh frame context for a built map at a time (seconds). Settings can be overridden: { timeOfDay, underground, ... }.
  function context(b, time, overrides) {
    const s = { ...b.map.settings, ...(overrides || {}) };
    return Stages.prepare({ frame: new Uint8ClampedArray(b.w * b.h * 4), staticLayer: b.staticLayer, world: b.world, map: b.map, s, palette: b.palette, time });
  }

  // Tests the named stages (default: every stage with a GL pass) on a built map at one time. Returns one row per stage.
  function stages(b, time, names, overrides) {
    const ctx = context(b, time, overrides);
    const wanted = (names || Stages.NAMES).filter(n => GlFrame.has(n, ctx));
    const snap = Stages.capture(ctx, wanted);
    return wanted.map(name => {
      const t0 = performance.now();
      let row;
      try {
        if (name !== 'static') GlFrame.uploadFrame(snap.before[name]);
        GlFrame.run(name, ctx);
        const gl = GlFrame.readFrame();
        row = { stage: name, ...diff(gl, snap.after[name], b.w, b.h), glMs: +(performance.now() - t0).toFixed(1) };
      } catch (e) { row = { stage: name, error: String(e && e.stack || e) }; }
      return { map: b.name, size: `${b.w}x${b.h}`, time, ...(overrides ? { overrides } : {}), ...row };
    });
  }

  // The whole frame on the GL backend (passes ported so far, CPU for the rest) against the whole frame on the CPU.
  function full(b, time, overrides) {
    const cpuCtx = context(b, time, overrides);
    Stages.run(cpuCtx, { gl: false });
    const ctx = context(b, time, overrides);
    const where = Stages.run(ctx, { gl: true });
    const glBytes = where === 'gpu' ? GlFrame.readFrame() : ctx.frame;
    const rows = [{ map: b.name, size: `${b.w}x${b.h}`, time, stage: 'FULL FRAME', ...diff(glBytes, cpuCtx.frame, b.w, b.h) }];
    // And what the editor really shows: the GL canvas, copied onto a 2D canvas the way Renderer.present does.
    Stages.finishGl(ctx, where);
    const copy = document.createElement('canvas');
    copy.width = b.w; copy.height = b.h;
    const x2d = copy.getContext('2d', { willReadFrequently: true });
    x2d.drawImage(GlFrame.canvas(), 0, 0);
    rows.push({ map: b.name, size: `${b.w}x${b.h}`, time, stage: 'PRESENTED', ...diff(x2d.getImageData(0, 0, b.w, b.h).data, cpuCtx.frame, b.w, b.h) });
    return rows;
  }

  // The ground (js/gl/ground.js) is not a frame stage, so GlGround tests it: a full bake against Ground.bake, a paint
  // stroke that must be redrawn tile by tile, and the same bake with settings overridden (options.settings: season,
  // lightAngle, ...), built into the map. The ground doesn't depend on the time, so there is one row per map. Leaves the
  // map's own GPU bake as the static layer, so the frame rows after it run on the GPU ground.
  async function groundRows(source, b, options, errors) {
    const rows = [], time = (options.times || [3.7])[0];
    const add = (name, fn) => { try { rows.push({ time, ...fn() }); } catch (e) { errors.push({ map: b.name, stage: name, error: String(e && e.stack || e) }); } };
    add('ground', () => GlGround.parity(b));
    if (options.stroke !== false) add('ground stroke', () => GlGround.parityStroke(b));
    if (options.settings) {
      try {
        const bs = await build(source, options.settings);
        rows.push({ time, overrides: options.settings, ...GlGround.parity(bs) });
        GpuWorld.begin(b.world, b.map, null);
        GlGround.bake(b.world, b.map, b.palette);
      } catch (e) { errors.push({ map: b.name, stage: 'ground settings', error: String(e && e.stack || e) }); }
    }
    return rows;
  }

  // The standard suite: every map, a few times of day, every GL stage, and the full frame.
  // options: { maps: [paths or map objects], times: [seconds], names: [stages], hours: [timeOfDay], settings: { any map setting,
  // e.g. weather: 'rain' }, full: true }.
  async function suite(options = {}) {
    const rows = [], errors = [];
    for (const source of options.maps || MAPS) {
      let b;
      if (typeof source === 'string' && !(await fetch(source, { method: 'HEAD' })).ok) { errors.push({ map: source, skipped: 'not found (put your own maps in samples/maps/, or use ?audit=1)' }); continue; }
      try { b = await build(source); } catch (e) { errors.push({ map: String(source).slice(0, 60), error: String(e && e.stack || e) }); continue; }
      if (options.ground !== false && typeof GlGround !== 'undefined') rows.push(...await groundRows(source, b, options, errors));
      for (const time of options.times || [3.7]) {
        for (const hour of options.hours || [null]) {
          const merged = { ...(options.settings || {}), ...(hour === null ? {} : { timeOfDay: hour, underground: false, dayCycle: false }) };
          const overrides = Object.keys(merged).length ? merged : null;
          rows.push(...stages(b, time, options.names, overrides));
          if (options.full !== false) { try { rows.push(...full(b, time, overrides)); } catch (e) { errors.push({ map: b.name, error: String(e && e.stack || e) }); } }
        }
      }
    }
    return { rows, errors };
  }

  return { TOLERANCE, MAPS, diff, build, context, stages, full, suite };
})();
