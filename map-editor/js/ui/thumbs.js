// Library pictures of materials, tools, and objects, rendered by Preview from the open map's settings and cached.
const Thumbs = (() => {
  let cache = new Map();

  // Data URL of a picture (one pixel per map pixel; CSS scales it up crisply), or null before a map is open.
  function url(kind, id) {
    const map = Renderer.getMap();
    if (!map || !Renderer.getWorld()) return null;
    const key = kind + ':' + id;
    if (cache.has(key)) return cache.get(key);
    let out = null;
    try { out = Preview.render(kind, id, map).toDataURL(); } catch (e) { console.warn('No picture for ' + key, e); }
    cache.set(key, out);
    return out;
  }

  // Forgets every picture (after a new map, or a setting that changes how things look).
  function invalidate() { cache = new Map(); }

  return { url, invalidate };
})();
