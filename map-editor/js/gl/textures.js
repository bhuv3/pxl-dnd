// Texture helpers. Every texture is sampled with nearest filtering and clamped edges, and read with texelFetch.
const GlTex = (() => {
  // Format names. 'R8UI' and the other integer formats are read as usampler2D / isampler2D: texelFetch(t, p, 0).r is
  // the exact integer. 'R8' is read as sampler2D and comes back as value / 255.
  const FORMATS = {
    R8UI:   { internal: 'R8UI',    format: 'RED_INTEGER',  type: 'UNSIGNED_BYTE',  Array: Uint8Array,   comps: 1 },
    R16UI:  { internal: 'R16UI',   format: 'RED_INTEGER',  type: 'UNSIGNED_SHORT', Array: Uint16Array,  comps: 1 },
    R8I:    { internal: 'R8I',     format: 'RED_INTEGER',  type: 'BYTE',           Array: Int8Array,    comps: 1 },
    R16I:   { internal: 'R16I',    format: 'RED_INTEGER',  type: 'SHORT',          Array: Int16Array,   comps: 1 },
    R32I:   { internal: 'R32I',    format: 'RED_INTEGER',  type: 'INT',            Array: Int32Array,   comps: 1 },
    R8:     { internal: 'R8',      format: 'RED',          type: 'UNSIGNED_BYTE',  Array: Uint8Array,   comps: 1 },
    R32F:   { internal: 'R32F',    format: 'RED',          type: 'FLOAT',          Array: Float32Array, comps: 1 },
    RG32F:  { internal: 'RG32F',   format: 'RG',           type: 'FLOAT',          Array: Float32Array, comps: 2 },
    RGBA8:  { internal: 'RGBA8',   format: 'RGBA',         type: 'UNSIGNED_BYTE',  Array: Uint8Array,   comps: 4 },
    RGBA16F: { internal: 'RGBA16F', format: 'RGBA',        type: 'HALF_FLOAT',     Array: null,         comps: 4 },
    RGBA32F: { internal: 'RGBA32F', format: 'RGBA',        type: 'FLOAT',          Array: Float32Array, comps: 4 },
  };

  // A texture w × h in the named format, filled from `data` (a typed array of the right kind, or null for empty).
  function make(w, h, formatName, data) {
    const gl = Gl.get(), f = FORMATS[formatName];
    if (!f) throw new Error('Unknown texture format ' + formatName);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[f.internal], w, h, 0, gl[f.format], gl[f.type], data || null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t.w = w; t.h = h; t.format = formatName;
    return t;
  }

  // Replaces a texture's pixels (same size and format).
  function update(t, data, x = 0, y = 0, w = t.w, h = t.h) {
    const gl = Gl.get(), f = FORMATS[t.format];
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl[f.format], gl[f.type], data);
  }

  // A render target: a texture and a framebuffer drawing into it.
  function target(w, h, formatName = 'RGBA8') {
    const gl = Gl.get();
    const tex = make(w, h, formatName, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Render target ' + formatName + ' is not supported');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  // Binds a texture to a texture unit.
  function bind(unit, t) {
    const gl = Gl.get();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  }

  function free(t) { if (t) Gl.get().deleteTexture(t); }
  function freeTarget(r) { if (r) { Gl.get().deleteFramebuffer(r.fbo); free(r.tex); } }

  return { FORMATS, make, update, target, bind, free, freeTarget };
})();
