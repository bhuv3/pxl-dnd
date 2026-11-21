// Builds an adventure's maps from their data (docs/dnd-game/adventures.md section 4): a map editor map packed into the file
// (map), rooms carved square by square (build), or the map editor's generator (generate). Then, once the world
// exists, turns names into squares: places (the tavern), spots (where the party arrives), exits (a rectangle, or
// where a road leaves the map), areas.
const Maps = (() => {
  const S = 10;

  // A map model from a map's data: a map editor map (packed), the generator, or rooms carved square by square.
  // Editor and generated maps are flattened (the game doesn't draw hills yet); their doors and chests are placed
  // on the map, or found there if the map already has one on that square.
  function build(data) {
    if (data.map || data.generate) {
      const g = data.generate, m = data.map ? unpack(data.map) : Generate.landscape(g.width, g.height, g.seed, g.biome);
      m.elevation.fill(0);
      m.terrace.fill(0);
      m.objects = m.objects.filter(o => !CharacterArt.has(o.type));   // the adventure places its own people
      Object.assign(m.settings, (g && g.settings) || data.settings || {});
      const find = (type, sq) => m.objects.find(o => o.type === type && Math.floor(o.x / S) === sq[0] && Math.floor(o.y / S) === sq[1]);
      const put = (type, sq) => { const o = { id: m.nextId++, type, x: sq[0] * S + 5, y: sq[1] * S + 7, seed: 1000 + m.nextId * 37, scale: 1 }; m.objects.push(o); return o; };
      for (const d of data.doors || []) d.id = (find('door', d.sq) || put('door', d.sq)).id;
      for (const c of data.chests || []) c.id = (find('chest', c.sq) || put('chest', c.sq)).id;
      return m;
    }
    const b = data.build, G = Types.GROUND, m = MapModel.create(b.cols * S, b.rows * S, b.seed, G[b.wall]);
    for (const [[x0, y0, x1, y1], ground] of b.floors) {
      for (let y = y0 * S; y < (y1 + 1) * S; y++) for (let x = x0 * S; x < (x1 + 1) * S; x++) m.ground[y * m.width + x] = G[ground];
    }
    let id = 1;
    const put = (type, x, y) => { m.objects.push({ id: id++, type, x, y, seed: 1000 + id * 37, scale: 1 }); return id - 1; };
    for (const [type, x, y] of b.objects || []) put(type, x, y);
    for (const d of data.doors || []) d.id = put('door', d.sq[0] * S + 5, d.sq[1] * S + 7);
    for (const c of data.chests || []) c.id = put('chest', c.sq[0] * S + 5, c.sq[1] * S + 7);
    m.nextId = id;
    Object.assign(m.settings, b.settings || {});
    return m;
  }

  // ---------- Packed maps ----------
  // A map editor map inside an adventure file: MapModel.serialize, with each layer run-length packed when that's
  // smaller ("rle:" + base64 of [count, value] byte pairs), since most layers are long runs of one value.

  const LAYERS = ['ground', 'water', 'scatter', 'elevation', 'terrace'];

  function pack(map) {
    const out = MapModel.serialize(map);
    for (const k of LAYERS) {
      const bytes = map[k], runs = [];
      for (let i = 0; i < bytes.length;) {
        let n = 1;
        while (n < 255 && i + n < bytes.length && bytes[i + n] === bytes[i]) n++;
        runs.push(n, bytes[i]);
        i += n;
      }
      if (runs.length < bytes.length) out[k] = 'rle:' + toBase64(Uint8Array.from(runs));
    }
    return out;
  }

  function unpack(data) {
    const plain = { ...data };
    for (const k of LAYERS) {
      if (!(data[k] || '').startsWith('rle:')) continue;
      const runs = fromBase64(data[k].slice(4)), bytes = new Uint8Array(data.width * data.height);
      for (let i = 0, at = 0; i < runs.length; i += 2) { bytes.fill(runs[i + 1], at, at + runs[i]); at += runs[i]; }
      plain[k] = toBase64(bytes);
    }
    return MapModel.deserialize(JSON.parse(JSON.stringify(plain)));
  }

  function toBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromBase64(str) { const s = atob(str), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }

  // Names → squares for a built world. Returns { places, spot(name), at(where), exits, areas }.
  function layout(data, map) {
    const places = {};
    for (const o of map.objects) if (!places[o.type]) places[o.type] = { sx: Math.floor(o.x / S), sy: Math.floor(o.y / S) };
    const exits = (data.exits || []).map(e => ({ ...e, squares: e.rect ? rect(e.rect) : roadEnd(e.road) }));
    const at = w => freeNear(w.sq ? { sx: w.sq[0], sy: w.sq[1] }
      : w.place ? { sx: places[w.place].sx + w.offset[0], sy: places[w.place].sy + w.offset[1] }
      : inward(exits.find(e => e.id === w.exit).squares, w.inward));
    const areas = (data.areas || []).map(a => ({ ...a, rect: a.rect || around(places[a.place], a.radius) }));
    return { places, exits, areas, at, spot: name => at(data.spots[name]) };
  }

  function rect([x0, y0, x1, y1]) {
    const out = [];
    for (let sy = y0; sy <= y1; sy++) for (let sx = x0; sx <= x1; sx++) out.push({ sx, sy });
    return out;
  }
  function around(p, r) { return [p.sx - r, p.sy - r, p.sx + r, p.sy + r]; }

  // The squares where a road (path ground) meets one edge of the map.
  function roadEnd(edge) {
    const w = Stage.getWorld(), { cols, rows } = Squares.size(), out = new Map();
    for (let sy = 0; sy < rows; sy++) {
      for (let sx = 0; sx < cols; sx++) {
        const onEdge = edge === 'east' ? sx === cols - 1 : edge === 'west' ? sx === 0 : edge === 'north' ? sy === 0 : sy === rows - 1;
        if (!onEdge) continue;
        let road = 0;
        for (let y = sy * S; y < sy * S + S; y++) for (let x = sx * S; x < sx * S + S; x++) if (Types.isPath(w.ground[y * w.w + x])) road++;
        if (road > 15) out.set(Squares.key(sx, sy), { sx, sy });
      }
    }
    return [...out.values()];
  }

  // n squares from the middle of some squares toward the middle of the map.
  function inward(squares, n) {
    const { cols, rows } = Squares.size();
    const cx = squares.reduce((t, s) => t + s.sx, 0) / squares.length, cy = squares.reduce((t, s) => t + s.sy, 0) / squares.length;
    const dx = cols / 2 - cx, dy = rows / 2 - cy, d = Math.hypot(dx, dy) || 1;
    return { sx: Math.round(cx + dx / d * n), sy: Math.round(cy + dy / d * n) };
  }

  // The nearest square to sq that nothing blocks (a spiral outward).
  function freeNear(sq) {
    for (let r = 0; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!Squares.isSolid(sq.sx + dx, sq.sy + dy)) return { sx: sq.sx + dx, sy: sq.sy + dy };
      }
    }
    return sq;
  }

  return { build, layout, freeNear, pack, unpack };
})();
