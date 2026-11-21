// Editor layout preferences remembered in this browser (panels, tabs, recent items).
const Prefs = (() => {
  const PREFIX = 'pixel-map-editor:ui:';

  // Stored value for key, or fallback when missing or storage is blocked.
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  // Remembers a value (anything JSON can hold).
  function set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }

  return { get, set };
})();
