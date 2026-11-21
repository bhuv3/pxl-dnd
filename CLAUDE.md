# pxl-map

A pixel map editor (`map-editor/`). See [README.md](README.md) for the layout and how to run it.

- Read [docs/map-editor/plan.md](docs/map-editor/plan.md) (the spec) before changing the editor; for GL work also read [docs/map-editor/gl-renderer.md](docs/map-editor/gl-renderer.md).
- **Keep `map-editor/` runtime-only:** it holds only files `index.html` loads. Docs go in `docs/`, developer pages in `dev/`, Node tests in `tests/`, scripts in `tools/`, art sources in `art/`.
- **Never commit maps or saves.** `samples/` is in `.gitignore`; personal maps stay there.
- Serve with `python3 serve.py` (port 8765, no-cache). The editor autosaves to `localStorage`, so test `index.html` on another origin, or back up `pixel-map-editor:autosave` first and restore it after.
- The pxl-dnd game is a fork of this repo that loads `map-editor/js/`. Keep module APIs stable, or note changes in the plan.
