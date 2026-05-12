/**
 * Achievement system.
 *
 * Each entry defines:
 *   id     — stable key for localStorage
 *   title  — short display name
 *   sub    — one-line description shown on the toast and in the gallery
 *   icon   — emoji or short glyph
 *   test   — (s) => boolean, called with the stats object from stats.get()
 *
 * tick(snapshot) walks every definition; newly-true achievements get
 * recorded + a toast. Unlocked set persists in localStorage.
 */

const KEY = 'thanos-sort:achievements:v1';

export const ACHIEVEMENTS = [
  { id: 'first-snap',  title: 'First Snap',       sub: 'You started the cascade.',          icon: '∞',  test: (s) => s.totalSnaps >= 1 },
  { id: 'ten-snaps',   title: 'Cascading',        sub: '10 snaps performed.',               icon: '✦',  test: (s) => s.totalSnaps >= 10 },
  { id: 'fifty-snaps', title: 'Inevitable',       sub: '50 snaps performed.',               icon: '◈',  test: (s) => s.totalSnaps >= 50 },
  { id: 'first-reset', title: 'New Universe',     sub: 'You reset for the first time.',     icon: '⟲',  test: (s) => s.universesReset >= 1 },
  { id: 'five-resets', title: 'Multiverse',       sub: '5 fresh universes spawned.',        icon: '✺',  test: (s) => s.universesReset >= 5 },
  { id: 'used-mind',   title: 'Mindful',          sub: 'You wielded the Mind Stone.',       icon: '✦',  test: (s) => (s.modeUseCount.mind || 0) >= 1 },
  { id: 'used-soul',   title: 'Soul-bound',       sub: 'You wielded the Soul Stone.',       icon: '♥',  test: (s) => (s.modeUseCount.soul || 0) >= 1 },
  { id: 'used-time',   title: 'Time Bender',      sub: 'You wielded the Time Stone.',       icon: '⏳', test: (s) => (s.modeUseCount.time || 0) >= 1 },
  { id: 'used-power',  title: 'Power Drunk',      sub: 'You annihilated everything.',       icon: '◉',  test: (s) => (s.modeUseCount.power || 0) >= 1 },
  { id: 'used-reality',title: 'Reality Shifter',  sub: 'You folded reality.',               icon: '◈',  test: (s) => (s.modeUseCount.reality || 0) >= 1 },
  { id: 'used-space',  title: 'Default Disastrous',sub: 'Half a universe at random.',       icon: '◇',  test: (s) => (s.modeUseCount.space || 0) >= 1 },
  { id: 'all-stones',  title: 'Infinity Saga',    sub: 'Every stone used at least once.',   icon: '✶',  test: (s) => ['space','time','soul','mind','power','reality'].every(k => (s.modeUseCount[k] || 0) >= 1) },
  { id: 'fast-sort',   title: 'Speed Demon',      sub: 'Finished a real sort in <500ms.',   icon: '⚡', test: (s) => s.fastestSortMs != null && s.fastestSortMs < 500 },
  { id: 'casualties-100', title: 'Hecatomb',      sub: '100 souls eliminated total.',       icon: '✕',  test: (s) => s.totalEliminated >= 100 },
  { id: 'casualties-500', title: 'Thanos Was Right', sub: '500 souls eliminated total.',   icon: '☠', test: (s) => s.totalEliminated >= 500 },
];

let unlocked = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify([...unlocked])); } catch { /* ignore */ }
}

export function isUnlocked(id) { return unlocked.has(id); }
export function allUnlocked() { return new Set(unlocked); }

/**
 * Check the snapshot against every definition. Returns the list of newly
 * unlocked achievements (so the caller can show toasts).
 */
export function tick(snapshot) {
  const fresh = [];
  for (const def of ACHIEVEMENTS) {
    if (unlocked.has(def.id)) continue;
    try {
      if (def.test(snapshot)) {
        unlocked.add(def.id);
        fresh.push(def);
      }
    } catch { /* defensive — bad test shouldn't crash */ }
  }
  if (fresh.length) save();
  return fresh;
}

export function resetAll() {
  unlocked = new Set();
  save();
}

/**
 * Toast rendering — pure DOM helper. The host container should be a
 * fixed-position element with column layout; new toasts are appended
 * and auto-removed after 3.5s.
 */
export function showToast(container, def) {
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast achievement-toast';
  el.innerHTML = `
    <span class="toast-icon">${def.icon}</span>
    <div class="toast-body">
      <div class="toast-title">${def.title}</div>
      <div class="toast-sub">${def.sub}</div>
    </div>
  `;
  container.appendChild(el);
  setTimeout(() => el.classList.add('toast-leave'), 3200);
  setTimeout(() => el.remove(), 3700);
}
