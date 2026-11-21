# pxl-map

A paint-style pixel map editor. You paint the plan (grass here, a river there, a forest over there), and code draws it as detailed, animated pixel art. It handles water, beaches, rivers and bridges, hills and cliffs, houses and castles, villagers, animals, weather, day and night, and lights. It draws with WebGL2 and falls back to the CPU.

It's plain HTML, CSS and JavaScript, with no dependencies and no build step.

## Running

Open `map-editor/index.html` in a browser. Or serve the folder, which the developer pages need:

```bash
python3 serve.py
```

Then open http://localhost:8765/map-editor/. The server is Python's `http.server` with caching turned off, so a reload always picks up your edits.

Your map autosaves in the browser's `localStorage`. **File → Save** downloads it as a `.json` file, **File → Open** loads one, and **File → Export PNG** saves a picture.

## Layout

```
map-editor/        The editor: index.html, css/, js/, assets/ (packed character art)
docs/map-editor/   plan.md (the spec and design notes), gl-renderer.md (the WebGL renderer), fog-of-war.md (parked)
dev/map-editor/    Developer pages: gltest.html (GL vs CPU parity), objects.html (every object), house-sheet.html
dev/labs/          The first experiments the renderer grew from (grass, water, trees, height styles)
tests/map-editor/  Node tests: inctest.js (partial redraw equals full redraw), resolvehash.js (render fingerprints)
tools/map-editor/  Map builders (build_map.py from a JSON spec) and pack_character.py (character PNGs to JS)
art/map-editor/    Source PNGs for the packed elf wizard
serve.py           Local no-cache server (port 8765)
```

`samples/` is in `.gitignore`. Put your own maps in `samples/maps/` (and big ones in `samples/maps/big/`), and the tests and the GL test page will use them too.

## Tests

```bash
node tests/map-editor/inctest.js
```

```bash
node tests/map-editor/resolvehash.js --save fingerprints.txt
```

Run `resolvehash.js --check fingerprints.txt` after a change to confirm the rendering didn't change. For GL parity, open http://localhost:8765/dev/map-editor/gltest.html?audit=1 while serving.

## Forks

[pxl-dnd](https://github.com/bhuv3/pxl-dnd) is a D&D-style game built on this editor's modules.

## License

[MIT](LICENSE)
