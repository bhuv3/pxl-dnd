# Pixel Map Editor: plan

A paint-style editor where the user draws the plan of a map (grass here, a river there, a forest over there) and code renders it as detailed, animated pixel art.

The user paints what goes where. Code draws how it looks.

This doc is the only spec. Build one phase at a time, in order, and check every item in that phase's checklist before starting the next.

**Status:** Phases 0–6 and 8–27 are built and tested. From Phase 7, bridges (reworked in Phase 18), docks, and stepping stones are built; reflections are still open. Waterfalls came later with height (Phases 23–24). Fog of war is parked; its design is in `fog-of-war.md`. The code is in `map-editor/`.

---

## 1. Reference code

Three working labs (now in `dev/labs/`) already contain most of the rendering logic. Port from them; don't reinvent.

| File | What to take from it |
|---|---|
| `dev/labs/pixel-grass.html` | `hash`, `valueNoise`, `noise`, grass tuft drawing (blades, lean, shadow line, light tip), wind sway |
| `dev/labs/pixel-water.html` | `distanceField`, `noise1D`, depth bands, dithering, shimmer, foam, waves washing onto land, wet sand, glints, reeds, lily pads |
| `dev/labs/pixel-trees.html` | `makeRng`, `lightVector`, `pickShade`, `markEdges`, `makeCanopy`, `makeRoundTree`, `makeBush`, `makePine`, `makeRock`, ground shadows, seasons |

---

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Rendering while drawing | Don't do a full render on mouse move. Show a quick colored preview of the stroke, then do the full render on mouse up. The render may take a moment. |
| Rules | Apply all the automatic detail rules in section 7. More rules are welcome. |
| Rivers | The user draws a freeform line. The code smooths it, then wobbles it with noise so it meanders and its width varies. |
| Empty ground | Plain dirt. |
| Map size | Asked in a "New map" dialog. Default 300×300. |
| Code layout | Several files, small modules, clean code. |
| Comments | One brief line above each function or block saying what it does. No long explanations. |

---

## 3. Technical rules

1. **It must open by double-clicking `index.html`, with no server.** Browsers block ES modules (`type="module"`) and Web Workers on `file://`, so:
   - Use plain `<script src="...">` tags, loaded in a fixed order.
   - Each file defines one module object as a top-level `const`, which later scripts can use:
     ```js
     // Seeded random numbers and noise.
     const Random = (() => {
       function hash(x, y, seed) { ... }
       return { hash, ... };
     })();
     ```
   - No other globals.
2. **Rendering is deterministic.** The same map data and settings always give the same picture. Use `hash` or `makeRng(seed)` for randomness. Only use `Math.random()` to pick a new seed, such as when an object is placed.
3. **No dependencies.** Plain HTML, CSS and JavaScript.
4. **Naming:** `camelCase` for functions and variables, `UPPER_CASE` for constants, `PascalCase` for module objects.
5. Keep functions short. If a function needs a long comment, split it up.
6. Wrap every `localStorage` call in `try/catch`.
7. **Images:** a canvas can't read pixels from image files on `file://` (they taint it). Character art is packed into JS files as data URLs (`tools/map-editor/pack_character.py`), which are always readable.
8. **Ground-type checks:** test for "is this a path" with `Types.isPath(g)`, never `g === GROUND.PATH`. There are four path types (section 5), and all of them must behave the same for bridges, shore rules, and keeping plants and scatter off paths.

### 3.1 Testing notes

- **Incremental rebuild:** after any change in `js/render/resolve.js`, `rivers.js`, `bridges.js`, `height.js`, `core/grid.js` or `incremental.js`, run `node tests/map-editor/inctest.js` (partial solve equals full solve) and `node tests/map-editor/resolvehash.js --check <saved fingerprints>` (the full solve is unchanged). Details in `gl-renderer.md` section 11.
- **GL parity:** open `http://localhost:8765/dev/map-editor/gltest.html` (add `?audit=1` for the all-terrain, all-objects map). It compares every GL pass with the CPU code and writes the numbers into `window.__glResult`. Run it after any change in `js/gl/` or in the CPU drawing code (the two must stay identical). Details in `gl-renderer.md` section 9.3.

- Serve the folder for browser testing: `python3 serve.py` in the repo folder (no-cache), then open `http://localhost:8765/map-editor/index.html`. `file://` pages can't be screenshotted.
- The browser caches scripts. After editing JS, refetch every script with `fetch(src, { cache: 'reload' })`, then reload. Otherwise old files mix with new ones (for example, "Cannot read properties of undefined (reading 'layer')").
- Right after `location.reload()`, wait about 500 ms before touching the DOM or app objects.
- Screenshots lag one frame behind; call `Renderer.rebuildNow()` before checking a render.
- Drive tools from JS with `Tools.setTool`, `Tools.setMaterial`, `Tools.setOption('brushSize', n)`, then `Tools.down({x, y}, {button: 0})`, `Tools.move({x, y})`, `Tools.up()`.
- Zoom to a spot by setting `Viewport.state.zoom`, `panX` and `panY`, then calling `Renderer.requestPresent()`.
- A saved map keeps its own copy of the colors. New color keys fall back to `Colors.DEFAULTS`, but a changed default only shows on new maps (or after Reset colors).
- The in-app browser's screenshot can't crop or zoom. To inspect pixels, draw the map canvas (or a crop of it) scaled up with smoothing off, `toDataURL` it, and POST it to a tiny local receiver that saves PNGs in the scratchpad, then read the file.
- The in-app browser throttles `requestAnimationFrame` (about 1.5 fps, even when visible), so characters crawl there. To check movement, call `Actors.update(0.05, Renderer.getWorld(), Play.steer())` in a loop, then wait a few seconds before the screenshot.
- Testing overwrites the user's autosave (`pixel-map-editor:autosave`). Back it up to another key first and restore it afterwards. Even `Renderer.setMap(testMap)` from JS can end up autosaved (any later settings or tool change saves the current map), so restore at the end and compare `ground`, `objects`, and `rivers` with the backup.
- Module objects are top-level `const`s, so a script can't be hot-swapped with `eval`: refetch every script and reload.
- Test maps are quickest to build in JS: `MapModel.create(w, h, seed, GROUND.X)`, fill `ground` with rectangles or `Grid.maskFromPath`, push `rivers` and `objects`, then `Renderer.setMap(m)`. Keep the builder in `sessionStorage` and `eval` it after each reload.

---

## 4. File structure

`map-editor/` holds only what the editor loads when it runs. Everything else lives at the top of the project:

| Where | What |
|---|---|
| `docs/map-editor/` | This plan, `gl-renderer.md`, `fog-of-war.md` |
| `dev/map-editor/` | Developer pages: `gltest.html` (GL parity, with `parity.js` and `audit.js`), `objects.html` (object gallery), `house-sheet.html` |
| `dev/labs/` | The first labs (section 1) and `height-lab.html` |
| `tests/map-editor/` | Node tests: `inctest.js`, `resolvehash.js` (with `loadmodules.js`, `testmaps.js`) |
| `tools/map-editor/` | `pack_character.py` (packs `art/map-editor/<name>/` into `map-editor/assets/characters/<name>.js`), `build_arena.py`, `build_hideout.py`, `build_map.py` (from `samples/maps/specs/`) |
| `art/map-editor/elf-wizard/` | Source PNGs: 8 facing poses (32×32) |
| `samples/maps/` | Not in the repo (`.gitignore`): your own maps, which the tests and `dev/map-editor/gltest.html` also use. The maps made during development were `underdark-warren.json` (Phase 17), `canyon-hideout.json` (Phase 26), `desert-fortress.json` (Phase 27, from `specs/`), `grand-arena.json` (27 × 39 squares); `big/` holds three big maps the tests use |

```
map-editor/
  index.html              Layout and script tags in load order
  assets/characters/
    elf-wizard.js         Generated: CharacterArt.add(key, name, {direction: dataURL})
  css/
    style.css             All styles, with light and dark theme variables
  js/
    core/
      random.js           Random: hash, makeRng, valueNoise, noise, noise1D, cells (stone and tile shapes)
      grid.js             Grid: distanceField, floodFill, warpSample, maskFromPath
      colors.js           Colors: default palette, seasons, hexToRgb, darken
    model/
      constants.js        Types: ground, water, scatter, and object type IDs
      map.js              MapModel: create, clone, serialize, deserialize
      history.js          History: undo and redo snapshots
      generate.js         Generate: random landscapes (biomes) for the New map dialog; addBiome and a kit for more
      places.js           More biomes from Generate's kit: castle, swamp, harbor town, graveyard and ruins (Phase 33)
    render/
      rivers.js           Rivers: smooth, meander, and stamp river strokes; flow direction
      daylight.js         Daylight: time of day and the color tint
      life.js             Life: butterflies, birds, gulls, fireflies, jumping fish
      fire.js             Fire: flames (campfire, brazier, torch, candle), smoke, the light buffer, wall-blocked light, lit windows
      bridges.js          Bridges: finds river crossings, builds straight plank-row bridges, bakes and draws them over the water
      height.js           Height: stepped hills, terraces, and river levels → lift per pixel; gorges, stairs, waterfalls, ledge and cliff shading, raised frame composition, unproject
      characterArt.js     CharacterArt: decodes poses, fakes walk frames, finds the orb, map-size ghost sprite; families drawn in code (one per seed)
      villagers.js        Villagers: people drawn in code, a different one per seed (Phase 30)
      monsters.js         Monsters: skeletons, goblins, slimes, cultists drawn in code, one per seed (Phase 31)
      actors.js           Actors: runtime characters: steering (Play mode), collision, strolling and patrols for villagers and monsters
      characters.js       Characters: draws characters at half size on the display, front occlusion, orb light
      animals.js          Animals: sheep, deer, rabbits, chickens, ducks: wander, graze, flee; drawn into the frame
      tracks.js           Tracks: fading footprints in sand, snow and mud; rings where characters wade (Phase 29)
      houseKit.js         HouseKit: the parts houses are built from, at the characters' scale (walls, frame, windows, doors, roofs, chimneys, extras)
      houses.js           Houses: one generator, every seed a different house (Phase 29; redone at the characters' scale); the old small parts for landmarks
      landmarks.js        Landmarks: tavern, temple, smithy, watchtower, windmill (turning sails), hut, one per seed (Phase 31; redone at the characters' scale)
      structures.js       Structures: keep, gatehouse, wall tower, banner, stilt hut, dead tree, cauldron, lighthouse, boat, headstone, crypt, ruined wall, iron fence (Phase 33; the buildings redone at the characters' scale)
      doors.js            Doors: fit a door into a gap between two walls; front and edge-on sprites; open when someone is near
      weather.js          Weather: cloud shadows, fog, rain, snow
      resolve.js          Resolve: painted layers → final terrain (warp, beaches, decks)
      ground.js           Ground: bakes the static ground layer (dirt, grass, sand, paths, decks, pebbles, shadows)
      water.js            Water: per-frame water pixels, foam, waves, glints
      props.js            Props: furniture and light sprites from pixel templates (tables, benches, beds, chests, barrels, rugs, racks, torches, lanterns…), quarter turns
      sprites.js          Sprites: tree, pine, bush, rock, log, stump, mushrooms, ring, cabin, hut, tent, campfire, tuft, reed, lily
      details.js          Details: auto rules that place tufts, reeds, lilies, pebbles, scatter objects
      renderer.js         Renderer: rebuild pipeline, frame loop, compositing
      preview.js          Preview: tiny maps through the same pipeline, for the library pictures (22 × 22 map pixels, shown at 2×)
    editor/
      viewport.js         Viewport: zoom, pan, screen ↔ map coordinates
      areas.js            Areas: select, move, resize, change, erase painted areas
      tools.js            Tools: brush, lasso, bucket, river, eraser, stamp, scatter, select
      input.js            Input: mouse and keyboard events, sends them to the active tool
      play.js             Play: Play mode, WASD/arrow steering, camera follow
      overlay.js          Overlay: stroke preview, cursor, selection box, plan view, ruler
      tabletop.js         Tabletop: grid overlay, ruler, export grid and per-square sizes
    ui/
      prefs.js            Prefs: layout preferences in localStorage (panels, tabs, recent items)
      icons.js            Icons: inline SVG line icons
      status.js           Status: status bar text
      settings.js         Settings: right panel — Scene / Style / Colors tabs, search, presets, "N more" settings
      files.js            Files: save, open, autosave, PNG export
      thumbs.js           Thumbs: cache of library pictures (cleared on map load and look-changing settings)
      library.js          Library: left drawer — Terrain / Objects tabs, filter, groups, Recent
      dock.js             Dock: scene dock under the map (time, season, weather, grid, pause)
      panel.js            Panel: tool rail, floating tool options bar, map name, panel show/hide
      command.js          Command: command palette (Ctrl/Cmd + K)
      dialogs.js          Dialogs: new map, confirm, export, shortcuts
    main.js               Wires everything together and starts the app
```

Load order in `index.html`: core → model → `ui/prefs.js`, `ui/icons.js` → render → editor → ui → `main.js`.

**Layout:** top bar (map name, File menu, search, undo/redo, view, Play) · tool rail · Library drawer · map with floating bars (tool options on top, scene dock and zoom at the bottom) · Settings panel. `\` and `Shift + \` show or hide the two panels; under 900px they float over the map.

---

## 5. Data model

The map is data, not an image. The renderer turns data into pixels.

```js
map = {
  version: 1,
  width: 300,
  height: 300,
  seed: 1234,                 // used for all render-time noise

  ground: Uint8Array(w * h),  // GROUND.DIRT | GRASS | SAND | PATH | COBBLE | GRAVEL | FLAGSTONE
  water: Uint8Array(w * h),   // WATER.NONE | LAKE | SEA
  scatter: Uint8Array(w * h), // SCATTER.NONE | FOREST | PINES | ROCKY | FLOWERS | BUSHES
  elevation: Uint8Array(w * h), // slope height level 0–7 (Types.MAX_LEVEL). Not called `height`: that's the map's size.
  terrace: Uint8Array(w * h),   // Flatten: 0 = none, else the flat level + 1. Its edges are cliffs.

  rivers: [                   // freeform strokes, kept as vectors so they can be re-wobbled
    { id, points: [[x, y], ...], width: 8, seed, drops: [[x, y], ...] }   // drops: Lower river points (Phase 24)
  ],

  objects: [                  // things placed one at a time
    { id, type, x, y, seed, scale: 1 }   // type: one of Types.OBJECTS (see Types.OBJECT_GROUPS)
  ],

  settings: { ... }           // render settings, colors, season, light angle
}
```

Why separate layers:
- Erasing water shows the ground that was painted under it.
- Scatter regions (forest and so on) are just painted areas. The trees inside them are generated at render time, so they stay cheap to store, easy to erase, and stable from render to render.
- Rivers stay as strokes, so their wobble can be changed later.

Type IDs live in `constants.js`:

```js
const GROUND = { DIRT: 0, GRASS: 1, SAND: 2, PATH: 3, MUD: 4, COBBLE: 5, GRAVEL: 6, FLAGSTONE: 7,
                 CAVE_FLOOR: 8, ROCK: 10, STONE_WALL: 11, WOOD_FLOOR: 12, TILE: 13, CHASM: 14, DRY_EARTH: 15, SLATE: 16 };
