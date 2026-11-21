# pxl-dnd

A D&D-style game (`dnd-game/`) built on the pxl-map editor (`map-editor/`, whose modules the game loads from `../map-editor/js/`). This repo is a fork of pxl-map, which is its `upstream` remote. See [README.md](README.md) for the layout and how to run it.

- **Game work:** read [docs/dnd-game/overview.md](docs/dnd-game/overview.md) first; it lists the topic docs to read for each task.
- **Editor work:** read [docs/map-editor/plan.md](docs/map-editor/plan.md). Make editor changes in pxl-map and pull them in with `git pull upstream main`; never edit `map-editor/` only here.
- **Keep the app folders runtime-only.** `map-editor/` and `dnd-game/` hold only files their pages load. Docs go in `docs/`, developer or test pages in `dev/`, Node tests in `tests/`, scripts in `tools/`.
- **Never commit maps or saves.** `samples/` is in `.gitignore`.
- Rules come from the SRD 5.2 (CC BY 4.0). Keep the credit line on every page that shows rules text, and never add text from books outside the SRD.
- Serve with `python3 serve.py` (port 8765, no-cache).
