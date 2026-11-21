// Saving, opening, autosave, and PNG export.
const Files = (() => {
  const AUTOSAVE_KEY = 'pixel-map-editor:autosave';
  let autosaveTimer = null;

  // Downloads a blob as a file.
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // File-friendly version of the map name.
  function slug(map) {
    return (map.name || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map';
  }

  // Saves the map as a .json file.
  function save(map) {
    const json = JSON.stringify(MapModel.serialize(map));
    download(new Blob([json], { type: 'application/json' }), slug(map) + '.json');
  }

  // Reads a .json map file and passes the map to onLoad.
  function open(file, onLoad) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onLoad(MapModel.deserialize(JSON.parse(reader.result)));
      } catch (e) {
        Renderer.flashMessage('That file isn’t a map this editor can open');
      }
    };
    reader.readAsText(file);
  }

  // Saves to browser storage a second after the last change.
  function scheduleAutosave(map) {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(MapModel.serialize(map))); } catch (e) {}
    }, 1000);
  }

  // The autosaved map, or null.
  function loadAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      return raw ? MapModel.deserialize(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  }

  // Exports the current rendered frame, scaled up with sharp pixels, optionally with the grid.
  function exportPng(map, zoom, grid, name) {
    const src = Renderer.getMapCanvas();
    const out = document.createElement('canvas');
    out.width = Math.round(map.width * zoom);
    out.height = Math.round(map.height * zoom);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, out.width, out.height);
    if (grid) Tabletop.drawExportGrid(ctx, map, zoom);
    out.toBlob(blob => download(blob, `${slug(map)}-${name}.png`), 'image/png');
  }

  // Asks for a size (pixel scale, or pixels per grid square for virtual tabletops) and the grid, then exports.
  function exportDialog(map) {
    const s = map.settings;
    const zooms = [1, 2, 3, 4, 6, 8];
    const current = Math.min(8, Math.round(Viewport.state.zoom));
    const [cols, rows] = Tabletop.squares(map);
    const sizes = zooms.map(z => [`z${z}`, `${z}× (${map.width * z} × ${map.height * z})`])
      .concat(Tabletop.PRESETS.map(([pps, what]) => [`g${pps}`, `${pps} px per square, ${what} (${Math.round(map.width * pps / s.gridSize)} × ${Math.round(map.height * pps / s.gridSize)})`]));
    const el = Dialogs.open(`
      <h2>Export PNG</h2>
      <p>Saves the current frame with sharp pixels. For a virtual tabletop, pick a size per grid square:
        this map is ${cols} × ${rows} squares of ${s.gridFeet} ft (${s.gridSize} map pixels each).</p>
      <div class="field"><label for="exZoom">Size</label>
        <select id="exZoom">${sizes.map(([v, l]) => `<option value="${v}" ${v === 'z' + current ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="warn" id="exWarn"></div>
      <div class="row check"><input type="checkbox" id="exGrid" ${s.grid ? 'checked' : ''}><label for="exGrid">Draw the grid</label></div>
      <div class="dialog-actions"><button id="exCancel">Cancel</button><button id="exGo" class="primary">Export</button></div>`, () => {});
    const pick = el.querySelector('#exZoom'), warn = el.querySelector('#exWarn');
    const zoomOf = v => v[0] === 'z' ? +v.slice(1) : +v.slice(1) / s.gridSize;
    const check = () => {
      const z = zoomOf(pick.value);
      warn.textContent = Number.isInteger(z) ? '' : `Map pixels won’t all be the same size at ${Math.round(z * 100) / 100}×. A square size that divides ${pick.value.slice(1)} evenly keeps them sharp.`;
    };
    pick.addEventListener('change', check);
    check();
    el.querySelector('#exCancel').addEventListener('click', Dialogs.close);
    el.querySelector('#exGo').addEventListener('click', () => {
      const v = pick.value, grid = el.querySelector('#exGrid').checked;
      Dialogs.close();
      exportPng(map, zoomOf(v), grid, v[0] === 'z' ? v.slice(1) + 'x' : v.slice(1) + 'px-per-square' + (grid ? '-grid' : ''));
    });
  }

  return { save, open, scheduleAutosave, loadAutosave, exportDialog };
})();