const PATHS = new Set([PATH, COBBLE, GRAVEL, FLAGSTONE, WOOD_FLOOR, TILE, SLATE]);   // Types.isPath(g)
const WALLS = new Set([ROCK, STONE_WALL]);                                     // Types.isWall(g)
const BUILT = new Set([STONE_WALL, WOOD_FLOOR, TILE, SLATE]);                  // Types.isBuilt(g): no edge wobble
const WATER = { NONE: 0, LAKE: 1, SEA: 2, RIVER: 3, CHASM: 4 };   // RIVER only appears after Resolve
const SCATTER = { NONE: 0, FOREST: 1, PINES: 2, ROCKY: 3, FLOWERS: 4, BUSHES: 5 };
```

- `PATH` is the "Sand path" material (id `path`, key 4). It keeps value 3 so old saves still load.
- `MUD` is never painted; only Resolve creates it (mud banks).
- 9 is taken (below). `CHASM` (14) is never painted on the ground layer: Resolve sets it where the water layer holds `WATER.CHASM` (Phase 26). Values 17 and up are free.
- An object may carry `turn`: 1 is a quarter turn, for props that can turn (Phase 26); a house or cabin takes 1–3 (facing right, back, left).
- **Scale:** 10 map pixels = 1 grid square = 5 ft. A character (16 pixels tall) fits about one square, like a D&D token.

### 5.1 The world (Resolve output, rebuilt every time, never saved)

| Field | Meaning |
|---|---|
| `ground` | Final ground. `9` (`Resolve.UNDERWATER`) marks ground under water, so land edges are detected against water too. |
| `water` | Final water, with rivers stamped in as `RIVER`. |
| `scatter` | Warped scatter layer. |
| `flowX`, `flowY` | River flow direction per river pixel. |
| `riverPaths` | `{ id, pts: [{x, y, tx, ty, hw}], length }` per river: the final wobbled centerline, used for glints and selection. |
| `crossing` | Set by Rivers: the path type of each path pixel a river runs over (the river is stamped there as usual), and by Resolve for path pixels painted across a chasm. Bridges are built from these. |
| `chasm` | 1 on chasm pixels (Phase 26), including those under a bridge across one. Their `water` is 0 and their `ground` is `CHASM`. |
| `span` | Bridge pixels: `1` deck (walkable), `2` rail (not walkable). The water under them stays water. |
| `bridges`, `bridgeArt` | Bridge geometry (Bridges.place) and its baked pixels, side faces, and water shadow (made on the first frame). |
| `deck` | Planks of lake and sea docks and causeways: `1` = walk up/down, `2` = walk left/right. Drawn instead of the ground. |
| `stones` | Where a path crosses a narrow river: stepping stones go here. |
| `waterDist`, `landDist`, `seaDist`, `freshDist`, `grassEdge` | Distance fields. |
| `waterIdx`, `washIdx`, `underDeck` | Pixel lists for fast per-frame water drawing. |
| `things`, `blocked`, `shadowMask`, `life` | Placed details and objects, blocked pixels, shadow pixels, creatures. |
| `windows`, `chimneys`, `fires`, `rings` | Map positions from sprite anchors (Phases 12, 14, and 20). Each fire has a `kind` (campfire, brazier, torch, candle) and caches its wall visibility mask (`vis`). |
| `toWall` | Distance to the nearest wall pixel (contact shadow on floors, and wall faces). |
| `level`, `terrace` | Warped elevation and terraces (built ground keeps its exact values). |
| `riverLevel` | River water level per pixel: 0, or −1, −2, … after each drop (Phase 24). |
| `soft`, `step` | 1 on hillside ground (not water, not a terrace); the ledge height, `max(2, round(levelHeight / 2))` (Phase 25). |
| `lift` | Pixels each map pixel is drawn raised (below 0 for lowered rivers): river level, 0 for lakes and sea, the terrace level, or the smooth slope height cut down to a whole ledge (`floor(hill / step) × step`); stepped on stairs; bridge decks take their banks' lift. |
| `ramp`, `fall` | Stair pixels; foam where water drops a level (2 at the foot, 1 on the lip and one pixel further on). |
| `raised` | True if any lift isn't 0. Flat maps skip all height drawing. |
| `depth`, `srcY` | Per frame, raised maps only: the map row that drew each frame pixel (base row for things), for occlusion; and the map row under it, for clicks. |
| `bigPaths` | Cached by Actors: 1 on path/deck pixels in a connected stretch of 300+ pixels. |

---

## 6. Rendering pipeline

### 6.1 Rebuild: runs on mouse up, or when a setting changes

Run the steps in this order. Each step is a function in the module shown in brackets.

1. **Warp the edges** [Resolve]. Painted edges look too perfect, so read each layer through a small noise offset:
   `wx = x + (noise(x, y, 6, salt1) - 0.5) * 2 * edgeWobble` (and the same for `wy` with `salt2`).
   Sample `ground`, `water` and `scatter` at `(wx, wy)`, rounded and clamped to the map. Default `edgeWobble` is 2.5 pixels.
2. **Stamp the rivers** [Resolve]. For each river:
   - Smooth the points with 2 rounds of Chaikin smoothing.
   - Resample them every 1 pixel along the line, and track the distance along the line, `s`.
   - Push each point sideways (along the line's normal) by `(noise1D(s, bendSize, seed) - 0.5) * 2 * meander`.
   - Half-width = `width / 2 * (1 + (noise1D(s, 10, seed + 1) - 0.5) * 2 * widthWobble)`.
   - Stamp a filled circle of that half-width at each point into `riverMask`.
   - Keep the resampled path; Water uses it for glints that flow downstream.
3. **Final water** [Resolve]: `finalWater[i] = riverMask[i] ? RIVER : warpedWater[i]`. Rivers always stamp over paths. Where a river runs over a painted path, a river narrower than 6 pixels gets stepping stones, and a wider one records the path type in `world.crossing`.
   - **Bridges** [Bridges.place, after the shore rules] (Phase 18): one straight bridge per connected blob of crossing pixels.
   - **Docks** [Resolve.computeDecks]: a path pixel becomes deck when an unbroken run of path pixels reaches lake or sea water (not river) within 30 pixels on both sides. Holes are filled, each deck gets one plank direction, decks widen by 1 pixel, and each is straightened into a parallelogram (least-squares center line, median width; cut pixels go back to their old water).
4. **Distance fields** [Grid.distanceField, ported from the water lab]:
   - `waterDist`: for water pixels, the distance to land.
   - `landDist`: for land pixels, the distance to any water.
   - `seaDist`: for land pixels, the distance to sea water only. Used for beaches.
5. **Final ground** [Resolve]: start from the warped ground, then apply the ground rules (7.1).
6. **Place details** [Details]: tufts, flowers, pebbles, reeds, lily pads, scatter objects. All are seeded and sorted by `y`.
7. **Build sprites** [Sprites]: build each placed object's sprite once and cache it by `id + seed + settings version`.
8. **Bake the static layer** [Ground]: all ground colors and textures into one `Uint8ClampedArray`. Bake ground shadows in too, and keep a `shadowMask` so per-frame tufts can be darkened under trees.

A 300×300 map should rebuild in well under half a second. If it's slower, split step 8 into row chunks over several frames and show "Rendering…" until it finishes.

### 6.2 Each frame: about 11 frames per second, setting `fps`

**The frame is drawn by WebGL by default** (see `gl-renderer.md`): each numbered step below is a stage in `js/render/stages.js`, with its CPU code there and a GL pass in `js/gl/passes/`. The CPU code is still the reference and the fallback. Maps can be up to 1000×1000.

While the animation is paused (Pause button or `K`, Phase 24) time stands still and no frames are drawn, except while Play mode is walking a character. Edits still rebuild and draw one frame.


1. Copy the static layer into the frame buffer.
2. Draw water pixels and glints (6.3) [Water].
3. Bridge shadows on the water, then the bridges [Bridges.draw].
4. Draw flat details (lilies, stepping stones), then everything else sorted by `y` (flat objects such as rugs and stairs first): tufts, flowers, reeds, and object sprites, with wind sway [Details].
5. Move and draw animals, then redraw things standing in front of them [Animals.update, Animals.draw].
   On raised maps steps 4–5 are replaced by `Height.compose` (Phase 23).
6. Smoke from campfires and braziers, and chimneys [Fire.draw].
7. Fish, butterflies, birds [Life.draw].
8. Cloud shadows, then rain or snow [Weather.draw].
9. Tint over everything [Daylight.apply]: the time-of-day tint, or the underground tint.
10. Lights: `Fire.beginLights`, every fire adds its pool (`Fire.addLights`), each orb adds its pool (`Characters.addLights`), then `Fire.applyLights` brightens the frame once.
11. Flames and lit windows at full brightness [Fire.drawGlow], then fireflies [Life.drawGlow].
12. `putImageData` onto an offscreen map canvas, then draw that onto the display canvas at the current zoom and pan, with `imageSmoothingEnabled = false`. Characters, the grid [Tabletop.drawGrid], and the overlay are drawn on top in screen space.

### 6.3 Water drawing, per frame (port from the water lab)

- `d = waterDist + shimmer noise`, where the noise moves with time.
- Foam where `d <= foamWidth`, with gaps from moving noise.
- Depth bands: shallow, middle, deep, each `bandWidth` pixels wide, with checkerboard dithering at band edges.
- **Sea:** waves wash onto land where `seaDist <= wave`, with `wave = (sin(t * waveSpeed) * 0.5 + 0.5) * waveReach`. The front edge is foam. Sand the waves reach becomes wet sand.
- **Lake:** small waves (reach under 1). Twinkling glints in place.
- **River:** glints are particles that move along the river path. Each particle has a position along the line that grows with `time * flowSpeed`, and a random sideways offset within 60% of the half-width. Shimmer noise also drifts in the flow direction.

---

## 7. Automatic rules

Small details the user never paints. Each rule has an on/off setting.

### 7.1 Ground rules [Resolve and Ground]

| Rule | Logic |
|---|---|
| Beach | Land within `beachWidth` (default 8) of the sea becomes sand. Noise wobbles the width by ±1. |
| Wet sand | Sand within `waveReach` of the sea is darker (per frame, as in the water lab). |
| Mud bank | Land within 1 pixel of a lake or river (and not sand) becomes darker, wet-looking dirt. |
| Thin lake sand | Optional 1-pixel sand rim around lakes. Off by default. |
| Grass lip | A grass pixel with non-grass directly below gets a darker grass color. A dirt pixel with grass directly above gets darker dirt. This gives a slight 3D step. |
| Ragged grass edge | Where grass meets dirt, flip a few edge pixels using `hash`, so the border isn't smooth. |
| Dirt texture | Two dirt shades in noise patches, plus darker and lighter speckles from `hash`. |
| Sand path | Lighter packed dirt, darker 1-pixel border, speckles, a few pebbles. |
| Cobblestone | `Random.cells(x, y, 5)`: each cell is one stone. Where `d2 - d1 < 0.8`, draw the dark gap color. Within `d2 - d1 < 2.2` (a stone's rim), use the light color on the side facing the light and the dark color on the far side. The stone body alternates between two shades by cell id. Edge pixels of the path are gaps. |
| Gravel | Base color with grains from `hash`: about 10–18% dark (more in noise patches), 6% warm, 10% light. Ragged dark border (60% of edge pixels). More pebbles than other ground. |
| Flagstones | Like cobblestone with bigger cells (8) and a thin gap (`< 1`). Some gaps grow grass, from noise. Light and dark rims, rare dark specks. |
| Sand texture | Sand with speckles and an occasional pebble. |

### 7.2 Detail rules [Details]

| Rule | Logic |
|---|---|
| Grass tufts | Only on grass. Clumped by noise. Thinner within 2 pixels of a grass edge. Not on paths. |
| Wild flowers | A few flowers on grass in noise patches (`flowerAmount`, low by default). |
| Pebbles | 2×2. Chance per pixel: dirt .003, sand path .002, gravel .006, sand .0006, times `pebbleAmount × 2`. Not on decks or water. |
| Reeds | On lake and river banks (`landDist <= 2` or `waterDist <= 1.5`), in noise patches. Never by the sea. |
| Lily pads | Lakes only, in shallow water (`2.5 <= waterDist <= 3 * bandWidth`), in noise patches. |
| Beach rocks | Occasional small rocks on sand near the sea. |
| No tufts under trunks | Skip tufts within 2 pixels of an object's base. |
| Shadows | Every tree, pine, bush and rock casts an oval shadow away from the light, as in the trees lab. |

### 7.3 Placement rules [Tools and Details]

| Rule | Logic |
|---|---|
| No objects in water | A placement ghost over water turns red, and clicking does nothing. Scatter objects skip water. |
| Keep paths clear | Scatter objects, reeds, and lilies never land on any path type (`Types.isPath`). |
| Forest edges | In FOREST and PINES regions, within 3 pixels of the region edge: bushes instead of trees, at lower density. |
| Spacing | Scatter uses a jittered grid: one candidate per cell of size `spacing`. Accept if inside the region, on land, and `hash < density * noiseClump`. |
| Overlap nudge | Dropping an object right on another one nudges it to the nearest free spot within 4 pixels. |

---

## 8. Editor

### 8.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Top bar: New · Open · Save · Export PNG · Undo · Redo ·      │
│          View: Rendered | Plan · Zoom − 100% + Fit Fullscreen│
│          Grid · Play · Pause                                  │
├────────┬──────────────────────────────────────┬─────────────┤
│ Tools  │                                      │ Tool options│
│ (left) │         Map canvas (pan / zoom)      │ Render      │
│        │                                      │ settings    │
├────────┴──────────────────────────────────────┴─────────────┤
│ Status: cursor x,y · terrain under cursor · Rendering…       │
└─────────────────────────────────────────────────────────────┘
```

