# GL renderer: plan

Move the map editor's per-frame drawing from the CPU (`Uint8ClampedArray` + `putImageData`) to WebGL2, one pass at a time, with the existing Canvas code kept as the reference until every pass matches it.

This doc is the spec for that work. Build one phase at a time, in order, and check every item in a phase's checklist before starting the next. `plan.md` still governs everything this doc doesn't change. The code goes in `map-editor/js/gl/`.

**Status:** Phases G0 to G7 are built and checked. The editor draws with WebGL by default (the CPU/WebGL button in the scene dock, `?gl=0` for the CPU, and an automatic fall back to the CPU when WebGL2 is missing or the context is lost). Maps can be up to 1000×1000. See section 10 for the results and the known limits. The prototypes that justified it (`godot-grass-proto/`, `godot-light-proto/`, `webgl-proto/`) have been deleted; their results are in section 1.
---

## 1. Why, and what was measured

Prototypes ported the grass lab and the lighting (tint, warm lights, wall line-of-sight) to shaders and compared them with the editor's own JS, pixel by pixel, in Chrome on one Mac (M5 Pro):

| | Today (CPU JS) | WebGL2 | Match with today's output |
|---|---|---|---|
| Grass, 1000×1000, one frame | about 31 ms (about 25 fps) | about 0.4 ms GPU, 0.02 ms of JS | 999,990 of 1,000,000 pixels |
| Lighting, 50 lights | 4.2 ms | about 1 ms (includes timing overhead) | 99.97–99.999% |
| Lighting, 300 lights | 14 ms | about 1.2 ms | 99.97% |
| Lighting, 1000 lights | 40 ms | about 1.5 ms | n/a (stress test) |

The speedup comes from running per-pixel work on the GPU, not from the language. Godot reached the same speed, so moving engines isn't needed for rendering. Water was also matched in Godot (99.15–99.96%) but not yet in WebGL.

**Targets** (1000×1000 map, 30 fps, 300 lights): under 2 ms of GPU time and under 1 ms of JS time per frame; a 300×300 rebuild no slower than today.

---

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Approach | Replace the per-frame passes one at a time. A map is always drawable: passes not yet ported stay on the CPU path. |
| Order of the passes | **From the end of the frame backwards.** A CPU pass that blends (smoke, weather, the tint, lights) reads the pixels beneath it, so a pass can only move to the GPU once everything after it already has. Until a pass is ported, the CPU draws everything before it into the frame that gets uploaded. That is why lights come first and water last. |
| Old code | Keep the Canvas renderer as `backend = 'canvas'`. It is the reference for parity tests and the fallback when WebGL2 is missing or the context is lost. Delete it only in phase G7. |
| What stays on the CPU | Everything that turns a map into a `world` (`Resolve`, `Rivers`, distance fields, `Details.place`, `Life.place`), and `Ground.bake` until G6. V8 is fast at this and it runs only on a rebuild. |
| What moves to the GPU | Everything in `Renderer.drawFrame` (sections 6.2 of the main plan): water, tint, lights, glow, sprites, smoke, weather, life, height. |
| Switching | A `backend` choice (`canvas` default, then `gl`), remembered per browser, also `?gl=1` or `?gl=0` in the URL. |
| Hand-off between CPU and GPU | `GpuWorld` uploads `world` layers as textures once per rebuild, and each pass reads them. No pass reads `world` arrays directly each frame. |
| Parity | Every pass ships with a parity test (section 5). Matching the Canvas output is the acceptance test, not looks. |
| Determinism | Integer hash in GLSL (`uint`), the same as `Random.hash`. Float differences are allowed only at thresholds (section 5). |

---

## 3. Technical rules

