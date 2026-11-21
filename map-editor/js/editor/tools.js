// Editing tools and the current tool/material selection.
const Tools = (() => {
  const LIST = [
    { id: 'brush',  name: 'Brush',  key: 'B' },
    { id: 'lasso',  name: 'Lasso',  key: 'L' },
    { id: 'line',   name: 'Line',   key: 'N' },
    { id: 'rect',   name: 'Rectangle', key: 'M' },
    { id: 'bucket', name: 'Bucket', key: 'G' },
    { id: 'eraser', name: 'Eraser', key: 'E' },
    { id: 'river',  name: 'River',  key: 'R' },
    { id: 'stamp',  name: 'Stamp',  key: 'T' },
    { id: 'select', name: 'Select', key: 'V' },
    { id: 'measure', name: 'Measure', key: 'U' },
    { id: 'drop',   name: 'Lower river', key: 'W', group: 'Height' },   // listed under Height in the toolbar
  ];

  const state = {
    tool: 'brush',
    material: 'grass',
    brushSize: 12,
    eraserTarget: 'all',
    rectMode: 'outline',   // rectangle tool: 'outline' (walls) or 'fill'
    stroke: null,          // points [[x, y], …] while the mouse is down
    selection: null,       // { type: 'river' | 'object', id } or an area from Areas.pick
    stampType: 'tree',
    stampSeed: Random.newSeed(),
    stampTurn: 0,          // how many quarters the next stamp is turned (things that can turn: 0–1, a house 0–3)
    drag: null,            // object being moved with the select tool
    ruler: null,           // { from, to } map points while measuring
  };
  const MIN_GAP = 4;       // objects closer than this get nudged apart
  const listeners = [];

  // Calls fn whenever the tool, material, selection, or an option changes.
  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(fn => fn()); Input.updateCursor(); Renderer.requestPresent(); }

  function setTool(id) {
    if (!LIST.some(t => t.id === id)) return;
    state.tool = id;
    state.stroke = null;
    state.ruler = null;
    if (id !== 'select') state.selection = null;
    notify();
  }

  const MATERIAL_TOOLS = ['brush', 'lasso', 'bucket', 'line', 'rect'];

  function setMaterial(id) {
    state.material = id;
    if (!MATERIAL_TOOLS.includes(state.tool)) state.tool = 'brush';
    state.selection = null;
    notify();
  }

  function setOption(key, value) { state[key] = value; notify(); }

  // Map pixel under the pointer, or null when outside the map.
  function pixelAt(p) {
    const map = Renderer.getMap();
    const x = Math.floor(p.x), y = Math.floor(p.y);
    return x < 0 || y < 0 || x >= map.width || y >= map.height ? null : [x, y];
  }

  // Adds a point to the current stroke, skipping duplicates.
  function addPoint(p) {
    const map = Renderer.getMap();
    const pt = [
      Math.max(-50, Math.min(map.width + 50, Math.floor(p.x))),
      Math.max(-50, Math.min(map.height + 50, Math.floor(p.y))),
    ];
    const last = state.stroke[state.stroke.length - 1];
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) state.stroke.push(pt);
  }

  // Mouse down: start a stroke, fill, or select.
  function down(p, e) {
    if (e.button !== 0 || !Renderer.getMap()) return;
    if (state.tool === 'bucket') { bucketFill(p); return; }
    if (state.tool === 'select') { select(p, e); return; }
    if (state.tool === 'stamp') { placeObject(p); return; }
    if (state.tool === 'drop') { toggleDrop(p); return; }
    if (state.tool === 'measure') { state.ruler = { from: [p.x, p.y], to: [p.x, p.y], dragging: true }; return; }
    state.stroke = [];
    addPoint(p);
  }

  function move(p, e) {
    if (state.ruler && state.ruler.dragging) state.ruler.to = [p.x, p.y];
    if (state.stroke && (state.tool === 'line' || state.tool === 'rect')) shapeTo(p, e && e.shiftKey);
    else if (state.stroke) addPoint(p);
    if (state.drag) dragTo(p);
  }

  // Line and rectangle keep just two points: start and end. Shift snaps lines to 45° and makes squares.
  function shapeTo(p, snap) {
    const [x0, y0] = state.stroke[0];
    let x = Math.floor(p.x), y = Math.floor(p.y);
    if (snap && state.tool === 'line') {
      const a = Math.round(Math.atan2(y - y0, x - x0) / (Math.PI / 4)) * Math.PI / 4;
      const len = Math.hypot(x - x0, y - y0);
      x = Math.round(x0 + Math.cos(a) * len); y = Math.round(y0 + Math.sin(a) * len);
    } else if (snap) {
      const d = Math.max(Math.abs(x - x0), Math.abs(y - y0));
      x = x0 + Math.sign(x - x0 || 1) * d; y = y0 + Math.sign(y - y0 || 1) * d;
    }
    state.stroke = [state.stroke[0], [x, y]];
  }

  // Mouse up: turn the stroke into pixels or a river, or finish moving an object. A ruler stays until the next click.
  function up() {
    if (state.drag) { finishDrag(); return; }
    if (state.ruler) { state.ruler.dragging = false; return; }
    const pts = state.stroke;
    state.stroke = null;
    if (!pts) return;
    const map = Renderer.getMap();
    const size = { width: state.brushSize };
    if (state.tool === 'brush') applyMaterial(Grid.maskFromPath(map.width, map.height, pts, size), pts[0]);
    else if (state.tool === 'eraser') erase(Grid.maskFromPath(map.width, map.height, pts, size));
    else if (state.tool === 'lasso' && pts.length >= 3) applyMaterial(Grid.maskFromPath(map.width, map.height, pts, { closed: true }), pts[0]);
    else if (state.tool === 'river') addRiver(pts);
    else if (state.tool === 'line') applyMaterial(Grid.maskFromPath(map.width, map.height, pts.length > 1 ? pts : [pts[0], pts[0]], size), pts[0]);
    else if (state.tool === 'rect') applyMaterial(rectMask(map, pts), pts[0]);
  }

  // Pixels of the rectangle between the stroke's two points: filled, or an outline brushSize thick.
  function rectMask(map, pts) {
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const x0 = Math.max(0, Math.min(a[0], b[0])), x1 = Math.min(map.width - 1, Math.max(a[0], b[0]));
    const y0 = Math.max(0, Math.min(a[1], b[1])), y1 = Math.min(map.height - 1, Math.max(a[1], b[1]));
    const t = state.brushSize, fill = state.rectMode === 'fill';
    const mask = new Uint8Array(map.width * map.height);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (fill || x - x0 < t || x1 - x < t || y - y0 < t || y1 - y < t) mask[y * map.width + x] = 1;
      }
    }
    return mask;
  }

  // Fills the connected area under the cursor with the current material.
  function bucketFill(p) {
    const map = Renderer.getMap();
    const px = pixelAt(p);
    if (!px) return;
    const key = i => map.water[i] ? 100 + map.water[i] : map.ground[i] * 10 + map.scatter[i];
    applyMaterial(Grid.floodFill(map.width, map.height, key, px[0], px[1]), px);
  }

  // Writes the current material wherever mask is set. start: where the stroke began (Flatten keeps the height there).
  // Raise and Lower change the slope level and undo any flattening; Flatten makes a cliff-edged terrace.
  function applyMaterial(mask, start) {
    const map = Renderer.getMap();
    const m = Types.material(state.material);
    if (!hasAny(mask)) return;
    const flat = m.op === 'flat' ? levelAt(start) + 1 : 0;
    History.record(map);
    const layer = map[m.layer];
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      if (m.op === 'add') { layer[i] = Math.max(0, Math.min(Types.MAX_LEVEL, layer[i] + m.value)); map.terrace[i] = 0; }
      else layer[i] = m.op === 'flat' ? flat : m.value;
      if (m.layer === 'ground') map.water[i] = 0;   // painting land replaces water
    }
    changed();
  }

  // Whole height level of the ground drawn at a map point (0 off the map or under water).
  function levelAt(pt) {
    const world = Renderer.getWorld(), map = Renderer.getMap();
    if (!pt || !world) return 0;
    const L = Height.liftAt(world, pt[0], pt[1]);
    return Math.max(0, Math.min(Types.MAX_LEVEL, Math.round(L / map.settings.levelHeight)));
  }

  // Lower river: a click on a river drops it a level from there on downstream (a waterfall forms);
  // a click on an existing drop takes it away.
  function toggleDrop(p) {
    const map = Renderer.getMap(), world = Renderer.getWorld();
    let best = null, bestD = 4;
    for (const path of world.riverPaths) {
      const d = Rivers.hitDistance(path, p.x, p.y);
      if (d < bestD) { bestD = d; best = path; }
    }
    if (!best) { Renderer.flashMessage('Click on a river to lower it from there on'); return; }
    const river = map.rivers.find(r => r.id === best.id), drops = river.drops || [];
    const old = drops.findIndex(([x, y]) => Math.hypot(x - p.x, y - p.y) < 6);
    if (old < 0 && drops.length >= Types.MAX_DROPS) { Renderer.flashMessage(`A river can drop ${Types.MAX_DROPS} levels at most`); return; }
    History.record(map);
    if (old >= 0) river.drops = drops.filter((d, k) => k !== old);
    else {
      const pt = best.pts.reduce((a, b) => Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a);
      river.drops = [...drops, [Math.round(pt.x), Math.round(pt.y)]];
    }
    changed();
  }

  // Clears the chosen layers wherever mask is set.
  function erase(mask) {
    const map = Renderer.getMap();
    if (!hasAny(mask)) return;
    History.record(map);
    const t = state.eraserTarget;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      if (t === 'all' || t === 'water') map.water[i] = 0;
      if (t === 'all' || t === 'scatter') map.scatter[i] = 0;
      if (t === 'all' || t === 'ground') map.ground[i] = Types.GROUND.DIRT;
      if (t === 'all' || t === 'elevation') map.elevation[i] = map.terrace[i] = 0;
    }
    changed();
  }

  // Stores a freeform stroke as a river, dropping points closer than 2 pixels.
  function addRiver(pts) {
    const map = Renderer.getMap();
    const kept = [pts[0]];
    for (const p of pts) {
      const last = kept[kept.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) kept.push(p);
    }
    if (kept.length < 2) return;
    const s = map.settings;
    History.record(map);
    const id = MapModel.nextId(map);
    map.rivers.push({ id, points: kept, width: s.riverWidth, meander: s.riverMeander, wobble: s.riverWidthWobble, seed: Random.newSeed() });
    changed();
  }

  // True if an object of this type may stand on this pixel: in water for ducks, on dry ground for the rest.
  function canPlace(x, y, type) {
    const world = Renderer.getWorld();
    const map = Renderer.getMap();
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const i = y * map.width + x;
    const fresh = world && world.w === map.width;
    if (map.water[i] === Types.WATER.CHASM || (fresh && world.chasm[i] && !world.span[i])) return false;
    const wet = !!map.water[i] || !!(fresh && world.water[i]);
    if (type === 'door') return !wet && !!Doors.fit(world, x, y);
    return Animals.isAquatic(type) ? wet : !wet;
  }

  // Why an object can't go somewhere.
  function placeError(type, x, y) {
    const map = Renderer.getMap(), world = Renderer.getWorld();
    const i = y * map.width + x;
    if (map.water[i] === Types.WATER.CHASM || (world && world.chasm && world.chasm[i])) return 'Objects can’t be placed over a chasm';
    if (type === 'door') return 'Doors go in a gap between two walls';
    return Animals.isAquatic(type) ? 'Ducks need water' : 'Objects can’t be placed in water';
  }

  // Final spot for an object: doors snap into their gap, everything else is nudged off its neighbors.
  function settle(x, y, type, ignoreId) {
    return type === 'door' ? Doors.spot(Doors.fit(Renderer.getWorld(), x, y)) : nudge(x, y, type, ignoreId);
  }

  // Moves a spot away from nearby objects, up to 4 pixels. Returns the original spot if nothing is free.
  function nudge(x, y, type, ignoreId) {
    const others = Renderer.getMap().objects.filter(o => o.id !== ignoreId);
    const free = (px, py) => canPlace(px, py, type) && others.every(o => Math.hypot(o.x - px, o.y - py) >= MIN_GAP);
    if (free(x, y)) return [x, y];
    for (let r = 1; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(x + dx, y + dy)) return [x + dx, y + dy];
        }
      }
    }
    return [x, y];
  }

  // Drops the stamp's object at the cursor, then picks a new look for the next one.
  function placeObject(p) {
    const px = pixelAt(p);
    if (!px) return;
    if (!canPlace(px[0], px[1], state.stampType)) { Renderer.flashMessage(placeError(state.stampType, px[0], px[1])); return; }
    const [x, y] = settle(px[0], px[1], state.stampType);
    const map = Renderer.getMap();
    History.record(map);
    const obj = { id: MapModel.nextId(map), type: state.stampType, x, y, seed: state.stampSeed, scale: 1 };
    const turn = state.stampTurn % Props.turns(obj.type);
    if (turn) obj.turn = turn;
    map.objects.push(obj);
    state.stampSeed = Random.newSeed();
    changed();
  }

  // Placed object under the cursor, front-most first.
  function hitObject(p) {
    const world = Renderer.getWorld();
    const x = Math.floor(p.x), y = Math.floor(p.y);
    for (let k = world.things.length - 1; k >= 0; k--) {
      const t = world.things[k];
      if (t.kind === 'object' && t.id && t.sprite.hit.has((x - t.x) + ',' + (y - t.y))) return t.id;
    }
    return null;
  }

  // Starts dragging the selected object.
  function startDrag(id, p) {
    const o = Renderer.getMap().objects.find(ob => ob.id === id);
    state.drag = { id, sx: p.x, sy: p.y, ox: o.x, oy: o.y, x: o.x, y: o.y };
  }

  function dragTo(p) {
    const d = state.drag;
    d.dx = Math.round(p.x - d.sx);
    d.dy = Math.round(p.y - d.sy);
    if (!d.area) { d.x = d.ox + d.dx; d.y = d.oy + d.dy; }
  }

  // Commits the move: an area moves anywhere, an object only to a dry spot.
  function finishDrag() {
    const d = state.drag;
    state.drag = null;
    if (d.area) {
      if ((!d.dx && !d.dy) || !selectedArea()) return;
      History.record(Renderer.getMap());
      state.selection = Areas.move(Renderer.getMap(), state.selection, d.dx, d.dy);
      changed();
      return;
    }
    if (d.x === d.ox && d.y === d.oy) return;
    const map = Renderer.getMap();
    const o = map.objects.find(ob => ob.id === d.id);
    if (!canPlace(d.x, d.y, o.type)) { Renderer.flashMessage(placeError(o.type, d.x, d.y)); return; }
    History.record(map);
    [o.x, o.y] = settle(d.x, d.y, o.type, d.id);
    changed();
  }

  // Picks the character, animal, object, river, or painted area under the cursor (in that order).
  function select(p, e) {
    const charId = Actors.hit(p.x, p.y);
    if (charId) Actors.pin(Renderer.getMap(), charId);
    const animalId = !charId && Animals.hit(p.x, p.y);
    if (animalId) Animals.pin(Renderer.getMap(), animalId);
    const objId = charId || animalId || hitObject(p);
    if (objId) {
      state.selection = { type: 'object', id: objId };
      startDrag(objId, p);
      notify();
      return;
    }
    const world = Renderer.getWorld();
    let best = null, bestD = 3;
    for (const path of world.riverPaths) {
      const d = Rivers.hitDistance(path, p.x, p.y);
      if (d < bestD) { bestD = d; best = { type: 'river', id: path.id }; }
    }
    if (!best) {
      const px = pixelAt(p);
      if (px) {
        best = Areas.pick(Renderer.getMap(), px[0], px[1], e.shiftKey);
        state.drag = { area: true, sx: p.x, sy: p.y, dx: 0, dy: 0 };
      }
    }
    state.selection = best;
    notify();
  }

  // The selected painted area, if any.
  function selectedArea() {
    const sel = state.selection;
    return sel && sel.type === 'area' ? sel : null;
  }

  // Turns the selected area into another material.
  function changeSelection(materialId) {
    const area = selectedArea();
    if (!area) return false;
    History.record(Renderer.getMap());
    state.selection = Areas.change(Renderer.getMap(), area, Types.material(materialId));
    changed();
    return true;
  }

  // The selected river object from the map, if any.
  function selectedRiver() {
    const sel = state.selection;
    if (!sel || sel.type !== 'river') return null;
    return Renderer.getMap().rivers.find(r => r.id === sel.id) || null;
  }

  // The selected placed object, if any.
  function selectedObject() {
    const sel = state.selection;
    if (!sel || sel.type !== 'object') return null;
    return Renderer.getMap().objects.find(o => o.id === sel.id) || null;
  }

  // Removes the selected river or object.
  function deleteSelection() {
    const sel = state.selection;
    if (!sel) return false;
    const map = Renderer.getMap();
    History.record(map);
    if (sel.type === 'river') map.rivers = map.rivers.filter(r => r.id !== sel.id);
    else if (sel.type === 'area') Areas.erase(map, sel);
    else map.objects = map.objects.filter(o => o.id !== sel.id);
    state.selection = null;
    changed();
    return true;
  }

  // Grows or shrinks the selection (river width, object scale, or area by one pixel).
  function adjustSelection(dir) {
    const river = selectedRiver(), obj = selectedObject(), area = selectedArea();
    if (!river && !obj && !area) return false;
    History.record(Renderer.getMap());
    if (area) state.selection = Areas.resize(Renderer.getMap(), area, dir);
    else if (river) river.width = Math.max(2, Math.min(40, river.width + dir));
    else obj.scale = Math.round(Math.max(0.5, Math.min(2, obj.scale + dir * 0.1)) * 10) / 10;
    changed();
    return true;
  }

  // Gives the selected object a new random look.
  function rerollSelection() {
    const obj = selectedObject();
    if (!obj) return false;
    History.record(Renderer.getMap());
    obj.seed = Random.newSeed();
    changed();
    return true;
  }

  // Turns the selected object a quarter, or the next stamp (a house goes round four ways, furniture two). False when it can't turn.
  function turnSelection() {
    const obj = selectedObject();
    if (obj) {
      if (!Props.canTurn(obj.type)) return false;
      History.record(Renderer.getMap());
      const turn = ((obj.turn || 0) + 1) % Props.turns(obj.type);
      if (turn) obj.turn = turn; else delete obj.turn;
      changed();
      return true;
    }
    if (state.tool !== 'stamp' || !Props.canTurn(state.stampType)) return false;
    setOption('stampTurn', (state.stampTurn + 1) % Props.turns(state.stampType));
    return true;
  }

  function hasAny(mask) { for (let i = 0; i < mask.length; i++) if (mask[i]) return true; return false; }

  // After any edit: re-render and tell listeners.
  function changed() {
    const map = Renderer.getMap();
    const sel = state.selection;
    if (sel && sel.type === 'area') {
      if (!Areas.isValid(map, sel)) state.selection = null;
    } else if (sel && !(sel.type === 'river' ? map.rivers : map.objects).some(r => r.id === sel.id)) {
      state.selection = null;
    }
    Renderer.requestRebuild();
    listeners.forEach(fn => fn());
  }

  // Mouse cursor for the current tool.
  function cursor() {
    if (state.tool === 'bucket') return 'cell';
    if (state.tool === 'select') return 'default';
    return 'crosshair';
  }

  return {
    LIST, MATERIAL_TOOLS, state, onChange, setTool, setMaterial, setOption, down, move, up, cursor, changed,
    deleteSelection, adjustSelection, rerollSelection, turnSelection, changeSelection,
    selectedRiver, selectedObject, selectedArea, canPlace,
  };
})();
