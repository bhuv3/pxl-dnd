// Fingerprints Resolve.run's output on a fixed set of maps, so a change to Resolve can be shown not to alter the full
// solve. Usage: node tests/map-editor/resolvehash.js            prints the fingerprints
//               node tests/map-editor/resolvehash.js --save F   saves them to file F
//               node tests/map-editor/resolvehash.js --check F  compares with a saved file (exit code 1 on a difference)
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { load } = require('./loadmodules');

const M = load();
const ROOT = path.resolve(__dirname, '..', '..');
const FILES = ['samples/maps/grand-arena.json', 'samples/maps/underdark-warren.json', 'samples/maps/canyon-hideout.json',
  'samples/maps/desert-fortress.json', 'samples/maps/big/dungeon-20261108-215704.json', 'samples/maps/big/snowy-pines-20261108-215526.json',
  'samples/maps/big/harbor-town-20261108-214729.json'].filter(f => fs.existsSync(path.join(ROOT, f)));   // your own maps, when there (the repo ships none)

function hashWorld(world) {
  const out = {};
  for (const k of Object.keys(world).sort()) {
    const v = world[k];
    if (ArrayBuffer.isView(v)) out[k] = crypto.createHash('md5').update(Buffer.from(v.buffer, v.byteOffset, v.byteLength)).digest('hex').slice(0, 12);
    else if (Array.isArray(v) || (v && typeof v === 'object')) out[k] = crypto.createHash('md5').update(JSON.stringify(v)).digest('hex').slice(0, 12);
    else out[k] = String(v);
  }
  return out;
}

const results = {};
for (const f of FILES) {
  const map = M.MapModel.deserialize(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  M.Random.setSeed(map.seed);
  results[f] = hashWorld(M.Resolve.run(map));
}
for (const [name, map] of require('./testmaps').suite(M)) {
  M.Random.setSeed(map.seed);
  results[name] = hashWorld(M.Resolve.run(map));
}

const flag = process.argv[2], file = process.argv[3];
if (flag === '--save') { fs.writeFileSync(file, JSON.stringify(results, null, 1)); console.log('saved', Object.keys(results).length, 'fingerprints to', file); }
else if (flag === '--check') {
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  let bad = 0;
  for (const k of Object.keys(results)) for (const a of Object.keys(results[k])) if (saved[k] && saved[k][a] !== results[k][a]) { bad++; console.log('DIFFERENT', k, a); }
  console.log(bad ? `${bad} differences` : `Resolve output unchanged on all ${Object.keys(results).length} maps`);
  process.exit(bad ? 1 : 0);
} else console.log(JSON.stringify(results, null, 1).slice(0, 600) + '...');
