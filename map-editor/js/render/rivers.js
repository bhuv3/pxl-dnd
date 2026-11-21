// Turns river strokes into meandering water with a flow direction.
const Rivers = (() => {
  const { WATER, isPath } = Types;
  const STONE_MAX_WIDTH = 6;   // rivers narrower than this get stepping stones instead of bridges

  // Stamps every river into the world and records its final path.
  function stamp(map, world) {
    world.riverPaths = map.rivers.map(r => {
      const path = buildPath(r, map.settings);
      const drops = markDrops(path, r.drops || []);
      stampPath(world, path, map.settings);
      return { id: r.id, pts: path, length: path.length, drops };
    });
  }

  // Smoothed, resampled, wobbled centerline with a half-width at each point.
  function buildPath(river, s) {
    const smooth = chaikin(chaikin(river.points));
    const line = resample(smooth, 1);
    const salt = river.seed % 100000;
    const out = [];
    for (let k = 0; k < line.length; k++) {
      const p = line[k];
      const a = line[Math.max(0, k - 2)], b = line[Math.min(line.length - 1, k + 2)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      const fade = Math.min(1, k / 12, (line.length - 1 - k) / 12);   // ends stay where they were drawn
      const shift = (Random.noise1D(k, s.riverBendSize, salt) - 0.5) * 2 * river.meander * fade;
      const hw = river.width / 2 * (1 + (Random.noise1D(k, 10, salt + 1) - 0.5) * 2 * river.wobble);
      out.push({ x: p[0] - ty * shift, y: p[1] + tx * shift, tx, ty, hw: Math.max(0.6, hw) });
    }
    return out;
  }

  // Snaps each drop to its nearest path point and gives every point its level (0, -1, -2, …):
  // one level lower after each drop, going downstream. Returns the snapped drop points.
  function markDrops(path, drops) {
    const at = drops.map(([x, y]) => nearest(path, x, y)).sort((a, b) => a - b);
    let k = 0;
    path.forEach((p, j) => { while (k < at.length && at[k] <= j) k++; p.level = -k; });
    return at.map(j => path[j]);
  }

  // Index of the path point closest to (x, y).
  function nearest(path, x, y) {
    let best = 0, bestD = Infinity;
    path.forEach((p, j) => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bestD) { bestD = d; best = j; } });
    return best;
  }

  // Corner-cutting smoothing: each segment is replaced by two points at 1/4 and 3/4.
  function chaikin(pts) {
    if (pts.length < 3) return pts.slice();
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // Points spaced evenly along the line.
  function resample(pts, spacing) {
    if (pts.length < 2) return pts.slice();
    const out = [pts[0]];
    let carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      let t = spacing - carry;
      while (t <= seg) {
        out.push([x0 + (x1 - x0) * t / seg, y0 + (y1 - y0) * t / seg]);
        t += spacing;
      }
      carry = seg - (t - spacing);
    }
    return out;
  }

  // Fills a circle at each path point. Existing lakes and seas are left as they are.
  // Where a painted path crosses: narrow rivers get stepping stones, wide ones note the crossing for a bridge.
  // Each pixel takes the level of the path point straight across from it, so a drop is a clean line across the river.
  function stampPath(world, path, s) {
    const { w, h, water, flowX, flowY, ground, stones, crossing, riverLevel } = world;
    for (let k = 0; k < path.length; k++) {
      const p = path[k];
      const r = Math.ceil(p.hw);
      const cx = Math.round(p.x), cy = Math.round(p.y);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if ((x - p.x) ** 2 + (y - p.y) ** 2 > p.hw * p.hw) continue;
          const i = y * w + x;
          if (water[i] && water[i] !== WATER.RIVER) continue;
          flowX[i] = p.tx;
          flowY[i] = p.ty;
          if (isPath(ground[i])) {
            if (p.hw * 2 < STONE_MAX_WIDTH && s.steppingStones) stones[i] = 1;
            else crossing[i] = ground[i];
          }
          water[i] = WATER.RIVER;
          const along = Math.max(0, Math.min(path.length - 1, k + Math.round((x - p.x) * p.tx + (y - p.y) * p.ty)));
          riverLevel[i] = path[along].level;
        }
      }
    }
  }

  // Distance from a point to the nearest river edge; negative means inside.
  function hitDistance(path, x, y) {
    let best = Infinity;
    for (const p of path.pts) best = Math.min(best, Math.hypot(p.x - x, p.y - y) - p.hw);
    return best;
  }

  return { stamp, hitDistance };
})();
