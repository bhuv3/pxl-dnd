// Settings panel: Scene, Style, and Colors tabs with search, presets, and less-used settings tucked away.
const Settings = (() => {
  const $ = id => document.getElementById(id);
  const openSections = new Set(Prefs.get('openSections', ['Time of day', 'Weather']));
  const showMore = new Set();
  let tab = Prefs.get('settingsTab', 'scene');
  let query = '';
  let container = null, current = null;
  let rebuildTimer = null;

  // live: only affects animation, so no rebuild is needed. adv: tucked under "more" until asked for.
  const SECTIONS = [
    { title: 'Time of day', tab: 'scene', items: [
      { key: 'timeOfDay', label: 'Time', min: 0, max: 24, step: 0.25, live: true, format: v => Daylight.label(v) },
      { key: 'dayCycle', label: 'Let time pass', type: 'check', live: true },
      { key: 'underground', label: 'Underground', type: 'check', live: true, hint: 'Dark whatever the time. Only fires, torches, candles, and magic give light, and walls block it.' },
      { key: 'smoke', label: 'Smoke from fires and chimneys', type: 'check', live: true },
      { key: 'dayLength', label: 'Length of a day (seconds)', min: 20, max: 600, step: 10, live: true, adv: true },
      { key: 'ambient', label: 'Light underground', min: 0, max: 0.6, step: 0.01, live: true, adv: true },
      { key: 'butterflies', label: 'Butterflies', min: 0, max: 60, step: 1, hint: 'Out by day.', adv: true },
      { key: 'birds', label: 'Bird flocks', min: 0, max: 8, step: 1, hint: 'Out by day.', adv: true },
      { key: 'gulls', label: 'Gulls', min: 0, max: 30, step: 1, hint: 'Circle over the sea and the shore by day.', adv: true },
      { key: 'fireflies', label: 'Fireflies', min: 0, max: 200, step: 5, hint: 'Out at night.', adv: true },
      { key: 'fish', label: 'Jumping fish', min: 0, max: 30, step: 1, hint: 'In lakes, the sea, and wide rivers.', adv: true },
    ]},
    { title: 'Weather', tab: 'scene', items: [
      { key: 'weather', label: 'Weather', type: 'choice', live: true, options: [['clear', 'Clear'], ['rain', 'Rain'], ['snow', 'Snow']],
        hint: 'Snow doesn’t change the season. Pair it with Winter.' },
      { key: 'precipitation', label: 'Rain or snow amount', min: 0.1, max: 2, step: 0.1, live: true },
      { key: 'clouds', label: 'Cloud shadows', type: 'check', live: true },
      { key: 'cloudAmount', label: 'Cloud cover', min: 0, max: 1, step: 0.05, live: true },
      { key: 'fog', label: 'Fog', min: 0, max: 1, step: 0.05, live: true, hint: 'Banks of mist drifting by.' },
      { key: 'cloudDarkness', label: 'Cloud shadow darkness', min: 0.02, max: 0.4, step: 0.02, live: true, adv: true },
      { key: 'cloudSpeed', label: 'Cloud speed', min: 0, max: 5, step: 0.1, live: true, adv: true },
    ]},
    { title: 'Light', tab: 'scene', items: [
      { key: 'lightAngle', label: 'Light direction', min: 0, max: 360, step: 5, hint: '0 is from the right, 90 from the top, 180 from the left.' },
      { key: 'shadows', label: 'Shadows', type: 'check' },
      { key: 'shadowLength', label: 'Shadow length', min: 0, max: 3, step: 0.1 },
      { key: 'shading', label: 'Shading', type: 'check', adv: true },
      { key: 'outline', label: 'Outlines', type: 'check', adv: true },
    ]},
    { title: 'Wind', tab: 'scene', items: [
      { key: 'wind', label: 'Wind sway', type: 'check', live: true },
      { key: 'windStrength', label: 'Strength', min: 0, max: 3, step: 0.1, live: true },
      { key: 'windSpeed', label: 'Speed', min: 0.1, max: 6, step: 0.1, live: true, adv: true },
      { key: 'fps', label: 'Frames per second', min: 2, max: 30, step: 1, live: true, adv: true },
    ]},
    { title: 'Grid and tabletop', tab: 'scene', items: [
      { key: 'grid', label: 'Show the grid', type: 'check', live: true, hint: 'Toggle with H. The Measure tool (U) counts squares.' },
      { key: 'gridSize', label: 'Square size (map pixels)', min: 4, max: 40, step: 1, live: true },
      { key: 'gridFeet', label: 'Feet per square', min: 1, max: 10, step: 1, live: true },
      { key: 'gridOffsetX', label: 'Shift sideways', min: 0, max: 39, step: 1, live: true, adv: true },
      { key: 'gridOffsetY', label: 'Shift up or down', min: 0, max: 39, step: 1, live: true, adv: true },
      { key: 'gridOpacity', label: 'Line strength', min: 0.05, max: 1, step: 0.05, live: true, adv: true },
    ]},
    { title: 'Ground', tab: 'style', items: [
      { key: 'edgeWobble', label: 'Edge wobble', min: 0, max: 8, step: 0.5, hint: 'How much painted edges are pushed around so they look natural.' },
      { key: 'tuftDensity', label: 'Tuft density', min: 0, max: 6, step: 0.1 },
      { key: 'flowerAmount', label: 'Wild flowers', min: 0, max: 2, step: 0.05 },
      { key: 'raggedEdges', label: 'Ragged grass edges', type: 'check' },
      { key: 'grassLip', label: 'Darker edge under grass', type: 'check', adv: true },
      { key: 'flagMoss', label: 'Grass between flagstones', type: 'check', adv: true },
      { key: 'grassPatchSize', label: 'Grass patch size', min: 3, max: 40, step: 1, adv: true },
      { key: 'pebbleAmount', label: 'Pebbles', min: 0, max: 3, step: 0.1, adv: true },
    ]},
    { title: 'Height', tab: 'style', items: [
      { key: 'levelHeight', label: 'Height per level (pixels)', min: 4, max: 12, step: 1, hint: 'Raise and Lower paint stepped hills, Flatten makes cliff-edged terraces, Lower river makes waterfalls (all under Height in the library).' },
      { key: 'stairs', label: 'Stairs where paths cross cliffs', type: 'check' },
    ]},
    { title: 'Water', tab: 'style', items: [
      { key: 'shimmer', label: 'Shimmer', min: 0, max: 3, step: 0.1, live: true },
      { key: 'beachWidth', label: 'Beach width', min: 0, max: 20, step: 1 },
      { key: 'reeds', label: 'Reeds', type: 'check' },
      { key: 'lilyPads', label: 'Lily pads', type: 'check' },
      { key: 'bridges', label: 'Bridges and docks', type: 'check', hint: 'Paint a path across a river to get a bridge. A path out into a lake becomes a dock.' },
      { key: 'bridgeStyle', label: 'Bridge style', type: 'choice', options: [['auto', 'From path'], ['wood', 'Wood'], ['stone', 'Stone'], ['rope', 'Rope']],
        hint: 'From path: cobble and flagstone paths get stone bridges, the rest wooden ones.' },
      { key: 'steppingStones', label: 'Stepping stones', type: 'check', hint: 'A path across a narrow river becomes stones.' },
      { key: 'bandWidth', label: 'Depth band width', min: 1, max: 10, step: 1, adv: true },
      { key: 'seaBandWidth', label: 'Sea depth band width', min: 1, max: 12, step: 1, adv: true },
      { key: 'dither', label: 'Dither between shades', type: 'check', adv: true },
      { key: 'foamWidth', label: 'Foam width', min: 0, max: 4, step: 0.5, live: true, adv: true },
      { key: 'foamBreakup', label: 'Foam gaps', min: 0, max: 0.9, step: 0.05, live: true, adv: true },
      { key: 'waveReach', label: 'Wave reach', min: 0, max: 8, step: 0.5, adv: true },
      { key: 'waveSpeed', label: 'Wave speed', min: 0.1, max: 5, step: 0.1, live: true, adv: true },
      { key: 'flowSpeed', label: 'River flow speed', min: -4, max: 6, step: 0.1, live: true, adv: true },
      { key: 'riverBendSize', label: 'River bend size', min: 10, max: 150, step: 1, hint: 'Applies to all rivers. Width and meander for new rivers are on the River tool.', adv: true },
      { key: 'glintDensity', label: 'Glints', min: 0, max: 5, step: 0.1, adv: true },
      { key: 'mudBanks', label: 'Mud banks on lakes and rivers', type: 'check', adv: true },
      { key: 'lakeSandRim', label: 'Sand rim on lakes and rivers', type: 'check', adv: true },
      { key: 'beachRocks', label: 'Beach rocks', type: 'check', adv: true },
    ]},
    { title: 'Trees and rocks', tab: 'style', items: [
      { key: 'forestDensity', label: 'Forest density', min: 0.1, max: 1, step: 0.05 },
      { key: 'treeSize', label: 'Tree size', min: 4, max: 16, step: 1 },
      { key: 'pineSize', label: 'Pine size', min: 3, max: 14, step: 1 },
      { key: 'rockSize', label: 'Rock size', min: 2, max: 12, step: 1 },
      { key: 'fruitChance', label: 'Trees with fruit', min: 0, max: 1, step: 0.05 },
      { key: 'forestSpacing', label: 'Forest spacing', min: 0.5, max: 2, step: 0.05, adv: true },
      { key: 'bushSize', label: 'Bush size', min: 2, max: 10, step: 1, adv: true },
      { key: 'sizeVariation', label: 'Size variation', min: 0, max: 0.6, step: 0.05, adv: true },
      { key: 'treeBlobs', label: 'Leaf clumps', min: 0, max: 10, step: 1, adv: true },
      { key: 'leafTexture', label: 'Leaf texture', min: 0, max: 1, step: 0.05, adv: true },
      { key: 'forestFloor', label: 'Logs, stumps, mushrooms', min: 0, max: 1, step: 0.05, hint: 'Scattered between trees in forests and pine areas.', adv: true },
    ]},
  ];

  // Color pickers grouped by what they paint. The first matching pattern wins; the rest go under Other.
  const COLOR_GROUPS = [
    ['Grass and flowers', /^(grass|tuft|blade|flower|moss)/],
    ['Earth', /^(dirt|mud|dryEarth|pebble|caveFloor|sand|wetSand)/],
    ['Paths and floors', /^(path|cobble|gravel|flag|tile|slate|woodAlt)/],
    ['Stone and rock', /^(stone|rock|chasm)/],
    ['Water', /^(deep|mid|shallow|foam|glint|reed|lily|fish)/],
    ['Trees', /^(canopy|fruit|trunk|pine|snow)/],
    ['Buildings', /^(wood|roof|thatch|window|canvas|hay)/],
    ['Fire and life', /^(fire|smoke|butterfly|bird|firefly)/],
    ['Things', /^(mushroom|purple|copper|iron)/],
  ];

  // Quick looks for the Scene tab. Each sets a few settings; season swaps colors too.
  const PRESETS = [
    { name: 'Morning', icon: 'sun', set: { timeOfDay: 7, underground: false, weather: 'clear', clouds: true, cloudAmount: 0.3 } },
    { name: 'Noon', icon: 'sun', set: { timeOfDay: 12, underground: false, weather: 'clear' } },
    { name: 'Dusk', icon: 'moon', set: { timeOfDay: 19, underground: false, weather: 'clear' } },
    { name: 'Night', icon: 'moon', set: { timeOfDay: 23, underground: false, weather: 'clear' } },
    { name: 'Storm', icon: 'rain', set: { weather: 'rain', precipitation: 1.6, clouds: true, cloudAmount: 0.9, cloudDarkness: 0.3, wind: true, windStrength: 2.2 } },
    { name: 'Snowfall', icon: 'snow', season: 'winter', set: { weather: 'snow', precipitation: 1, underground: false } },
    { name: 'Cave', icon: 'cave', set: { underground: true, weather: 'clear', clouds: false } },
  ];

  const ITEMS = {};
  SECTIONS.forEach(sec => sec.items.forEach(it => { ITEMS[it.key] = it; }));

  // Wires the tab buttons and the search box once.
  function init() {
    document.querySelectorAll('[data-stab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.stab)));
    const search = $('setSearch');
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); redraw(); });
    search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; query = ''; redraw(); search.blur(); } });
  }

  function setTab(t) {
    tab = t;
    Prefs.set('settingsTab', tab);
    if (query) { query = ''; $('setSearch').value = ''; }
    redraw();
  }

  // Builds the settings panel for a map.
  function render(el, map) {
    container = el; current = map;
    document.querySelectorAll('[data-stab]').forEach(b => b.classList.toggle('active', b.dataset.stab === tab && !query));
    const s = map.settings;
    let html;
    if (query) html = searchResults(s);
    else if (tab === 'colors') html = seasonRow(s) + colorGroups(s).map(([g, keys]) => colorSection(g, keys, s, false)).join('');
    else html = (tab === 'scene' ? presetRow() + seasonRow(s) : '') + SECTIONS.filter(sec => sec.tab === tab).map(sec => section(sec, s, false)).join('');
    el.innerHTML = html + `<div class="insp-foot"><button id="resetSettings">${Icons.svg('reset', 16)}<span>Reset all settings</span></button></div>`;
    wire(el, map);
  }

  function redraw() { if (container && current) render(container, current); }

  // Sections and colors whose name, label, or hint matches the search.
  function searchResults(s) {
    const has = t => t && t.toLowerCase().includes(query);
    let html = '';
    for (const sec of SECTIONS) {
      const items = has(sec.title) ? sec.items : sec.items.filter(it => has(it.label) || has(it.hint) || has(it.key));
      if (items.length) html += section({ ...sec, items }, s, true);
    }
    for (const [g, keys] of colorGroups(s)) {
      const hits = has(g) ? keys : keys.filter(k => has(Colors.LABELS[k]));
      if (hits.length) html += colorSection(g, hits, s, true);
    }
    return html || `<p class="empty">No settings match “${query.replace(/</g, '&lt;')}”.</p>`;
  }

  // Preset chips that set several things at once.
  function presetRow() {
    return `<div class="presets">${PRESETS.map((p, i) => `<button class="chip" data-preset="${i}">${Icons.svg(p.icon, 14)}<span>${p.name}</span></button>`).join('')}</div>`;
  }

  // Season buttons: they swap the grass, leaf, and water plant colors.
  function seasonRow(s) {
    const seasons = Object.keys(Colors.SEASONS).map(k => [k, k[0].toUpperCase() + k.slice(1)]);
    return `<div class="season-row"><span class="row-label" title="Changes colors only">Season</span><span class="seg">${seasons.map(([k, l]) =>
      `<button data-season="${k}" class="${s.season === k ? 'active' : ''}">${l}</button>`).join('')}</span></div>`;
  }

  // A collapsible section. Less-used rows hide behind "N more" unless searching.
  function section(sec, s, forced) {
    const open = forced || openSections.has(sec.title);
    const basic = sec.items.filter(it => forced || !it.adv), adv = forced ? [] : sec.items.filter(it => it.adv);
    const more = showMore.has(sec.title);
    const defaults = MapModel.defaultSettings();
    const changed = sec.items.some(it => s[it.key] !== defaults[it.key]);
    return `<details data-title="${sec.title}" ${open ? 'open' : ''}>
      ${summary(sec.title, changed)}
      ${basic.map(it => row(it, s[it.key])).join('')}
      ${adv.length ? `${more ? adv.map(it => row(it, s[it.key])).join('') : ''}
        <button class="more" data-more="${sec.title}">${more ? 'Fewer settings' : `${adv.length} more setting${adv.length > 1 ? 's' : ''}`}</button>` : ''}
    </details>`;
  }

  // Section header: name, a dot when anything differs from the defaults, and a reset button.
  function summary(title, changed) {
    return `<summary>${Icons.svg('chevronRight', 14)}<span class="sec-title">${title}</span>${changed ? '<span class="dot" title="Changed from the defaults"></span>' : ''}
      ${changed ? `<button class="sec-reset" data-reset="${title}" title="Reset ${title}" aria-label="Reset ${title}">${Icons.svg('reset', 14)}</button>` : ''}</summary>`;
  }

  // [group name, color keys] in display order.
  function colorGroups() {
    const groups = new Map(COLOR_GROUPS.map(([g]) => [g, []]));
    groups.set('Other', []);
    for (const k of Object.keys(Colors.DEFAULTS)) {
      const hit = COLOR_GROUPS.find(([, re]) => re.test(k));
      groups.get(hit ? hit[0] : 'Other').push(k);
    }
    return [...groups].filter(([, keys]) => keys.length);
  }

  // Colors a group starts with: the defaults, with the season's colors on top.
  function baseColors(s) { return { ...Colors.DEFAULTS, ...(Colors.SEASONS[s.season] || Colors.SEASONS.summer).colors }; }

  // A section of color swatches. Each swatch opens the system color picker.
  function colorSection(g, keys, s, forced) {
    const base = baseColors(s);
    const changed = keys.some(k => s.colors[k] !== base[k]);
    const swatches = keys.map(k => `<label class="color-swatch" title="${Colors.LABELS[k]}"><input type="color" data-key="color:${k}" value="${s.colors[k]}" aria-label="${Colors.LABELS[k]}"><span>${Colors.LABELS[k]}</span></label>`).join('');
    return `<details data-title="${g}" ${forced || openSections.has(g) ? 'open' : ''}>${summary(g, changed)}<div class="color-grid">${swatches}</div></details>`;
  }

  // One control row: slider, switch, segmented choice, or color picker.
  function row(item, value) {
    const id = 'set-' + item.key;
    const label = `<label class="row-label" for="${id}" ${item.hint ? `title="${item.hint}"` : ''}>${item.label}${item.hint ? Icons.svg('info', 13) : ''}</label>`;
    if (item.type === 'choice') {
      return `<div class="row choice"><span class="row-label" ${item.hint ? `title="${item.hint}"` : ''}>${item.label}${item.hint ? Icons.svg('info', 13) : ''}</span><span class="seg">${item.options.map(([v, l]) =>
        `<button data-choice="${item.key}" data-value="${v}" class="${value === v ? 'active' : ''}">${l}</button>`).join('')}</span></div>`;
    }
    if (item.type === 'check') {
      return `<div class="row check">${label}<input type="checkbox" class="switch" id="${id}" data-key="${item.key}" ${value ? 'checked' : ''}></div>`;
    }
    return `<div class="row">${label}<span class="val">${item.format ? item.format(value) : value}</span>
      <input type="range" id="${id}" data-key="${item.key}" min="${item.min}" max="${item.max}" step="${item.step}" value="${value}"></div>`;
  }

  // Connects every control to the map settings.
  function wire(el, map) {
    el.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
      if (query) return;
      d.open ? openSections.add(d.dataset.title) : openSections.delete(d.dataset.title);
      Prefs.set('openSections', [...openSections]);
    }));
    el.querySelectorAll('[data-key]').forEach(input => input.addEventListener('input', () => onInput(input, map)));
    el.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => set(b.dataset.choice, b.dataset.value)));
    el.querySelectorAll('[data-season]').forEach(b => b.addEventListener('click', () => setSeason(b.dataset.season)));
    el.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => applyPreset(PRESETS[+b.dataset.preset])));
    el.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', () => {
      showMore.has(b.dataset.more) ? showMore.delete(b.dataset.more) : showMore.add(b.dataset.more);
      redraw();
    }));
    el.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); resetSection(b.dataset.reset); }));
    $('resetSettings').addEventListener('click', () => {
      Dialogs.confirm('Reset all settings?', 'Every setting and color goes back to its default. Undo doesn’t bring them back.', 'Reset', 'Cancel', () => {
        map.settings = MapModel.defaultSettings();
        redraw();
        Panel.render();
        changed(false);
      });
    });
  }

  // A slider, switch, or color picker moved.
  function onInput(input, map) {
    const key = input.dataset.key;
    if (key.startsWith('color:')) {
      map.settings.colors[key.slice(6)] = input.value;
      return changed(false);
    }
    const item = ITEMS[key];
    const value = item.type === 'check' ? input.checked : +input.value;
    map.settings[key] = value;
    const val = input.parentElement.querySelector('.val');
    if (val) val.textContent = item.format ? item.format(value) : value;
    changed(!!item.live);
  }

  // Sets one setting from outside the panel (the scene dock, command palette) and updates its control.
  function set(key, value) {
    if (!current) return;
    const item = ITEMS[key];
    current.settings[key] = value;
    if (container) {
      container.querySelectorAll(`[data-choice="${key}"]`).forEach(x => x.classList.toggle('active', x.dataset.value === String(value)));
      const input = container.querySelector(`[data-key="${key}"]`);
      if (input && item.type === 'check') input.checked = !!value;
      else if (input) { input.value = value; const val = input.parentElement.querySelector('.val'); if (val) val.textContent = item.format ? item.format(value) : value; }
    }
    changed(!!(item && item.live));
  }

  // Switches season: swaps its colors in and redraws.
  function setSeason(name) {
    if (!current) return;
    applySeason(current, name);
    redraw();
    changed(false);
  }

  // Swaps in a season's colors.
  function applySeason(map, name) {
    const season = Colors.SEASONS[name];
    map.settings.season = name;
    map.settings.snow = season.snow;
    Object.assign(map.settings.colors, season.colors);
  }

  // Applies a preset's settings (and season), then redraws.
  function applyPreset(p) {
    if (!current) return;
    Object.assign(current.settings, p.set);
    if (p.season) applySeason(current, p.season);
    redraw();
    changed(!p.season && Object.keys(p.set).every(k => ITEMS[k] && ITEMS[k].live));
    Renderer.flashMessage(`Preset: ${p.name}`);
  }

  // Puts one section (or color group) back to its defaults.
  function resetSection(title) {
    const s = current.settings;
    const sec = SECTIONS.find(x => x.title === title);
    if (sec) {
      const defaults = MapModel.defaultSettings();
      sec.items.forEach(it => { s[it.key] = defaults[it.key]; });
      redraw();
      return changed(sec.items.every(it => it.live));
    }
    const group = colorGroups().find(([g]) => g === title);
    if (!group) return;
    const base = baseColors(s);
    group[1].forEach(k => { s.colors[k] = base[k]; });
    redraw();
    changed(false);
  }

  // Shows the settings panel searched down to one setting or color, and focuses it.
  function reveal(label) {
    Panel.setPanel('inspector', true);
    $('setSearch').value = label;
    query = label.toLowerCase();
    redraw();
    const first = container && container.querySelector('input:not([type=search]), [data-choice]');
    if (first) { first.focus(); first.closest('.row, .color-swatch')?.classList.add('flash'); }
  }

  // Re-renders after a setting change. Live settings only need the next frame.
  function changed(live) {
    App.autosave();
    App.syncGrid();
    Dock.sync();
    if (live) return;
    Status.message('Rendering…');
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => { Renderer.rebuildNow(); Library.refreshThumbs(); Panel.render(); }, 150);
  }

  // Everything searchable, for the command palette: [label, section].
  function searchable() {
    const out = [];
    SECTIONS.forEach(sec => sec.items.forEach(it => out.push({ label: it.label, group: sec.title })));
    colorGroups().forEach(([g, keys]) => keys.forEach(k => out.push({ label: Colors.LABELS[k], group: 'Colors · ' + g })));
    return out;
  }

  return { init, render, set, setSeason, reveal, searchable, PRESETS, applyPreset };
})();