- **Plan view:** flat colors per type, river lines drawn as thin blue lines, objects as small icons. Instant, with no full render.
- **Rendered view:** the full pixel art, animated.
- The canvas fills its area. The map image is drawn with nearest-neighbor scaling at any zoom from 0.25× to 24×, and can be panned.
  - Fit uses the exact zoom that fits the map (a 16-pixel margin, none in fullscreen). Whole zooms only left big empty borders.
  - **Constrain rule** (`Viewport.constrain`, after every zoom, pan, and resize), per axis: if the scaled map is smaller than the view, it is centered; if bigger, it zooms around the cursor but can't leave a gap past the margin at either edge. This keeps a zoom with the cursor outside the map from pushing the map into a corner.
  - The mouse wheel, trackpad swipe, and pinch (`ctrlKey` wheel) zoom smoothly around the cursor: factor `exp(-deltaY × 0.003)` (pinch 0.012), clamped to 0.8–1.25 per event. − and + step to the next whole zoom.
  - In fullscreen the fit zoom is the smallest allowed (`state.fitIsMin`, checked in `zoomAt` and `resize`), so you can only zoom in from the fitted view. Outside fullscreen the minimum is 0.25×.
  - In fullscreen, a left-drag pans the map (the constrain rule stops it at the edges) instead of using the tool. The cursor is a grab hand, and the brush ring and stamp ghost are hidden. `App.isFullscreen()` covers both real fullscreen and `map-only`.
  - **Fullscreen** (top-bar button or `F`) puts `#viewport` in browser fullscreen, with an Exit button in its corner. On the change, `Viewport.requestFit()` refits once the new size arrives (`fitPending`, applied in `Renderer.resize`, with a 250 ms backup). If the browser refuses fullscreen, `body.map-only` makes the map fill the window instead. The in-app browser leaves the request pending, so test fullscreen in a real browser.

### 8.2 Materials and tools

What gets painted (the material) is chosen separately from how it's applied (the tool).

**Materials:** Ground (Dirt 1, Grass 2, Sand 3, Cave floor), Paths (Sand path 4, Cobblestone, Gravel, Flagstones, Wood floor), Walls (Rock wall, Stone wall), Height (Raise, Lower, Flatten, and the Lower river tool), Water (Lake 5, Sea 6), Areas (Forest 7, Pines 8, Bushes, Rocky 9, Flowers 0). Each group is a toolbar section, followed by the stampable object sections, which pick the Stamp tool: Objects, Buildings, Furniture, Lights, Characters, Animals.
Each material writes to its own layer: ground, water, scatter, elevation (Raise, Lower) or terrace (Flatten).

| Tool | Key | Behavior |
|---|---|---|
| Brush | B | Freehand stroke with the current material. Size slider 1–60. |
| Lasso | L | Draw a freeform shape. On mouse up it closes automatically and fills with the current material. Good for lakes and seas. |
| Line | N | Straight stroke of the current material at brush thickness. Shift snaps to 45°. Good for walls. |
| Rectangle | M | Box of the current material: Outline (thickness = brush size) or Filled. Shift makes a square. |
| Bucket | G | Flood-fills the connected area of the clicked layer with the current material. |
| River | R | Freeform line. Options: width (2–40), meander, width wobble. |
| Eraser | E | Freehand. The option "Erase" can be water, scatter, ground (back to dirt), or all. |
| Stamp | T | Places one object (any type in `Types.OBJECTS`, including buildings and characters). A ghost preview follows the cursor. Each click picks a new random seed. |
| Select | V | Click an object or river to select it. Drag to move. `Delete` removes it. `R` rerolls its seed. `[` and `]` change its scale or river width. |
| Lower river | W | Listed under Height. Click a river: it drops a level from there on downstream (waterfall). Click a drop again to remove it. Up to 3 per river (`Types.MAX_DROPS`). |
| Measure | U | Drag from square to square: shows both squares, a line, and the straight-line distance between their centers (Pythagoras) in feet and squares, to 2 decimals. The ruler stays until the next click, `Esc`, or a tool change. Doesn't change the map. |
| Pan | Space + drag, or middle mouse | Moves the view. |

Other shortcuts: `Q` turn the selected object or the next stamp (Phase 26), `H` grid on/off (Phase 19), `P` Play (Phase 16), `K` pause or resume the animation (Phase 24), `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` redo, `[` and `]` brush size, mouse wheel zoom, `Tab` switch between Plan and Rendered view, `1`–`0` pick a material.

### 8.3 Stroke handling

