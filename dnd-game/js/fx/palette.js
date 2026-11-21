// Effect colors per damage type (docs/dnd-game/effects.md section 9): a ramp from the bright core to the dark edge,
// and the light color it casts.
const Palette = (() => {
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const TYPES = {
    fire:      { ramp: ['#fff6c2', '#ffc23d', '#f06b1f', '#9c2a14'], light: [1.5, 1.05, 0.6] },
    cold:      { ramp: ['#ffffff', '#c9f1ff', '#6cc6ee', '#2f6fa8'], light: [0.8, 1.1, 1.5] },
    lightning: { ramp: ['#ffffff', '#e3f4ff', '#8fc8ff', '#4a6dff'], light: [1.1, 1.2, 1.6] },
    force:     { ramp: ['#ffffff', '#e1c6ff', '#a86bff', '#5a2fb0'], light: [1.2, 0.9, 1.6] },
    radiant:   { ramp: ['#ffffff', '#fff3b0', '#ffd34d', '#c98a1c'], light: [1.5, 1.35, 0.9] },
    healing:   { ramp: ['#ffffff', '#e8ffd0', '#9be36b', '#3f9a3a'], light: [1.1, 1.4, 0.9] },
    acid:      { ramp: ['#f4ffd6', '#b8f04a', '#5fae2a', '#2c5e1c'], light: [1.0, 1.4, 0.7] },
    necrotic:  { ramp: ['#e6d0ff', '#8a4fd1', '#4a1f7a', '#1a0b2e'], light: [0.9, 0.7, 1.2] },
    blood:     { ramp: ['#ffffff', '#ff8a8a', '#e0303a', '#7a1020'], light: null },
    stone:     { ramp: ['#b8b0a4', '#948c80', '#6e675e', '#4c4740'], light: null },
    bone:      { ramp: ['#f2ead8', '#d8ceb8', '#b0a690', '#7c7462'], light: null },
    smoke:     { ramp: ['#5a4a6a', '#463a54', '#32283e', '#201a28'], light: null },
    steel:     { ramp: ['#ffffff', '#e6eeff', '#aebfdc', '#7a8aa8'], light: null },
    spark:     { ramp: ['#ffffff', '#ffe9a8', '#e0b060', '#8a6a3a'], light: null },
    dust:      { ramp: ['#c4b49a', '#a8937a', '#6e5d4b', '#4a3e32'], light: null },
  };
  for (const t of Object.values(TYPES)) t.rgb = t.ramp.map(hex);

  // A type's colors; an unknown type gets fire's.
  const of = type => TYPES[type] || TYPES.fire;

  // The color at age 0–1 along a type's ramp (core first).
  function at(type, age) {
    const r = of(type).rgb;
    return r[Math.min(r.length - 1, Math.floor(age * r.length))];
  }

  // CSS color for an RGB triple.
  function css(c, a = 1) { return a >= 1 ? `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})` : `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`; }

  return { TYPES, of, hex, at, css, light: type => of(type).light };
})();