1. All rules in section 3 of `plan.md` still apply: `file://` works, plain `<script>` tags in a fixed order, one `const` module object per file, no dependencies, `localStorage` in `try/catch`.
2. **WebGL2 only.** No WebGL1 path. If `getContext('webgl2')` fails, or `EXT_color_buffer_float` is missing, the backend stays `canvas` and the settings panel says why.
3. **No file loading.** Textures come from typed arrays and baked canvases, never from image files or `fetch` (neither works on `file://` without tainting).
4. **Shaders are template strings in `.js` files**, one per pass, with shared GLSL (hash, noise, palette lookup, wall ray) in `gl/chunks.js` and pulled in with `{{name}}`. No `.glsl` files.
5. **One pixel of the map is one pixel of the frame buffer.** The frame is rendered at map resolution and scaled to the screen with nearest filtering, exactly as `drawImage` does today.
6. Pixel-art rounding is part of the spec: round a tinted value to a whole 0–255 step where the CPU code does (the lights divide the tint back out and amplify rounding), and `floor(v + 0.5)` for `Math.round`.
7. **Context loss** (`webglcontextlost`) switches to `canvas` for the session and rebuilds on restore.
8. A pass must not read pixels back during a frame (`readPixels` stalls the GPU). Readback is only for export, thumbnails and parity tests.

---

## 4. Architecture

```
js/gl/
  chunks.js     shared GLSL: hash, noise, palette lookup, wall ray cast
  context.js    Gl: create the context, check extensions, resize, loss and restore
  shaders.js    Shaders: compile and cache programs, fill in {{chunks}}, uniform setters
  textures.js   Tex: upload layers (R8, RGBA8, R32F), render targets (RGBA8, RGBA16F)
  world.js      GpuWorld: upload a Resolve world as textures; knows which layer changed
  frame.js      GlFrame: ordered pass list, ping-pong targets, render(time), readPixels()
  atlas.js      Atlas: bake CPU sprites into one texture, instance buffers (G3)
  passes/
    tint.js lights.js glow.js water.js sprites.js smoke.js weather.js life.js height.js
  parity.js     GlParity: run a pass on the GPU and the CPU and diff them
```

**A pass** is an object with `init(gl)`, `upload(gpuWorld, world, map)` (once per rebuild), and `draw(frame, state)` (every frame). `state` holds `time`, `tint`, `dark`, and the map settings. A pass reads the current frame texture, writes the next one, and returns it, so passes can be reordered or skipped. The order in `GlFrame` is the order in `Renderer.drawFrame`.

**Frame flow** (mirrors section 6.2 of the main plan):

1. Static layer texture (`Ground.bake` output, uploaded once per rebuild).
2. Water, then bridges. *(G4)*
3. Details and animals, back to front (sprites), or `Height.compose` on raised maps. *(G3, G5)*
4. Smoke, then life, then weather. *(G2)*
5. Tint. *(G1)*
6. Lights, then glow (flames, windows, fireflies). *(G1)*
7. Present: scale the map to the display canvas at the current zoom and pan.

During the migration the CPU still draws the early steps into the frame that is uploaded, and the GPU does the later ones.

**Integration with the existing code** (the only edits outside `gl/`):

| File | Change |
|---|---|
| `renderer.js` | `drawFrame` calls `GlFrame.render` when `backend === 'gl'`, else the existing code. `rebuildNow` also calls `GpuWorld.upload`. `getMapCanvas` returns the GL canvas, so `Files.exportPng` keeps working. |
| `index.html` | `gl/*.js` script tags, after the render modules, before `renderer.js`. |
| `ui/settings.js` | The backend choice and a short status ("WebGL2 on", or the reason it is off). |
| `characters.js` | `drawFront` reads the CPU frame to redraw things in front of a character. Until G3, the GL backend reads one small region back per character. See section 7. |

---

## 5. Parity tests

`GlParity.run(passName, mapOrScene)` renders one pass on the GPU and the same pass on the CPU with the same input, then reports `{ pixels, mismatched, matchPercent }`, counting a pixel as matching when every channel is within 2 levels.

