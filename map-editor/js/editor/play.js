// Play mode: steer a character with WASD or the arrow keys while the camera follows.
const Play = (() => {
  const KEYS = {
    KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
  };
  const MARGIN = 0.3;      // keep the character inside the middle of the view
  const held = new Set();
  let active = false, targetId = null, button = null;

  // Hooks up the Play button and key listeners (capture phase, so editor shortcuts don't see them).
  function init(btn) {
    button = btn;
    button.addEventListener('click', toggle);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', e => held.delete(e.code), true);
    window.addEventListener('blur', () => held.clear());
    update();
  }

  // Starts or stops playing. Steers the selected character, or the first hero (not a villager) on the map.
  function toggle() {
    if (active) { stop(); return; }
    const sel = Tools.state.selection;
    const list = Actors.list();
    const pick = (sel && sel.type === 'object' && Actors.get(sel.id)) || list.find(a => !a.wanders) || list[0];
    if (!pick) { Renderer.flashMessage('Place a character first (Objects, Characters in the library)'); return; }
    active = true;
    targetId = pick.id;
    App.setView('rendered');
    update();
  }

  function stop() { active = false; targetId = null; held.clear(); update(); }

  // Button label and status hint.
  function update() {
    button.innerHTML = Icons.svg(active ? 'stop' : 'play', 16) + `<span>${active ? 'Stop' : 'Play'}</span>`;
    button.classList.toggle('active', active);
    Status.message(active ? 'Playing: WASD or arrow keys to walk, Esc to stop' : '');
  }

  function isTyping(e) { return /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName); }

  function onKeyDown(e) {
    if (isTyping(e) || e.ctrlKey || e.metaKey) return;
    if (!active) {
      if (e.code === 'KeyP' && !Dialogs.isOpen()) { toggle(); e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') { stop(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (KEYS[e.code]) { held.add(e.code); e.preventDefault(); e.stopImmediatePropagation(); }
  }

  // { id, dx, dy } for the steered character, or null.
  function steer() {
    if (!active) return null;
    if (!Actors.get(targetId)) { stop(); return null; }
    let dx = 0, dy = 0;
    for (const k of held) { dx += KEYS[k][0]; dy += KEYS[k][1]; }
    return { id: targetId, dx: Math.sign(dx), dy: Math.sign(dy) };
  }

  // Pans the view so the steered character stays away from the edges.
  function follow() {
    if (!active) return;
    const a = Actors.get(targetId);
    if (!a) return;
    const v = Viewport.state, p = Viewport.toScreen(a.x, a.y - 8 - Height.liftAt(Renderer.getWorld(), a.x, a.y));
    const mx = v.width * MARGIN, my = v.height * MARGIN;
    const dx = p.x < mx ? mx - p.x : p.x > v.width - mx ? v.width - mx - p.x : 0;
    const dy = p.y < my ? my - p.y : p.y > v.height - my ? v.height - my - p.y : 0;
    if (dx || dy) Viewport.panBy(Math.round(dx), Math.round(dy));
  }

  return { init, toggle, steer, follow, isActive: () => active };
})();
