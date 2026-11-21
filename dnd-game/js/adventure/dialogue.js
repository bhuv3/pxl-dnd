// Dialogue (docs/dnd-game/adventures.md section 3): a talk with someone, from the adventure's data. Starts at the first
// node whose flags are all set; shows the line and the choices; a choice can need a check (rolled by the caller),
// runs its actions, and moves on (null ends the talk). The box sits over the bottom of the map; keys 1–9 pick.
const Dialogue = (() => {
  let box = null, talk = null;

  function init(el) {
    box = el;
    window.addEventListener('keydown', e => {
      if (!talk || talk.waiting) return;
      const n = +e.key;
      if (n >= 1 && n <= talk.node.choices.length) { e.preventDefault(); choose(talk.node.choices[n - 1]); }
    });
  }

  // tree: the person's dialogue data. ctx: { flags (Set), act(action), check(skill, dc) → Promise<success>, close() }.
  function open(tree, ctx) {
    const start = tree.start.find(s => (s.if || []).every(f => ctx.flags.has(f)));
    talk = { tree, ctx, node: null, waiting: false };
    go(start.node);
  }

  function go(id) {
    if (id === null || id === undefined) { close(); return; }
    const node = talk.tree.nodes[id];
    for (const a of node.do || []) talk.ctx.act(a);
    talk.node = node;
    render();
  }

  function render() {
    const { tree, node } = talk;
    box.hidden = false;
    box.innerHTML = `<div class="who">${tree.name}</div><p>${node.text}</p><ol class="choices">${node.choices.map((c, k) =>
      `<li><button data-k="${k}"><kbd>${k + 1}</kbd> ${c.check ? `<span class="check">[${skillName(c.check[0])} DC ${c.check[1]}]</span> ` : ''}${c.text}</button></li>`).join('')}</ol>`;
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => choose(node.choices[+b.dataset.k])));
  }

  // A choice: its actions, then a check (if any) decides where it goes.
  async function choose(c) {
    if (!talk || talk.waiting) return;
    for (const a of c.do || []) talk.ctx.act(a);
    if (!c.check) { go(c.next); return; }
    talk.waiting = true;
    box.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const ok = await talk.ctx.check(c.check[0], c.check[1]);
    talk.waiting = false;
    go(ok ? c.pass : c.fail);
  }

  function close() {
    box.hidden = true;
    const ctx = talk.ctx;
    talk = null;
    ctx.close();
  }

  const skillName = s => s[0].toUpperCase() + s.slice(1).replace(/([A-Z])/g, ' $1');

  return { init, open, active: () => !!talk };
})();
