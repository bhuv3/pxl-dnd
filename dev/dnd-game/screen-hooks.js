// Test helper (parity page only): remembers the functions a page registers with Stage.on('screen', ...), so the test
// can run the page's own overlay drawing on any context.
const ScreenHooks = (() => {
  const list = [], on = Stage.on;
  Stage.on = (name, fn) => { if (name === 'screen') list.push(fn); on(name, fn); };
  return { draw: c2d => list.forEach(fn => fn(c2d)), count: () => list.length };
})();