- Run on a fixed time and seed, with a map that has the layer in question (water for G2, fires for G1, and so on).
- **Pass thresholds:** 99.9% for a 1000×1000 map with ordinary content, 99.99% for the whole-frame static passes. Anything lower needs a written reason in the phase notes.
- **Accepted differences:** pixels on a threshold (band edges, rounding half-steps) where float32 and the CPU's float64 round differently; the editor's own dither is part of the picture and must match.
- The reference scenes and the Node harnesses from the prototypes (`godot-light-proto/tools/light_js.js`, `godot-grass-proto/tools/grass_js.js`; the prototype folders were deleted on 2026-11-21) were reused. Their timings are **not** valid: code inside a Node `vm` is about 50× slower than in a browser. Time passes in a real browser only.
- Keep the benchmark method from the prototypes: draw N copies of a pass and read one pixel back, so the cost shows above the display's frame limit.

---

## 6. Phases

### Phase G0: Skeleton

**Goal:** a GL backend that draws the static layer, can be switched on and off, and falls back safely.

- `Gl`, `Shaders`, `Tex`, `GpuWorld`, `GlFrame` with an empty pass list, and the `backend` switch.
- `Renderer.drawFrame` copies the CPU-drawn frame (everything the GL passes don't cover yet) into a texture each frame and presents it through GL. This is the hybrid mode that lets every later phase land one pass at a time.
- Export PNG and thumbnails work with the GL backend.
- A debug HUD: GPU frame time estimate and JS time per frame.

- [x] Backend switch (the CPU/WebGL button in the scene dock), remembered in `localStorage`; `?gl=1` or `?gl=0` for development.
- [x] A map renders identically on both backends (the `PRESENTED` parity row is 100%).
- [x] No WebGL2, no float render targets, or a lost context: the editor keeps running on `canvas` and says so (context loss tested with `WEBGL_lose_context`).
- [x] Zoom, pan and the overlay look the same (the GL canvas is copied onto the display canvas like the map canvas was).
- [x] Export PNG uses `Renderer.getMapCanvas()`, which is the GL canvas on the GL backend.

**Done when:** the backend can be toggled at runtime on any saved map, the picture is unchanged, and unplugging WebGL2 (`WEBGL_lose_context`) drops back to `canvas` without a reload.

### Phase G1: Tint and lights

**Goal:** the part that scales worst with light count. Ports `Daylight.apply`, `Fire.addLights`, `Fire.applyLights` (and the line-of-sight in `Fire.visibility`), `Characters.addLights`, `Details.addBeams`.

- Lights are instanced quads into a 16-bit buffer; the wall ray runs in the fragment shader (as in `godot-light-proto/light.gdshader`). The wall mask comes from `world.ground`.
- The final pass applies the tint and the four-step banded light with the checkerboard dither, with the CPU's rounding.
- Lights keep their per-kind radius and flicker table; the table lives once, in `chunks.js`, and `fire.js` reads the same values.
- Lights carry `lift` (raised ground shifts them up) from the start.
- Light colours: all fire lights are the warm colour today. A second buffer for a weighted colour is only added when a light kind needs it.
- `Fire.drawGlow` (flames, lit windows) and `Life.drawGlow` (fireflies) become a small instanced point pass.

- [x] `Daylight` tint matches at every hour of the day and underground.
- [x] Parity on the Underdark Warren, Grand Arena at night, and a 1000×1000 dungeon with 300 lights: at least 99.9%.
- [x] Moving or adding a light needs no CPU line-of-sight work.
- [x] Orbs (characters with light) and lighthouse beams light the scene.
- [x] 1000 lights at 1000×1000: under 2 ms GPU, under 1 ms JS.

**Done when:** the dungeon at night looks the same on both backends, and adding 1000 torches doesn't drop the frame rate.

### Phase G2: Smoke, weather and life

**Goal:** `Fire.draw` (smoke), `Weather.draw` (cloud shadows, rain, snow), `Life.draw` (fish, butterflies, birds), as GPU particles with the same seeds, phases and timing. They blend over the frame and sit just before the tint, so they are next in line.

- [x] Parity at least 99.9% for each, at a fixed time (rain and snow are particles seeded per frame, so positions must match exactly, not just the count).
- [x] Rain splashes, fish and butterflies use the same lift handling as before.

**Done when:** a rainy forest, a smoking village and a river with fish match on both backends.

### Phase G3: Sprites

**Goal:** details and animals drawn as instanced sprites, with wind sway, in painter's order.

- `Atlas` bakes each CPU sprite (`Sprites`, `Props`, `Houses`, `Landmarks`, `Structures`, characters' art) into one texture, once per rebuild, keyed like the existing sprite cache. Procedural sprites are not rewritten; their `put` output is captured.
- A sprite has a sway rule (by row, as in `Sprites.drawSprite`) applied in the vertex or fragment shader.
- Draw order: back to front by `y`, flat things first, as `Details.draw` does. `shadowMask` darkening under trees is a texture lookup.
- Tufts and flowers (thousands of identical 3-blade tufts) use the procedural shader from `webgl-proto`, not the atlas.
- Characters move into the GL frame, so `Characters.drawFront` no longer reads CPU pixels.

- [x] Parity at least 99.9% on a forest map and a village map at a fixed time.
- [x] Rebuild time with a 600×600 map is no worse than today.
- [x] Characters are occluded the same way by things in front of them.

**Done when:** a village and a forest match on both backends, and the sprite pass costs under 1 ms at 1000×1000.

### Phase G4: Water

**Goal:** `Water.draw` on the GPU. Depth bands with dithering, shimmer, foam, sea waves and wet sand, lake glints, river flow, the dark shade under docks. It is last because it is first in the frame: sprites, smoke and everything else draw over it.

- Textures: `water` kinds, `waterDist` and `seaDist` (float), `flowX` and `flowY` (river direction), the deck mask.
- Glints stay instanced points (`world.glints`, `world.riverGlints`), with the same phase and speed.
- Bridge shadows and `Bridges.draw` move here. The static layer is now the only CPU-drawn input.

- [x] Parity at least 99.9% on lakes, sea, a river, a harbor with piers, at two different times.
- [x] Water on raised ground (lowered rivers) is handled in G5; until then raised maps keep the CPU water.

**Done when:** the Harbor Town and a river map match, and the water pass costs under 0.5 ms at 1000×1000.

### Phase G5: Height

**Goal:** `Height.compose` on the GPU. This is the hardest phase: raised maps project every row up by its lift and fill the cliff faces below.

- Textures: `lift`, `srcY` (the unprojected row), `depth`, `fall`, the ledge and stair masks.
- Approach to try first: render the flat frame (water, bridges, flat things) into a texture, then a displacement pass that reads each destination pixel's source row from `srcY` and draws the face colour where `lift - lift(row below)` applies. Things and animals are drawn after the row below their base, as today.
- If a per-pixel remap can't reproduce the row-by-row overlap exactly, raised maps stay on the CPU path (flagged per map) and the GL backend is used only on flat maps. That decision is written here before G6 starts.

- [x] Parity at least 99.9% on the Canyon Hideout and a mountain map with a river gorge.
- [x] Clicks and previews still follow the raised ground (`Height.unproject` is unchanged).

### Phase G6: Ground on the GPU

**Goal:** `Ground.bake` per type, so a settings change or a paint stroke no longer rebuilds 1M pixels on the CPU.

- A ground shader reads `ground`, `scatter`, `terrace`, `level` and the distance fields, and draws grass patches, paths, cobble, flagstone, cave floor, walls, shadows, edge wobble and the height shading.
- Partial rebuild: after a stroke, only the dirty rectangle is re-uploaded and re-shaded.

- [x] Parity at least 99.99% against `Ground.bake` on all four maps in `samples/maps`.
- [x] A stroke redraws only its dirty tiles on the GPU (about 12–16 ms including the CPU diff). The whole rebuild after a stroke is still the CPU `Resolve` (about 0.4 s at 1000×1000), see section 10.

### Phase G7: Cleanup

- [x] Backend defaults to `gl` (checked on the four maps in `samples/maps`, four saves from the old world editor; three of them are kept in `tests/map-editor/maps`, and the audit map).
- [x] The Canvas path stays, as `?gl=0` and as the fall back when WebGL2 is missing (it is also the reference for the parity tests), so it is not deleted.
- [ ] A performance panel (GPU estimate, JS time, lights, sprites) in the settings. Not built.
- [x] `plan.md` sections 6.2 and 3.1 point to this doc and mention parity testing.

---

## 7. Risks and open questions

| Risk | What to do |
|---|---|
| `Characters.drawFront` reads the CPU frame to redraw things in front of a character | G3 draws characters in GL with the `depth` texture. Until then, read back a small region per character. |
| `Height.compose` may not map to a pure per-pixel shader | Decide in G5; the fallback is the CPU path for raised maps only. |
| Safari and some phones lack `EXT_color_buffer_float` | Fall back to an RGBA8 light buffer with a dither tolerance, or stay on `canvas`. Decide in G1. |
| Float differences on other GPUs flip threshold pixels | Parity thresholds already allow it. Re-run parity on a second GPU before G7. |
| The in-app browser throttles `requestAnimationFrame` and may render with a software GL | Check timings in a normal desktop Chrome too, and note in the phase which browser they came from. |
| A 16-bit light buffer shows 0.03% mismatches on 300 overlapping lights | Accepted. An RGBA32F buffer removes it if it matters. |
| Thumbnails (`Preview.render`) draw small pictures with the Canvas code | Leave them on the CPU. They are not per-frame. |

## 8. Out of scope

- A Godot player or a rewrite in another engine (the prototypes showed the rendering speed is available in WebGL).
- Changing what the map looks like. Parity with today's output is the goal, not improvement.
- WebGL1, WebGPU, and Web Workers.
- Moving `Resolve` or `Details.place` to the GPU.

### Testing notes

- Serve the folder as in `plan.md` 3.1 and open `http://localhost:8765/map-editor/index.html?gl=1`. Test the editor page itself on another origin (for example `python3 -m http.server 8791 --bind 127.0.0.1`, then `http://127.0.0.1:8791/...`), so its `localStorage` is empty and the real autosave is never touched. `gltest.html` uses no storage and is safe anywhere.
- A headless Chrome runner was tried and dropped: Run `dev/map-editor/gltest.html` in a normal browser instead.
- The prototypes (`webgl-proto/`, `godot-*-proto/`) were deleted on 2026-11-21 once G0 to G7 were built; the numbers they gave are in section 1.
- **Never test against the real autosave.** Opening the editor on a fresh origin (another port) has its own `localStorage`; back up `pixel-map-editor:autosave` before testing on the usual one.

---

## 9. Pass author guide

Everything below is built and working (G0). A pass for one stage lives in one file, `map-editor/js/gl/passes/<name>.js`; the script tags for every planned file are already in `index.html` and `dev/map-editor/gltest.html`.

### 9.1 The stages and the picture

`Stages.LIST` (`js/render/stages.js`) is the frame, in order: `static`, `water`, `bridges`, `sim` (CPU only: animals and tracks move), `tracks`, `things` (raised maps: `Height.compose`; flat maps: `Details.draw` then `Animals.draw`), `smoke`, `life`, `weather`, `tint`, `lights`, `glow`. Each has its CPU code in `cpu(ctx)`. With `backend === 'gl'`, a stage runs as the GL pass registered for it when there is one, and as the CPU code when not. When the picture has to cross from one side to the other, `Stages.run` uploads or reads it back by itself (slow, and only until the neighbours are ported). So a pass can be written in any order and the editor stays correct.

The picture is an RGBA8 texture, `w × h` (the map's size). **Row y of the texture is map row y**, so a full-frame fragment's pixel is `ivec2 p = ivec2(gl_FragCoord.xy)` (x right, y down), and reading the frame back needs no flip. RGBA8 storage rounds to nearest like `Uint8ClampedArray`, so a pass that does the same maths as the CPU gets the same bytes.

### 9.2 A pass

```js
GlFrame.register({
  stage: 'water',                 // one of Stages.NAMES
  applies(ctx) { return true; },  // optional: false hands this frame's stage to the CPU (e.g. flat maps only)
  init(c)   { /* once per GL context: compile programs (GlShaders.program), make buffers */ },
  upload(c) { /* once per rebuild (the world changed): GpuWorld.tex(...), instance buffers */ },
  draw(c)   { /* every frame; the picture so far is in the current target, already bound, blending off */ },
});
```

`c` is `{ gl, w, h, world, map, s (settings), palette, time, tint, dark, seed, common(), rewrite(fn), bind(unit, tex), texture(name), frameTexture() }`. `c.common()` gives `{ u_size, u_seed, u_time }`, the uniforms most shaders want.

- **Drawing over the picture** (sprites, particles, a water layer that overwrites pixels): just draw, with `gl.enable(gl.BLEND)` and `gl.blendFunc(...)` if needed, and switch blending off again. A fragment that should leave the pixel alone calls `discard`.
- **Reading the picture** (lights, anything that changes a pixel from its old colour): `c.rewrite(src => { c.bind(0, src); ...draw the whole frame... })`. `src` is the old picture, the target is a fresh texture, and the result becomes the picture.
- **Shaders:** `GlShaders.program('unique name', { vs, fs })`. The default vertex shader is a full-frame quad (attribute 0 `a_corner`). Write `{{header}}` first in a shader; `{{frame}}` (u_size, `pxToClip`), `{{noise}}` (`hash`, `valueNoise`, `noise`, `noise1D` exactly as in `core/random.js`, with `u_seed`) and `{{round}}` (`roundJs`, the JS `Math.round`) are shared. Add your own with `GlChunks.add(name, glsl)`. `GlShaders.use(program, { u_time: 1.5, u_seed: ['i', 7], u_tint: [r, g, b] })` binds the program and sets uniforms (numbers are floats, `['i', n]` ints, arrays of 2 to 4 vecs).
- **Instancing:** `GlShaders.instanced(floats, layout)` makes a vertex array with the unit quad on attribute 0 and your per-instance floats on attributes 1 to 6; name them `a_i1` ... `a_i6` in the vertex shader. Draw with `gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)`. `pxToClip(pixelPosition)` maps map pixels to clip space.
- **Layers of the world:** `c.texture('waterDist')` uploads on first use. Declare new ones with `GpuWorld.define('flowX', { format: 'R32F', from: world => world.flowX })` when your file loads. Integer ids are `R8UI` (read with `usampler2D` and `texelFetch(...).r`), distances `R32F`, and so on (`GlTex.FORMATS`). All sampling is `texelFetch` (nearest).
- **Pixel-art rules:** round where the CPU rounds (`Math.round` is `floor(v + 0.5)`), keep integer pixel positions, and use `hash` for anything random, never `Math.random`. Where the CPU draws a pixel with a `blend(frame, i, colour, a)` (move toward the colour by a) use alpha blending with `a`.
- **Sim state** (animals, tracks, fish, lights' flicker) stays on the CPU: the CPU code computes positions, and the pass uploads them as instance data each frame.

### 9.3 Testing a pass

Run `http://localhost:8765/dev/map-editor/gltest.html` in the browser pane (serve with `python3 serve.py`, which never caches), then read `window.__glResult` once `done` is true. Options in the URL: `?stages=water,tint`, `?maps=/samples/maps/grand-arena.json,/samples/maps/big/harbor-town-20261108-214729.json`, `?times=3.7,12`, `?hours=2,12,23` (time of day, forces a surface map), `?set={"weather":"rain"}` (any map settings), `?full=0`. Each row is a stage on a map at a time: the GL pass is given the CPU picture from just before that stage and compared with the CPU picture from just after. `FULL FRAME` runs the whole frame on the GL backend (ported passes on the GPU, the rest on the CPU) against all-CPU, and `PRESENTED` compares what the editor shows. A row matches when every channel is within 2 levels. The target is 99.9% (section 5). `GlParity.suite(options)` does the same from the console; `GlParity.build(path)` then `GlParity.stages(built, time, ['water'], overrides)` runs one stage.

Rules for testing: use your own browser tab (`tabs_create`) and always pass its `tabId`; use `dev/map-editor/gltest.html` freely (it touches no storage) but test `index.html` only on another origin such as `http://127.0.0.1:8791`, never on `localhost:8765`, because the editor autosaves to `localStorage` and a test map once replaced the real one. Browsers cache scripts: use `localhost:8765` (no-cache) for `gltest.html`.

---

## 10. Results (the build)

**Audit** (`dev/map-editor/gltest.html?audit=1`, `dev/map-editor/audit.js`): one generated map with every terrain material (22 that paint ground, water or scatter), every object type (76), rivers, a bridge, a dock, and (raised variant) hills, a terrace, stairs, a lowered river and a chasm. A flat and a raised variant, in summer, autumn and winter, at hours 2, 6.5 and 12: 240 rows (every GL stage, the ground bake, the full frame and the presented canvas). Every row is at least 99.9% identical to the CPU (they came out 100%), with no errors. A new material or object type added to the editor is in the audit automatically.

**Real maps** (the four in `samples/maps`, Harbor Town, Snowy Pines and both dungeons, at hours 2, 12 and 23): every stage row at least 99.9%; the full frame at least 99.99% (at most about 130 pixels of 1,000,000, from float thresholds in the tufts and the lights).

**Speed, 1000×1000, Chrome on an M5 Pro, whole frame with the GPU forced to finish:**

| Map | CPU | WebGL | |
|---|---|---|---|
| Harbor Town (13,393 objects, 24 fires) | 81 ms | 3.6 ms | 23× |
| Dungeon (1,601 objects, 422 fires, walls) | 86 ms | 2.3 ms | 37× |

The ground bake: 66–298 ms on the CPU, 7 ms on the GPU. On the real editor page the JavaScript side of a frame costs about 1 ms.

**Known limits**
- **Rebuilds are still CPU.** `Resolve.run` takes about 0.4 s at 1000×1000 and a whole rebuild about 0.56 s, so a paint stroke on a huge map takes roughly half a second to a second to appear. The drawing is no longer the cost. A partial `Resolve` would fix it.
- **Rain and snow** drift from the CPU by up to a pixel once the editor's clock passes about an hour (float32 time on the GPU): 99.85% match at 20,000 s. Nothing visible changes.
- **Windmill sails** are drawn by the CPU into the atlas every frame, about 70 µs each; many windmills cost JavaScript time.
- **Characters** are still drawn by the 2D overlay on top of the picture, reading back only the small window around a character when something stands in front of it.
- **Thumbnails** in the library (`Preview.render`) still use the CPU renderer.
- A fish ripple can differ by a pixel in the rare case where its ring revisits a pixel after a gap.
- Tested in Chrome on one Mac. Other GPUs, Safari and Firefox are untested (WebGL2 with `EXT_color_buffer_float` is required, otherwise the CPU renderer is used automatically).

---

## 11. Incremental rebuild (after an edit)

A paint stroke used to solve the whole map again (about 0.4 to 0.7 s at 1000×1000). Now `Incremental.update` (`js/render/incremental.js`) finds the rectangle of painted pixels that changed since the last solve, and when the change is small and local `Resolve.runWindow` solves only that rectangle grown by 44 pixels on each side, plus 44 more for what it depends on, using the same code and the same global coordinates as `Resolve.run`, and copies the middle part into the existing world. Everything else is reused. `Details.place` and `Life.place` still run on the whole map (about 80 ms at 1000×1000), the GPU ground bake redraws only the tiles around the change, and a stroke that changes nothing in the terrain (objects only) skips the solve.

**A stroke takes the full solve instead when** it is the first solve, a new size or seed, a changed solving setting or river, painted height (elevation or terrace) or a painted chasm, a change larger than 35% of the map, a bridge, dock or chasm within about 120 pixels, a dock or bridge that would form there, or (on a map with height) water edited or a path within 4 pixels. The numbers behind the margins: water distances are read up to 40 pixels (`Resolve.DIST_CAP`), the ground distances `grassEdge` and `toWall` only below 3 (`GROUND_DIST_CAP` 4), and a beach can turn ground up to about 26 pixels from a change.

**Proof:** `node tests/map-editor/inctest.js` applies random edits of every kind to eleven maps and compares every layer of the whole map with a full solve after each partial update (distances up to the caps). 640 to 800 edits per run on seven seeds: 0 differences (about 230 partial updates per run, the rest correctly fell back). `node tests/map-editor/resolvehash.js --check <file>` shows `Resolve.run` is byte-identical to before the change on 11 maps. In the editor, `?verify=1` checks every partial solve against a full one and reports a difference in the console.

**Results at 1000×1000** (Harbor Town, 8 strokes of every material): a stroke rebuilds in about 190 ms against 590 ms for a full rebuild, and the picture after the strokes is pixel-identical to a fresh full rebuild (0 of 1,000,000 pixels differ). The windowed solve itself takes about 30 ms; most of what is left is `Details.place`.

**Not done:** `Details.place` is not incremental (its sorted lists make it hard to do exactly); raised maps fall back for water and path edits and for painted height; the GPU layer uploads after a partial solve still re-upload whole layers.

---

## 12. The game on the GL framework

The D&D game (`dnd-game/`, in the [pxl-dnd](https://github.com/bhuv3/pxl-dnd) fork) draws on the same GPU framework as the editor.

- **Map frame.** `dnd-game/js/stage.js` no longer carries its own copy of the editor's frame pipeline. It runs `Stages` with the game's stage list (static, water, floor, things, smoke, life, weather, tint, lights, glow), on GL passes when WebGL2 works and on the CPU otherwise (the CPU path is byte-identical to the old Stage: 492 frame hashes). The game's own pieces are GL passes too: `passes/floor.js` (the fading scorch, blast and acid marks) and the lights pass takes the game's lights hooks (figures' orbs, spell lights, all coloured) through `c.extraLights`. `Stage.lightAt` (how lit the floor under a character is) is evaluated on the CPU from the recorded light list, so the GPU is never read back during a frame. Raised maps draw on the CPU (the game has no height step).
- **Screen layer.** `js/gl/screen.js` (`GlScreen`) is a Canvas 2D compatible context that records `fillRect`, `drawImage`, transforms, `save` and `restore` and a rectangular clip, and draws them with WebGL2 into the page's display canvas, in call order. The existing drawing code (figures, particles, shapes, projectiles, blades, death animations, damage numbers, labels, the grid overlay, the dice tray) takes it as `c2d` and runs unchanged. With GL on, `Stage.init` makes the display canvas a GL canvas, so the map frame (a GPU texture) and everything on top are composed in one pass with no copy. Anything outside that subset (paths, strokes, dashes, text, `getImageData`) throws an error naming the call; the adventure editor, whose overlay draws strokes and dashes, passes `{ screen: '2d' }` to `Stage.init` and keeps a 2D display.
- **Switches.** `?gl=0` is the old CPU path with a 2D display; `?screen=2d` is the GL map frame copied onto a 2D display. A lost WebGL context is recovered when the browser restores it (everything GL made is made again), and the page keeps running meanwhile.
- **Checks.** `dev/dnd-game/gltest.html` (map frame, every stage and the whole frame against the CPU, 1,122 rows in the integrated mode, all at least 99.9%) and `dev/dnd-game/gltest-screen.html` (the screen layer against a real 2D canvas: synthetic API scenes 99.98 to 100%, 17 real spell effects 99.9997 to 100%, all five death styles 99.9995%, popups, labels, the dice tray and the grid 100%). Nearest-neighbour scaling at a non-whole zoom (1.5× or 2.5× figures at normal screen density) differs on exact texel ties: 99.7 to 99.8% on the fireball scene, and exact at whole zoom or on a high-density screen. All 72 spells, three AI fights, the adventure, the practice room and the adventure editor run with no errors.
- **Speed (Chrome, M-series Mac).** A 220 × 160 village: about 0.5 ms of JavaScript per step. A 1000 × 1000 map: 2.3 ms per step (7 ms with the GPU forced to finish) against 60 ms with the CPU map frame.
- **Not done.** Characters are still drawn by the screen layer from per-figure canvases (one texture upload per figure and ghost per frame); an atlas would remove that. Fish and bird pixels, smoke puffs and rain specks are not part of the CPU `lightAt` model (they touch a pixel rarely). Windows with water in them and maps with fog read the frame back for `lightAt`.
