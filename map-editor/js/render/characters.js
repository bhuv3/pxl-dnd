// Draws characters at half size with full detail (2 character pixels per map pixel), on the display canvas.
// Things standing in front of a character are copied back over it from the rendered frame.
const Characters = (() => {
  const PAD = 6;                       // character-pixel margin for sparkles around the sprite
  const SPARK = [214, 246, 255];
  const ORB_LIGHT = [0.9, 1.15, 1.5];
  const ORB_R = 14;
  const ORB_SELF = 0.75;               // how much his own orb (or a carried light) lights him in the dark (1 = full daylight)
  const FRONT_W = 22, FRONT_H = 22;    // map-pixel box checked for things in front
  const SINK = 3;                      // character-pixel rows hidden under the water while wading
  const DIRT = [[78, 58, 38], [112, 84, 56]];   // earth thrown up by something climbing out of the ground
  let spriteCanvas, spriteCtx, frontCanvas, frontCtx;

  function setup() {
    const n = CharacterArt.SIZE + PAD * 2;
    spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = n;
    spriteCtx = spriteCanvas.getContext('2d');
    frontCanvas = document.createElement('canvas');
    frontCanvas.width = FRONT_W; frontCanvas.height = FRONT_H;
    frontCtx = frontCanvas.getContext('2d');
  }

  // Draws every character, back to front. ctx is already set to screen space.
  function draw(ctx, world, map, pal, frame, time, tint) {
    if (!spriteCanvas) setup();
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const night = Fire.nightOf(Daylight.darkness(tint));
    const selfLit = tint.map(c => c + (1 - c) * night * ORB_SELF);
    for (const a of Actors.list().sort((p, q) => p.y - q.y)) {
      const art = CharacterArt.get(a.type, a.seed);
      if (!art || (a.rise && a.up <= 0)) continue;
      const lift = Height.liftAt(world, a.x, a.y), wet = Tracks.wading(world, a.x, a.y);
      const d = art.dirs[a.dir];
      if (a.rise && a.up < 1) {
        // Climbing out of the ground (or sinking back): drawn lower, with the part below the ground cut off.
        const under = Math.round((1 - a.up) * (d.bottom + 1));
        drawDirt(ctx, a, lift, time, tint);
        drawSprite(ctx, a, d, time, tint, lift - under / 2, under);
      } else {
        if (!wet) drawShadow(ctx, a, lift);
        drawSprite(ctx, a, d, time, art.hasOrb || art.light ? selfLit : tint, lift, wet ? SINK : 0);
      }
      drawFront(ctx, a, world, map, pal, frame, time, lift);
    }
    ctx.restore();
  }

  // A small dark oval under the feet, on the map's pixel grid. lift: pixels he's drawn raised (height levels).
  function drawShadow(ctx, a, lift) {
    const z = Viewport.state.zoom;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let dy = -1; dy <= 1; dy++) {
      const half = dy ? 2 : 4;
      const p = Viewport.toScreen(Math.floor(a.x) - half, Math.floor(a.y) + dy - lift);
      ctx.fillRect(p.x, p.y, (half * 2 + 1) * z, z);
    }
  }

  // Broken earth round the feet of something climbing out of the ground, with clods flying up.
  function drawDirt(ctx, a, lift, time, tint) {
    const z = Viewport.state.zoom, x = Math.floor(a.x), y = Math.floor(a.y) - lift;
    const earth = c => `rgb(${Math.round(c[0] * tint[0])}, ${Math.round(c[1] * tint[1])}, ${Math.round(c[2] * tint[2])})`;
    ctx.fillStyle = earth(DIRT[0]);
    for (let dx = -3; dx <= 3; dx++) { const p = Viewport.toScreen(x + dx, y + (Math.abs(dx) === 3 ? 0 : 1)); ctx.fillRect(p.x, p.y, z, z); }
    ctx.fillStyle = earth(DIRT[1]);
    for (let k = 0; k < 4; k++) {
      const t = (time * 1.5 + k * 0.25 + a.id * 0.37) % 1;
      const p = Viewport.toScreen(x + (k - 1.5) * 2 + Math.round((k - 1.5) * t * 2), y - Math.round(Math.sin(t * Math.PI) * 4));
      ctx.fillRect(p.x, p.y, z, z);
    }
  }

  // Current walk frame, tinted for the time of day. The orb stays bright and sparkles. sink: rows of feet hidden in water.
  function drawSprite(ctx, a, d, time, tint, lift, sink) {
    const S = CharacterArt.SIZE, n = S + PAD * 2;
    const src = a.moving ? d.frames[Math.floor(a.walkT) % 4] : d.stand;
    const img = spriteCtx.createImageData(n, n);
    const out = img.data;
    const pulse = 0.88 + 0.12 * Math.sin(time * 3 + a.id);
    for (let y = 0; y <= d.bottom - sink; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        if (!src[i + 3]) continue;
        const o = ((y + PAD) * n + x + PAD) * 4;
        const orb = d.orb && d.orb.set.has(y * S + x), glow = src[i + 3] === 254;
        for (let k = 0; k < 3; k++) out[o + k] = orb ? Math.min(255, src[i + k] * pulse * 1.05) : glow ? src[i + k] : src[i + k] * tint[k];
        out[o + 3] = 255;
      }
    }
    if (d.orb) addSparkles(out, n, d.orb, time, a.id);
    spriteCtx.putImageData(img, 0, 0);
    const z = Viewport.state.zoom;
    const top = Viewport.toScreen(Math.floor(a.x * 2) / 2 - (d.footX + PAD) / 2, Math.floor(a.y) + 1 - lift - (d.bottom + 1 + PAD) / 2);
    ctx.drawImage(spriteCanvas, top.x, top.y, n * z / 2, n * z / 2);
  }

  // Two tiny lights drifting up from the orb and fading.
  function addSparkles(out, n, orb, time, seed) {
    for (let k = 0; k < 2; k++) {
      const age = (time * 0.7 + k * 0.5 + seed * 0.13) % 1;
      const x = Math.round(orb.x + PAD + Math.sin(time * 2 + k * 3 + seed) * 2);
      const y = Math.round(orb.y + PAD - 2 - age * 7);
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const o = (y * n + x) * 4;
      out.set(SPARK, o);
      out[o + 3] = Math.round((1 - age) * 255);
    }
  }

  // Re-draws the parts of things in front of the character (base lower on screen), copied from the frame.
  // On raised maps the frame's depth buffer says which pixels were drawn by rows in front of him (cliffs too).
  function drawFront(ctx, a, world, map, pal, frame, time, lift) {
    const x0 = Math.floor(a.x) - (FRONT_W >> 1), y0 = Math.floor(a.y) - lift - FRONT_H + 2;
    const mask = new Uint8Array(FRONT_W * FRONT_H);
    const any = world.raised ? markDepth(world, mask, x0, y0, Math.floor(a.y)) : markThings(world, map, pal, time, a, mask, x0, y0);
    if (!any) return;
    // frame is the CPU picture, or (GL backend) an object whose readRegion reads just this window from the GPU.
    const region = frame.readRegion ? frame.readRegion(x0, y0, FRONT_W, FRONT_H) : null;
    const src = region ? region.data : frame;
    const img = frontCtx.createImageData(FRONT_W, FRONT_H);
    for (let ly = 0; ly < FRONT_H; ly++) {
      for (let lx = 0; lx < FRONT_W; lx++) {
        const x = x0 + lx, y = y0 + ly;
        if (!mask[ly * FRONT_W + lx] || x < 0 || y < 0 || x >= world.w || y >= world.h) continue;
        const i = region ? ((y - region.y) * region.w + (x - region.x)) * 4 : (y * world.w + x) * 4, o = (ly * FRONT_W + lx) * 4;
        img.data[o] = src[i]; img.data[o + 1] = src[i + 1]; img.data[o + 2] = src[i + 2]; img.data[o + 3] = 255;
      }
    }
    frontCtx.putImageData(img, 0, 0);
    const z = Viewport.state.zoom;
    const p = Viewport.toScreen(x0, y0);
    ctx.drawImage(frontCanvas, p.x, p.y, FRONT_W * z, FRONT_H * z);
  }

  // Marks pixels of things in front of him (flat maps). Returns true if any.
  function markThings(world, map, pal, time, a, mask, x0, y0) {
    let any = false;
    const mark = (x, y) => {
      const lx = x - x0, ly = y - y0;
      if (lx < 0 || ly < 0 || lx >= FRONT_W || ly >= FRONT_H) return;
      mask[ly * FRONT_W + lx] = 1;
      any = true;
    };
    for (const t of world.things) {
      if (t.y <= a.y - 0.5 || !Animals.covers(t, { x: a.x, y: Math.min(a.y, t.y - 0.01) }, 40, 30) || (t.sprite && t.sprite.flat)) continue;
      Details.drawThing(mark, t, map.settings, pal, time);
    }
    return any;
  }

  // Marks pixels drawn by map rows in front of row (raised maps). Returns true if any.
  function markDepth(world, mask, x0, y0, row) {
    let any = false;
    for (let ly = 0; ly < FRONT_H; ly++) {
      for (let lx = 0; lx < FRONT_W; lx++) {
        const x = x0 + lx, y = y0 + ly;
        if (x < 0 || y < 0 || x >= world.w || y >= world.h || world.depth[y * world.w + x] <= row) continue;
        mask[ly * FRONT_W + lx] = 1;
        any = true;
      }
    }
    return any;
  }

  // At night or underground, each orb adds a cool light around it (walls block it), even when he faces away from us.
  // Characters that carry a light (a torch, a candle, a glowing slime) light up around them too.
  function addLights(world, dark) {
    const night = Fire.nightOf(dark);
    if (night <= 0) return;
    for (const a of Actors.list()) {
      const art = CharacterArt.get(a.type, a.seed);
      if (art && art.light) {
        const l = art.light, lx = Math.round(a.x), ly = Math.floor(a.y) - Height.liftAt(world, a.x, a.y) - (l.up || 0);
        Fire.addLight(world, lx, ly, night * (l.power || 1), l.color, l.radius, Fire.sight(world, lx, ly, l.radius));
      }
      if (!art || !art.hasOrb) continue;
      const d = art.dirs[a.dir];
      const ox = d.orb ? Math.round(a.x + (d.orb.x - d.footX) / 2) : Math.round(a.x);
      const oy = Math.floor(a.y) - Height.liftAt(world, a.x, a.y);
      Fire.addLight(world, ox, oy, night * 1.2, ORB_LIGHT, ORB_R, Fire.sight(world, ox, oy, ORB_R));
    }
  }

  return { draw, addLights };
})();
