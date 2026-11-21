// Grid helpers: distance fields, flood fill, and turning strokes into pixel masks.
const Grid = (() => {
  let maskCanvas = null, maskCtx = null;

  // Distance from each pixel to the nearest source pixel (two-pass chamfer). With win ({ x0, y0, x1, y1 }, x1 and y1 exclusive)
  // only that rectangle is computed, as if the rest of the map did not exist: pixels outside it are left at 0 and must not be read.
  function distanceField(w, h, isSource, win) {
    const x0 = win ? win.x0 : 0, y0 = win ? win.y0 : 0, x1 = win ? win.x1 : w, y1 = win ? win.y1 : h;
    const d = new Float32Array(w * h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; d[i] = isSource[i] ? 0 : 1e9; }
    const D = 1.41;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        if (d[i] === 0) continue;
        let v = d[i];
        if (x > x0) v = Math.min(v, d[i - 1] + 1);
        if (y > y0) {
          v = Math.min(v, d[i - w] + 1);
          if (x > x0) v = Math.min(v, d[i - w - 1] + D);
          if (x < x1 - 1) v = Math.min(v, d[i - w + 1] + D);
        }
        d[i] = v;
      }
    }
    for (let y = y1 - 1; y >= y0; y--) {
      for (let x = x1 - 1; x >= x0; x--) {
        const i = y * w + x;
        if (d[i] === 0) continue;
        let v = d[i];
        if (x < x1 - 1) v = Math.min(v, d[i + 1] + 1);
        if (y < y1 - 1) {
          v = Math.min(v, d[i + w] + 1);
          if (x < x1 - 1) v = Math.min(v, d[i + w + 1] + D);
          if (x > x0) v = Math.min(v, d[i + w - 1] + D);
        }
        d[i] = v;
      }
    }
    return d;
  }

  // Mask of all pixels connected to (sx, sy) that share the same key.
  function floodFill(w, h, keyAt, sx, sy) {
    const mask = new Uint8Array(w * h);
    const start = sy * w + sx;
    const target = keyAt(start);
    const stack = [start];
    mask[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i / w) | 0;
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (y > 0) visit(i - w);
      if (y < h - 1) visit(i + w);
    }
    function visit(j) {
      if (!mask[j] && keyAt(j) === target) { mask[j] = 1; stack.push(j); }
    }
    return mask;
  }

  // Rasterizes a stroke (or a filled closed shape) into a 0/1 mask.
  function maskFromPath(w, h, points, { width = 1, closed = false } = {}) {
    if (!maskCanvas || maskCanvas.width !== w || maskCanvas.height !== h) {
      maskCanvas = document.createElement('canvas');
      maskCanvas.width = w;
      maskCanvas.height = h;
      maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    }
    const ctx = maskCtx;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ctx.strokeStyle = '#fff';
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    if (points.length === 1 && !closed) {
      ctx.arc(points[0][0] + 0.5, points[0][1] + 0.5, Math.max(0.5, width / 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      points.forEach(([x, y], i) => i ? ctx.lineTo(x + 0.5, y + 0.5) : ctx.moveTo(x + 0.5, y + 0.5));
      if (closed) {
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 1;
      } else {
        ctx.lineWidth = width;
      }
      ctx.stroke();
    }
    const data = ctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
    return mask;
  }

  // Mask of pixels where test(value) is true.
  // 1 where test(value) holds. With win (and the map's width w) only that rectangle is filled.
  function maskWhere(arr, test, win, w) {
    const m = new Uint8Array(arr.length);
    if (!win) { for (let i = 0; i < arr.length; i++) m[i] = test(arr[i]) ? 1 : 0; return m; }
    for (let y = win.y0; y < win.y1; y++) for (let x = win.x0; x < win.x1; x++) { const i = y * w + x; m[i] = test(arr[i]) ? 1 : 0; }
    return m;
  }

  return { distanceField, floodFill, maskFromPath, maskWhere };
})();
