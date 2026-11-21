// Starts the app and wires the top bar and keyboard shortcuts.
const App = (() => {
  const $ = id => document.getElementById(id);

  const SHORTCUTS = [
    ['B', 'Brush'], ['L', 'Lasso'], ['N', 'Line (Shift: snap to 45°)'], ['M', 'Rectangle (Shift: square)'], ['G', 'Bucket fill'], ['E', 'Eraser'], ['R', 'River'], ['T', 'Stamp'], ['V', 'Select'],
    ['1 – 0', 'Pick a material'], ['[ ]', 'Brush size, or size of the selection'],
    ['R (object selected)', 'New look for the object'], ['Q', 'Turn the selected object or the next stamp (furniture)'],
    ['Shift + click', 'Select the ground under water or an area'],
    ['U', 'Measure distance'], ['H', 'Grid on / off'],
    ['P', 'Play: walk a character'], ['K', 'Pause or resume the animation'], ['W', 'Lower river (waterfall)'], ['WASD / arrow keys', 'Walk (while playing)'],
    ['Delete', 'Delete the selection'], ['Esc', 'Clear the selection'],
    ['Space + drag', 'Pan'], ['Middle mouse', 'Pan'], ['Wheel', 'Zoom'],
    ['Tab', 'Rendered / Plan view'], ['F', 'Fullscreen map'], ['Ctrl/Cmd + Z', 'Undo'], ['Ctrl/Cmd + Shift + Z', 'Redo'],
    ['Ctrl/Cmd + S', 'Save map file'], ['Ctrl/Cmd + O', 'Open map file'],
    ['Ctrl/Cmd + K', 'Search tools, materials, objects, settings, and actions'], ['/', 'Filter the library'],
    ['\\', 'Show or hide the library'], ['Shift + \\', 'Show or hide settings'], ['?', 'Keyboard shortcuts'],
  ];

  // Shows a map in the editor and resets history.
  function loadMap(map) {
    History.reset();
    Tools.state.selection = null;
    Renderer.setMap(map);
    Panel.renderAll();
    syncGrid();
    autosave();
  }

  // Creates a fresh map from the New map dialog options: blank ground, or a random landscape of a biome.
  function newMap(opts) {
    loadMap(opts.biome ? Generate.landscape(opts.width, opts.height, opts.seed, opts.biome, opts.life)
      : MapModel.create(opts.width, opts.height, opts.seed, opts.startGround));
  }

  function autosave() { const m = Renderer.getMap(); if (m) Files.scheduleAutosave(m); }

  // Undo or redo, then re-render.
  function undo() { if (History.undo(Renderer.getMap())) Tools.changed(); }
  function redo() { if (History.redo(Renderer.getMap())) Tools.changed(); }

  // Switches between Rendered and Plan view.
  function setView(v) {
    Renderer.setView(v);
    document.querySelectorAll('#viewToggle button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  }

  // Makes the map fill the screen, or goes back. Where the browser refuses real fullscreen,
  // the map fills the window instead (the bars and panels hide).
  function toggleFullscreen() {
    const el = $('viewport');
    const real = document.fullscreenElement || document.webkitFullscreenElement;
    if (real) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (document.body.classList.contains('map-only')) { setMapOnly(false); return; }
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    const result = request ? request.call(el) : null;
    if (!request) setMapOnly(true);
    else if (result && result.catch) result.catch(() => setMapOnly(true));
  }

  function setMapOnly(on) {
    document.body.classList.toggle('map-only', on);
    onFullscreenChange();
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement) || document.body.classList.contains('map-only');
  }

  // Refits the map to the new size: edge to edge in fullscreen, with a margin otherwise.
  function onFullscreenChange() {
    const on = isFullscreen();
    $('btnFullscreen').classList.toggle('active', on);
    Input.updateCursor();
    Viewport.state.margin = on ? 0 : 16;
    Viewport.state.fitIsMin = on;
    Viewport.requestFit();
    setTimeout(() => { if (Viewport.state.fitPending) { Viewport.fit(); Renderer.requestPresent(); } }, 250);
  }

  // Shows or hides the tabletop grid.
  function toggleGrid() {
    const map = Renderer.getMap();
    if (!map) return;
    map.settings.grid = !map.settings.grid;
    syncGrid();
    autosave();
    Renderer.requestPresent();
  }

  // Grid button and settings checkbox follow the map setting.
  function syncGrid() {
    const map = Renderer.getMap(), on = !!(map && map.settings.grid);
    $('btnGrid').classList.toggle('active', on);
    const box = $('set-grid');
    if (box) box.checked = on;
  }

  // Stops or restarts the animation.
  function toggleAnimation() {
    Renderer.setPaused(!Renderer.isPaused());
    syncAnimation();
  }

  // The animation button shows what a click will do.
  function syncAnimation() {
    const paused = Renderer.isPaused(), label = paused ? 'Resume the animation (K)' : 'Pause the animation (K)';
    $('btnAnimate').innerHTML = Icons.svg(paused ? 'play' : 'pause');
    $('btnAnimate').title = label;
    $('btnAnimate').setAttribute('aria-label', label);
    $('btnAnimate').classList.toggle('active', paused);
  }

  function openFile() { $('fileInput').value = ''; $('fileInput').click(); }

  function newMapDialog() { Dialogs.newMap(newMap, true); }
  function showShortcuts() { Dialogs.shortcuts(SHORTCUTS); }

  // Puts icons on the icon-only buttons.
  function addIcons() {
    const icons = { btnUndo: 'undo', btnRedo: 'redo', btnFullscreen: 'maximize', btnHelp: 'keyboard', btnInspector: 'sidebarRight',
      btnZoomOut: 'minus', btnZoomIn: 'plus', btnFit: 'fit' };
    for (const [id, name] of Object.entries(icons)) $(id).innerHTML = Icons.svg(name);
    document.querySelectorAll('.search-icon').forEach(el => { el.innerHTML = Icons.svg('search', 16); });
    document.querySelector('.ct-icon').innerHTML = Icons.svg('search', 16);
    if (!/Mac|iP(hone|ad)/.test(navigator.platform)) return;
    $('commandKey').textContent = '⌘K';
    document.querySelectorAll('#fileMenu kbd').forEach(k => { k.textContent = k.textContent.replace('Ctrl ', '⌘'); });
  }

  // File menu: opens under its button and closes on any click or Escape.
  function wireFileMenu() {
    const menu = $('fileMenu'), btn = $('btnFile');
    const show = on => { menu.hidden = !on; btn.setAttribute('aria-expanded', on); btn.classList.toggle('active', on); };
    btn.addEventListener('click', e => { e.stopPropagation(); show(menu.hidden); });
    menu.addEventListener('click', () => show(false));
    document.addEventListener('click', () => show(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') show(false); });
  }

  // Top bar buttons and the hidden file input.
  function wireTopBar() {
    addIcons();
    wireFileMenu();
    $('btnCommand').addEventListener('click', () => Command.open());
    $('btnInspector').addEventListener('click', () => Panel.togglePanel('inspector'));
    $('btnNew').addEventListener('click', newMapDialog);
    $('btnOpen').addEventListener('click', openFile);
    $('btnSave').addEventListener('click', () => Files.save(Renderer.getMap()));
    $('btnExport').addEventListener('click', () => Files.exportDialog(Renderer.getMap()));
    $('fileInput').addEventListener('change', e => { if (e.target.files[0]) Files.open(e.target.files[0], loadMap); });
    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);
    $('btnZoomIn').addEventListener('click', () => { Viewport.step(1); Renderer.requestPresent(); });
    $('btnZoomOut').addEventListener('click', () => { Viewport.step(-1); Renderer.requestPresent(); });
    $('btnFit').addEventListener('click', () => { Viewport.fit(); Renderer.requestPresent(); });
    $('btnHelp').addEventListener('click', showShortcuts);
    $('btnFullscreen').addEventListener('click', toggleFullscreen);
    $('btnGrid').addEventListener('click', toggleGrid);
    $('btnAnimate').addEventListener('click', toggleAnimation);
    $('btnExitFullscreen').addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.querySelectorAll('#viewToggle button').forEach(b =>
      b.addEventListener('click', () => setView(b.dataset.view)));
  }

  // Keyboard shortcuts. Returns true when a key was used.
  function onKey(e) {
    if (Dialogs.isOpen()) return false;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.shiftKey ? redo() : undo(); return true; }
    if (mod && k === 'y') { redo(); return true; }
    if (mod && k === 's') { Files.save(Renderer.getMap()); return true; }
    if (mod && k === 'o') { openFile(); return true; }
    if (mod) return false;
    if (e.key === '\\') { Panel.togglePanel('library'); return true; }
    if (e.key === '|') { Panel.togglePanel('inspector'); return true; }
    if (e.key === '/') { Library.show(null, true); return true; }
    if (e.key === '?') { showShortcuts(); return true; }
    if (k === 'f') { toggleFullscreen(); return true; }
    if (k === 'h') { toggleGrid(); return true; }
    if (k === 'k') { toggleAnimation(); return true; }
    if (e.key === 'Tab') { setView(Renderer.getView() === 'plan' ? 'rendered' : 'plan'); return true; }
    if (e.key === 'Delete' || e.key === 'Backspace') return Tools.deleteSelection();
    if (e.key === 'Escape' && Tools.state.selection) { Tools.setOption('selection', null); return true; }
    if (e.key === 'Escape' && Tools.state.ruler) { Tools.setOption('ruler', null); return true; }
    if (e.key === 'Escape' && document.body.classList.contains('map-only')) { setMapOnly(false); return true; }
    if ((e.key === '[' || e.key === ']') && Tools.state.selection) {
      Tools.adjustSelection(e.key === ']' ? 1 : -1);
      Panel.render();
      return true;
    }
    if (e.key === '[' || e.key === ']') {
      Tools.setOption('brushSize', Math.max(1, Math.min(60, Tools.state.brushSize + (e.key === ']' ? 2 : -2))));
      return true;
    }
    if (k === 'r' && Tools.state.tool === 'select' && Tools.selectedObject()) return Tools.rerollSelection();
    if (k === 'q') {
      const done = Tools.turnSelection();
      if ($('stampTurn')) $('stampTurn').classList.toggle('active', !!Tools.state.stampTurn);
      return done;
    }
    const tool = Tools.LIST.find(t => t.key.toLowerCase() === k);
    if (tool) { Tools.setTool(tool.id); return true; }
    const mat = Types.MATERIALS.find(m => m.key === e.key);
    if (mat) { Tools.setMaterial(mat.id); return true; }
    return false;
  }

  // Offers to continue the autosaved map, or asks for a new one.
  function firstMap() {
    const saved = Files.loadAutosave();
    if (!saved) { Dialogs.newMap(newMap, false); return; }
    Dialogs.confirm('Continue your last map?', `“${saved.name}”, ${saved.width} × ${saved.height} pixels, was saved in this browser.`,
      'Continue', 'Start a new map', () => loadMap(saved), () => Dialogs.newMap(newMap, false));
  }

  function start() {
    const canvas = $('display');
    Renderer.init(canvas);
    Input.init(canvas);
    Settings.init();
    Dock.init();
    Panel.init();
    wireTopBar();
    Input.onKey(onKey);
    Play.init($('btnPlay'));
    syncAnimation();
    CharacterArt.onReady(() => { Panel.renderAll(); Renderer.requestPresent(); });
    Tools.onChange(autosave);
    setView('rendered');
    firstMap();
  }

  return { start, newMap, newMapDialog, setView, undo, redo, autosave, isFullscreen, syncGrid,
    openFile, toggleGrid, toggleFullscreen, toggleAnimation, showShortcuts };
})();

App.start();
