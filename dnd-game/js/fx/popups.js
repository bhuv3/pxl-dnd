// Floating text in screen space (damage numbers, MISS, CRIT) in a tiny pixel font with a dark outline.
const Popups = (() => {
  // 3 × 5 glyphs, one string of 15 bits per character, row by row.
  const FONT = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
    '+': '000010111010000', '-': '000000111000000', ' ': '000000000000000',
    '!': '010010010000010', '/': '001001010100100', '=': '000111000111000',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111',
  };
  const COLORS = { damage: [255, 92, 72], heal: [140, 236, 110], miss: [190, 186, 196], crit: [255, 214, 80], radiant: [255, 236, 150], info: [200, 220, 255] };
  const OUTLINE = 'rgb(20, 14, 18)';
  const live = [];

  // Shows text above a map point. o: { color (key or RGB), big, delay, rise }.
  function add(text, x, y, o = {}) {
    live.push({ text: String(text).toUpperCase(), x, y, age: -(o.delay || 0), life: o.life || 0.9,
      color: COLORS[o.color] || o.color || COLORS.damage, big: !!o.big, rise: o.rise ?? 7 });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) if ((live[i].age += dt) >= live[i].life) live.splice(i, 1);
  }

  // Rises fast then slows; pops bigger for the first moment; fades at the end.
  function draw(c2d) {
    const z = Stage.cam.zoom;
    for (const p of live) {
      if (p.age < 0) continue;
      const t = p.age / p.life, ease = 1 - (1 - Math.min(1, t * 1.6)) ** 3;
      const scale = Math.max(2, Math.round(z * (p.big ? 0.75 : 0.5))) + (t < 0.12 ? 1 : 0);
      const at = Stage.toScreen(p.x, p.y - ease * p.rise);
      const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      text(c2d, p.text, Math.round(at.x), Math.round(at.y), scale, Palette.css(p.color, alpha), alpha);
    }
  }

  // Draws a centered string: outline first, then the letters.
  function text(c2d, str, cx, y, s, fill, alpha) {
    str = str.toUpperCase();
    const w = str.length * 4 * s - s, x0 = cx - Math.round(w / 2);
    const cells = [];
    [...str].forEach((ch, n) => {
      const g = FONT[ch] || FONT[' '];
      for (let k = 0; k < 15; k++) if (g[k] === '1') cells.push([x0 + (n * 4 + (k % 3)) * s, y + Math.floor(k / 3) * s]);
    });
    c2d.globalAlpha = alpha;
    c2d.fillStyle = OUTLINE;
    for (const [x, yy] of cells) c2d.fillRect(x - s, yy - s, s * 3, s * 3);
    c2d.fillStyle = fill;
    for (const [x, yy] of cells) c2d.fillRect(x, yy, s, s);
    c2d.globalAlpha = 1;
  }

  return { FONT, add, update, draw, text, clear: () => { live.length = 0; } };
})();
