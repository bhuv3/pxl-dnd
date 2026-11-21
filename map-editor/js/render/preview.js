// Tiny maps drawn with the real render pipeline, so library pictures look exactly like the map (at noon, no wind).
const Preview = (() => {
  const { GROUND, WATER } = Types;
  const SIZE = 22;    // visible map pixels per picture
  const PAD = 4;      // extra border, cut off afterwards, so map edges don't show
  const N = SIZE + PAD * 2;
  const MID = N >> 1;

  // Picture of a material, tool, or object as a SIZE × SIZE canvas (one canvas pixel = one map pixel).
  // base: the open map, whose seed and settings (season, colors, tree size…) the picture uses.
  function render(kind, id, base) {
    const mini = MapModel.create(N, N, base.seed, GROUND.GRASS);
    mini.settings = { ...base.settings, weather: 'clear', clouds: false, underground: false, grid: false };
    const sprite = kind === 'o' && (CharacterArt.has(id) || Animals.has(id)) ? Sprites.get(id, 7, 1, 0) : null;
    if (kind === 'm') paintMaterial(mini, Types.material(id));
    else if (kind === 't') paintDrop(mini);
    else placeObject(mini, id, sprite);
    const frame = draw(mini);
    if (sprite) stampSprite(frame, sprite, MID, baseRow(sprite));
    return crop(frame);
  }

  // Ground and paths fill the picture. Walls, water, and height are a blob, so their edges show.
  function paintMaterial(mini, m) {
    if (m.group === 'Ground' || m.group === 'Paths') return fill(mini, 'ground', () => m.value);
    if (m.layer === 'scatter') return fill(mini, 'scatter', () => m.value);
    if (m.id === 'sea') { fill(mini, 'ground', () => GROUND.SAND); return fill(mini, 'water', (x, y) => y + x * 0.35 > MID + 2 ? m.value : 0); }
    if (m.layer === 'water') { if (m.id === 'chasm') fill(mini, 'ground', () => GROUND.DIRT); return fill(mini, 'water', blob(8, m.value)); }
    if (m.id === 'lower') { fill(mini, 'elevation', () => 1); return fill(mini, 'elevation', blob(7, 0, 1)); }
    if (m.id === 'raise') return fill(mini, 'elevation', blob(7, 1));
    if (m.id === 'flatten') return fill(mini, 'terrace', blob(7, 2));
    fill(mini, 'ground', () => GROUND.DIRT);
    fill(mini, 'ground', blob(8, m.value, GROUND.DIRT));
  }

  // A river across the picture that drops a level halfway (the Lower river tool).
  function paintDrop(mini) {
    const s = mini.settings;
    mini.rivers.push({ id: 1, points: [[0, MID - 3], [N - 1, MID + 3]], width: 6, meander: 0, wobble: 0, seed: 11, drops: [[MID, MID]] });
    s.riverBendSize = Math.max(s.riverBendSize, 60);
  }

  // One object standing in the middle of the grass (ducks on water, doors between two walls).
  function placeObject(mini, type, sprite) {
    if (Animals.isAquatic(type)) fill(mini, 'water', () => WATER.LAKE);
    if (type === 'door') addDoorway(mini);
    mini.settings.reeds = mini.settings.lilyPads = false;
    mini.settings.flowerAmount = 0;
    if (sprite) return;
    const s = Sprites.get(type, 7, 1, 0);
    mini.objects.push({ id: 1, type, x: MID, y: type === 'door' ? MID : baseRow(s), seed: 7, scale: 1 });
    mini.settings.tuftDensity = Math.min(mini.settings.tuftDensity, 0.6);
  }

  // Two stone wall stubs with a gap between them, so a door fits.
  function addDoorway(mini) {
    fill(mini, 'ground', (x, y) => Math.abs(y - MID) <= 1 && Math.abs(x - MID) > 3 ? GROUND.STONE_WALL : null);
  }

  // Row for an object's base so the whole sprite sits centered.
  function baseRow(sprite) { return Math.round(MID - (sprite.box.minY + sprite.box.maxY) / 2); }

  // Sets a layer from fn(x, y) everywhere it returns a number.
  function fill(mini, layer, fn) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = fn(x, y);
      if (v != null) mini[layer][y * N + x] = v;
    }
  }

  // fn for a round blob of value (outside: other, or untouched when other is undefined).
  function blob(r, value, other) {
    return (x, y) => Math.hypot(x - MID, y - MID) <= r ? value : other;
  }

  // The rebuild and one still frame, like Renderer, minus things that move about (animals, characters, weather).
  function draw(mini) {
    const s = mini.settings;
    Random.setSeed(mini.seed);
    const pal = Colors.build(s.colors);
    const world = Resolve.run(mini);
    world.preview = true;
    Details.place(world, mini, pal);
    const frame = Ground.bake(world, mini, pal);
    Water.draw(frame, world, s, pal, 0);
    Bridges.draw(frame, world, s, pal);
    if (world.raised) Height.compose(frame, world, s, pal, 0);
    else Details.draw(frame, world, s, pal, 0);
    Fire.drawGlow(frame, world, pal, 0, 0);
    return frame;
  }

  // Draws a character or animal sprite (they aren't part of the rebuild).
  function stampSprite(frame, sprite, x0, y0) {
    for (const p of sprite.px) {
      const x = x0 + p.x, y = y0 + p.y;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const i = (y * N + x) * 4;
      frame[i] = p.c[0]; frame[i + 1] = p.c[1]; frame[i + 2] = p.c[2];
    }
  }

  // Cuts the padding off and returns a canvas.
  function crop(frame) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      const from = ((y + PAD) * N + PAD) * 4;
      img.data.set(frame.subarray(from, from + SIZE * 4), y * SIZE * 4);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  return { SIZE, render };
})();
