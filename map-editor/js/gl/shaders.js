// Compiles and caches shader programs, and sets their uniforms.
const GlShaders = (() => {
  const cache = new Map();
  let quadBuffer = null, quadVao = null;

  // The vertex shader for full-frame passes: one quad over the whole frame; the fragment's pixel is gl_FragCoord.xy.
  const FULLSCREEN_VS = `{{header}}
in vec2 a_corner;
void main() { gl_Position = vec4(a_corner * 2.0 - 1.0, 0.0, 1.0); }`;

  function compile(gl, type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const numbered = src.split('\n').map((l, i) => `${String(i + 1).padStart(3)}  ${l}`).join('\n');
      throw new Error(`Shader '${name}' failed:\n${gl.getShaderInfoLog(s)}\n${numbered}`);
    }
    return s;
  }

  // A program by name: { vs (default FULLSCREEN_VS), fs }. Attribute 0 is a_corner (a unit quad's corner), attribute
  // 1 and up are a pass's own per-instance data. {{chunks}} are filled in. Cached by name until clear().
  function program(name, { vs = FULLSCREEN_VS, fs }) {
    if (cache.has(name)) return cache.get(name);
    const gl = Gl.get();
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, GlChunks.expand(vs), name + ' (vertex)'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, GlChunks.expand(fs), name + ' (fragment)'));
    gl.bindAttribLocation(p, 0, 'a_corner');
    for (let k = 1; k <= 6; k++) gl.bindAttribLocation(p, k, 'a_i' + k);      // per-instance attributes: a_i1 ... a_i6
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program '${name}' failed to link: ${gl.getProgramInfoLog(p)}`);
    const locations = new Map();
    p.name = name;
    p.loc = u => { if (!locations.has(u)) locations.set(u, gl.getUniformLocation(p, u)); return locations.get(u); };
    cache.set(name, p);
    return p;
  }

  // Uses a program and sets uniforms from an object: a number is a float, ['i', n] an int, a boolean an int, an array
  // of 2 to 4 numbers a vec, ['v3', flatArray] a vec3 array. Uniforms the program doesn't have are skipped.
  function use(p, values = {}) {
    const gl = Gl.get();
    gl.useProgram(p);
    for (const k in values) {
      const loc = p.loc(k), v = values[k];
      if (loc === null) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (typeof v === 'boolean') gl.uniform1i(loc, v ? 1 : 0);
      else if (v[0] === 'i') gl.uniform1i(loc, v[1]);
      else if (v[0] === 'iv2') gl.uniform2i(loc, v[1], v[2]);
      else if (v[0] === 'v3') gl.uniform3fv(loc, v[1]);
      else if (v[0] === 'v4') gl.uniform4fv(loc, v[1]);
      else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
      else throw new Error(`Uniform ${k}: unsupported value`);
    }
    return p;
  }

  // The unit quad (a triangle strip) shared by every pass: attribute 0.
  function quad() {
    const gl = Gl.get();
    if (!quadBuffer) {
      quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
      quadVao = gl.createVertexArray();
      gl.bindVertexArray(quadVao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }
    return { buffer: quadBuffer, vao: quadVao };
  }

  // Draws the program over the whole frame.
  function drawFullscreen() {
    const gl = Gl.get();
    gl.bindVertexArray(quad().vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // A vertex array for instanced drawing: the unit quad on attribute 0 and a buffer of per-instance floats on
  // attributes 1.. (layout: [size of attribute 1, size of attribute 2, ...], tightly packed floats, divisor 1).
  function instanced(floats, layout, usage) {
    const gl = Gl.get();
    const quadBuf = quad().buffer;                       // first: making the quad binds its own vertex array
    const vao = gl.createVertexArray(), buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, floats, usage || gl.DYNAMIC_DRAW);
    const stride = layout.reduce((a, b) => a + b, 0) * 4;
    let offset = 0;
    layout.forEach((n, k) => {
      gl.enableVertexAttribArray(k + 1);
      gl.vertexAttribPointer(k + 1, n, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(k + 1, 1);
      offset += n * 4;
    });
    return { vao, buffer, count: floats.length / (stride / 4) };
  }

  // Forgets every program (a new context after a loss).
  function clear() { cache.clear(); quadBuffer = quadVao = null; }

  return { FULLSCREEN_VS, program, use, quad, drawFullscreen, instanced, clear };
})();
