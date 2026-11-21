// GlScreen parity test (page: dev/gltest-screen.html). Draws the same scene with Canvas 2D and through GlScreen on canvases of the
// same size and compares the pixels (a pixel matches when every channel is within 2 levels). Results: window.__screenGlResult.
// URL options: ?only=api,synthetic,real,perf (which parts to run).
const ScreenParity = (() => {
  const TOLERANCE = 2;
  const result = window.__screenGlResult = { done: false, rows: [], errors: [], details: [], perf: null };
  const wait = () => new Promise(r => setTimeout(r, 0));
  let glc, ref, refCtx, gl, refRead = null;

  // ---------- Small helpers ----------

  // A seeded generator for test content.
  function mulberry(seed) {
    let a = seed | 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // A canvas w × h of random colours: holes (alpha 0) with probability `holes`, soft (random alpha) or opaque pixels.
  function pattern(w, h, seed, holes = 0.25, soft = false) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), r = mulberry(seed);
    for (let i = 0; i < w * h; i++) {
      img.data[i * 4] = r() * 256; img.data[i * 4 + 1] = r() * 256; img.data[i * 4 + 2] = r() * 256;
      img.data[i * 4 + 3] = r() < holes ? 0 : soft ? 40 + r() * 215 : 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // A canvas filled with one colour by putImageData (the way the game fills its small canvases).
  function solid(w, h, rgba) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) img.data.set(rgba, i * 4);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Resizes both canvases: device size = css size × dpr; the CSS size stays (clientWidth/Height are what the game reads).
  function setSize(cssW, cssH, dpr) {
    for (const c of [glc, ref]) {
      c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
      c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
    }
  }

  // The GL canvas as rows top first (RGBA bytes).
  function readGl() {
    const w = glc.width, h = glc.height, raw = new Uint8Array(w * h * 4), out = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return out;
  }

  // The 2D canvas as rows top first, read through a GL texture: getImageData would make Chrome move the canvas off the GPU
  // (software blending rounds differently), and the game's own display canvas stays on the GPU.
  function readRef() {
    const w = ref.width, h = ref.height, out = new Uint8Array(w * h * 4);
    if (!refRead) refRead = { tex: gl.createTexture(), fbo: gl.createFramebuffer() };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, refRead.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ref);
    gl.bindFramebuffer(gl.FRAMEBUFFER, refRead.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, refRead.tex, 0);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);      // an upload without a flip: texture row 0 is the canvas's top row
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }

  // Forces the 2D canvas to finish (a GL texture upload of it and a one pixel read), without the getImageData readback.
  function readRefPixel() {
    if (!refRead) refRead = { tex: gl.createTexture(), fbo: gl.createFramebuffer() };
    gl.bindTexture(gl.TEXTURE_2D, refRead.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ref);
    gl.bindFramebuffer(gl.FRAMEBUFFER, refRead.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, refRead.tex, 0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Compares the two canvases: how many pixels are within TOLERANCE, the biggest difference, where the bad ones are.
  function compare() {
    const w = glc.width, h = glc.height, a = readRef(), b = readGl();
    let bad = 0, maxDiff = 0, edge = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    const worst = [];
    const busy = (i, x, y) => {                       // a steep colour step next to the pixel (an edge in the picture)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (ny * w + nx) * 4;
        if (Math.abs(a[i] - a[j]) + Math.abs(a[i + 1] - a[j + 1]) + Math.abs(a[i + 2] - a[j + 2]) > 24) return true;
      }
      return false;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (m > maxDiff) maxDiff = m;
        if (m <= TOLERANCE) continue;
        bad++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (busy(i, x, y)) edge++;
        if (worst.length < 4 || m > worst[worst.length - 1].d) {
          worst.push({ x, y, d: m, ref: [a[i], a[i + 1], a[i + 2]], gl: [b[i], b[i + 1], b[i + 2]] });
          worst.sort((p, q) => q.d - p.d);
          if (worst.length > 4) worst.pop();
        }
      }
    }
    const pixels = w * h;
    return { pixels, bad, edgeBad: edge, interiorBad: bad - edge, maxDiff, pct: +(100 * (1 - bad / pixels)).toFixed(4), worst, box: bad ? [x0, y0, x1, y1] : null };
  }

  // ---------- Running a draw on both ----------

  // Draws once on the 2D canvas and once through GlScreen (identical state: the same transform set-up as Stage.present).
  function drawBoth(dpr, draw) {
    const setup = c => { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false; };
    if (refCtx.reset) refCtx.reset();
    refCtx.fillStyle = '#000';
    refCtx.fillRect(0, 0, ref.width, ref.height);
    RngTape.record();
    setup(refCtx);
    draw(refCtx);
    refCtx.setTransform(1, 0, 0, 1, 0, 0);
    GlScreen.beginFrame();
    RngTape.replay();
    setup(GlScreen.context);
    draw(GlScreen.context);
    GlScreen.endFrame();
    RngTape.live();
    return compare();
  }

  // A map for the scenes: a canvas (for 2D) and the same pixels as a texture (for GL). update() refreshes it from the canvas.
  function makeMap(canvas) {
    const ctx = canvas.getContext('2d'), m = { canvas, w: canvas.width, h: canvas.height, tex: null };
    m.update = () => {
      const data = new Uint8Array(ctx.getImageData(0, 0, m.w, m.h).data.buffer);
      if (m.tex) GlTex.update(m.tex, data); else m.tex = GlTex.make(m.w, m.h, 'RGBA8', data);
    };
    m.update();
    return m;
  }

  // Draws the map frame the way Stage.present does (2D: drawImage with smoothing off; GL: drawMapFrame).
  function drawMap(c, m, left, top, zoom, dpr) {
    if (c === GlScreen.context) GlScreen.drawMapFrame(m.tex, m.w, m.h, left, top, zoom, dpr);
    else { c.save(); c.imageSmoothingEnabled = false; c.drawImage(m.canvas, left, top, m.w * zoom, m.h * zoom); c.restore(); }
  }

  // Adds a result row for a scene.
  function row(group, name, dpr, r, extra = {}) {
    result.rows.push({ group, name, dpr, pixels: r.pixels, pct: r.pct, bad: r.bad, edgeBad: r.edgeBad, interiorBad: r.interiorBad, maxDiff: r.maxDiff,
      worst: r.worst.slice(0, 2), ...extra });
  }

  // ---------- API checks ----------

  // The calls that must throw, the state the context must keep, and the colour read back.
  function apiChecks() {
    const c = GlScreen.context, fails = [];
    const check = (name, ok) => { if (!ok) fails.push(name); };
    const throws = (fn, text) => { try { fn(); } catch (e) { return String(e.message).includes(text); } return false; };
    GlScreen.beginFrame();
    ['strokeRect', 'fillText', 'arc', 'lineTo', 'fill', 'stroke', 'createLinearGradient', 'getImageData', 'putImageData', 'createImageData', 'measureText']
      .forEach(n => check(n + ' throws and names itself', throws(() => c[n](), n)));
    check('strokeStyle set throws', throws(() => { c.strokeStyle = 'red'; }, 'strokeStyle'));
    check('globalCompositeOperation multiply throws', throws(() => { c.globalCompositeOperation = 'multiply'; }, 'globalCompositeOperation'));
    c.globalCompositeOperation = 'lighter'; check('lighter reads back', c.globalCompositeOperation === 'lighter');
    c.save(); c.globalCompositeOperation = 'source-over'; c.restore(); check('restore brings lighter back', c.globalCompositeOperation === 'lighter');
    c.globalCompositeOperation = 'source-over';
    check('fillStyle gradient throws', throws(() => { c.fillStyle = {}; }, 'fillStyle'));
    c.fillStyle = 'rgb(255, 128, 0)'; check('fillStyle reads back #ff8000', c.fillStyle === '#ff8000');
    c.fillStyle = 'rgba(1, 2, 3, 0.5)'; check('rgba reads back', c.fillStyle === 'rgba(1, 2, 3, 0.5)');
    c.fillStyle = '#abc'; check('#rgb reads back #aabbcc', c.fillStyle === '#aabbcc');
    c.fillStyle = 'red'; check('named colour reads back #ff0000', c.fillStyle === '#ff0000');
    c.save(); c.fillStyle = '#123456'; c.globalAlpha = 0.5; c.translate(5, 6); c.imageSmoothingEnabled = false; c.restore();
    check('restore brings fillStyle back', c.fillStyle === '#ff0000');
    check('restore brings globalAlpha back', c.globalAlpha === 1);
    check('restore brings smoothing back', c.imageSmoothingEnabled === true);
    check('restore brings the transform back', c.getTransform().e === 0);
    check('canvas has width, height, clientWidth, clientHeight', c.canvas === glc && 'clientHeight' in c.canvas);
    GlScreen.endFrame();
    result.rows.push({ group: 'api', name: 'unsupported methods throw, state is kept, colours read back', pct: fails.length ? 0 : 100, fails });
  }

  // ---------- Synthetic scenes ----------

  const SCENES = [];
  const scene = (name, draw, o = {}) => SCENES.push({ name, draw, ...o });

  // The scenes get env { dpr, map (a noisy map), w, h (css size) }.
  scene('rects: alpha, colour forms, fractional rgb', (c, e) => {
    drawMap(c, e.map, 20, 20, 3, e.dpr);
    const forms = ['#f80', '#ff8800', 'rgb(0, 128, 255)', 'rgba(255, 0, 80, 0.5)', 'rgb(12.5, 200.4, 99.9)', 'rgba(10.7, 20.2, 250.5, 0.37)', 'rgba(255, 255, 255, 0.22)'];
    forms.forEach((f, i) => { c.fillStyle = f; c.fillRect(30 + i * 22, 30 + (i % 3) * 14, 40, 36); });
    c.globalAlpha = 0.3; c.fillStyle = 'rgba(0, 200, 0, 0.5)'; c.fillRect(60, 90, 90, 60);
    c.globalAlpha = 1; c.fillStyle = '#fff'; c.fillRect(160, 90, 1, 100); c.fillRect(165, 90, 30, 1);
    for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(${i * 2}, ${255 - i * 2}, 90, ${(i % 10) / 10})`; c.fillRect(200 + (i % 12) * 6, 100 + Math.floor(i / 12) * 6, 4, 4); }
  });

  scene('additive blending: lighter fills, alpha, images, back to source-over', (c, e) => {
    drawMap(c, e.map, 10, 10, 4, e.dpr);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgb(120, 60, 20)'; c.fillRect(30, 30, 60, 60); c.fillRect(60, 50, 60, 60);
    c.globalAlpha = 0.5; c.fillStyle = 'rgb(40, 90, 200)'; c.fillRect(100, 20, 50, 80);
    c.globalAlpha = 1; c.fillStyle = 'rgba(255, 200, 100, 0.4)'; c.fillRect(140, 60, 40, 40);
    c.restore();
    c.fillStyle = 'rgba(0, 0, 0, 0.5)'; c.fillRect(70, 70, 30, 30);       // plain blending again after the restore
  });

  scene('save/restore nested', (c, e) => {
    drawMap(c, e.map, 10, 10, 4, e.dpr);
    c.fillStyle = '#e33'; c.globalAlpha = 0.8;
    c.save(); c.translate(40, 40); c.fillStyle = '#3e3';
    c.fillRect(0, 0, 30, 30);
    c.save(); c.translate(20, 20); c.globalAlpha = 0.5; c.scale(2, 2); c.fillStyle = 'rgba(0, 0, 255, 0.7)'; c.fillRect(0, 0, 20, 20);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#fff'; c.fillRect(2, 2, 6, 6); c.restore();
    c.fillRect(10, 10, 10, 10); c.restore();
    c.fillRect(100, 0, 20, 20); c.restore();
    c.fillRect(200, 40, 40, 40);
    c.restore();                                          // extra restore: ignored
  });

  scene('transforms: rotate, scale, transform, setTransform', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    c.save(); c.translate(100, 100); c.rotate(Math.PI / 2); c.fillStyle = '#fc0'; c.fillRect(0, 0, 40, 20); c.restore();
    c.save(); c.translate(200, 100); c.scale(2, 0.5); c.fillStyle = 'rgba(255, 0, 0, 0.6)'; c.fillRect(0, 0, 30, 30); c.restore();
    c.save(); c.translate(100, 200); c.rotate(0.5); c.fillStyle = '#0cf'; c.fillRect(0, 0, 50, 24); c.restore();
    c.save(); c.setTransform(1, 0.3, 0, 1, 250, 150); c.fillStyle = '#c0f'; c.fillRect(0, 0, 30, 30); c.restore();
    c.save(); c.transform(1, 0, 0, 1, 300, 20); c.rotate(Math.PI); c.fillStyle = '#0f0'; c.fillRect(0, 0, 25, 15); c.restore();
    c.save(); c.scale(-1, 1); c.fillStyle = '#f0f'; c.fillRect(-350, 220, 40, 20); c.restore();
  }, { tolerantEdges: true });

  scene('clip: rect, nested, with fills and images', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    const img = pattern(20, 20, 5);
    c.save(); c.beginPath(); c.rect(40, 40, 100, 60); c.clip();
    c.fillStyle = 'rgba(255, 200, 0, 0.7)'; c.fillRect(0, 0, 400, 300);
    c.drawImage(img, 30, 30, 80, 80);
    c.save(); c.beginPath(); c.rect(90, 70, 100, 100); c.clip(); c.fillStyle = '#f0a'; c.fillRect(0, 0, 400, 300); c.restore();
    c.fillStyle = '#0ff'; c.fillRect(100, 45, 60, 8);
    c.restore();
    c.fillStyle = '#fff'; c.fillRect(200, 200, 30, 30);
    c.save(); c.translate(150, 150); c.beginPath(); c.rect(0, 0, 40, 40); c.clip(); c.drawImage(img, -10, -10, 100, 100); c.restore();
    c.save(); c.translate(260, 40); c.scale(2, 2); c.beginPath(); c.rect(0, 0, 30, 20); c.clip(); c.fillStyle = '#80f'; c.fillRect(-10, -10, 100, 100); c.restore();
  });

  scene('drawImage: whole scales 1x 2x 3x 4x, 2x3, alpha, soft pixels', (c, e) => {
    drawMap(c, e.map, 0, 0, 4, e.dpr);
    const img = pattern(24, 24, 7), soft = pattern(16, 16, 9, 0, true);
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 10, 10);
    c.drawImage(img, 40, 10, 48, 48);
    c.drawImage(img, 100, 10, 72, 72);
    c.drawImage(img, 190, 10, 96, 96);
    c.drawImage(img, 90, 120, 48, 72);
    c.globalAlpha = 0.45; c.drawImage(img, 160, 130, 60, 60); c.globalAlpha = 1;
    c.drawImage(soft, 240, 130, 64, 64);
    c.drawImage(soft, 320, 130);
  });

  scene('drawImage: fractional scales (1.5x 0.5x 1.375x) and offsets  [Chrome picks its own texel at exact ties]', (c, e) => {
    drawMap(c, e.map, 0, 0, 4, e.dpr);
    const img = pattern(24, 24, 7);
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 10, 120, 36, 36);
    c.drawImage(img, 60, 120, 12, 12);
    c.drawImage(img, 20.5, 220, 48, 48);
    c.drawImage(img, 120, 220, 33, 33);
  }, { informational: true });

  scene('drawImage: one canvas, different content each time', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = cv.height = 16;
    const colors = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 128], [255, 255, 255, 255]];
    colors.forEach((col, i) => {
      const img = ctx.createImageData(16, 16);
      for (let k = 0; k < 256; k++) img.data.set(((k + i) % 7) ? col : [0, 0, 0, 0], k * 4);
      ctx.putImageData(img, 0, 0);
      c.drawImage(cv, 20 + i * 70, 40, 64, 64);
      c.drawImage(cv, 20 + i * 70, 120, 32, 32);
    });
  });

  scene('flash: full-canvas fillRect under setTransform(1, 0, 0, 1, 0, 0)', (c, e) => {
    drawMap(c, e.map, 30, 30, 4, e.dpr);
    c.fillStyle = '#e44'; c.fillRect(50, 50, 80, 80);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgba(255, 255, 255, 0.4)';
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.restore();
    c.fillStyle = '#44e'; c.fillRect(100, 100, 40, 40);
  });

  scene('fractional rects (antialiased edges)', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    c.fillStyle = '#fff';
    c.fillRect(10.3, 5.7, 20.5, 8.25);
    c.fillRect(50.5, 50.5, 12, 12);
    c.fillStyle = 'rgba(255, 0, 0, 0.5)'; c.fillRect(80.25, 80.75, 0.5, 30);
    c.fillStyle = '#0f0'; c.fillRect(120.5, 60.5, 1.5, 1.5);
    c.fillStyle = 'rgba(0, 0, 0, 0.22)'; c.fillRect(100.5, 120, 9, 1.5);
  });

  scene('smoothing on (linear) up and down', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    const img = pattern(16, 16, 21, 0.1, true);
    c.imageSmoothingEnabled = true;
    c.drawImage(img, 20, 20, 80, 80);
    c.drawImage(img, 120, 20, 8, 8);
    c.drawImage(img, 150, 20, 24, 24);
  }, { tolerantEdges: true });

  scene('drawImage sources: ImageBitmap, HTMLImageElement', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    c.drawImage(e.bitmap, 20, 20, 64, 64);
    c.drawImage(e.image, 120, 20, 64, 64);
    c.drawImage(e.bitmap, 200, 30);
    c.drawImage(e.image, 240, 30);
  }, { needsSources: true });

  scene('drawImage: 9 arguments (source rect)', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    const img = pattern(32, 32, 33);
    c.drawImage(img, 8, 8, 16, 16, 20, 20, 64, 64);
    c.drawImage(img, 0, 16, 32, 16, 120, 20, 96, 48);
    c.drawImage(img, 4, 4, 8, 8, 230, 20, 24, 24);
  });

  scene('drawImage: rotated and squashed (death animations)', (c, e) => {
    drawMap(c, e.map, 10, 10, 4, e.dpr);
    const img = pattern(28, 28, 41, 0.3);
    [0, 0.4, 0.9, 1.3].forEach((k, i) => {
      c.save(); c.translate(60 + i * 80, 100); c.rotate(k * k * Math.PI / 2); c.drawImage(img, -28, -56, 56, 56); c.restore();
    });
    [0, 0.5, 1].forEach((k, i) => {
      c.save(); c.translate(60 + i * 80, 220); c.scale(1 + 0.9 * k, 1 - 0.72 * k); c.drawImage(img, -28, -56, 56, 56); c.restore();
    });
    c.save(); c.beginPath(); c.rect(260, 150, 56, 24); c.clip(); c.drawImage(img, 260, 160, 56, 56); c.restore();
  }, { tolerantEdges: true });

  scene('clearRect over content', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    c.fillStyle = '#0af'; c.fillRect(30, 30, 100, 100);
    c.clearRect(50, 50, 40, 40);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 10, 10); c.restore();
  });

  scene('overlap order: images between rects', (c, e) => {
    drawMap(c, e.map, 10, 10, 3, e.dpr);
    const img = pattern(20, 20, 51, 0.2);
    c.fillStyle = '#f00'; c.fillRect(30, 30, 80, 80);
    c.drawImage(img, 50, 50, 80, 80);
    c.fillStyle = 'rgba(0, 0, 255, 0.5)'; c.fillRect(70, 70, 80, 80);
    c.drawImage(img, 90, 90, 40, 40);
    c.fillStyle = 'rgba(0, 255, 0, 0.5)'; c.fillRect(100, 100, 80, 80);
  });

  // ---------- Synthetic runner ----------

  // Makes a noisy map canvas and the sources the scenes need.
  async function sceneEnv(dpr, cssW, cssH) {
    const mc = pattern(100, 75, 1234, 0, false);
    const src = pattern(16, 16, 77, 0.2);
    return { dpr, w: cssW, h: cssH, map: makeMap(mc), bitmap: await createImageBitmap(src), image: await imageOf(src) };
  }

  // An HTMLImageElement of a canvas's pixels (loaded through onload: decode() can hang in the in-app browser).
  async function imageOf(canvas) {
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = canvas.toDataURL(); });
    return img;
  }

  // Every synthetic scene at dpr 1 and 2, then the map frame at other zooms and dpr.
  async function runSynthetic() {
    for (const dpr of [1, 2]) {
      setSize(400, 300, dpr);
      const env = await sceneEnv(dpr, 400, 300);
      for (const sc of SCENES) {
        try { row('synthetic', sc.name, dpr, drawBoth(dpr, c => sc.draw(c, env)), { note: sc.informational ? 'informational' : sc.tolerantEdges ? 'rotated/skewed or smoothed edges' : '' }); }
        catch (e) { result.errors.push(`${sc.name} @${dpr}: ${e.stack || e}`); }
      }
    }
    await mapScaleScenes();
  }

  // The map frame at other zooms and dpr (1.5, 3), with an overlay of fills on it.
  async function mapScaleScenes() {
    for (const [dpr, z, left, top] of [[1, 3, 17, 11], [1, 5, 17, 11], [2, 3, 17, 11], [1.5, 4, 18, 10], [1.5, 4, 17, 11], [1.25, 4, 16, 12], [3, 2, 17, 11], [1, 1, 17, 11]]) {
      setSize(400, 300, dpr);
      const env = await sceneEnv(dpr, 400, 300);
      const draw = c => {
        drawMap(c, env.map, left, top, z, dpr);
        c.fillStyle = 'rgba(255, 0, 0, 0.5)'; c.fillRect(30, 30, 50, 50);
        c.fillStyle = '#fff'; for (let x = 0; x < 100; x += 10) c.fillRect(left + x * z, top, 1, 75 * z);
      };
      try { row('map frame', `zoom ${z}, dpr ${dpr}, at ${left},${top}`, dpr, drawBoth(dpr, draw), { note: (left * dpr) % 1 || (top * dpr) % 1 ? 'informational: origin on a fractional device pixel' : '' }); } catch (e) { result.errors.push(`map frame ${z}/${dpr}: ${e.stack || e}`); }
    }
  }

  // ---------- The game's own overlay ----------

  const STAGE = { cssW: 720, cssH: 520, zoom: 4, panX: 60, panY: 40 };
  let gameMap = null;

  // Finds the Stage's map canvas by watching its first drawImage onto the display, then keeps a texture of it.
  function grabStageMap() {
    const dctx = document.getElementById('stage').getContext('2d'), original = dctx.drawImage;
    let grabbed = null;
    dctx.drawImage = function (src, ...rest) { grabbed = grabbed || src; return original.call(this, src, ...rest); };
    Stage.step(0);
    dctx.drawImage = original;
    if (!grabbed) throw new Error('could not find the Stage map canvas');
    gameMap = makeMap(grabbed);
  }

  // The synthetic Stage grid (Stage.drawGrid's calls), for the grid scene.
  function stageGrid(c) {
    const m = Stage.getMap(), z = Stage.cam.zoom, o = Stage.toScreen(0, 0);
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let x = 0; x <= m.width; x += Stage.SQUARE) c.fillRect(Math.round(o.x + x * z), o.y, 1, m.height * z);
    for (let y = 0; y <= m.height; y += Stage.SQUARE) c.fillRect(o.x, Math.round(o.y + y * z), m.width * z, 1);
  }

  // A fight's grid overlay view: reachable squares, a path, targets, a hover, a current figure, marks and an area.
  function gridView() {
    const reach = new Map(), path = [];
    for (let sx = 2; sx < 9; sx++) for (let sy = 3; sy < 8; sy++) reach.set(sx + ',' + sy, { sx, sy, cost: (sx + sy) % 4, through: sx === 5 && sy === 4 });
    for (let k = 3; k < 8; k++) path.push({ sx: k, sy: 5 });
    const f = Figures.list;
    GridOverlay.set({ reach, path, targets: [f[5], f[6]], hover: f[6], current: f[1], marks: [{ sx: 9, sy: 3 }], area: [{ sx: 8, sy: 6 }, { sx: 9, sy: 6 }, { sx: 8, sy: 7 }] });
  }

  // Compares the page's overlay at the current game frame, over the Stage's map.
  function compareGame(group, name, frame, overlay) {
    Stage.cam.zoom = STAGE.zoom; Stage.cam.panX = STAGE.panX; Stage.cam.panY = STAGE.panY;
    gameMap.update();
    const draw = c => { drawMap(c, gameMap, STAGE.panX + Stage.cam.shakeX, STAGE.panY + Stage.cam.shakeY, STAGE.zoom, 1); overlay(c); };
    const r = drawBoth(1, draw);
    result.details.push({ group, name, frame, pct: r.pct, bad: r.bad, edgeBad: r.edgeBad, maxDiff: r.maxDiff, worst: r.worst.slice(0, 2), box: r.box, rects: GlScreen.stats().rects, images: GlScreen.stats().images });
    return r;
  }

  // Steps the game `n` frames, calling `at(frame)` on the frames of the list.
  async function stepFrames(frames, each) {
    const last = frames[frames.length - 1];
    for (let f = 1; f <= last; f++) {
      Stage.step(1 / 30);
      if (f % 2 === 0) await wait();
      if (frames.includes(f)) each(f);
    }
  }

  // One scene's summary row from its sampled frames.
  function summary(group, name, rs) {
    const worst = rs.reduce((a, b) => (b.pct < a.pct ? b : a));
    const total = rs.reduce((a, r) => a + r.pixels, 0), bad = rs.reduce((a, r) => a + r.bad, 0);
    row(group, name, 1, { ...worst, pixels: total, bad, pct: +(100 * (1 - bad / total)).toFixed(4) }, { samples: rs.length, worstPct: worst.pct, worstMaxDiff: Math.max(...rs.map(r => r.maxDiff)) });
  }

  // Sampled frames (30 fps steps) after starting an effect.
  const SAMPLES = [2, 5, 8, 12, 16, 20, 25, 30, 38, 48, 60, 75, 90];

  // Casts an effect in the lab and compares sampled frames of it.
  async function castScene(name) {
    Lab.reset();
    Fx.update(0);
    const rs = [];
    const done = Lab.cast(name);
    done.catch(e => result.errors.push(`cast ${name}: ${e}`));
    await stepFrames(SAMPLES, f => rs.push(compareGame('effects', name, f, ScreenHooks.draw)));
    let guard = 0;
    while (Lab.busy() && guard++ < 400) { Stage.step(1 / 30); await wait(); }
    await done;
    summary('game effects', name, rs);
  }

  // Kills a goblin, slime, cultist, skeleton, paladin and rogue (topple, melt, sink, collapse, down) and compares frames.
  async function deathScene() {
    Lab.reset();
    for (const f of Figures.list.filter(f => ['Goblin 2', 'Slime', 'Cultist', 'Skeleton', 'Paladin', 'Rogue'].includes(f.name))) Deaths.start(f, f.side === 'hero' ? -1 : 1);
    const rs = [];
    await stepFrames([1, 3, 6, 9, 12, 16, 20, 26, 34, 45], f => rs.push(compareGame('deaths', 'death', f, ScreenHooks.draw)));
    summary('game deaths', 'topple, melt, sink, collapse, down', rs);
  }

  // Damage numbers, text, status labels, health bars, outline, flash, mirror images and ghosts.
  async function popupScene() {
    Lab.reset();
    const f = Figures.list;
    Popups.add('12', f[5].x, f[5].y - 14, { color: 'damage', big: true });
    Popups.add('CRIT 27', f[6].x, f[6].y - 14, { color: 'crit', big: true, delay: 0.05 });
    Popups.add('MISS', f[7].x, f[7].y - 14, { color: 'miss' });
    Popups.add('+8', f[3].x, f[3].y - 14, { color: 'heal', big: true });
    Popups.add('SAVE', f[8].x, f[8].y - 14, { color: 'info' });
    f[0].status = [{ short: 'ZZ', color: 'necrotic' }, { short: 'BLS', color: 'radiant' }];
    f[1].hp = Math.floor(f[1].maxHp / 3); f[2].hp = Math.floor(f[2].maxHp * 0.7);
    f[4].outline = [255, 70, 70, 254]; f[3].flash = [255, 255, 255, 255];
    f[1].images = 3; f[2].ghosts = [{ x: f[2].x - 3, y: f[2].y, age: 0.05 }, { x: f[2].x - 6, y: f[2].y, age: 0.12 }]; f[4].alpha = 0.5;
    f[9].lean = 3; f[9].lift = 2;
    const rs = [];
    await stepFrames([1, 4, 8, 12, 16, 20, 24], fr => rs.push(compareGame('popups', 'popups', fr, ScreenHooks.draw)));
    Object.assign(f[0], { status: null }); f[4].outline = null; f[3].flash = null; f[1].images = 0; f[2].ghosts = []; f[4].alpha = 1; f[9].lean = f[9].lift = 0;
    summary('game popups', 'damage numbers, MISS, CRIT, status labels, health bars, outline, flash, images, ghosts, names', rs);
  }

  // The dice tray: a natural 20 (two dice, sparks), a natural 1, and a plain save.
  async function diceScene() {
    Lab.reset();
    const specs = [
      { value: 20, dropped: 7, bonus: 5, vs: 'AC 15', label: 'ATTACK ADV', result: 'HIT' },
      { value: 1, dropped: null, bonus: -1, vs: 'AC 12', label: 'ATTACK', result: 'MISS' },
      { value: 13, dropped: 4, bonus: 3, vs: 'DC 14', label: 'DEX SAVE', result: 'SAVE' },
    ];
    for (const spec of specs) {
      DiceTray.show(spec);
      const rs = [];
      await stepFrames([2, 6, 10, 14, 17, 20, 30, 45, 60, 70], fr => rs.push(compareGame('dice', 'dice', fr, ScreenHooks.draw)));
      summary('game dice tray', `d20 = ${spec.value}${spec.dropped != null ? ' (two dice)' : ''}`, rs);
      for (let k = 0; k < 40; k++) Stage.step(1 / 30);
    }
  }

  // The fight's grid overlay and the Stage grid.
  async function gridScene() {
    Lab.reset();
    gridView();
    const rs = [];
    Stage.step(0);
    rs.push(compareGame('grid', 'grid overlay', 1, c => { GridOverlay.draw(c); ScreenHooks.draw(c); }));
    rs.push(compareGame('grid', 'stage grid', 2, c => { stageGrid(c); GridOverlay.draw(c); ScreenHooks.draw(c); }));
    GridOverlay.set({ reach: null, path: [], targets: [], hover: null, current: null, marks: [], area: null });
    summary('game grid', 'GridOverlay (reach, path, rings, crosses, area) + the 1 px grid', rs);
  }

  // ?real=a,b runs only the named real scenes (grid, an effect name, deaths, popups, dice, dpr2).
  const wants = name => { const w = new URLSearchParams(location.search).get('real'); return !w || w.split(',').includes(name); };

  // Odd zooms at dpr 1 draw the figures at 1.5x and 2.5x (half size): nearest sampling at exact ties differs from Chrome's.
  async function oddZoomScenes() {
    for (const [zoom, panX, panY] of [[3, 100, 80], [5, 0, 0]]) {
      Object.assign(STAGE, { zoom, panX, panY });
      Lab.reset();
      const done = Lab.cast('fireball'), rs = [];
      await stepFrames([6, 14, 22, 32, 45], f => rs.push(compareGame('odd zoom', `fireball zoom ${zoom}`, f, ScreenHooks.draw)));
      let guard = 0;
      while (Lab.busy() && guard++ < 400) { Stage.step(1 / 30); await wait(); }
      await done;
      summary('game effects, odd zoom (informational)', `fireball at zoom ${zoom}, dpr 1: figures at ${zoom / 2}x`, rs);
    }
    Object.assign(STAGE, { zoom: 4, panX: 60, panY: 40 });
  }

  // The game's own overlay over the Stage's map: effects, deaths, popups, dice tray, grid.
  async function runReal() {
    Stage.setManual(true);
    Stage.cam.zoom = STAGE.zoom; Stage.cam.panX = STAGE.panX; Stage.cam.panY = STAGE.panY;
    setSize(STAGE.cssW, STAGE.cssH, 1);
    grabStageMap();
    if (wants('grid')) await gridScene();
    const dice = document.getElementById('dice');            // the lab's dice tray off: effects start at once (the tray has its own scenes)
    dice.checked = false; dice.dispatchEvent(new Event('change'));
    for (const name of ['fireball', 'lightningBolt', 'magicMissile', 'flamingSphere', 'spiritGuardians', 'hypnoticPattern', 'fireBreath', 'sacredFlame', 'shield',
      'swordSwing', 'throwDagger', 'skeletonArrow', 'mirrorImage', 'haste', 'divineSmite', 'cureWounds', 'slimeAcid']) {
      if (!wants(name)) continue;
      try { await castScene(name); } catch (e) { result.errors.push(`${name}: ${e.stack || e}`); }
    }
    for (const [key, fn] of [['deaths', deathScene], ['popups', popupScene], ['dice', diceScene]]) { if (!wants(key)) continue; try { await fn(); } catch (e) { result.errors.push(`${fn.name}: ${e.stack || e}`); } }
    if (wants('dpr2')) await realDpr2();
    if (wants('odd')) await oddZoomScenes();
  }

  // The same overlay at dpr 2 (the canvas twice as big, the page's transform scale(2)): a fireball and the dice tray.
  async function realDpr2() {
    setSize(STAGE.cssW, STAGE.cssH, 2);
    Lab.reset();
    const done = Lab.cast('fireball');
    const rs = [];
    const frame = c => { drawMap(c, gameMap, STAGE.panX + Stage.cam.shakeX, STAGE.panY + Stage.cam.shakeY, STAGE.zoom, 2); ScreenHooks.draw(c); };
    await stepFrames([10, 25, 40, 55], () => { gameMap.update(); rs.push(drawBoth(2, frame)); });
    let guard = 0;
    while (Lab.busy() && guard++ < 400) { Stage.step(1 / 30); await wait(); }
    await done;
    summary('game effects (dpr 2)', 'fireball + dice tray, canvas 2x', rs);
    setSize(STAGE.cssW, STAGE.cssH, 1);
  }

  // ---------- Performance ----------

  // The calls of a busy frame: about 2000 fillRects and 30 drawImages, the same on both contexts.
  function makeBusy(w, h) {
    const r = mulberry(99), rects = [], sprites = [];
    const colors = Array.from({ length: 64 }, (_, i) => i % 4 ? `rgb(${(r() * 255) | 0}, ${(r() * 255) | 0}, ${(r() * 255) | 0})` : `rgba(${(r() * 255) | 0}, 90, 40, ${(0.2 + r() * 0.6).toFixed(2)})`);
    for (let i = 0; i < 2000; i++) rects.push([r() * (w - 20) | 0, r() * (h - 20) | 0, 2 + (r() * 6 | 0), 2 + (r() * 6 | 0), colors[i % 64]]);
    const figure = pattern(28, 28, 3, 0.4), tray = pattern(92, 34, 4, 0, true);
    for (let i = 0; i < 30; i++) sprites.push(i % 10 === 0 ? [tray, 12 + i * 3, h - 120, 276, 102, 0.8] : [figure, r() * (w - 60) | 0, r() * (h - 60) | 0, 42, 42, 1]);
    return (c, map, mapDraw) => {
      mapDraw(c);
      for (let i = 0; i < 2000; i++) { const q = rects[i]; c.fillStyle = q[4]; c.fillRect(q[0], q[1], q[2], q[3]); }
      for (let i = 0; i < 30; i++) { const s = sprites[i]; c.globalAlpha = s[5]; c.drawImage(s[0], s[1], s[2], s[3], s[4]); c.globalAlpha = 1; }
    };
  }

  // Times a function over n frames, returning the average ms per frame.
  function timeIt(n, fn) { const t = performance.now(); for (let i = 0; i < n; i++) fn(i); return (performance.now() - t) / n; }

  // Times a busy frame through GlScreen and through Canvas 2D.
  async function runPerf() {
    const dpr = 2, cssW = 800, cssH = 500;
    setSize(cssW, cssH, dpr);
    const env = await sceneEnv(dpr, cssW, cssH), busy = makeBusy(cssW, cssH);
    const mapDraw = c => drawMap(c, env.map, 20, 20, 5, dpr);
    const N = 200, out = { canvas: `${glc.width} x ${glc.height}`, rects: 2000, images: 30, frames: N };
    const glFrame = () => { GlScreen.beginFrame(); GlScreen.context.setTransform(dpr, 0, 0, dpr, 0, 0); busy(GlScreen.context, env.map, mapDraw); GlScreen.endFrame(); };
    const record = () => { GlScreen.beginFrame(); GlScreen.context.setTransform(dpr, 0, 0, dpr, 0, 0); busy(GlScreen.context, env.map, mapDraw); };
    const flush = () => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); };
    const flush2d = () => { readRefPixel(); };
    const frame2d = () => { refCtx.setTransform(1, 0, 0, 1, 0, 0); refCtx.fillStyle = '#000'; refCtx.fillRect(0, 0, ref.width, ref.height); refCtx.setTransform(dpr, 0, 0, dpr, 0, 0); refCtx.imageSmoothingEnabled = false; busy(refCtx, env.map, mapDraw); };
    for (let k = 0; k < 20; k++) { glFrame(); frame2d(); }              // warm up
    flush(); flush2d();
    out.glRecordMs = +timeIt(N, record).toFixed(3);                       // recording only (no GL work yet)
    GlScreen.endFrame();
    flush();
    out.glJsMs = +timeIt(N, glFrame).toFixed(3);                          // record + submit, GPU not waited for
    flush();
    out.glWallMs = +timeIt(N, () => { glFrame(); flush(); }).toFixed(3);   // record + submit + the GPU finished
    out.canvas2dJsMs = +timeIt(N, frame2d).toFixed(3);
    flush2d();
    out.canvas2dWallMs = +timeIt(N, () => { frame2d(); flush2d(); }).toFixed(3);
    out.glGpuMs = await gpuTime(glFrame);
    result.perf = out;
  }

  // One frame's GPU time from a timer query around a batch of frames (idle GPUs clock down, so a single frame reads high);
  // null when the browser has no timer query.
  async function gpuTime(frame) {
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return null;
    const BATCH = 40, times = [];
    for (let round = 0; round < 8; round++) {
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      for (let i = 0; i < BATCH; i++) frame();
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      for (let k = 0; k < 400 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); k++) await wait();
      if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) times.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / BATCH);
      gl.deleteQuery(q);
    }
    times.sort((a, b) => a - b);
    return times.length ? +times[Math.floor(times.length / 2)].toFixed(3) : null;
  }

  // ---------- Context loss ----------

  // Loses the GL context: GlScreen must report it (Gl.onLost), turn dead, and take every call as a no-op without throwing.
  async function contextLoss() {
    const ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) { result.rows.push({ group: 'context loss', name: 'WEBGL_lose_context missing: not tested', pct: 100 }); return; }
    let reported = false;
    Gl.onLost(() => { reported = true; });
    const lost = new Promise(r => glc.addEventListener('webglcontextlost', r, { once: true }));
    ext.loseContext();
    await lost;
    await wait();
    let threw = null;
    try {
      GlScreen.beginFrame();
      const c = GlScreen.context;
      c.fillStyle = '#fff'; c.fillRect(0, 0, 10, 10); c.drawImage(solid(4, 4, [1, 2, 3, 255]), 0, 0); GlScreen.drawMapFrame(null, 1, 1, 0, 0, 1, 1);
      GlScreen.endFrame();
    } catch (e) { threw = e; }
    const ok = threw === null && GlScreen.isDead() && reported;
    result.rows.push({ group: 'context loss', name: 'lost context: Gl.onLost fired, GlScreen dead, calls are no-ops', pct: ok ? 100 : 0, threw: threw && String(threw) });
  }

  // ---------- Main ----------

  // Prints the result rows on the page.
  function report() {
    const lines = result.rows.map(r => `${String(r.pct).padStart(8)}%  ${r.group} | ${r.name}${r.dpr && r.group !== 'api' ? ' @dpr ' + r.dpr : ''}${r.maxDiff !== undefined ? '  maxDiff ' + r.maxDiff : ''}`);
    if (result.perf) lines.push('', JSON.stringify(result.perf));
    if (result.errors.length) lines.push('', 'ERRORS:', ...result.errors);
    document.getElementById('report').textContent = lines.join('\n');
  }

  // Attaches GlScreen and runs the parts asked for.
  async function main() {
    const only = (new URLSearchParams(location.search).get('only') || 'api,synthetic,real,perf,loss').split(',');
    glc = document.getElementById('glc');
    ref = document.getElementById('ref');
    refCtx = ref.getContext('2d');
    result.attached = GlScreen.attach(glc);
    if (!result.attached) { result.errors.push('GlScreen.attach returned false'); result.done = true; return; }
    gl = Gl.get();
    setSize(400, 300, 1);
    for (const [key, fn] of [['api', async () => apiChecks()], ['synthetic', runSynthetic], ['real', runReal], ['perf', runPerf], ['loss', contextLoss]]) {
      if (!only.includes(key)) continue;
      try { await fn(); } catch (e) { result.errors.push(`${key}: ${e.stack || e}`); }
    }
    result.done = true;
    report();
  }

  main();
  return { result, drawBoth, setSize, pattern, makeMap, drawMap, compare, readGl, ref: () => refCtx, mulberry };
})();
