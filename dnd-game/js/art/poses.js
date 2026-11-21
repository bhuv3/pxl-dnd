// Which pixels a figure shows right now: a hero drawn in its named pose (with the arm a blade is swinging), or a
// monster's own sprite leaned into the pose (the upper body sheared forward or back, the feet planted).
// Null means its plain standing art.
const Poses = (() => {
  const SHEAR = { windup: -2, strike: 3, cast: 1, inhale: -1, hit: -2, dodge: -2, shiver: -1 };   // pixels at the head
  const cache = new Map();

  // The posed pixels for a figure and its facing's art, or null.
  function pixels(f, d) {
    const name = f.dead ? (f.dead.style === 'down' ? 'down' : null) : f.pose;
    if (Heroes.has(f.key)) return name || f.arm != null || f.hideHeld ? Heroes.posed(f.key, f.dir, name || 'stand', f.arm, f.hideHeld) : null;
    return SHEAR[name] ? sheared(f, d, SHEAR[name]) : null;
  }

  // The sprite with each row above the waist shifted toward the facing: more at the head, none at the waist.
  function sheared(f, d, k) {
    const dir = Figures.facing(f) || 1, id = `${f.key}|${f.seed}|${f.dir}|${k}`;
    if (cache.has(id)) return cache.get(id);
    const S = CharacterArt.SIZE, src = d.stand, out = new Uint8ClampedArray(src.length), waist = d.bottom - 6;
    let top = 0;
    while (top < waist && !src.subarray(top * S * 4, (top + 1) * S * 4).some((v, i) => i % 4 === 3 && v)) top++;
    for (let y = 0; y < S; y++) {
      const shift = y < waist ? Math.round(k * (waist - y) / Math.max(1, waist - top)) * dir : 0;
      for (let x = 0; x < S; x++) {
        const sx = x - shift;
        if (sx < 0 || sx >= S) continue;
        out.set(src.subarray((y * S + sx) * 4, (y * S + sx) * 4 + 4), (y * S + x) * 4);
      }
    }
    if (cache.size > 300) cache.clear();
    cache.set(id, out);
    return out;
  }

  // True when the pose is drawn into the pixels, so the screen-space lean isn't needed on top.
  function real(f) { return Heroes.has(f.key) || !!SHEAR[f.pose]; }

  return { pixels, real };
})();
