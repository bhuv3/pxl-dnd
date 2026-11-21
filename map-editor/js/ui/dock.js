// Scene dock under the map: time of day, season, weather, grid, and animation at a glance.
const Dock = (() => {
  const $ = id => document.getElementById(id);
  const SEASONS = ['summer', 'autumn', 'winter'];
  const SEASON_ICONS = { summer: 'tree', autumn: 'leaf', winter: 'snow' };
  const WEATHER = ['clear', 'rain', 'snow'];
  const WEATHER_ICONS = { clear: 'sun', rain: 'rain', snow: 'snow' };

  // Builds the dock controls. The grid and animation buttons are wired by App.
  function init() {
    $('sceneDock').innerHTML = `
      <label class="dock-time" title="Time of day">
        <span id="dockTimeIcon"></span>
        <input type="range" id="dockTime" min="0" max="24" step="0.25" aria-label="Time of day">
        <output id="dockTimeVal"></output>
      </label>
      <span class="ctx-sep"></span>
      <button class="dock-btn" id="dockSeason" title="Season: click for the next one"></button>
      <button class="dock-btn" id="dockWeather" title="Weather: click for the next one"></button>
      <span class="ctx-sep"></span>
      <button class="icon-btn" id="btnGrid" title="Grid (H)" aria-label="Grid">${Icons.svg('grid')}</button>
      <button class="icon-btn" id="btnAnimate" title="Pause the animation (K)" aria-label="Pause the animation">${Icons.svg('pause')}</button>
      <button class="dock-btn" id="dockGl" title="Drawing engine: click to switch between the CPU and WebGL"></button>`;
    $('dockGl').addEventListener('click', () => { Renderer.setBackend(Renderer.getBackend() === 'gl' ? 'canvas' : 'gl'); sync(); });
    $('dockTime').addEventListener('input', e => Settings.set('timeOfDay', +e.target.value));
    $('dockSeason').addEventListener('click', () => Settings.setSeason(next(SEASONS, map().settings.season)));
    $('dockWeather').addEventListener('click', () => Settings.set('weather', next(WEATHER, map().settings.weather)));
  }

  function map() { return Renderer.getMap(); }

  // The item after value in list, wrapping around.
  function next(list, value) { return list[(list.indexOf(value) + 1) % list.length]; }

  // Shows the map's current time, season, and weather.
  function sync() {
    const m = map();
    if (!m) return;
    const s = m.settings, day = s.timeOfDay >= 6 && s.timeOfDay < 19 && !s.underground;
    $('dockTime').value = s.timeOfDay;
    $('dockTimeVal').textContent = s.underground ? 'Under' : Daylight.label(s.timeOfDay);
    $('dockTimeIcon').innerHTML = Icons.svg(s.underground ? 'cave' : day ? 'sun' : 'moon', 16);
    $('dockSeason').innerHTML = `${Icons.svg(SEASON_ICONS[s.season] || 'tree', 16)}<span>${cap(s.season)}</span>`;
    $('dockWeather').innerHTML = `${Icons.svg(WEATHER_ICONS[s.weather] || 'sun', 16)}<span>${cap(s.weather)}</span>`;
    const gl = Renderer.getBackend() === 'gl', why = Renderer.glReason();
    $('dockGl').innerHTML = `<span>${gl ? 'WebGL' : 'CPU'}</span>`;
    $('dockGl').classList.toggle('active', gl);
    $('dockGl').title = gl ? 'Drawing with WebGL. Click to draw on the CPU instead.' : 'Drawing on the CPU. Click to try WebGL.' + (why ? ' (' + why + ')' : '');
  }

  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

  return { init, sync };
})();
