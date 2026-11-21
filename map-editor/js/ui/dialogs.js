// Modal dialogs: new map, shortcuts, and simple confirms.
const Dialogs = (() => {
  const root = () => document.getElementById('dialogRoot');
  let onEscape = null;

  // Shows a dialog with the given inner HTML. Returns the dialog element.
  function open(html, escape) {
    const r = root();
    r.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`;
    r.hidden = false;
    onEscape = escape || null;
    return r.firstElementChild;
  }

  // Hides the current dialog.
  function close() { root().hidden = true; root().innerHTML = ''; onEscape = null; }

  function isOpen() { return !root().hidden; }

  // Escape closes dialogs that allow it.
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen() && onEscape) { onEscape(); close(); }
  });

  // Asks for size, a starting ground or random landscape, seed, and (for a landscape) who's on the map.
  // Calls onCreate(options).
  function newMap(onCreate, canCancel) {
    const biomes = Object.entries(Generate.BIOMES).map(([k, b]) => `<option value="${k}">${b.name}</option>`).join('');
    const el = open(`
      <h2>New map</h2>
      <p>Pick a size and how to start. You can paint everything else.</p>
      <div class="field-pair">
        <div class="field"><label for="nmW">Width (pixels)</label><input id="nmW" type="number" min="64" max="1000" value="300"></div>
        <div class="field"><label for="nmH">Height (pixels)</label><input id="nmH" type="number" min="64" max="1000" value="300"></div>
      </div>
      <div class="warn" id="nmWarn"></div>
      <div class="field"><label for="nmGround">Start with</label>
        <select id="nmGround">
          <optgroup label="Blank"><option value="0">Dirt</option><option value="1">Grass</option></optgroup>
          <optgroup label="Random landscape">${biomes}</optgroup>
        </select></div>
      <div class="field"><label for="nmSeed">Seed</label>
        <div class="seed-row"><input id="nmSeed" type="number" min="1" value="${Random.newSeed() % 100000}">
          <button id="nmReroll" class="icon-btn" title="Random seed" aria-label="Random seed">${Icons.svg('dice')}</button></div>
        <div class="hint" id="nmHint"></div></div>
      <div class="life" id="nmLife" hidden>
        <div class="life-title">Who's on the map</div>
        ${LIFE.map(lifeGroup).join('')}
      </div>
      <div class="dialog-actions">
        ${canCancel ? '<button id="nmCancel">Cancel</button>' : ''}
        <button id="nmCreate" class="primary">Create map</button>
      </div>`, canCancel ? () => {} : null);

    const w = el.querySelector('#nmW'), h = el.querySelector('#nmH'), warn = el.querySelector('#nmWarn');
    const check = () => {
      const W = +w.value, H = +h.value;
      if (!(W >= 64 && W <= 1000 && H >= 64 && H <= 1000)) { warn.textContent = 'Width and height must be between 64 and 1000.'; return false; }
      const big = W > 400 || H > 400, gl = Renderer.getBackend() === 'gl';
      warn.textContent = !big ? '' : !gl ? 'Sizes over 400 draw slowly on the CPU. Switch to WebGL with the button under the map.'
        : W > 600 || H > 600 ? 'Big maps take about a second to update after each stroke.' : '';
      return true;
    };
    w.addEventListener('input', check);
    h.addEventListener('input', check);
    const start = el.querySelector('#nmGround'), seed = el.querySelector('#nmSeed');
    const biome = () => Generate.BIOMES[start.value] ? start.value : null;
    const hint = () => {
      el.querySelector('#nmHint').textContent = biome() ? 'The same seed makes the same landscape, whoever is on it.' : '';
      el.querySelector('#nmLife').hidden = !biome();
      if (biome()) LIFE.forEach(g => showWhere(el, g, biome()));
    };
    start.addEventListener('change', hint);
    wireLife(el);
    el.querySelector('#nmReroll').addEventListener('click', () => { seed.value = Random.newSeed() % 100000; });
    if (canCancel) el.querySelector('#nmCancel').addEventListener('click', close);
    el.querySelector('#nmCreate').addEventListener('click', () => {
      if (!check()) return;
      close();
      onCreate({
        width: Math.round(+w.value),
        height: Math.round(+h.value),
        startGround: biome() ? 0 : +start.value,
        biome: biome(),
        seed: Math.max(1, Math.round(+el.querySelector('#nmSeed').value) || 1),
        life: biome() ? readLife(el) : null,
      });
    });
    el.querySelector('#nmCreate').focus();
  }

  // The New map dialog's "Who's on the map" groups: kinds to pick from, and how they move. All start turned off.
  const LIFE = [
    { key: 'people', label: 'People', kinds: [['folk', 'Townsfolk'], ['farmer', 'Farmers'], ['child', 'Children'], ['baker', 'Bakers'], ['smith', 'Smiths'],
      ['merchant', 'Merchants'], ['elder', 'Elders'], ['guard', 'Guards'], ['monk', 'Monks']], moves: [['wander', 'Stroll'], ['still', 'Stand still']] },
    { key: 'monsters', label: 'Monsters', kinds: [['skeleton', 'Skeletons'], ['goblin', 'Goblins'], ['slime', 'Slimes'], ['cultist', 'Cultists']],
      moves: [['patrol', 'Wander and patrol'], ['wander', 'Wander'], ['still', 'Stand guard']] },
    { key: 'animals', label: 'Animals', kinds: [['sheep', 'Sheep'], ['chicken', 'Chickens'], ['deer', 'Deer'], ['rabbit', 'Rabbits'], ['duck', 'Ducks']],
      moves: [['wander', 'Roam'], ['still', 'Stay put']] },
    { key: 'hero', label: 'Hero', note: 'The elf wizard, ready for Play mode.' },
  ];
  const AMOUNTS = [[0.5, 'Few'], [1, 'Usual'], [1.75, 'Many'], [3, 'Crowded']];

  // One group: a switch, where they turn up in this biome, and (when on) how many, which kinds, and how they move.
  function lifeGroup(g) {
    const body = g.kinds ? `
      <div class="life-body" hidden>
        <div class="row"><span class="row-label">How many</span><span class="val">Usual</span>
          <input type="range" class="life-amount" min="0" max="${AMOUNTS.length - 1}" step="1" value="1" aria-label="${g.label}: how many"></div>
        <div class="life-kinds">${g.kinds.map(([k, l]) => `<label class="life-kind"><input type="checkbox" value="${k}" checked>${l}</label>`).join('')}</div>
        <div class="row choice"><span class="row-label">Movement</span><span class="seg">${g.moves.map(([v, l], i) =>
          `<button type="button" data-move="${v}" class="${i ? '' : 'active'}">${l}</button>`).join('')}</span></div>
      </div>` : '';
    return `<section class="life-group" data-group="${g.key}">
      <label class="life-top"><span class="row-label">${g.label}</span><input type="checkbox" class="switch life-on" aria-label="${g.label}"></label>
      <div class="life-where"></div>${body}</section>`;
  }

  // Shows where a group turns up in the biome, and turns it off (greyed out) where it can't.
  function showWhere(el, g, biome) {
    const sec = el.querySelector(`[data-group="${g.key}"]`), text = Generate.where(g.key, biome), on = sec.querySelector('.life-on');
    sec.querySelector('.life-where').textContent = text ? (g.note ? g.note + ' ' : '') + text : 'None in this landscape.';
    sec.classList.toggle('off', !text);
    on.disabled = !text;
    if (!text) on.checked = false;
    const body = sec.querySelector('.life-body');
    if (body) body.hidden = !on.checked;
  }

  // Switches open and close a group; the slider names the amount; movement buttons pick one.
  function wireLife(el) {
    el.querySelectorAll('.life-group').forEach(sec => {
      const body = sec.querySelector('.life-body');
      sec.querySelector('.life-on').addEventListener('change', e => { if (body) body.hidden = !e.target.checked; });
      if (!body) return;
      const amount = body.querySelector('.life-amount');
      amount.addEventListener('input', () => { body.querySelector('.val').textContent = AMOUNTS[+amount.value][1]; });
      body.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
        body.querySelectorAll('[data-move]').forEach(o => o.classList.toggle('active', o === b));
      }));
    });
  }

  // The life options for Generate.landscape, read from the dialog.
  function readLife(el) {
    const life = {};
    for (const g of LIFE) {
      const sec = el.querySelector(`[data-group="${g.key}"]`), on = sec.querySelector('.life-on').checked;
      if (!g.kinds) { life[g.key] = on; continue; }
      life[g.key] = {
        on,
        amount: AMOUNTS[+sec.querySelector('.life-amount').value][0],
        kinds: [...sec.querySelectorAll('.life-kind input:checked')].map(c => c.value),
        move: sec.querySelector('[data-move].active').dataset.move,
      };
    }
    return life;
  }

  // Yes/no question. Calls onYes or onNo.
  function confirm(title, text, yesLabel, noLabel, onYes, onNo) {
    const el = open(`
      <h2>${title}</h2><p>${text}</p>
      <div class="dialog-actions"><button id="cfNo">${noLabel}</button><button id="cfYes" class="primary">${yesLabel}</button></div>`);
    el.querySelector('#cfNo').addEventListener('click', () => { close(); onNo && onNo(); });
    el.querySelector('#cfYes').addEventListener('click', () => { close(); onYes && onYes(); });
  }

  // Lists keyboard shortcuts.
  function shortcuts(list) {
    const rows = list.map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('');
    const el = open(`<h2>Keyboard shortcuts</h2><div class="shortcut-list">${rows}</div>
      <div class="dialog-actions"><button id="scClose" class="primary">Close</button></div>`, () => {});
    el.querySelector('#scClose').addEventListener('click', close);
  }

  return { open, close, isOpen, newMap, confirm, shortcuts };
})();
