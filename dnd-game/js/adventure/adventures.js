// The adventures the game knows. Each adventure is a data file in adventures/ that calls Adventures.add({ ... })
// (a script, not JSON, so the game still opens by double-clicking: browsers block fetch() on file://).
// The format is in docs/dnd-game/adventures.md section 4.
const Adventures = (() => {
  const all = new Map();
  function add(data) { all.set(data.id, data); }
  function get(id) { const a = all.get(id); if (!a) throw new Error('No adventure ' + id); return a; }
  return { add, get, has: id => all.has(id), list: () => [...all.values()] };
})();
