// The parts houses are built from, at the characters' scale (a storey is 12 px, a door 6 × 10): walls in built materials
// (plaster with worn patches, coursed stone, brick, clapboards, logs, mud), a timber frame, a stone foundation, framed
// windows and doors, roofs with volume (eaves that overhang and shade the wall, a ridge, courses that follow the slope;
// a front gable; a flat roof behind a parapet), chimneys, a porch, and things at the wall (barrel, woodpile, bush, ivy).
// Everything is drawn lit from the left into a pixel grid; Houses.build lays the parts out and mirrors the result when
// the light comes from the right.
const HouseKit = (() => {
  let P = null, S = null, grid = null, glass = null;
  const STOREY = 12, BASE = 2;

  // Starts a new house: the palette and sprite settings to draw with, and an empty grid.
  function start(pal, settings) { P = pal; S = settings; grid = new Map(); glass = []; }
  // The finished pixels (as a sprite's list) and the glass pixels (which light up at night).
  function finish() { return { px: [...grid.values()].map(p => ({ x: p.x, y: p.y, c: p.c, w: p.w || 0 })), glass }; }

  const mul = (c, k) => c.map(v => Math.min(255, v * k));
  const hash = (x, y) => Random.hash(x, y);

  // One pixel, the last write wins. w: how much it sways in the wind (a hanging sign, a flag).
  function put(x, y, c, w = 0) { grid.set(Math.round(x) + ',' + Math.round(y), { x: Math.round(x), y: Math.round(y), c, w }); }
  // Drops every pixel drawn so far that fits(x, y) rejects (a wall cut to a tapering tower).
  function keep(fits) { for (const [k, q] of grid) if (!fits(q.x, q.y)) grid.delete(k); }
  // Glass that lights up at night: group() starts a new window, lit() adds a pixel to it.
  function group() { return glass.length; }
  function lit(x, y, n) { glass.push([x, y, n]); }
  function get(x, y) { const p = grid.get(x + ',' + y); return p ? p.c : null; }
  function shade(x, y, k) { const q = grid.get(x + ',' + y); if (q) q.c = mul(q.c, k); }
  // Colours a pixel that's already there: each channel times its own factor (firelight on a wall).
  function tint(x, y, k) { const q = grid.get(x + ',' + y); if (q) q.c = q.c.map((v, i) => Math.min(255, v * k[i])); }

  // ---------- Materials: the colour of a wall pixel. col, row count from the wall's left and bottom. ----------

  const WALLS = {
    // Flat plaster with a few large patches of wear, darker toward the ground.
    plaster(col, row, [dark, mid, light], salt) {
      const n = Random.noise(col + salt, row * 1.6, 7, salt);
      return row < 2 ? dark : n > 0.68 ? light : n < 0.27 ? mul(mid, 0.93) : mid;
    },
    // Coursed stone: blocks of uneven length, each its own shade, mortar between.
    stone(col, row, [dark, mid, light], salt) {
      const course = Math.floor(row / 3), off = Math.floor(hash(course + salt, 3) * 5);
      const block = Math.floor((col + off) / 6), joint = (col + off) % 6 === Math.floor(hash(block + salt, course) * 2);
      if (row % 3 === 2 || joint) return P.stoneMortar;
      const k = hash(block * 3 + salt, course * 7);
      return k < 0.25 ? dark : k > 0.7 ? light : mid;
    },
    // Brick: two rows of brick and a mortar line, joints staggered course to course.
    brick(col, row, [dark, mid, light], salt) {
      const course = Math.floor(row / 3), off = course % 2 ? 3 : 0, brick = Math.floor((col + off) / 5);
      if (row % 3 === 2 || (col + off) % 5 === 0) return [168, 156, 138];
      const k = hash(brick + salt, course);
      return k < 0.22 ? dark : k > 0.8 ? light : mid;
    },
    // Clapboards: each board catches the light on top and shades the one below.
    plank(col, row, [dark, mid, light], salt) {
      const board = Math.floor(row / 3), part = row % 3;
      if (part === 0) return dark;
      return part === 2 ? (hash(board + salt, Math.floor(col / 9)) < 0.5 ? light : mid) : mid;
    },
    // Mud brick under a coat of earth: flat, with straw specks and a few paler patches.
    mud(col, row, [dark, mid, light], salt) {
      const n = hash(col * 3 + salt, row * 5), patch = Random.noise(col + salt, row * 1.4, 8, salt + 3);
      return row < 2 ? dark : n < 0.06 ? P.dirtSpeck : patch > 0.66 ? light : mid;
    },
    // Smooth lime render (a mill, a tower): one even coat with the odd pale fleck, darker at the foot.
    smooth(col, row, [dark, mid, light], salt) { return row < 2 ? dark : hash(col * 3 + salt, row * 7) < 0.04 ? light : mid; },
    // Round logs, three rows each.
    log(col, row, [dark, mid, light]) { return row % 3 === 0 ? dark : row % 3 === 2 ? light : mid; },
  };

  // A wall from x0 to x1, rows y0 (top) to y1 (bottom): the material, lit on the left edge and dark on the right.
  function wall(x0, x1, y0, y1, kind, ramp, salt) {
    const fn = WALLS[kind === 'timber' ? 'plaster' : kind];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let c = fn(x - x0, y1 - y, ramp, salt);
      if (kind !== 'log' && x === x0) c = mul(c, 1.1);
      if (kind !== 'log' && x === x1) c = mul(c, 0.8);
      put(x, y, c);
    }
    if (kind === 'log') for (let y = y0; y <= y1; y++) {             // log ends at the corners
      const end = (y1 - y) % 3 === 1 ? ramp[2] : ramp[0];
      put(x0 - 1, y, end); put(x1 + 1, y, mul(end, 0.85));
    }
  }

  // A timber frame over a plaster wall: corner posts, a sill and a top plate, studs, and braces in the end panels.
  function frame(x0, x1, y0, y1, beam, studs) {
    const dark = beam[0], lit = beam[1];
    for (let y = y0; y <= y1; y++) { put(x0, y, lit); put(x0 + 1, y, dark); put(x1, y, dark); put(x1 - 1, y, dark); }
    for (let x = x0; x <= x1; x++) { put(x, y0, lit); put(x, y0 + 1, dark); put(x, y1, dark); }
    for (const sx of studs) for (let y = y0 + 2; y < y1; y++) put(sx, y, dark);
    const h = y1 - y0 - 2;
    for (let k = 0; k < Math.min(h, 6); k++) { put(x0 + 2 + k, y1 - 1 - k, dark); put(x1 - 2 - k, y1 - 1 - k, dark); }
  }

  // The foundation: two rows of stone under the wall, a little wider than it.
  function foundation(x0, x1, y) {
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const joint = (x + 2) % 5 === 0;
      put(x, y - 1, joint ? P.rockMid : P.rockLight);
      put(x, y, (x % 5) === 0 ? P.rockDark : P.rockMid);
    }
  }

  // ---------- Openings ----------

  // A window: frame, four panes round a cross, a sill; shutters and a flower box when asked. (x, y) is its top-left.
  function windowAt(x, y, trim, o = {}) {
    const n = glass.length;
    for (let r = 0; r < 7; r++) for (let k = 0; k < 7; k++) {
      const edge = r === 0 || r === 6 || k === 0 || k === 6, bar = r === 3 || k === 3;
      let c = edge ? trim[0] : bar ? trim[1] : r < 3 ? P.windowDay : mul(P.windowDay, 0.78);
      if (!edge && !bar && r === 1 && k === 1) c = P.glint;
      put(x + k, y + r, c);
      if (!edge && !bar) glass.push([x + k, y + r, n]);
    }
    for (let k = -1; k <= 7; k++) put(x + k, y + 7, P.rockLight);
    for (let k = -1; k <= 7; k++) shade(x + k, y + 8, 0.82);
    if (o.shutters) for (let r = 0; r < 7; r++) for (const sx of [x - 2, x - 1, x + 7, x + 8]) put(sx, y + r, r === 0 || r === 6 || r === 3 ? o.shutters[0] : o.shutters[1]);
    if (o.box) for (let k = 0; k <= 6; k++) {
      put(x + k, y + 7, P.woodDark);
      put(x + k, y + 6, hash(x + k, y) < 0.45 ? [P.flower1, P.flower2, P.flower3][Math.floor(hash(x, k) * 3)] : P.canopyMid);
      if (hash(x + k, y + 9) < 0.4) put(x + k, y + 5, P.canopyLight);
    }
  }

  // A small attic window, 5 wide, centred on cx.
  function attic(cx, y, trim) {
    const n = glass.length;
    for (let r = 0; r < 5; r++) for (let k = -2; k <= 2; k++) {
      const edge = r === 0 || r === 4 || Math.abs(k) === 2;
      put(cx + k, y + r, edge ? trim[0] : r === 1 && k === -1 ? P.glint : P.windowDay);
      if (!edge) glass.push([cx + k, y + r, n]);
    }
  }

  // A door on the ground row y, w wide and h tall (6 × 10 unless told): frame, planks, a knob, a stone lintel and a step.
  // Arched when asked; a wide one is a pair of doors.
  function doorAt(x, y, ramp, arched, w = 6, h = 10) {
    const pair = w >= 9, mid = w >> 1;
    for (let r = 0; r < h; r++) for (let k = 0; k < w; k++) {
      if (arched && r === h - 1 && (k === 0 || k === w - 1)) continue;
      const edge = k === 0 || k === w - 1 || r === h - 1 || (arched && r === h - 2 && (k === 1 || k === w - 2)) || (pair && k === mid);
      put(x + k, y - r, edge ? P.trunkDark : k % 3 === 0 ? ramp[0] : r === 3 || r === h - 3 ? mul(ramp[1], 0.85) : ramp[1]);
    }
    if (pair) { put(x + mid - 1, y - 4, P.copperLight); put(x + mid + 1, y - 4, P.copperLight); } else put(x + w - 2, y - 4, P.copperLight);
    for (let k = -1; k <= w; k++) put(x + k, y - h, P.rockLight);
    for (let k = -1; k <= w; k++) { put(x + k, y + 1, k === -1 || k === w ? P.rockMid : P.rockLight); put(x + k, y + 2, P.rockMid); }
  }

  // ---------- Roofs ----------

  // The colour of a covering's pixel. col counts along the roof, r down the slope from the ridge.
  function covering(kind, col, r, [dark, mid, light], salt) {
    if (kind === 'tile') {
      const course = Math.floor(r / 3), part = r % 3, c = col + (course % 2 ? 2 : 0);
      if (part === 2) return c % 4 === 0 ? mid : dark;
      return part === 0 ? (c % 4 === 2 ? mid : light) : (hash(Math.floor(c / 4) + salt, course) < 0.2 ? light : mid);
    }
    if (kind === 'slate') {
      const course = Math.floor(r / 3), part = r % 3, c = col + (course % 2 ? 3 : 0);
      if (part === 2) return dark;
      if (c % 5 === 0) return dark;
      return hash(Math.floor(c / 5) + salt, course) < 0.25 ? light : mid;
    }
    if (kind === 'thatch') {
      const band = Math.floor(r / 5), streak = hash(col + salt, band);
      if (r % 5 === 4) return streak < 0.6 ? dark : mid;
      return streak < 0.22 ? dark : streak > 0.72 ? light : mid;
    }
    const course = Math.floor(r / 2), c = col + (course % 2 ? 2 : 0);            // wooden shingles
    return r % 2 === 1 ? (c % 4 === 0 ? mid : dark) : c % 4 === 0 ? dark : hash(Math.floor(c / 4) + salt, course) < 0.3 ? light : mid;
  }

  // A side-gable roof seen from the front: a sliver of the back slope, the ridge, then the front slope coming down to eaves
  // that overhang the wall (and shade it). x0..x1 is the wall; eave is the row the roof ends on; h the rows of front slope.
  function ridgeRoof(x0, x1, eave, h, kind, ramp, salt, trim) {
    const [dark, mid, light] = ramp, top = eave - h - 3, over = kind === 'thatch' ? 3 : 2;
    for (let y = top; y <= eave; y++) {
      const r = y - (top + 3);                                            // rows below the ridge
      let inset = Math.round((eave - y) / (h + 3) * 2);                   // narrower toward the ridge: it's further away
      if (kind === 'thatch') inset += y - top < 2 ? 2 - (y - top) : eave - y < 1 ? 1 : 0;
      const a = x0 - over + inset, b = x1 + over - inset;
      for (let x = a; x <= b; x++) {
        let c;
        if (r < -1) c = mul(dark, 0.9);                                   // the back slope, in shade
        else if (r === -1) c = light;                                     // the ridge cap
        else if (r === 0) c = dark;
        else c = mul(covering(kind, x - x0, r, ramp, salt), r < 4 ? 1.07 : eave - y < 3 ? 0.9 : 1);
        if (y === eave) c = mul(dark, 0.8);                               // the eave's edge
        if (kind !== 'thatch' && (x === a || x === b) && r >= -1) c = x === a ? light : mul(dark, 0.75);      // verge boards
        if (S.snow && (r < 2 || (r < 7 && hash(x + 51, y) < 0.6 - r * 0.07))) c = P.snow;
        put(x, y, c);
      }
    }
    for (let x = x0; x <= x1; x++) { shade(x, eave + 1, 0.62); shade(x, eave + 2, 0.8); }      // the eaves shade the wall
    if (kind === 'thatch') for (let x = x0 - over; x <= x1 + over; x++) if (hash(x + salt, 7) < 0.55) put(x, eave + 1, dark);
    return top;
  }

  // A front gable: a triangle of wall with the two slopes of its roof seen edge-on and running back up the main roof.
  // x0..x1 is the bay's wall, base the row the triangle sits on. Returns the apex row.
  function frontGable(x0, x1, base, kind, ramp, wallKind, wallRamp, salt, trim, back) {
    const [dark, mid, light] = ramp, cx = (x0 + x1) / 2, half = (x1 - x0) / 2 + 2, rise = Math.round(half * 0.8), apex = base - rise;
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      const edge = Math.round(base - rise * (1 - Math.abs(x - cx) / half)), left = x < cx;
      for (let y = edge - back; y < edge + 3; y++) {                      // the slope: lit on the left, shaded on the right
        const r = y - (edge - back);
        let c = covering(kind, left ? r : r + 2, Math.round(Math.abs(x - cx)), ramp, salt + 5);
        c = mul(c, left ? 1.08 : 0.8);
        if (y >= edge + 1) c = left ? trim[1] : trim[0];                  // barge boards
        if (r === 0) c = mul(dark, 0.9);
        if (S.snow && r < 2) c = P.snow;
        put(x, y, c);
      }
      for (let y = edge + 3; y <= base; y++) if (x >= x0 && x <= x1) {    // the triangle of wall under it
        let c = WALLS[wallKind === 'timber' ? 'plaster' : wallKind](x - x0, base - y + 30, wallRamp, salt);
        if (y === edge + 3) c = mul(c, 0.7);
        put(x, y, c);
      }
    }
    if (back > 3) { put(Math.round(cx), apex - back - 1, light); put(Math.round(cx), apex - back - 2, trim[0]); }       // a finial
    return apex;
  }

  // A flat roof behind a parapet (a mud house): the roof's surface seen from above, a rim round it, the parapet's front
  // with its corners stepped up, and the ends of the roof beams sticking out of the wall below. top is the wall's top row.
  function flatRoof(x0, x1, top, ramp, wallRamp, salt) {
    const [dark, mid, light] = ramp, depth = 6;
    for (let y = top - depth; y < top; y++) for (let x = x0; x <= x1; x++) {
      const rim = y === top - depth || x === x0 || x === x1;
      let c = rim ? (x === x1 ? wallRamp[0] : wallRamp[2]) : hash(x + salt, y) < 0.1 ? dark : Random.noise(x + salt, y * 2, 6, salt) > 0.62 ? light : mid;
      if (y === top - depth + 1 && !rim) c = mul(c, 0.8);                    // the back parapet's shadow
      if (S.snow && !rim && hash(x + 51, y) < 0.75) c = P.snow;
      put(x, y, c);
    }
    for (let x = x0; x <= x1; x++) put(x, top, x === x1 ? wallRamp[0] : wallRamp[2]);
    for (const cx of [x0, x0 + 1, x1 - 1, x1]) put(cx, top - depth - 1, wallRamp[2]);            // stepped corners
    for (let x = x0 + 3; x <= x1 - 3; x += 5) { put(x, top + 3, P.trunkLight); put(x, top + 4, P.trunkDark); shade(x, top + 5, 0.75); }
  }

  // A lantern on a bracket beside the door. Returns where its flame is.
  function lantern(x, y) {
    put(x, y - 1, P.iron); put(x - 1, y, P.iron); put(x + 1, y, P.iron); put(x, y, P.fire1); put(x, y + 1, P.iron);
    return [x, y];
  }

  // A chimney: a stack of stone (or brick) from the row bottom up to top, with a cap and a clay pot. Returns where its smoke rises.
  function chimney(x, bottom, top, brick) {
    const ramp = brick ? [[120, 52, 40], [150, 70, 52], [176, 96, 72]] : [P.stoneDark, P.stone, P.stoneLight], mortar = brick ? [168, 156, 138] : P.stoneMortar;
    for (let y = top; y <= bottom; y++) for (let k = 0; k < 5; k++) {
      const course = Math.floor((bottom - y) / 3), joint = (bottom - y) % 3 === 2 || (k + (course % 2 ? 2 : 0)) % 4 === 0;
      put(x + k, y, joint ? mortar : k === 0 ? ramp[2] : k === 4 ? ramp[0] : ramp[1]);
    }
    for (let k = -1; k <= 5; k++) { put(x + k, top - 1, S.snow ? P.snow : P.rockHighlight); put(x + k, top, P.rockDark); }
    for (let k = 1; k <= 3; k++) { put(x + k, top - 2, [176, 96, 72]); put(x + k, top - 3, k === 2 ? [120, 52, 40] : [150, 70, 52]); }
    return [x + 2, top - 4];
  }

  // A small tiled porch over the door, on two posts.
  function porch(door, y, ramp, kind, salt, beam, w = 6) {
    const a = door - 3, b = door + w + 2, top = y - 15;
    for (let r = 0; r < 5; r++) for (let x = a - (r > 2 ? 1 : 0); x <= b + (r > 2 ? 1 : 0); x++) put(x, top + r, r === 4 ? mul(ramp[0], 0.8) : r === 0 ? ramp[2] : covering(kind, x, r, ramp, salt));
    for (let yy = top + 5; yy <= y + 2; yy++) { put(a, yy, beam[1]); put(b, yy, beam[0]); }
    for (let x = a + 1; x < b; x++) shade(x, top + 5, 0.7);
  }

  // The door of a house seen end on: the door's edge in the wall's end at column x, a step out to that side (dir: 1 right,
  // -1 left), a little roof over it on a post, and worn earth beyond. y is the ground row.
  function sidePorch(x, y, dir, ramp, beam, salt) {
    for (let r = 0; r < 10; r++) put(x, y - r, r === 9 ? P.rockLight : P.trunkDark);
    for (let k = 1; k <= 5; k++) { put(x + dir * k, y + 1, k === 5 ? P.rockMid : P.rockLight); put(x + dir * k, y + 2, P.rockMid); }
    for (let r = 0; r < 3; r++) for (let k = 1; k <= 4 + r; k++) put(x + dir * k, y - 13 + r, r === 2 ? mul(ramp[0], 0.8) : r === 0 ? ramp[2] : ramp[1]);
    for (let yy = y - 10; yy <= y + 2; yy++) put(x + dir * 6, yy, dir > 0 ? beam[0] : beam[1]);
    apron(x + dir * 6, y + 3, salt);
  }

  // ---------- The ground and things at the wall ----------

  // Worn earth in front of the door, fading into the grass.
  function apron(cx, y, salt) {
    for (let r = 0; r < 4; r++) {
      const half = 6 - r;
      for (let x = cx - half; x <= cx + half; x++) {
        const n = hash(x + salt, r);
        if (Math.abs(x - cx) > half - 2 && n < 0.5) continue;
        put(x, y + r, n < 0.12 ? P.dirtSpeck : n > 0.8 ? P.dirtLight : P.dirt);
      }
    }
  }

  // A barrel standing on the ground row y.
  function barrel(x, y) {
    for (let r = 0; r < 6; r++) for (let k = 0; k < 5; k++) {
      if ((r === 0 || r === 5) && (k === 0 || k === 4)) continue;
      put(x + k, y - r, r === 1 || r === 4 ? P.iron : k === 0 ? P.woodLight : k === 4 ? P.woodDark : k === 2 ? P.woodDark : P.wood);
    }
  }

  // A stack of firewood against the wall.
  function woodpile(x, y) {
    for (let r = 0; r < 5; r++) for (let k = r > 3 ? 1 : 0; k < (r > 3 ? 8 : 9); k++) {
      const end = (k + r) % 2 === 0;
      put(x + k, y - r, end ? P.trunkLight : P.trunkDark);
    }
  }

  // A small bush with a few flowers.
  function bush(x, y, salt) {
    for (let r = 0; r < 4; r++) for (let k = r === 3 ? 1 : 0; k < (r === 3 ? 5 : 6); k++) {
      const n = hash(x + k + salt, r);
      put(x + k, y - r, r === 0 ? P.canopyDark : n < 0.18 ? P.flower2 : n > 0.7 ? P.canopyLight : P.canopyMid);
    }
  }

  // Ivy up a corner of the wall.
  function ivy(x, y, h, dir, salt) {
    for (let r = 0; r < h; r++) {
      const spread = Math.round((1 - r / h) * 4 + hash(r + salt, 2) * 2);
      for (let k = 0; k <= spread; k++) if (hash(x + k + salt, r) < 0.75) put(x + k * dir, y - r, hash(k + salt, r) < 0.35 ? P.canopyDark : hash(k, r + salt) < 0.3 ? P.canopyLight : P.canopyMid);
    }
  }

  // A sprite turned left to right, for light from the right: its pixels, its anchors (windows, chimney, lights), the pixels
  // it shows at rest, the spots it blocks and a lighthouse's beam.
  function mirror(sprite) {
    const flip = ([x, ...rest]) => [-x, ...rest], turn = list => list.map(q => ({ ...q, x: -q.x })), a = sprite.anchors || {};
    const anchors = { ...a };
    for (const k of ['windows', 'lights']) if (a[k]) anchors[k] = a[k].map(flip);
    for (const k of ['chimney', 'light', 'fire']) if (a[k]) anchors[k] = flip(a[k]);
    const out = { ...sprite, px: turn(sprite.px), anchors };
    if (sprite.still) out.still = turn(sprite.still);
    if (sprite.blocks) out.blocks = sprite.blocks.map(flip);
    if (sprite.beam) out.beam = { ...sprite.beam, x: -sprite.beam.x };
    return out;
  }

  return { STOREY, BASE, start, finish, mirror, put, keep, group, lit, mul, shade, tint, wall, frame, foundation, windowAt, attic, doorAt, covering, ridgeRoof, frontGable, flatRoof,
    chimney, porch, sidePorch, lantern, apron, barrel, woodpile, bush, ivy };
})();
