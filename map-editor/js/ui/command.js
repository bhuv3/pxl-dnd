// Command palette (Ctrl/Cmd + K): one search box for tools, materials, objects, settings, and actions.
const Command = (() => {
  const $ = id => document.getElementById(id);
  const MAX_SHOWN = 60;
  let list = [], shown = [], active = 0;

  // Every command: { name, kind, key, icon, run }.
  function commands() {
    const out = [];
    const a = (name, icon, key, run) => out.push({ name, kind: 'Action', icon, key, run });
    a('New map…', 'filePlus', '', () => App.newMapDialog());
    a('Open map file…', 'folder', 'Ctrl+O', () => App.openFile());
    a('Save map file', 'save', 'Ctrl+S', () => Files.save(Renderer.getMap()));
    a('Export PNG…', 'photo', '', () => Files.exportDialog(Renderer.getMap()));
    a('Undo', 'undo', 'Ctrl+Z', () => App.undo());
    a('Redo', 'redo', 'Ctrl+Shift+Z', () => App.redo());
    a('Rendered view', 'sparkles', 'Tab', () => App.setView('rendered'));
    a('Plan view', 'rect', 'Tab', () => App.setView('plan'));
    a('Grid on or off', 'grid', 'H', () => App.toggleGrid());
    a('Fit map to screen', 'fit', '', () => { Viewport.fit(); Renderer.requestPresent(); });
    a('Fullscreen map', 'maximize', 'F', () => App.toggleFullscreen());
    a('Pause or resume the animation', 'pause', 'K', () => App.toggleAnimation());
    a('Play: walk a character', 'play', 'P', () => Play.toggle());
    a('Show or hide the library', 'sidebarLeft', '\\', () => Panel.togglePanel('library'));
    a('Show or hide settings', 'sidebarRight', 'Shift+\\', () => Panel.togglePanel('inspector'));
    a('Keyboard shortcuts', 'keyboard', '?', () => App.showShortcuts());
    for (const t of Tools.LIST) out.push({ name: t.name, kind: 'Tool', icon: Panel.toolIcon(t.id), key: t.key, run: () => Tools.setTool(t.id) });
    for (const it of Library.items()) {
      out.push({ name: it.name, kind: it.kind === 'o' ? 'Object · ' + it.group : 'Terrain · ' + it.group, color: it.color, key: it.key, run: () => Library.pick(it.kind, it.id) });
    }
    for (const p of Settings.PRESETS) out.push({ name: 'Preset: ' + p.name, kind: 'Scene', icon: p.icon, run: () => Settings.applyPreset(p) });
    for (const k of Object.keys(Colors.SEASONS)) out.push({ name: 'Season: ' + k[0].toUpperCase() + k.slice(1), kind: 'Scene', icon: 'leaf', run: () => Settings.setSeason(k) });
    for (const w of ['clear', 'rain', 'snow']) out.push({ name: 'Weather: ' + w[0].toUpperCase() + w.slice(1), kind: 'Scene', icon: w === 'clear' ? 'sun' : w, run: () => Settings.set('weather', w) });
    for (const s of Settings.searchable()) out.push({ name: s.label, kind: 'Setting · ' + s.group, icon: 'sliders', run: () => Settings.reveal(s.label) });
    return out;
  }

  // Opens the palette with an empty search.
  function open() {
    if (isOpen()) return;
    list = commands();
    const root = $('commandRoot');
    root.innerHTML = `<div class="command" role="dialog" aria-label="Search everything">
      <div class="command-search">${Icons.svg('search')}<input id="commandInput" placeholder="Search tools, materials, objects, settings…" autocomplete="off" spellcheck="false"></div>
      <div class="command-list" id="commandList" role="listbox"></div>
      <div class="command-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> use</span><span><kbd>Esc</kbd> close</span></div></div>`;
    root.hidden = false;
    const input = $('commandInput');
    input.addEventListener('input', () => { active = 0; filter(input.value); });
    input.addEventListener('keydown', onKey);
    root.addEventListener('mousedown', e => { if (e.target === root) close(); });
    $('commandList').addEventListener('click', e => { const r = e.target.closest('[data-i]'); if (r) run(+r.dataset.i); });
    active = 0;
    filter('');
    input.focus();
  }

  function close() { const root = $('commandRoot'); root.hidden = true; root.innerHTML = ''; }

  function isOpen() { return !$('commandRoot').hidden; }

  // Arrow keys move, Enter runs, Escape closes.
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length);
      paint();
    }
    if (e.key === 'Enter') { e.preventDefault(); run(active); }
  }

  // Ranks commands against the search: name starts > word starts > contains > letters in order.
  function filter(q) {
    q = q.trim().toLowerCase();
    if (!q) { shown = list.filter(c => c.kind === 'Action' || c.kind === 'Tool'); paint(); return; }
    const scored = [];
    for (const c of list) {
      const s = score(c.name.toLowerCase(), q) || score(c.kind.toLowerCase(), q) / 4;
      if (s > 0) scored.push([s, c]);
    }
    scored.sort((x, y) => y[0] - x[0]);
    shown = scored.slice(0, MAX_SHOWN).map(([, c]) => c);
    paint();
  }

  // How well text matches q (0 = not at all).
  function score(text, q) {
    if (text.startsWith(q)) return 100 - text.length / 10;
    const at = text.indexOf(q);
    if (at > 0 && /[\s:·(]/.test(text[at - 1])) return 80 - at / 10;
    if (at > 0) return 60 - at / 10;
    let i = 0;
    for (const ch of text) if (ch === q[i]) i++;
    return i === q.length ? 20 - text.length / 20 : 0;
  }

  // Draws the visible results and keeps the highlighted one in view.
  function paint() {
    const el = $('commandList');
    if (!shown.length) { el.innerHTML = '<p class="empty">Nothing found. Try another word.</p>'; return; }
    el.innerHTML = shown.map((c, i) => `<div class="command-row ${i === active ? 'active' : ''}" data-i="${i}" role="option" aria-selected="${i === active}">
      ${c.color ? `<span class="swatch" style="background:${c.color}"></span>` : Icons.svg(c.icon || 'info', 16)}
      <span class="command-name">${c.name}</span><span class="command-kind">${c.kind}</span>${c.key ? `<kbd>${c.key}</kbd>` : ''}</div>`).join('');
    const row = el.querySelector('.active');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  // Closes the palette, then runs the chosen command.
  function run(i) {
    const c = shown[i];
    if (!c) return;
    close();
    c.run();
  }

  // Ctrl/Cmd + K opens or closes the palette, even while typing in a search box.
  window.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k' || Dialogs.isOpen()) return;
    e.preventDefault();
    isOpen() ? close() : open();
  });

  return { open, close, isOpen };
})();
