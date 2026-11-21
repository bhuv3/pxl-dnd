// The audit: one "everything" map with every terrain material (ground, water, scatter), every object type, rivers with a
// drop, paths over water and cliffs, and (raised variant) hills, terraces and stairs. Each variant runs through every GL stage
// and the whole frame, in all three seasons and at night, dawn and noon, and is compared with the CPU. Used by
// dev/gltest.html?audit=1. Add a new material or object type to the editor and it is in the audit automatically.
const GlAudit = (() => {
  const W = 560, H = 420, PER_ROW = 12;
  const SEASONS = ['summer', 'autumn', 'winter'];
  const HOURS = [2, 6.5, 12];

  // The map as plain data (what MapModel.serialize gives). raised: add hills, terraces and a lowered river.
  function everythingMap(raised, seed) {
    const map = MapModel.create(W, H, seed, Types.GROUND.GRASS);
    const block = (layer, x0, y0, x1, y1, v) => { for (let y = y0; y < y1 && y < H; y++) for (let x = x0; x < x1 && x < W; x++) map[layer][y * W + x] = v; };

    // One 30 x 30 block of every material that paints ground, water or scatter.
    // (A chasm drops far below everything, which makes a map raised, so only the raised variant gets one.)
    const materials = Types.MATERIALS.filter(m => ['ground', 'water', 'scatter'].includes(m.layer) && (raised || m.id !== 'chasm'));
    materials.forEach((m, k) => block(m.layer, 10 + (k % 14) * 38, 10 + Math.floor(k / 14) * 38, 40 + (k % 14) * 38, 40 + Math.floor(k / 14) * 38, m.value));

    // Every object type on a grid over the grass below.
    Types.OBJECTS.forEach((type, k) => {
      const x = 26 + (k % PER_ROW) * 40, y = 130 + Math.floor(k / PER_ROW) * 46;
      map.objects.push({ id: MapModel.nextId(map), type, x, y, seed: (k * 7919) % 65535 + 1, scale: 1, turn: 0 });
    });

    // A cobble road over a river (a bridge) and a lake with a pier, along the bottom.
    block('ground', 0, 392, W, 398, Types.GROUND.COBBLE);
    block('ground', 280, 380, 292, 420, Types.GROUND.COBBLE);
    block('ground', 60, 404, 140, 420, Types.GROUND.GRASS);
    map.rivers.push({ id: MapModel.nextId(map), points: [[0, 408], [200, 402], [400, 412], [559, 406]], width: 9, meander: 5, wobble: 0.3, seed: 31, drops: raised ? [[420, 410]] : [] });
    block('water', 150, 340, 230, 380, Types.WATER.LAKE);
    block('ground', 190, 360, 210, 392, Types.GROUND.WOOD_FLOOR);                // a dock reaching into the lake

    if (raised) {
      for (const [x0, y0, x1, y1, v] of [[440, 120, 540, 300, 1], [456, 140, 524, 280, 2], [472, 160, 508, 260, 3]]) block('elevation', x0, y0, x1, y1, v);
      block('terrace', 330, 300, 420, 360, 3);                                 // a flat plateau with cliff edges
      block('ground', 440, 200, 540, 208, Types.GROUND.PATH);                  // a path climbing the hill (stairs)
      block('ground', 336, 328, 430, 334, Types.GROUND.FLAGSTONE);             // a path over the plateau edge
    }
    return MapModel.serialize(map);
  }

  // Runs the audit. options: { raised: [false, true], seasons, hours, times }. Returns { rows, errors } like GlParity.suite.
  async function run(options = {}) {
    const rows = [], errors = [];
    for (const raised of options.raised || [false, true]) {
      for (const season of options.seasons || SEASONS) {
        let b;
        try {
          b = await GlParity.build(everythingMap(raised, 99), { season });
          b.name = `Everything ${raised ? 'raised' : 'flat'} ${season}`;
        } catch (e) { errors.push({ map: `everything ${raised ? 'raised' : 'flat'} ${season}`, error: String(e && e.stack || e) }); continue; }
        try { rows.push({ time: 0, ...GlGround.parity(b) }); } catch (e) { errors.push({ map: b.name, stage: 'ground', error: String(e && e.stack || e) }); }
        for (const hour of options.hours || HOURS) {
          const overrides = { timeOfDay: hour, underground: false, dayCycle: false };
          for (const time of options.times || [3.7]) {
            try { rows.push(...GlParity.stages(b, time, undefined, overrides)); rows.push(...GlParity.full(b, time, overrides)); }
            catch (e) { errors.push({ map: b.name, error: String(e && e.stack || e) }); }
          }
        }
      }
    }
    return { rows, errors };
  }

  return { everythingMap, run };
})();
