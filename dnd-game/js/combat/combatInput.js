// The player's controls in a fight, shared by every page with combat: hover for paths and hit chances, click a lit
// square to walk or a red-ringed target to act, point an area spell (the squares it covers light up) and click
// to cast, action buttons and keys (1–9, Space, Esc). Keeps the floor overlay, the panels, and the hint up to date.
const CombatInput = (() => {
  let selected = null, hover = { sq: null, fig: null }, el = {}, idleHint = '', choice = { type: 'fire' };

  // els: { stage (canvas), hint }. idle: the hint when it isn't the player's turn.
  function init(els, idle = '') {
    el = els;
    idleHint = idle;
    el.stage.addEventListener('mousemove', e => { hover = under(e); refresh(); });
    el.stage.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    Combat.on('change', refresh);
  }

  // The map square and figure under the mouse.
  function under(e) {
    const r = el.stage.getBoundingClientRect(), c = Stage.cam;
    const mx = (e.clientX - r.left - c.panX) / c.zoom, my = (e.clientY - r.top - c.panY) / c.zoom;
    return { sq: { sx: Math.floor(mx / Squares.SIZE), sy: Math.floor(my / Squares.SIZE) }, fig: Figures.at(mx, my) };
  }

  const live = () => { const s = Combat.state(); return s && !s.over ? s : null; };
  function myTurn() { const s = live(), f = Combat.current(); return s && f && f.side === 'hero' && !s.auto && !s.busy && f.creature.hp > 0 ? f : null; }

  // Click a target to use the chosen action on it, or a lit square to walk there.
  async function onClick(e) {
    const f = myTurn();
    if (!f) return;
    hover = under(e);
    if (selected) {
      const o = Combat.options(f, selected), t = o.ok && o.targets.find(t => t.fig === hover.fig);
      if (o.ok && o.area) {
        if (Combat.areaOf(f, selected, hover.sq).ok) { const id = selected; selected = null; await Combat.act(id, hover.sq); refresh(); }
        return;
      }
      if (t) { const id = selected; selected = null; await Combat.act(id, t.fig, { ...choice }); refresh(); return; }
    }
    if (await Combat.moveTo(hover.sq.sx, hover.sq.sy)) refresh();
  }

  // An action button: aim it (or use it at once if it targets yourself or rolls nothing).
  function pick(id) {
    const f = myTurn();
    if (!f) return;
    if (id === 'end') { selected = null; Combat.endTurn(); return; }
    if (id.startsWith('type:')) { choice.type = id.slice(5); refresh(); return; }
    if (id.startsWith('strike:')) { choice.strike = id.slice(7) === 'none' ? null : id.slice(7); refresh(); return; }   // Cunning Strike          // a damage type (Chromatic Orb, True Strike)
    if (id === 'dash' || id === 'disengage' || id === 'dodge') { Combat[id](); selected = null; }
    else if (id.endsWith(':bonus')) { Combat[id.split(':')[0]](true); selected = null; }   // Cunning Action
    else if (['self', 'party', 'bloodied'].includes(Actions.get(id).target)) { selected = null; Combat.act(id, f).then(refresh); }
    else selected = selected === id ? null : id;
    const types = selected && Actions.get(selected).types;
    if (types && !types.includes(choice.type)) choice.type = Actions.get(selected).type;   // its own default
    refresh();
  }

  function onKey(e) {
    const f = myTurn();
    if (!f || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); pick('end'); return; }
    if (e.code === 'Escape') { selected = null; refresh(); return; }
    const n = +e.key, acts = [...(f.creature.actions || []), 'dash', 'disengage', 'dodge', 'shakeAwake', 'sphereMove', 'spiritualStrike'];
    if (n >= 1 && n <= acts.length) pick(acts[n - 1]);
  }

  // Updates the floor overlay, the panels, and the hint from the fight and the mouse.
  function refresh() {
    const s = live(), f = myTurn();
    let reach = null, path = [], targets = [], area = null, hint = s ? '' : idleHint;
    if (f) {
      if (selected && Combat.options(f, selected).area) {
        ({ area, targets, hint } = aim(f, selected));
      } else if (selected) {
        const o = Combat.options(f, selected);
        targets = o.ok ? o.targets.map(t => t.fig) : [];
        const t = o.ok && o.targets.find(t => t.fig === hover.fig);
        const A = Actions.get(selected), verb = A.target === 'ally' ? (A.kind === 'heal' ? 'heal' : 'work') : ['save', 'condition'].includes(A.kind) ? 'fail the save' : 'hit';
        hint = !o.ok ? o.why : t ? `${t.fig.creature.label}: ${Math.round(t.chance * 100)}% to ${verb}${t.mode && t.mode !== 'normal' ? ` (${t.mode === 'adv' ? 'advantage' : 'disadvantage'})` : ''}. Click to go.` : 'Choose a target (rings). Esc to cancel.';
        if (!o.ok) selected = null;
      } else if (s.turn.move + (s.turn.freeMove || 0) >= 1) {
        reach = Combat.reachable(f);
        const dest = hover.sq && reach.get(Squares.key(hover.sq.sx, hover.sq.sy));
        if (dest && !dest.through && dest.cost > 0) { path = Squares.path(reach, hover.sq.sx, hover.sq.sy); hint = `Walk ${Math.round(dest.cost * 5)} ft.`; }
      }
      if (!hint) hint = 'Click a lit square to move, or pick an action. Space ends your turn.';
    }
    if (s) GridOverlay.set({ reach, path, targets, area, hover: hover.fig, current: s.turn ? s.turn.fig : null });
    else GridOverlay.set({ reach: null, path: [], targets: [], area: null });
    CombatUI.render(s, selected, choice);
    if (s || !el.quiet) el.hint.textContent = hint;
  }

  // An area spell pointed at the square under the mouse: the squares it covers, who it catches, and the hint.
  function aim(f, id) {
    const A = Actions.get(id), name = A.name;
    if (!hover.sq) return { area: null, targets: [], hint: `${name}: point at a square. Esc to cancel.` };
    const r = Combat.areaOf(f, id, hover.sq);
    if (!r.ok) return { area: null, targets: [], hint: `${name}: ${r.why}. Esc to cancel.` };
    if (A.area === 'spot') return { area: r.squares, targets: [], hint: `${name}: click to ${A.kind === 'sphere' ? 'set it here' : 'step here'} (${Math.round(Squares.distance(Squares.of(f), hover.sq) * 5)} ft). Esc to cancel.` };
    if (A.area === 'roll') return { area: r.squares, targets: r.figs, hint: `Roll the sphere${r.figs.length ? ` into ${r.figs[0].creature.label} (a DEX save)` : ` ${Math.round(r.squares.length * 5)} ft`}. Click to roll, Esc to cancel.` };
    const who = r.figs.map(o => o.creature.label + (o.side === f.side ? ' (friend!)' : ''));
    const how = ['around', 'aura'].includes(A.area) ? 'Click anywhere to cast' : `Click to cast, or ${A.area === 'circle' ? 'center it on another square' : 'point it another way'}`;
    return { area: r.squares, targets: r.figs, hint: `${name} catches ${who.length ? who.join(', ') : 'no one'}. ${how}. Esc to cancel.` };
  }

  return { init, pick, refresh, under, live };
})();
