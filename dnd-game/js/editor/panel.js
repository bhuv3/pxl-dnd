// The adventure editor's side panel: forms for the adventure, its maps, the selected thing, what happens when a
// group is beaten, and the problems list. Changes go straight into the adventure data; ctx.changed() redraws.
const EditorPanel = (() => {
  const $ = id => document.getElementById(id);
  const HEROES = [['fighter', 'Fighter'], ['cleric', 'Cleric'], ['wizard', 'Wizard'], ['rogue', 'Rogue (not finished)'], ['paladin', 'Paladin (not finished)']];
  const SKILLS = ['athletics', 'acrobatics', 'sleightOfHand', 'stealth', 'perception', 'investigation', 'persuasion', 'intimidation'];
  const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const ROLES = ['folk', 'farmer', 'baker', 'smith', 'merchant', 'elder', 'guard', 'monk', 'child'];
  const BIOMES = ['cave', 'dungeon', 'village', 'meadows', 'snowy', 'desert', 'islands'];
  let ctx;

  // ---------- Fields ----------

  // A labelled input. opts: { type: text | number | select | textarea | check, options: [[value, label]], rebuild,
  // quiet (don't redraw after a change) }.
  function field(label, value, set, opts = {}) {
    const wrap = document.createElement('label'), type = opts.type || 'text';
    wrap.className = 'field' + (type === 'textarea' ? ' wide' : '');
    wrap.innerHTML = `<span>${label}</span>`;
    let el;
    if (type === 'select') {
      el = document.createElement('select');
      for (const [v, l] of opts.options) el.add(new Option(l, v));
      el.value = value ?? '';
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.value = value ?? '';
    } else {
      el = document.createElement('input');
      el.type = type === 'check' ? 'checkbox' : type;
      if (type === 'check') el.checked = !!value; else el.value = value ?? '';
    }
    el.addEventListener('change', () => {
      set(type === 'check' ? el.checked : type === 'number' ? (el.value === '' ? undefined : +el.value) : el.value);
      if (!opts.quiet) ctx.changed(opts.rebuild);
    });
    wrap.appendChild(el);
    return wrap;
  }

  function button(text, fn) { const b = document.createElement('button'); b.textContent = text; b.addEventListener('click', fn); return b; }
  function row(...els) { const d = document.createElement('div'); d.className = 'row'; d.append(...els); return d; }
  function note(text) { const p = document.createElement('p'); p.className = 'note'; p.textContent = text; return p; }
  function fill(id, ...els) { const box = $(id); box.innerHTML = ''; box.append(...els.filter(Boolean)); }

  const mapOptions = () => [['', '(none)'], ...Object.entries(ctx.adv.maps).map(([id, m]) => [id, m.name || id])];
  const spotOptions = mapId => [['', '(none)'], ...Object.keys((ctx.adv.maps[mapId] || {}).spots || {}).map(s => [s, s])];

  // ---------- Sections ----------

  function render(c) {
    ctx = c;
    renderAdventure();
    renderMaps();
    renderSelected();
    renderGroups();
    renderProblems();
  }

  function renderAdventure() {
    const a = ctx.adv;
    const party = document.createElement('div');
    party.className = 'row';
    for (const [sheet, name] of HEROES) {
      const on = a.party.some(p => p.sheet === sheet);
      party.appendChild(field(name, on, v => {
        a.party = HEROES.filter(([s]) => s === sheet ? v : a.party.some(p => p.sheet === s))
          .map(([s]) => a.party.find(p => p.sheet === s) || { name: Creatures.HEROES[s].name, key: 'hero-' + s, sheet: s });
      }, { type: 'check' }));
    }
    const quest = (a.quest || []).map(q => (q.if ? q.if + ': ' : '') + q.text).join('\n');
    fill('adventure',
      field('File name', a.id, v => { a.id = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-adventure'; }),
      field('Name', a.name, v => {
        if (!a.end || !a.end.title || a.end.title === `${a.name}: complete`) a.end = { ...(a.end || {}), title: `${v}: complete` };
        a.name = v;
        ctx.changed();
      }, { quiet: true }),
      note('Party'), party,
      field('Starts on', a.start.map, v => { a.start.map = v; a.start.at = Object.keys((a.maps[v] || {}).spots || {})[0] || ''; ctx.changed(); }, { type: 'select', options: mapOptions() }),
      field('At spot', a.start.at, v => { a.start.at = v; }, { type: 'select', options: spotOptions(a.start.map) }),
      field('Quest lines (first whose flag is set; "flag: text", or just text for always)', quest, v => {
        a.quest = v.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
          const m = l.match(/^([a-zA-Z]\w*):\s*(.+)$/);
          return m ? { if: m[1], text: m[2] } : { text: l };
        });
      }, { type: 'textarea' }),
      field('End title', (a.end || {}).title, v => { a.end = { ...(a.end || {}), title: v }; }),
      field('End text', (a.end || {}).text, v => { a.end = { ...(a.end || {}), text: v }; }, { type: 'textarea' }),
      note('The end screen shows after an "end" action: a group beaten (below) or a line of dialogue.'));
  }

  function renderMaps() {
    const list = document.createElement('ul');
    list.className = 'maplist';
    for (const [id, m] of Object.entries(ctx.adv.maps)) {
      const li = document.createElement('li');
      li.className = id === ctx.mapId ? 'on' : '';
      li.innerHTML = `<span></span><small>${m.map ? 'map file' : m.generate ? 'generated' : 'built in code'}</small>`;
      li.firstChild.textContent = m.name || id;
      li.addEventListener('click', () => ctx.selectMap(id));
      list.appendChild(li);
    }
    const gen = { biome: 'cave', size: 'small', seed: 1 };
    const els = [list, row(button('+ Map file (.json)…', ctx.addMapFile)),
      field('Generate', gen.biome, v => { gen.biome = v; }, { type: 'select', options: BIOMES.map(b => [b, b]), quiet: true }),
      field('Size', gen.size, v => { gen.size = v; }, { type: 'select', options: [['small', 'Small (16 × 12 squares)'], ['medium', 'Medium (24 × 16)'], ['large', 'Large (32 × 24)']], quiet: true }),
      field('Seed', gen.seed, v => { gen.seed = v || 1; }, { type: 'number', quiet: true }),
      row(button('+ Generated map', () => ctx.addGenerated(gen)))];
    const m = ctx.adventureMap();
    if (m) {
      els.push(note(`This map: ${ctx.mapId}`),
        field('Name', m.name, v => { m.name = v; }),
        field('Monsters see', m.sight || 7, v => { m.sight = v; }, { type: 'number' }),
        field('Game light', ctx.gameLight, v => ctx.setLight(v), { type: 'check', quiet: true }),
        row(button('Delete this map', ctx.deleteMap)));
    } else els.push(note('No maps yet. Add one from a map editor file, or generate one.'));
    fill('maps', ...els);
  }

  function renderSelected() {
    const s = ctx.sel;
    if (!s) return fill('selected', note('Pick a tool above the map and click to place; Select to pick a thing and drag it. Right-drag pans, the wheel zooms, Delete removes.'));
    const o = s.item, forms = {
      monster: () => [
        field('Name', o.name, v => { o.name = v; }),
        field('Stat block', o.sheet, v => { o.sheet = v; o.key = AdvFile.artOf(v); }, { type: 'select', options: Object.entries(Creatures.MONSTERS).map(([k, m]) => [k, `${m.name} (CR ${m.cr})`]) }),
        field('Group', o.group, v => { o.group = v || 'group1'; ctx.changed(); }),
        note('A group fights together: when one sees the party, they all join in.'),
        field('Fights as', o.role || '', v => { if (v) o.role = v; else delete o.role; }, { type: 'select', options: [['', 'Its best way'], ['archer', 'Archer (keeps away)']] }),
        row(button('Another look', () => { o.seed = (+o.seed || 1) + 1; ctx.changed(); }), button('Carries a torch', () => { o.seed = 'torch'; ctx.changed(); })),
      ],
      npc: () => [
        field('Name', o.name, v => { o.name = v; }),
        field('Line', o.line, v => { o.line = v; }, { type: 'textarea' }),
        field('Dialogue', o.talk || '', v => { if (v) o.talk = v; else delete o.talk; }, { type: 'select', options: [['', '(just the line)'], ...Object.keys(ctx.adv.dialogue || {}).map(k => [k, k])] }),
        note('Editing dialogue comes in Step 6b; dialogues already in the file can be picked.'),
        field('Role', o.role || 'folk', v => { o.role = v; delete o.seed; ctx.changed(); }, { type: 'select', options: ROLES.map(r => [r, r]) }),
        row(button('Another look', () => { o.seed = (o.seed || 1) + 1; ctx.changed(); })),
      ],
      door: () => [
        field('Locked', !!o.locked, v => { if (v) o.locked = { skill: 'athletics', dc: 12, text: 'The door is locked.' }; else delete o.locked; ctx.changed(); }, { type: 'check' }),
        ...(o.locked ? [
          field('Forced with', o.locked.skill, v => { o.locked.skill = v; }, { type: 'select', options: SKILLS.map(k => [k, k]) }),
          field('DC', o.locked.dc, v => { o.locked.dc = v || 10; }, { type: 'number' }),
          field('Message', o.locked.text, v => { o.locked.text = v; }),
        ] : []),
      ],
      chest: () => [
        field('Gold', o.gold, v => { o.gold = v || 0; }, { type: 'number' }),
        field('Potions', o.potions, v => { o.potions = v || 0; }, { type: 'number' }),
      ],
      trap: () => [
        field('Name', o.name, v => { o.name = v; }),
        field('Spot DC', o.find, v => { o.find = v || 10; }, { type: 'number' }),
        field('Save', o.save.ability, v => { o.save.ability = v; }, { type: 'select', options: ABILITIES.map(k => [k, k.toUpperCase()]) }),
        field('Save DC', o.save.dc, v => { o.save.dc = v || 10; }, { type: 'number' }),
        field('Damage', o.damage, v => { o.damage = v || '1d6'; }),
        field('Type', o.type, v => { o.type = v; }, { type: 'select', options: ['piercing', 'slashing', 'bludgeoning', 'fire', 'poison', 'acid'].map(k => [k, k]) }),
      ],
      spot: () => [
        field('Name', s.name, v => ctx.renameSpot(s.name, v)),
        note('Where the party arrives: at the start, or through an exit from another map.'),
        row(button('The adventure starts here', () => { ctx.adv.start = { map: ctx.mapId, at: s.name }; ctx.changed(); })),
      ],
      exit: () => [
        field('Leads to', o.to, v => { o.to = v; o.at = Object.keys((ctx.adv.maps[v] || {}).spots || {})[0] || ''; ctx.changed(); }, { type: 'select', options: mapOptions() }),
        field('Arriving at', o.at, v => { o.at = v; }, { type: 'select', options: spotOptions(o.to) }),
        field('Needs flag', o.needs || '', v => { if (v) o.needs = v; else delete o.needs; }),
        field('Refused', o.refused || '', v => { o.refused = v; }),
        note('Walking onto an exit leaves the map, unless it needs a flag the party hasn\'t got.'),
      ],
      area: () => [field('Read out the first time the party steps in', o.text, v => { o.text = v; }, { type: 'textarea' })],
    };
    fill('selected', note(s.kind === 'npc' ? 'Townsperson' : s.kind === 'area' ? 'Room description' : s.kind[0].toUpperCase() + s.kind.slice(1)),
      ...forms[s.kind](), row(button('Delete', ctx.deleteSelected)));
  }

  // What happens when each group on this map is beaten: a line read out, a flag, gold, the end.
  function renderGroups() {
    const m = ctx.adventureMap();
    const groups = m ? [...new Set((m.monsters || []).map(o => o.group))] : [];
    if (!groups.length) return fill('groups', note('No monsters on this map.'));
    const els = [];
    for (const g of groups) {
      const acts = ((m.defeated || {})[g] || []), get = k => (acts.find(a => a[0] === k) || [])[1];
      const set = (k, v) => {
        m.defeated = m.defeated || {};
        const rest = (m.defeated[g] || []).filter(a => a[0] !== k);
        m.defeated[g] = v === undefined || v === '' || v === false ? rest : [...rest, k === 'end' ? ['end'] : [k, v]];
        if (!m.defeated[g].length) delete m.defeated[g];
      };
      els.push(note(`${g}: ${(m.monsters || []).filter(o => o.group === g).map(o => o.name).join(', ')}`),
        field('Then say', get('say'), v => set('say', v), { type: 'textarea' }),
        field('Set flag', get('flag'), v => set('flag', v)),
        field('Give gold', get('gold'), v => set('gold', v), { type: 'number' }),
        field('End the adventure', acts.some(a => a[0] === 'end'), v => set('end', v), { type: 'check' }));
    }
    fill('groups', ...els);
  }

  function renderProblems() {
    const box = $('problems'), list = ctx.problems();
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<li class="ok">No problems found.</li>'; return; }
    for (const p of list) {
      const li = document.createElement('li');
      li.textContent = p.text;
      if (p.map) li.addEventListener('click', () => ctx.goTo(p));
      box.appendChild(li);
    }
  }

  return { render, renderSelected, renderProblems };
})();
