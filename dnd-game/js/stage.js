// The game's own frame loop over the map editor's render modules: draws the map every animation frame, with hooks
// for floor marks, extra lights, and screen-space drawing (characters, effects, text). The map frame is the editor's
// Stages pipeline with the game's own list of stages (LIST below): on the GPU (GlFrame passes) when WebGL2 works, else
// on the CPU, where every stage keeps its CPU code as the reference. The finished frame is copied onto the display.
const Stage = (() => {
  const SQUARE = 10;                 // map pixels per grid square (5 ft)
  const hooks = { update: [], floor: [], lights: [], screen: [] };
  let display, dctx, dpr = 1;
  let map = null, world = null, palette = null;
  let staticLayer = null;            // CPU copy of the baked ground; null while it is only on the GPU (staticBytes reads it back)
  let mapCanvas, mapCtx, image;
  let tint = [1, 1, 1], dark = 0, time = 0, last = 0;
  const cam = { zoom: 4, panX: 0, panY: 0, shakeX: 0, shakeY: 0 };
  let showGrid = false;
  let manual = false;                // tests step frames by hand (the in-app browser throttles animation frames)
  let wantGl = glWanted();           // GL on unless ?gl=0, or the browser can't
  let useGl = false;                 // the map frame is drawn by the GL passes (GlFrame)
  let onGpu = false;                 // the finished frame is in the GL frame, not in image.data
  let screenGl = false;              // the display canvas is a GL canvas (GlScreen): the map frame and the screen layer are drawn together on the GPU

  // The stages of the game's frame. Most are the editor's own (same CPU code, same GL passes); the game has no bridges,
  // tracks, sim or animals, and does not draw raised ground, so 'things' is just the details. 'floor' (marks on the
  // ground) and 'lights' (the lights hooks) are the game's.
  const editorStage = name => Stages.LIST.find(st => st.name === name);
  const LIST = [
    editorStage('static'),
    editorStage('water'),
    { name: 'floor', cpu: c => hooks.floor.forEach(fn => fn(c.frame, c.world)) },
    { name: 'things', cpu: c => Details.draw(c.frame, c.world, c.s, c.palette, c.time) },
    editorStage('smoke'),
    editorStage('life'),
    editorStage('weather'),
    editorStage('tint'),
    { name: 'lights', cpu: c => {
      Fire.beginLights(c.world);
      Fire.addLights(c.world, c.time, c.dark);
      Details.addBeams(c.world, c.time, c.dark);
      c.extraLights(c.world, Fire.nightOf(c.dark));
      Fire.applyLights(c.frame, c.world, c.tint);
    } },
    editorStage('glow'),
  ];

  // True when the page may use GL: WebGL2 is there and the URL doesn't say ?gl=0.
  function glWanted() {
    try {
      return typeof Gl !== 'undefined' && typeof GlFrame !== 'undefined' && Gl.supported() && new URLSearchParams(location.search).get('gl') !== '0';
    } catch (e) { return false; }
  }

  // True when the display itself may be a GL canvas: GL is wanted, the GL screen layer is loaded, and the URL doesn't say ?screen=2d
  // (which keeps the 2D display, with the GL map frame copied onto it).
  function screenWanted() {
    try { return typeof GlScreen !== 'undefined' && new URLSearchParams(location.search).get('screen') !== '2d'; } catch (e) { return false; }
  }

  // Sets up the canvases and starts the loop. With GL the display canvas becomes a GL canvas (GlScreen): it can't also give a
  // 2D context, so the screen hooks draw through GlScreen.context, a Canvas 2D look-alike that renders on the GPU (it supports
  // only what the game's own drawing uses; a page whose hooks draw paths, strokes or dashes, like the adventure editor, passes
  // { screen: '2d' } and keeps a 2D display).
  function init(canvas, opts = {}) {
    display = canvas;
    screenGl = wantGl && opts.screen !== '2d' && screenWanted() && GlScreen.attach(canvas);
    dctx = screenGl ? GlScreen.context : canvas.getContext('2d');
    mapCanvas = document.createElement('canvas');
    mapCtx = mapCanvas.getContext('2d');
    if (wantGl) Gl.onLost(fallBack);
    if (screenGl) canvas.addEventListener('webglcontextrestored', recover);
    new ResizeObserver(resize).observe(canvas);
    resize();
    requestAnimationFrame(loop);
  }

  // Matches the canvas to its size on screen and refits the map.
  function resize() {
    const r = display.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    display.width = Math.max(1, Math.round(r.width * dpr));
    display.height = Math.max(1, Math.round(r.height * dpr));
    if (!manual) fit();              // tests keep their own zoom
    if (world) present();            // resizing clears the canvas
  }

  // Biggest whole zoom that shows the whole map, centered.
  function fit() {
    if (!map) return;
    const r = display.getBoundingClientRect();
    cam.zoom = Math.max(1, Math.floor(Math.min((r.width - 24) / map.width, (r.height - 24) / map.height)));
    cam.panX = Math.round((r.width - map.width * cam.zoom) / 2);
    cam.panY = Math.round((r.height - map.height * cam.zoom) / 2);
  }

  // Shows a map: resolve, place details, bake the ground (the editor's rebuild; the GPU bakes the ground when GL is on).
  function setMap(m) {
    map = m;
    mapCanvas.width = m.width;
    mapCanvas.height = m.height;
    image = mapCtx.createImageData(m.width, m.height);
    Random.setSeed(m.seed);
    palette = Colors.build(m.settings.colors);
    world = Resolve.run(m);
    Details.place(world, m, palette);
    Life.place(world, m.settings);
    useGl = startGl();
    if (!useGl) staticLayer = Ground.bake(world, m, palette);
    resetLit();
    fit();
  }

  // Starts GL for the current map: the frame at the map's size, the world as textures, the ground baked on the GPU (the CPU
  // bakes it when the GPU can't). Returns false when GL is off, can't start, or the map has raised ground (the game's
  // list has no height step, so the CPU draws those).
  function startGl() {
    if (!wantGl || !map || world.raised) return false;
    try { if (!GlFrame.init(map.width, map.height)) return false; } catch (e) { console.warn('Stage: WebGL could not start:', e); return false; }
    GpuWorld.begin(world, map, null);
    staticLayer = null;
    if (!GlGround.run(world, map, palette)) { staticLayer = Ground.bake(world, map, palette); GpuWorld.setStatic(staticLayer); }
    return true;
  }

  // The browser gave the GL context back after losing it: everything GL made is gone, so make it again (the screen layer, the map
  // frame, the world's textures) and carry on on the GPU.
  function recover() {
    if (!screenGl) return;
    if (GlFrame.ready()) GlFrame.shutdown();
    GlShaders.clear();
    if (!GlScreen.attach(display)) return;
    useGl = map ? startGl() : false;
    resetLit();
  }

  // The context was lost: carry on on the CPU (a GL display stays blank until the browser restores the context, see recover).
  function fallBack() {
    if (!useGl) return;
    useGl = false;
    onGpu = false;
    if (map) staticLayer = staticLayer || Ground.bake(world, map, palette);
  }

  // Turns the GL passes on or off (tests compare the two); returns whether GL is on now.
  function setGl(on) {
    wantGl = !!on && typeof Gl !== 'undefined' && typeof GlFrame !== 'undefined' && Gl.supported();
    if (!map) return useGl;
    if (useGl && !wantGl) { staticBytes(); GlFrame.shutdown(); useGl = false; onGpu = false; }
    else if (!useGl && wantGl) useGl = startGl();
    resetLit();
    return useGl;
  }

  // The baked ground as CPU bytes (read back from the GPU the first time a CPU stage or lightAt needs it).
  function staticBytes() {
    if (!staticLayer) staticLayer = (useGl && GlGround.readBack()) || Ground.bake(world, map, palette);
    return staticLayer;
  }

  // The context of one frame for the Stages pipeline: the CPU picture (frame), what the stages read, and the page's own
  // light and floor sources, which the CPU stages call and the GL passes get through the pass context.
  function context(frame = image.data) {
    const ctx = Stages.prepare({ frame, world, map, s: map.settings, palette, time, floorPoints: floorSource(), extraLights });
    Object.defineProperty(ctx, 'staticLayer', { get: staticBytes });     // not enumerable: the GL context copies ctx and must not read it back
    return ctx;
  }

  // Every light hook adds its lights (figures' orbs and lanterns, effect lights).
  function extraLights(w, night) { hooks.lights.forEach(fn => fn(w, night)); }

  // The floor hooks' pixels for the GL floor pass, when every hook can give them (a hook with .points); else nothing: the CPU draws the floor.
  function floorSource() {
    if (!hooks.floor.every(fn => typeof fn.points === 'function')) return undefined;
    return w => hooks.floor.length === 1 ? hooks.floor[0].points(w) : hooks.floor.flatMap(fn => fn.points(w));
  }

  // One map frame, in the game's order (LIST): on the GL passes, or the CPU into the map canvas.
  function drawFrame() {
    const ctx = context();
    tint = ctx.tint;
    dark = ctx.dark;
    if (useGl && !Gl.isLost()) {
      const where = Stages.run(ctx, { gl: true, list: LIST });
      if (screenGl) { if (where === 'cpu') GlFrame.uploadFrame(ctx.frame); }       // GlScreen draws the frame texture itself
      else Stages.finishGl(ctx, where);
      onGpu = where === 'gpu';
    } else {
      Stages.run(ctx, { list: LIST });
      mapCtx.putImageData(image, 0, 0);
      onGpu = false;
    }
    newFrame(ctx);
  }

  // Shows the finished frame on the display, then everything in screen space, shaken by the camera shake. On a GL display the
  // frame (a GPU texture, or the CPU map canvas) and the screen hooks are drawn together by GlScreen in one pass.
  function present() {
    const z = cam.zoom;
    if (screenGl) GlScreen.beginFrame();
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!screenGl) dctx.clearRect(0, 0, display.width, display.height);
    dctx.imageSmoothingEnabled = false;
    const left = cam.panX + cam.shakeX, top = cam.panY + cam.shakeY;
    if (screenGl && useGl && !Gl.isLost()) GlScreen.drawMapFrame(GlFrame.texture(), map.width, map.height, Math.round(left * dpr) / dpr, Math.round(top * dpr) / dpr, z, dpr);
    else dctx.drawImage(useGl && !screenGl ? GlFrame.canvas() : mapCanvas, left, top, map.width * z, map.height * z);
    if (showGrid) drawGrid();
    hooks.screen.forEach(fn => fn(dctx));
    if (screenGl) GlScreen.endFrame();
  }

  // 1-pixel square grid over the map.
  function drawGrid() {
    const z = cam.zoom, o = toScreen(0, 0);
    dctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let x = 0; x <= map.width; x += SQUARE) dctx.fillRect(Math.round(o.x + x * z), o.y, 1, map.height * z);
    for (let y = 0; y <= map.height; y += SQUARE) dctx.fillRect(o.x, Math.round(o.y + y * z), map.width * z, 1);
  }

  // One frame per animation frame. A frame that throws is reported and the loop keeps going, so one bad effect
  // can't freeze the page.
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    try { if (map && !manual) step(dt); } catch (e) { report(e); }
  }

  const reported = new Set();
  function report(e) { const k = String(e && e.stack || e); if (!reported.has(k)) { reported.add(k); console.error('Frame failed:', e); } }

  // Advances time by dt seconds and draws. Tests call this directly (the in-app browser throttles frames).
  function step(dt) {
    time += dt;
    hooks.update.forEach(fn => fn(dt));
    drawFrame();
    present();
  }

  // ---------- How lit the floor is ----------
  // On the CPU path lightAt reads the CPU frame. On the GL path nothing is read back: for the few pixels asked about, the early
  // stages are redrawn on the CPU (ground, marks, things at the current time), then the weather's shade, the tint, and the lights
  // of the frame (recorded on the CPU; the lights pass keeps them) with the rules of Fire.applyLights. Left out: smoke puffs,
  // rain and snow specks, fish and birds, which touch a pixel rarely. Windows with water, and maps with fog, read the frame back
  // (once per frame) instead.
  let lightList = null;              // GL: this frame's recorded lights ({ x, y, visY, power, color, radius }), else null
  const lit = { cache: new Map(), marks: null, frame: null, local: null, noise: new Map(), near: [], reads: 0 };
  const scratch = new Uint8ClampedArray(3);        // rounds like the frame's bytes

  // A new frame is up: forget what was worked out for the last one.
  function newFrame(ctx) {
    lit.cache.clear(); lit.noise.clear(); lit.marks = null; lit.frame = null;
    lightList = useGl && !(map.settings.fog > 0) && GlFrame.has('lights', ctx) ? GlFrame.pass('lights', ctx).last || null : null;
    if (lightList) lightList.forEach(l => { l.oy = null; });
  }
  function resetLit() { lightList = null; lit.cache.clear(); lit.marks = null; lit.frame = null; lit.local = null; }

  // The finished frame as CPU bytes (GL: read back, once per frame; for tests and as lightAt's fallback).
  function frameBytes() {
    if (!onGpu) return image.data;
    if (!lit.frame) { GlFrame.readFrame(image.data); lit.frame = true; lit.reads++; }
    return image.data;
  }

  // Is this pixel a wall (the lights' rays stop there; outside the map counts as wall)?
  function wallAt(x, y) { return x < 0 || y < 0 || x >= world.w || y >= world.h || Types.isWall(world.ground[y * world.w + x]); }

  // Can a light see the pixel (dx, dy) from its centre? The ray runs from the first open pixel at or below the light to the
  // pixel and stops at the first wall pixel before it: the rule of Fire.visibility and of the lights pass.
  function sees(l, lx, dx, dy) {
    const R = Math.ceil(l.radius) + 1;
    if (Math.abs(dx) > R || Math.abs(dy) > R) return false;
    const vy = Math.round(l.visY);
    if (l.oy === null) { let oy = vy; for (let k = 0; k < Fire.WALL_SEARCH && wallAt(lx, oy); k++) oy++; l.oy = oy; }
    const ox = lx, oy = l.oy, tx = lx + dx, ty = vy + dy, steps = Math.max(Math.abs(tx - ox), Math.abs(ty - oy));
    for (let j = 1; j < steps; j++) if (wallAt(Math.round(ox + (tx - ox) * j / steps), Math.round(oy + (ty - oy) * j / steps))) return false;
    return true;
  }

  // The lights' sum at a pixel, as Fire.addLight adds them: { amount, weight, color } (weight 0: no light reaches it).
  function lightsAt(x, y) {
    let amount = 0, weight = 0;
    const color = [0, 0, 0];
    for (const l of lit.near) {
      const reach = l.radius * (0.9 + l.power * 0.1), lx = Math.round(l.x), dx = x - lx, dy = y - Math.round(l.y);
      const d = Math.hypot(dx, dy * 1.4) / reach;
      if (d >= 1 || (l.visY !== null && !sees(l, lx, dx, dy))) continue;
      const a = (1 - d) ** 1.5 * l.power;
      amount += a * (1 - amount);
      weight += a;
      for (let k = 0; k < 3; k++) color[k] += l.color[k] * a;
    }
    return { amount, weight, color };
  }

  // The floor marks' blends by pixel (built the first time in a frame).
  function marksAt(x, y) {
    if (!lit.marks) {
      lit.marks = new Map();
      const src = floorSource(), pts = src ? src(world) : [];
      for (let n = 0; n < pts.length; n += 6) {
        const key = pts[n + 1] * world.w + pts[n];
        (lit.marks.get(key) || lit.marks.set(key, []).get(key)).push(pts.slice(n + 2, n + 6));
      }
    }
    return lit.marks.get(y * world.w + x);
  }

  // The pixels of a window as the frame has them just before the weather: the baked ground, the floor marks over it, then the
  // things (trees, tufts, props) drawn at the current time, in a scratch frame (the first part of the pipeline, for these pixels only).
  function prepareWindow(x0, y0, x1, y1, ground) {
    const W = world.w, local = lit.local || (lit.local = new Uint8ClampedArray(W * world.h * 4));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * W + x) * 4, marks = marksAt(x, y);
        for (let k = 0; k < 3; k++) {
          local[i + k] = ground[i + k];
          if (marks) for (const m of marks) local[i + k] = local[i + k] * (1 - m[3]) + m[k] * m[3];
        }
      }
    }
    Details.drawIn(local, world, map.settings, palette, time, { x0, y0, x1, y1 });
  }

  // The pixel (x, y) in the lit frame, worked out: the window's pixel, the weather's shade, the tint, then the lights (Fire.applyLights).
  function litPixel(x, y, i) {
    const key = y * world.w + x, hit = lit.cache.get(key);
    if (hit) return hit;
    const shades = Weather.shadeAt(map.settings, time, x, y, lit.noise), tinted = !(tint[0] > 0.995 && tint[1] > 0.995 && tint[2] > 0.995), px = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      let v = lit.local[i + k];
      for (const f of shades) { scratch[0] = v * f[k]; v = scratch[0]; }
      if (tinted) { scratch[0] = v * tint[k]; v = scratch[0]; }
      px[k] = v;
    }
    const L = lightsAt(x, y), v = L.amount + (((x + y) & 1) ? 0.04 : -0.04), a = v > 0.45 ? 0.9 : v > 0.2 ? 0.6 : v > 0.07 ? 0.3 : 0;
    const out = L.weight && a ? px.map((f, k) => { scratch[0] = f + (Math.min(255, f / tint[k] * L.color[k] / L.weight) - f) * a; return scratch[0]; }) : px;
    lit.cache.set(key, out);
    return out;
  }

  // Is there water in the window round a point? Its shimmer is drawn every frame, so lightAt reads the frame there.
  function waterIn(mx, my) {
    const cx = Math.round(mx), cy = Math.round(my);
    for (let y = Math.max(0, cy - 1); y <= Math.min(map.height - 1, cy + 1); y++) {
      for (let x = Math.max(0, cx - 3); x <= Math.min(map.width - 1, cx + 3); x++) if (world.water[y * map.width + x]) return true;
    }
    return false;
  }

  // How lit the floor is round a map point this frame, per channel (lit frame ÷ unlit ground), so characters
  // standing in torchlight or a spell's flash are lit too, not just tinted for the time of day. Reads a 7 × 3 pixel window.
  function lightAt(mx, my) {
    const W = map.width, H = map.height, ground = staticBytes(), out = [0, 0, 0];
    const worked = onGpu && lightList && !waterIn(mx, my), frame = worked ? null : frameBytes();
    const cx = Math.round(mx), cy = Math.round(my);
    if (worked) lit.near = lightList.filter(l => Math.abs(l.x - cx) <= l.radius * 1.2 + 6 && Math.abs(l.y - cy) <= l.radius * 1.2 + 6);   // reach is at most radius * 1.0
    if (worked) prepareWindow(Math.max(0, cx - 3), Math.max(0, cy - 1), Math.min(W - 1, cx + 3), Math.min(H - 1, cy + 1), ground);
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = Math.round(mx) + dx, y = Math.round(my) + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        if (ground[i] + ground[i + 1] + ground[i + 2] < 30) continue;
        const px = worked ? litPixel(x, y, i) : frame.subarray(i, i + 3);
        const r = [0, 1, 2].map(k => px[k] / Math.max(1, ground[i + k]));
        if (r.some(v => v > 3)) continue;
        r.forEach((v, k) => { out[k] += v; });
        n++;
      }
    }
    return n ? out.map((v, k) => Math.max(tint[k], Math.min(1.25, v / n))) : tint;
  }

  // Map point → screen point (CSS pixels), with the shake.
  function toScreen(mx, my) { return { x: mx * cam.zoom + cam.panX + cam.shakeX, y: my * cam.zoom + cam.panY + cam.shakeY }; }

  function on(name, fn) { hooks[name].push(fn); }

  return {
    SQUARE, cam, init, setMap, step, on, toScreen, lightAt,
    getMap: () => map, getWorld: () => world, getTint: () => tint, getNight: () => Fire.nightOf(dark), getTime: () => time,
    setGrid: on => { showGrid = on; },
    setManual: on => { manual = on; },
    fit,
    // For a compositor (the GL screen layer) and for tests: the stage list, GL on or off, the frame's texture and bytes.
    list: () => LIST, context, setGl, usingGl: () => useGl, usingGlScreen: () => screenGl, getFrameTexture: () => (useGl ? GlFrame.texture() : null),
    frameBytes, staticBytes, modelPixel: (x, y) => { if (!lightList) return null; lit.near = lightList; prepareWindow(x, y, x, y, staticBytes()); return litPixel(x, y, (y * world.w + x) * 4); }, readbacks: () => lit.reads,
  };
})();
