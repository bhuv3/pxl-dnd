# Reusing the map editor

Back to [overview.md](overview.md).

The game draws everything through the Pixel Map Editor's modules in `../map-editor/`. This doc lists what the game needs from them, so a session doesn't have to read the editor's 1 200-line plan (`../map-editor/plan.md`) or its code to start. When something here is unclear, that plan is the full spec.

**Status:** checked against the editor's code on 2026-11-01. Re-check an API before relying on it if the editor has changed since.

---

## 1. How the game loads editor code

**Recommended (open decision):** load the editor's scripts straight from `../map-editor/js/` with plain `<script>` tags. One source of truth: fixes and new art in the editor show up in the game. Relative paths work both on `file://` and through the test server at the repo root.

**Rules:**
- The game never edits editor files as a side effect of game work. If the game needs a hook in an editor module (for example "draw extra lights before `applyLights`"), add a small, generic one, keep the editor working exactly as before, and record it in `../map-editor/plan.md` and in section 6 below.
- Don't load the editor's UI (`js/ui/*` except `prefs.js`/`icons.js` if needed, `js/editor/tools.js`, `input.js`, `areas.js`, `main.js`). `ui/files.js` autosaves to `pixel-map-editor:autosave` and would overwrite the user's work.

## 2. Load order

The editor's order (`../map-editor/index.html`), core first:

```
core:    random, grid, colors
model:   constants, map, history, generate, places
(ui:     prefs, icons)           loaded here in the editor; render doesn't use them
render:  rivers, resolve, characterArt, villagers, monsters,
         assets/characters/elf-wizard.js,
         props, houses, landmarks, structures, sprites, details, ground, water,
         bridges, height, daylight, life, fire, weather, actors, characters,
         animals, tracks, doors, renderer, preview
editor:  viewport, areas, tools, overlay, tabletop, input, play
ui:      status, settings, files, thumbs, library, dock, panel, command, dialogs
main.js
```

Everything up to `doors.js` in `render/` is usable on its own. **`renderer.js` is tied to the editor:** it calls `Viewport`, `Status`, `Play`, `Tabletop`, and `Overlay`; `characters.js` calls `Viewport`. So the game must either:

- **A.** load `viewport.js` and `tabletop.js` (both useful: zoom/pan and the grid) and give tiny stand-ins for `Status`, `Play`, `Overlay`, or
- **B.** write its own small frame loop (`GameRenderer`) that calls the render modules in the editor's per-frame order (section 4).

**Decided in Step 1: B.** `js/stage.js` (`Stage`) runs the editor's per-frame order itself, with hooks for floor marks, extra lights, and screen-space drawing. A would have needed stand-ins for five editor modules and a `#zoomLabel` element, and the editor's `Characters` can't take pose offsets or flashes, so the game draws its own (`Figures`). Stage loads every render module up to `doors.js` but not `renderer.js` or `preview.js`, and never calls `Actors` (so `Actors.list()` is empty: doors don't open for game figures yet).

## 3. Module cheat sheet

Each module is a top-level `const`. Only what the game is likely to use:

| Module | File | Useful for the game |
|---|---|---|
| `Random` | core/random.js | `hash`, `makeRng(seed)`, `valueNoise`, `noise`, `noise1D`, `cells` |
| `Grid` | core/grid.js | `distanceField`, `floodFill`, `maskFromPath` |
| `Colors` | core/colors.js | palette defaults, `hexToRgb`, `darken` |
| `Types` (`Types.GROUND`, `Types.WATER`…) | model/constants.js | type ids; `Types.isWall(g)`, `Types.isPath(g)`, `Types.isBuilt(g)`, `Types.addObject` |
| `MapModel` | model/map.js | `create(w, h, seed, Types.GROUND.X)`, `clone`, `serialize`, `deserialize` |
| `Generate` | model/generate.js | `landscape(w, h, seed, biome, life)` for random maps (dungeon, cave, village, castle, swamp, harbor, graveyard…) |
| `Fire` | render/fire.js | `visibility(world, x, y, radius)` → `{ mask, R, n }` (rays blocked by walls); `beginLights(world)`, `addLight(world, x, y, power, color, radius, vis)`, `applyLights(frame, world, tint)`, `drawGlow`, `nightOf` |
| `Daylight` | render/daylight.js | `tint`, `underground`, `darkness`, `apply` |
| `CharacterArt` | render/characterArt.js | `SIZE`, `DIRS` (8 facings), `add`, `addGenerated(key, name, color, make, opts)`, `get`, `walk`, `ghost`, `onReady` |
| `Villagers` | render/villagers.js | The game's heroes are drawn with its `kit` (Step 2b). `make(seed)`, `roleOf(seed)` (folk, farmer, child, baker, smith, merchant, elder, guard, monk), `kit` (shared drawing parts, `OUTLINE`, the `WALK` cycle). Villagers carry no light, even with a lantern. Guards without a spear: nothing drawn in the top 3 rows of `make(seed).east.stand` |
| `Monsters` | render/monsters.js | `skeleton`, `goblin`, `slime`, `cultist`: `make` functions per family |
| `Actors` | render/actors.js | runtime characters: `sync`, `list`, `get`, `update(dt, world, steer, live, night)`, `hit`, `walkable`, `fits`, `walkBy` |
| `Characters` | render/characters.js | `draw` (half-size sprites, shadow, front occlusion), `addLights` (orb and carried lights) |
| `Props` | render/props.js | furniture and light sprites: `TYPES`, `build`, `canTurn` |
| `Doors` | render/doors.js | doors fitted into wall gaps; open when someone is near |
| `Renderer` | render/renderer.js | `init`, `setMap`, `rebuildNow`, `requestPresent`, `setView`, `getMap`, `getWorld`, `getMapCanvas`, `flashMessage`, `setPaused` |
| `Viewport` | editor/viewport.js | zoom, pan, screen ↔ map coordinates (`Viewport.state.zoom`, `panX`, `panY`) |
| `Tabletop` | editor/tabletop.js | `drawGrid`, `squares`, grid presets |

