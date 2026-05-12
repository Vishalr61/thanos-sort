/**
 * User preferences — animation speed, sound toggle, theme, etc.
 * Persisted to localStorage and exposed as a single getter + subscribe.
 * The settings UI lives in app.js; this module is the pure data layer.
 */

const KEY = 'thanos-sort:settings:v1';

const DEFAULTS = {
  animSpeed: 1,        // 0.5 → 2
  soundOn: true,
  reduceMotion: false,
  showSparkline: true,
  theme: 'cosmic'      // 'cosmic' | 'thor' | 'loki'
};

let data = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function get() { return { ...data }; }

export function set(key, value) {
  if (!(key in DEFAULTS)) return;
  data[key] = value;
  save();
  listeners.forEach((cb) => { try { cb(key, value, { ...data }); } catch {} });
}

export function on(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function reset() {
  data = { ...DEFAULTS };
  save();
  listeners.forEach((cb) => { try { cb(null, null, { ...data }); } catch {} });
}
