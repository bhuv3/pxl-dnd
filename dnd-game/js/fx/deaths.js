// How each kind of creature dies, drawn from its own sprite: a goblin topples over, a skeleton collapses into a
// heap of bones, a slime melts into a puddle, a cultist sinks into the floor leaving a wisp of smoke, and a hero
// drops (unconscious, and back up when healed). The body stays where it fell.
const Deaths = (() => {
  const STYLES = { skeleton: 'collapse', slime: 'melt', cultist: 'sink', goblin: 'topple' };
  const GRAVITY = 700;                 // character pixels / s², for falling bones

  function styleOf(f) { return STYLES[f.key] || (f.side === 'hero' ? 'down' : 'topple'); }

  // Starts a figure's death. away: 1 or -1, the side it falls toward (away from the blow).
  function start(f, away) {
    const style = styleOf(f), a = Figures.art(f), d = a && a.dirs[f.dir];
    f.dead = { style, t: 0, away: away || -(Figures.facing(f) || 1), bones: style === 'collapse' && d ? bonesOf(d, f.id) : null };
    if (style === 'sink') Particles.burst('smoke', f.x, f.y - 6, 14, { speed: 6, spread: 3 });
    if (style === 'collapse') Particles.burst('dust', f.x, f.y, 6, { speed: 10, spread: 3 });
  }

  // The sprite's pixels as bones that fall, drift sideways, and stack into a heap (bottom ones land first, so the
  // skull ends up on top). The pale ones (bone) are kept, with some of the dark outline.
  function bonesOf(d, seed) {
    const S = CharacterArt.SIZE, rng = Random.makeRng(seed * 101 + 7), list = [], height = new Map();
    for (let y = d.bottom; y >= 0; y--) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4, c = [d.stand[i], d.stand[i + 1], d.stand[i + 2]];
        if (!d.stand[i + 3] || (c[0] + c[1] + c[2] < 240 && rng() < 0.6)) continue;
        const drift = (x - d.footX) * 0.6 + (rng() - 0.5) * 6, col = Math.round(x + drift);
        const h = height.get(col) || 0;
        height.set(col, h + 1);
        list.push({ x, y, drift, land: d.bottom - h, c, delay: (d.bottom - y) * 0.003 });
      }
    }
    return list;
  }

  function update(dt) { for (const f of Figures.list) if (f.dead) f.dead.t += dt; }

  // Draws a dead figure. s: { canvas (the posed sprite), top (its screen corner), size (screen px), feet (screen
  // point), d (the facing's art), tint, z }. The canvas is drawn turned, squashed, or sunk; bones are drawn one by one.
  function draw(c2d, f, s) {
    const D = f.dead, t = D.t;
    c2d.save();
    if (D.style === 'topple' || D.style === 'down') {
      const delay = D.style === 'down' ? 0.15 : 0, dur = D.style === 'down' ? 0.5 : 0.35;
      const k = Math.max(0, Math.min(1, (t - delay) / dur)), drop = D.style === 'down' && t > 0 ? s.z : 0;
      c2d.translate(s.feet.x, s.feet.y + drop);
      c2d.rotate(k * k * Math.PI / 2 * D.away);
      c2d.drawImage(s.canvas, s.top.x - s.feet.x, s.top.y - s.feet.y, s.size, s.size);
    } else if (D.style === 'melt') {
      const k = Shapes.easeOut(Math.min(1, t / 0.7));
      c2d.translate(s.feet.x, s.feet.y);
      c2d.scale(1 + 0.9 * k, 1 - 0.72 * k);
      c2d.drawImage(s.canvas, s.top.x - s.feet.x, s.top.y - s.feet.y, s.size, s.size);
    } else if (D.style === 'sink') {
      const H = (s.d.bottom + 1) * s.z / 2, k = Math.min(1, t / 0.9), down = Math.round(k * (H - s.z * 1.5) / (s.z / 2)) * (s.z / 2);
      c2d.beginPath();
      c2d.rect(s.top.x, s.top.y - s.size, s.size, s.feet.y - s.top.y + s.size);
      c2d.clip();
      c2d.drawImage(s.canvas, s.top.x, s.top.y + down, s.size, s.size);
    } else if (D.style === 'collapse') {
      drawBones(c2d, D, s);
    }
    c2d.restore();
  }

  // Each bone falls under gravity (top ones a moment later) and stops on its landing row.
  function drawBones(c2d, D, s) {
    const h = s.z / 2, PAD = (s.size / h - CharacterArt.SIZE) / 2;
    for (const b of D.bones) {
      const t = Math.max(0, D.t - b.delay), fall = 0.5 * GRAVITY * t * t;
      const y = Math.min(b.land, b.y + fall), tl = Math.sqrt(Math.max(0, 2 * (b.land - b.y) / GRAVITY)) || 1;
      const x = b.x + b.drift * Math.min(1, t / tl);
      c2d.fillStyle = Palette.css(b.c.map((v, k) => v * s.tint[k]));
      c2d.fillRect(s.top.x + Math.round(x + PAD) * h, s.top.y + Math.round(y + PAD) * h, h, h);
    }
  }

  function revive(f) { f.dead = null; }

  return { styleOf, start, update, draw, revive };
})();
