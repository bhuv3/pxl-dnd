#!/usr/bin/env node
// Proves the windowed solve (Resolve.runWindow, chosen by Incremental.update) gives the same world as solving the whole map.
// On each test map it applies many random edits (brushes and strokes of every ground, water and scatter material, rectangles,
// height, chasms), updates the world incrementally, and compares EVERY layer of the whole map with Resolve.run on the same
// painted map. Distances are compared up to the caps nothing reads beyond (40 for water, 4 for ground). Edits the window can't handle must fall back to a full
// solve (counted by reason). Exit code 1 on any difference.
//   node tests/map-editor/inctest.js [--edits=60] [--perf] [--seed=1]
const fs = require('fs');
const path = require('path');
const { load } = require('./loadmodules');
const { suite } = require('./testmaps');

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v === undefined ? true : v]));
const EDITS = +(args.edits || 60), SEED = +(args.seed || 1);
const M = load(['render/incremental'], ['Incremental']);
const { Resolve, Incremental, Random, Types, MapModel } = M;
const { GROUND: G, WATER: W, SCATTER: S } = Types;
const ROOT = path.resolve(__dirname, '..', '..');

let state = SEED * 2654435761 >>> 0;
const rnd = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// A random edit of the painted layers; returns a label.
function edit(map) {
  const { width: w, height: h } = map;
  const disc = (layer, cx, cy, r, v) => { for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) map[layer][y * w + x] = v; };
  const stroke = (layer, v, r) => { let x = ri(0, w - 1), y = ri(0, h - 1); for (let k = ri(1, 5); k > 0; k--) { disc(layer, x, y, r, v); x = Math.max(0, Math.min(w - 1, x + ri(-r, r))); y = Math.max(0, Math.min(h - 1, y + ri(-r, r))); } };
  const grounds = [G.DIRT, G.GRASS, G.SAND, G.PATH, G.COBBLE, G.GRAVEL, G.FLAGSTONE, G.CAVE_FLOOR, G.ROCK, G.STONE_WALL, G.WOOD_FLOOR, G.TILE, G.DRY_EARTH, G.SLATE];
  const pick = ri(1, 100);
  if (pick <= 34) { const v = grounds[ri(0, grounds.length - 1)]; stroke('ground', v, ri(2, 12)); return 'ground ' + v; }
  if (pick <= 50) { stroke('scatter', [S.NONE, S.FOREST, S.PINES, S.ROCKY, S.FLOWERS, S.BUSHES][ri(0, 5)], ri(3, 14)); return 'scatter'; }
  if (pick <= 68) { stroke('water', [W.NONE, W.LAKE, W.SEA][ri(0, 2)], ri(3, 14)); return 'water'; }
  if (pick <= 80) { const v = [G.PATH, G.COBBLE, G.FLAGSTONE][ri(0, 2)]; stroke('ground', v, ri(1, 3)); return 'path stroke'; }
  if (pick <= 88) { const x = ri(0, w - 40), y = ri(0, h - 40), ww = ri(5, 60), hh = ri(5, 60); for (let yy = y; yy < Math.min(h, y + hh); yy++) for (let xx = x; xx < Math.min(w, x + ww); xx++) map.ground[yy * w + xx] = grounds[ri(0, 5)]; return 'rectangle'; }
  if (pick <= 92) { stroke('elevation', ri(1, 3), ri(5, 15)); return 'elevation'; }
  if (pick <= 95) { stroke('water', W.CHASM, ri(3, 8)); return 'chasm'; }
  if (pick <= 98) { const x = ri(0, w - 100), y = ri(0, h - 100); for (let yy = y; yy < y + 100 && yy < h; yy++) for (let xx = x; xx < x + 100 && xx < w; xx++) map.ground[yy * w + xx] = G.SAND; return 'big rectangle'; }
  map.objects.push({ id: MapModel.nextId(map), type: 'tree', x: ri(0, w - 1), y: ri(0, h - 1), seed: ri(1, 9999), scale: 1, turn: 0 }); return 'object only';
}

