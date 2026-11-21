// The fight's panels (DOM): the turn order bar along the top (portraits, HP, whose turn), the action bar for a
// hero's turn (what's left this turn, the actions with their costs, Dash, Disengage, Dodge, End turn), the log,
// and the result screen.
const CombatUI = (() => {
  const LOG_LINES = 60;
  const portraits = new Map();
  let el = {}, handlers = {};

  // els: { turnbar, actions, log, result, banner }; on: { pick(actionId or 'end'), again(outcome) }.
  function init(els, on) { el = els; handlers = on; }

  // Redraws the bars from the fight's state. selected: the action being aimed.
  // choice: what's picked for the selected action (Chromatic Orb's damage type).
  function render(state, selected, choice = {}) {
    renderTurnBar(state);
    renderActions(state, selected, choice);
    const f = state && state.turn && state.turn.fig;
    if (el.banner) el.banner.textContent = !state ? '' : state.over ? '' : f ? `Round ${state.round} · ${f.creature.label}'s turn${f.side === 'hero' && !state.auto ? '' : '…'}` : `Round ${state.round}`;
  }

  function renderTurnBar(state) {
    if (!state) { el.turnbar.innerHTML = ''; return; }
    el.turnbar.innerHTML = '';
    for (const f of state.order) {
      const c = f.creature, cur = state.turn && state.turn.fig === f;
      const d = document.createElement('div');
      d.className = 'portrait' + (cur ? ' current' : '') + (c.slain ? ' slain' : c.hp <= 0 ? ' down' : '') + (f.side === 'enemy' ? ' enemy' : '');
      d.appendChild(portrait(f));
      const hp = c.hero ? `${Math.max(0, c.hp)}/${c.maxHp}` : healthWord(c);
      d.insertAdjacentHTML('beforeend', `<span class="name">${c.label}</span><span class="bar"><i style="width:${Math.max(0, c.hp) / c.maxHp * 100}%"></i></span><span class="hp">${hp}</span>`);
      d.title = `Initiative ${f.init}`;
      el.turnbar.appendChild(d);
    }
  }

  // Monsters show how hurt they look, not numbers.
  function healthWord(c) {
    const k = c.hp / c.maxHp;
    return c.slain || c.hp <= 0 ? 'Down' : k >= 1 ? 'Healthy' : k > 0.5 ? 'Hurt' : k > 0.25 ? 'Bloodied' : 'Near death';
  }

  // The figure's front-facing standing art (drawn once, then copied into each new bar).
  function portrait(f) {
    if (!portraits.has(f)) {
      const a = Figures.art(f), c = blank();
      if (a) { const g = c.getContext('2d'), img = g.createImageData(32, 32); img.data.set(a.dirs.south.stand); g.putImageData(img, 0, 0); }
      portraits.set(f, c);
    }
    const c = blank();
    c.getContext('2d').drawImage(portraits.get(f), 0, 0);
    return c;
  }
  function blank() { const c = document.createElement('canvas'); c.width = c.height = 32; return c; }

  // The action bar: only for a hero's turn the player controls.
  function renderActions(state, selected, choice) {
    const f = state && state.turn && state.turn.fig;
    if (!f || f.side !== 'hero' || state.auto || state.over || f.creature.hp <= 0) { el.actions.innerHTML = ''; el.actions.hidden = true; return; }
    el.actions.hidden = false;
    const c = f.creature, t = state.turn, busy = state.busy;
    const slots = (c.slots ? ` · Slots ${Object.entries(c.slots).map(([l, n]) => Object.keys(c.slots).length > 1 ? `L${l} ${n}` : n).join(', ')}` : '') + (c.concentration ? ` · Concentrating: ${c.concentration.spell}` : '');
    const pip = (on, sym, name) => `<span class="pip${on ? '' : ' used'}" title="${name}">${sym} ${name}</span>`;
    const haste = (Conditions.has(c, 'hasted') ? ' ' + pip(t.haste, '⚡', 'Haste action') : '') + (t.extra > 0 ? ' ' + pip(true, '⚔', 'One more attack') : '');
    const free = t.freeMove >= 1 ? ` (+${Math.floor(t.freeMove * 5 + 1e-6)} free)` : '';   // Remarkable Athlete
    let html = `<div class="budget">${pip(t.move + (t.freeMove || 0) >= 1, '➜', `Move ${Math.floor(t.move * 5 + 1e-6)} ft${free}`)} ${pip(t.action, '●', 'Action')}${haste} ${pip(t.bonus, '◆', 'Bonus')} ${pip(c.reaction, '▲', 'Reaction')}${slots}</div><div class="buttons">`;
    (c.actions || []).forEach((id, k) => {
      const A = Actions.get(id), o = Combat.options(f, id), info = Spells.list().find(s => s.name === id);
      const label = (info && info.label) || A.name || id;
      const cost = A.smite ? '●◆' : A.cost === 'free' ? '✦' : (A.cost || 'action') === 'bonus' ? '◆' : '●';   // Divine Smite: an attack, then a bonus action
      html += `<button data-act="${id}" class="${selected === id ? 'on' : ''}" ${o.ok && !busy ? '' : 'disabled'} title="${o.ok ? '' : o.why}"><kbd>${k + 1}</kbd> ${label} <small>${cost}${A.slot ? ' slot' : ''}</small></button>`;
    });
    const n = (c.actions || []).length;
    for (const [k, id, label] of [[n + 1, 'dash', 'Dash'], [n + 2, 'disengage', 'Disengage'], [n + 3, 'dodge', 'Dodge']]) html += `<button data-act="${id}" ${(t.action || (t.haste && id !== 'dodge')) && !busy ? '' : 'disabled'}><kbd>${k}</kbd> ${label} <small>●</small></button>`;
    if ((c.traits || []).includes('cunningAction')) for (const [id, label] of [['dash', 'Dash'], ['disengage', 'Disengage']]) html += `<button data-act="${id}:bonus" ${t.bonus && !busy ? '' : 'disabled'} title="Cunning Action">${label} <small>◆</small></button>`;
    if (Combat.options(f, 'shakeAwake').ok) html += `<button data-act="shakeAwake" class="${selected === 'shakeAwake' ? 'on' : ''}" ${busy ? 'disabled' : ''}><kbd>${n + 4}</kbd> Shake awake <small>●</small></button>`;
    if (Conditions.has(c, 'spiritual')) { const o = Combat.options(f, 'spiritualStrike'); html += `<button data-act="spiritualStrike" class="${selected === 'spiritualStrike' ? 'on' : ''}" ${o.ok && !busy ? '' : 'disabled'} title="${o.ok ? '' : o.why}"><kbd>${n + 6}</kbd> Spiritual Weapon strike <small>◆</small></button>`; }
    if (Conditions.has(c, 'sphere')) { const o = Combat.options(f, 'sphereMove'); html += `<button data-act="sphereMove" class="${selected === 'sphereMove' ? 'on' : ''}" ${o.ok && !busy ? '' : 'disabled'} title="${o.ok ? '' : o.why}"><kbd>${n + 5}</kbd> Roll the sphere <small>◆</small></button>`; }
    html += `<button data-act="end" class="end" ${busy ? 'disabled' : ''}><kbd>Space</kbd> End turn</button></div>`;
    const types = selected && Actions.ACTIONS[selected] && Actions.ACTIONS[selected].types;
    const sneak = selected && Actions.ACTIONS[selected] && (Actions.ACTIONS[selected].extra || {}).damage === 'sneak' && (c.traits || []).includes('cunningStrike');
    if (sneak) html += `<div class="buttons types"><small>Cunning Strike (−1d6):</small> ${['none', 'poison', 'trip', 'withdraw'].map(k => `<button data-act="strike:${k}" class="${(choice.strike || 'none') === k ? 'on' : ''}">${k}</button>`).join('')}</div>`;
    if (types) html += `<div class="buttons types"><small>Damage type:</small> ${types.map(t => `<button data-act="type:${t}" class="${choice.type === t ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    el.actions.innerHTML = html;
    el.actions.querySelectorAll('button').forEach(b => b.addEventListener('click', () => handlers.pick(b.dataset.act)));
  }

  function log(lines) {
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = line.trim();
      if (line.startsWith('  ')) li.className = 'sub';
      if (/^Round /.test(line)) li.className = 'round';
      el.log.appendChild(li);
    }
    while (el.log.children.length > LOG_LINES) el.log.firstChild.remove();
    el.log.scrollTop = el.log.scrollHeight;
  }

  // The result screen. text: { title, body, button } (defaults: the goblin fight's); null hides it.
  function result(outcome, text = {}) {
    el.result.hidden = !outcome;
    if (!outcome) return;
    const title = text.title || (outcome === 'victory' ? 'Victory!' : 'The party has fallen');
    const body = text.body || (outcome === 'victory' ? 'Both goblins are beaten. 100 XP.' : 'The goblins win this one.');
    el.result.innerHTML = `<div class="card ${outcome}"><h2>${title}</h2><p>${body}</p><button id="again">${text.button || 'Fight again'}</button></div>`;
    el.result.querySelector('#again').addEventListener('click', () => handlers.again(outcome));
  }

  function clearLog() { el.log.innerHTML = ''; portraits.clear(); }

  return { init, render, log, result, clearLog };
})();