## 4. The frame (what draws when)

From `../map-editor/plan.md` section 6.2; `Stage.drawFrame` follows it. The game's hooks slot in where marked ([effects.md](effects.md) section 8).

1. Copy the static ground layer.
2. Water. 3. Bridges (Stage skips bridges, animals, tracks, and height for now).
   → *`floor` hook: ground marks (scorch) here*
4. Details and objects sorted by y (on raised maps: `Height.compose`). 5. Animals.
6. Smoke. 7. Fish, butterflies, birds. 8. Clouds, rain, snow.
9. Day/night or underground tint (`Daylight.apply`).
10. Lights: `Fire.beginLights`, fires, beams, → *`lights` hook: figures' orbs and lanterns, effect lights* →, `Fire.applyLights`.
11. Flames and lit windows at full brightness (`Fire.drawGlow`), fireflies.
12. `putImageData` to the map canvas, drawn to the display at zoom with no smoothing, offset by the camera shake; then the grid.
    → *`screen` hook: mark embers, figures, effects, popups (later the dice tray)*

In the editor the map redraws at the `fps` setting (about 11). Stage redraws the whole map every animation frame, because effects and their lights move every frame (the lab's map is small: 150 × 110).

## 5. World data the game reads

`Renderer.getWorld()` after a rebuild (full table: `../map-editor/plan.md` section 5.1):

- `w`, `h`, `ground` (final; `Types.isWall`), `water`, `blocked` (tree bases, building and furniture footprints).
- `fires` (each with `kind` and a cached wall `vis` mask), `things` (placed objects and details).
- `lift`, `raised` (height levels; flat maps skip all height drawing).

**Scale:** 10 map pixels = 1 square = 5 ft. Character sprites are 32 × 32 character pixels, drawn at half size (16 map pixels), feet at the bottom center.

**Map objects:** `{ id, type, x, y, seed, scale, turn?, still?, patrol?, rise? }`. Characters and monsters are objects whose `type` is a character family key; `x, y` is their home (feet).

## 6. Hooks added to the editor for the game

Step 1 needed no changes to the editor. The GL move of the map frame added these small, generic ones (the editor's behaviour is unchanged):

- `render/stages.js`: `Stages.run(ctx, { list })` and `Stages.capture(ctx, names, list)` take an optional list of stages instead of `Stages.LIST`. `Stage` passes its own list (static, water, floor, things, smoke, life, weather, tint, lights, glow), so the game's frame is the editor's pipeline code, not a copy.
- `gl/passes/lights.js`: if the pass context has `extraLights(world, night)`, it is called inside the recorder in place of `Characters.addLights` (and the pass runs by day too). `Stage` passes its `lights` hooks (figures' orbs, effect lights) through it.
- `gl/passes/floor.js`: the GL pass for the game's `floor` stage. It draws `ctx.floorPoints(world)`, a flat list `[x, y, r, g, b, alpha, ...]`; `Marks.floorPoints` makes it, and `Marks.drawFloor` (the CPU path) draws the same list. A floor hook with a `.points` property can be drawn by GL; one without runs on the CPU.

`Stage` uses WebGL2 when it works (`?gl=0` turns it off, `Stage.setGl(on)` switches at runtime) and keeps the CPU pipeline as the reference and fallback. Raised maps use the CPU (the game's list has no height step). `Stage.usingGl()` and `Stage.getFrameTexture()` are for a compositor; `Stage.lightAt` reads the GL frame back at most twice per frame, however many figures ask. Parity page: `gltest.html` ([overview.md](overview.md) section 6).

## 7. Gotchas (from the editor's testing notes)

- Test server: `python3 serve.py` in the repo folder (port 8765).
- Browser cache: refetch every script with `fetch(src, { cache: 'reload' })` after editing, then reload.
- Wait about 500 ms after `location.reload()` before touching app objects.
- Screenshots lag a frame: call `Renderer.rebuildNow()` before checking a render.
- `requestAnimationFrame` runs at about 1.5 fps in the in-app browser: step animations by hand to check them.
- Module objects are top-level `const`s: they can't be hot-swapped with `eval`; reload instead.
- **Autosave:** `Renderer.setMap` in the editor can end up autosaved by `Files`. The game must not load `ui/files.js`; when testing the editor itself, back up `pixel-map-editor:autosave` first and restore it after.
- Quick test maps: `MapModel.create(w, h, seed, Types.GROUND.CAVE_FLOOR)`, fill `ground` with rectangles of `Types.GROUND.STONE_WALL`, push `objects`, then `Renderer.setMap(m)`; set `settings.underground` for a dark dungeon.
