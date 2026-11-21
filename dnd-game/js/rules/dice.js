// Dice: notation like "2d6+3", rolled from a seeded random source so a fight can be replayed from its seed.
const Dice = (() => {
  // "2d6+3" → { count: 2, sides: 6, plus: 3 }; a plain number is just a plus.
  function parse(expr) {
    const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, ''));
    if (m) return { count: +(m[1] || 1), sides: +m[2], plus: +(m[3] || 0) };
    if (Number.isFinite(+expr)) return { count: 0, sides: 0, plus: +expr };
    throw new Error('Bad dice: ' + expr);
  }

  // Rolls an expression. crit doubles the dice (not the plus). Returns { total, rolls, expr }.
  function roll(expr, rng, crit = false) {
    const d = parse(expr), rolls = [];
    for (let k = 0; k < d.count * (crit ? 2 : 1); k++) rolls.push(1 + Math.floor(rng() * d.sides));
    return { total: rolls.reduce((a, b) => a + b, 0) + d.plus, rolls, expr };
  }

  // A d20. mode 'adv' / 'dis' rolls two and keeps the higher / lower; lucky rerolls a natural 1 once (halflings);
  // fixed forces the kept die (tests and the lab's forced outcomes). Returns { value, dropped, lucky }.
  function d20(rng, { mode = 'normal', lucky = false, fixed = null } = {}) {
    const die = () => 1 + Math.floor(rng() * 20);
    if (fixed != null) {
      const dropped = mode === 'adv' ? 1 + Math.floor(rng() * fixed) : mode === 'dis' ? fixed + Math.floor(rng() * (21 - fixed)) : null;
      return { value: fixed, dropped, lucky: false };
    }
    let a = die(), luck = false;
    if (lucky && a === 1) { a = die(); luck = true; }
    if (mode === 'normal') return { value: a, dropped: luck ? 1 : null, lucky: luck };
    let b = die();
    if (lucky && b === 1) { b = die(); luck = true; }
    const keep = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    return { value: keep, dropped: keep === a ? b : a, lucky: luck };
  }

  function rng(seed) { return Random.makeRng(seed); }

  return { parse, roll, d20, rng };
})();
