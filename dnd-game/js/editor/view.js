// The adventure editor's map view: one map of the adventure drawn by the game's Stage, its monsters and townsfolk
// as they'll look in the game, and marks for everything else (spots, doors, chests, traps, exits, room
// descriptions). Mouse to square, what's on a square, wheel to zoom, right-drag to pan.
const EditorView = (() => {
  const S = 10;
  const COLOR = { spot: '#7fb4ff', door: '#d79a55', chest: '#f0c040', trap: '#ff5a4a', exit: '#6fd25a', area: '#e8e2d6', monster: '#ff7a66', npc: '#ffd88c' };
  let canvas, data = null, lay = null, figs = [], over = { sel: null, hover: null, drag: null };

  function init(el) {
    canvas = el;
    Stage.init(canvas, { screen: '2d' });     // its overlay draws strokes and dashes, which the GL screen layer doesn't do
    Stage.on('screen', draw);
    canvas.addEventListener('wheel', zoom, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', e => { if (e.button === 2) pan(e); });
  }

  // Builds and shows a map. gameLight: as dark as in the game; otherwise in daylight, to see what you place.
  function show(mapData, gameLight) {
    data = mapData;
    const m = Maps.build(data);
    if (!gameLight) Object.assign(m.settings, { underground: false, timeOfDay: 12, dayCycle: false });
    Stage.setMap(m);
    Squares.setWorld(Stage.getWorld());
    refresh();
  }

  // After a change that doesn't touch the map itself: positions, figures.
  function refresh() {
    lay = Maps.layout(data, Stage.getMap());
    Figures.clear();
    figs = [];
    for (const o of data.monsters || []) {
      const seed = o.seed === 'torch' ? torchSeed() : +o.seed || 1;
      figs.push({ item: o, f: Figures.add({ name: o.name, key: AdvFile.artOf(o.sheet), seed, ...Squares.feet(...o.sq), dir: 'west', side: 'enemy', creature: { label: o.name } }) });
    }
    for (const o of data.npcs || []) {
      const sq = lay.at(o.at), seed = o.seed || seedWhere(s => Villagers.roleOf(s) === (o.role || 'folk'));
      figs.push({ item: o, f: Figures.add({ name: o.name, key: o.key || 'villager', seed, ...Squares.feet(sq.sx, sq.sy), dir: 'south', side: 'npc', creature: { label: o.name } }) });
    }
  }

  function seedWhere(test) { for (let s = 1; s < 20000; s++) if (test(s)) return s; return 1; }
  let torch = 0;
  const torchSeed = () => torch || (torch = seedWhere(s => !!CharacterArt.get('goblin', s).light));

  // ---------- Where things are ----------

  // Every placed thing with its squares: { kind, item, squares, label }.
  function things() {
    if (!data) return [];
    const one = (kind, item, sq, label) => ({ kind, item, squares: [{ sx: sq[0], sy: sq[1] }], label });
    const out = [];
    (data.monsters || []).forEach(o => out.push(one('monster', o, o.sq, o.name)));
    (data.npcs || []).forEach(o => { const s = lay.at(o.at); out.push(one('npc', o, [s.sx, s.sy], o.name)); });
    (data.doors || []).forEach(o => out.push(one('door', o, o.sq, o.locked ? 'locked' : 'door')));
    (data.chests || []).forEach(o => out.push(one('chest', o, o.sq, 'chest')));
    (data.traps || []).forEach(o => out.push(one('trap', o, o.sq, o.name || 'trap')));
    Object.entries(data.spots || {}).forEach(([name, o]) => { const s = lay.at(o); out.push({ kind: 'spot', item: o, name, squares: [s], label: name }); });
    lay.exits.forEach((e, k) => out.push({ kind: 'exit', item: data.exits[k], squares: e.squares, label: 'to ' + (e.to || '?') }));
    lay.areas.forEach((a, k) => out.push({ kind: 'area', item: data.areas[k], squares: rectSquares(a.rect), rect: a.rect, label: 'room' }));
    return out;
  }

  function rectSquares([x0, y0, x1, y1]) {
    const out = [];
    for (let sy = y0; sy <= y1; sy++) for (let sx = x0; sx <= x1; sx++) out.push({ sx, sy });
    return out;
  }

  // The things on a square, the small ones first (an area or exit last, so a monster in a room is picked).
  function at(sq) {
    const order = ['monster', 'npc', 'door', 'chest', 'trap', 'spot', 'exit', 'area'];
    return things().filter(t => t.squares.some(s => s.sx === sq.sx && s.sy === sq.sy)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  }

  // The square under the mouse.
  function squareAt(e) {
    const r = canvas.getBoundingClientRect(), c = Stage.cam;
    return { sx: Math.floor((e.clientX - r.left - c.panX) / c.zoom / S), sy: Math.floor((e.clientY - r.top - c.panY) / c.zoom / S) };
  }

  function inside(sq) { const { cols, rows } = Squares.size(); return sq.sx >= 0 && sq.sy >= 0 && sq.sx < cols && sq.sy < rows; }

  // ---------- Camera ----------

  function zoom(e) {
    e.preventDefault();
    const c = Stage.cam, r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const z = Math.max(1, Math.min(16, c.zoom + (e.deltaY < 0 ? 1 : -1)));
    if (z === c.zoom) return;
    c.panX = Math.round(mx - (mx - c.panX) * z / c.zoom);
    c.panY = Math.round(my - (my - c.panY) * z / c.zoom);
    c.zoom = z;
  }

  function pan(e) {
    const c = Stage.cam, x0 = e.clientX - c.panX, y0 = e.clientY - c.panY;
    const move = m => { c.panX = m.clientX - x0; c.panY = m.clientY - y0; };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // ---------- Drawing ----------

  function box(c2d, sq, color, fill) {
    const z = Stage.cam.zoom, p = Stage.toScreen(sq.sx * S, sq.sy * S);
    if (fill) { c2d.fillStyle = fill; c2d.fillRect(p.x, p.y, S * z, S * z); }
    if (color) { c2d.strokeStyle = color; c2d.lineWidth = Math.max(1, z / 3); c2d.strokeRect(p.x + 0.5, p.y + 0.5, S * z - 1, S * z - 1); }
  }

  function rectBox(c2d, [x0, y0, x1, y1], color, fill, dash) {
    const z = Stage.cam.zoom, p = Stage.toScreen(x0 * S, y0 * S), w = (x1 - x0 + 1) * S * z, h = (y1 - y0 + 1) * S * z;
    if (fill) { c2d.fillStyle = fill; c2d.fillRect(p.x, p.y, w, h); }
    c2d.setLineDash(dash ? [4, 3] : []);
    c2d.strokeStyle = color; c2d.lineWidth = 1;
    c2d.strokeRect(p.x + 0.5, p.y + 0.5, w - 1, h - 1);
    c2d.setLineDash([]);
  }

  function label(c2d, text, sq, color, below) {
    const z = Stage.cam.zoom, s = Math.max(1, Math.round(z / 3)), p = Stage.toScreen(sq.sx * S + S / 2, sq.sy * S + (below ? S + 1 : -1));
    Popups.text(c2d, text, Math.round(p.x), Math.round(p.y) - (below ? 0 : 6 * s), s, color, 0.9);
  }

  function draw(c2d) {
    if (!data) return;
    c2d.save();
    const list = things();
    for (const t of list) {
      if (t.kind === 'area') rectBox(c2d, t.rect, 'rgba(232, 226, 214, 0.5)', 'rgba(232, 226, 214, 0.05)', true);
      else if (t.kind === 'exit') { t.squares.forEach(s => box(c2d, s, null, 'rgba(111, 210, 90, 0.28)')); label(c2d, t.label, t.squares[0], COLOR.exit); }
    }
    for (const t of list) {
      const sq = t.squares[0];
      if (t.kind === 'door' || t.kind === 'chest') { box(c2d, sq, COLOR[t.kind]); label(c2d, t.label, sq, COLOR[t.kind], true); }
      else if (t.kind === 'trap') { cross(c2d, sq); label(c2d, t.label, sq, COLOR.trap, true); }
      else if (t.kind === 'spot') { diamond(c2d, sq); label(c2d, t.label, sq, COLOR.spot, true); }
    }
    Figures.draw(c2d);
    for (const { item, f } of figs) {
      const sq = Squares.of(f);
      label(c2d, item.name + (item.group ? ` ${item.group}` : ''), sq, f.side === 'npc' ? COLOR.npc : COLOR.monster, true);
    }
    if (over.hover && inside(over.hover)) box(c2d, over.hover, 'rgba(255, 255, 255, 0.5)');
    if (over.drag) rectBox(c2d, over.drag, '#f0a640', 'rgba(240, 166, 64, 0.15)');
    if (over.sel) {
      const t = list.find(t => t.item === over.sel.item);
      if (t) t.rect ? rectBox(c2d, t.rect, '#f0a640') : t.squares.forEach(s => box(c2d, s, '#f0a640'));
    }
    c2d.restore();
  }

  function cross(c2d, sq) {
    const z = Stage.cam.zoom, p = Stage.toScreen(sq.sx * S, sq.sy * S), w = S * z;
    c2d.strokeStyle = COLOR.trap; c2d.lineWidth = Math.max(1, z / 3);
    c2d.beginPath(); c2d.moveTo(p.x + w * 0.2, p.y + w * 0.2); c2d.lineTo(p.x + w * 0.8, p.y + w * 0.8);
    c2d.moveTo(p.x + w * 0.8, p.y + w * 0.2); c2d.lineTo(p.x + w * 0.2, p.y + w * 0.8); c2d.stroke();
  }

  function diamond(c2d, sq) {
    const z = Stage.cam.zoom, p = Stage.toScreen(sq.sx * S + S / 2, sq.sy * S + S / 2), r = S * z * 0.4;
    c2d.fillStyle = 'rgba(127, 180, 255, 0.35)'; c2d.strokeStyle = COLOR.spot; c2d.lineWidth = Math.max(1, z / 4);
    c2d.beginPath(); c2d.moveTo(p.x, p.y - r); c2d.lineTo(p.x + r, p.y); c2d.lineTo(p.x, p.y + r); c2d.lineTo(p.x - r, p.y); c2d.closePath();
    c2d.fill(); c2d.stroke();
  }

  return {
    init, show, refresh, things, at, squareAt, inside, set: o => Object.assign(over, o),
    layout: () => lay, data: () => data,
  };
})();
