// Left drawer: searchable, grouped tiles for every material and stampable object.
const Library = (() => {
  const $ = id => document.getElementById(id);
  const TERRAIN_GROUPS = ['Ground', 'Paths', 'Walls', 'Water', 'Areas', 'Height'];
  // Furniture is long, so the library shows it in smaller groups. Anything not listed lands in "More furniture".
  const FURNITURE = {
    'Tables and seats': ['table', 'longtable', 'roundtable', 'bench', 'stool'],
    'Beds and storage': ['bed', 'bedroll', 'chest', 'barrel', 'crate', 'sacks', 'bookshelf'],
    'Decor': ['rug', 'roundrug', 'tub', 'altar', 'statue', 'pillar', 'planter'],
    'Doors, fences and work': ['door', 'fence', 'haybale', 'weaponrack', 'vat', 'anvil'],
  };
  const GROUP_NAMES = { Objects: 'Nature' };
  const MAX_RECENT = 8;

  let tab = Prefs.get('libraryTab', 'terrain');
  let query = '';
  let collapsed = new Set(Prefs.get('libraryCollapsed', []));
  let recent = Prefs.get('libraryRecent', []);

  // Wires the tabs and search box, then draws the tiles.
  function init() {
    document.querySelectorAll('[data-libtab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.libtab)));
    const search = $('libSearch');
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render(); });
    search.addEventListener('keydown', e => {
      if (e.key === 'Escape') { search.value = ''; query = ''; render(); search.blur(); }
      if (e.key === 'Enter') { const first = $('libBody').querySelector('.tile'); if (first) first.click(); }
    });
    $('libBody').addEventListener('click', onClick);
    render();
  }

  // Every item the library can show: { kind, id, name, group, tab, color, key }.
  function items() {
    const out = [];
    for (const m of Types.MATERIALS) out.push({ kind: 'm', id: m.id, name: m.name, group: m.group, tab: 'terrain', color: m.plan, key: m.key });
    const drop = Tools.LIST.find(t => t.id === 'drop');
    out.push({ kind: 't', id: drop.id, name: drop.name, group: drop.group, tab: 'terrain', color: Types.RIVER_PLAN, key: drop.key });
    for (const [group, list] of Object.entries(Types.OBJECT_GROUPS)) {
      for (const o of list) {
        out.push({ kind: 'o', id: o, name: Types.OBJECT_NAMES[o], group: displayGroup(group, o), tab: 'objects', color: Types.OBJECT_COLORS[o], key: '' });
      }
    }
    return out;
  }

  // Library group for an object: furniture splits into smaller groups.
  function displayGroup(group, id) {
    if (group !== 'Furniture') return GROUP_NAMES[group] || group;
    const hit = Object.entries(FURNITURE).find(([, ids]) => ids.includes(id));
    return hit ? hit[0] : 'More furniture';
  }

  // Groups in display order for a list of items. Groups added at runtime (characters, animals) follow Lights.
  function grouped(list) {
    const order = [...TERRAIN_GROUPS, 'Nature', 'Buildings', ...Object.keys(FURNITURE), 'More furniture', 'Lights'];
    const groups = new Map(order.map(g => [g, []]));
    for (const it of list) (groups.get(it.group) || groups.set(it.group, []).get(it.group)).push(it);
    return [...groups].filter(([, l]) => l.length);
  }

  // Redraws the drawer body for the current tab and search.
  function render() {
    document.querySelectorAll('[data-libtab]').forEach(b => b.classList.toggle('active', b.dataset.libtab === tab && !query));
    const all = items();
    let html = '';
    if (query) {
      const hits = all.filter(it => (it.name + ' ' + it.group).toLowerCase().includes(query));
      html = hits.length ? grouped(hits).map(([g, l]) => group(g, l, false)).join('')
        : `<p class="empty">Nothing called “${escape(query)}”. Try another word.</p>`;
    } else {
      const rec = recent.map(r => all.find(it => it.kind + ':' + it.id === r)).filter(Boolean);
      if (rec.length) html += group('Recent', rec, false, true);
      html += grouped(all.filter(it => it.tab === tab)).map(([g, l]) => group(g, l, collapsed.has(g))).join('');
    }
    $('libBody').innerHTML = html;
    refresh();
  }

  // One collapsible group of tiles.
  function group(name, list, closed, plain) {
    const head = plain ? `<div class="group-head static">${name}</div>`
      : `<button class="group-head" data-group="${name}" aria-expanded="${!closed}">${Icons.svg(closed ? 'chevronRight' : 'chevronDown', 14)}<span>${name}</span><span class="count">${list.length}</span></button>`;
    return `<section class="lib-group">${head}${closed ? '' : `<div class="tile-grid">${list.map(tile).join('')}</div>`}</section>`;
  }

  // A tile: picture or color swatch, name, and shortcut key.
  function tile(it) {
    const pic = Thumbs.url(it.kind, it.id);
    const thumb = pic ? `<span class="thumb pic"><img src="${pic}" alt=""></span>` : `<span class="thumb" style="background:${it.color}"></span>`;
    const title = it.name + (it.key ? ` (${it.key})` : '');
    return `<button class="tile" data-kind="${it.kind}" data-id="${it.id}" title="${title}">${thumb}<span class="tile-label">${it.name}</span>${it.key ? `<kbd>${it.key}</kbd>` : ''}</button>`;
  }

  // Tile and group-header clicks.
  function onClick(e) {
    const head = e.target.closest('.group-head[data-group]');
    if (head) { toggleGroup(head.dataset.group); return; }
    const t = e.target.closest('.tile');
    if (!t) return;
    pick(t.dataset.kind, t.dataset.id);
  }

  // Uses an item: a material for painting, an object to stamp, or a tool.
  function pick(kind, id) {
    if (kind === 'm') Tools.setMaterial(id);
    else if (kind === 't') Tools.setTool(id);
    else { Tools.setOption('stampType', id); Tools.setTool('stamp'); }
    remember(kind + ':' + id);
    if (matchMedia('(max-width: 900px)').matches) Panel.setPanel('library', false, true);   // the drawer covers the map there
  }

  // Puts an item at the front of the Recent row. The row only redraws when its items change.
  function remember(key) {
    const next = [key, ...recent.filter(r => r !== key)].slice(0, MAX_RECENT);
    const changed = next.some(r => !recent.includes(r));
    recent = next;
    Prefs.set('libraryRecent', recent);
    if (changed && !query) render();
  }

  function toggleGroup(name) {
    collapsed.has(name) ? collapsed.delete(name) : collapsed.add(name);
    Prefs.set('libraryCollapsed', [...collapsed]);
    render();
  }

  function setTab(t) {
    tab = t;
    Prefs.set('libraryTab', tab);
    if (query) { query = ''; $('libSearch').value = ''; }
    render();
  }

  // Highlights the tiles that match the current tool, material, or stamp.
  function refresh() {
    const st = Tools.state;
    const usesMaterial = Tools.MATERIAL_TOOLS.includes(st.tool);
    $('libBody').querySelectorAll('.tile').forEach(b => {
      const { kind, id } = b.dataset;
      const on = kind === 'm' ? usesMaterial && st.material === id : kind === 'o' ? st.tool === 'stamp' && st.stampType === id : st.tool === id;
      b.classList.toggle('active', on);
    });
  }

  // Redraws the pictures after a change in how things look (season, colors, sizes).
  function refreshThumbs() { Thumbs.invalidate(); render(); }

  // Opens the drawer on a tab, optionally focusing the search box.
  function show(t, focus) {
    Panel.setPanel('library', true);
    if (t && t !== tab) setTab(t);
    if (focus) $('libSearch').focus();
  }

  function escape(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  return { init, render, refresh, refreshThumbs, show, pick, items, remember };
})();
