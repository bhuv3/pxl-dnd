// Cloud shadows drifting over the map, fog, and rain or snow falling.
const Weather = (() => {
  const GRID = 8;                     // cloud noise is sampled every GRID pixels
  const CLOUD_SIZE = 70;
  const CLOUD_TINT = [1, 0.95, 0.6];   // how much each channel darkens (blue least, so shadows look cool)
  const RAIN_SHADE = [0.9, 0.92, 0.96];
  const RAIN = [196, 214, 230];
  const FLAKE = [246, 250, 252];
  const FOG = [204, 212, 208];
  const FOG_SIZE = 60;
  let field = null, grain = null;   // grain: a fixed speckle that breaks up the fog's steps

  // True when rain or snow is falling.
  function isWet(s) { return s.weather === 'rain' || s.weather === 'snow'; }

  // Draws clouds and precipitation. Runs before the daylight tint.
  function draw(frame, world, s, pal, time) {
    if (s.weather === 'rain') shade(frame, RAIN_SHADE);
    if (s.clouds && s.cloudAmount > 0) drawClouds(frame, world, s, time);
    if (s.fog > 0) drawFog(frame, world, s, time);
    if (s.weather === 'rain') drawRain(frame, world, s, pal, time);
    if (s.weather === 'snow') drawSnow(frame, world, s, time);
  }

  // Multiplies every pixel by a color.
  function shade(frame, c) {
    for (let i = 0; i < frame.length; i += 4) {
      frame[i] *= c[0]; frame[i + 1] *= c[1]; frame[i + 2] *= c[2];
    }
  }

  // Coarse grid of drifting cloud noise; pixels in between are blended from the 4 corners.
  function drawClouds(frame, world, s, time) {
    const { w, h } = world;
    const gw = Math.ceil(w / GRID) + 1, gh = Math.ceil(h / GRID) + 1;
    if (!field || field.length !== gw * gh) field = new Float32Array(gw * gh);
    const ox = time * s.cloudSpeed * 3, oy = time * s.cloudSpeed * 1.2;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) field[gy * gw + gx] = Random.noise(gx * GRID - ox, gy * GRID - oy, CLOUD_SIZE, 1500);
    }
    const edge = 0.75 - s.cloudAmount * 0.45;
    const shadeC = CLOUD_TINT.map(k => 1 - s.cloudDarkness * k);
    for (let y = 0; y < h; y++) {
      const gy = Math.floor(y / GRID), fy = (y % GRID) / GRID;
      for (let x = 0; x < w; x++) {
        const gx = Math.floor(x / GRID), fx = (x % GRID) / GRID;
        const k = gy * gw + gx;
        const top = field[k] + (field[k + 1] - field[k]) * fx;
        const bot = field[k + gw] + (field[k + gw + 1] - field[k + gw]) * fx;
        const v = top + (bot - top) * fy;
        if (v < edge || (v < edge + 0.02 && (x + y) & 1)) continue;
        const i = (y * w + x) * 4;
        frame[i] *= shadeC[0]; frame[i + 1] *= shadeC[1]; frame[i + 2] *= shadeC[2];
      }
    }
  }

  // Banks of mist drifting slowly across the map, thicker in patches. Drawn in a few speckled steps, like the light.
  function drawFog(frame, world, s, time) {
    const { w, h } = world;
    const gw = Math.ceil(w / GRID) + 1, gh = Math.ceil(h / GRID) + 1;
    const mist = new Float32Array(gw * gh), ox = time * 1.6, oy = time * 0.4;
    if (!grain || grain.length !== w * h) { grain = new Float32Array(w * h); for (let i = 0; i < w * h; i++) grain[i] = (Random.hash(i % w, (i / w) | 0) - 0.5) * 0.12; }
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) mist[gy * gw + gx] = Random.noise(gx * GRID - ox, gy * GRID - oy, FOG_SIZE, 1501);
    for (let y = 0; y < h; y++) {
      const gy = Math.floor(y / GRID), fy = (y % GRID) / GRID;
      for (let x = 0; x < w; x++) {
        const gx = Math.floor(x / GRID), fx = (x % GRID) / GRID, k = gy * gw + gx;
        const top = mist[k] + (mist[k + 1] - mist[k]) * fx, bot = mist[k + gw] + (mist[k + gw + 1] - mist[k + gw]) * fx;
        const v = s.fog * (0.25 + Math.max(0, top + (bot - top) * fy - 0.3) * 1.4) + grain[y * w + x];
        const a = v > 0.6 ? 0.6 : v > 0.42 ? 0.45 : v > 0.25 ? 0.3 : v > 0.1 ? 0.15 : 0;
        if (!a) continue;
        const i = (y * w + x) * 4;
        frame[i] += (FOG[0] - frame[i]) * a; frame[i + 1] += (FOG[1] - frame[i + 1]) * a; frame[i + 2] += (FOG[2] - frame[i + 2]) * a;
      }
    }
  }

  function blend(frame, world, x, y, c, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= world.w || y >= world.h) return;
    const i = (y * world.w + x) * 4;
    for (let k = 0; k < 3; k++) frame[i + k] += (c[k] - frame[i + k]) * a;
  }

  // Slanted falling streaks, splashes on land, and ripples on water.
  function drawRain(frame, world, s, pal, time) {
    const { w, h } = world;
    const slant = s.wind ? 0.25 + s.windStrength * 0.15 : 0.15;
    const drops = Math.round(w * h / 400 * s.precipitation);
    for (let k = 0; k < drops; k++) {
      const speed = 70 + Random.hash(k, 1601) * 40;
      const y = (Random.hash(k, 1602) * (h + 20) + time * speed) % (h + 20) - 10;
      const x = ((Random.hash(k, 1603) * w + y * slant) % w + w) % w;
      for (let j = 0; j < 3; j++) blend(frame, world, x - j * slant, y - j, RAIN, 0.4 - j * 0.1);
    }
    const splashes = Math.round(w * h / 900 * s.precipitation);
    for (let k = 0; k < splashes; k++) {
      const period = 0.6 + Random.hash(k, 1604) * 0.4;
      const t = time / period + Random.hash(k, 1605);
      const loop = Math.floor(t), age = t - loop;
      const x = Math.floor(Random.hash(k, loop * 7 + 1606) * w), y = Math.floor(Random.hash(k, loop * 7 + 1607) * h);
      if (world.water[y * w + x]) {
        Water.ripple(frame, world, x, y, 0.6 + age * 2.4, (1 - age) * 0.4, pal.foam);
      } else if (age < 0.12) {
        blend(frame, world, x, y, RAIN, 0.5);
      } else if (age < 0.25) {
        blend(frame, world, x - 1, y - 1, RAIN, 0.35);
        blend(frame, world, x + 1, y - 1, RAIN, 0.35);
      }
    }
  }

  // Flakes drifting down and swaying. Near flakes are bigger, brighter, and faster.
  function drawSnow(frame, world, s, time) {
    const { w, h } = world;
    const flakes = Math.round(w * h / 220 * s.precipitation);
    const drift = s.wind ? s.windStrength * 4 : 1;
    for (let k = 0; k < flakes; k++) {
      const near = Random.hash(k, 1701) < 0.25;
      const speed = near ? 14 + Random.hash(k, 1702) * 6 : 6 + Random.hash(k, 1702) * 4;
      const y = (Random.hash(k, 1703) * (h + 10) + time * speed) % (h + 10) - 5;
      const sway = Math.sin(time * (0.8 + Random.hash(k, 1704)) + k) * (near ? 2.5 : 1.5);
      const x = ((Random.hash(k, 1705) * w + sway + time * drift) % w + w) % w;
      blend(frame, world, x, y, FLAKE, near ? 0.95 : 0.6);
      if (near) {
        blend(frame, world, x + 1, y, FLAKE, 0.5);
        blend(frame, world, x, y + 1, FLAKE, 0.5);
      }
    }
  }

  // The colour multipliers draw applies at one pixel before the rain, fog and snow, in order: the rain's shade, then a cloud
  // shadow (a list of 0 to 2 [r, g, b] factors). For a page that works one pixel out without the frame (the game's lightAt);
  // the same rules as draw and drawClouds. Fog is not covered (it blends toward a colour).
  // cache (optional, a Map the caller clears when time changes) keeps the corner noise between pixels.
  function shadeAt(s, time, x, y, cache) {
    const out = [];
    if (s.weather === 'rain') out.push(RAIN_SHADE);
    if (s.clouds && s.cloudAmount > 0) {
      const gx = Math.floor(x / GRID), gy = Math.floor(y / GRID), fx = (x % GRID) / GRID, fy = (y % GRID) / GRID;
      const ox = time * s.cloudSpeed * 3, oy = time * s.cloudSpeed * 1.2;
      const at = (cx, cy) => {                          // the field is a Float32Array
        const key = cx * 65536 + cy, hit = cache && cache.get(key);
        if (hit !== undefined) return hit;
        const v = Math.fround(Random.noise(cx * GRID - ox, cy * GRID - oy, CLOUD_SIZE, 1500));
        if (cache) cache.set(key, v);
        return v;
      };
      const a = at(gx, gy), b = at(gx + 1, gy), c = at(gx, gy + 1), d = at(gx + 1, gy + 1);
      const top = a + (b - a) * fx, bot = c + (d - c) * fx, v = top + (bot - top) * fy, edge = 0.75 - s.cloudAmount * 0.45;
      if (!(v < edge || (v < edge + 0.02 && (x + y) & 1))) out.push(CLOUD_TINT.map(k => 1 - s.cloudDarkness * k));
    }
    return out;
  }

  return { draw, isWet, shadeAt };
})();
