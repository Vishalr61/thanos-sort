/**
 * Central state singleton.
 *
 * Today, app.js still keeps a handful of module-scoped `let` bindings for
 * historical reasons (people, currentMode, currentAlgo, etc.). This module
 * is where they should live going forward — when a new feature adds state,
 * put it here instead of adding another top-level `let` to app.js.
 *
 * Listeners can subscribe via state.on('change', cb) for reactive updates.
 * Today no consumer uses subscriptions (everything still pushes UI updates
 * explicitly from app.js), but the hook is in place so the migration is
 * incremental rather than big-bang.
 */

const listeners = new Set();

function notify(key, value) {
  listeners.forEach((cb) => {
    try { cb(key, value); } catch (e) { /* swallow — listeners must not break the state object */ }
  });
}

const backing = {
  // Population
  people: [],
  initialSize: 0,
  snapCount: 0,
  immortals: new Set(),

  // Mode / algorithm selection
  currentMode: 'snap',
  currentAlgo: 'thanos',
  selected: [],

  // Run state
  busy: false,
  sortAbort: false,

  // Seed (URL-shared)
  seed: null,

  // Panel view preference (chips vs. bars)
  sortView: 'chips'
};

export const state = new Proxy(backing, {
  set(target, key, value) {
    const old = target[key];
    target[key] = value;
    if (old !== value) notify(key, value);
    return true;
  }
});

export function on(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function snapshot() {
  return JSON.parse(JSON.stringify({
    ...backing,
    immortals: [...backing.immortals],
    selected: [...backing.selected]
  }));
}