function runMap(label, map, report) {
  Random.setSeed(map.seed);
  let world = Resolve.run(map);
  Incremental.remember(map);
  const stats = { edits: 0, window: 0, none: 0, full: {}, bad: [] };
  for (let n = 0; n < EDITS; n++) {
    const saved = Incremental.LAYERS.map(name => map[name].slice());      // to undo the edits that would keep the map raised
    const what = edit(map);
    Random.setSeed(map.seed);
    const r = Incremental.update(map, world);
    stats.edits++;
    if (r.kind === 'full') {
      stats.full[r.reason] = (stats.full[r.reason] || 0) + 1;
      if (what === 'elevation' || what === 'chasm') Incremental.LAYERS.forEach((name, k) => map[name].set(saved[k]));
      world = Resolve.run(map); Incremental.remember(map);
      continue;
    }
    if (r.kind === 'none') stats.none++; else stats.window++;
    Random.setSeed(map.seed);
    const ref = Resolve.run(map);
    const diffs = Incremental.diff(world, ref);
    if (diffs.length) { stats.bad.push({ edit: n, what, kind: r.kind, window: r.window, dirty: r.dirty, diffs }); world = ref; Incremental.remember(map); }
  }
  report.push({ label, ...stats });
}

const report = [];
const maps = suite(M).map(([name, map]) => [name, map]);
// Your own maps in samples/maps/ are tested too when they are there (the repo ships none).
for (const f of ['samples/maps/grand-arena.json', 'samples/maps/underdark-warren.json', 'samples/maps/big/dungeon-20261108-215704.json', 'samples/maps/big/harbor-town-20261108-214729.json'])
  if (fs.existsSync(path.join(ROOT, f))) maps.push([f.split('/').pop(), MapModel.deserialize(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')))]);
for (const [label, map] of maps) runMap(label, map, report);

let totalWindow = 0, totalEdits = 0, totalBad = 0;
const reasons = {};
for (const r of report) {
  totalEdits += r.edits; totalWindow += r.window; totalBad += r.bad.length;
  for (const k in r.full) reasons[k] = (reasons[k] || 0) + r.full[k];
  console.log(`${r.label.padEnd(34)} edits ${String(r.edits).padStart(3)}  windowed ${String(r.window).padStart(3)}  objects-only ${String(r.none).padStart(2)}  full ${String(Object.values(r.full).reduce((a, b) => a + b, 0)).padStart(3)}  MISMATCHES ${r.bad.length}`);
  for (const b of r.bad.slice(0, 3)) { console.log(`   edit ${b.edit} (${b.what}, ${b.kind}) dirty ${JSON.stringify(b.dirty)}`); b.diffs.slice(0, 4).forEach(d => console.log('     ' + d)); }
}
console.log(`\n${totalEdits} edits: ${totalWindow} solved by window, ${totalEdits - totalWindow} by full solve. Fallback reasons:`, reasons);
console.log(totalBad ? `\n${totalBad} windowed update(s) differ from the full solve.` : '\nEvery windowed update equals the full solve on every layer.');

if (args.perf && fs.existsSync(path.join(ROOT, 'samples/maps/big/harbor-town-20261108-214729.json'))) {
  const map = MapModel.deserialize(JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/maps/big/harbor-town-20261108-214729.json'), 'utf8')));
  Random.setSeed(map.seed);
  let t = performance.now(); let world = Resolve.run(map); const fullMs = performance.now() - t;
  Incremental.remember(map);
  const times = [];
  for (let n = 0; n < 12; n++) {
    const w = map.width, h = map.height, cx = ri(100, w - 100), cy = ri(100, h - 100), r = 12;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) map.ground[y * w + x] = [G.SAND, G.GRASS, G.DIRT, G.COBBLE][n % 4];
    Random.setSeed(map.seed);
    t = performance.now(); const res = Incremental.update(map, world); const ms = performance.now() - t;
    if (res.kind === 'window') times.push(ms); else { world = Resolve.run(map); Incremental.remember(map); }
  }
  console.log(`\nHarbor Town ${map.width}x${map.height}: full solve ${fullMs.toFixed(0)} ms; windowed solve of a radius-12 stroke ${times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : 'n/a'} ms (${times.length} windowed of 12)`);
}
process.exit(totalBad ? 1 : 0);
