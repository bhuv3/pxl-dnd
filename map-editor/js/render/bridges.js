// Bridges where a painted path crosses a river or a chasm: straight spans from bank to bank, drawn over the moving water
// (or the drop).
// Planks always run along pixel rows (or columns); an angled path shears the bridge into a clean parallelogram.
const Bridges = (() => {
  const { GROUND, isPath } = Types;
  const OVERHANG = 2;                         // rows each end rests on the bank
  const MAX_HALF = 34;                        // longest half-span searched for a bank
  const SLOPES = [0, 1 / 3, 1 / 2, 1];        // allowed shears (sideways pixels per row): clean pixel lines
  const SHADE = [0.6, 0.66, 0.76];
  const STONE_PATHS = [GROUND.COBBLE, GROUND.FLAGSTONE];

  // True where a bridge has nothing under it: water, or a chasm.
  function gap(world, i) { return !!(world.water[i] || world.chasm[i]); }

  // Finds every crossing (world.crossing, set by Rivers and chasms) and marks world.span: 1 deck, 2 rail.
  function place(world, s) {
    const { w, h, crossing } = world;
    world.span = new Uint8Array(w * h);
    world.bridges = [];
    world.bridgeArt = null;
    if (!s.bridges) return;
    const seen = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!crossing[i] || seen[i]) continue;
      const part = blob(world, i, seen);
      if (part.length < 4) continue;
      const b = measure(world, s, part);
      if (b) { outline(world, b); world.bridges.push(b); }
    }
  }

  // Crossing pixels connected to start (8-neighbors).
  function blob(world, start, seen) {
    const { w, h, crossing } = world;
    const part = [start];
    seen[start] = 1;
    for (let k = 0; k < part.length; k++) {
      const x = part[k] % w, y = (part[k] / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, j = ny * w + nx;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[j] || !crossing[j]) continue;
          seen[j] = 1;
          part.push(j);
        }
      }
    }
    return part;
  }

  // Walk direction, shear, width, center, and both ends for one crossing. Null when no bank is found.
  // A bridge lives in (a, s) coordinates: a runs along the walk (y for 'rows', x for 'cols'), s across it.
  function measure(world, s, part) {
    const { w } = world;
    let mx = 0, my = 0;
    for (const i of part) { mx += i % w + 0.5; my += ((i / w) | 0) + 0.5; }
    mx /= part.length; my /= part.length;
    let reach = 0;
    for (const i of part) reach = Math.max(reach, Math.hypot(i % w + 0.5 - mx, ((i / w) | 0) + 0.5 - my));
    const road = pathShape(world, mx, my, reach + 10);
    let ux, uy;
    if (part.every(i => world.chasm[i])) {
      const along = road || blobAxis(world, part);             // over a chasm the path itself sets the way across
      ux = along.ax; uy = along.ay;
    } else {
      const river = riverAt(world, mx, my);
      ux = -river.ty; uy = river.tx;                           // across the river
      if (road && Math.abs(road.ax * river.tx + road.ay * river.ty) < 0.8) { ux = road.ax; uy = road.ay; }
    }
    const rows = Math.abs(uy) >= Math.abs(ux);
    const [ua, us] = rows ? [uy, ux] : [ux, uy];
    const slope = snapSlope(us / ua);
    const style = styleFor(s, mostCommon(world.crossing, part));
    const width = widthFor(style, (road ? road.width : 4) * Math.hypot(1, slope));
    const b = { rows, slope, style, width };
    b.ca = Math.floor(rows ? my : mx);
    b.cs = rows ? mx : my;
    if (road) b.cs = (rows ? road.mx : road.my) - ((rows ? road.my : road.mx) - b.ca) * slope;   // center line through the path
    b.a0 = bank(world, b, -1);
    b.a1 = bank(world, b, 1);
    return b.a0 !== null && b.a1 !== null ? b : null;
  }

  // Tangent of the nearest river point.
  function riverAt(world, x, y) {
    let best = null, bestD = Infinity;
    for (const path of world.riverPaths) {
      for (const p of path.pts) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      }
    }
    return best || { tx: 1, ty: 0 };
  }

  // Main axis, center, and width of the dry path pixels around a crossing (from their spread).
  function pathShape(world, x, y, r) {
    const { w, h, ground, water } = world;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let py = Math.max(0, Math.floor(y - r)); py <= Math.min(h - 1, y + r); py++) {
      for (let px = Math.max(0, Math.floor(x - r)); px <= Math.min(w - 1, x + r); px++) {
        const i = py * w + px;
        if (water[i] || !isPath(ground[i]) || (px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2 > r * r) continue;
        n++; sx += px; sy += py; sxx += px * px; syy += py * py; sxy += px * py;
      }
    }
    if (n < 12) return null;
    const mx = sx / n, my = sy / n;
    const cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my;
    const angle = Math.atan2(2 * cxy, cxx - cyy) / 2;
    const ax = Math.cos(angle), ay = Math.sin(angle);
    const minor = cxx * ay * ay + cyy * ax * ax - 2 * cxy * ax * ay;
    return { ax, ay, mx: mx + 0.5, my: my + 0.5, width: Math.sqrt(12 * Math.max(0, minor)) };
  }

  // Main axis of a blob of pixels (from their spread).
  function blobAxis(world, part) {
    const { w } = world;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (const i of part) { const x = i % w, y = (i / w) | 0; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
    const mx = sx / n, my = sy / n;
    const angle = Math.atan2(2 * (sxy / n - mx * my), (sxx / n - mx * mx) - (syy / n - my * my)) / 2;
    return { ax: Math.cos(angle), ay: Math.sin(angle) };
  }

  // Nearest allowed shear, by angle.
  function snapSlope(k) {
    const a = Math.atan(Math.abs(k));
    const best = SLOPES.reduce((p, q) => Math.abs(Math.atan(q) - a) < Math.abs(Math.atan(p) - a) ? q : p);
    return Math.sign(k) * best;
  }

  function mostCommon(arr, part) {
    const count = new Map();
    for (const i of part) count.set(arr[i], (count.get(arr[i]) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  // Bridge style: the setting, or from the path (cobble and flagstone build stone bridges).
  function styleFor(s, pathKind) {
    if (s.bridgeStyle && s.bridgeStyle !== 'auto') return s.bridgeStyle;
    return STONE_PATHS.includes(pathKind) ? 'stone' : 'wood';
  }

  // Row length including rails: the path's width plus a rail each side. Rope bridges stay narrow.
  function widthFor(style, pathWidth) {
    const base = Math.max(3, Math.min(10, Math.round(pathWidth)));
    return style === 'rope' ? Math.min(base + 2, 5) : base + 2;
  }

  // First across-coordinate of row a.
  function rowStart(b, a) { return Math.floor(b.cs + (a - b.ca) * b.slope - b.width / 2 + 0.5); }

  // Map index of (a, s), or -1 outside the map.
  function index(world, b, a, s) {
    const [x, y] = b.rows ? [s, a] : [a, s];
    return x < 0 || y < 0 || x >= world.w || y >= world.h ? -1 : y * world.w + x;
  }

  // Last row of this end (dir -1 or 1): past the last wet row by OVERHANG. Null if no bank within reach.
  function bank(world, b, dir) {
    let lastWet = b.ca, dry = 0;
    for (let k = 0; k <= MAX_HALF; k++) {
      const a = b.ca + k * dir, lo = rowStart(b, a);
      let wet = false;
      for (let s = lo; s < lo + b.width; s++) {
        const i = index(world, b, a, s);
        if (i < 0) return null;
        if (gap(world, i)) { wet = true; break; }
      }
      if (wet) { lastWet = a; dry = 0; } else if (++dry >= 2) return lastWet + OVERHANG * dir;
    }
    return null;
  }

  // Lists the bridge's pixels with their part (deck, rail, end, post) and marks world.span.
  function outline(world, b) {
    b.px = [];
    for (let a = b.a0; a <= b.a1; a++) {
      const lo = rowStart(b, a), hi = lo + b.width - 1;
      for (let s = lo; s <= hi; s++) {
        const i = index(world, b, a, s);
        if (i < 0) continue;
        const side = s === lo || s === hi, end = a === b.a0 || a === b.a1;
        const part = side && end ? 'post' : side ? 'rail' : end ? 'end' : 'deck';
        b.px.push({ i, x: i % world.w, y: (i / world.w) | 0, a: a - b.a0, s: s - lo, part });
        world.span[i] = side ? 2 : 1;
      }
    }
  }

  const mod = (n, m) => ((n % m) + m) % m;

  // Color of one bridge pixel (a: rows from the start, s: pixels from the row's first), or null where water shows.
  function pixelColor(b, p, pal) {
    const r = Random.hash(p.x + 811, p.y + 813);
    if (b.style === 'stone') {
      if (p.part === 'post') return pal.stoneDark;
      if (p.part === 'rail') return mod(p.a, 4) === 0 ? pal.stoneDark : pal.stoneLight;
      if (mod(p.a, 3) === 2 || mod(p.s + Math.floor(p.a / 3) * 2, 4) === 0) return pal.stoneMortar;
      return r < 0.1 ? pal.stoneDark : r > 0.92 ? pal.stoneLight : pal.stone;
    }
    if (b.style === 'rope') {
      if (p.part === 'post') return pal.trunkDark;
      if (p.part === 'rail') return pal.thatchDark;
      if (p.part === 'end') return pal.woodDark;
      if (mod(p.a, 2)) return null;
      return r < 0.3 ? pal.woodLight : pal.wood;
    }
    if (p.part === 'post' || (p.part === 'rail' && mod(p.a, 5) === 0)) return pal.trunkDark;
    if (p.part === 'rail') return pal.woodLight;
    if (p.part === 'end' || mod(p.a, 3) === 2) return pal.woodDark;
    if (r < 0.08) return pal.woodLight;
    return Random.hash(Math.floor(p.a / 3), b.ca * 7 + 3) < 0.5 ? pal.woodAlt : pal.wood;
  }

  // Colored pixels, the visible side face below each span, and the shadow cast on the water.
  function bake(world, s, pal) {
    const { w, h, span } = world;
    const idx = [], col = [], shade = new Set();
    const ang = s.lightAngle * Math.PI / 180;
    const sx = Math.round(-Math.cos(ang) * 1.5), sy = Math.max(1, Math.round(Math.sin(ang) * 2.5));
    for (const b of world.bridges) {
      const faces = b.style === 'stone' ? [pal.stoneDark, pal.stoneMortar] : b.style === 'wood' ? [pal.trunkDark] : [];
      const solid = [];
      for (const p of b.px) {
        const c = pixelColor(b, p, pal);
        if (!c) continue;
        idx.push(p.i); col.push(c); solid.push([p.x, p.y]);
      }
      const top = solid.length;
      for (let n = 0; n < top; n++) {
        const [x, y] = solid[n];
        for (let k = 0; k < faces.length; k++) {
          const fy = y + 1 + k, j = fy * w + x;
          if (fy >= h || span[j] || !gap(world, j)) break;
          idx.push(j); col.push(faces[k]); solid.push([x, fy]);
        }
      }
      if (!s.shadows) continue;
      for (const [x, y] of solid) {
        const nx = x + sx, ny = y + sy, j = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && gap(world, j) && !span[j]) shade.add(j);
      }
    }
    for (const i of idx) shade.delete(i);
    return { idx: Int32Array.from(idx), col, shade: Int32Array.from(shade) };
  }

  // The baked pixels of every bridge (made on first use after a rebuild): { idx, col, shade }.
  function art(world, s, pal) {
    if (!world.bridgeArt) world.bridgeArt = bake(world, s, pal);
    return world.bridgeArt;
  }

  // Shadows on the water, then the bridges themselves. Runs right after the water.
  function draw(frame, world, s, pal) {
    if (!world.bridges || !world.bridges.length) return;
    const { idx, col, shade } = art(world, s, pal);
    for (let k = 0; k < shade.length; k++) {
      const p = shade[k] * 4;
      frame[p] *= SHADE[0]; frame[p + 1] *= SHADE[1]; frame[p + 2] *= SHADE[2];
    }
    for (let k = 0; k < idx.length; k++) {
      const p = idx[k] * 4, c = col[k];
      frame[p] = c[0]; frame[p + 1] = c[1]; frame[p + 2] = c[2];
    }
  }

  return { place, draw, gap, art, SHADE };
})();
