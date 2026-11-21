// Painted-area selections: pick a connected patch, then move, resize, change, or erase it.
const Areas = (() => {
  const EMPTY = { ground: Types.GROUND.DIRT, water: Types.WATER.NONE, scatter: Types.SCATTER.NONE };

  // Selection for the connected patch under (x, y). The top layer wins unless groundOnly.
  function pick(map, x, y, groundOnly) {
    const i = y * map.width + x;
    const layer = groundOnly ? 'ground' : map.scatter[i] ? 'scatter' : map.water[i] ? 'water' : 'ground';
    const data = map[layer];
    return make(layer, data[i], Grid.floodFill(map.width, map.height, j => data[j], x, y));
  }

  function make(layer, value, mask) {
    let count = 0;
    for (let i = 0; i < mask.length; i++) count += mask[i];
    return { type: 'area', layer, value, mask, count };
  }

  // Writes a value wherever mask is set. Ground replaces water, like painting does.
  function write(map, layer, value, mask) {
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      map[layer][i] = value;
      if (layer === 'ground') map.water[i] = Types.WATER.NONE;
    }
  }

  // Resets a layer wherever mask is set. Ground is filled with what surrounds it; other layers become empty.
  function clear(map, layer, mask) {
    const value = layer === 'ground' ? surroundingGround(map, mask) : EMPTY[layer];
    for (let i = 0; i < mask.length; i++) if (mask[i]) map[layer][i] = value;
  }

  // Most common ground type just outside the mask (dirt if there is none).
  function surroundingGround(map, mask) {
    const w = map.width, h = map.height;
    const counts = new Map();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (mask[i]) continue;
        const touches = (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w]);
        if (touches) counts.set(map.ground[i], (counts.get(map.ground[i]) || 0) + 1);
      }
    }
    let best = EMPTY.ground, n = 0;
    for (const [v, c] of counts) if (c > n) { best = v; n = c; }
    return best;
  }

  // Mask moved by (dx, dy). Pixels pushed off the map are dropped.
  function shift(mask, w, h, dx, dy) {
    const out = new Uint8Array(mask.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
      }
    }
    return out;
  }

  // Mask grown (dir > 0) or shrunk (dir < 0) by one pixel on every side.
  function morph(mask, w, h, dir) {
    const out = mask.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const nb = [x > 0 ? mask[i - 1] : 0, x < w - 1 ? mask[i + 1] : 0, y > 0 ? mask[i - w] : 0, y < h - 1 ? mask[i + w] : 0];
        if (dir > 0 && !mask[i] && nb.some(v => v)) out[i] = 1;
        if (dir < 0 && mask[i] && nb.some(v => !v)) out[i] = 0;
      }
    }
    return out;
  }

  // Moves the area. Returns the updated selection.
  function move(map, sel, dx, dy) {
    const moved = shift(sel.mask, map.width, map.height, dx, dy);
    clear(map, sel.layer, sel.mask);
    write(map, sel.layer, sel.value, moved);
    return make(sel.layer, sel.value, moved);
  }

  // Grows or shrinks the area by one pixel. Returns the updated selection.
  function resize(map, sel, dir) {
    const next = morph(sel.mask, map.width, map.height, dir);
    if (dir > 0) write(map, sel.layer, sel.value, next);
    else clear(map, sel.layer, sel.mask.map((v, i) => v && !next[i] ? 1 : 0));
    return make(sel.layer, sel.value, next);
  }

  // Turns the area into another material. Ground stays as the base under water and areas.
  function change(map, sel, material) {
    if (material.layer !== sel.layer && sel.layer !== 'ground') clear(map, sel.layer, sel.mask);
    write(map, material.layer, material.value, sel.mask);
    return make(material.layer, material.value, sel.mask);
  }

  // Clears the area's layer.
  function erase(map, sel) { clear(map, sel.layer, sel.mask); }

  // False once something else has changed the selected pixels.
  function isValid(map, sel) {
    const data = map[sel.layer];
    for (let i = 0; i < sel.mask.length; i++) if (sel.mask[i] && data[i] !== sel.value) return false;
    return sel.count > 0;
  }

  // Display name, e.g. "Grass".
  function name(sel) { return Types.materialFor(sel.layer, sel.value).name; }

  // Highlight image of the area: a light fill, brighter on the edge. Cached on the selection.
  function canvas(sel, w, h) {
    if (sel.canvas) return sel.canvas;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const m = sel.mask;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!m[i]) continue;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !m[i - 1] || !m[i + 1] || !m[i - w] || !m[i + w];
        img.data.set([255, 255, 255, edge ? 230 : 70], i * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    return (sel.canvas = c);
  }

  return { pick, move, resize, change, erase, isValid, name, canvas };
})();
