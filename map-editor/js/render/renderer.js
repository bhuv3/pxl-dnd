// Runs the rebuild pipeline, the frame loop, and draws the map onto the screen.
const Renderer = (() => {
  let display, dctx, dpr = 1;
  let map = null, world = null, palette = null;
  let mapCanvas, mapCtx, image, staticLayer = null;
  let planCanvas, planCtx;
  let lastRebuild = { kind: 'full', reason: '', ms: 0 };   // how the last rebuild solved the terrain: 'full', 'window' or 'none'
  let verifyPartial = false;   // ?verify=1: check every partial solve against a full one (slow, for development)
  let planDirty = true;        // the Plan view picture is out of date (it is only drawn when Plan view is shown)
  let view = 'rendered';
  let time = 0, lastFrame = 0, lastTick = 0;
  let tint = [1, 1, 1];
  let rebuildTimer = null, messageTimer = null;
  let presentQueued = false;
  let paused = false;          // animation stopped: time stands still (Play mode still redraws as the character walks)
  const PAUSE_KEY = 'pixel-map-editor:paused';
  const BACKEND_KEY = 'pixel-map-editor:backend';
  let backend = 'canvas';      // 'canvas' (the CPU draws every frame) or 'gl' (WebGL2 passes, see js/gl/; the default when it works)
  let glWhy = '';              // why the GL backend is off, when it was asked for and isn't running
  let frameOnGpu = false;      // the finished picture is in the GL frame, and image.data is out of date

  // Sets up canvases, resize handling, and the frame loop.
  function init(canvas) {
    display = canvas;
    dctx = canvas.getContext('2d');
    mapCanvas = document.createElement('canvas');
    mapCtx = mapCanvas.getContext('2d');
    planCanvas = document.createElement('canvas');
    planCtx = planCanvas.getContext('2d');
    new ResizeObserver(resize).observe(canvas);
    resize();
    try { paused = localStorage.getItem(PAUSE_KEY) === '1'; } catch (e) { /* storage blocked */ }
    let wanted = 'gl';           // WebGL unless this browser can't (then tryGl says why and the CPU draws), or the user chose the CPU
    try { wanted = localStorage.getItem(BACKEND_KEY) || 'gl'; } catch (e) { /* storage blocked */ }
    const query = new URLSearchParams(location.search);
    try { verifyPartial = query.get('verify') === '1' || localStorage.getItem('pixel-map-editor:verify') === '1'; } catch (e) { verifyPartial = query.get('verify') === '1'; }
    if (query.get('gl') === '1') wanted = 'gl';
    if (query.get('gl') === '0') wanted = 'canvas';
    if (typeof Gl !== 'undefined') Gl.onLost(() => { glWhy = 'The graphics context was lost.'; backend = 'canvas'; frameOnGpu = false; if (map) requestRebuild(); });
    backend = wanted === 'gl' ? tryGl() : 'canvas';
    requestAnimationFrame(loop);
  }

  // Turns the GL backend on if this browser can run it; says why in glWhy if not. Returns the backend now in use.
  function tryGl() {
    glWhy = '';
    if (typeof Gl === 'undefined' || !Gl.supported()) { glWhy = 'This browser has no WebGL2 with float render targets.'; return 'canvas'; }
    if (map && !GlFrame.init(map.width, map.height)) { glWhy = 'WebGL2 could not start.'; return 'canvas'; }
    return 'gl';
  }

  // Switches between 'canvas' and 'gl' (remembered), and redraws. Returns the backend now in use.
  function setBackend(name) {
    try { localStorage.setItem(BACKEND_KEY, name); } catch (e) { /* storage blocked */ }
    backend = name === 'gl' ? tryGl() : 'canvas';
    if (backend === 'canvas' && typeof GlFrame !== 'undefined' && GlFrame.ready()) GlFrame.shutdown();
    frameOnGpu = false;
    if (map) rebuildNow();
    return backend;
  }

  // Matches the display canvas to its on-screen size.
  function resize() {
    const r = display.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    display.width = Math.max(1, Math.round(r.width * dpr));
    display.height = Math.max(1, Math.round(r.height * dpr));
    const first = Viewport.state.width === 0;
    Viewport.resize(r.width, r.height);
    if ((first || Viewport.state.fitPending) && map) Viewport.fit();
    requestPresent();
  }

  // Switches to a new map and renders it.
  function setMap(m) {
    map = m;
    mapCanvas.width = planCanvas.width = m.width;
    mapCanvas.height = planCanvas.height = m.height;
    image = mapCtx.createImageData(m.width, m.height);
    if (backend === 'gl' && !GlFrame.init(m.width, m.height)) { glWhy = 'WebGL2 could not start.'; backend = 'canvas'; }
    Viewport.setMap(m.width, m.height);
    Viewport.fit();
    Tracks.clear();
    Incremental.forget();
    rebuildNow();
  }

  // Schedules a full rebuild, so "Rendering…" can show first.
  function requestRebuild() {
    Status.message('Rendering…');
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuildNow, 20);
  }

  // Full rebuild: resolve terrain, place details, bake the static layer.
  function rebuildNow() {
    clearTimeout(rebuildTimer);
    const t0 = performance.now();
    Random.setSeed(map.seed);
    palette = Colors.build(map.settings.colors);
    solveTerrain();
    Details.place(world, map, palette);
    Life.place(world, map.settings);
    staticLayer = null;
    if (backend === 'gl') {
      // The GPU bakes the ground and redraws only the tiles that changed since the last rebuild; the CPU copy is
      // made on demand (see drawFrame). If the GPU ground can't run, the CPU bakes as before.
      GpuWorld.begin(world, map, null);
      // After a partial solve the terrain changed only inside lastRebuild.interior (or nowhere): the bake needs no full comparison.
      if (!GlGround.run(world, map, palette, lastRebuild.interior ? { rect: lastRebuild.interior } : undefined)) { staticLayer = Ground.bake(world, map, palette); GpuWorld.setStatic(staticLayer); }
    } else staticLayer = Ground.bake(world, map, palette);
    planDirty = true;                                  // built when the Plan view is next shown, not on every rebuild
    drawFrame();
    present();
    lastRebuild.ms = performance.now() - t0;
    flashMessage(`Rendered in ${Math.round(lastRebuild.ms)} ms` + (lastRebuild.kind === 'window' ? ' (edited area only)' : ''));
  }

  // Brings the world up to date with the painted map: only the area around the edit when it is small and local (see
  // Incremental), else the whole map. With ?verify=1 (or localStorage 'pixel-map-editor:verify' = '1') every partial update
  // is checked against a full solve and a difference is reported in the console and replaced by the full result.
  function solveTerrain() {
    const step = world ? Incremental.update(map, world) : { kind: 'full', reason: 'first solve' };
    lastRebuild = { kind: step.kind, reason: step.reason || '', ms: 0, interior: step.kind === 'window' ? step.interior : step.kind === 'none' ? { x0: 0, y0: 0, x1: 0, y1: 0 } : null };
    if (step.kind === 'full') { world = Resolve.run(map); Incremental.remember(map); return; }
    if (step.kind !== 'window' || !verifyPartial) return;
    Random.setSeed(map.seed);
    const full = Resolve.run(map), diffs = Incremental.diff(world, full);
    if (diffs.length) { console.warn('Partial solve differs from the full solve:', diffs); world = full; Incremental.remember(map); lastRebuild.kind = 'verified-full'; }
  }

  // Shows a status message that clears itself.
  function flashMessage(text) {
    Status.message(text);
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => Status.message(''), 1500);
  }

  // Draws one animated frame into the map canvas.
  function drawFrame() {
    if (!world) return;
    const ctx = Stages.prepare({
      frame: image.data, world, map, s: map.settings, palette, time,
      // The CPU copy of the baked ground, read back from the GPU the first time a CPU stage asks for it.
      get staticLayer() { return staticLayer || (staticLayer = (backend === 'gl' && GlGround.readBack()) || Ground.bake(world, map, palette)); },
    });
    tint = ctx.tint;
    if (backend === 'gl' && !Gl.isLost()) {
      const where = Stages.run(ctx, { gl: true });
      Stages.finishGl(ctx, where);
      frameOnGpu = where === 'gpu';
    } else {
      Stages.run(ctx);
      mapCtx.putImageData(image, 0, 0);
    }
  }

  // The finished picture as CPU bytes (for Characters, which redraw what stands in front of them). On the GL backend
  // this reads the GPU's picture back, so it is only asked for when a character is on the map.
  function frameBytes() {
    if (frameOnGpu) { GlFrame.readFrame(image.data); frameOnGpu = false; }
    return image.data;
  }

  // What Characters read the finished picture through: the CPU bytes, or (picture on the GPU) an object that reads just
  // the small window around a character when something stands in front of it, instead of the whole frame.
  function frameSource() {
    return frameOnGpu ? { readRegion: (x, y, w, h) => GlFrame.readRegion(x, y, w, h) } : image.data;
  }

  // Flat-color picture of what was painted (Plan view).
  function buildPlan() {
    planDirty = false;
    const { width: w, height: h } = map;
    const img = planCtx.createImageData(w, h);
    const d = img.data;
    const cache = {};
    const rgb = hex => cache[hex] || (cache[hex] = Colors.hexToRgb(hex));
    for (let i = 0; i < w * h; i++) {
      let c;
      if (map.water[i]) c = rgb(Types.materialFor('water', map.water[i]).plan);
      else {
        c = rgb(Types.materialFor('ground', map.ground[i]).plan);
        if (map.scatter[i]) {
          const s = rgb(Types.materialFor('scatter', map.scatter[i]).plan);
          const x = i % w, y = (i / w) | 0;
          const stripe = (x + y) % 4 < 2;
          c = stripe ? [c[0] * 0.4 + s[0] * 0.6, c[1] * 0.4 + s[1] * 0.6, c[2] * 0.4 + s[2] * 0.6] : c;
        }
      }
      c = planHeight(c, i, w, h);
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    planCtx.putImageData(img, 0, 0);
    drawPlanRivers();
  }

  // Plan colors get lighter with height and darker below 0 (lowered rivers): a contour line at each whole level,
  // and a heavy line along cliffs.
  function planHeight(c, i, w, h) {
    if (!world.raised) return c;
    const lh = map.settings.levelHeight, L = world.lift[i], band = Math.floor(L / lh), x = i % w;
    const next = [x < w - 1 ? i + 1 : -1, i + w < w * h ? i + w : -1].filter(j => j >= 0);
    const cliff = next.some(j => !Height.canStep(world, i, j));
    const contour = next.some(j => Math.floor(world.lift[j] / lh) !== band);
    const f = cliff ? 0.45 : contour ? 0.8 : 1 + band * 0.06;
    return f === 1 ? c : [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];
  }

  // River strokes as lines on the plan.
  function drawPlanRivers() {
    planCtx.strokeStyle = Types.RIVER_PLAN;
    planCtx.lineCap = planCtx.lineJoin = 'round';
    for (const r of map.rivers) {
      planCtx.lineWidth = r.width;
      planCtx.beginPath();
      r.points.forEach(([x, y], i) => i ? planCtx.lineTo(x + 0.5, y + 0.5) : planCtx.moveTo(x + 0.5, y + 0.5));
      planCtx.stroke();
    }
  }

  // Draws the map and the editor overlay onto the display canvas.
  function present() {
    presentQueued = false;
    if (!map) return;
    const { zoom, panX, panY } = Viewport.state;
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, display.width, display.height);
    dctx.imageSmoothingEnabled = false;
    dctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    dctx.fillRect(panX + 4, panY + 4, map.width * zoom, map.height * zoom);
    if (view === 'plan' && planDirty) buildPlan();
    dctx.drawImage(view === 'plan' ? planCanvas : pictureCanvas(), panX, panY, map.width * zoom, map.height * zoom);
    if (view === 'rendered' && world) Characters.draw(dctx, world, map, palette, frameSource(), time, tint);
    Tabletop.drawGrid(dctx, map);
    Overlay.draw(dctx);
    document.getElementById('zoomLabel').textContent = (zoom >= 10 ? Math.round(zoom) : Math.round(zoom * 10) / 10) + '×';
  }

  // Asks for a redraw on the next animation frame.
  function requestPresent() { presentQueued = true; }

  // Stops or restarts the animation. Remembered in this browser.
  function setPaused(on) {
    paused = on;
    try { localStorage.setItem(PAUSE_KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ }
  }

  // Animation loop: moves characters every frame, advances time and redraws the map at the fps setting.
  // While paused, time stands still and the map is only redrawn when a character is being walked.
  function loop(now) {
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    if (map && world && view === 'rendered') {
      Actors.sync(map);
      if (Actors.count()) {
        Actors.update(dt, world, Play.steer(), !paused, Fire.nightOf(Daylight.darkness(tint)));
        Play.follow();
        presentQueued = true;
      }
    }
    const live = !paused || Play.isActive();
    if (map && world && view === 'rendered' && live && now - lastFrame >= 1000 / map.settings.fps) {
      if (!paused) time += Math.min(0.5, (now - lastFrame) / 1000);
      lastFrame = now;
      drawFrame();
      present();
    } else if (presentQueued) {
      present();
    }
    requestAnimationFrame(loop);
  }

  function setView(v) { view = v; requestPresent(); }
  function getView() { return view; }
  function getMap() { return map; }
  function getWorld() { return world; }
  // The canvas holding the finished picture: the GL canvas on the GL backend, else the map canvas.
  function pictureCanvas() { return backend === 'gl' && GlFrame.ready() ? GlFrame.canvas() : mapCanvas; }
  function getMapCanvas() { return pictureCanvas(); }

  return {
    init, setMap, requestRebuild, rebuildNow, requestPresent, setView, getView,
    getMap, getWorld, getMapCanvas, flashMessage, setPaused, isPaused: () => paused,
    setBackend, getBackend: () => backend, glReason: () => glWhy, lastRebuild: () => lastRebuild,
  };
})();
