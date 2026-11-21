// The people and monsters on the stage: drawn at half size like the editor's characters, in their current pose
// (Poses), with knockback, a white flash, a colored outline, fading, and afterimages, all set by effects, and
// Mirror Image's duplicates (images: how many) drifting round them. Lit by the floor under them. Dead ones are drawn by Deaths; hurt ones show a small health bar.
const Figures = (() => {
  const S = CharacterArt.SIZE, PAD = 6, N = S + PAD * 2;
  const ORB_LIGHT = [0.9, 1.15, 1.5], ORB_R = 14, ORB_SELF = 0.75;
  const GHOST_LIFE = 0.25;
  const list = [];
  let canvas, ctx;

  // Adds a figure. o: { name, key, seed, x, y, dir, side, light (a carried light, like the art's) }.
  // pose: a pose name (Poses); arm: a swung arm's angle; hideHeld: a blade effect is drawing the weapon;
  // moving / walkT: walking, and how far through the 4 walk frames.
  function add(o) {
    const f = { id: list.length + 1, dir: 'south', side: 'hero', ...o, pose: null, arm: null, moving: false, walkT: 0,
      lean: 0, lift: 0, knockX: 0, knockY: 0, flash: null, outline: null, hideHeld: false, alpha: 1, ghosts: [],
      dead: null, base: { x: o.x, y: o.y } };
    list.push(f);
    return f;
  }

  function art(f) { return CharacterArt.get(f.key, f.seed); }

  // 1 facing right, -1 facing left, 0 straight up or down.
  function facing(f) { return f.dir.includes('east') ? 1 : f.dir.includes('west') ? -1 : 0; }

  // Turns a figure toward a map point.
  function face(f, x) { if (Math.abs(x - f.x) > 1) f.dir = x > f.x ? 'east' : 'west'; }

  // Where the hand is, in map pixels (projectiles start here): a hero's real hand in its pose.
  function hand(f) {
    if (Heroes.has(f.key) && facing(f)) return Heroes.handPoint(f, f.arm ?? Heroes.armOf(f.pose), f.pose);
    return { x: f.x + facing(f) * 3 + knock(f).x, y: f.y - 8 + knock(f).y };
  }
  // Middle of the body, in map pixels (hits land here).
  function chest(f) { return { x: f.x + knock(f).x, y: f.y - 7 + knock(f).y }; }
  function knock(f) { return { x: f.knockX, y: f.knockY }; }
  // Just above the head, in map pixels (numbers rise from here).
  function head(f) {
    const a = art(f), d = a && a.dirs[f.dir];
    let top = 0;
    if (d) while (top < d.bottom && !d.stand.subarray(top * S * 4, (top + 1) * S * 4).some((v, i) => i % 4 === 3 && v)) top++;
    return { x: f.x, y: f.y - (d ? (d.bottom - top) / 2 : 16) - 3 };
  }

  // Draws every figure, the fallen first (they lie under the living), then back to front; then health bars.
  function draw(c2d) {
    if (!canvas) { canvas = document.createElement('canvas'); canvas.width = canvas.height = N; ctx = canvas.getContext('2d'); }
    const night = Stage.getNight(), time = Stage.getTime();
    c2d.save();
    c2d.imageSmoothingEnabled = false;
    for (const f of [...list].sort((p, q) => (p.dead ? p.y - 1000 : p.y) - (q.dead ? q.y - 1000 : q.y))) {
      const a = art(f);
      if (!a) continue;
      const lit = Stage.lightAt(f.x, f.y + 1), glows = !f.dead && (a.hasOrb || a.light || f.light);
      if (!f.dead) drawShadow(c2d, f);
      drawSprite(c2d, f, a.dirs[f.dir], glows ? lit.map(c => c + Math.max(0, 1 - c) * night * ORB_SELF) : lit, time);
    }
    list.forEach(f => drawHealth(c2d, f));
    list.forEach(f => drawStatus(c2d, f));
    c2d.restore();
  }

  // Ages afterimages (called on the effect clock).
  function update(dt) {
    for (const f of list) f.ghosts = f.ghosts.filter(g => (g.age += dt) < GHOST_LIFE);
  }

  // A thin bar over the head while hurt: green, then yellow, then red.
  function drawHealth(c2d, f) {
    if (f.dead || f.hp === undefined || f.hp >= f.maxHp) return;
    const z = Stage.cam.zoom, h = head(f), w = 8, k = Math.max(0, f.hp / f.maxHp);
    const p = Stage.toScreen(Math.round(f.x) - w / 2, h.y + 1.5);
    c2d.fillStyle = 'rgba(16, 12, 18, 0.85)';
    c2d.fillRect(p.x - 1, p.y - 1, w * z + 2, z / 2 + 2);
    c2d.fillStyle = k > 0.5 ? '#6fd25a' : k > 0.25 ? '#f0c040' : '#e5483c';
    c2d.fillRect(p.x, p.y, Math.max(z / 2, Math.round(w * z * k)), z / 2);
  }

  // Small labels over the head for the conditions on it (f.status: [{ short, color (a Palette type) }]); a
  // sleeper's ZZ bobs.
  function drawStatus(c2d, f) {
    if (f.dead || !f.status || !f.status.length) return;
    const z = Stage.cam.zoom, s = Math.max(1, Math.round(z / 4)), h = head(f), t = Stage.getTime();
    const widths = f.status.map(k => k.short.length * 4 * s), gap = 3 * s, total = widths.reduce((a, w) => a + w, 0) + gap * (widths.length - 1);
    const p = Stage.toScreen(f.x, h.y - 1);
    let x = p.x - total / 2;
    f.status.forEach((k, i) => {
      const bob = k.short === 'ZZ' ? Math.round(Math.sin(t * 3) * s) : 0;
      Popups.text(c2d, k.short, Math.round(x + widths[i] / 2), Math.round(p.y - 7 * s + bob), s, Palette.css(Palette.of(k.color).rgb[1]), 0.95);
      x += widths[i] + gap;
    });
  }

  // Where Mirror Image's k-th duplicate stands, from its caster (map pixels): to either side, then a little behind.
  const IMAGE_SLOTS = [[-8, 0.5], [8, 0.5], [0, -2.5]];
  const imageSlot = k => IMAGE_SLOTS[k % 3];

  // A small dark oval under the feet.
  function drawShadow(c2d, f) {
    const z = Stage.cam.zoom;
    c2d.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let dy = -1; dy <= 1; dy++) {
      const half = dy ? 2 : 4;
      const p = Stage.toScreen(Math.floor(f.x) - half, Math.floor(f.y) + dy);
      c2d.fillRect(p.x, p.y, (half * 2 + 1) * z, z);
    }
  }

  // The current pose's pixels, tinted, with the orb pulsing (alpha 254 pixels glow), the outline, and the flash.
  // A pose drawn into the pixels replaces the screen-space lean; monsters keep the lift.
  function drawSprite(c2d, f, d, tint, time) {
    const img = ctx.createImageData(N, N), out = img.data, src = Poses.pixels(f, d) || (f.moving ? d.frames[Math.floor(f.walkT) % 4] : d.stand);
    const pulse = 0.88 + 0.12 * Math.sin(time * 3 + f.id);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        if (!src[i + 3]) continue;
        const o = ((y + PAD) * N + x + PAD) * 4;
        const orb = d.orb && d.orb.set.has(y * S + x), glow = src[i + 3] === 254;
        for (let k = 0; k < 3; k++) out[o + k] = orb ? Math.min(255, src[i + k] * pulse * 1.05) : glow ? src[i + k] : src[i + k] * tint[k];
        out[o + 3] = 255;
      }
    }
    if (f.outline) addOutline(out, f.outline);
    if (f.flash) for (let i = 0; i < out.length; i += 4) if (out[i + 3]) out.set(f.flash, i);
    ctx.putImageData(img, 0, 0);
    const z = Stage.cam.zoom, dir = facing(f), size = N * z / 2, real = Poses.real(f);
    const lean = real ? 0 : f.lean, lift = Heroes.has(f.key) ? 0 : f.lift;
    const topAt = (x, y) => Stage.toScreen(
      Math.floor(x * 2) / 2 - (d.footX + PAD) / 2 + (lean * dir) / 2 + f.knockX,
      Math.floor(y) + 1 - (d.bottom + 1 + PAD) / 2 - lift / 2 + f.knockY);
    const top = topAt(f.x, f.y);
    if (f.dead) { Deaths.draw(c2d, f, { canvas, top, size, feet: Stage.toScreen(Math.floor(f.x * 2) / 2 + f.knockX, Math.floor(f.y) + 1), d, tint, z }); return; }
    const copies = Math.max(f.images || 0, f.fxImages || 0), spread = f.images ? 1 : (f.imageSpread ?? 1);
    for (let k = 0; k < copies; k++) {                           // Mirror Image: three duplicates in the caster's space
      const s = imageSlot(k), bob = Math.sin(time * 2 + k * 2.1) * 0.5, it = topAt(f.x + s[0] * spread, f.y + s[1] * spread + bob);
      c2d.globalAlpha = (0.6 + 0.1 * Math.sin(time * 5 + k * 1.7)) * f.alpha;
      c2d.drawImage(canvas, it.x, it.y, size, size);
    }
    for (const g of f.ghosts) {
      c2d.globalAlpha = 0.45 * (1 - g.age / GHOST_LIFE) * f.alpha;
      const gt = topAt(g.x, g.y);
      c2d.drawImage(canvas, gt.x, gt.y, size, size);
    }
    c2d.globalAlpha = f.alpha;
    c2d.drawImage(canvas, top.x, top.y, size, size);
    c2d.globalAlpha = 1;
  }

  // A 1-pixel ring of color round the figure.
  function addOutline(out, color) {
    const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && out[(y * N + x) * 4 + 3] === 255;
    const ring = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) ring.push((y * N + x) * 4);
    for (const o of ring) { out.set(color, o); out[o + 3] = 254; }
  }

  // Orbs and carried lights light the floor around their figure (walls block them).
  function addLights(world, night) {
    if (night <= 0) return;
    for (const f of list) {
      const a = art(f);
      if (!a || f.dead) continue;
      if (f.light || a.light) {
        const l = f.light || a.light, lx = Math.round(f.x), ly = Math.floor(f.y) - (l.up || 0);
        Fire.addLight(world, lx, ly, night * (l.power || 1), l.color, l.radius, Fire.sight(world, lx, ly, l.radius));
      }
      if (a.hasOrb) {
        const ox = Math.round(f.x), oy = Math.floor(f.y);
        Fire.addLight(world, ox, oy, night * 1.2, ORB_LIGHT, ORB_R, Fire.sight(world, ox, oy, ORB_R));
      }
    }
  }

  // The figure under a map point, or null.
  function at(mx, my) {
    return [...list].sort((p, q) => q.y - p.y).find(f => !f.dead && Math.abs(mx - f.x) <= 4 && my <= f.y + 1 && my >= f.y - 15) || null;
  }

  // Removes everyone (a new fight), or puts back a set of figures already made (another map).
  function clear() { list.length = 0; }
  function restore(figs) { list.length = 0; list.push(...figs); }

  return { list, add, clear, restore, art, face, facing, hand, chest, head, imageSlot, draw, update, addLights, at, get: id => list.find(f => f.id === id) };
})();
