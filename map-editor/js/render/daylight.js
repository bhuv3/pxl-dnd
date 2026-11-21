// Time of day: which hour it is, and the color tint for that hour.
const Daylight = (() => {
  // [hour, [r, g, b] multipliers]
  const KEYS = [
    [0, [0.28, 0.33, 0.55]],
    [5, [0.33, 0.36, 0.60]],
    [6.5, [0.92, 0.70, 0.70]],
    [8, [1.00, 0.95, 0.90]],
    [12, [1.00, 1.00, 1.00]],
    [16.5, [1.00, 0.95, 0.85]],
    [18.5, [0.98, 0.66, 0.50]],
    [20, [0.48, 0.44, 0.68]],
    [21.5, [0.30, 0.34, 0.56]],
    [24, [0.28, 0.33, 0.55]],
  ];

  // Current hour (0–24), moving forward if the day cycle is on.
  function hour(s, time) {
    if (!s.dayCycle) return s.timeOfDay;
    return (s.timeOfDay + time * 24 / s.dayLength) % 24;
  }

  // Tint for an hour, blended between the two nearest keyframes.
  function tint(h) {
    for (let k = 0; k < KEYS.length - 1; k++) {
      const [h0, c0] = KEYS[k], [h1, c1] = KEYS[k + 1];
      if (h >= h0 && h <= h1) {
        const t = (h - h0) / (h1 - h0);
        return [0, 1, 2].map(i => c0[i] + (c1[i] - c0[i]) * t);
      }
    }
    return KEYS[0][1];
  }

  // Underground: a dim, cool light whatever the hour (ambient 0 = pitch black, 1 = daylight).
  function underground(ambient) {
    return [ambient * 0.85, ambient * 0.9, Math.min(1, ambient * 1.2)];
  }

  // 0 at noon, about 0.6 at midnight.
  function darkness(t) { return 1 - (t[0] + t[1] + t[2]) / 3; }

  // Multiplies every pixel by the tint.
  function apply(frame, t) {
    if (t[0] > 0.995 && t[1] > 0.995 && t[2] > 0.995) return;
    for (let i = 0; i < frame.length; i += 4) {
      frame[i] *= t[0];
      frame[i + 1] *= t[1];
      frame[i + 2] *= t[2];
    }
  }

  // "14:30" style label for an hour.
  function label(h) {
    const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  return { hour, tint, underground, darkness, apply, label };
})();
