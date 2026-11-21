// Height: raised ground is drawn shifted up. Raise and Lower paint hills and mountains as stepped ledges (walkable terraces);
// Flatten cuts flat terraces whose edges are cliffs; rivers keep their own water level (lowered after a drop),
// so they run through gorges and fall where they drop; chasms drop far below everything. Stairs go where paths cross a cliff.
// Every map pixel gets a lift (pixels it is drawn raised, below 0 for lowered rivers). Logic stays in map space; only drawing moves.
const Height = (() => {
  const { GROUND, WATER, isPath } = Types;
  const CLIMB = 2;        // biggest lift change one step can make: slopes and stairs pass, cliffs don't
  const EDGE = 3;         // lift difference that counts as a cliff edge
  const SLOPE = 0.5;      // lift gained per pixel going up a hillside
  const SOFTEN = 2;       // box blur radius that rounds hilltops and feet
  const GORGE = 1;        // lift gained per pixel up a gorge side, above its short cliff
  const TINT = 0.03;      // each ledge up is this much lighter (up to TINT_MAX)
  const TINT_MAX = 0.3;
  const CHASM_DEPTH = 12;  // how far a chasm drops: its far wall shows this many rows of rock fading into the dark
  const ROCKY = new Set([GROUND.CAVE_FLOOR, GROUND.ROCK, GROUND.STONE_WALL, GROUND.COBBLE, GROUND.GRAVEL, GROUND.FLAGSTONE, GROUND.TILE, GROUND.SLATE]);
  const STONE_STEPS = new Set([GROUND.COBBLE, GROUND.FLAGSTONE, GROUND.GRAVEL, GROUND.TILE, GROUND.SLATE]);
  let ground = null;      // copy of the flat frame while composing

  // ---------- Rebuild ----------

  // Fills world.lift, world.soft (1 on hillside ground), world.step (ledge height), world.ramp (stairs), world.fall (foam), world.raised.
  // Lakes and the sea stay at level 0, rivers at their own level, terraces at theirs, chasms far below; the rest follows
  // the smooth slope height, cut into ledges every half level.
  function resolve(world, s) {
    const { w, h, water, terrace, riverLevel, chasm } = world;
    const n = w * h, lh = s.levelHeight;
    const hill = slopes(world, lh), step = world.step = Math.max(2, Math.round(lh / 2));
    world.lift = new Int16Array(n);
    world.soft = new Uint8Array(n);
    world.ramp = new Uint8Array(n);
    world.fall = new Uint8Array(n);
    world.raised = false;
    for (let i = 0; i < n; i++) {
      const L = chasm[i] ? -CHASM_DEPTH : water[i] === WATER.RIVER ? riverLevel[i] * lh : water[i] ? 0
        : terrace[i] ? (terrace[i] - 1) * lh : hill ? Math.floor(hill[i] / step) * step : 0;
      world.soft[i] = !water[i] && !terrace[i] && !chasm[i] ? 1 : 0;
      if ((world.lift[i] = L)) world.raised = true;
    }
    if (!world.raised) return;
    liftBridges(world);
    if (s.stairs) buildStairs(world);
    markFalls(world);
    world.depth = new Int16Array(n);
    world.srcY = new Int16Array(n);
  }

  // Smooth height from the painted levels: each pixel is at most SLOPE higher than its neighbors, so raised
  // ground rises gently from its edge, then gets rounded and a little uneven. Lakes and the sea pull it down
  // to the shore. Beside a river the ground stays high, as a gorge: at most a short wall above ground level at the
  // bank, then a steep slope, so the water still shows between its walls. Null when nothing is raised.
  function slopes(world, lh) {
    const { w, h, level, water } = world;
    const n = w * h;
    if (!level.some(v => v)) return null;
    const S = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i % w, y = (i / w) | 0;
      S[i] = water[i] === WATER.RIVER ? 1e6 : water[i] || world.chasm[i] ? 0 : level[i] * lh * (0.85 + 0.3 * Random.noise(x, y, 30, 61));
    }
    spread(S, w, h, SLOPE);
    for (let i = 0; i < n; i++) if (S[i] >= 1e6) S[i] = 0;
    blur(S, w, h, SOFTEN);
    blur(S, w, h, SOFTEN);
    const wall = Math.max(EDGE, Math.round(lh / 2));
    const R = new Float32Array(n);
    for (let i = 0; i < n; i++) R[i] = water[i] === WATER.RIVER ? wall : 1e6;   // from ground level: a lowered river's banks still reach the cliff
    spread(R, w, h, GORGE);
    for (let i = 0; i < n; i++) S[i] = Math.min(S[i], R[i]);
    return S;
  }

  // Lowers values in place so no pixel is more than rate (per pixel step, diagonals √2 × rate) above a neighbor:
  // a two-pass chamfer distance transform seeded with the values.
  function spread(S, w, h, rate) {
    const d1 = rate, d2 = rate * Math.SQRT2;
    const pass = (y0, y1, dy, x0, x1, dx) => {
      for (let y = y0; y !== y1; y += dy) {
        for (let x = x0; x !== x1; x += dx) {
          const i = y * w + x, py = y - dy, px = x - dx;
          let v = S[i];
          if (px >= 0 && px < w) v = Math.min(v, S[i - dx] + d1);
          if (py >= 0 && py < h) {
            v = Math.min(v, S[i - dy * w] + d1);
            if (px >= 0 && px < w) v = Math.min(v, S[i - dy * w - dx] + d2);
            if (x + dx >= 0 && x + dx < w) v = Math.min(v, S[i - dy * w + dx] + d2);
          }
          S[i] = v;
        }
      }
    };
    pass(0, h, 1, 0, w, 1);
    pass(h - 1, -1, -1, w - 1, -1, -1);
  }

  // Box blur in place (rows, then columns), clamped at the map edges.
  function blur(a, w, h, r) {
    const line = new Float32Array(Math.max(w, h));
    const run = (count, len, at) => {
      for (let c = 0; c < count; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += a[at(c, Math.max(0, Math.min(len - 1, k)))];
        for (let k = 0; k < len; k++) {
          line[k] = sum / (2 * r + 1);
          sum += a[at(c, Math.min(len - 1, k + r + 1))] - a[at(c, Math.max(0, k - r))];
        }
        for (let k = 0; k < len; k++) a[at(c, k)] = line[k];
      }
    };
    run(h, w, (y, x) => y * w + x);
    run(w, h, (x, y) => y * w + x);
  }

  // Bridge decks over water or a chasm sit at the height of the banks they start from, not down at the water.
  function liftBridges(world) {
    const { w, h, span, lift } = world;
    if (!world.bridges || !world.bridges.length) return;
    const queue = [], seen = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (span[i] && !Bridges.gap(world, i)) { queue.push(i); seen[i] = 1; }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] || !span[j]) continue;
        seen[j] = 1;
        lift[j] = lift[i];
        queue.push(j);
      }
    }
  }

  // Where a path crosses a cliff, the path on the low side climbs up to the top in small steps, running
  // straight away from the cliff (so a path crossing at the cliff's foot isn't turned into stairs).
  // Facing the viewer (cliff top to the north) the steps rise 1 pixel per row, so each row shows a riser;
  // facing away they rise half a pixel per row, so the slope stays visible; sideways, 1 per column.
  function buildStairs(world) {
    const { w, h, ground: g, water, lift, ramp } = world;
    const base = lift.slice();
    const isRoad = i => isPath(g[i]) && !water[i];
    const best = new Float32Array(w * h).fill(-1);
    for (let i = 0; i < w * h; i++) {
      if (!isRoad(i)) continue;
      const x = i % w;
      for (const [j, slope] of [[i - w, 1], [i + w, 0.5], [x > 0 ? i - 1 : -1, 1], [x < w - 1 ? i + 1 : -1, 1]]) {
        if (j >= 0 && j < w * h && isRoad(j) && base[j] - base[i] >= EDGE) climb(i, i - j, base[j], slope);
      }
    }
    // One column (or row) of steps from the cliff, d pixels out.
    function climb(i, step, top, slope) {
      const low = base[i];
      for (let d = 1; ; d++, i += step) {
        const v = top - d * slope;
        if (i < 0 || i >= w * h || !isRoad(i) || base[i] !== low || v <= low) return;
        if (step === 1 && i % w === 0 || step === -1 && i % w === w - 1) return;
        best[i] = Math.max(best[i], v);
      }
    }
    for (let i = 0; i < w * h; i++) if (best[i] >= 0) { lift[i] = Math.round(best[i]); ramp[i] = 1; }
  }

  // Foam where water drops a level: 2 on the water at the foot, 1 on the lip above and one pixel further on.
  function markFalls(world) {
    const { w, h, water, span, lift, fall } = world;
    const wet = i => water[i] && !span[i];
    const foot = [];
    for (let i = 0; i < w * h; i++) {
      if (!wet(i)) continue;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || !wet(j) || lift[j] - lift[i] < EDGE) continue;
        fall[i] = 2;
        fall[j] = Math.max(fall[j], 1);
        foot.push(i);
      }
    }
    for (const i of foot) {
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < w * h && wet(j) && !fall[j] && lift[j] === lift[i]) fall[j] = 1;
      }
    }
  }

  // Lift at a map point (0 outside the map or on flat maps).
  function liftAt(world, x, y) {
    if (!world || !world.raised) return 0;
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= world.w || yi >= world.h) return 0;
    return world.lift[yi * world.w + xi];
  }

  // True if a step from pixel i to pixel j is not up or down a cliff: small steps anywhere, one ledge on a hillside.
  function canStep(world, i, j) {
    if (!world.raised) return true;
    const d = Math.abs(world.lift[i] - world.lift[j]);
    return d <= CLIMB || isLedge(world, i, j, d);
  }

  // True when pixels i and j are hillside ground one ledge apart (d = their lift difference).
  function isLedge(world, i, j, d) {
    return d <= world.step && world.soft[i] && world.soft[j];
  }

  // Baked into the static ground. Hillsides: each ledge a shade lighter, a lit lip along its front edge, lit back
  // and west edges, a shaded east edge, and shade at the foot of the ledge behind. Cliffs: a dark rim along the
  // edge, a lit lip on top, shade at the foot. Stairs get a light nose.
  function shadeEdges(world, out) {
    if (!world.raised) return;
    const { w, h, lift, ramp, water, soft, step } = world;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : y * w + x);
    const lower = (i, j, cliff) => j !== null && lift[j] < lift[i] && (cliff ? !canStep(world, i, j) : isLedge(world, i, j, lift[i] - lift[j]));
    const higher = (i, j, cliff) => j !== null && lower(j, i, cliff);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, L = lift[i];
        if (water[i] || world.chasm[i]) continue;
        const N = at(x, y - 1), S = at(x, y + 1), Wt = at(x - 1, y), E = at(x + 1, y);
        let f = soft[i] && L > 0 ? 1 + Math.min(TINT_MAX, L / step * TINT) : 1;
        if ([Wt, E, N].some(j => lower(i, j, true))) f *= 0.6;
        else if (lower(i, S, true)) f *= 1.15;
        else if (lower(i, S, false) && !ramp[i]) f *= 1.22;
        else if (ramp[i] && S !== null && lift[S] < L) f *= 1.12;
        else if (lower(i, N, false)) f *= 1.12;
        else if (lower(i, Wt, false)) f *= 1.08;
        else if (lower(i, E, false)) f *= 0.8;
        if (higher(i, N, true)) f *= 0.7;
        else if (higher(i, N, false)) f *= 0.78;
        else { const N2 = at(x, y - 2); if (higher(i, N2, true)) f *= (x + y) & 1 ? 0.84 : 0.9; }
        if (f === 1) continue;
        const p = i * 4;
        out[p] = Math.min(255, out[p] * f); out[p + 1] = Math.min(255, out[p + 1] * f); out[p + 2] = Math.min(255, out[p + 2] * f);
      }
    }
  }

  // ---------- Each frame ----------

  // Rebuilds the frame with height: flat ground goes to a buffer, then rows are drawn from the back (top)
  // to the front, each shifted up by its lift, cliff faces filling the space below. Things and animals are
  // drawn right after the row in front of their base, so nearer cliffs cover them.
  // world.depth (map row that drew each pixel, for occlusion) and world.srcY (map row under it, for clicks) are filled.
  function compose(frame, world, s, pal, time) {
    const { w, h, things, depth, srcY } = world;   // things: sorted by y, flat ones (rugs) first
    Details.drawFlat(frame, world, pal);
    if (!ground || ground.length !== frame.length) ground = new Uint8ClampedArray(frame.length);
    ground.set(frame);
    for (let i = 0; i < w * h; i++) depth[i] = srcY[i] = (i / w) | 0;
    const writer = makeWriter(frame, world);
    const animals = world.preview ? [] : Animals.list().sort((a, b) => a.y - b.y);   // library pictures have no animals
    const standing = world.standing || (world.standing = things.filter(th => !(th.kind === 'object' && th.sprite.flat)));
    let t = 0, a = 0;
    const drawUpTo = row => {
      for (; t < standing.length && standing[t].y <= row; t++) {
        const th = standing[t];
        writer.at(liftAt(world, th.x, th.y), th.y);
        Details.drawThing(writer.put, th, s, pal, time);
      }
      for (; a < animals.length && Math.floor(animals[a].y) <= row; a++) {
        const an = animals[a];
        writer.at(liftAt(world, an.x, an.y), Math.floor(an.y));
        Animals.drawAnimal(frame, world, pal, time, an, writer.put, writer.dy());
      }
    };
    for (let y = 0; y < h; y++) {
      drawRow(frame, world, pal, time, y);
      drawUpTo(y - 1);
    }
    drawUpTo(Infinity);
  }

  // One map row: each pixel at its lifted spot, then its front face down to where the next row starts.
  // A 1–2 pixel step stretches the pixel itself; a hillside ledge gets a shaded face of its own ground;
  // anything bigger is a cliff, waterfall, or stair riser.
  function drawRow(frame, world, pal, time, y) {
    const { w, h, lift, fall, depth, srcY } = world;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, L = lift[i], sy = y - L;
      if (sy >= 0 && sy < h) {
        const o = sy * w + x;
        copyPixel(frame, o, i, fall[i], time, x, pal);
        depth[o] = y; srcY[o] = y;
      }
      const n = L - (y + 1 < h ? lift[i + w] : 0);
      const below = y + 1 < h ? i + w : -1;
      const ledge = n > 0 && below >= 0 && !world.ramp[i] && !world.ramp[below] && isLedge(world, i, below, n);
      const stretch = !ledge && n <= CLIMB && !world.ramp[i] && !world.ramp[below];
      for (let k = 1; k <= n; k++) {
        const fy = sy + k;
        if (fy < 1 || fy >= h) continue;
        const o = fy * w + x, c = stretch ? null : ledge ? ledgeColor(i, x, k, n) : faceColor(world, pal, time, x, y, k, n);
        if (stretch) { frame[o * 4] = frame[(o - w) * 4]; frame[o * 4 + 1] = frame[(o - w) * 4 + 1]; frame[o * 4 + 2] = frame[(o - w) * 4 + 2]; }
        else if (c) { frame[o * 4] = c[0]; frame[o * 4 + 1] = c[1]; frame[o * 4 + 2] = c[2]; }
        else continue;
        depth[o] = y; srcY[o] = y;
      }
    }
  }

  // Face of a hillside ledge: its own ground, shaded, with faint streaks and a dark foot line.
  function ledgeColor(i, x, k, n) {
    const f = k === n ? 0.42 : (k === 1 ? 0.72 : 0.62) * (Random.hash(x, 91) < 0.25 ? 0.9 : 1);
    return [ground[i * 4] * f, ground[i * 4 + 1] * f, ground[i * 4 + 2] * f];
  }

  // Copies a flat-ground pixel to its lifted spot; water under a waterfall churns with foam.
  function copyPixel(frame, o, i, foam, time, x, pal) {
    let r = ground[i * 4], g = ground[i * 4 + 1], b = ground[i * 4 + 2];
    if (foam && Random.hash(x + Math.floor(time * 8) * 13, i) < (foam === 2 ? 0.8 : 0.4)) [r, g, b] = pal.foam;
    frame[o * 4] = r; frame[o * 4 + 1] = g; frame[o * 4 + 2] = b;
  }

  // Color of face row k (1 = just under the top edge) of n, below map pixel (x, y): a bridge's edge (null below it,
  // so what's under the bridge shows), falling water, a stair riser, the far wall of a chasm, the log piles under a
  // raised wooden deck, or a cliff (earth under soft ground, rock under stone), dark at the foot and streaked.
  function faceColor(world, pal, time, x, y, k, n) {
    const { w, h, water, ramp, span, ground: g, chasm } = world;
    const i = y * w + x, j = y + 1 < h ? i + w : i;
    if (span[i] && Bridges.gap(world, i)) return k === 1 ? pal.woodDark : k === 2 ? pal.trunkDark : null;
    if (chasm[j] && !chasm[i]) return chasmWall(pal, x, k, n);
    if (water[i] && water[j]) {
      const t = k - time * 18 + Random.hash(x, 71) * 9;
      if (k === n) return pal.foam;
      const r = Random.hash(x, Math.floor(t / 3));
      return r < 0.15 ? pal.foam : r < 0.4 ? pal.glint : (x + Math.floor(t / 4)) % 3 ? pal.shallow : pal.mid;
    }
    if (ramp[i] || ramp[j]) {
      const kind = ramp[i] ? g[i] : g[j];
      if (STONE_STEPS.has(kind)) return k === n ? pal.stoneMortar : pal.stoneDark;
      if (kind === GROUND.WOOD_FLOOR) return k === n ? pal.trunkDark : pal.woodDark;
      return k === n ? pal.dirtShadow : pal.pathEdge;
    }
    if (g[i] === GROUND.WOOD_FLOOR) return logPiles(pal, x, k, n);
    const fromBottom = n - k + 1, streak = Random.hash(x + 31, 404) < 0.3;
    if (ROCKY.has(g[i])) {
      if (fromBottom === 1) return pal.rockOutline;
      if (k === 1) return pal.rockLight;
      return streak ? pal.rockDark : (Math.floor((k + Random.hash(x, 405) * 3) / 3) % 2 ? pal.rockMid : pal.rockDark);
    }
    if (fromBottom === 1) return pal.mudDark;
    if (k === 1) return g[i] === GROUND.GRASS ? pal.grassLip : pal.dirtLight;
    if (streak) return pal.dirtShadow;
    return (k + Math.floor(Random.hash(x, 406) * 2)) % 4 === 0 ? pal.dirtDark : pal.dirt;
  }

  // Far wall of a chasm: lit rock at the lip, streaked rock below, fading into the dark with depth.
  function chasmWall(pal, x, k, n) {
    const streak = Random.hash(x + 31, 404) < 0.3;
    const c = k === 1 ? pal.rockLight : streak ? pal.rockDark : (Math.floor((k + Random.hash(x, 405) * 3) / 3) % 2 ? pal.rockMid : pal.rockDark);
    const t = Math.min(1, Math.max(0, (k - 2) / Math.max(1, n - 3)));
    const f = t * t * (3 - 2 * t) + (((x + k) & 1) ? 0.06 : -0.06) * (t > 0.1 && t < 0.9 ? 1 : 0);
    const a = Math.min(1, Math.max(0, f));
    return [c[0] + (pal.chasm[0] - c[0]) * a, c[1] + (pal.chasm[1] - c[1]) * a, c[2] + (pal.chasm[2] - c[2]) * a];
  }

  // Under a raised wooden deck (a bridge over a canyon, a platform): a beam, then a row of round log ends.
  function logPiles(pal, x, k, n) {
    if (k === 1) return pal.woodDark;
    if (k === n) return pal.trunkDark;
    const rows = Math.max(1, n - 2), u = ((x % 4) + 4) % 4, v = k - 2;
    const d = Math.hypot((u - 1.5) / 2, (v - (rows - 1) / 2) / (rows / 2));
    if (d > 0.95) return pal.trunkDark;
    if (d > 0.62) return pal.trunkMid;
    return d < 0.25 ? pal.woodDark : pal.woodLight;
  }

  // A pixel writer for things and animals: shifts them up by their base's lift and records depth.
  // Ground-level pixels inside object shadows are darkened, as in Details.
  function makeWriter(frame, world) {
    const { w, h, shadowMask, depth, srcY } = world;
    let dy = 0, base = 0;
    const put = (x, y, c, groundLevel) => {
      const sy = y - dy;
      if (x < 0 || sy < 0 || x >= w || sy >= h) return;
      const o = sy * w + x, p = o * 4;
      const shaded = groundLevel && shadowMask && y >= 0 && y < h && shadowMask[y * w + x];
      const f = shaded ? Ground.SHADE : null;
      frame[p] = f ? c[0] * f[0] : c[0]; frame[p + 1] = f ? c[1] * f[1] : c[1]; frame[p + 2] = f ? c[2] * f[2] : c[2];
      depth[o] = base; srcY[o] = y;
    };
    return { put, at(lift, row) { dy = lift; base = row; }, dy: () => dy };
  }

  // Map point under a point of the drawn (raised) frame: the column stays, the row is the one drawn there.
  function unproject(world, x, y) {
    if (!world || !world.raised) return { x, y };
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= world.w || yi >= world.h) return { x, y };
    return { x, y: world.srcY[yi * world.w + xi] + (y - yi) };
  }

  return { CLIMB, EDGE, TINT, TINT_MAX, resolve, liftAt, canStep, shadeEdges, compose, unproject };
})();
