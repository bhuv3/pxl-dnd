// Glow: banded halos drawn additively, so fire, lightning and magic light up what is behind them instead of covering it.
// A halo is a small canvas (one pixel per map pixel, a few flat bands with a dithered edge, like the game's lights) kept per
// colour type and radius, and drawn with globalCompositeOperation 'lighter', which Canvas 2D and GlScreen both support.
const Glow = (() => {
  const cache = new Map();
  const BANDS = [0.9, 0.55, 0.3, 0.14];                  // how bright each band is, centre first

  // The halo canvas for a colour type and radius (made once).
  function sprite(type, radius) {
    const key = type + ':' + radius;
    if (cache.has(key)) return cache.get(key);
    const R = Math.ceil(radius), n = R * 2 + 1, ramp = Palette.of(type).rgb;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const g = cv.getContext('2d'), img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - R, y - R) / radius;
        if (d >= 1) continue;
        let band = Math.floor(d * 4);
        if (((x + y) & 1) && d * 4 - band > 0.7 && band < 3) band++;                 // a dithered step between bands
        const c = ramp[band < 2 ? 1 : 2], i = (y * n + x) * 4, a = BANDS[band];
        img.data[i] = c[0] * a; img.data[i + 1] = c[1] * a; img.data[i + 2] = c[2] * a; img.data[i + 3] = 255 * a;
      }
    }
    g.putImageData(img, 0, 0);
    cache.set(key, cv);
    return cv;
  }

  // Draws a halo of `type` centred on a map point; k scales its strength, squash flattens it (the floor is seen at a slant).
  function draw(c2d, x, y, radius, type, k = 1, squash = 1) {
    if (k <= 0.01) return;
    const cv = sprite(type, Math.max(4, Math.round(radius / 4) * 4)), z = Stage.cam.zoom, n = cv.width;
    const q = Stage.toScreen(x - n / 2, y - n * squash / 2);
    c2d.save();
    c2d.globalCompositeOperation = 'lighter';
    c2d.globalAlpha = Math.min(1, k);
    c2d.imageSmoothingEnabled = false;
    c2d.drawImage(cv, q.x, q.y, n * z, n * z * squash);
    c2d.restore();
  }

  // An active (see Shapes) that is just a halo: grows, holds, fades. o: { at, radius, type, time, power, squash }
  function flash(o) {
    let t = 0;
    return {
      update(dt) { t += dt; return t < o.time; },
      draw(c2d) {
        const k = t / o.time, grow = Shapes.easeOut(Math.min(1, k * 3));
        draw(c2d, o.at.x, o.at.y, Math.max(2, o.radius * (0.4 + 0.6 * grow)), o.type, (o.power ?? 1) * (k < 0.25 ? 1 : 1 - (k - 0.25) / 0.75), o.squash ?? 1);
      },
      light() {},
    };
  }

  return { sprite, draw, flash };
})();
