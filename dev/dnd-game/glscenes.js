// Tests the game's map frame (Stage) in a real browser, on the effects lab page's DOM (dev/gltest.html). Scenes: the lab room, the
// same room by day, the adventure's village (day, night, rain at dusk) and its goblin cave. In each, effects play through
// the Lab with the frames stepped by hand, and at sampled frames:
//   - the Stage frame drawn by the GL passes is compared with the CPU pipeline run on the same state (every stage on its
//     own, then the whole frame), with GlParity.diff (a pixel matches when every channel is within 2 levels);
//   - with ?hash=1, a hash of the frame, so the CPU output can be compared before and after a change (use ?gl=0).
// Result: window.__gameGlResult = { done, rows, errors, hashes, summary }. A row is a (scene, effect, stage) with the
// lowest match over its samples. URL options: ?scenes=lab,cave  ?effects=fireball,...  ?every=6 (sample every n frames)
// ?gl=0 (CPU only)  ?hash=1  ?bench=1 (frame cost, CPU against GL)  ?lightat=1 (Stage.lightAt against the CPU values).
const GameGlTest = (() => {
  const q = new URLSearchParams(location.search);
  const list = k => (q.get(k) ? q.get(k).split(',') : null);
  const EFFECTS = ['fireball', 'lightningBolt', 'magicMissile', 'flamingSphere', 'guidingBolt', 'acidSplash', 'scorchingRay'];
  const result = { done: false, rows: [], errors: [], hashes: {}, summary: {} };
  const tick = () => new Promise(r => setTimeout(r, 0));
  const village = () => Adventures.get('cellar-key').maps;
  let every = +q.get('every') || 5;
  const usingGl = () => !!Stage.usingGl && Stage.usingGl();     // false on a Stage without GL (to take hashes of an older one)

  // Settings put over a scene's map.
  const dusk = { timeOfDay: 22, dayCycle: false };
  const SCENES = {
    lab: () => Lab.buildRoom(),
    labDay: () => with_(Lab.buildRoom(), { underground: false, timeOfDay: 12, dayCycle: false, wind: true }),
    village: () => Maps.build(village().village),
    villageNight: () => with_(Maps.build(village().village), dusk),
    villageRain: () => with_(Maps.build(village().village), { timeOfDay: 19, dayCycle: false, weather: 'rain' }),
    cave: () => Maps.build(village().cave),
  };

  // The map with settings put over its own.
  function with_(m, settings) { Object.assign(m.settings, settings); return m; }

  // A 32-bit FNV-1a hash of the bytes, as hex.
  function hash(bytes) {
    let h = 2166136261;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  // Adds one comparison to the result: the lowest match per scene, effect and stage is kept.
  function note(scene, effect, stage, d) {
    const key = `${scene} | ${effect} | ${stage}`;
    const row = result.summary[key] || (result.summary[key] = { scene, effect, stage, samples: 0, minPercent: 100, maxError: 0, worst: null });
    row.samples++;
    if (d.matchPercent < row.minPercent) { row.minPercent = d.matchPercent; row.worst = d.first; }
    row.maxError = Math.max(row.maxError, d.maxError);
  }

  // Compares the GL frame Stage has just drawn with the CPU pipeline on the same state, whole frame and every GL stage.
  function compare(scene, effect) {
    const { width: w, height: h } = Stage.getMap(), names = Stage.list().filter(st => !st.sim).map(st => st.name);
    const glBytes = Stage.frameBytes().slice();
    const ctx = Stage.context(), snap = Stages.capture(ctx, names, Stage.list());
    note(scene, effect, 'FULL FRAME', GlParity.diff(glBytes, ctx.frame, w, h));
    for (const name of names) {
      if (!GlFrame.has(name, ctx)) { note(scene, effect, name + ' (CPU)', { matchPercent: 100, maxError: 0 }); continue; }
      if (name !== 'static') GlFrame.uploadFrame(snap.before[name]);
      GlFrame.run(name, ctx);
      note(scene, effect, name, GlParity.diff(GlFrame.readFrame(), snap.after[name], w, h));
    }
  }

  // One sampled frame: a hash of it, and the parity check when GL is on.
  function sample(scene, effect, n) {
    if (q.get('hash')) result.hashes[`${scene} | ${effect} | ${n}`] = hash(Stage.frameBytes());
    if (usingGl() && q.get('parity') !== '0') compare(scene, effect);
  }

  // Steps frames (1/30 s each), sampling every few.
  function frames(scene, effect, count) {
    for (let i = 0; i < count; i++) { Stage.step(1 / 30); if (i % every === 0) sample(scene, effect, i); }
  }

  // Casts a lab effect with its outcome forced to a hit, sampling while it plays.
  async function cast(scene, name) {
    Lab.reset();
    const p = Lab.cast(name);
    let n = 0;
    while (Lab.busy() && n < 1500) {
      Stage.step(1 / 30);
      if (n % every === 0) sample(scene, name, n);
      n++;
      await tick();
    }
    await p;
    frames(scene, name + ' (after)', 20);
  }

  // Scorch, blast and acid marks at several places (one near a wall), fading while the frames are sampled.
  function marksScene(scene) {
    const m = Stage.getMap(), W = m.width, H = m.height;
    Marks.clear();
    Marks.add('blast', W * 0.4, H * 0.4, 3);
    Marks.add('scorch', W * 0.5, H * 0.5, 4);
    Marks.add('acid', W * 0.52, H * 0.5, 4);
    Marks.add('scorch', 12, 22, 3);
    Marks.add('blast', W - 4, H - 4, 3);
    frames(scene, 'marks', 100);
    Marks.clear();
  }

  // Everything for one scene.
  async function runScene(name) {
    Stage.setMap(SCENES[name]());
    Lab.reset();
    Stage.cam.zoom = 4; Stage.cam.panX = 0; Stage.cam.panY = 0;
    frames(name, 'idle', 12);
    marksScene(name);
    for (const e of list('effects') || EFFECTS) await cast(name, e);
  }

  // Frame cost: the map frame alone (Stages.run on a context, the GPU made to finish) and Stage.step, CPU and GL.
  function costOf(fn, n) {
    fn();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) fn();
    return +((performance.now() - t0) / n).toFixed(2);
  }
  function bench(label) {
    const out = { label, size: `${Stage.getMap().width}x${Stage.getMap().height}` };
    const frame = new Uint8ClampedArray(Stage.getMap().width * Stage.getMap().height * 4);
    const run = gl => () => {
      const c = Stage.context(frame);
      const where = Stages.run(c, { gl, list: Stage.list() });
      if (gl && where === 'gpu') GlFrame.readRegion(0, 0, 1, 1);
    };
    const n = out.size === '1000x1000' ? 8 : 30;
    Stage.setGl(false); out.cpuStep = costOf(() => Stage.step(1 / 30), n); out.cpuFrame = costOf(run(false), n);
    Stage.setGl(true);
    out.glStepSync = costOf(() => { Stage.step(1 / 30); GlFrame.readRegion(0, 0, 1, 1); }, n);        // each step waits for the GPU
    const t0 = performance.now();
    for (let i = 0; i < n * 4; i++) Stage.step(1 / 30);                                              // steps queued, one wait at the end
    GlFrame.readRegion(0, 0, 1, 1);
    out.glStep = +((performance.now() - t0) / (n * 4)).toFixed(2);
    out.glFrame = costOf(run(true), n);
    out.usingGl = Stage.usingGl();
    return out;
  }

  // The harbor save as a game map (flat: the game draws no height).
  async function harbor() {
    const data = await (await fetch('/samples/maps/big/harbor-town-20261108-214729.json')).json();
    const m = MapModel.deserialize(data);
    m.elevation.fill(0); m.terrace.fill(0);
    return m;
  }

  // Stage.lightAt on the GL path against the CPU formula on the CPU pipeline's frame (and the CPU-baked ground) of the same
  // state, at the figures' feet and at random points; and how many read-backs those calls cost. Steps one frame first.
  function lightAtRows(scene) {
    const r0 = Stage.readbacks();
    for (let i = 0; i < 10; i++) Stage.step(1 / 30);                  // Figures call lightAt for every figure in each one
    const stepReads = (Stage.readbacks() - r0) / 10;
    const m = Stage.getMap(), W = m.width, H = m.height, tint = Stage.getTint();
    const rng = Random.makeRng(5), points = Figures.list.map(f => [f.x, f.y + 1]);
    for (let i = 0; i < 40; i++) points.push([rng() * W, rng() * H]);
    const before = Stage.readbacks();
    const got = points.map(p => Stage.lightAt(p[0], p[1]));
    const reads = Stage.readbacks() - before;
    const cpu = Stage.context();
    Stages.run(cpu, { list: Stage.list() });
    const frame = cpu.frame, stat = Ground.bake(Stage.getWorld(), m, Colors.build(m.settings.colors));
    let worst = 0, worstFigure = 0;
    points.forEach((p, k) => {
      const a = cpuLightAt(frame, stat, W, H, tint, p[0], p[1]);
      for (let c = 0; c < 3; c++) {
        const e = Math.abs(a[c] - got[k][c]);
        worst = Math.max(worst, e);
        if (k < Figures.list.length) worstFigure = Math.max(worstFigure, e);
      }
    });
    return { scene, worstFigureError: +worstFigure.toFixed(4), figures: Figures.list.length, readbacksPerStep: stepReads, points: points.length, extraReadbacks: reads, worstRatioError: +worst.toFixed(4) };
  }

  // The original Stage.lightAt, on a CPU frame.
  function cpuLightAt(frame, stat, W, H, tint, mx, my) {
    const out = [0, 0, 0];
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = Math.round(mx) + dx, y = Math.round(my) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      if (stat[i] + stat[i + 1] + stat[i + 2] < 30) continue;
      const r = [0, 1, 2].map(k => frame[i + k] / Math.max(1, stat[i + k]));
      if (r.some(v => v > 3)) continue;
      r.forEach((v, k) => { out[k] += v; });
      n++;
    }
    return n ? out.map((v, k) => Math.max(tint[k], Math.min(1.25, v / n))) : tint;
  }

  // ?baseline=save keeps this run's frame hashes (in localStorage); ?baseline=check compares with the saved ones.
  function baseline() {
    const key = 'dnd-game:gltest-baseline', mode = q.get('baseline');
    try {
      if (mode === 'save') localStorage.setItem(key, JSON.stringify(result.hashes));
      if (mode === 'check') {
        const saved = JSON.parse(localStorage.getItem(key) || '{}'), keys = Object.keys(saved);
        const bad = keys.filter(k => saved[k] !== result.hashes[k]);
        result.baseline = { saved: keys.length, now: Object.keys(result.hashes).length, different: bad.length, first: bad.slice(0, 8) };
      }
    } catch (e) { result.errors.push('baseline: ' + e); }
  }

  async function run() {
    try {
      Stage.setManual(true);
      document.getElementById('dice').checked = false;
      document.getElementById('dice').dispatchEvent(new Event('change'));
      document.querySelector('#outcome button[data-v="hit"]').click();
      if (q.get('gl') === '0' && Stage.setGl) Stage.setGl(false);
      result.usingGl = usingGl();
      result.lightAt = [];
      for (const name of list('scenes') || Object.keys(SCENES)) {
        await runScene(name);
        if (usingGl() && q.get('lightat') !== '0') {
          frames(name, 'lightAt', 3);
          result.lightAt.push(lightAtRows(name));
        }
      }
      if (q.get('bench')) {
        result.bench = [];
        Stage.setMap(SCENES.village());
        frames('bench', 'warm', 3);
        result.bench.push(bench('village 220x160'));
        const big = await harbor().catch(() => null);   // a big sample map, when there (the repo ships none)
        if (big) {
          Stage.setMap(big);
          frames('bench', 'warm', 3);
          result.bench.push(bench('harbor 1000x1000'));
          result.lightAt.push(lightAtRows('harbor'));
        }
      }
    } catch (e) { result.errors.push(String(e && e.stack || e)); }
    baseline();
    result.rows = Object.values(result.summary);
    result.failing = result.rows.filter(r => r.minPercent < 99.9).length;
    result.done = true;
    window.__gameGlResult = result;
  }

  window.__gameGlResult = result;
  window.addEventListener('error', e => result.errors.push(String(e.message)));
  const origError = console.error;
  console.error = (...a) => { result.errors.push(a.map(String).join(' ').slice(0, 300)); origError.apply(console, a); };
  if (q.get('auto') !== '0') run();
  return { run, SCENES, bench };
})();
