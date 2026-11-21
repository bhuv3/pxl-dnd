// Sprite atlas (phase G3): bakes the CPU-drawn sprites into one texture and lists "things" as instances for the GPU.
//
// WHAT IT DOES. Every object sprite is a list of pixels { x, y, c: [r, g, b], w } relative to its base, built once by
// the CPU generators (Sprites.get, Props, Houses, Landmarks, Structures, Doors) and cached. Drawing one is
// `put(x + p.x + Math.round(sway * p.w), y + p.y, p.c)` for each pixel in list order, so a pixel's sway weight w moves it
// sideways only (rows never change) and later pixels cover earlier ones. The atlas keeps that exactly:
//   - A sprite is cut into LAYERS: runs of consecutive pixels in which every row has one sway weight. Most sprites are one
//     layer; a tree is two (trunk, canopy). Layers are drawn in order, so list order is kept. Pixels inside a layer that
//     share a spot are resolved when baking (the last wins), and a row shifts as a whole, so the sway is a per-row shift.
//   - Each layer is a tight rectangle of RGBA8 texels in the atlas (alpha 255 = pixel present, 0 = empty), plus (when the
//     layer sways) a table of one weight per row in the R32F row table.
//   - Tufts, flowers, reeds, lily pads and stepping stones are not baked: the shader draws them from a few numbers.
//   - Animals' frames are baked the same way (mirrored in the shader), and a windmill's turning sails get a square that the
//     CPU redraws every frame (updateSails), since their pixels depend on the angle.
// The atlas lives across rebuilds (a sprite already baked costs nothing); it is cleared when it fills up or gets stale.
//
// API (all need the GL context; the sprites pass calls them):
//   GlAtlas.reset()                     forget everything and free the textures (the pass's init does this)
//   GlAtlas.build(world)                bake every sprite world.things uses, plus the animals' frames; upload. Once per rebuild.
//   GlAtlas.layers(sprite)              the sprite's layers: [{ ax, ay, aw, ah (atlas rect, texels), ox, oy (where the rect's
//                                       top-left sits relative to the thing's base x, y), rowBase (index into the row table,
//                                       or -1 when no pixel of the layer sways), sway }]
//   GlAtlas.animal(type, frameTemplate) { layer, half } for an animal frame (Animals.frames / Animals.frameOf); half is the
//                                       widest pixel from the centre (its shadow is 2 * half - 1 wide)
//   GlAtlas.sailsSlot(sails)            a rect the same shape as a layer, for a windmill's sails (made by stream)
//   GlAtlas.updateSails(s, time)        redraw the sails of the windmills in the last stream into their rects (one upload); call every frame
//   GlAtlas.texture(), GlAtlas.rowTexture()   the atlas (RGBA8, read with texelFetch) and the row table (R32F, ROW_WIDTH wide)
//   GlAtlas.stream(world)               the things as instances in the CPU's draw order (see below)
//   GlAtlas.uniforms(s, pal, time)      the uniform values the {{things}} GLSL needs for one frame
//   GlAtlas.flagTexture(values)         the R8UI texture of per-thing flags, FLAG_WIDTH wide (values: Uint8Array)
//   GlAtlas.rippleCells(world, x, y, r) the cells Water.ripple touches, in order (for a duck's ripple)
//
// THE STREAM. GlAtlas.stream(world) returns { data: Float32Array (FLOATS = 16 per instance), count, flatEnd (the
// instances before the standing things), first[i], n[i] (the instances of world.things[i]), nonFlat (indices of the things Details.draw
// draws after the flat ones, in order), flags }. The
// order is Details.draw's: lily pads and stones, flat objects (rugs), then every other thing in world.things order. One
// instance is four vec4 attributes (a_i1 to a_i4, GlShaders.instanced(data, [4, 4, 4, 4])):
//     a_i1 = (x, y, kind, vis)            the thing's base pixel, KIND.*, and its flag: 0 always drawn; +k drawn while flag
//                                         k - 1 is 0; -k drawn while it is 1 (flags: tufts and flowers are 1 while trodden,
//                                         a door is 1 while open: the open and closed sprites are separate instances)
//     a_i4 = (lift, base row, max sway weight of the layer, 0)       a raised map draws the thing lift pixels higher (destination y = y - lift); base is the
//                                         thing's base row, for the depth test (hidden where depth >= base + 2); lift is 0 on flat maps
//     a_i2, a_i3 for sprites (SPRITE, WIND, BOB, FLIP): (ax, ay, aw, ah), (ox, oy, rowBase, phase)
//     a_i2 for TUFT (h0, h1, h2, has4thBlade), FLOWER (colour 0-2, tall), REED (h0, h1, h2, stalks + 10 if it has a cattail),
//     LILY (has flower), SHADOW (-, -, width, -), PLAIN (r, g, b in 0-255, alpha: blended 1 px)
//   The GLSL chunk {{things}} has thingHidden(vis), thingBox(...) (the quad, sway and boat bob for the vertex shader) and
//   thingPixel(...) (the colour of one pixel, premultiplied, or false to discard); see passes/sprites.js for the two mains.
// FOR RAISED MAPS (G5): the height pass calls GlSprites.drawFlat(c) and GlSprites.drawRaised(c, { depth }) (passes/sprites.js):
// the same stream and shaders, with the lift in a_i4, and u_depthTest / u_depth (R16UI: the winning source row per pixel) on.
const GlAtlas = (() => {
  const WIDTH = 2048;                  // atlas width, texels
  const ROW_WIDTH = 2048;              // row table width
  const FLAG_WIDTH = 2048;             // flag texture width
  const FLOATS = 16;                   // floats per instance
  const KIND = { TUFT: 0, FLOWER: 1, REED: 2, LILY: 3, STONE: 4, SPRITE: 5, WIND: 6, BOB: 7, FLIP: 8, SHADOW: 9, PLAIN: 10 };
  const PALETTE = ['tuftShadow', 'bladeTip', 'bladeMid', 'bladeRoot', 'flower1', 'flower2', 'flower3', 'reedDark', 'reedLight', 'reedTop',
    'lily', 'lilyDark', 'lilyFlower', 'pebbleLight', 'pebbleDark'];

  let pix = null, capRows = 0, usedRows = 0, tex = null, texStale = true, shelf = null;
  let dirtyFrom = Infinity, dirtyTo = 0;
  let rowW = new Float32Array(8192), rowCount = 0, rowTex = null, rowStale = true;
  let known = new WeakMap(), entries = [], epoch = 0, allocated = 0, lastLive = 0;
  let frames = new Map(), slots = new Map(), band = null;

  // Forgets every baked sprite and frees the textures.
  function reset() {
    GlTex.free(tex); GlTex.free(rowTex);
    tex = rowTex = null; pix = null; capRows = usedRows = 0; texStale = rowStale = true; shelf = null;
    dirtyFrom = Infinity; dirtyTo = 0; rowCount = 0;
    known = new WeakMap(); entries = []; allocated = lastLive = 0;
    frames = new Map(); slots = new Map(); band = null;
  }

  // Splits a pixel list into layers: runs of consecutive pixels in which each row has a single sway weight.
  function splitLayers(px) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of px) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    const rowW = new Float64Array(Math.max(0, maxY - minY + 1)), rowOf = new Int32Array(rowW.length).fill(-1);
    const layers = [];
    let cur = null;
    for (const p of px) {
      const w = p.w || 0, r = p.y - minY;
      if (!cur || (rowOf[r] === cur.id && rowW[r] !== w)) {
        closeLayer(cur, rowW, rowOf, minY);
        cur = { px: [], id: layers.length, x0: p.x, y0: p.y, x1: p.x, y1: p.y, sway: false, maxW: 0, rows: null };
        layers.push(cur);
      }
      cur.px.push(p);
      rowOf[r] = cur.id; rowW[r] = w;
      if (p.x < cur.x0) cur.x0 = p.x;
      if (p.x > cur.x1) cur.x1 = p.x;
      if (p.y < cur.y0) cur.y0 = p.y;
      if (p.y > cur.y1) cur.y1 = p.y;
      if (w) { cur.sway = true; cur.maxW = Math.max(cur.maxW, Math.abs(w)); }
    }
    closeLayer(cur, rowW, rowOf, minY);
    return layers;
  }

  // Keeps a swaying layer's weight for each of its rows (0 for a row it has no pixel in).
  function closeLayer(L, rowW, rowOf, minY) {
    if (!L || !L.sway) return;
    L.rows = new Float32Array(L.y1 - L.y0 + 1);
    for (let y = L.y0; y <= L.y1; y++) if (rowOf[y - minY] === L.id) L.rows[y - L.y0] = rowW[y - minY];
  }

  // Makes room for n atlas rows (the CPU copy and, at the next flush, the texture). False when the GPU can't go that tall.
  function ensureRows(n) {
    if (n <= capRows) return true;
    const gl = Gl.get(), max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (n > max) return false;
    const cap = Math.min(max, Math.max(n, capRows * 2, 512));
    const bigger = new Uint8ClampedArray(WIDTH * cap * 4);
    if (pix) bigger.set(pix.subarray(0, WIDTH * usedRows * 4));
    pix = bigger; capRows = cap; texStale = true;
    return true;
  }

  // Finds a spot for a w × h rectangle on the current shelf, or a new shelf. Items arrive tallest first. Null when full.
  function place(w, h) {
    if (w > WIDTH) throw new Error('GlAtlas: a sprite is wider than the atlas');
    if (!shelf || shelf.h < h || shelf.x + w > WIDTH) {
      if (!ensureRows(usedRows + h)) return null;
      shelf = { y: usedRows, h, x: 0 };
      usedRows += h;
    }
    const at = { x: shelf.x, y: shelf.y };
    shelf.x += w;
    return at;
  }

  // Writes a layer's pixels into the CPU copy (list order, so the last pixel of a spot wins), as a Uint8ClampedArray rounds.
  function paint(L) {
    for (const p of L.px) {
      const i = ((L.ay + p.y - L.y0) * WIDTH + L.ax + p.x - L.x0) * 4;
      pix[i] = p.c[0]; pix[i + 1] = p.c[1]; pix[i + 2] = p.c[2]; pix[i + 3] = 255;
    }
    dirtyFrom = Math.min(dirtyFrom, L.ay);
    dirtyTo = Math.max(dirtyTo, L.ay + L.ah);
  }

  // Appends a layer's per-row sway weights to the row table; returns where they start.
  function addRows(L) {
    const start = rowCount, n = L.y1 - L.y0 + 1;
    if (rowCount + n > rowW.length) { const bigger = new Float32Array(Math.max(rowW.length * 2, rowCount + n)); bigger.set(rowW.subarray(0, rowCount)); rowW = bigger; }
    rowW.set(L.rows, rowCount);
    rowCount += n; rowStale = true;
    return start;
  }

  // Turns a placed layer into its descriptor (and drops the pixel list).
  function finish(L, at) {
    L.ax = at.x; L.ay = at.y; L.aw = L.x1 - L.x0 + 1; L.ah = L.y1 - L.y0 + 1; L.ox = L.x0; L.oy = L.y0;
    paint(L);
    L.rowBase = L.sway ? addRows(L) : -1;
    L.px = null; L.rows = null;
  }

  // Bakes the sprites that are not baked yet. False if the atlas ran out of room.
  function register(sprites) {
    const items = [];
    for (const sp of sprites) {
      const ent = { layers: splitLayers(sp.px), epoch, texels: 0 };
      known.set(sp, ent);
      entries.push(ent);
      for (const L of ent.layers) { L.ent = ent; items.push(L); }
    }
    items.sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0));
    for (const L of items) {
      const w = L.x1 - L.x0 + 1, h = L.y1 - L.y0 + 1, at = place(w, h);
      if (!at) return false;
      finish(L, at);
      L.ent.texels += w * h;
      allocated += w * h;
    }
    return true;
  }

  // Every sprite a world draws.
  function collect(world) {
    const set = new Set();
    for (const t of world.things) {
      if (t.kind !== 'object') continue;
      set.add(t.sprite);
      if (t.open) set.add(t.open);
    }
    return set;
  }

  // The animals' template frames as pseudo sprites (made once).
  function animalSprites() {
    const out = [];
    for (const type of Animals.types()) {
      for (const frame of Animals.frames(type)) {
        if (!frames.has(frame)) {
          const px = Animals.pixels(type, frame);
          frames.set(frame, { sprite: { px }, half: Math.max(1, ...px.map(p => Math.abs(p.x))) });
        }
        out.push(frames.get(frame).sprite);
      }
    }
    return out;
  }

  // Marks the sprites a build wants as current and bakes the ones missing.
  function bake(wanted) {
    const missing = [];
    for (const sp of wanted) {
      const ent = known.get(sp);
      if (ent) ent.epoch = epoch; else missing.push(sp);
    }
    return register(missing);
  }

  // Uploads whatever changed since the last upload (the whole atlas when it grew).
  function flush() {
    if (!pix) return;
    if (texStale || !tex) {
      GlTex.free(tex);
      tex = GlTex.make(WIDTH, capRows, 'RGBA8', new Uint8Array(pix.buffer, 0, pix.length));
      texStale = false;
    } else if (dirtyTo > dirtyFrom) {
      GlTex.update(tex, new Uint8Array(pix.buffer, dirtyFrom * WIDTH * 4, (dirtyTo - dirtyFrom) * WIDTH * 4), 0, dirtyFrom, WIDTH, dirtyTo - dirtyFrom);
    }
    dirtyFrom = Infinity; dirtyTo = 0;
    if (rowStale || !rowTex) {
      GlTex.free(rowTex);
      const rows = Math.max(1, Math.ceil(rowCount / ROW_WIDTH)), data = new Float32Array(ROW_WIDTH * rows);
      data.set(rowW.subarray(0, rowCount));
      rowTex = GlTex.make(ROW_WIDTH, rows, 'R32F', data);
      rowStale = false;
    }
  }

  // The area the live sprites take, and a reset when the atlas holds much more than that (sprites of old settings).
  function tidy() {
    let live = 0;
    for (const e of entries) if (e.epoch === epoch) live += e.texels;
    lastLive = live;
    if (entries.length > 4096) entries = entries.filter(e => e.epoch === epoch);
  }

  // Bakes every sprite the world uses, then uploads. Call once per rebuild.
  function build(world) {
    epoch++;
    if (allocated > 3 * lastLive + 1e6) reset();
    for (let attempt = 0; ; attempt++) {
      const wanted = collect(world);
      for (const sp of animalSprites()) wanted.add(sp);
      if (bake(wanted)) break;
      if (attempt) throw new Error('GlAtlas: too many sprites for one texture');
      reset();
      epoch++;
    }
    tidy();
    flush();
    return { sprites: entries.length, rows: usedRows, texels: allocated, tableRows: rowCount };
  }

  // The layers of a sprite (baked now if it is new).
  function layers(sprite) {
    let ent = known.get(sprite);
    if (!ent) { if (!register([sprite])) throw new Error('GlAtlas: out of room'); flush(); ent = known.get(sprite); }
    return ent.layers;
  }

  // { layer, half } of an animal frame template.
  function animal(type, frame) {
    if (!frames.has(frame)) animalSprites();
    const f = frames.get(frame);
    return { layer: layers(f.sprite)[0], half: f.half };
  }

  // A rect for a windmill's sails (made by stream; kept current by updateSails).
  function sailsSlot(sails) { return slots.get(sails); }

  // Gives each distinct sails object a square in one band of atlas rows (the whole band is uploaded in one go each frame).
  function allocBand(list) {
    slots = new Map(); band = null;
    if (!list.length) return;
    const sizes = list.map(sl => 2 * (Math.ceil(sl.r + sl.width) + 2) + 1), rowH = Math.max(...sizes);
    let x = 0, row = 0;
    const spots = list.map((sl, i) => { if (x + sizes[i] > WIDTH) { x = 0; row++; } const at = [x, row]; x += sizes[i]; return at; });
    const rows = (row + 1) * rowH;
    if (!ensureRows(usedRows + rows)) throw new Error('GlAtlas: out of room for sails');
    const y0 = usedRows;
    usedRows += rows; shelf = null;
    list.forEach((sl, i) => {
      const R = (sizes[i] - 1) / 2;
      slots.set(sl, { ax: spots[i][0], ay: y0 + spots[i][1] * rowH, aw: sizes[i], ah: sizes[i], ox: Math.round(sl.x) - R, oy: Math.round(sl.y) - R, rowBase: -1, sway: false, sails: sl });
      allocated += sizes[i] * sizes[i];
    });
    const bandW = Math.max(...list.map((sl, i) => spots[i][0] + sizes[i]));
    band = { y0, rows, w: bandW, data: new Uint8Array(bandW * rows * 4) };
    flush();
  }

  // Draws every windmill's sails as they stand at this time into their squares, and uploads the band.
  function updateSails(s, time) {
    if (!band) return;
    band.data.fill(0);
    for (const slot of slots.values()) {
      Landmarks.drawSails((x, y, c) => {
        const i = ((slot.ay - band.y0 + y - slot.oy) * band.w + slot.ax + x - slot.ox) * 4;
        band.data[i] = c[0]; band.data[i + 1] = c[1]; band.data[i + 2] = c[2]; band.data[i + 3] = 255;
      }, slot.sails, 0, 0, s, time);
    }
    GlTex.update(tex, band.data, 0, band.y0, band.w, band.rows);
  }

  // ---------- The instance stream ----------

  // A growing list of instances.
  function writer(capacity) {
    let buf = new Float32Array(Math.max(16, capacity) * FLOATS), n = 0;
    return {
      get count() { return n; },
      put(kind, x, y, vis, b, c, lift, maxW) {
        if ((n + 1) * FLOATS > buf.length) { const bigger = new Float32Array(buf.length * 2); bigger.set(buf); buf = bigger; }
        const o = n * FLOATS;
        buf[o] = x; buf[o + 1] = y; buf[o + 2] = kind; buf[o + 3] = vis;
        buf[o + 4] = b[0]; buf[o + 5] = b[1]; buf[o + 6] = b[2]; buf[o + 7] = b[3];
        buf[o + 8] = c[0]; buf[o + 9] = c[1]; buf[o + 10] = c[2]; buf[o + 11] = c[3];
        buf[o + 12] = lift || 0; buf[o + 13] = y; buf[o + 14] = maxW || 0; buf[o + 15] = 0;
        n++;
      },
      data: () => buf.subarray(0, n * FLOATS),
    };
  }

  const ZERO = [0, 0, 0, 0];

  // Reed numbers: the height of each stalk (as Sprites.drawReed works them out) and whether there is a cattail.
  function reedParams(t) {
    const dxs = t.r3 < 0.5 ? [-1, 1] : [-1, 0, 1];
    const hs = dxs.map((dx, n) => Math.max(2, 6 - Math.floor(((t.r1 * 7 + n * 3.3) % 1) * 3) - (dx === 0 ? 0 : 1)));
    const cattail = dxs.includes(0) && t.r2 < 0.5;
    return [hs[0], hs[1], hs[2] || 0, dxs.length + (cattail ? 10 : 0)];
  }

  // Adds a thing's instances. flag(x, y, door) hands out a flag number for a thing that can change each frame.
  function emitThing(out, t, flag, lift) {
    if (t.kind === 'tuft') out.put(KIND.TUFT, t.x, t.y, flag(t.x, t.y, null) + 1, [3 + Math.floor(t.r1 * 3), 2 + Math.floor(t.r2 * 2), 2 + Math.floor(t.r3 * 2), t.r4 < 0.4 ? 1 : 0], ZERO, lift);
    else if (t.kind === 'flower') out.put(KIND.FLOWER, t.x, t.y, flag(t.x, t.y, null) + 1, [t.color, t.tall ? 1 : 0, 0, 0], ZERO, lift);
    else if (t.kind === 'reed') out.put(KIND.REED, t.x, t.y, 0, reedParams(t), ZERO, lift);
    else emitObject(out, t, flag, lift);
  }

  // The layers of one sprite as instances of the given kind.
  function emitLayers(out, t, sprite, kind, vis, lift) {
    for (const L of layers(sprite)) out.put(kind, t.x, t.y, vis, [L.ax, L.ay, L.aw, L.ah], [L.ox, L.oy, L.rowBase, t.phase || 0], lift, L.maxW);
  }

  // An object: its sprite (a door: the closed and the open one), then a windmill's sails.
  function emitObject(out, t, flag, lift) {
    const sp = t.sprite, kind = sp.flat ? KIND.SPRITE : sp.bob ? KIND.BOB : KIND.WIND;
    if (t.open && !sp.flat) {
      const k = flag(t.x, t.y, t) + 1;
      emitLayers(out, t, sp, kind, k, lift);
      emitLayers(out, t, t.open, kind, -k, lift);
    } else emitLayers(out, t, sp, kind, 0, lift);
    if (sp.sails && !sp.flat) {
      const slot = slots.get(sp.sails);
      out.put(KIND.SPRITE, t.x, t.y, 0, [slot.ax, slot.ay, slot.aw, slot.ah], [slot.ox, slot.oy, -1, 0], lift);
    }
  }

  // The things of a world as instances in the CPU's draw order (Details.draw): flat things, flat objects, then the rest.
  function stream(world) {
    const things = world.things, out = writer(things.length * 2 + world.flat.length);
    const flags = { x: [], y: [], door: [] };
    const flag = (x, y, door) => { flags.x.push(x); flags.y.push(y); flags.door.push(door); return flags.x.length - 1; };
    const first = new Int32Array(things.length), n = new Int32Array(things.length), nonFlat = [];
    allocBand([...new Set(things.filter(t => t.kind === 'object' && t.sprite.sails && !t.sprite.flat).map(t => t.sprite.sails))]);
    for (const f of world.flat) out.put(f.kind === 'lily' ? KIND.LILY : KIND.STONE, f.x, f.y, 0, [f.flower ? 1 : 0, 0, 0, 0], ZERO, 0);
    const isFlat = t => t.kind === 'object' && t.sprite.flat;
    const one = (i, t, lift) => { first[i] = out.count; emitThing(out, t, flag, lift); n[i] = out.count - first[i]; };
    things.forEach((t, i) => { if (isFlat(t)) one(i, t, 0); });
    const flatEnd = out.count;
    things.forEach((t, i) => { if (!isFlat(t)) { one(i, t, world.raised ? Height.liftAt(world, t.x, t.y) : 0); nonFlat.push(i); } });
    return { data: out.data(), count: out.count, flatEnd, first, n, nonFlat: Int32Array.from(nonFlat), flags };
  }

  // flag k's slot in the flags texture: the thing's flag is 1 while trodden or while a door is open.
  function flagTexture(values) {
    const rows = Math.max(1, Math.ceil(values.length / FLAG_WIDTH)), data = new Uint8Array(FLAG_WIDTH * rows);
    data.set(values);
    return GlTex.make(FLAG_WIDTH, rows, 'R8UI', data);
  }

  // The cells Water.ripple draws for a ring at (x, y) with radius r, in order (the same maths, so the same cells).
  function rippleCells(world, x, y, r) {
    const { w, h, water } = world, steps = Math.max(8, Math.round(r * 7)), out = [];
    let last = -1;
    for (let k = 0; k < steps; k++) {
      const a = k / steps * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r * 0.6);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const i = py * w + px;
      if (i === last || !water[i]) continue;
      last = i;
      out.push([px, py]);
    }
    return out;
  }

  // ---------- Uniforms and GLSL ----------

  const TAU = Math.PI * 2;
  const wrap = v => v - Math.floor(v / TAU) * TAU;

  // The uniforms the {{things}} chunk reads, for one frame. Phases are kept below 2 pi so the float sin stays exact.
  function uniforms(s, pal, time) {
    const colours = new Float32Array(PALETTE.length * 3);
    PALETTE.forEach((name, k) => colours.set(pal[name], k * 3));
    return {
      u_wind: ['v4', [s.wind ? 1 : 0, s.windStrength, Math.ceil(s.windStrength), 0]],
      u_phase: ['v4', [wrap(time * s.windSpeed), wrap(time * s.windSpeed * 1.3), wrap(time * 1.6), wrap(time * 1.1)]],
      u_pal: ['v3', colours],
      u_shade: Ground.SHADE,
    };
  }

  const consts = (prefix, names) => names.map((n, i) => `const int ${prefix}${n} = ${i};`).join('\n');

  // GLSL shared by the vertex and fragment shader of anything that draws things (see the header).
  function glsl() {
    return `
uniform sampler2D u_atlas;
uniform sampler2D u_rows;
uniform usampler2D u_flags;
uniform usampler2D u_shadow;
uniform usampler2D u_water;
uniform usampler2D u_depth;
uniform int u_depthTest;
uniform vec4 u_wind;
uniform vec4 u_phase;
uniform vec3 u_pal[${PALETTE.length}];
uniform vec3 u_shade;
${consts('K_', Object.keys(KIND))}
${consts('P_', PALETTE)}

// JS Math.round: halves go up.
int thingRound(float v) { return int(floor(v + 0.5)); }

// True when the thing's flag says it is not drawn now (a trodden tuft, the wrong state of a door).
bool thingHidden(float vis) {
  if (vis == 0.0) return false;
  int k = int(abs(vis) + 0.5) - 1;
  uint f = texelFetch(u_flags, ivec2(k & ${FLAG_WIDTH - 1}, k >> ${Math.log2(FLAG_WIDTH)}), 0).r;
  return vis > 0.0 ? f != 0u : f == 0u;
}

// The quad to draw (a box of pixels relative to the thing's base), the sway of its blades or rows, and the boat's bob.
void thingBox(vec4 A, vec4 B, vec4 C, vec4 D, out vec2 lo, out vec2 hi, out float sway, out float dy) {
  int kind = int(A.z + 0.5);
  float pad = u_wind.z;
  sway = 0.0; dy = 0.0;
  if (kind <= K_REED) {
    if (u_wind.x > 0.5) sway = sin(u_phase.y + A.x * 0.09 + A.y * 0.05) * u_wind.y;
    if (kind == K_TUFT) { lo = vec2(-3.0 - pad, -5.0); hi = vec2(4.0 + pad, 2.0); }   // pad: the most a row can shift
    else if (kind == K_FLOWER) { lo = vec2(-pad, -2.0); hi = vec2(1.0 + pad, 1.0); }
    else { lo = vec2(-2.0 - pad, -8.0); hi = vec2(3.0 + pad, 1.0); }
  } else if (kind == K_LILY) { lo = vec2(-1.0, -1.0); hi = vec2(2.0, 2.0); }
  else if (kind == K_STONE) { lo = vec2(0.0, 0.0); hi = vec2(2.0, 2.0); }
  else if (kind == K_SHADOW) { lo = vec2(0.0, 0.0); hi = vec2(B.z, 1.0); }
  else if (kind == K_PLAIN) { lo = vec2(0.0, 0.0); hi = vec2(1.0, 1.0); }
  else {
    float p = 0.0;
    if (kind == K_WIND && C.z >= 0.0 && u_wind.x > 0.5) { sway = sin(u_phase.x + A.x * 0.05 + C.w * 0.3) * u_wind.y; p = ceil(u_wind.y * D.z); }
    if (kind == K_BOB) { dy = floor(sin(u_phase.z + C.w) * 0.7 + 0.5); sway = sin(u_phase.w + C.w) * 1.4; p = ceil(1.4 * D.z); }
    lo = vec2(C.x - p, C.y); hi = vec2(C.x + B.z + p, C.y + B.w);
  }
}

ivec2 rowCell(int i) { return ivec2(i & ${ROW_WIDTH - 1}, i >> ${Math.log2(ROW_WIDTH)}); }

// A baked sprite layer: the texel for this pixel, with the row's sway shift (or the mirror of an animal).
bool spritePixel(ivec2 l, vec4 V, vec4 B, vec4 C, out vec3 c) {
  c = vec3(0.0);
  int kind = int(V.z + 0.5);
  ivec2 size = ivec2(B.zw + 0.5);
  ivec2 q = l - ivec2(C.xy);
  if (q.y < 0 || q.y >= size.y) return false;
  int sx = q.x;
  if (kind == K_FLIP) sx = size.x - 1 - q.x;
  else if (C.z >= 0.0 && kind != K_SPRITE) sx = q.x - thingRound(V.w * texelFetch(u_rows, rowCell(int(C.z + 0.5) + q.y), 0).r);
  if (sx < 0 || sx >= size.x) return false;
  vec4 t = texelFetch(u_atlas, ivec2(B.xy + 0.5) + ivec2(sx, q.y), 0);
  if (t.a < 0.5) return false;
  c = t.rgb * 255.0;
  return true;
}

// Grass tuft: a shadow line, then up to four blades (centre, left, right, short), as Sprites.drawTuft.
bool tuftPixel(ivec2 l, float sway, vec4 B, out vec3 c) {
  bool hit = false;
  c = vec3(0.0);
  if (l.y == 1 && abs(l.x) <= 2) { c = u_pal[P_tuftShadow]; hit = true; }
  int i = -l.y;
  if (i < 0) return hit;
  for (int b = 0; b < 4; b++) {
    if (b == 3 && B.w < 0.5) break;
    int h = b == 0 ? int(B.x + 0.5) : b == 1 ? int(B.y + 0.5) : b == 2 ? int(B.z + 0.5) : 2;
    if (i >= h) continue;
    int dx = b == 1 ? -1 : b == 2 ? 1 : 0;
    float lean = b == 1 ? -2.0 : b == 2 ? 2.0 : b == 3 ? -1.0 : 0.0;
    float f = float(i) / float(h - 1);
    if (dx + thingRound((lean + sway) * f * f) != l.x) continue;
    bool upper = f > 0.36;
    c = b == 0 ? (upper ? u_pal[P_bladeTip] : u_pal[P_bladeMid]) : (upper ? u_pal[P_bladeMid] : u_pal[P_bladeRoot]);
    hit = true;
  }
  return hit;
}

// Wild flower: a root pixel, a stem pixel if tall, and the colored top (Sprites.drawFlower).
bool flowerPixel(ivec2 l, float sway, vec4 B, out vec3 c) {
  bool hit = false, tall = B.y > 0.5;
  c = vec3(0.0);
  if (l.x == 0 && l.y == 0) { c = u_pal[P_bladeRoot]; hit = true; }
  if (tall && l.y == -1 && l.x == thingRound(sway * 0.3)) { c = u_pal[P_bladeMid]; hit = true; }
  if (l.y == (tall ? -2 : -1) && l.x == thingRound(sway * 0.6)) { c = u_pal[P_flower1 + int(B.x + 0.5)]; hit = true; }
  return hit;
}

// Reed: two or three stalks, the middle one maybe with a cattail (Sprites.drawReed).
bool reedPixel(ivec2 l, float sway, vec4 B, out vec3 c) {
  bool hit = false, cat = B.w > 5.0;
  int ns = int(B.w + 0.5) - (cat ? 10 : 0), i = -l.y;
  c = vec3(0.0);
  for (int n = 0; n < 3; n++) {
    if (n >= ns) break;
    int dx = ns == 2 ? (n == 0 ? -1 : 1) : n - 1;
    int h = int(B[n] + 0.5);
    if (i >= 0 && i < h) {
      float f = float(i) / float(h - 1);
      if (dx + thingRound((float(dx) * 0.6 + sway * 0.6) * f * f) == l.x) { c = f < 0.4 ? u_pal[P_reedDark] : u_pal[P_reedLight]; hit = true; }
    }
    if (dx == 0 && cat && (i == h || i == h + 1) && l.x == thingRound(sway * 0.6)) { c = u_pal[P_reedTop]; hit = true; }
  }
  return hit;
}

// Lily pad (Sprites.drawLily).
bool lilyPixel(ivec2 l, vec4 B, out vec3 c) {
  c = vec3(0.0);
  if (l.y == 1) { c = u_pal[P_lilyDark]; return l.x >= -1 && l.x <= 1; }
  if (l.y == 0) { c = u_pal[P_lily]; return l.x >= -1 && l.x <= 1; }
  if (l.y == -1 && l.x >= -1 && l.x <= 0) { c = (l.x == 0 && B.x > 0.5) ? u_pal[P_lilyFlower] : u_pal[P_lily]; return true; }
  return false;
}

// Stepping stone (Sprites.drawStone).
bool stonePixel(ivec2 l, out vec3 c) {
  c = l.y == 0 ? u_pal[P_pebbleLight] : u_pal[P_pebbleDark];
  return l.x >= 0 && l.x <= 1 && l.y >= 0 && l.y <= 1;
}

// The colour of a thing at pixel p, premultiplied (rgb * a, a); false where the thing has no pixel.
// V is (base x, base y plus bob minus lift, kind, sway) as the vertex shader worked it out; B and C are the instance's a_i2, a_i3;
// lift is its a_i4.x: the pixel's map position (for the shadow mask and the water under a shadow) is p.y + lift.
bool thingPixel(ivec2 p, vec4 V, vec4 B, vec4 C, float lift, out vec4 o) {
  ivec2 l = p - ivec2(V.xy);
  ivec2 sp = ivec2(p.x, p.y + int(lift + 0.5));
  bool onMap = sp.y >= 0 && sp.y < textureSize(u_shadow, 0).y;
  int kind = int(V.z + 0.5);
  vec3 c = vec3(0.0);
  float a = 1.0;
  bool hit = false, ground = false;
  if (kind == K_TUFT) { hit = tuftPixel(l, V.w, B, c); ground = true; }
  else if (kind == K_FLOWER) { hit = flowerPixel(l, V.w, B, c); ground = true; }
  else if (kind == K_REED) hit = reedPixel(l, V.w, B, c);
  else if (kind == K_LILY) hit = lilyPixel(l, B, c);
  else if (kind == K_STONE) hit = stonePixel(l, c);
  else if (kind == K_SHADOW) { hit = onMap && texelFetch(u_water, sp, 0).r == 0u; a = 0.25; }
  else if (kind == K_PLAIN) { hit = true; c = B.rgb; a = B.a; }
  else hit = spritePixel(l, V, B, C, c);
  if (!hit) return false;
  if (ground && onMap && texelFetch(u_shadow, sp, 0).r != 0u) c *= u_shade;
  o = vec4(c / 255.0 * a, a);
  return true;
}
`;
  }

  GlChunks.add('things', glsl());

  return {
    WIDTH, ROW_WIDTH, FLAG_WIDTH, FLOATS, KIND, PALETTE,
    reset, build, layers, animal, sailsSlot, updateSails, stream, uniforms, flagTexture, rippleCells,
    texture: () => tex, rowTexture: () => rowTex,
  };
})();
