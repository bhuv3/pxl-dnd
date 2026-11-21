// Draws editor graphics on top of the map: cursor, stroke preview, selection.
const Overlay = (() => {

  // Draws the overlay in screen space.
  function draw(ctx) {
    const st = Tools.state;
    if (Renderer.getView() === 'plan') drawPlanObjects(ctx);
    if (st.selection) drawSelection(ctx, st.selection);
    if (st.tool === 'drop' && Renderer.getWorld()) Renderer.getWorld().riverPaths.forEach(p => drawDrops(ctx, p));
    if (st.stroke) drawStroke(ctx, st);
    if (st.drag) drawDragGhost(ctx, st.drag);
    if (st.ruler) Tabletop.drawRuler(ctx, Renderer.getMap(), st.ruler);
    if (!Input.isInside() || App.isFullscreen()) return;
    if (st.tool === 'brush' || st.tool === 'eraser' || (st.tool === 'line' && !st.stroke)) drawBrushCursor(ctx, st.brushSize);
    if (st.tool === 'stamp') drawStampGhost(ctx, st);
  }

  // How far up a map pixel is drawn (raised ground, Rendered view only).
  function lift(x, y) { return Renderer.getView() === 'rendered' ? Height.liftAt(Renderer.getWorld(), x, y) : 0; }

  // Draws a sprite at a map position, semi-transparent.
  function drawGhost(ctx, sprite, x, y, alpha) {
    const z = Viewport.state.zoom;
    const c = Sprites.toCanvas(sprite);
    const s = Viewport.toScreen(x + sprite.box.minX, y + sprite.box.minY - lift(x, y));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, s.x, s.y, c.width * z, c.height * z);
    ctx.restore();
  }

  // Preview of the next object under the cursor. Red ring when it can't go there.
  function drawStampGhost(ctx, st) {
    const p = Input.pointer;
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (!Renderer.getWorld()) return;
    const ok = Tools.canPlace(x, y, st.stampType);
    if (ok && st.stampType === 'door') drawDoorGhost(ctx, x, y);
    else drawGhost(ctx, Sprites.get(st.stampType, st.stampSeed, 1, st.stampTurn), x, y, ok ? 0.75 : 0.3);
    if (!ok) {
      const c = Viewport.toScreen(x + 0.5, y + 0.5 - lift(x, y));
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(220, 40, 40, 0.9)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4 * Viewport.state.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // A door fitted to the gap under the cursor, where it will snap.
  function drawDoorGhost(ctx, x, y) {
    const fit = Doors.fit(Renderer.getWorld(), x, y);
    const [sx, sy] = Doors.spot(fit);
    drawGhost(ctx, Doors.sprite(fit, Sprites.palette(), false), sx, sy, 0.8);
  }

  // The object or area being dragged, at its new position.
  function drawDragGhost(ctx, d) {
    if (d.area) return;
    const o = Renderer.getMap().objects.find(ob => ob.id === d.id);
    if (!o || (d.x === d.ox && d.y === d.oy)) return;
    drawGhost(ctx, Sprites.get(o.type, o.seed, o.scale, o.turn), d.x, d.y, Tools.canPlace(d.x, d.y, o.type) ? 0.8 : 0.3);
  }

  // Small dots for placed objects in Plan view.
  function drawPlanObjects(ctx) {
    const colors = Types.OBJECT_COLORS;
    const r = Math.max(2, Viewport.state.zoom * 1.5);
    ctx.save();
    for (const o of Renderer.getMap().objects) {
      const c = Viewport.toScreen(o.x + 0.5, o.y + 0.5);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * o.scale, 0, Math.PI * 2);
      ctx.fillStyle = colors[o.type];
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.stroke();
    }
    ctx.restore();
  }

  // Preview color for the current tool and material, at the given opacity.
  function previewColor(st, alpha) {
    if (st.tool === 'eraser') return `rgba(255, 255, 255, ${alpha})`;
    const hex = st.tool === 'river' ? Types.RIVER_PLAN : Types.material(st.material).plan;
    const [r, g, b] = Colors.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Map point → screen point at the pixel's center.
  function screen([x, y]) { return Viewport.toScreen(x + 0.5, y + 0.5 - lift(x, y)); }

  // The stroke being drawn: a thick line, or a filled shape for the lasso.
  function drawStroke(ctx, st) {
    const z = Viewport.state.zoom;
    const pts = st.stroke.map(screen);
    if (!pts.length) return;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    if (st.tool === 'rect') {
      drawRectPreview(ctx, st);
      ctx.restore();
      return;
    }
    if (st.tool === 'lasso') {
      ctx.closePath();
      ctx.fillStyle = previewColor(st, 0.35);
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke();
    } else {
      if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
      const width = st.tool === 'river' ? Renderer.getMap().settings.riverWidth : st.brushSize;
      ctx.lineWidth = Math.max(1, width * z);
      ctx.strokeStyle = previewColor(st, st.tool === 'river' ? 0.6 : 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The rectangle being dragged: filled, or its outline at the wall thickness.
  function drawRectPreview(ctx, st) {
    const [a, b] = [st.stroke[0], st.stroke[st.stroke.length - 1]];
    const p = Viewport.toScreen(Math.min(a[0], b[0]), Math.min(a[1], b[1]));
    const q = Viewport.toScreen(Math.max(a[0], b[0]) + 1, Math.max(a[1], b[1]) + 1);
    const z = Viewport.state.zoom, t = Math.min(st.brushSize * z, (q.x - p.x) / 2, (q.y - p.y) / 2);
    ctx.fillStyle = previewColor(st, 0.5);
    if (st.rectMode === 'fill') ctx.fillRect(p.x, p.y, q.x - p.x, q.y - p.y);
    else {
      ctx.fillRect(p.x, p.y, q.x - p.x, t); ctx.fillRect(p.x, q.y - t, q.x - p.x, t);
      ctx.fillRect(p.x, p.y + t, t, q.y - p.y - 2 * t); ctx.fillRect(q.x - t, p.y + t, t, q.y - p.y - 2 * t);
    }
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeRect(p.x, p.y, q.x - p.x, q.y - p.y);
  }

  // Circle showing the brush size under the mouse.
  function drawBrushCursor(ctx, size) {
    const p = Input.pointer;
    const c = Viewport.toScreen(Math.floor(p.x) + 0.5, Math.floor(p.y) + 0.5 - lift(p.x, p.y));
    const r = Math.max(2, size * Viewport.state.zoom / 2);
    ring(ctx, c.x, c.y, r);
  }

  // Black and white ring, visible on any background.
  function ring(ctx, x, y, r) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r - 1), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();
    ctx.restore();
  }

  // Dashed box around the selected object.
  function drawObjectSelection(ctx, sel) {
    const world = Renderer.getWorld();
    const actor = Actors.get(sel.id), animal = Animals.get(sel.id);
    const t = actor ? { x: Math.floor(actor.x), y: Math.floor(actor.y), sprite: CharacterArt.ghost(actor.type, actor.seed) }
      : animal ? { x: Math.floor(animal.x), y: Math.floor(animal.y), sprite: Animals.ghost(animal.type) }
      : world.things.find(th => th.kind === 'object' && th.id === sel.id);
    if (!t) return;
    const b = t.sprite.box, up = lift(t.x, t.y);
    const a = Viewport.toScreen(t.x + b.minX - 1, t.y + b.minY - 1 - up);
    const c = Viewport.toScreen(t.x + b.maxX + 2, t.y + b.maxY + 2 - up);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeRect(a.x, a.y, c.x - a.x, c.y - a.y);
    ctx.restore();
  }

  // Light fill over the selected area, following the mouse while it's dragged.
  function drawAreaSelection(ctx, sel) {
    const map = Renderer.getMap();
    const d = Tools.state.drag;
    const dx = d && d.area ? d.dx : 0, dy = d && d.area ? d.dy : 0;
    const z = Viewport.state.zoom;
    const s = Viewport.toScreen(dx, dy);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(Areas.canvas(sel, map.width, map.height), s.x, s.y, map.width * z, map.height * z);
    ctx.restore();
  }

  // Highlights the selected river, object, or area.
  function drawSelection(ctx, sel) {
    const world = Renderer.getWorld();
    if (!world) return;
    if (sel.type === 'object') { drawObjectSelection(ctx, sel); return; }
    if (sel.type === 'area') { drawAreaSelection(ctx, sel); return; }
    const path = world.riverPaths.find(p => p.id === sel.id);
    if (!path) return;
    const z = Viewport.state.zoom;
    const avg = path.pts.reduce((a, p) => a + p.hw, 0) / path.pts.length;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    path.pts.forEach((p, i) => {
      const s = Viewport.toScreen(p.x + 0.5, p.y + 0.5 - lift(p.x, p.y));
      i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
    });
    ctx.lineWidth = (avg * 2 + 3) * z;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.stroke();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();
    ctx.restore();
    drawDrops(ctx, path);
  }

  // A line across the river at each drop (where it falls a level), at the height of the water above it.
  function drawDrops(ctx, path) {
    const z = Viewport.state.zoom;
    ctx.save();
    ctx.lineCap = 'round';
    for (const d of path.drops) {
      const r = d.hw + 2, up = lift(d.x - d.tx * 2, d.y - d.ty * 2);
      const a = Viewport.toScreen(d.x + 0.5 - d.ty * r, d.y + 0.5 + d.tx * r - up);
      const b = Viewport.toScreen(d.x + 0.5 + d.ty * r, d.y + 0.5 - d.tx * r - up);
      for (const [width, color] of [[Math.max(4, z * 1.6), 'rgba(0, 0, 0, 0.6)'], [Math.max(2, z * 0.8), 'rgba(255, 255, 255, 0.95)']]) {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  return { draw };
})();
