// GlScreen: the game's screen layer on the GPU. `GlScreen.context` is a Canvas 2D compatible drawing context (fillRect,
// drawImage, transforms, save/restore, a rectangular clip) that only records what is drawn; endFrame() replays the
// record with WebGL2 into the page's display canvas, together with the map frame (drawMapFrame). The game's drawing
// code takes the context as `c2d` and runs unchanged.
//
// Pixel rules (the same as Canvas 2D with smoothing off, on an opaque canvas): source-over blending of straight CSS
// colours, a fillRect covers each pixel by its exact area (so a fractional edge is antialiased like Canvas), nearest
// drawImage reads the source pixel floor((p + 0.5 - dx) * srcW / dw), draws appear in the order of the calls.
const GlScreen = (() => {
  const RECT_WORDS = 7;                      // per rect instance: origin (2), two edge vectors (4), colour (1 packed word)
  const SEG_RECTS = 0, SEG_IMAGE = 1;
  const TIE = 1e-4;                          // an exact texel boundary takes the upper texel, as floor() of the exact position says
  const POOL_LIMIT = 512;                    // drawImage textures per frame
  let gl = null, display = null, dead = false, hooked = false;
  let rectProgram = null, imageProgram = null, rectVao = null, rectBuffer = null;
  let width = 0, height = 0;
  let f32 = new Float32Array(RECT_WORDS * 8192), u32 = new Uint32Array(f32.buffer), rectCount = 0;
  const segs = [];
  let segCount = 0, lastSegments = 0, cur = null;
  const pool = [];
  let poolUsed = 0;
  let clipSeq = 0;
  const path = { count: 0, x0: 0, y0: 0, x1: 0, y1: 0, aligned: true };
  const warned = new Set();
  const colorCache = new Map();
  let scratch = null;

  // ---------- Shaders ----------

  // A fillRect is one instance: a parallelogram (origin and two edge vectors, in device pixels) and a colour. The quad is
  // grown by a pixel so the fragment shader can antialias the edges.
  const RECT_VS = `{{header}}
uniform vec2 u_canvas;
in vec2 a_corner;
in vec4 a_i1;
in vec2 a_i2;
in vec4 a_i3;
flat out vec4 v_box;
flat out vec4 v_axes;
flat out vec4 v_color;
void main() {
  vec2 e = a_i1.zw, f = a_i2;
  float le = length(e), lf = length(f), det = e.x * f.y - e.y * f.x;
  if (le == 0.0 || lf == 0.0 || det == 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 ue = e / le, uf = f / lf;
  vec2 p = a_i1.xy - ue - uf + (e + 2.0 * ue) * a_corner.x + (f + 2.0 * uf) * a_corner.y;
  gl_Position = vec4(p.x / u_canvas.x * 2.0 - 1.0, 1.0 - p.y / u_canvas.y * 2.0, 0.0, 1.0);
  v_box = vec4(a_i1.xy, le, lf);
  v_axes = vec4(vec2(f.y, -f.x) * (le / det), vec2(-e.y, e.x) * (lf / det));
  v_color = a_i3;
}`;

  // How much of a pixel (its centre at s, one pixel wide) lies inside [0, len].
  const SPAN = `
float span(float s, float len) { return clamp(min(len, s + 0.5) - max(0.0, s - 0.5), 0.0, 1.0); }
`;

  const RECT_FS = `{{header}}
uniform vec2 u_canvas;
flat in vec4 v_box;
flat in vec4 v_axes;
flat in vec4 v_color;
out vec4 outColor;
${SPAN}
void main() {
  vec2 d = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y) - v_box.xy;
  float cover = span(dot(d, v_axes.xy), v_box.z) * span(dot(d, v_axes.zw), v_box.w);
  if (cover <= 0.0) discard;
  float a = v_color.a * cover;
  outColor = vec4(v_color.rgb * a, a);
}`;

  // A drawImage is one quad (no instancing): the same grown parallelogram.
  const IMAGE_VS = `{{header}}
uniform vec2 u_canvas;
uniform vec2 u_origin;
uniform vec2 u_edgeX;
uniform vec2 u_edgeY;
in vec2 a_corner;
void main() {
  vec2 ue = normalize(u_edgeX), uf = normalize(u_edgeY);
  vec2 p = u_origin - ue - uf + (u_edgeX + 2.0 * ue) * a_corner.x + (u_edgeY + 2.0 * uf) * a_corner.y;
  gl_Position = vec4(p.x / u_canvas.x * 2.0 - 1.0, 1.0 - p.y / u_canvas.y * 2.0, 0.0, 1.0);
}`;

  // The device pixel (centre) maps to a source position by two affine rows (u_mapU, u_mapV: x, y, constant); nearest takes
  // the texel it falls in, linear blends the four around it. Textures are premultiplied, so is the output (the blend is ONE,
  // ONE_MINUS_SRC_ALPHA, the same arithmetic as SRC_ALPHA on a straight colour).
  const IMAGE_FS = `{{header}}
uniform vec2 u_canvas;
uniform sampler2D u_tex;
uniform vec3 u_mapU;
uniform vec3 u_mapV;
uniform vec4 u_src;
uniform vec2 u_len;
uniform float u_alpha;
uniform int u_linear;
uniform int u_opaque;
out vec4 outColor;
${SPAN}
vec4 fetch(ivec2 t) {
  ivec2 lo = ivec2(u_src.xy), hi = ivec2(u_src.xy + u_src.zw) - 1;
  return texelFetch(u_tex, clamp(t, lo, hi), 0);
}
vec4 sampleLinear(vec2 uv) {
  vec2 q = uv - 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 k = q - vec2(i);
  return mix(mix(fetch(i), fetch(i + ivec2(1, 0)), k.x), mix(fetch(i + ivec2(0, 1)), fetch(i + ivec2(1, 1)), k.x), k.y);
}
void main() {
  vec3 p = vec3(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y, 1.0);
  vec2 uv = vec2(dot(p, u_mapU), dot(p, u_mapV));
  vec2 rel = (uv - u_src.xy) / u_src.zw * u_len;
  float cover = span(rel.x, u_len.x) * span(rel.y, u_len.y);
  if (cover <= 0.0) discard;
  vec4 c = u_linear == 1 ? sampleLinear(uv) : fetch(ivec2(floor(uv + ${TIE})));
  if (u_opaque == 1) { outColor = vec4(c.rgb * cover, cover); return; }
  if (c.a <= 0.0) discard;
  outColor = c * (u_alpha * cover);
}`;

  // ---------- The drawing state ----------

  // One level of the state that save() and restore() keep.
  function makeState() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, css: '#000000', rgb: 0, fa: 1, alpha: 1, smooth: true, add: 0, clipId: 0, cx0: 0, cy0: 0, cx1: 0, cy1: 0 };
  }
  const st = makeState();
  const stack = [];
  let depth = 0;

  // Copies every saved field.
  function copyState(to, from) {
    to.a = from.a; to.b = from.b; to.c = from.c; to.d = from.d; to.e = from.e; to.f = from.f;
    to.css = from.css; to.rgb = from.rgb; to.fa = from.fa; to.alpha = from.alpha; to.smooth = from.smooth; to.add = from.add;
    to.clipId = from.clipId; to.cx0 = from.cx0; to.cy0 = from.cy0; to.cx1 = from.cx1; to.cy1 = from.cy1;
  }

  // Pushes the state (transform, colour, alpha, smoothing, clip).
  function save() {
    if (depth === stack.length) stack.push(makeState());
    copyState(stack[depth++], st);
  }

  // Pops the state; an unmatched restore is ignored, as in Canvas.
  function restore() { if (depth > 0) copyState(st, stack[--depth]); }

  // The canvas drops a transform call with a non-finite number.
  function finite(a, b, c, d, e, f) {
    return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d) && Number.isFinite(e) && Number.isFinite(f);
  }

  // Moves the origin.
  function translate(x, y) {
    if (!finite(x, y, 0, 0, 0, 0)) return;
    st.e += st.a * x + st.c * y;
    st.f += st.b * x + st.d * y;
  }

  // Scales the axes.
  function scale(x, y) {
    if (!finite(x, y, 0, 0, 0, 0)) return;
    st.a *= x; st.b *= x; st.c *= y; st.d *= y;
  }

  // Turns the axes by r radians.
  function rotate(r) {
    if (!Number.isFinite(r)) return;
    const cos = Math.cos(r), sin = Math.sin(r), a = st.a, b = st.b;
    st.a = a * cos + st.c * sin; st.b = b * cos + st.d * sin;
    st.c = -a * sin + st.c * cos; st.d = -b * sin + st.d * cos;
  }

  // Multiplies the transform by a matrix on the right.
  function transform(a, b, c, d, e, f) {
    if (!finite(a, b, c, d, e, f)) return;
    const A = st.a, B = st.b, C = st.c, D = st.d;
    st.a = A * a + C * b; st.b = B * a + D * b;
    st.c = A * c + C * d; st.d = B * c + D * d;
    st.e += A * e + C * f; st.f += B * e + D * f;
  }

  // setTransform(a, b, c, d, e, f) or setTransform({ a, b, c, d, e, f }).
  function setTransform(a, b, c, d, e, f) {
    if (typeof a === 'object' && a) ({ a, b, c, d, e, f } = a);
    if (!finite(a, b, c, d, e, f)) return;
    st.a = a; st.b = b; st.c = c; st.d = d; st.e = e; st.f = f;
  }

  // Back to the identity transform.
  function resetTransform() { st.a = 1; st.b = 0; st.c = 0; st.d = 1; st.e = 0; st.f = 0; }

  // ---------- Colours ----------

  // A byte from a CSS number.
  function byte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

  // The canvas's own spelling of a colour: #rrggbb when opaque, else rgba(r, g, b, a).
  function spell(r, g, b, a) {
    if (a >= 1) return '#' + (0x1000000 | (r << 16) | (g << 8) | b).toString(16).slice(1);
    return `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`;
  }

  // A parsed colour: packed bytes, alpha 0 to 1, and the canvas's spelling of it.
  function colorOf(r, g, b, a) {
    r = byte(r); g = byte(g); b = byte(b); a = Math.max(0, Math.min(1, a));
    return { rgb: r | (g << 8) | (b << 16), a, css: spell(r, g, b, a) };
  }

  // The forms the game writes: #rgb, #rrggbb, #rrggbbaa, rgb(r, g, b) and rgba(r, g, b, a) (numbers, possibly fractional).
  function fastColor(s) {
    let m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = [...h].map(ch => ch + ch).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      const v = k => parseInt(h.slice(k, k + 2), 16);
      return colorOf(v(0), v(2), v(4), h.length === 8 ? v(6) / 255 : 1);
    }
    m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
    return m ? colorOf(+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]) : null;
  }

  // Any other CSS colour (names, hsl, percentages): let a 2D context normalise it.
  function slowColor(s) {
    if (!scratch) scratch = document.createElement('canvas').getContext('2d');
    scratch.fillStyle = '#000000';
    scratch.fillStyle = s;
    return fastColor(scratch.fillStyle) || colorOf(0, 0, 0, 1);
  }

  // The parsed colour for a CSS string (cached: the game repeats a few thousand strings).
  function parseColor(s) {
    let c = colorCache.get(s);
    if (c) return c;
    c = fastColor(s) || slowColor(s);
    if (colorCache.size > 4096) colorCache.clear();
    colorCache.set(s, c);
    return c;
  }

  // fillStyle: a CSS colour string.
  function setFillStyle(v) {
    if (typeof v !== 'string') throw new Error('GlScreen: fillStyle takes a CSS colour string only (no gradients or patterns)');
    const c = parseColor(v);
    st.rgb = c.rgb; st.fa = c.a; st.css = c.css;
  }

  // ---------- Recording ----------

  // A recorded draw: rects (a range of the instance buffer) or one image; objects are reused frame to frame.
  function makeSeg() {
    return { type: 0, start: 0, count: 0, clipId: 0, cx0: 0, cy0: 0, cx1: 0, cy1: 0, tex: null,
      ox: 0, oy: 0, ex: 0, ey: 0, fx: 0, fy: 0, lenX: 0, lenY: 0, mu0: 0, mu1: 0, mu2: 0, mv0: 0, mv1: 0, mv2: 0,
      sx: 0, sy: 0, sw: 0, sh: 0, alpha: 1, linear: 0, opaque: 0, add: 0 };
  }

  // The next segment, with the current clip and blend mode (add: 'lighter', the colours add up).
  function openSeg(type) {
    if (segCount === segs.length) segs.push(makeSeg());
    const s = segs[segCount++];
    s.type = type; s.add = st.add; s.clipId = st.clipId; s.cx0 = st.cx0; s.cy0 = st.cy0; s.cx1 = st.cx1; s.cy1 = st.cy1;
    return s;
  }

  // Doubles the instance arrays.
  function growRects() {
    const bigger = new Float32Array(f32.length * 2);
    bigger.set(f32);
    f32 = bigger;
    u32 = new Uint32Array(f32.buffer);
  }

  // Adds one rect instance (user-space x, y, w, h under the current transform) of a packed colour and alpha byte.
  function pushRect(x, y, w, h, rgb, alphaByte) {
    if (cur === null || cur.clipId !== st.clipId || cur.add !== st.add) { cur = openSeg(SEG_RECTS); cur.start = rectCount; cur.count = 0; }
    let i = rectCount * RECT_WORDS;
    if (i + RECT_WORDS > f32.length) growRects();
    const a = st.a, b = st.b, c = st.c, d = st.d;
    f32[i] = a * x + c * y + st.e; f32[i + 1] = b * x + d * y + st.f;
    f32[i + 2] = a * w; f32[i + 3] = b * w; f32[i + 4] = c * h; f32[i + 5] = d * h;
    u32[i + 6] = rgb | (alphaByte << 24);
    rectCount++;
    cur.count++;
  }

  // Records a filled rect (the current colour, alpha and transform); a negative size is normalised.
  function fillRect(x, y, w, h) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    const alphaByte = Math.round(st.fa * st.alpha * 255);
    if (!(w > 0 && h > 0) || alphaByte <= 0) return;
    pushRect(x, y, w, h, st.rgb, alphaByte);
  }

  // The display is opaque: clearing paints opaque black (what beginFrame clears to).
  function clearRect(x, y, w, h) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    if (w > 0 && h > 0) pushRect(x, y, w, h, 0, 255);
  }

  // ---------- Images ----------

  // A pooled texture for this frame's n-th image, filled from the source now (the game reuses one canvas for several draws).
  function upload(source, w, h) {
    if (poolUsed >= POOL_LIMIT) throw new Error('GlScreen: more than ' + POOL_LIMIT + ' drawImage calls in one frame');
    let e = pool[poolUsed++];
    if (!e) e = pool[poolUsed - 1] = { tex: gl.createTexture(), w: 0, h: 0 };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    if (e.w === w && e.h === h) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      e.w = w; e.h = h;
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return e.tex;
  }

  // Records an image: a destination parallelogram (origin, two edge vectors, device pixels) and the device-to-source map.
  function pushImage(tex, o, mapU, mapV, src, lens) {
    cur = null;
    const s = openSeg(SEG_IMAGE);
    s.tex = tex;
    s.ox = o[0]; s.oy = o[1]; s.ex = o[2]; s.ey = o[3]; s.fx = o[4]; s.fy = o[5];
    s.lenX = lens[0]; s.lenY = lens[1];
    s.mu0 = mapU[0]; s.mu1 = mapU[1]; s.mu2 = mapU[2]; s.mv0 = mapV[0]; s.mv1 = mapV[1]; s.mv2 = mapV[2];
    s.sx = src[0]; s.sy = src[1]; s.sw = src[2]; s.sh = src[3];
    return s;
  }

  // The size of a drawable source (canvas, ImageBitmap, image).
  function sourceSize(src) {
    if (src === display) throw new Error('GlScreen: drawImage of the display canvas itself is not supported');
    return [src.naturalWidth || src.width || 0, src.naturalHeight || src.height || 0];
  }

  // drawImage(src, dx, dy), (src, dx, dy, dw, dh) or (src, sx, sy, sw, sh, dx, dy, dw, dh).
  function drawImage(source, a, b, c, d, e, f, g, h) {
    if (dead) return;
    const [w, ht] = sourceSize(source);
    let sx = 0, sy = 0, sw = w, sh = ht, dx = a, dy = b, dw = w, dh = ht;
    if (c !== undefined && d === undefined) throw new TypeError('GlScreen: drawImage takes 3, 5 or 9 arguments');
    if (e !== undefined) { if (h === undefined) throw new TypeError('GlScreen: drawImage takes 3, 5 or 9 arguments'); sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g; dh = h; }
    else if (c !== undefined) { dw = c; dh = d; }
    if (w === 0 || ht === 0) return;
    if (dw < 0 || dh < 0) throw new Error('GlScreen: drawImage with a negative destination size (a flip) is not supported');
    if (!(dw > 0 && dh > 0 && sw > 0 && sh > 0)) return;
    imageAt(upload(source, w, ht), sx, sy, sw, sh, dx, dy, dw, dh);
  }

  // Records the draw of a source rect into a destination rect under the current transform.
  function imageAt(tex, sx, sy, sw, sh, dx, dy, dw, dh) {
    const a = st.a, b = st.b, c = st.c, d = st.d, det = a * d - b * c;
    if (!(Math.abs(det) > 1e-12)) return;
    const ia = d / det, ib = -b / det, ic = -c / det, id = a / det, ie = (c * st.f - d * st.e) / det, jf = (b * st.e - a * st.f) / det;
    const kx = sw / dw, ky = sh / dh;
    const o = [a * dx + c * dy + st.e, b * dx + d * dy + st.f, a * dw, b * dw, c * dh, d * dh];
    const s = pushImage(tex, o, [ia * kx, ic * kx, sx + (ie - dx) * kx], [ib * ky, id * ky, sy + (jf - dy) * ky], [sx, sy, sw, sh],
      [Math.hypot(o[2], o[3]), Math.hypot(o[4], o[5])]);
    s.alpha = st.alpha;
    s.linear = st.smooth ? 1 : 0;
    s.opaque = 0;
  }

  // Draws the map frame (an RGBA8 texture, texel row y = map row y) scaled by the whole `zoom` with its corner at (left, top)
  // CSS pixels: map pixel (mx, my) covers [left + mx * zoom, + zoom) in CSS pixels, times dpr in device pixels. Nearest,
  // opaque; ignores the transform and globalAlpha, obeys the clip.
  function drawMapFrame(texture, mapW, mapH, left, top, zoom, dpr) {
    if (dead || !gl) return;
    const k = zoom * dpr, ox = left * dpr, oy = top * dpr;
    const s = pushImage(texture, [ox, oy, mapW * k, 0, 0, mapH * k], [1 / k, 0, -ox / k], [0, 1 / k, -oy / k], [0, 0, mapW, mapH], [mapW * k, mapH * k]);
    s.alpha = 1; s.linear = 0; s.opaque = 1; s.add = 0;
  }

  // ---------- Clip ----------

  // Starts a new (empty) path.
  function beginPath() { path.count = 0; }

  // Adds a rect to the path: its device box now (the path is transformed when it is built, as in Canvas).
  function rect(x, y, w, h) {
    if (path.count > 0) throw new Error('GlScreen: a path of several rects (a union clip) is not supported');
    if (!finite(x, y, w, h, 0, 0)) return;
    path.count = 1;
    path.aligned = (st.b === 0 && st.c === 0) || (st.a === 0 && st.d === 0);
    const p = [[x, y], [x + w, y + h]].map(([u, v]) => [st.a * u + st.c * v + st.e, st.b * u + st.d * v + st.f]);
    path.x0 = Math.min(p[0][0], p[1][0]); path.x1 = Math.max(p[0][0], p[1][0]);
    path.y0 = Math.min(p[0][1], p[1][1]); path.y1 = Math.max(p[0][1], p[1][1]);
  }

  // Intersects the clip with the path (an axis-aligned rect, snapped to whole device pixels). A rotated or skewed rect is
  // ignored with a warning; an empty path clips everything.
  function clip() {
    if (path.count === 1 && !path.aligned) { warnOnce('clip with a rotated or skewed transform is ignored'); return; }
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    if (path.count === 1) { x0 = Math.round(path.x0); y0 = Math.round(path.y0); x1 = Math.round(path.x1); y1 = Math.round(path.y1); }
    if (st.clipId) { x0 = Math.max(x0, st.cx0); y0 = Math.max(y0, st.cy0); x1 = Math.min(x1, st.cx1); y1 = Math.min(y1, st.cy1); }
    st.clipId = ++clipSeq;
    st.cx0 = x0; st.cy0 = y0; st.cx1 = x1; st.cy1 = y1;
  }

  // A console warning, once per message.
  function warnOnce(msg) {
    if (warned.has(msg)) return;
    warned.add(msg);
    console.warn('GlScreen: ' + msg);
  }

  // ---------- Unsupported API ----------

  const METHODS = ['arc', 'arcTo', 'bezierCurveTo', 'closePath', 'createConicGradient', 'createLinearGradient', 'createPattern',
    'createRadialGradient', 'drawFocusIfNeeded', 'ellipse', 'fill', 'fillText', 'getContextAttributes', 'getLineDash', 'isContextLost',
    'isPointInPath', 'isPointInStroke', 'lineTo', 'measureText', 'moveTo', 'quadraticCurveTo', 'reset', 'roundRect', 'setLineDash',
    'stroke', 'strokeRect', 'strokeText'];
  const OFFSCREEN_ONLY = ['createImageData', 'getImageData', 'putImageData'];
  const PROPERTIES = ['strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'shadowBlur', 'shadowColor',
    'shadowOffsetX', 'shadowOffsetY', 'font', 'textAlign', 'textBaseline', 'direction', 'filter', 'fontKerning', 'fontStretch',
    'fontVariantCaps', 'letterSpacing', 'textRendering', 'wordSpacing', 'imageSmoothingQuality'];

  // The error for an API the context does not have.
  function unsupported(what) { return new Error(`GlScreen: ${what} is not supported (Canvas 2D subset: fillRect, clearRect, drawImage, save, restore, transforms, rect clip)`); }

  // ---------- The context object ----------

  const context = {
    save, restore, translate, scale, rotate, transform, setTransform, resetTransform, fillRect, clearRect, drawImage, beginPath, rect, clip,
    getTransform: () => ({ a: st.a, b: st.b, c: st.c, d: st.d, e: st.e, f: st.f }),
  };
  Object.defineProperties(context, {
    canvas: { get: () => display, enumerable: true },
    fillStyle: { get: () => st.css, set: setFillStyle, enumerable: true },
    globalAlpha: { get: () => st.alpha, set: v => { if (v >= 0 && v <= 1) st.alpha = +v; }, enumerable: true },
    imageSmoothingEnabled: { get: () => st.smooth, set: v => { st.smooth = !!v; }, enumerable: true },
    globalCompositeOperation: {
      get: () => (st.add ? 'lighter' : 'source-over'),
      set: v => { if (v === 'source-over') st.add = 0; else if (v === 'lighter') st.add = 1; else throw unsupported('globalCompositeOperation ' + v); },
      enumerable: true,
    },
  });
  for (const name of METHODS) context[name] = () => { throw unsupported(name + '()'); };
  for (const name of OFFSCREEN_ONLY) context[name] = () => { throw unsupported(name + '() on the display (use the game\'s own off-screen canvases)'); };
  for (const name of PROPERTIES) Object.defineProperty(context, name, { get: () => undefined, set: () => { throw unsupported('the property ' + name); }, enumerable: true });

  // ---------- GL ----------

  // Compiles the programs and makes the rect instance buffer's vertex array.
  function build() {
    rectProgram = GlShaders.program('screen rects', { vs: RECT_VS, fs: RECT_FS });
    imageProgram = GlShaders.program('screen image', { vs: IMAGE_VS, fs: IMAGE_FS });
    const quad = GlShaders.quad().buffer;
    rectVao = gl.createVertexArray();
    rectBuffer = gl.createBuffer();
    gl.bindVertexArray(rectVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let k = 1; k <= 3; k++) { gl.enableVertexAttribArray(k); gl.vertexAttribDivisor(k, 1); }
    gl.bindVertexArray(null);
  }

  // Makes GL render into the page's display canvas (never resized by GL). False when WebGL2 is unavailable.
  function attach(canvas) {
    try {
      if (!Gl.supported()) return false;
      Gl.useCanvas(canvas);
      gl = Gl.init(canvas.width, canvas.height);
      if (Gl.canvas() !== canvas) { gl = null; return false; }
      build();
    } catch (e) {
      console.warn('GlScreen: attach failed:', e);
      gl = null;
      return false;
    }
    display = canvas;
    dead = false;
    if (!hooked) { hooked = true; Gl.onLost(() => { dead = true; }); }
    return true;
  }

  // Starts a frame: opaque black, a fresh state (identity transform, alpha 1, no clip), nothing recorded.
  function beginFrame() {
    segCount = 0; rectCount = 0; poolUsed = 0; cur = null; depth = 0; path.count = 0;
    copyState(st, makeState());
    if (!gl || dead) return;
    if (Gl.isLost()) { dead = true; return; }
    width = gl.drawingBufferWidth; height = gl.drawingBufferHeight;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // Sets the scissor box of a segment's clip; returns whether the scissor test is on.
  function applyClip(s, on) {
    if (!s.clipId) { if (on) gl.disable(gl.SCISSOR_TEST); return false; }
    if (!on) gl.enable(gl.SCISSOR_TEST);
    gl.scissor(s.cx0, height - s.cy1, Math.max(0, s.cx1 - s.cx0), Math.max(0, s.cy1 - s.cy0));
    return true;
  }

  // Draws a range of rect instances.
  function drawRects(s) {
    const stride = RECT_WORDS * 4, at = s.start * stride;
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, at);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, at + 16);
    gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, stride, at + 24);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, s.count);
  }

  // Draws one image quad.
  function drawImageSeg(s) {
    GlShaders.use(imageProgram, {
      u_canvas: [width, height], u_origin: [s.ox, s.oy], u_edgeX: [s.ex, s.ey], u_edgeY: [s.fx, s.fy], u_tex: ['i', 0],
      u_mapU: [s.mu0, s.mu1, s.mu2], u_mapV: [s.mv0, s.mv1, s.mv2], u_src: [s.sx, s.sy, s.sw, s.sh], u_len: [s.lenX, s.lenY],
      u_alpha: s.alpha, u_linear: ['i', s.linear], u_opaque: ['i', s.opaque],
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.bindVertexArray(GlShaders.quad().vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Replays the record in order.
  function replay() {
    let scissor = false, adding = 0;
    for (let i = 0; i < segCount; i++) {
      const s = segs[i];
      scissor = applyClip(s, scissor);
      if (s.add !== adding) {                                   // 'lighter': the source's colour is added to what is there
        adding = s.add;
        const dst = adding ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA;
        gl.blendFuncSeparate(gl.ONE, dst, gl.ONE, dst);
      }
      if (s.type === SEG_RECTS) {
        GlShaders.use(rectProgram, { u_canvas: [width, height] });
        gl.bindVertexArray(rectVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
        drawRects(s);
      } else drawImageSeg(s);
    }
    if (scissor) gl.disable(gl.SCISSOR_TEST);
    if (adding) gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  // Draws everything recorded since beginFrame into the display canvas.
  function endFrame() {
    lastSegments = segCount;
    cur = null;
    if (!gl || dead || segCount === 0) return;
    if (Gl.isLost()) { dead = true; return; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.DITHER);
    gl.colorMask(true, true, true, true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, f32.subarray(0, rectCount * RECT_WORDS), gl.DYNAMIC_DRAW);
    replay();
    gl.disable(gl.BLEND);
    gl.enable(gl.DITHER);
    gl.bindVertexArray(null);
  }

  // What the last frame recorded (for tests).
  function stats() { return { rects: rectCount, segments: lastSegments, images: poolUsed, poolTextures: pool.length }; }

  return {
    attach, beginFrame, endFrame, drawMapFrame, stats, context,
    isDead: () => dead || !gl,
  };
})();
