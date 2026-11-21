// The adventure editor page (Step 6a): open or start an adventure, add maps, place things on them with the tools,
// set them up in the side panel, try it in adventure.html, and export the .js file. Work in progress is kept in
// localStorage (dnd-game:editor) so a reload doesn't lose it.
const Editor = (() => {
  const $ = id => document.getElementById(id);
  const KEY = 'dnd-game:editor';
  const SIZES = { small: [160, 120], medium: [240, 160], large: [320, 240] };
  const TOOLS = [['select', 'Select'], ['spot', 'Spot'], ['monster', 'Monster'], ['npc', 'Townsperson'], ['door', 'Door'],
    ['chest', 'Chest'], ['trap', 'Trap'], ['exit', 'Exit'], ['area', 'Room text'], ['erase', 'Delete']];
  let adv, mapId = null, tool = 'select', sel = null, gameLight = false, drag = null, dirty = false;
  let lastMonster = { sheet: 'goblin', group: 'group1' };

  const here = () => adv.maps[mapId];

  // ---------- Adventure and maps ----------

  function load(a) {
    adv = a;
    for (const k of ['maps', 'dialogue']) adv[k] = adv[k] || {};
    adv.start = adv.start || { map: '', at: '' };
    mapId = adv.start.map && adv.maps[adv.start.map] ? adv.start.map : Object.keys(adv.maps)[0] || null;
    sel = null;
    showMap();
  }

  function showMap() {
    $('stage').style.visibility = mapId ? 'visible' : 'hidden';
    if (mapId) EditorView.show(here(), gameLight);
    render();
  }

  function selectMap(id) { mapId = id; sel = null; showMap(); }

  function addMap(data) {
    let id = (data.name || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map', n = 1;
    while (adv.maps[id + (n > 1 ? n : '')]) n++;
    id += n > 1 ? n : '';
    adv.maps[id] = data;
    if (!adv.start.map) adv.start = { map: id, at: '' };
    mapId = id;
    sel = null;
    touch();
    showMap();
    status(`Added ${data.name}: ${data.monsters.length} monsters, ${data.npcs.length} townsfolk, ${data.doors.length} doors, ${data.chests.length} chests brought in from the map.`);
  }

  function addMapFile() { $('mapFile').value = ''; $('mapFile').click(); }

  function readMapFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try { addMap(AdvFile.fromEditorMap(MapModel.deserialize(JSON.parse(r.result)))); }
      catch (e) { status('That file isn\'t a map from the map editor.'); }
    };
    r.readAsText(file);
  }

  function addGenerated(g) {
    const [w, h] = SIZES[g.size];
    addMap(AdvFile.fromGenerator(g.biome, w, h, g.seed || 1));
  }

  function deleteMap() {
    if (!mapId || !confirm(`Delete the map "${here().name}" and everything on it?`)) return;
    delete adv.maps[mapId];
    if (adv.start.map === mapId) adv.start = { map: '', at: '' };
    mapId = Object.keys(adv.maps)[0] || null;
    sel = null;
    touch();
    showMap();
  }

  // ---------- Placing ----------

  // A unique name: base1, base2, ...
  function unique(base, taken) { let n = 1; while (taken.includes(base + n)) n++; return base + n; }

  function place(sq) {
    const m = here(), at = [sq.sx, sq.sy];
    const add = (list, o, kind) => { (m[list] = m[list] || []).push(o); sel = { kind, item: o }; return o; };
    if (tool === 'spot') {
      const name = unique('spot', Object.keys(m.spots = m.spots || {}));
      m.spots[name] = { sq: at };
      if (!adv.start.map || !adv.start.at) adv.start = { map: mapId, at: name };
      sel = { kind: 'spot', item: m.spots[name], name };
    } else if (tool === 'monster') {
      const { sheet, group } = lastMonster, count = (m.monsters || []).filter(o => o.sheet === sheet).length + 1;
      add('monsters', { name: `${Creatures.MONSTERS[sheet].name} ${count}`, key: AdvFile.artOf(sheet), sheet, seed: count * 7, sq: at, group }, 'monster');
    } else if (tool === 'npc') add('npcs', { name: `Villager ${(m.npcs || []).length + 1}`, key: 'villager', role: 'folk', at: { sq: at }, line: 'Good day to you.' }, 'npc');
    else if (tool === 'door') add('doors', { sq: at }, 'door');
    else if (tool === 'chest') add('chests', { sq: at, gold: 10, potions: 0 }, 'chest');
    else if (tool === 'trap') add('traps', { sq: at, name: 'tripwire', find: 12, save: { ability: 'dex', dc: 12 }, damage: '1d6', type: 'piercing' }, 'trap');
    changed(tool === 'door' || tool === 'chest');
  }

  function placeRect(rect) {
    const m = here();
    if (tool === 'exit') {
      const o = { id: unique('exit', (m.exits || []).map(e => e.id)), rect, to: '', at: '' };
      (m.exits = m.exits || []).push(o);
      sel = { kind: 'exit', item: o };
    } else {
      const o = { rect, text: 'Describe what the party sees here.' };
      (m.areas = m.areas || []).push(o);
      sel = { kind: 'area', item: o };
    }
    changed();
  }

  const LISTS = { monster: 'monsters', npc: 'npcs', door: 'doors', chest: 'chests', trap: 'traps', exit: 'exits', area: 'areas' };

  function remove(t) {
    const m = here();
    if (t.kind === 'spot') {
      delete m.spots[t.name];
      if (adv.start.map === mapId && adv.start.at === t.name) adv.start.at = '';
    } else m[LISTS[t.kind]] = m[LISTS[t.kind]].filter(o => o !== t.item);
    if (sel && sel.item === t.item) sel = null;
    changed(t.kind === 'door' || t.kind === 'chest');
  }

  // Moves a one-square thing to another square.
  function move(t, sq) {
    const at = [sq.sx, sq.sy];
    if (t.kind === 'npc') t.item.at = { sq: at };
    else if (t.kind === 'spot') { for (const k of Object.keys(t.item)) delete t.item[k]; t.item.sq = at; }
    else t.item.sq = at;
    changed(t.kind === 'door' || t.kind === 'chest');
  }

  function renameSpot(old, name) {
    const m = here();
    name = name.replace(/\W+/g, '') || old;
    if (name === old || m.spots[name]) return;
    m.spots[name] = m.spots[old];
    delete m.spots[old];
    if (adv.start.map === mapId && adv.start.at === old) adv.start.at = name;
    for (const o of Object.values(adv.maps)) for (const e of o.exits || []) if (e.to === mapId && e.at === old) e.at = name;
    sel = { kind: 'spot', item: m.spots[name], name };
  }

  // ---------- Mouse and keys ----------

  function rectOf(a, b) { return [Math.min(a.sx, b.sx), Math.min(a.sy, b.sy), Math.max(a.sx, b.sx), Math.max(a.sy, b.sy)]; }

  function mouseDown(e) {
    if (e.button !== 0 || !mapId) return;
    const sq = EditorView.squareAt(e);
    if (!EditorView.inside(sq)) return;
    if (tool === 'exit' || tool === 'area') drag = { from: sq, rect: rectOf(sq, sq) };
    else if (tool === 'select') {
      const t = EditorView.at(sq)[0];
      sel = t ? { kind: t.kind, item: t.item, name: t.name } : null;
      if (t && t.kind === 'monster') lastMonster = { sheet: t.item.sheet, group: t.item.group };
      drag = t && t.squares.length === 1 ? { thing: t, from: sq } : null;
      render();
    } else if (tool === 'erase') { const t = EditorView.at(sq)[0]; if (t) remove(t); }
    else place(sq);
  }

  function mouseMove(e) {
    if (!mapId) return;
    const sq = EditorView.squareAt(e);
    if (drag && drag.rect) drag.rect = rectOf(drag.from, sq);
    EditorView.set({ hover: sq, drag: drag && drag.rect });
    const names = EditorView.inside(sq) ? EditorView.at(sq).map(t => t.label) : [];
    $('status').textContent = EditorView.inside(sq) ? `Square ${sq.sx}, ${sq.sy}${Squares.isSolid(sq.sx, sq.sy) ? ' (blocked)' : ''}${names.length ? ': ' + names.join(', ') : ''}` : '';
  }

  function mouseUp(e) {
    if (!drag) return;
    const sq = EditorView.squareAt(e), d = drag;
    drag = null;
    EditorView.set({ drag: null });
    if (d.rect) placeRect(d.rect);
    else if (d.thing && EditorView.inside(sq) && (sq.sx !== d.from.sx || sq.sy !== d.from.sy)) move(d.thing, sq);
  }

  function key(e) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
      e.preventDefault();
      const t = EditorView.things().find(t => t.item === sel.item);
      if (t) remove(t);
    } else if (e.key === 'Escape') setTool('select');
    else if (/^[0-9]$/.test(e.key)) setTool(TOOLS[(+e.key + 9) % 10][0]);
  }

  function setTool(t) {
    tool = t;
    $('tools').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  }

  // ---------- Checking ----------

  // What would go wrong in the game: { text, map, sq }.
  function problems() {
    const out = [], maps = adv.maps;
    if (!Object.keys(maps).length) return [{ text: 'Add a map.' }];
    if (!adv.party.length) out.push({ text: 'The party is empty.' });
    if (!maps[adv.start.map] || !(maps[adv.start.map].spots || {})[adv.start.at]) out.push({ text: 'The adventure has no start: place a spot and press "The adventure starts here".' });
    for (const [id, m] of Object.entries(maps)) {
      const name = m.name || id;
      for (const e of m.exits || []) {
        if (!maps[e.to]) out.push({ text: `${name}: an exit leads nowhere.`, map: id, item: e, kind: 'exit' });
        else if (!(maps[e.to].spots || {})[e.at]) out.push({ text: `${name}: an exit to ${maps[e.to].name} has no spot to arrive at.`, map: id, item: e, kind: 'exit' });
      }
      for (const o of m.npcs || []) if (o.talk && !(adv.dialogue || {})[o.talk]) out.push({ text: `${name}: ${o.name}'s dialogue "${o.talk}" isn't in the file.`, map: id, item: o, kind: 'npc' });
      for (const [g, acts] of Object.entries(m.defeated || {})) if (!(m.monsters || []).some(o => o.group === g) && acts.length) out.push({ text: `${name}: "when beaten" for ${g}, which has no monsters.`, map: id });
    }
    // Things in walls: only the shown map is built, so only it is checked.
    if (mapId) {
      for (const t of EditorView.things()) {
        const where = `${here().name || mapId}: ${t.label}`, at = { map: mapId, item: t.item, kind: t.kind, name: t.name };
        if (['monster', 'npc', 'trap', 'spot'].includes(t.kind) && Squares.isSolid(t.squares[0].sx, t.squares[0].sy)) out.push({ text: `${where} is on a blocked square.`, ...at });
        if (t.kind === 'exit' && t.squares.every(s => Squares.isSolid(s.sx, s.sy))) out.push({ text: `${where}: every square of the exit is blocked, so no one can walk onto it.`, ...at });
      }
    }
    return out;
  }

  function goTo(p) {
    if (p.map !== mapId) selectMap(p.map);
    if (p.item) { sel = { kind: p.kind, item: p.item, name: p.name }; render(); }
  }

  // ---------- Files and playing ----------

  function openFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try { load(AdvFile.read(r.result)); dirty = false; save(); status(`Opened ${adv.name}.`); }
      catch (e) { status('That file isn\'t an adventure file.'); }
    };
    r.readAsText(file);
  }

  function exportFile() {
    AdvFile.download(AdvFile.write(adv), adv.id + '.js');
    dirty = false;
    status(`Exported ${adv.id}.js. Put it in dnd-game/adventures/, then open adventure.html?a=${adv.id}`);
  }

  function play(fromHere) {
    const spot = mapId && Object.keys(here().spots || {})[0];
    if (fromHere && !spot) return status('Place a spot on this map first: the party arrives there.');
    if (!AdvFile.play(adv, fromHere ? { map: mapId, at: spot } : null)) status('The browser wouldn\'t store the adventure for playing (storage full or blocked).');
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(adv)); } catch (e) {} }
  function restoreSaved() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

  function status(text) { $('status').textContent = text; }

  // ---------- Updating ----------

  function touch() { dirty = true; save(); }

  // Something changed. rebuild: the map itself changed (a door or chest), so build it again.
  function changed(rebuild) {
    touch();
    if (mapId) rebuild ? EditorView.show(here(), gameLight) : EditorView.refresh();
    render();
  }

  function render() {
    if (sel && !EditorView.things().some(t => t.item === sel.item)) sel = null;
    EditorView.set({ sel });
    EditorPanel.render({ adv, mapId, sel, gameLight, changed, selectMap, addMapFile, addGenerated, deleteMap, renameSpot, problems, goTo,
      adventureMap: () => mapId && here(),
      setLight: v => { gameLight = v; showMap(); },
      deleteSelected: () => { const t = EditorView.things().find(t => t.item === sel.item); if (t) remove(t); } });
  }

  function wire() {
    $('tools').innerHTML = TOOLS.map(([t, name], k) => `<button data-tool="${t}"><kbd>${(k + 1) % 10}</kbd> ${name}</button>`).join('');
    $('tools').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTool(b.dataset.tool); });
    const canvas = $('stage');
    canvas.addEventListener('mousedown', mouseDown);
    canvas.addEventListener('mousemove', mouseMove);
    canvas.addEventListener('mouseleave', () => EditorView.set({ hover: null }));
    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('keydown', key);
    const ask = () => !dirty || confirm('Drop the changes since the last export?');
    $('new').addEventListener('click', () => { if (ask()) { load(AdvFile.blank()); dirty = false; save(); } });
    $('open').addEventListener('click', () => { if (ask()) { $('openFile').value = ''; $('openFile').click(); } });
    $('openFile').addEventListener('change', e => e.target.files[0] && openFile(e.target.files[0]));
    $('mapFile').addEventListener('change', e => e.target.files[0] && readMapFile(e.target.files[0]));
    $('known').innerHTML = '<option value="">Open one of the game\'s…</option>' + Adventures.list().map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    $('known').addEventListener('change', e => {
      const id = e.target.value;
      e.target.value = '';
      if (id && ask()) { load(structuredClone(Adventures.get(id))); dirty = false; save(); status(`Opened ${adv.name}.`); }
    });
    $('export').addEventListener('click', exportFile);
    $('playStart').addEventListener('click', () => play(false));
    $('playMap').addEventListener('click', () => play(true));
  }

  function start() {
    EditorView.init($('stage'));
    wire();
    setTool('select');
    load(restoreSaved() || AdvFile.blank());
  }

  start();

  return { adv: () => adv, mapId: () => mapId, setTool, selectMap, load, place, placeRect, problems };
})();
