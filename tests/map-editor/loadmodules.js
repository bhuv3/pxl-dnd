// Loads the editor's model and solving modules into one function scope (so they run at normal speed, unlike a Node vm
// context) and hands back the module objects. For tests that need no browser: node tests/map-editor/inctest.js.
const fs = require('fs');
const path = require('path');

const JS = path.resolve(__dirname, '..', '..', 'map-editor', 'js') + path.sep;
const SOLVING = ['core/random', 'core/grid', 'core/colors', 'model/constants', 'model/map', 'model/generate', 'model/places',
  'render/rivers', 'render/resolve', 'render/bridges', 'render/height'];

// extra: more module files (relative to js/) to load after the solving ones; names: the const names to return.
function load(extra = [], names = []) {
  const files = SOLVING.concat(extra);
  const source = files.map(f => fs.readFileSync(JS + f + '.js', 'utf8')).join('\n');
  const all = ['Random', 'Grid', 'Colors', 'Types', 'MapModel', 'Generate', 'Rivers', 'Resolve', 'Bridges', 'Height'].concat(names);
  const factory = new Function('atob', 'btoa', 'performance', 'console', `${source}\nreturn { ${all.join(', ')} };`);
  return factory(atob, btoa, performance, console);
}

module.exports = { load, JS };
