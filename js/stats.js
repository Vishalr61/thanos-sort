/**
 * Career stats — persisted in localStorage so they survive reloads.
 * Wrapped in try/catch in case storage is unavailable (private browsing,
 * disabled cookies, etc.); reads/writes silently no-op in that case.
 */

const KEY = 'thanos-sort:stats:v1';

const DEFAULT = {
  totalSnaps: 0,
  totalEliminated: 0,
  universesReset: 0,
  fastestSortMs: null,
  fastestSortLabel: null,
  modeUseCount: {} // { snap: 12, mind: 3, ... }
};

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed, modeUseCount: { ...DEFAULT.modeUseCount, ...(parsed.modeUseCount || {}) } };
  } catch {
    return { ...DEFAULT };
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function get() {
  return { ...data, modeUseCount: { ...data.modeUseCount } };
}

export function recordSnap(modeId, eliminated) {
  data.totalSnaps += 1;
  data.totalEliminated += eliminated;
  data.modeUseCount[modeId] = (data.modeUseCount[modeId] || 0) + 1;
  save();
}

export function recordReset() {
  data.universesReset += 1;
  save();
}

export function recordSort(label, ms) {
  if (data.fastestSortMs == null || ms < data.fastestSortMs) {
    data.fastestSortMs = ms;
    data.fastestSortLabel = label;
    save();
  }
}

export function resetAll() {
  data = { ...DEFAULT };
  save();
}
