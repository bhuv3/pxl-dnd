// Tool rail, the floating tool options bar over the map, the map name, and showing or hiding the side panels.
const Panel = (() => {
  const $ = id => document.getElementById(id);
  const TOOL_ICONS = { brush: 'brush', lasso: 'lasso', line: 'line', rect: 'rect', bucket: 'bucket', eraser: 'eraser',
    river: 'river', stamp: 'stamp', select: 'select', measure: 'measure', drop: 'drop' };
  let optionsFor = null;

  // Builds the rail, library, and options bar, and restores which panels were open.
  function init() {
    buildRail();
    Library.init();
    setPanel('library', !narrow() && Prefs.get('showLibrary', true), true);
    setPanel('inspector', !narrow() && Prefs.get('showInspector', true), true);
    $('mapName').addEventListener('input', e => { const map = Renderer.getMap(); if (map) { map.name = e.target.value; App.autosave(); } });
    $('contextBar').addEventListener('click', e => { if (e.target.closest('[data-show-library]')) Library.show(e.target.closest('[data-show-library]').dataset.showLibrary); });
    document.addEventListener('pointerdown', e => { const pop = $('changePop'); if (pop && !e.target.closest('.pop-wrap')) pop.hidden = true; });
    Tools.onChange(refresh);
    refresh();
  }

  // One icon button per tool, plus a button that opens or closes the library.
  function buildRail() {
    const tools = Tools.LIST.filter(t => !t.group).map(t =>
      `<button class="rail-btn" data-tool="${t.id}" title="${t.name} (${t.key})" aria-label="${t.name}">${Icons.svg(TOOL_ICONS[t.id], 20)}</button>`).join('');
    $('rail').innerHTML = `${tools}<div class="spacer"></div>
      <button class="rail-btn" id="btnLibrary" title="Library: materials and objects (\\)" aria-label="Library">${Icons.svg('sidebarLeft', 20)}</button>`;
    $('rail').querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => Tools.setTool(b.dataset.tool)));
    $('btnLibrary').addEventListener('click', () => togglePanel('library'));
  }

  // Small screens: the panels cover the map, so they start closed and their state isn't remembered.
  function narrow() { return matchMedia('(max-width: 900px)').matches; }

  // Shows or hides the library or the settings panel, and remembers it. On small screens only one is open at a time.
  function setPanel(name, on, quiet) {
    document.body.classList.toggle('hide-' + name, !on);
    const btn = $(name === 'library' ? 'btnLibrary' : 'btnInspector');
    if (btn) btn.classList.toggle('active', on);
    if (on && narrow()) setPanel(name === 'library' ? 'inspector' : 'library', false, true);
    if (!quiet && !narrow()) Prefs.set(name === 'library' ? 'showLibrary' : 'showInspector', on);
  }

  function togglePanel(name) { setPanel(name, document.body.classList.contains('hide-' + name)); }

  // Updates highlights, options, and undo buttons.
  function refresh() {
    const st = Tools.state;
    $('rail').querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === st.tool));
    Library.refresh();
    const key = optionsKey();
    if (optionsFor !== key) renderOptions(key);
    else syncBrushSize();
    $('btnUndo').disabled = !History.canUndo();
    $('btnRedo').disabled = !History.canRedo();
  }

  // Identifies what the options bar is currently showing.
  function optionsKey() {
    const st = Tools.state, sel = st.selection;
    const what = !sel ? '' : sel.type === 'area' ? `area${sel.layer}${sel.value}:${sel.count}` : sel.type + sel.id;
    return [st.tool, st.stampType, st.material, st.rectMode, what, Renderer.getWorld() ? 1 : 0].join(':');
  }

  // The options bar: tool name, what it paints or places, and its settings.
  function renderOptions(key) {
    const st = Tools.state;
    optionsFor = key;
    const map = Renderer.getMap();
    const tool = Tools.LIST.find(t => t.id === st.tool);
    const [body, help] = toolOptions(st, map);
    $('contextBar').innerHTML = `<span class="ctx-tool">${Icons.svg(TOOL_ICONS[tool.id])}<span>${tool.name}</span></span>${body}
      ${help ? `<span class="ctx-help" title="${help}" aria-label="${help}" tabindex="0">${Icons.svg('info', 16)}</span>` : ''}`;
    wireToolOptions(map);
  }

  // Map name and size in the top bar, then the settings panel.
  function renderMap() {
    const map = Renderer.getMap();
    if (!map) return;
    $('mapName').value = map.name;
    $('mapName').title = `${map.name}: ${map.width} × ${map.height} pixels, seed ${map.seed}`;
    $('mapMeta').textContent = `${map.width} × ${map.height}`;
    Settings.render($('settingsSection'), map);
  }

  // A compact labeled slider for the options bar.
  function slider(id, label, min, max, step, value) {
    return `<label class="ctx-field" for="${id}"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><output id="${id}Val">${value}</output></label>`;
  }

  // Segmented buttons for a small choice.
  function choice(name, options, value) {
    return `<span class="seg ctx-seg">${options.map(([v, l]) => `<button data-${name}="${v}" class="${value === v ? 'active' : ''}">${l}</button>`).join('')}</span>`;
  }

  // Button showing the material being painted. A click opens the library on Terrain.
  function materialChip(id) {
    const m = Types.material(id), pic = Thumbs.url('m', id);
    return `<button class="chip" data-show-library="terrain" title="Change material">${pic ? `<img class="chip-pic" src="${pic}" alt="">` : swatch(m.plan)}<span>${m.name}</span>${Icons.svg('chevronDown', 14)}</button>`;
  }

  // Button showing the object being stamped. A click opens the library on Objects.
  function objectChip(type) {
    const pic = Thumbs.url('o', type);
    const thumb = pic ? `<img class="chip-pic" src="${pic}" alt="">` : swatch(Types.OBJECT_COLORS[type]);
    return `<button class="chip" data-show-library="objects" title="Change object">${thumb}<span>${Types.OBJECT_NAMES[type]}</span>${Icons.svg('chevronDown', 14)}</button>`;
  }

  // Library picture of a material, or its plan color until pictures are ready.
  function thumb(m) {
    const pic = Thumbs.url('m', m.id);
    return pic ? `<span class="thumb pic"><img src="${pic}" alt=""></span>` : `<span class="thumb" style="background:${m.plan}"></span>`;
  }

  function swatch(color) { return `<span class="swatch" style="background:${color}"></span>`; }

  // Icon button with a text label for screen readers and a tooltip.
  function iconBtn(id, icon, label, extra) {
    return `<button class="icon-btn" id="${id}" title="${label}" aria-label="${label}" ${extra || ''}>${Icons.svg(icon)}</button>`;
  }

  const sep = '<span class="ctx-sep"></span>';

  // [options HTML, help text] for the current tool.
  function toolOptions(st, map) {
    const size = (label) => slider('optSize', label || 'Size', 1, 60, 1, st.brushSize);
    const s = map ? map.settings : MapModel.defaultSettings();
    const mat = materialChip(st.material);
    switch (st.tool) {
      case 'brush': return [mat + sep + size(), heightHint(st.material) || 'Paint with the selected material. Painting land over water replaces the water. [ and ] change the size.'];
      case 'lasso': return [mat, 'Draw a closed shape. It fills with the selected material when you let go.'];
      case 'line': return [mat + sep + size('Thickness'), 'Drag a straight line of the selected material. Hold Shift to snap to 45°. Good for walls. [ and ] change the thickness.'];
      case 'rect': return [mat + sep + choice('rect', [['outline', 'Outline'], ['fill', 'Filled']], st.rectMode) + (st.rectMode === 'fill' ? '' : size('Wall')),
        'Drag a box. Hold Shift for a square. Stone wall outline + Wood floor fill makes a room.'];
      case 'bucket': return [mat, 'Click to fill the connected area under the cursor with the selected material.'];
      case 'eraser': return [size() + `<label class="ctx-field" for="optErase"><span>Erase</span><select id="optErase">${[['all', 'Everything'], ['water', 'Water and chasms'], ['scatter', 'Forest and scatter'], ['ground', 'Ground (to dirt)'], ['elevation', 'Height (to level 0)']]
        .map(([v, l]) => `<option value="${v}" ${st.eraserTarget === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`, ''];
      case 'river': return [slider('optRiverWidth', 'Width', 2, 40, 1, s.riverWidth) + slider('optRiverMeander', 'Meander', 0, 20, 0.5, s.riverMeander)
        + slider('optRiverWobble', 'Wobble', 0, 0.9, 0.05, s.riverWidthWobble),
        'Draw a freeform line. Water flows from where you start to where you finish. Meander: how far the river wanders from your line.'];
      case 'stamp': return [objectChip(st.stampType) + sep + iconBtn('stampReroll', 'dice', 'New look')
        + iconBtn('stampTurn', 'rotate', 'Turn (Q)', `class="icon-btn ${st.stampTurn ? 'active' : ''}" ${Props.canTurn(st.stampType) ? '' : 'hidden'}`),
        'Click to place. Each one is different. Objects can’t go in water. Q turns houses (four ways), benches, tables, beds and other furniture.'];
      case 'select': return selectOptions();
      case 'drop': return [`<span class="ctx-text">Click a river to add a waterfall</span>`, 'Click a river to lower it one level from there on downstream: a waterfall forms there, and the banks below become cliffs. '
        + `Click a drop again to remove it. Up to ${Types.MAX_DROPS} drops per river. Water flows from where the river was started.`];
      case 'measure': return [`<span class="ctx-text">1 square = ${s.gridSize} px · ${s.gridFeet} ft</span>`,
        'Drag from square to square to measure the straight-line distance between their centers. Grid size is under Scene, Grid and tabletop.'];
      default: return ['', ''];
    }
  }

  // What the Height brushes do, or '' for other materials.
  function heightHint(id) {
    if (id === 'raise' || id === 'lower') return 'Each stroke raises or lowers the ground one level (0–7) as a stepped hill you can walk up. Stroke again over the middle to build a mountain. '
      + 'Lakes and the sea stay where they are; rivers keep their level and cut a gorge.';
    if (id === 'flatten') return 'Flattens the ground to the level where the stroke starts. The edges become cliffs, and paths crossing them get stairs.';
    return '';
  }

  // [options HTML, help text] for the current selection.
  function selectOptions() {
    const grow = (less, more) => iconBtn('selSmaller', 'minus', less) + iconBtn('selLarger', 'plus', more);
    const del = iconBtn('selDelete', 'trash', 'Delete (Delete)', 'class="icon-btn danger"');
    const area = Tools.selectedArea();
    if (area) {
      const swatches = Types.MATERIALS.filter(m => m.group !== 'Height' && !(m.layer === area.layer && m.value === area.value)).map(m =>
        `<button class="tile" data-change="${m.id}" title="${m.name}">${thumb(m)}<span class="tile-label">${m.name}</span></button>`).join('');
      return [`<span class="ctx-text"><b>${Areas.name(area)}</b> · ${area.count.toLocaleString()} px</span>${sep}${grow('Smaller ([)', 'Larger (])')}
        <span class="pop-wrap"><button class="chip" id="selChange">${Icons.svg('swap', 16)}<span>Change to</span>${Icons.svg('chevronDown', 14)}</button>
        <div class="ctx-pop" id="changePop" hidden><div class="tile-grid">${swatches}</div></div></span>${del}`,
        'Drag to move. [ and ] grow or shrink it by a pixel. Shift-click selects the ground under water or an area.'];
    }
    const obj = Tools.selectedObject();
    if (obj) {
      return [`<span class="ctx-text"><b>${Types.OBJECT_NAMES[obj.type]}</b> · ${obj.scale}×</span>${sep}${grow('Smaller ([)', 'Larger (])')}
        ${iconBtn('selReroll', 'dice', 'New look (R)')}${Props.canTurn(obj.type) ? iconBtn('selTurn', 'rotate', 'Turn (Q)') : ''}${del}`,
        'Drag to move. [ and ] change the size, R gives it a new look, Q turns it, Delete removes it.'];
    }
    const river = Tools.selectedRiver();
    if (river) {
      return [`<span class="ctx-text"><b>River</b> · width ${river.width}</span>${sep}${grow('Narrower ([)', 'Wider (])')}${del}`, '[ and ] change the width. Delete removes it.'];
    }
    return ['<span class="ctx-text muted">Click an object, a river, or an area to select it</span>',
      'Click an object, a river, or any painted area to select it. Shift-click selects the ground under water or an area.'];
  }

  // Connects the option inputs to the tool state and map settings.
  function wireToolOptions(map) {
    bindSlider('optSize', v => Tools.setOption('brushSize', v));
    if (map) {
      bindSlider('optRiverWidth', v => { map.settings.riverWidth = v; App.autosave(); });
      bindSlider('optRiverMeander', v => { map.settings.riverMeander = v; App.autosave(); });
      bindSlider('optRiverWobble', v => { map.settings.riverWidthWobble = v; App.autosave(); });
    }
    document.querySelectorAll('[data-rect]').forEach(b => b.addEventListener('click', () => Tools.setOption('rectMode', b.dataset.rect)));
    const erase = $('optErase');
    if (erase) erase.addEventListener('change', () => Tools.setOption('eraserTarget', erase.value));
    click('selDelete', () => Tools.deleteSelection());
    click('selSmaller', () => { Tools.adjustSelection(-1); render(); });
    click('selLarger', () => { Tools.adjustSelection(1); render(); });
    click('selReroll', () => Tools.rerollSelection());
    click('selTurn', () => Tools.turnSelection());
    click('selChange', () => { $('changePop').hidden = !$('changePop').hidden; });
    click('stampTurn', () => { Tools.turnSelection(); $('stampTurn').classList.toggle('active', !!Tools.state.stampTurn); });
    click('stampReroll', () => Tools.setOption('stampSeed', Random.newSeed()));
    document.querySelectorAll('[data-change]').forEach(b => b.addEventListener('click', () => Tools.changeSelection(b.dataset.change)));
  }

  // Calls fn with the slider's number on input, and updates its readout.
  function bindSlider(id, fn) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => { $(id + 'Val').textContent = el.value; fn(+el.value); });
  }

  function click(id, fn) { const el = $(id); if (el) el.addEventListener('click', fn); }

  // Keeps the brush-size slider in sync when changed by keyboard.
  function syncBrushSize() {
    const size = $('optSize');
    if (size) { size.value = Tools.state.brushSize; $('optSizeVal').textContent = Tools.state.brushSize; }
  }

  // Rebuilds the options bar (e.g. after a selection edit).
  function render() { optionsFor = null; refresh(); }

  // Rebuilds everything that depends on the map (new or opened map, characters loaded).
  function renderAll() { Thumbs.invalidate(); renderMap(); Library.render(); Dock.sync(); render(); }

  function toolIcon(id) { return TOOL_ICONS[id]; }

  return { init, render, renderAll, refresh, syncBrushSize, setPanel, togglePanel, toolIcon };
})();
