// Puts the world's layers on the GPU as textures, when a pass first asks for them, and forgets them at the next rebuild.
// A pass reads a layer with GpuWorld.tex('waterDist') and declares a new one with GpuWorld.define.
const GpuWorld = (() => {
  let world = null, map = null, revision = 0;
  let cache = new Map(), staticTex = null, staticOwned = true;   // staticOwned: false when staticTex belongs to GlGround

  // Layers any pass can ask for. from(world, map) returns a typed array of w * h values (w * h * comps for 2 and 4
  // channel formats); the format says how the GPU reads it (see GlTex.FORMATS).
  const LAYERS = {
    ground:    { format: 'R8UI',  from: w => w.ground },
    water:     { format: 'R8UI',  from: w => w.water },
    scatter:   { format: 'R8UI',  from: w => w.scatter },
    waterDist: { format: 'R32F',  from: w => w.waterDist },       // water pixels: distance to land
    landDist:  { format: 'R32F',  from: w => w.landDist },        // land pixels: distance to any water
    seaDist:   { format: 'R32F',  from: w => w.seaDist },         // land pixels: distance to the sea
    freshDist: { format: 'R32F',  from: w => w.freshDist },       // land pixels: distance to a lake or river
  };

  // Declares a layer: name, { format, from(world, map) }. Call it when a pass file loads.
  function define(name, spec) { LAYERS[name] = spec; }

  // A new world (after a rebuild): every layer is uploaded again the next time a pass asks. bytes is Ground.bake's
  // output, the picture every frame starts from.
  function begin(newWorld, newMap, bytes) {
    free();
    world = newWorld; map = newMap; revision++;
    if (bytes) setStatic(bytes);
  }

  // The static layer (the baked ground) as an RGBA8 texture, filled from CPU bytes.
  function setStatic(bytes) {
    const gl = Gl.get();
    if (!gl) return;
    const w = world.w, h = world.h;
    if (staticTex && (!staticOwned || staticTex.w !== w || staticTex.h !== h)) { if (staticOwned) GlTex.free(staticTex); staticTex = null; }
    if (!staticTex) staticTex = GlTex.make(w, h, 'RGBA8', null);
    staticOwned = true;
    GlTex.update(staticTex, bytes);
  }

  // The static layer as a texture somebody else draws into (GlGround's render target): GpuWorld uses it as it is and
  // never frees it.
  function setStaticTexture(tex) {
    if (staticTex && staticOwned && staticTex !== tex) GlTex.free(staticTex);
    staticTex = tex; staticOwned = false;
  }

  // The layer's texture, uploaded now if this is the first ask since the rebuild.
  function tex(name) {
    if (cache.has(name)) return cache.get(name);
    const spec = LAYERS[name];
    if (!spec) throw new Error('No GPU layer named ' + name);
    const data = spec.from(world, map);
    if (!data) throw new Error(`GPU layer ${name}: the world has no data for it`);
    const f = GlTex.FORMATS[spec.format];
    const t = GlTex.make(world.w, world.h, spec.format, f.Array && data.constructor === f.Array ? data : f.Array ? new f.Array(data) : data);
    cache.set(name, t);
    return t;
  }

  // Uploads a changed layer again right now (a small edit); w and h default to the whole layer.
  function refresh(name, x, y, w, h) {
    if (!cache.has(name)) return;
    const spec = LAYERS[name], data = spec.from(world, map);
    if (x === undefined) GlTex.update(cache.get(name), data);
    else throw new Error('Partial layer refresh is not built yet');
  }

  function free() {
    for (const t of cache.values()) GlTex.free(t);
    cache = new Map();
  }

  // Drops everything (the GL backend is turning off, or the context was lost).
  function clear() { free(); if (staticOwned) GlTex.free(staticTex); staticTex = null; staticOwned = true; world = map = null; }

  return {
    LAYERS, define, begin, setStatic, setStaticTexture, tex, refresh, clear,
    staticTex: () => staticTex, world: () => world, map: () => map, revision: () => revision,
  };
})();
