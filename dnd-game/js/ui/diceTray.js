// The dice tray: a pixel d20 in the corner of the stage that tumbles, lands on the roll, and shows the sum and
// what it was against. A natural 20 bursts gold; a natural 1 cracks and shakes. With advantage, disadvantage, or
// a Lucky reroll, the other die lands beside it, small and grey.
const DiceTray = (() => {
  const W = 92, H = 34, SCALE = 3, MARGIN = 12;
  const TUMBLE = 0.55, SETTLE = 0.45, HOLD = 1.6, FADE = 0.4;
  const COLORS = {
    panel: [22, 18, 28], border: [58, 51, 70], die: [236, 228, 210], gold: [255, 214, 80], dull: [196, 176, 168],
    edge: [52, 42, 56], facet: [196, 186, 168], ink: [38, 28, 40], label: [154, 146, 166], text: [232, 226, 214],
    hit: [140, 236, 110], miss: [190, 186, 196], crit: [255, 214, 80], crack: [150, 30, 36],
  };
  const RESULT_COLOR = { HIT: 'hit', CRIT: 'crit', MISS: 'miss', FUMBLE: 'crack', SAVE: 'miss', FAIL: 'hit', SHIELD: 'miss' };
  let roll = null, canvas, ctx, sparks = [];
  const rng = Random.makeRng(20);

  // Rolls on screen. spec: { value (the d20), dropped (the other die, or null), bonus, vs ('AC 15'), label ('ATTACK'),
  //   result ('HIT', 'MISS'…) }.
  // Resolves once the die has landed and settled; the tray stays up a little longer.
  function show(spec) {
    sparks = [];
    return new Promise(done => { roll = { ...spec, t: 0, done, face: 1 + Math.floor(rng() * 20), resolved: false }; });
  }

  function update(dt) {
    if (!roll) return;
    roll.t += dt;
    if (roll.t < TUMBLE && Math.floor(roll.t / 0.05) !== Math.floor((roll.t - dt) / 0.05)) roll.face = 1 + Math.floor(rng() * 20);
    if (roll.t >= TUMBLE && !roll.landed) land();
    if (!roll.resolved && roll.t >= TUMBLE + SETTLE) { roll.resolved = true; roll.done(); }
    sparks = sparks.filter(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 20 * dt; return (s.life -= dt) > 0; });
    if (roll.t >= TUMBLE + HOLD + FADE) roll = null;
  }

  // The die lands on the real number: a natural 20 throws gold sparks.
  function land() {
    roll.landed = true;
    roll.face = roll.value;
    if (roll.value === 20) for (let k = 0; k < 18; k++) {
      const a = rng() * Math.PI * 2, v = 14 + rng() * 22;
      sparks.push({ x: 13, y: 17, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + rng() * 0.4 });
    }
  }

  // Draws the tray in the stage's bottom-left corner (screen space).
  function draw(c2d) {
    if (!roll) return;
    if (!canvas) { canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d'); }
    const img = ctx.createImageData(W, H), px = img.data;
    const put = (x, y, c, a = 255) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
    drawPanel(put);
    drawDie(put);
    if (roll.dropped != null) drawDropped(put);
    drawText(put);
    for (const s of sparks) put(s.x, s.y, s.life > 0.25 ? COLORS.gold : COLORS.facet);
    ctx.putImageData(img, 0, 0);
    const t = roll.t, alpha = t > TUMBLE + HOLD ? Math.max(0, 1 - (t - TUMBLE - HOLD) / FADE) : 1;
    const shake = roll.landed && roll.value === 1 && t < TUMBLE + 0.3 ? Math.round((rng() - 0.5) * 4) : 0;
    c2d.save();
    c2d.imageSmoothingEnabled = false;
    c2d.globalAlpha = alpha;
    c2d.drawImage(canvas, MARGIN + shake, c2d.canvas.clientHeight - H * SCALE - MARGIN, W * SCALE, H * SCALE);
    c2d.restore();
  }

  function drawPanel(put) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const corner = (x === 0 || x === W - 1) && (y === 0 || y === H - 1);
        if (corner) continue;
        const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        put(x, y, edge ? COLORS.border : COLORS.panel, edge ? 255 : 225);
      }
    }
  }

  // A hexagon (the d20 seen face on) with facet lines and the number; it spins and bounces while tumbling.
  function drawDie(put) {
    const t = roll.t, tumbling = !roll.landed;
    const ang = tumbling ? t * 17 : 0, bounce = tumbling ? -Math.abs(Math.sin(t * Math.PI * 3.2)) * 5 * (1 - t / TUMBLE) : 0;
    const cx = 13, cy = 17 + bounce, R = 11;
    const v = [0, 1, 2, 3, 4, 5].map(i => [cx + Math.cos(ang + i * Math.PI / 3 + Math.PI / 6) * R, cy + Math.sin(ang + i * Math.PI / 3 + Math.PI / 6) * R]);
    const nat = roll.landed && roll.value;
    const pulse = nat === 20 ? 0.85 + 0.15 * Math.sin(t * 18) : 1;
    const body = nat === 20 ? COLORS.gold.map(c => c * pulse) : nat === 1 ? COLORS.dull : COLORS.die;
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) if (inside(v, x + 0.5, y + 0.5)) put(x, y, body);
    for (let i = 0; i < 6; i++) line(put, v[i], v[(i + 1) % 6], COLORS.edge);
    for (let i = 0; i < 6; i += 2) line(put, v[i], v[(i + 2) % 6], COLORS.facet);
    if (nat === 1) [[[cx - 7, cy - 6], [cx - 2, cy - 1]], [[cx - 2, cy - 1], [cx + 1, cy + 3]], [[cx + 1, cy + 3], [cx + 6, cy + 5]]].forEach(([a, b]) => line(put, a, b, COLORS.crack));
    text(put, String(roll.face), cx, cy - 2, COLORS.ink, true);
  }

  // The die that wasn't kept: a small grey square with its number, tumbling alongside, landing at the die's foot.
  function drawDropped(put) {
    const t = roll.t, x0 = 28, y0 = roll.landed ? 21 : 21 - Math.abs(Math.sin(t * Math.PI * 3.6)) * 4;
    const face = roll.landed ? roll.dropped : 1 + ((roll.face * 7) % 20);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 11; x++) put(x0 + x, y0 + y, x === 0 || y === 0 || x === 10 || y === 8 ? COLORS.edge : COLORS.dull.map(c => c * 0.75));
    text(put, String(face), x0 + 5.5, y0 + 2, COLORS.ink, true);
  }

  // The label from the start; the sum, what it's against, and the result once it lands.
  function drawText(put) {
    const x = roll.dropped != null ? 42 : 28;
    text(put, roll.label || 'ROLL', x, 4, COLORS.label);
    if (!roll.landed) return;
    const total = roll.value + (roll.bonus || 0), sign = roll.bonus < 0 ? '-' : '+';
    text(put, roll.bonus ? `${roll.value}${sign}${Math.abs(roll.bonus)}=${total}` : String(total), x, 11, COLORS.text);
    if (roll.vs) text(put, 'VS ' + roll.vs, x, 18, COLORS.label);
    const word = roll.value === 20 && roll.result === 'HIT' ? 'CRIT' : roll.value === 1 && roll.result === 'MISS' ? 'FUMBLE' : roll.result;
    if (word) text(put, word, x, 25, COLORS[RESULT_COLOR[word] || 'text']);
  }

  // A string in the 3 × 5 pixel font; centered on x when center is set.
  function text(put, str, x, y, color, center) {
    const x0 = center ? Math.round(x - (str.length * 4 - 1) / 2) : x;
    [...str.toUpperCase()].forEach((ch, n) => {
      const g = Popups.FONT[ch] || Popups.FONT[' '];
      for (let k = 0; k < 15; k++) if (g[k] === '1') put(x0 + n * 4 + (k % 3), y + Math.floor(k / 3), color);
    });
  }

  function inside(v, x, y) {
    let sign = 0;
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
    }
    return true;
  }

  function line(put, a, b, c) {
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    for (let i = 0; i <= n; i++) put(Math.round(a[0] + (b[0] - a[0]) * i / n), Math.round(a[1] + (b[1] - a[1]) * i / n), c);
  }

  return { show, update, draw, busy: () => !!roll && !roll.resolved };
})();
