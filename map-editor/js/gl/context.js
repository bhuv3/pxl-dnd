// The WebGL2 context for the GL backend: one canvas the size of the map, made on demand, with context loss reported.
const Gl = (() => {
  let canvas = null, gl = null, lost = false, ok = null;
  let external = null;      // a canvas the page owns (the game's display): GL draws into it and never resizes it
  const lossHandlers = [];

  // True when this browser can run the GL backend (WebGL2 with float render targets). Checked once.
  function supported() {
    if (ok !== null) return ok;
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      ok = !!probe && !!probe.getExtension('EXT_color_buffer_float');
    } catch (e) { ok = false; }
    return ok;
  }

  // Makes GL use this page canvas (before init): the game draws the map and everything on it into its display canvas.
  function useCanvas(c) { external = c; }

  // Makes the canvas and context at w × h (the map's size), or resizes the one that exists. Returns the context.
  function init(w, h) {
    if (!canvas) {
      canvas = external || document.createElement('canvas');
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; lossHandlers.forEach(fn => fn()); });
      canvas.addEventListener('webglcontextrestored', () => { lost = false; });
    }
    if (!external) { canvas.width = w; canvas.height = h; }
    if (!gl) {
      gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('WebGL2 is not available');
      gl.getExtension('EXT_color_buffer_float');
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    }
    return gl;
  }

  return {
    supported, init, useCanvas,
    get: () => gl, canvas: () => canvas, isLost: () => lost || (gl && gl.isContextLost()),
    onLost: fn => lossHandlers.push(fn),
  };
})();