- **During the stroke:** collect points and draw only the preview on the overlay (the material's color at 50% opacity). No rebuild.
- **On mouse up:**
  1. Turn the stroke into a pixel mask with `Grid.maskFromPath`: draw the path on an offscreen canvas the size of the map (round line caps, `lineWidth = brush size`, or `fill()` for lasso), read the alpha, and treat `alpha >= 128` as inside.
  2. Save an undo snapshot.
  3. Write the material into its layer wherever the mask is set.
  4. Schedule a rebuild with `setTimeout(rebuild, 0)` and show "Rendering…".
- **Rivers on mouse up:** drop points closer than 2 pixels apart, then store the stroke in `map.rivers`.

### 8.4 History

- Before each change, save a snapshot: copies of `ground`, `water` and `scatter`, plus `rivers` and `objects` as JSON.
- Keep at most 50 snapshots. Redo is cleared on any new change.

---

## 9. Files and saving

| Action | Behavior |
|---|---|
| New map | Dialog: width and height (64–1000, default 300×300), starting ground (Dirt by default, or Grass) or a random landscape (Phase 28), seed (random, editable, dice to reroll). Warn that sizes over 400 draw slowly on the CPU (WebGL fixes that), and that maps over 600 take about a second to update after each stroke. |
| Autosave | After each change (debounced by 1 second), save to `localStorage`. On load, offer to continue the last map. |
| Save | Download `map-name.json`. Store layers as base64 strings. |
| Open | File picker that loads a `.json` map. |
| Export PNG | Exports the current rendered frame with sharp pixels. Size: a pixel scale (1×–8×), or pixels per grid square for virtual tabletops (70 Roll20, 100 Foundry, 140, 200). A size that isn't a whole multiple of the square size shows a warning. Optional: draw the grid. Characters are not in the export yet; animals are. |

---

## 10. Settings panel

These are grouped like the labs. Any change triggers a rebuild.

- **Ground:** edge wobble, grass patch size, tuft density, flower amount, pebble amount.
- **Water:** band width, dither, shimmer, foam width, foam gaps, wave reach (sea), wave speed, flow speed (river), glint density, beach width, bridges and docks, stepping stones.
- **Rivers (defaults for new rivers):** width, meander, bend size, width wobble.
- **Vegetation:** forest density, forest spacing, tree size, size variation, leaf texture, reeds on/off, lily pads on/off.
- **Light:** light direction, shading, outline, shadows, shadow length.
- **Wind:** on/off, strength, speed, fps.
- **Season:** Summer, Autumn or Winter (palette swap, as in the trees lab).
- **Colors:** every palette color, editable.
- **Time of day:** time, underground, light underground, let time pass, length of a day, butterflies, bird flocks, fireflies, jumping fish, smoke.
- **Height:** height per level (pixels, 4–12), stairs where paths cross cliffs.
- **Grid and tabletop:** show the grid, square size (map pixels), feet per square, shift sideways, shift up or down, line strength. All live.
- **Water** also has **Bridge style:** From the path (cobble and flagstone paths get stone bridges, the rest wooden), Wooden, Stone, Rope.
- **Weather:** Clear / Rain / Snow (buttons, item type `choice`), rain or snow amount, cloud shadows, cloud cover, cloud shadow darkness, cloud speed. All live (no rebuild).

Defaults worth knowing (all in `MapModel.defaultSettings`): `riverWidth` 8, `riverMeander` 8, `riverBendSize` 40, `beachWidth` 8, `bridges` true, `bridgeStyle` 'auto', `steppingStones` true, `underground` false, `ambient` 0.15, `levelHeight` 6, `stairs` true, `grid` false, `gridSize` 10, `gridFeet` 5, `gridOffsetX`/`Y` 0, `gridOpacity` 0.3, `timeOfDay` 12, `dayCycle` false, `dayLength` 180, `butterflies` 12, `birds` 2, `fireflies` 60, `fish` 6, `smoke` true, `weather` 'clear', `precipitation` 0.5, `clouds` true, `cloudAmount` 0.35, `cloudDarkness` 0.1, `cloudSpeed` 1, `forestFloor` 0.5, `fps` 11.

---

## 11. Phases

Build one phase at a time. Each phase must leave a working app.

### Phase 0: Skeleton

**Goal:** the app opens, makes a new map, and shows an empty dirt map you can zoom and pan.

- [x] Folder structure and `index.html` with every script tag (files can be stubs).
- [x] `style.css` with the three-column layout, light and dark theme variables, and responsive basics.
- [x] `Random`, `Colors` and `Types` modules ported from the labs.
- [x] `MapModel.create(width, height, seed, startGround)`.
- [x] New map dialog (default 300×300) shown on first load.
- [x] `Viewport`: fit to screen, wheel zoom around the cursor, Space+drag and middle-mouse pan.
- [x] `Renderer` draws flat dirt (temporary) onto the display canvas.
- [x] Status bar shows the cursor's map coordinates.

**Done when:** double-clicking `index.html` opens the dialog, creating a 300×300 map shows dirt, and zoom and pan feel smooth.

### Phase 1: Painting ground

**Goal:** paint grass, sand, path and dirt, and see them rendered properly on mouse up.

- [x] Toolbar and material picker: Dirt, Grass, Sand, Path.
- [x] Brush tool with a size slider and `[` / `]`.
- [x] Lasso tool and Bucket tool.
- [x] Eraser (ground → dirt).
- [x] Stroke preview on the overlay, written to the layer on mouse up (8.3).
- [x] `Grid.maskFromPath`, `Grid.floodFill`, `Grid.warpSample`.
- [x] `Resolve`: edge warp (6.1 step 1) and final ground.
- [x] `Ground`: dirt texture, grass patches, sand, path, grass lip, ragged edges (7.1).
- [x] `Details` and `Sprites`: grass tufts (ported) and wild flowers. Pebbles on dirt and paths.
- [x] Frame loop with tuft wind sway.
- [x] Plan view and Rendered view, switched with `Tab`.
- [x] Undo and redo (`History`).

**Done when:** you can paint a grassy area with a dirt path through it and some sand, the edges look natural rather than brush-shaped, tufts sway, and undo/redo work.

### Phase 2: Lakes and seas

**Goal:** paint water and get a living shoreline for free.

- [x] Lake and Sea materials, which work with brush, lasso and bucket.
- [x] Eraser option for water.
- [x] Distance fields: `waterDist`, `landDist`, `seaDist`.
- [x] Water drawing per frame (6.3): bands, dither, shimmer, foam, glints.
- [x] Sea: beach sand, waves washing onto the beach, wet sand, beach rocks.
- [x] Lake: mud bank, reeds, lily pads.
- [x] Static layer and per-frame split (6.1 / 6.2), keeping 11 fps on 300×300.

**Done when:** drawing a closed shape with the lasso makes a lake with reeds and lily pads, a sea along one side gets a beach with waves, and erasing water shows the ground underneath.

### Phase 3: Rivers

**Goal:** draw a freeform line and get a natural, flowing river.

- [x] River tool with width, meander and width-wobble options.
- [x] Store strokes in `map.rivers`.
- [x] `Resolve`: smooth, resample, meander, vary the width, and stamp (6.1 step 2).
- [x] River glints flow along the path. Shimmer drifts with the flow.
- [x] Reeds and mud banks along rivers.
- [x] Rivers merge naturally into lakes and seas.
- [x] Select tool: click a river to select it (highlight its path), `Delete` to remove it, `[` / `]` to change its width.
- [x] Plan view shows river paths.

**Done when:** a wiggly line drawn from a lake to the sea becomes a meandering river whose glints flow toward the end where you finished drawing, with foam and banks where it meets the lake and sea.

### Phase 4: Objects

**Goal:** drop unique trees, pines, bushes and rocks one at a time.

- [x] Port the sprite generators from the trees lab into `Sprites`.
- [x] Stamp tool with a ghost preview. The ghost turns red over water.
- [x] Each placed object gets its own seed, so every one is different.
- [x] Select tool: pick the topmost object under the cursor, drag to move, `Delete`, `R` reroll, `[` / `]` scale.
- [x] Ground shadows baked into the static layer, plus the shadow mask for tufts.
- [x] Objects sorted by `y` together with tufts and reeds. Canopies sway in the wind.
- [x] Overlap nudge (7.3).

**Done when:** you can place 20 different trees and rocks around the lake, move them around, reroll one you don't like, and none can be placed in water.

### Phase 5: Scatter regions

**Goal:** paint a forest instead of placing trees one by one.

- [x] Forest, Pines, Rocky and Flowers materials (scatter layer), used with brush, lasso and bucket.
- [x] Eraser option for scatter.
- [x] Jittered-grid placement with density, spacing and noise clumping (7.3).
- [x] Forest edges get bushes.
- [x] Rocky: rocks of mixed sizes plus pebbles. Flowers: dense flower tufts.
- [x] Scatter objects respect the water and path rules.
- [x] Plan view shows scatter regions as hatched or tinted areas.

**Done when:** painting a big forest area fills it with varied trees and bushy edges in under a second, and erasing part of it removes those trees.

### Phase 6: Saving and settings

**Goal:** keep your maps and tune how they look.

- [x] Save and Open as `.json` (base64 layers).
- [x] Autosave to `localStorage`, and "Continue last map?" on load.
- [x] Export PNG at the chosen zoom.
- [x] Full settings panel (section 10), including seasons and colors.
- [x] Every keyboard shortcut from 8.2.
- [x] Short help popover that lists the shortcuts.

**Done when:** you can close the browser, reopen it, continue the same map, switch it to winter, and export a PNG.

### Phase 7: Extra rules (optional, pick any)

- [x] **Bridges:** where a path crosses a river, draw a wooden bridge automatically.
- [x] **Stepping stones:** where a path crosses a narrow river (under 6 pixels), draw stones instead.
- [ ] **Reflections:** trees, rocks, reeds, and decks right next to water get a faded, wobbly upside-down copy in the water. Plan: for each object within a few pixels above the water, mirror its sprite rows downward from its base line, only onto water pixels. Blend each pixel about 35% toward the water color, and shift each row sideways by `round(sin(time * 2 + y * 0.8) * 0.7)` so it ripples. Skip the sea, since waves break it up. Draw it in Water, before details.
- [ ] **Day and night:** moved to Phase 8.
- [ ] **Birds or butterflies:** moved to Phase 8.
- ~~**Waterfalls:**~~ dropped here; built later with height (Phase 23, and Lower river in Phase 24).
- [x] **Docks:** a path painted into a lake or sea becomes a wooden pier.

### Phase 8: Day, night, and wildlife

**Goal:** the map has a time of day, and small creatures bring it to life.

New modules: `render/daylight.js` (Daylight) and `render/life.js` (Life).

**Time of day [Daylight]**
- Settings: `timeOfDay` (0–24 hours, default 12), `dayCycle` (on/off), `dayLength` (seconds for a full day, default 180).
- Current hour = `dayCycle ? (timeOfDay + time * 24 / dayLength) % 24 : timeOfDay`.
- Tint = multiply each frame pixel's RGB by a color picked from keyframes, blended linearly:

  | Hour | Tint (R, G, B) | Look |
  |---|---|---|
  | 0 | 0.28, 0.33, 0.55 | night |
  | 5 | 0.33, 0.36, 0.60 | before dawn |
  | 6.5 | 0.92, 0.70, 0.70 | sunrise |
  | 8 | 1.00, 0.95, 0.90 | morning |
  | 12 | 1.00, 1.00, 1.00 | noon |
  | 16.5 | 1.00, 0.95, 0.85 | afternoon |
  | 18.5 | 0.98, 0.66, 0.50 | sunset |
  | 20 | 0.48, 0.44, 0.68 | dusk |
  | 21.5 | 0.30, 0.34, 0.56 | night |
  | 24 | same as 0 | |

- `darkness = 1 − average(tint)`. Life uses it to decide what is visible.
- Plan view is never tinted. Export PNG saves the tinted frame.

**Creatures [Life]** (positions picked on rebuild; movement per frame)
- **Butterflies** (`butterflies`, default 12): only by day. They live over grass, near flowers when possible. Each drifts around its home spot along `sin` plus noise paths. Wings flap between 2 frames (open: wing–body–wing, closed: one wing pixel above the body). Colors come from the flower colors plus a butterfly orange. A 1-pixel shadow sits 3 pixels below.
- **Birds** (`birds`, flocks, default 2): only by day. Each flock is 3–5 birds in a loose V that crosses the map and wraps around. 2-frame flap (V up / flat). A small shadow lands far below and to the side, because birds fly high.
- **Fireflies** (`fireflies`, default 60): only at night. They sit over grass, forests, and near water. They drift slowly and blink. They are drawn after the tint at full brightness, with a soft glow on the 4 neighboring pixels.

**Frame order:** water → details → creatures → tint → firefly glow.

- [x] Daylight module, settings, and tint pass.
- [x] Day cycle animation.
- [x] Butterflies, birds, fireflies, with their own colors in the Colors section.

**Done when:** dragging the time slider moves smoothly through sunrise, noon, sunset, and night; fireflies appear at night; butterflies and birds appear by day.

### Phase 9: Selecting painted areas

**Goal:** paths, grass, lakes, forests, and every other painted area can be selected and changed, like rivers and objects.

- Select tool click order: placed object → river → painted area.
- **Area** = the connected patch (4-neighbor flood fill) of one layer value under the cursor. The top layer wins: scatter area, then water, then ground. **Shift+click** selects the ground layer instead.
- Selection = `{ type: 'area', layer, value, mask, count }`. Highlight: a light fill over the area, brighter on its edge pixels.
- Actions:
  | Action | How | Effect |
  |---|---|---|
  | Move | Drag | Clears the area at its old place, writes it at the new place. Cleared ground takes the most common ground type around it (so a path moved off grass leaves grass); cleared water and scatter become none. Ground written over water replaces the water. |
  | Grow / shrink | `]` / `[` or buttons | Grows or shrinks the area by 1 pixel all round. |
  | Change material | Swatch buttons | Writes the new material into the area. The old layer is cleared unless it's ground (ground stays as the base). The selection follows the new material. |
  | Delete | `Delete` or button | Clears the area's layer, using the same rule as Move. |
- All actions are undoable. If any other edit (or undo) changes the selected pixels, the area selection is dropped.

- [x] Area hit test and flood-fill selection.
- [x] Move, grow, shrink, change material, delete.
- [x] Panel options and overlay highlight.

**Done when:** you can click a path, drag it somewhere else, widen it with `]`, change a grass field into sand, and undo each step.

### Phase 10: Objects and areas for every stamp type

**Goal:** every stamp type can be placed one at a time or painted as an area.

- Left toolbar gets two more sections: **Areas** (Forest, Pines, Bushes, Rocky, Flowers) and **Objects** (Tree, Pine, Bush, Rock). Clicking an object picks the Stamp tool with that type.
- New scatter value `SCATTER.BUSHES = 5`: bushes only, cell size `bushSize × 2 × spacing`.

- [x] Toolbar sections for Ground, Water, Areas, Objects.
- [x] Bushes area.

**Done when:** a pine can be placed alone from the Objects section, and a bush area can be painted.

### Phase 11: Path types

**Goal:** paths come in several looks, and bridges work for all of them at any width.

- New ground values `COBBLE 5`, `GRAVEL 6`, `FLAGSTONE 7`, and a **Paths** toolbar section (Sand path, Cobblestone, Gravel, Flagstones). Textures are in 7.1, colors in `Colors.DEFAULTS` (`cobble*`, `gravel*`, `flag*`).
- `Types.isPath(g)` replaces every `=== GROUND.PATH` check (Rivers, Resolve, Details).
- `Random.cells` is a jittered-grid cell noise that returns `d1`, `d2`, the cell `id`, and the offset from the cell's point. It's used for the stone shapes.
- Bridge fix: Rivers recorded the dry crossing pixels in `world.bridge`. The old 10-pixel look-sideways rule missed the middle of wide paths. (Replaced by Phase 18.)

- [x] Four path types, paintable, selectable, and changeable like any other ground.
- [x] Wide paths (22 pixels) across a wide river (21 pixels) get a full bridge.
- [x] Every path type gets a bridge over a river and a dock over a lake.

**Done when:** a cobblestone road crossing a river shows a full wooden bridge, and a gravel path into a lake becomes a pier.

### Phase 12: Cabins, huts, and campfires

**Goal:** small buildings and campfires, placed like trees, that come alive at night.

- New object types `cabin`, `hut`, `campfire` in a new **Buildings** toolbar section (Objects stays for nature). They use the Stamp tool, and Select (move, size, New look, Delete) works like any object.
- Sprites are built from the seed (Sprites), all with sway weight 0:
  - **Cabin:** a log wall (horizontal logs, 2-pixel rows of wood and dark wood, light round log ends at the corners), a door, and 1–2 windows. A pitched roof with a horizontal ridge: the back slope is lit or shaded by the light direction, and the front slope has staggered shingle rows. The roof overhangs the wall by 1 pixel. A stone chimney sits on the back slope, on a random side. Width is 14–18 pixels times the scale. Snow on the roof in winter.
  - **Hut:** a round thatched roof (a dome: each row's half-width grows toward the bottom), vertical straw streaks in three thatch shades, a darker ragged fringe, a short mud wall with a dark doorway.
  - **Campfire:** a ring of 7–9 small stones around two crossed logs. The flames are not part of the sprite (see Fire).
- A sprite can carry **anchors** (relative to its base): `windows`, `chimney`, `fire`. Details turns them into map positions: `world.windows`, `world.chimneys`, `world.fires`.
- Buildings block their whole footprint (sprite width × roof depth above the base), so no tufts or scatter trees grow inside them.
- New module `render/fire.js`, **Fire**:
  - `draw` (before the tint): smoke from fires and chimneys. Each source has about 6 puffs on a loop. A puff rises about 14 pixels, drifts with the wind, and fades by blending toward the ground less and less. Puffs are 1 pixel, growing to a plus shape. Setting `smoke` (on).
  - `drawGlow` (after the tint, like fireflies): flames flicker by hash per frame (white-yellow core, orange, red tips, 3–5 pixels tall). At night, a warm light pool (radius about 12, `(1 - d/R)²` falloff, flickering) is blended around each fire. Lit windows turn warm yellow with a faint halo. More windows light up as it gets darker.
- Colors: `roof*`, `thatch*`, `windowDay`, `windowLit`, `fire1–3`, `smoke`.
- As built:
  - Cabin front-slope shingles: a dark course line every 3rd row, with staggered seams. A dark line every 2nd row looked like brick.
  - The light pool divides the tinted pixel by the tint (undoing the night), multiplies by `WARM = [1.4, 0.98, 0.62]`, and blends in 4 flat steps with checkerboard dither. Radius 16, squashed 1.4× vertically.
  - Window anchors are `[x, y, windowIndex]`, so all 4 pixels of a window switch on together.

- [x] Cabin, hut, and campfire sprites, stampable, selectable, re-rollable.
- [x] Footprint blocking and shadows.
- [x] Flickering fire, smoke from fires and chimneys.
- [x] Night: fire light pools and lit windows.

**Done when:** a cabin by a campfire at 21:00 shows lit windows, chimney smoke, and a flickering orange glow on the grass.

### Phase 13: Weather

**Goal:** moving cloud shadows, rain, and snowfall.

- New module `render/weather.js`, **Weather**, drawn each frame after Life and before the daylight tint.
- **Cloud shadows** (`clouds` on, `cloudAmount` 0.35, `cloudSpeed` 1): a noise field (size about 70) sampled on a coarse 8-pixel grid that drifts with time, bilinear between grid points. Where the value is above `1 - cloudAmount`, pixels are multiplied by a cool shade. A thin dithered band softens the edge.
- **Weather** setting: Clear, Rain, or Snow (`weather`, buttons like the seasons). `precipitation` (0.6) sets how much.
  - **Rain:** the whole frame darkens slightly toward blue. Falling streaks (3 pixels, slanted with the wind, light blue-grey at 55%). Splashes on a looping set of slots: on land, a 1-frame dot and then two side pixels; on water, a small ripple ring growing to radius 3.
  - **Snow:** flakes drift down slowly with a sideways `sin` sway. Near flakes (2 pixels, brighter) fall faster than far ones (1 pixel, fainter). It doesn't change the season; it pairs well with Winter.
  - In rain or snow, butterflies, birds, and fireflies stay hidden.
- As built: rain has `w·h/400 × precipitation` streaks of 3 faint pixels (alpha 0.4 fading), `w·h/900 ×` splash slots, and a light frame shade `[0.9, 0.92, 0.96]`. The first version (`/90`, `/220`, alpha 0.6) was too heavy. Cloud shadow strength is the `cloudDarkness` setting (default 0.1); each channel is multiplied by `1 - cloudDarkness × [1, 0.95, 0.6]`, so shadows look slightly cool. Clouds are covered where the noise is above `0.75 - cloudAmount × 0.45`. Every effect costs about 1.5 ms per frame or less on a 500×500 map.
- `Water.ripple(frame, world, x, y, r, alpha, color)` is a shared helper: draws an ellipse ring (`ry = r × 0.6`) blended onto water pixels only. Used by rain and fish.

- [x] Cloud shadows with settings.
- [x] Rain with splashes and ripples.
- [x] Snowfall.

**Done when:** clouds drift across the map, and switching to Rain or Snow fills the sky with moving drops or flakes.

### Phase 14: Forest floor

**Goal:** mushroom rings, fallen logs, and stumps, alone or scattered automatically in forests.

- New object types `log`, `stump`, `mushrooms` (one small cluster), and `ring` (a fairy ring), in the Objects section.
  - **Log:** lying sideways, 7–12 pixels long and 3–4 thick. Light top row, dark bottom, bark streaks, dark outline. One end shows the cut: a small ellipse with growth rings. Moss patches on top. Flips randomly.
  - **Stump:** a top ellipse with rings and a center dot, 2–3 pixels of bark below lit on one side, and little roots at the bottom corners.
  - **Mushrooms:** 1–3 mushrooms, each a 1-pixel stem and a 3-pixel cap (red with white spots, or brown).
  - **Ring:** 8–14 mushrooms around an ellipse (radius 5–8, `ry = rx × 0.6`). The grass along the ring is baked darker (Ground reads `world.rings`).
- Forests and pine areas get some of these automatically (`forestFloor` 0.5): a small chance per scatter cell, on cells that didn't get a tree.
- Colors: `mushroomCap`, `mushroomBrown`, `mushroomSpot`, `mushroomStem`.
- As built: a sprite may carry `blocks` (pixels to keep clear) instead of a footprint, so tufts still grow inside a fairy ring but not on its mushrooms. In forests and pine areas, a cell that fails the tree density test gets a floor item with chance `forestFloor × 0.6` (30% log, 30% stump, 40% mushrooms).

- [x] Log, stump, mushrooms, and ring sprites, stampable.
- [x] Fairy ring darkens the grass under it.
- [x] Forest floor details in forests, with a setting.

**Done when:** a forest shows the odd log and stump between the trees, and a fairy ring can be dropped in a meadow.

### Phase 15: Jumping fish

**Goal:** now and then a fish leaps out of a lake or the sea.

- In Life: `fish` (default 6) jump slots. At rebuild, collect water spots at least 3 pixels from the shore (lakes, sea, wide rivers).
- Color: `fish`. Setting: `fish` (Time of day section).
- Each slot loops on its own period (6–12 s). Each loop picks a new spot by `hash(slot, loop)`.
  - The jump (about 0.8 s): a 2–3 pixel silver fish along an arc 4 pixels high, tail lower than the head.
  - A splash of foam pixels when it leaves and when it lands.
  - After landing, a ripple ring grows to radius 6 and fades (`Water.ripple`).

- [x] Fish jumps with splashes and ripples.

**Done when:** watching a lake for a few seconds shows a fish leap and the ring spreading out.

### Phase 16: Characters

**Goal:** a hand-made character sprite (the elf wizard) lives on the map: he wanders the paths, and in Play mode the user walks him around.

**Changed in Phase 24:** the user removed wandering. Characters stand still unless steered in Play mode. The wander code below lives on in `wander.js`, which isn't loaded.

**Decisions (from the user):** half size with full detail; he wanders on his own, and Play mode steers him; the walk is faked from the 8 standing poses until real walk frames exist.

- **Art:** `assets/characters/elf-wizard/` has 8 poses (`south`, `south-east`, … 32×32, transparent background, "low top-down" view) from a sprite generator. `tools/map-editor/pack_character.py <folder> "<Name>"` writes `<folder>.js`, which calls `CharacterArt.add`. That registers a new object type (key = folder name) in a **Characters** toolbar section through `Types.addObject`. To add another character: drop its folder in, run the script, and add one `<script>` tag after `characterArt.js`.
- **CharacterArt** (`characterArt.js`), per direction:
  - Feet: `bottom` (the lowest opaque row) and `footX` (the center column of the bottom 3 rows).
  - Fake walk, 4 frames `[pose, stepA, pose, stepB]` at 8 fps. A step moves the body up 1 pixel (bob). Facing up, down, or diagonal, one foot (the bottom 4 rows, one side of `footX`) lifts 2 pixels. Facing east or west, the feet spread 1 pixel apart and swap.
  - Orb: pixels with `b ≥ 200, g ≥ 170, r ≤ 210`.
  - Ghost: a half-size, map-pixel sprite (base = feet) for the stamp ghost, the drag ghost, and hit tests. `Sprites.get(characterType)` returns it.
- **Map data:** a character is an ordinary `map.objects` entry (`type: 'elf-wizard'`). Its x and y are its home. Details skips characters; they are never baked into the frame.
- **Actors** (runtime only, not saved): one per character object; moving the object restarts its actor there.
  - Feet are 3 pixels wide. Walkable: dry land, decks, and stepping stones, not `blocked` (tree bases, building footprints).
  - Wander (9 px/s): on a real path (`bigPaths`), a breadth-first search over path pixels picks a random spot 30–160 steps away. Off a path, it heads for the nearest real path within 80 steps, or else strolls 8–30 steps. It waits 1.5–5.5 s between walks. Routes keep every 3rd point. Stray path patches (under 300 pixels) are ignored: they trapped him.
  - Steering (14 px/s): slides along walls (tries x and y separately). Facing is one of 8 sectors from the movement vector.
  - Select picks a character before objects (`Actors.hit`). `Actors.pin` moves the object's home to where he stands, so a drag starts from there.
- **Characters** (`characters.js`) draws on the display canvas after the map image, every animation frame, back to front:
  - Shadow: a 3-row oval on the map grid, 22% black.
  - Sprite: 2 character pixels per map pixel, drawn at `zoom / 2` per pixel. Tinted by the daylight tint, except the orb, which pulses at full brightness. Two sparkles rise from the orb.
  - Occlusion: things whose base is lower on screen (tufts, trees, buildings) are run through `Details.drawThing` with a marking `put`. The marked pixels are then copied from the finished frame and drawn over the character, so clouds and tint match exactly.
  - At night or underground the orb lights the ground around his feet: `Fire.addLight`, cool `[0.9, 1.15, 1.5]`, radius 14, blocked by walls (visibility recomputed each frame since he moves).
  - The orb isn't visible in every pose (the north-west one hides it), so `CharacterArt` sets `hasOrb` if any pose shows it; the light stays on in every direction, at his feet when the orb is hidden. A character with an orb is also lit by it: its sprite tint is lifted toward daylight by `night × 0.75` (`ORB_SELF`), so he stays visible in total darkness.
- **Renderer loop:** while any character exists in Rendered view, it calls `Actors.sync`, `Actors.update(dt)` (dt capped at 0.1 s), and `Play.follow` every animation frame, and presents every frame. The map itself still redraws at `fps`.
- **Play** (`play.js`): a top-bar **Play** button or `P`. It steers the selected character, or the first one. WASD and the arrow keys are caught in the capture phase, so tool shortcuts don't fire. `Esc` or `P` stops. The camera pans to keep him in the middle 40% of the view.
- Not yet: characters in Export PNG, real walk frames (swap them into `frames` when the generator exports a walk animation).

- [x] Packed art, Characters toolbar section, stamp, select, move, delete.
- [x] Half-size full-detail drawing with tint, shadow, and front occlusion.
- [x] Fake 4-frame walk in 8 directions.
- [x] Wandering along paths, collision with water, trees, and buildings.
- [x] Play mode with keyboard steering and camera follow.
- [x] Orb glow and sparkles; light pool at night.

**Done when:** a wizard dropped near a path walks along it on his own, hides behind trees he passes, and can be steered with WASD after pressing Play.

### Phase 17: Caves, walls, and rooms

**Goal:** draw dungeon and cave maps (for example D&D battle maps) with rock walls, built rooms, and straight walls. A replica of the "Underdark Warren" map was made as `samples/maps/underdark-warren.json` (not in the repo).

- **New ground:**
  - **Cave floor** (Ground): two tones in noise patches, specks, rare faint cracks (`Random.cells` 14), more pebbles than dirt.
  - **Rock wall** (Walls): see the face rule below. The top is mottled `rockDark`/`rockMid`/`rockLight` from noise (size 10, thresholds 0.56 and 0.72), with the odd long crack (cells 16, `d2 - d1 < 0.7`, 35% of cells). Busier versions with lit cells looked like cobblestones.
  - **Stone wall** (Walls, built): the same face rule, with a 2-row brick face and a light cap row. The top is cap stones in 3-row courses.
  - **Wood floor** (Paths, built): 3-pixel planks, dark gaps, staggered ends every 11 pixels, two wood tones.
- **Wall face rule:** for a wall pixel, `k` = rows down to the first non-wall pixel (`faceDepth`). `k = 1` is the dark outline (bottom), 2–3 is the cliff face with vertical streaks, and 4 is the lit lip. Any other wall pixel touching non-wall gets the dark outline. In the 3/4 view this makes walls read as raised.
- **Contact shadow:** non-wall ground within 1 pixel of a wall is darkened ×0.72, and within 2 pixels ×0.86/0.93 (dithered). Uses `world.toWall`.
- **Built ground keeps its shape:** `warpLayers` keeps a pixel unwarped when it or its warp source is built, so rooms stay straight and rock never wobbles into them. Ragged grass never flips into built ground.
- **Walls are solid:** no scatter, flowers, or reeds on walls. Shore rules (beach, mud) skip walls and built ground. `Actors.walkable` refuses walls.
- **New tools:**
  - **Line** (`N`): drag a straight stroke of the material at brush thickness. Shift snaps to 45°.
  - **Rectangle** (`M`): drag a box, either Outline (thickness = brush size, for walls) or Filled. Shift makes a square. The rectangle mask is built directly (no canvas), so edges are exact.
  - Both are material tools (`Tools.MATERIAL_TOOLS`). A room = Stone wall outline + Wood floor fill, then a short line of floor for a doorway.
- **Underdark Warren replica:** made by tracing the source image (a 43 × 56 square grid at 28.5 image pixels per square → 430 × 560 map).
  - Dark ink density (blurred, teal river ink left out) gives the hatched wall bands.
  - The enclosed white regions were checked one by one: shaded ones are rock interiors, and the rest are floor, the pool, and the rooms.
  - Rock specks under 10–25 pixels are dropped (they're drawn pebbles), and the compass and scale legend are cleared.
  - Hand-placed: the striped tunnels and ramps (Gravel lines), the rooms (Stone wall boxes, Wood floor, a Cobblestone hall with an opening at the secret door), the river (traced by eye, width 16), boulders, mushrooms, a fairy ring, and the elf wizard.
  - Settings: no butterflies, birds, clouds, wind, reeds, lilies, or beach. Edge wobble 1.5.
  - Not replicated: arrow slits, the secret-door mark. Phase 20 added furniture, lights, and the Underground setting (ambient 0.2) to it.

- [x] Cave floor, rock wall, stone wall, wood floor, with wall faces and contact shadows.
- [x] Built ground stays exact; walls are solid for details and characters.
- [x] Line and Rectangle tools with Shift snapping and previews.
- [x] Underdark Warren replica map.

**Done when:** a room drawn with Rectangle (Stone wall outline, Wood floor fill) stays perfectly straight, rock walls read as raised masses, and the Underdark Warren map opens and matches its source layout.

### Phase 18: Bridges, reworked

**Goal:** a bridge is a straight span from bank to bank, wherever a painted path crosses a river. The first version guessed the bridge from the pixels left dry and looked stuck on: odd shapes on bends, planks running along the river, path blobs at the ends, and no water under it.

- **Rivers** always stamp water over paths now. Under a wide river (6+ pixels) each path pixel is noted in `world.crossing` (its path type).
- **Bridges.place** (`bridges.js`), one bridge per 8-connected blob of crossing pixels:
  - **Direction:** the main axis of the dry path pixels within the blob's reach + 10 pixels (covariance of their positions). If that axis runs nearly along the river (|dot| > 0.8 with the nearest river tangent), or there are under 12 path pixels, it goes straight across the river instead.
  - **Plank rows:** a walk that is mostly up/down uses rows (`rows: true`, planks along x); mostly sideways uses columns. Coordinates: `a` along the walk, `s` across it. Planks always follow pixel rows or columns, so they stay clean. Truly rotated bridges were tried first: at 45° they turned into a checkered mess.
  - **Shear:** each row is shifted by `slope` pixels per row, snapped to 0, 1/3, 1/2, or 1 (by angle). An angled path gives a parallelogram with straight stepped rails.
  - **Width:** the path's width (√(12 × minor variance)), times √(1 + slope²) for the shear, clamped 3–10, plus 1 rail on each side. Rope bridges max 5.
  - **Center line** goes through the middle of the path pixels; odd widths sit on a pixel center so edges are crisp.
  - **Length:** from the center, row by row in both directions, until 2 rows in a row are fully dry; the bridge ends `OVERHANG` (2) rows past the last wet row. No bank within 34 rows, or the map edge, means no bridge.
  - Pixels: `post` (rail and end), `rail`, `end`, `deck`. `world.span` = 2 on rails, 1 elsewhere.
- **Styles** (`bridgeStyle`): **From the path** (cobble and flagstone → stone, others → wood), Wooden, Stone, Rope.
  - Wood: planks in 3-row courses with a dark gap row, two tones, light rails with dark posts every 5 rows, dark end beams, a 1-row dark side face.
  - Stone: brick deck with mortar, light parapets with dark joints every 4, a 2-row face.
  - Rope: plank every 2nd row with water showing between, rope rails, dark posts at the ends, no face.
- **Drawing** (per frame, right after Water): the water under a bridge stays water (flow, bands, and glints are untouched), so it never leaves a dry strip. Baked once per rebuild: each bridge pixel's color; the side face below any bridge pixel whose pixel below is water; and a shadow on the water, offset by the light (`(round(−cos a × 1.5), max(1, round(sin a × 2.5)))`), multiplied by `[0.6, 0.66, 0.76]`.
- **Walking:** `Actors.walkable` treats `span` 1 as floor and 2 as wall. `bigPaths` includes bridge decks.
- No tufts, flowers, scatter, or reeds on bridges; no fish jumping within 3 pixels.

- [x] Straight bridges at any angle with plank rows and shear.
- [x] Wood, stone, and rope styles, by path type or setting.
- [x] Water flows under; side face and shadow.
- [x] Characters cross on the deck and can't step off the rails.

**Done when:** a sand path crossing a winding river at an angle gives a straight slanted wooden bridge that rests on both banks, and a cobble road gives a stone one.

### Phase 19: Grid and tabletop export

**Goal:** use maps on a virtual tabletop (Foundry, Roll20) or in print, with a square grid and a ruler.

- Module `editor/tabletop.js`, **Tabletop**.
- **Grid overlay:** settings `grid`, `gridSize` (10 map pixels = 5 ft), `gridFeet`, `gridOffsetX/Y`, `gridOpacity`. Drawn on the display canvas after the characters, as 1-pixel black lines at `gridOpacity`. Hidden when a square is under 4 screen pixels. Top-bar **Grid** button and `H`; the button and the settings checkbox stay in sync (`App.syncGrid`).
- **Measure tool** (`U`): see 8.2. Distance = `hypot(dx, dy)` squares between the start and end squares' centers, × `gridFeet`, rounded to 2 decimals (the user asked for this over the 5e rule, where a diagonal counts as one square). The label moves to the left of the end square near the view's right edge.
- **Export:** see section 9. The grid is drawn into the export with `fillRect` lines (2 pixels at 10× and up, else 1), on the same positions as on screen.

- [x] Grid overlay with size, offset, strength.
- [x] Measure tool with feet and squares.
- [x] Export at pixels per square, with an optional grid.

**Done when:** the Underdark map shows its 43 × 56 grid, the ruler reads 30 ft for six squares in a line and 21.21 ft for three diagonal ones, and export at 100 px per square gives a 4300 × 5600 image.

### Phase 20: Dungeon lighting and furniture

**Goal:** dark dungeons lit by torches, braziers, candles, and magic, with light that stops at walls, plus furniture for rooms.

- **Underground** setting (`underground`, `ambient` 0.15): the tint is `[ambient × 0.85, ambient × 0.9, min(1, ambient × 1.2)]` whatever the hour, so `darkness` is high and every light turns on.
- **Lights** (Fire): kinds with `radius`, flame size, smoke, and flicker: campfire 30, brazier 28, torch 26, candle 10. (Torch light in 5e reaches 20 ft bright plus 20 dim, about 40–80 map pixels; 26 reads well without flooding the map.)
  - **Light buffer:** each light adds `a = (1 − d)^1.5 × power` per pixel, combined as `amount += a × (1 − amount)`, with colors weighted by `a`. `applyLights` then bands the amount (0.9, 0.6, 0.3, with ±0.04 checkerboard dither) and blends `frame / tint × color` in once. Applying pools one after another blew overlaps out to yellow.
  - **Walls block light:** `Fire.visibility` casts a ray from the light to every pixel in its radius; a wall pixel between them blocks it, and the first wall pixel is lit (so wall faces glow). A light standing on a wall (wall torch) shines from the first open pixel below it (up to 6). Static lights cache the mask; the orb recomputes it each frame.
  - Flames: campfires and braziers use the 3-column flame; torches a 2–3 pixel flame that leans; candles a 1-pixel flicker. Braziers smoke a little.
- **Props** (`props.js`): sprites from text templates, where each letter is a palette key (`o` trunkDark, `d` woodDark, `w` wood, `L` woodLight, `x` rockOutline, `s` stone, `r/R/q` cloth, `g` gold, and so on). The bottom row is the base.
  - **Furniture:** table (sometimes a candle, mug, or plate on top), bed (blanket red, blue, or green), chest, barrel, crate, bookshelf (random book colors and gaps), rug (fringe, border, diamond).
  - A **stairs** stamp was removed at the user's request: stairs only make sense with height levels (section 12). Objects of a type that no longer exists stay in the map data but aren't drawn.
  - **Lights:** torch (on a pole), wall torch (place it on a wall's face), brazier, candles.
  - Footprints block walking and details; rugs, wall torches, and candles block nothing.
  - **Flat sprites** (rugs) sort before everything else, so things stand on them, and never cover characters.
  - Anchors: `light: [x, y, kind]`.
- The Underdark Warren map got a furnished hall and bedroom, wall torches, scattered cave torches and braziers, a campfire, and Underground on.

- [x] Underground tint and light buffer.
- [x] Light blocked by walls.
- [x] Torch, wall torch, brazier, candles, with flames.
- [x] Table, bed, chest, barrel, crate, bookshelf, rug, stairs.

**Done when:** in the Underdark map a wall torch lights its room but not the next one, overlapping lights stay warm instead of turning white, and a rug lies under a table.

### Phase 21: Animals

**Goal:** simple animals that make a map feel lived in.

- Module `render/animals.js`, **Animals**: sheep, deer, rabbit, chicken, duck, in an **Animals** toolbar section (registered with `Types.addObject`). They are map objects (home = x, y); like characters, they are runtime only and persist across rebuilds by object id.
- **Art:** text templates per frame (stand, two walk frames, graze), facing right, mirrored when facing left. Rabbits hop (a lifted frame). Colors are fixed in the module, not in the palette.
- **Behavior** (per drawn frame, using the animation time): wait 1–5 s (grazing now and then), then walk to a random spot within `roam` of home (`speed` px/s). Ducks only swim (water at least 1 pixel from the shore, not under bridges); the rest need open dry ground (`Actors.walkable`). Shy animals (deer 24, rabbit 16, chicken 10, duck 12) run 2.5× faster away from a character that comes that close.
- **Drawing:** into the frame after Details (so they're tinted and lit like the rest), with a 1-row shadow on land or a ripple on water while moving, then things in front of them are redrawn (`Details.drawThing`).
- Editor: `Tools.canPlace(x, y, type)` wants water for ducks and dry ground for the rest. Select picks animals after characters (`Animals.hit`, `Animals.pin`).

- [x] Five animals with walk and graze frames.
- [x] Wandering near home, ducks on water, shy animals flee.
- [x] Stamp, select, move, delete.

**Done when:** sheep graze near a cabin, ducks paddle on the lake, and a deer bolts when the wizard walks up.

### Phase 22: Doors

**Goal:** a door stamp that only goes into a gap between two walls.

- Module `render/doors.js`, **Doors**. `door` is in the Furniture section.
- **Fitting** (`Doors.fit(world, x, y)`): from the clicked (non-wall) pixel, look left and right for wall within 24 pixels (a wall running left-right), and up and down (a wall running up-down). On that line, the wall thickness is the run of rows (or columns) where both sides are wall, at most 12. The narrower valid gap wins. No gap means no door ("Doors go in a gap between two walls"); the stamp ghost shows the fitted door, or a red ring.
- **Spot:** the object snaps to the middle of the gap, on the wall's bottom row (front view) or the gap's bottom row (edge-on). On rebuild Details fits it again from the world, so it follows wall edits and disappears if the walls are erased.
- **Look:** in a wall running left-right, the door is seen from the front: a dark frame and lintel, vertical planks, a gold handle, filling the gap through the wall's thickness. In a wall running up-down it's seen edge-on: a light plank edge with dark sides down the wall's middle, with stone jambs at both ends (a 2-pixel version was invisible on wood floors).
- **Opening:** while a character or animal is within 10 pixels of its middle, the open sprite is drawn instead (the frame stays, the leaf swings into the room). Doors never block walking or light.

- [x] Fit, snap, ghost, and error when there's no gap.
- [x] Front and edge-on doors; open when someone is near.

**Done when:** a door clicked into a gap of a stone room fills it exactly, clicking open floor is refused, and the wizard walking through opens it.

### Phase 23: Height levels

**Reworked in Phase 24:** Raise and Lower now paint slopes, not cliffs; Flatten makes cliff-edged terraces; rivers keep their own level. The stairs, faces, drawing, walking, and clicking below still apply.

**Goal:** hills, plateaus, and cliffs, with stairs where paths climb them and waterfalls where rivers fall.

- **Data:** `map.elevation` (0–7), saved and undoable like the other layers. Painted with any material tool using the **Height** materials: Raise (+1 per stroke), Lower (−1), Flatten (set 0). `op: 'add' | 'set'` on the material. The eraser can reset height; "Everything" does too. Plan view gets lighter by level, with dark contour lines.
- **Resolve:** `world.level` is warped like the ground. `Height.resolve` (after Bridges): `lift = level × levelHeight` (default 6 pixels a level).
- **Stairs** (`stairs` setting): from each path pixel at the foot of a cliff (a 4-neighbor path pixel ≥ 3 pixels higher), a straight run of steps goes away from the cliff along the path: lift = top − d × slope. Slope 1 when the cliff top is to the north (steps face the viewer, each row shows a 1-pixel riser), 0.5 when it's to the south (the slope faces away, so it must be gentle to stay visible), 1 sideways (a diagonal staircase). Spreading the stairs in every direction turned a path crossing at the cliff's foot into stripes.
- **Drawing raised maps** (`Height.compose`, per frame):
  - Water, bridges, and flat things (lilies, stones, rugs: `Details.drawFlat`) are drawn into the flat frame first, which is then copied to a buffer.
  - Rows are drawn from the top (back) to the bottom (front). Each pixel goes to `y − lift`; below it, its front face fills the `lift − lift(row below)` pixels down to where the next row starts. The map's bottom edge counts as level 0. No holes are possible.
  - Things and animals are drawn right after the row below their base (a 1-row lag, because tufts and rocks draw 1 pixel below their base), shifted up by their base's lift. So a cliff in front covers what's behind it.
  - **Faces:** falling water where both rows are water (streaks moving down; foam at the bottom row and churning foam on the water below, `world.fall`), stair risers (stone, wood, or dirt by path type), rock cliffs under stony ground, earth cliffs (dirt with streaks and strata, a grass lip on top) under the rest.
  - Baked into the static ground (`Height.shadeEdges`): a dark rim where a raised pixel's left, right, or upper neighbor is lower, a lit lip on cliff tops, shade at the foot of cliffs (×0.7, then a dithered row), a light nose on each stair.
- **Characters** are drawn raised by the lift under their feet; their occlusion uses `world.depth` (any pixel drawn by a row in front of them covers them, cliffs included). Fires, smoke, lights, and windows carry their object's `lift`. The camera follow accounts for it.
- **Walking:** `Height.canStep(world, i, j)`: a step may change lift by at most 2 pixels (`CLIMB`), so stairs work and cliffs (a level is 4+ pixels) block. Used by `Actors.walkBy`, the route search, `bigPaths`, and animals.
- **Clicking:** in Rendered view, `Input` maps the pointer through `Height.unproject` (the map row drawn under it, from `world.srcY`), so painting, stamping, and selecting hit what you see. Overlay previews (brush ring, stroke, ghosts, selection boxes) are drawn lifted.
- Cost: about 3 ms per frame for 200 × 150, so roughly 20 ms at 600 × 338.
- Not yet: fish, butterflies, rain splashes, and the area-selection highlight are still placed in flat map coordinates (slightly off on raised water or ground); lights aren't blocked by cliffs; side faces of plateaus aren't drawn (the 3/4 view only shows south faces).

- [x] Elevation layer, Height materials, plan shading.
- [x] Raised drawing with cliff faces, edge shading, and correct overlap of things and characters.
- [x] Stairs on paths, waterfalls on rivers.
- [x] Walking blocked by cliffs, open on stairs.
- [x] Clicks and previews follow the raised ground.

**Done when:** a raised hill with a cobble road over it shows stone stairs on both sides, a river falls off its edge, the wizard walks up the stairs but not up the cliff, and a tree below the cliff is hidden behind it.

### Phase 24: Slopes, terraces, lowered rivers, pause

**Goal (from the user):** smooth mountains instead of cliffs; cliffs only from flattening; rivers cut gorges instead of falling; waterfalls made by lowering a river; characters that don't move on their own; a way to stop the animation.

- **Raise / Lower** (+1 / −1 to `elevation`, 0–7) always make slopes, and clear any terrace they touch. Stroke again over the middle to build a mountain.
  - `Height.slopes`: start from `level × levelHeight` (times 0.85–1.15 of large noise, so mountains aren't perfect cones). Then `spread` (a two-pass chamfer transform) lowers every pixel so it's at most `SLOPE` (0.5 px) above its neighbors; raised ground rises gently from its edge. Two box blurs (radius 2) round the tops and feet. Lakes and the sea are seeded at 0, so the ground slopes down to the shore and the water stays put; rivers are seeded "infinitely high" so they don't pull the ground down.
  - **Gorges:** next to a river the ground is capped at `wall + 1 px per pixel away` (`GORGE`), where `wall = max(3, levelHeight / 2)`. The cap is measured from ground level (0), not from the water, so beside a lowered river the hill still runs right up to the cliff edge (measuring from the water flattened a band of ground beside lowered rivers). So a river through a mountain runs between a short cliff and a steep slope on each side, and never falls. A full-height wall hid the whole river: in this view the near (south) bank covers as many rows of water as it is high.
  - Hillshading (baked in `shadeEdges`): light from the north-west, `(dhill/dx + dhill/dy) / (4 × SLOPE)` with a ±0.1 checker dither, in up to 3 steps of 8% either way. Terraces and water get none.
  - Drawing: a front face of 1–2 px (a hillside facing the viewer) repeats the pixel above it instead of drawing a cliff, so slopes look stretched, not striped. Steps are at most 1 px on slopes, so they're always walkable.
- **Flatten** (`terrace` layer, `op: 'flat'`) sets the area to the whole level of the ground where the stroke starts (`Tools.levelAt`, from the drawn lift). The terrace ignores the slopes around it, so its edges are cliffs: cut into a mountain, it leaves a wall behind; on lower ground, it stands up as a plateau. Paths over its edges get stairs. The eraser's Height option clears elevation and terraces.
- **Lower river** (tool `drop`, `W`, under Height): stores the snapped river point in `river.drops`. `Rivers.markDrops` gives each path point a level (−1 after each drop going downstream); each stamped pixel takes the level of the path point straight across from it, so a drop is a straight line across the river. The ground keeps its height, so the banks of the lowered stretch are cliffs. Water that drops toward the viewer shows a waterfall face; any drop gets foam (`markFalls` checks all 4 neighbors). The overlay draws a white line across the river at each drop while the tool is active or the river is selected.
- **Bridges** over a lowered river or a gorge: deck pixels over water take the lift of the bank they start from (`liftBridges`, a breadth-first fill from the deck's land ends). The face below a deck is 2 dark rows; below that, what's under the bridge shows through.
- Plan view uses the drawn lift: lighter per level, darker below 0, a contour line at each whole level, and a heavy line along cliffs. The status bar shows "level 1.5" (or "flat, level 2").
- **No wandering:** `Actors.update` only moves the steered character; the rest stand still. `wander.js` keeps `Wander.step`, `plan`, `bigPaths`, and `search`, with a note on how to bring them back. Animals still wander.
- **Pause** (top-bar button, `K`): `Renderer.setPaused` freezes time and skips frame drawing (remembered per browser in `localStorage`, `pixel-map-editor:paused`). Water, fire, weather, animals, and life all stop. Play mode still redraws while a character walks.
- Limits: a lowered river narrower than its drop mostly hides behind its south bank (that's the projection: widen the river or lower Height per level). A lowered river flowing into a lake or the sea meets it with a step, because those stay at level 0. Stepping stones in a lowered river can't be reached from the banks.

- [x] Raise and Lower paint slopes with hillshading; lakes are left alone.
- [x] Flatten makes cliff-edged terraces at the start point's level.
- [x] Rivers cut gorges through raised ground, without waterfalls.
- [x] Lower river makes a waterfall and lowers the river downstream, with cliff banks; bridges stay at bank height.
- [x] Characters only move in Play mode; the wander code was kept in `wander.js` (later removed from the repo).
- [x] Pause and resume the animation.

**Superseded in Phase 25:** smooth slopes with hillshading didn't read as hills (the user couldn't see the slope), so hillsides are now drawn as stepped ledges. The slope math above still makes the height; only how it's cut and drawn changed.

**Done when:** a stacked Raise makes a shaded mountain with a river in a visible gorge; a flatten stroke from its top leaves a flat ridge with cliffs and stairs where a path crosses; clicking a river makes a waterfall with cliff banks below it and the bridge downstream stays at bank height; the wizard stays put until Play; Pause freezes the water.

### Phase 25: Stepped ledges

**Goal:** hills you can actually see. The user compared three styles in `dev/labs/height-lab.html` (next to the `pixel-*.html` labs): A, stepped ledges; B, painted shading with rock and snow; C, mountain sprites. They picked A.

- **Lift:** hillside ground uses the smooth slope height (Phase 24) cut down to whole ledges: `floor(hill / step) × step`, with `step = max(2, round(levelHeight / 2))`, so 3 pixels by default. Two ledges per level. Lakes, rivers, terraces, and gorges work as before.
- **Walking:** `Height.canStep` allows a change of up to `CLIMB` (2) anywhere, or one ledge between two hillside pixels (`isLedge`: both `soft`, difference ≤ `step`). Terrace edges, gorge walls, and lowered-river banks stay cliffs. Paths crossing a ledge still get stairs (a ledge is 3 = `EDGE`).
- **Ledge faces** (`drawRow`, `ledgeColor`): the ground's own color at ×0.72 for the first row, ×0.62 below it (faint streaks), and ×0.42 for the dark foot line. Bigger drops still get cliff, waterfall, or stair faces; 1–2 pixel steps stretch the pixel.
- **Shading** (`shadeEdges`): hillside ground is 3% lighter per ledge up (at most 30%). On ledges: lip ×1.22 on the front edge, ×1.12 on the back edge, ×1.08 on the west edge, ×0.8 on the east edge, ×0.78 at the foot of the ledge behind. Cliffs keep the dark rim, lit lip, and foot shade. The hillshading from Phase 24 is gone.
- Plan view draws cliff lines only where walking is blocked (`!canStep`), so ledges get the thin contour lines, not cliff lines.

- [x] Lab page comparing the three styles.
- [x] Hills drawn as ledges, lighter per step.
- [x] Ledges walkable, cliffs not.

**Done when:** a stacked Raise reads as a stepped hill at a glance, the wizard walks up it ledge by ledge, and a terrace edge still stops him.

### Phase 26: Chasms, turned furniture, and the Canyon Hideout

**Goal (from the user):** recreate a cave-hideout battle map in the editor, and build every object it needs that was missing. The replica was made as `samples/maps/canyon-hideout.json` (not in the repo).

- **Chasm** (Walls section, `WATER.CHASM` on the water layer): the bottomless dark around a cave.
  - Resolve (`markChasms`, right after the warp) moves it off the water layer: `world.chasm` = 1, `water` 0, `ground` `CHASM`. So nothing treats it as water, and erasing it shows the ground painted under it.
  - A path painted across a chasm becomes a bridge: path pixels with the drop on both sides (left and right, or up and down, within 24 pixels) become `crossing` pixels over the chasm. `Bridges.place` builds them like river bridges. On a chasm the walk direction comes from the path itself, not a river. `Bridges.gap(world, i)` (water or chasm) replaces every "is water" test in bridges and lifted decks.
  - Ground: near-black with a faint noise haze and rare specks (`chasm`, `chasmMid`, `chasmStar`). Lift is `−CHASM_DEPTH` (12), so `world.raised` is on. The far wall below every edge is drawn as 12 rows of rock (lit lip, streaks) that fade into the dark (`Height.chasmWall`). Cliff rims and lips come from `shadeEdges` as for any cliff.
  - Not walkable (except bridge decks). No scatter, flowers, or objects there ("Objects can't be placed over a chasm"). Light passes over it. The eraser's water option is now "Water and chasms".
- **Tile floor** (Paths, built): 4-pixel checkered tiles (`tileLight`, `tileDark`), stone stair risers.
- **Raised wooden decks:** a wood floor on a terrace gets log piles as its front face (a dark beam, then a row of round log ends: `Height.logPiles`). A bridge across lower ground is a strip of wood floor on terrace level 1; keep paths off its edges so no stairs climb onto it.
- **Turning:** props marked `turn` in `Props.INFO` (bench, long table, bed, bedroll, weapon rack, fence, planter, rug) can be turned a quarter. Use the Turn button (stamp and select options) or `Q`. The object stores `turn: 1`, and `Sprites.get(type, seed, scale, turn)` caches it separately. A turned prop uses its own template (`TURNED`, or orientation-aware code), or else its pixels transposed (`turnPx`: columns become rows, the right edge becomes the base). The footprint of a turned prop is its height.
- **New objects:**
  - Buildings: tent (70% round, 30% ridge; 70% canvas, 15% purple, 15% blue) and well.
  - Furniture: long table (length by size, set with plates, mugs, bread, and maybe a candle), round table, bench, stool, bedroll (flat), sacks, weapon rack, round rug (flat; a quarter of them are stone floor medallions), bathtub, altar (with a candle light), fence (length by size), hay bale, and planter.
  - Lights: lantern (a new light kind, radius 34, no smoke) and oven (a stone dome with a fire, brazier light). Wall torches only light a half-pool below the wall, so big rooms need lanterns to be lit through.
  - New palette keys: canvas, purple, hay, tiles, chasm.
- **Flagstone gaps** grow no grass when the map is underground.
- **Canyon Hideout** (`tools/build_hideout.py <reference image>`): 414 × 600 at 0.4 map pixels per reference pixel.
  - The void is the reference's dark pixels (blurred brightness under 20, specks filled, blobs under 150 pixels dropped), plus a hand-placed crevice under the long bridge. Rock rims 2–5 pixels wide line it.
  - The canyon, ridges, trail, pond, rooms, and openings are polygons and boxes in reference pixels. Rooms get 4-pixel stone walls (a wall between two levels takes the higher one). The keep has three levels, so stairs form between them.
  - Objects are placed by hand. Their looks (bed and rug cloth, tent shape and color) come from seeds found with a port of `Random.makeRng`.
  - Settings: underground, ambient 0.35, no butterflies, birds, or clouds, fireflies over the canyon grass.

- [x] Chasm material, chasm bridges, chasm far walls.
- [x] Tile floor; log piles under raised wooden decks.
- [x] Turn for furniture (button and `Q`).
- [x] Tent, well, long table, round table, bench, stool, bedroll, sacks, weapon rack, round rug, bathtub, altar, fence, hay bale, planter, lantern, oven.
- [x] Canyon Hideout replica map and its builder.

**Done when:** a path painted across a chasm becomes a railed bridge over the drop, a bench turns with `Q`, and the Canyon Hideout opens and matches its reference's layout.

### Phase 27: One builder for any map, and the Desert Fortress

**Goal (from the user):** one Python file that can make any map, then a new map like a desert-fortress reference, adding whatever it needs.

- **`tools/build_map.py <spec.json> [reference image]`** writes `maps/<name>.json` from a map description. Everything is in reference pixels, scaled by `scale`. Steps: `base` → `trace` (optional: a material wherever the reference is darker than a brightness, for voids) → `paint` (shapes in order) → `rooms` → `finish` (more painting) → pocket fill → `objects`.
  - Shapes: `rect`, `oct` (cut corners, `corners`), `poly`, `circle`, `ellipse`, `line` (`width`), `union`, and `minus` on any shape.
  - Paint options: `material` (any editor material id, or `nowater` / `noscatter`), `level` (terrace), `wobble` (ragged edge), `patches` (noise patches only), `onlyOn` (only over given ground), `rim` (a band round a material).
  - Rooms: floors with a level each, walls `thickness` pixels round them (a wall between levels takes the higher one), then `openings`. After `finish`, small spaces shut in by rooms and walls (up to `pocket` map pixels) become wall, so no pits show between rooms.
  - Objects: `["type", x, y, {options}]` or `{"type", "at": [[x, y], …], options}`. Options: `scale`, `turn`, `seed`, `look` (bed and rug cloth, round rug `stone`, bedroll color, tent `"color shape"`), found with a port of `Random.makeRng`.
  - Material ids and values are read from `constants.js`, so the builder follows the editor.
  - `settings` and `colors` go into the map as they are.
- **New ground:** Dry earth (Ground; pale, patchy, cracked: `Random.cells` 9) and Slate floor (Paths, built; 6-pixel square slabs with a lit top-left edge).
- **New objects:** palm (Objects; ringed curved trunk, drooping fronds that sway), rubble (Objects; broken blocks, size by scale), statue, pillar, brewing vat, anvil (Furniture). New palette keys: dry earth, slate, copper, iron.
- **Setting:** "Grass between flagstones" (`flagMoss`, on by default).
- **Desert Fortress** (`samples/maps/specs/desert-fortress.json`): 600 × 343 at 0.4.
  - The keep stands on a plateau (level 1, a rock ridge round it) above dry earth. The keep is on level 2 and the throne dais on level 3, so stairs form at the gates and the dais.
  - Thick ramparts round the courtyard, a walled garden with gravel paths and flowers, rock-ringed craters outside. Sandstone colors.

- [x] General map builder with specs.
- [x] Dry earth, slate floor, palm, rubble, statue, pillar, vat, anvil.
- [x] Desert Fortress map.

**Done when:** `python3 tools/build_map.py samples/maps/specs/desert-fortress.json` writes a map that opens in the editor and matches its reference's layout.

### Phase 28: Random landscapes

**Goal (from the user):** an option to create a map randomly, with a few biome presets.

- **New map dialog:** "Start with" lists Blank (Dirt, Grass) and Random landscape (one entry per biome). A dice button rerolls the seed. The same seed and size always make the same landscape.
- **`Generate.landscape(width, height, seed, biome)`** (`js/model/generate.js`) paints the ordinary layers, so the result is a normal map to keep painting. Coverage comes from quantiles of seeded noise, so every seed gets about the same share of water, hills and forest.
  - **Outdoors:** a height field gives water (the lowest share, small puddles dropped) and hills (`elevation` in bands). Then each biome's ground and scatter, an optional river edge to edge (valleys lowered beside it), a path across it (bridge), a camp beside the path on dry level ground near the middle, and loose objects (about one per 5000 pixels).
  - **Meadows and forest:** grass and dirt, lakes, forest with pines up high, bushes at forest edges, flowers, rocky hilltops, river, tent camp.
  - **Islands:** sea round the edges, sand beaches, forest inland, palms on the sand, hut camp.
  - **Desert:** sand and dry earth, cliff-edged mesas (terrace level 2), oases with grass and palms, rocky ground, gravel track, tent camp.
  - **Snowy pines:** Winter season and snowfall, pine forests, lakes, river, cabin camp.
  - **Cave:** rock with one connected cave (noise, majority smoothing, biggest region kept), gravel, pools, rocky patches, a camp in the roomiest spot, torches and braziers along the walls, mushrooms. Underground, ambient 0.3.
- Small maps may get no camp: there's no room that fits.

- [x] Generator and five biomes.
- [x] New map dialog options and seed dice.

**Done when:** picking a biome in New map makes a different, believable landscape for each seed, and the same seed makes it again.

### Phase 29: Dungeons, villages, random houses, tracks

**Goal (from the user):** a dungeon generator; villages, but with houses that are all different ("not in numbers, but everything should be random"); footprints and wading.

- **Natural things at the characters' scale** (after the buildings; the user asked for every other object to follow): `Sprites.GROW` multiplies each type's size setting when its sprite is built (tree and pine 2.2, palm 2, bush and rock 1.6, log 1.7, stump 1.4, mushrooms 1.5, fairy ring 1.6, tent 2, campfire 1.7), so the Style sliders keep their ranges and old maps grow too; a tree now stands about as tall as a one-floor house. Forest, pine, rock and bush spacing (`Details.scatterCell`) grows by the same factors. Mushrooms have domed caps 5–7 wide. The campfire has a wider ring of stones and a bigger fire (`Fire` kind flame 4: five columns, taller; the GL pass replays the same code). Dead trees are 24–40 tall with a trunk 4–5 thick, boats 20–42 long with a taller mast, headstones chest-high (9 wide, 12–20 tall) on a bigger mound. The generators give them room: camps clear 46 around and in front, graves stand 14 × 18 apart, moored boats 24–28 from their pier, woods keep 24 from village buildings. **Trees** have a lobed crown instead of a ball (`crownClumps`: a core, a ring of leaf clumps (the Leaf clumps setting), one on top set to a side, one or two low boughs) over a trunk that forks into two limbs. **Object gallery:** `dev/map-editor/objects.html` shows every object animated by the real stages on the GL frame (one map, a band per toolbar section, furniture and lights on a wooden floor, boats and ducks on ponds, name labels over it; Time, Wind, Zoom, New looks, Pause; `?seed=`), and the characters and monsters walking on the spot through their eight facings. Use it to review any change to an object.
- **Furniture and lights at the characters' scale** (the last of the objects): every template in `Props.ART` is redrawn larger and with more to it (a barrel 8 × 11 with a lid and two hoops, a crate 10 × 12 with braces, a chest 10 × 9 with iron bands and a lock, a table 17 × 12, a bed 13 × 22 with a headboard and pillows, a bench 15 × 6, a bookshelf 18 × 21 with three shelves, a weapon rack 17 × 18, a statue 9 × 24, a pillar 8 × 22, a vat 17 × 18, an oven 17 × 15, a tub 19 × 12, an altar 15 × 12 with tall candles, a rug 23 × 14, a long table 33 × 14 on trestles set with plates, mugs and loaves). The well is 19 × 24 with a roof on two posts, a windlass and a bucket; the cauldron 15 × 14. Lights: a standing torch 13 tall with an iron basket, a wall torch, a brazier 9 × 10 on a tripod, a lantern 5 × 8, candles on a dish; `Fire` gives torches three flame columns and braziers five. **One-square props** (barrel, crate, chest, brazier, pillar, anvil, stool, statue) stay within 10 px across with a footprint of 5 or less, because the game stands them in one 10 px square (`Squares` counts blocked pixels in each square's middle). Fences keep their 11 px segments but are 9 tall. The dungeon is refitted: walls 4, corridors 14, doorways 10 (wider than a character), rooms 28–104 × 26–78, one per 9000 px, and every furnishing offset rescaled; the village square (radius 20–26), the castle's well and drill yard, and the cave camp have more room.
- **Animals at the characters' scale:** the five templates in `Animals.ART` are redrawn (sheep 13 × 9, to a person's waist; deer 17 × 16 with antlers, to the shoulder; rabbit 8 × 8; chicken 7 × 8; duck 10 × 6 with a white neck ring), each with stand, two walk frames and a graze frame, and they move further and faster to match (speed, roam and shy in `TYPES`). **What stands in front** of an animal or a character is no longer a fixed 30 × 24 px window: `Animals.covers(thing, at)` uses the thing's own sprite box, so they pass behind tall buildings and wide trees correctly; the GL sprites pass and `Characters` use the same test. The **ridge tent** is an A-frame seen from its open end (a triangle of cloth with the doorway and its pole, the two roof slopes running back, a guy rope and peg either side) instead of a flat panel. Note for parity tests: `GlParity.full` advances the animals between its CPU and GL passes, so with animals on the map compare the per-stage rows (`GlParity.stages`), or call `full` twice at the same time.
- **House** (Buildings, `Houses.build`): every seed is a different house, at the characters' scale (redone after the user asked for houses that look more like buildings): a storey is 12 px, a door 6 × 10, a window 7 × 7, and a house is 28–52 px wide (3–5 squares). A house rolls a style: cottage (plaster or stone, mostly thatch), timber frame (often two floors, the upper one jettied over a stone, plaster or brick ground floor), stone, brick, clapboard (painted boards), log, adobe (mud, a flat roof behind a parapet). Shapes: a ridge roof seen from the front (a sliver of the back slope, a ridge cap, courses down to eaves that overhang and shade the wall), a front gable (narrow houses), a flat roof, and on wide houses a gabled bay standing in front (an L plan). The front is composed (`planFront`): the door (in the wall or the bay), windows spaced evenly along the free stretches of wall, upper windows over the lower ones and over the door, dormers over windows, a timber frame's studs between openings. Extras: a chimney on the ridge or a stack up the front wall (stone or brick), a porch, a lantern (lights up at night), shutters, flower boxes, ivy, a barrel, woodpile or bush at the wall, worn earth at the door. Windows, the chimney and the lantern are anchors. The parts live in `HouseKit` (js/render/houseKit.js): everything is drawn lit from the left into a pixel grid and the sprite is mirrored when the light comes from the right; snow covers the roofs. A scale under 0.9 always gives a one-floor house. `house-sheet.html` shows a sheet of generated houses (`?n`, `?seed`, `?scale`, `?snow=1`, `?light=45`). The older small parts in houses.js (`drawWall`, `drawWindows`, `slopedRoof`, `frontGable`, `leanTo`, `stack`…) still build the landmarks and structures, which are not at the new scale yet. **Facings:** a house (and a cabin) can face four ways, `Houses.FACINGS` = front, right, back, left, stored as the object's `turn` (0–3; `Props.turns(type)` says how many ways a type turns: 4 for these, 2 for furniture, fences and ruined walls). The view never changes, so each facing is its own drawing of the same house (same seed, same materials and colors): turned to the back it shows its long wall with windows and no door; turned left or right it shows its gable end (narrower: we see how deep it is), the roof running back 10–13 rows, and a small porch on a post at the edge its door is on (`HouseKit.sidePorch`). A sprite that gets mirrored for light from the right is planned facing the other way first. The Stamp and Select tools' Turn (Q) goes round the four. Villages face each house toward its road: front above a road, back below it, end on beside a lane (where its lot is narrower). Landmarks still only face the front. `house-sheet.html?turn=0,1,2,3&same=4` shows each house four times.
- **Dungeon** biome: up to one room per 4000 pixels, joined by L-shaped corridors (a spanning tree plus a few loops). Stone walls 3 thick round every floor, rock beyond. Where a corridor meets a room's wall, the opening is narrowed to a 6-pixel doorway and most get a door. Rooms get a kind: hall (long table, benches, pillars, braziers), barracks (beds, chests), library (shelves, table, candles), storage, shrine (altar, statues, rug), armory, treasure, ruin. Wall torches on every back wall. Underground, ambient 0.3.
- **Village** biome: a cobbled main road (across the river, when there is one), one or two lanes, a cobbled square with a well and stalls away from the river. Houses fitted to the road's edge on both sides, with barrels, crates, planters and chickens round them. Sheep pens (fences with a gate) and hay fields out in the open; woods and flowers away from it all. A house takes a lot 58 wide and 56 tall beside a road (`LOTS.house`); where that doesn't fit it is built smaller (`HOUSE_LOTS`: scale 0.8, then 0.65, one floor), so small villages still get houses.
- **Tracks:** characters and land animals leave prints every 2 pixels, alternating sides, in sand (fade in 30 s), snow (60 s, blue-grey) and mud (45 s). A print is a dent with a lit rim, and flattens the tufts and flowers round it. Characters can wade up to 2 pixels from the shore: their feet sink out of sight and rings spread behind them. Nothing is saved.

- [x] Random houses.
- [x] Dungeon and Village biomes.
- [x] Footprints and wading.

**Done when:** a village's houses all look different, a dungeon's rooms are furnished by kind and joined by doors, and walking the wizard over a beach and into the water leaves prints and rings.

### Phase 30: Random villagers

**Goal (from the user):** characters drawn in code like the houses, every seed a different person, and villages that have them.

- **Villager** (Characters): `Villagers.make(seed)` draws a 32 × 32 person from the front, back and side (west is the side mirrored; the diagonals use the front and back), outlined like the sprite characters, and `CharacterArt.addGenerated` builds walk frames and the ghost from it per seed (cached, 400 per family). `CharacterArt.get` and `ghost` take the seed.
- A role sets the leanings: townsfolk, farmer (straw hat, pitchfork, basket), smith (leather apron, hammer, stout), baker (linen apron, kerchief or bonnet), merchant (vest, feathered cap, sack), elder (robe, grey hair, beard, walking stick), guard (tabard, helmet, spear), monk (plain robe, hood), child (short). On top: skin (six tones, jittered), hair (bald, short, long, ponytail, bun, curly, braids; seven colors), beard or moustache, top and skirt or trousers in jittered dyes, belt, shoes, hat, blush, and what they carry (also lantern, bucket, broom).
- **Strolling:** villagers wait 2–7 s, then walk at 6 px/s along a route to a spot within 45 px of home. The route comes from a breadth-first search over pixels their feet fit (8 directions, no corner cutting, no cliffs, no water), up to 6000 pixels; the goal is a reached path pixel 3 times in 4 when there are any. A leg that is blocked or takes over 2 s drops the route. They stop while the animation is paused. Play mode steers the first non-villager unless one is selected.
- Villages put a villager by most houses and a few round the square.

- [x] Villager generator and strolling.

**Done when:** a crowd of villagers shows no two alike, and a new village has people walking its roads.

### Phase 31: Village landmarks and dungeon monsters

**Goal (from the user):** more generated buildings for villages (tavern, temple, smithy, watchtower, windmill), and monsters drawn in code that live in the dungeons.

- **Landmarks** (Buildings, `Landmarks.build`), each different per seed, at the characters' scale like the houses (redone with them): drawn from `HouseKit`'s walls, roofs, windows and doors plus their own parts, lit from the left and mirrored for light from the right. A `scale` under 1 makes a smaller one (the village generator uses 0.8 and 0.65 where a full lot doesn't fit).
  - **Tavern:** a big house from the house planner (`Houses.makePlan` with overrides: 44–56 wide, two floors, a wide arched pair of doors, always a chimney), plus a lantern either side of the door, a sign on an iron bar at one end (a painted board with one of eight pictures, swinging in the wind), barrels at the other end, a bench. Built small (a scale under 0.9) it has one floor and hangs its sign from a post beside it.
  - **Temple:** a hall 44–58 wide with tall stained-glass lancets under an unbroken ridge roof, and a bell tower at one end (a belfry with its bell, and a spire, pyramid or battlements with a gold cross, orb, star or spike). The door, under a rose window, is in the tower, or (on wider halls, about half the time) in a gabled porch standing out from the middle of the hall.
  - **Smithy:** a workshop (door, window, ridge roof) with an open shed beside it under a lean-to roof on a post: a stone forge of glowing coals under its hood and chimney (a torch light and smoke) whose glow warms the back wall (`HouseKit.tint`), a rack of tools (hammer, tongs, horseshoe), an anvil on its block, a barrel of water, a heap of coal.
  - **Watchtower:** a stone or brick tower 21–27 wide and 46–58 tall on a wider foot, with a door, arrow slits (the top one lit at night), string courses, and battlements (often a torch) or a pointed roof; or a wooden lookout on four braced legs with a ladder, a platform and a hut with an open band. Most fly a flag that waves.
  - **Windmill:** a tower 25–31 wide at the foot that narrows as it rises (`HouseKit.keep` cuts the wall to the taper), shaded round (lit on the left, dark on the right), in stone, smooth render, boards or brick, 52–62 tall, with a door, small windows, sometimes a wooden stage, a rounded cap, and sails of radius 30–36 that turn (`sails.grid`: the lattice's spacing).
  - **Hut** (was in sprites.js): a round mud hut 20–30 wide with a doorway between posts (a striped cloth hangs in it), a small window that lights up, clay pots by the door, and a tall dome of thatch bound with two ropes, smoke rising from its top. **Cabin**: a house whose style is always log (`Houses.build(…, { styles: ['log'] })`).
  - The castle and the other structures (Phase 33) are at this scale too, drawn from the same parts; the old small parts are gone (only `Houses.ivy` remains, for the ruined wall).
  - `dev/map-editor/house-sheet.html?type=tavern,temple,smithy,tower,windmill,hut,cabin` shows a sheet of them.
  - Sprites can now carry several lights (`anchors.lights`).
- **Villages** get a tavern on the square, a smithy and (on maps over 30 000 pixels) a temple a little way along the roads, a watchtower where the main road leaves the village (over 50 000 pixels), and a windmill out in the fields. Fitting follows the houses (`roadside` takes the building's half width and height). A matching villager stands by each: townsfolk at the tavern, the smith, a monk or elder, a guard (`Villagers.roleOf` finds a seed for a role). Lots are sized for the new buildings (`LOTS`: half width and height; `SMALL_LOTS`: the smaller sizes tried when a full lot doesn't fit, so small villages still get a tavern and a smithy); the windmill is sited before the houses and only its tower needs clear ground; full-size houses go in first and smaller ones fill the gaps.
- **Monsters** (new Monsters section; `Monsters`): skeleton (bone tint, glowing eyes, helmet, horns, hood or crown, plate or rags, sword, axe, spear or bow, shield), goblin (green skin, long ears, nose, tooth, rags or vest, pot helmet, hood, bone or feather, dagger, club, spear, sling or a burning torch), slime (color, size, eyes, a shine, something stuck inside, a crown now and then, some glow), cultist (robe and trim, peaked or round hood, face in shadow, bone mask or skull, glowing eyes, chest sign, candle, dagger, glowing staff or book). Pixels with alpha 254 stay bright at night; a family member can carry a light (`light`), which lights the floor round it and the character itself.
- **Walking per family** (`CharacterArt.addGenerated` `walk`): villager 6 px/s within 45 px, preferring paths; skeleton 5 / 28; goblin 8 / 36; slime 3 / 16; cultist 4 / 22. Some monsters patrol (35 %, 50 %, 10 %, 25 %): 2.5 times the range, short waits, heading for the furthest reachable spots. A character standing where its feet don't fit (dropped against furniture) walks out to the nearest free spot first.
- **Dungeons** pick who lives there (undead, goblins, or a mix) and put 1–4 in 7 rooms out of 10 by room kind (cultists in shrines, skeletons in armories, slimes in ruins and storerooms…), clear of furniture and doorways, plus a few in the corridors. **Caves** get goblins round the camp and slimes by the pools.

- [x] Tavern, temple, smithy, watchtower, windmill.
- [x] Landmarks in villages, with matching villagers.
- [x] Skeleton, goblin, slime, cultist; per-family walking and patrols.
- [x] Monsters in dungeons and caves.

**Done when:** a new village has a tavern on its square and a windmill turning in the fields, and a new dungeon has goblins or skeletons walking its corridors and cultists by the altar's candles.

### Phase 32: Who's on a new map

**Goal (from the user):** a new random map has no people, monsters or animals unless asked for, with full control over what gets placed.

- **New map dialog → "Who's on the map"** (shown for random landscapes): People, Monsters, Animals and Hero, each with a switch that starts **off**. Under each line it says where they turn up in the chosen landscape, or "None in this landscape" (switch disabled: no people or animals in caves and dungeons). Turned on, a group shows:
  - **How many:** Few (×0.5), Usual, Many (×1.75), Crowded (×3).
  - **Which kinds:** people by role (townsfolk, farmers, children, bakers, smiths, merchants, elders, guards, monks); monsters (skeletons, goblins, slimes, cultists); animals (sheep, chickens, deer, rabbits, ducks). A spot meant for a kind that's off (the smith at the smithy, cultists at the shrine) gets one of the kinds that are on.
  - **Movement:** people stroll or stand still; monsters wander and patrol, wander only, or stand guard; animals roam or stay put. Saved on the objects as `still: 1` and `patrol: 0`, which Actors and Animals obey.
  - **Hero:** the elf wizard on the village square, at the camp, or in the dungeon room nearest the edge (which then gets no monsters).
- **Where, per landscape:** village (villagers by houses, on the square and at the landmarks; chickens by houses, sheep in the pens, ducks on the river, deer and rabbits by the woods; monsters out of town); meadows, islands, desert, snowy (folk round the camp and travelers on the path; deer, rabbits, a sheep flock on grass, ducks on lakes and the river, chickens at the camp; monsters away from the camp, goblins in bands, slimes near water); cave (goblins round the camp, slimes by pools, a few more in the dark); dungeon (by room kind, plus corridors).
- `Generate.landscape(w, h, seed, biome, life)`: everything living is placed in a last pass (`g.later`) from its own random numbers, so the land, buildings and furniture are the same for a seed whatever is turned on. `Generate.where(group, biome)` gives the dialog its text.

- [x] Dialog controls, off by default.
- [x] Life pass with amounts, kinds and movement for every landscape.

**Done when:** a new map is empty of life by default, and turning on "Monsters: slimes only, Crowded, Stand guard" fills the same dungeon with many slimes that don't move.

### Phase 33: Castle, swamp, harbor town, graveyard

**Goal (from the user):** four new places to generate: a castle, a swamp, a harbor town, and a graveyard with ruins.

- **New sprites** (`Structures`, a different one per seed):
  - Keep, gatehouse, wall tower and banner. Each picks a coat of arms first (`heraldryOf(seed)`), so the castle generator finds seeds that match and the whole castle flies one set of colors. The gatehouse leaves its passage (`GATE` px) open to walk through and blocks only its towers.
  - Hut on stilts (leaning, mossy, a glowing window, a stovepipe, a ladder, herbs and a skull), dead tree, cauldron (green brew over a small fire).
  - Lighthouse: bands or plain stone, a gallery, a lamp room and dome, sometimes a keeper's cottage. Its beam turns at night: `sprite.beam` → `world.beams` → `Details.addBeams` adds pools of light along it.
  - Boat (rowboat, or sailboat with a swaying sail): `sprite.bob` makes it ride up and down and rock.
  - Headstone (round, cross, slab, obelisk, Celtic, broken; leaning, mossy; a mound with flowers or a candle), crypt, ruined wall and iron fence. The last two can be turned.
- **Biomes** (`places.js`, through `Generate.addBiome(key, { name, make, where, settings, colors, season })` and `Generate.kit`):
  - **Redone at the characters' scale** (with the houses and landmarks; `HouseKit` parts, lit from the left and mirrored): the keep (58–70 wide, three or four floors of 13, round corner turrets, a 12 × 14 pair of doors, banners 7 × 22), the gatehouse (two round towers 17–21 wide and 46–56 tall, a 17-tall arch over a passage `Structures.GATE` = 13 wide), wall towers (19–23 wide, 44–56 tall), the banner (28–34 tall), the lighthouse (25–31 wide at the foot, 66–84 tall, a 22-wide keeper's cottage), the crypt (35–45 wide, columns 3 wide, an 8 × 12 door) and the hut on stilts (24–30 wide on 12–18 tall stilts; the hut is drawn upright in its own grid, then sheared onto the platform). The castle generator's walls are 7 thick, the keep stands 34–42 into the yard, and a small castle's towers, gatehouse and keep are built smaller (`scale` down to 0.65, the keep down to 0.6 when it would rise off the map). The curtain walls themselves are still the flat painted Stone wall. Dead trees, boats, headstones, the cauldron, ruined walls and the iron fence are unchanged.
  - **Castle:** stone walls round a courtyard, with towers on the corners and along long walls, a gatehouse over the road in, the keep at the back, a smithy, barracks and maybe a temple along the walls, a well, a training yard, banners and torches. A moat on bigger maps, crossed on planks. Fields and woods outside, and houses along the road on the biggest maps. Guards stand at the gate and walk the walls (`patrol: 1` on a person makes a patroller).
  - **Swamp:** murky pools with mud banks, reeds and lilies, thickets, dead trees on the banks and in the shallows, a boardwalk across on planks, and the witch's hut by the water with her cauldron. Fog, fireflies, swamp colors.
  - **Harbor town:** the sea along the bottom, a beach, a cobbled quay with piers (planks over the water), boats moored and out at sea, a lighthouse on the headland, and a street, lanes, houses, a tavern and maybe a smithy and temple. Village house placement is now shared (`lots`). Gulls overhead.
  - **Graveyard and ruins:** an iron-fenced graveyard with rows of headstones, gravel paths, crypts and a lantern-lit gate, the ruined chapel (broken walls, pillars, the altar), and odd bits of wall in the fields. Autumn and fog, at dusk with time passing.
- **Skeletons that rise:** a monster with `rise: 1` lies under the ground by day and climbs out after dark, earth flying, and sinks back at dawn (`Actors` `a.up`, drawn sunk by `Characters`).
- **New settings:** Fog (Weather), Gulls (Time of day, under more).
- Paths by the sea keep their stones instead of turning to beach sand, so a quay meets the water.

- [x] Thirteen new sprites in the toolbar.
- [x] Castle, swamp, harbor town and graveyard in the New map dialog, with Who's on the map for each.
- [x] Fog, gulls, the lighthouse beam, bobbing boats, rising skeletons.

**Done when:** a new graveyard at dusk fills with skeletons climbing out of their graves as night falls, and a harbor at night has its lighthouse beam sweeping over boats bobbing by the piers.

### Phase 34: Real walking for villagers and monsters

**Goal (from the user):** better walking animations for the characters drawn in code.

- Each family draws a standing pose and 4 walking poses instead of having a walk faked from one picture (`make` returns `{ stand, walk }` per facing; `CharacterArt.buildDir` keeps `stand` apart from `frames`). The hand-made elf wizard keeps the faked walk.
- **The cycle** (`Villagers.kit` `WALK`): a stride, passing, the other stride, passing. Striding, the leading foot is planted and the other heel lifts. Passing, the body rides a pixel higher (the legs straighten) and the swinging foot is off the ground. Arms swing against the legs, and what's in the hand swings with it.
  - **Front and back:** feet rise and fall.
  - **Side:** both legs swing from the hip, the far leg and far arm drawn darker behind.
  - Skirts, robes and hems swing with the stride.
- **Per family:** villagers, skeletons and goblins stride as above (skeleton bones, goblin clawed feet, weapons and shields follow the hands). Cultists glide: they rise and fall, the hem swishes, and a foot shows under it. Slimes hop: squash, stretch up, off the ground, come down.
- **Pace:** frames advance at 1.1 × the walker's speed per second (5 to 10 frames a second), so slow walkers don't scurry and fast ones don't skate.

- [x] Standing and walking poses for villagers, skeletons, goblins, cultists, slimes.
- [x] Frame rate follows walking speed.

**Done when:** a villager seen from the side swings its legs and arms as it walks, and a slime hops instead of sliding.

---

## 12. Out of scope for now

- **Fog of war:** parked by the user. The design so far is in [`fog-of-war.md`](fog-of-war.md).

- Height is built (Phases 23–24). Still open there: cliffs blocking light and line of sight, snow on high peaks, a Mountains scatter area for world maps, and a map resize dialog (proposed, waiting for the user).
- Big buildings and towns (Phase 12 adds small cabins and huts only).
- Multiple layers or levels.
- Mobile and touch support (the layout should not break on small screens, but painting is designed for a mouse).
