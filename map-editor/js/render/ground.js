// Bakes the static ground layer: everything that doesn't move.
const Ground = (() => {
  const { GROUND } = Types;

  // Returns RGBA bytes for the whole map.
  function bake(world, map, pal) {
    const { w, h } = world;
    const s = map.settings;
    const out = new Uint8ClampedArray(w * h * 4);
    const put = (x, y, c) => {
      const i = (y * w + x) * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) put(x, y, groundColor(world, s, pal, x, y));
    }
    addPebbles(world, s, pal, put);
    darkenRings(world, pal, put);
    Height.shadeEdges(world, out);
    applyShadows(world, s, out);
    return out;
  }

  // Fairy rings: a band of darker grass along each ring of mushrooms.
  function darkenRings(world, pal, put) {
    const { w, h, ground } = world;
    for (const r of world.rings || []) {
      for (let y = Math.floor(r.y - r.ry - 2); y <= r.y + r.ry + 2; y++) {
        for (let x = Math.floor(r.x - r.rx - 2); x <= r.x + r.rx + 2; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h || ground[y * w + x] !== GROUND.GRASS) continue;
          const d = Math.hypot((x - r.x) / r.rx, (y - r.y) / r.ry);
          if (Math.abs(d - 1) < 1.3 / r.rx) put(x, y, pal.grassLip);
        }
      }
    }
  }

  // Oval shadows under objects, pushed away from the light, as a 0/1 mask (null when shadows are off).
  function shadowMask(world, s) {
    const { w, h } = world;
    if (!s.shadows) return null;
    const mask = new Uint8Array(w * h);
    const a = s.lightAngle * Math.PI / 180;
    const lx = Math.cos(a), ly = -Math.sin(a);
    for (const t of world.things) {
      if (t.kind !== 'object' || !t.sprite.shadowR) continue;
      const rx = t.sprite.shadowR, ry = rx * 0.38;
      const cx = t.x - lx * s.shadowLength * rx * 0.6;
      const cy = t.y - ly * s.shadowLength * ry * 0.5;
      for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++) {
        for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) mask[y * w + x] = 1;
        }
      }
    }
    return mask;
  }

  // Darkens the picture under the shadow mask. Saves the mask for per-frame drawing.
  function applyShadows(world, s, out) {
    const { w, h } = world;
    const mask = world.shadowMask = shadowMask(world, s);
    if (!mask) return;
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      out[i * 4] *= SHADE[0]; out[i * 4 + 1] *= SHADE[1]; out[i * 4 + 2] *= SHADE[2];
    }
  }

  const SHADE = [0.72, 0.76, 0.82];
  // Chance of a pebble per pixel by ground type (times pebbleAmount * 2); read by the GL twin (js/gl/ground.js).
  const PEBBLE_CHANCE = { [GROUND.DRY_EARTH]: 0.002, [GROUND.DIRT]: 0.003, [GROUND.PATH]: 0.002, [GROUND.SAND]: 0.0006, [GROUND.GRAVEL]: 0.006, [GROUND.CAVE_FLOOR]: 0.004 };

  // Color of one ground pixel, darkened next to walls (wood floors and cave floors get a contact shadow).
  function groundColor(world, s, pal, x, y) {
    const c = baseColor(world, s, pal, x, y);
    const i = y * world.w + x, d = world.toWall[i];
    if (d > 2 || d === 0 || world.water[i] || world.deck[i] || world.chasm[i]) return c;
    const f = d <= 1 ? 0.72 : ((x + y) & 1 ? 0.86 : 0.93);
    return [c[0] * f, c[1] * f, c[2] * f];
  }

  // Color of one ground pixel, from its type and neighbors.
  function baseColor(world, s, pal, x, y) {
    const { w, h, ground } = world;
    const i = y * w + x;
    const g = ground[i];
    const r = Random.hash(x + 101, y + 57);
    const above = y > 0 ? ground[i - w] : g;
    const below = y < h - 1 ? ground[i + w] : g;
    if (world.deck[i]) return deckColor(world, pal, x, y, r);
    switch (g) {
      case GROUND.GRASS:
        if (s.grassLip && below !== GROUND.GRASS) return pal.grassLip;
        return Random.noise(x, y, s.grassPatchSize, 0) < 0.42 ? pal.grassDark : pal.grassLight;
      case GROUND.SAND:
        if (world.seaDist[i] <= s.waveReach + 0.5 && s.waveReach >= 1) return pal.wetSand;
        return r < 0.05 ? pal.sandDark : pal.sand;
      case Resolve.UNDERWATER:
        return pal.shallow;
      case GROUND.PATH: {
        const left = x > 0 ? ground[i - 1] : g, right = x < w - 1 ? ground[i + 1] : g;
        if (above !== g || below !== g || left !== g || right !== g) return pal.pathEdge;
        return r < 0.06 ? pal.pathSpeck : pal.path;
      }
      case GROUND.COBBLE:
        return cobbleColor(world, s, pal, x, y);
      case GROUND.GRAVEL:
        return gravelColor(world, pal, x, y, r);
      case GROUND.FLAGSTONE:
        return flagstoneColor(world, s, pal, x, y, r);
      case GROUND.WOOD_FLOOR:
        return woodFloorColor(pal, x, y, r);
      case GROUND.TILE:
        return tileColor(pal, x, y, r);
      case GROUND.SLATE:
        return slateColor(pal, x, y, r);
      case GROUND.DRY_EARTH:
        return dryEarthColor(pal, x, y, r);
      case GROUND.CHASM:
        return chasmColor(pal, x, y, r);
      case GROUND.CAVE_FLOOR:
        return caveFloorColor(pal, x, y, r);
      case GROUND.ROCK:
        return rockColor(world, s, pal, x, y);
      case GROUND.STONE_WALL:
        return stoneWallColor(world, pal, x, y, r);
      case GROUND.MUD:
        return Random.noise(x, y, 5, 60) < 0.5 ? pal.mudDark : pal.mud;
      default:
        if (s.grassLip && above === GROUND.GRASS) return pal.dirtShadow;
        if (r < 0.04) return pal.dirtSpeck;
        if (r > 0.985) return pal.dirtLight;
        return Random.noise(x, y, 10, 40) < 0.45 ? pal.dirtDark : pal.dirt;
    }
  }

  // True when a 4-neighbor is not the same ground type (or off the map).
  function atEdge(world, x, y) {
    const { w, h, ground } = world;
    const i = y * w + x, g = ground[i];
    return x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
      ground[i - 1] !== g || ground[i + 1] !== g || ground[i - w] !== g || ground[i + w] !== g;
  }

  // How much a point offset (ox, oy) from a stone's center faces the light: -1 to 1.
  function facing(s, ox, oy) {
    const a = s.lightAngle * Math.PI / 180;
    const len = Math.hypot(ox, oy) || 1;
    return (ox * Math.cos(a) - oy * Math.sin(a)) / len;
  }

  // Small rounded stones with dark gaps, lit on the side facing the light.
  function cobbleColor(world, s, pal, x, y) {
    if (atEdge(world, x, y)) return pal.cobbleGap;
    const c = Random.cells(x, y, 5, 401);
    if (c.d2 - c.d1 < 0.8) return pal.cobbleGap;
    const rim = c.d2 - c.d1 < 2.2;
    const lit = facing(s, c.ox, c.oy);
    if (s.shading && rim && lit > 0.35) return pal.cobbleLight;
    if (s.shading && rim && lit < -0.35) return pal.cobbleDark;
    return c.id < 0.5 ? pal.cobble : pal.cobbleAlt;
  }

  // Loose stones: a speckle of light, dark, and warm grains, with a ragged dark border.
  function gravelColor(world, pal, x, y, r) {
    if (atEdge(world, x, y) && r < 0.6) return pal.gravelDark;
    const n = Random.noise(x, y, 6, 412);
    if (r < 0.1 + n * 0.08) return pal.gravelDark;
    if (r > 0.9) return pal.gravelLight;
    if (r > 0.84) return pal.gravelWarm;
    return pal.gravel;
  }

  // Large flat slabs with thin gaps; some gaps grow grass (a setting; never underground: no sun).
  function flagstoneColor(world, s, pal, x, y, r) {
    if (atEdge(world, x, y)) return pal.flagGap;
    const c = Random.cells(x, y, 8, 433);
    if (c.d2 - c.d1 < 1) return s.flagMoss && !s.underground && Random.noise(x, y, 9, 434) > 0.55 ? pal.grassDark : pal.flagGap;
    const rim = c.d2 - c.d1 < 2;
    const lit = facing(s, c.ox, c.oy);
    if (s.shading && rim && lit > 0.4) return pal.flagLight;
    if (s.shading && rim && lit < -0.4) return pal.flagDark;
    if (r < 0.04) return pal.flagDark;
    return c.id < 0.5 ? pal.flag : pal.flagAlt;
  }

  // Rows below (x, y) until the ground stops being wall: 1 = the wall's bottom row. 0 if none within max.
  function faceDepth(world, x, y, max) {
    const { w, h, ground } = world;
    for (let k = 1; k <= max; k++) {
      if (y + k >= h) return 0;
      if (!Types.isWall(ground[(y + k) * w + x])) return k;
    }
    return 0;
  }

  // True when a 4-neighbor is not wall.
  function wallEdge(world, x, y) {
    const { w, h, ground } = world;
    const i = y * w + x;
    return (x > 0 && !Types.isWall(ground[i - 1])) || (x < w - 1 && !Types.isWall(ground[i + 1])) ||
      (y > 0 && !Types.isWall(ground[i - w])) || (y < h - 1 && !Types.isWall(ground[i + w]));
  }

  // Rock mass seen from above: a 3-pixel cliff face on its lower edges with a lit lip,
  // a dark outline elsewhere, and a mottled top with the odd long crack.
  function rockColor(world, s, pal, x, y) {
    const k = faceDepth(world, x, y, 4);
    const streak = Random.hash(x + 71, 909) < 0.3;
    if (k === 1) return pal.rockOutline;
    if (k === 2) return streak ? pal.rockOutline : pal.rockDark;
    if (k === 3) return streak ? pal.rockDark : pal.rockMid;
    if (k === 4) return pal.rockLight;
    if (wallEdge(world, x, y)) return pal.rockOutline;
    const c = Random.cells(x, y, 16, 451);
    if (c.d2 - c.d1 < 0.7 && c.id < 0.35) return pal.rockOutline;
    const r = Random.hash(x + 13, y + 457);
    if (r < 0.03) return pal.rockMid;
    const t = Random.noise(x, y, 10, 452) + (r - 0.5) * 0.08;
    return t < 0.56 ? pal.rockDark : t < 0.72 ? pal.rockMid : pal.rockLight;
  }

  // Built wall: a 2-row brick face on its lower edge with a light cap above it, cap stones on top.
  function stoneWallColor(world, pal, x, y, r) {
    const k = faceDepth(world, x, y, 3);
    if (k === 1) return pal.stoneMortar;
    if (k === 2) return (x + (y % 2) * 2) % 4 === 0 ? pal.stoneMortar : pal.stoneDark;
    if (k === 3) return pal.stoneLight;
    if (wallEdge(world, x, y)) return pal.stoneMortar;
    if ((x + Math.floor(y / 3) * 2) % 5 === 0 || y % 3 === 0) return pal.stoneDark;
    return r < 0.08 ? pal.stoneDark : pal.stone;
  }

  // Plank floor: 3-pixel planks with dark gaps, staggered ends, two wood tones.
  function woodFloorColor(pal, x, y, r) {
    const row = Math.floor(y / 3);
    if (y % 3 === 2 || (x + row * 7) % 11 === 0) return pal.woodDark;
    if (r < 0.06) return pal.woodLight;
    return Random.hash(Math.floor((x + row * 7) / 11), row + 5) < 0.5 ? pal.woodAlt : pal.wood;
  }

  // Checkered tiles: 4-pixel squares in two colors, with a faint lit edge on the light ones.
  function tileColor(pal, x, y, r) {
    const light = ((x >> 2) + (y >> 2)) & 1;
    if (!light) return r < 0.05 ? pal.rockOutline : pal.tileDark;
    if ((y & 3) === 3 || (x & 3) === 3) return pal.flagDark;
    return r < 0.04 ? pal.flag : pal.tileLight;
  }

  // Square slate slabs, 6 pixels across, with dark joints and a lit top-left edge.
  function slateColor(pal, x, y, r) {
    const u = ((x % 6) + 6) % 6, v = ((y % 6) + 6) % 6;
    if (u === 5 || v === 5) return pal.slateGap;
    if (u === 0 || v === 0) return pal.slateLight;
    if (r < 0.05) return pal.slateGap;
    return Random.hash(Math.floor(x / 6), Math.floor(y / 6) + 3) < 0.5 ? pal.slate : pal.slateAlt;
  }

  // Sun-baked earth: pale with patches, specks, and a net of fine cracks.
  function dryEarthColor(pal, x, y, r) {
    const c = Random.cells(x, y, 9, 481);
    if (c.d2 - c.d1 < 0.55) return pal.dryEarthDark;
    if (r < 0.03) return pal.dryEarthDark;
    if (r > 0.97) return pal.dryEarthLight;
    return Random.noise(x, y, 14, 482) < 0.45 ? pal.dryEarthLight : pal.dryEarth;
  }

  // The bottomless dark of a chasm: a faint drifting haze and a few far specks of light.
  function chasmColor(pal, x, y, r) {
    if (r > 0.996) return pal.chasmStar;
    if (r > 0.99) return pal.chasmMid;
    const n = Random.noise(x, y, 18, 471) + (((x + y) & 1) ? 0.03 : -0.03);
    return n > 0.62 ? pal.chasmMid : pal.chasm;
  }

  // Cave floor: two tones in patches, specks, and the odd faint crack.
  function caveFloorColor(pal, x, y, r) {
    if (r < 0.04) return pal.caveFloorDark;
    if (r > 0.985) return pal.caveFloorLight;
    const c = Random.cells(x, y, 14, 463);
    if (c.d2 - c.d1 < 0.6 && c.id < 0.3) return pal.caveFloorShadow;
    return Random.noise(x, y, 12, 461) < 0.45 ? pal.caveFloorDark : pal.caveFloor;
  }

  // Wooden planks across the walking direction, with darker rails along the sides.
  function deckColor(world, pal, x, y, r) {
    const { w, h, deck } = world;
    const i = y * w + x;
    const vertical = deck[i] === 1;
    const isDeck = (nx, ny) => nx >= 0 && ny >= 0 && nx < w && ny < h && deck[ny * w + nx] === deck[i];
    const rail = vertical ? !isDeck(x - 1, y) || !isDeck(x + 1, y) : !isDeck(x, y - 1) || !isDeck(x, y + 1);
    if (rail) return pal.woodDark;
    if ((vertical ? y : x) % 3 === 2) return pal.woodDark;
    return r < 0.12 ? pal.woodLight : pal.wood;
  }

  // Small 2×2 pebbles on dirt, cave floor, sand paths, and gravel, and a few on sand.
  function addPebbles(world, s, pal, put) {
    const { w, h, ground, water } = world;
    const chance = PEBBLE_CHANCE;
    const mid = [(pal.pebbleLight[0] + pal.pebbleDark[0]) / 2, (pal.pebbleLight[1] + pal.pebbleDark[1]) / 2, (pal.pebbleLight[2] + pal.pebbleDark[2]) / 2];
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const i = y * w + x;
        const g = ground[i];
        const p = (chance[g] || 0) * s.pebbleAmount * 2;
        if (!p || Random.hash(x + 211, y + 97) >= p) continue;
        if (ground[i + 1] !== g || ground[i + w] !== g || ground[i + w + 1] !== g) continue;
        if (water[i] || water[i + 1] || water[i + w] || water[i + w + 1]) continue;
        if (world.deck[i] || world.deck[i + 1] || world.deck[i + w] || world.deck[i + w + 1]) continue;
        put(x, y, pal.pebbleLight);
        put(x + 1, y, mid);
        put(x, y + 1, pal.pebbleDark);
        put(x + 1, y + 1, pal.pebbleDark);
      }
    }
  }

  return { bake, shadowMask, SHADE, PEBBLE_CHANCE };
})();
