/**
 * Deterministic PRNG (mulberry32). Seedable from a URL parameter so two
 * people opening the same link see the same snap. Used in place of
 * Math.random() throughout the app — except in animation noise where
 * non-determinism doesn't matter.
 *
 * URL contract: ?seed=<base36 string>. Reset rerolls and replaces the URL
 * via history.replaceState so the share link always reflects current state.
 */

let state = 0;

function mulberry32() {
  state |= 0; state = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setSeed(seed) {
  // Accept either a number or a string; hash strings into 32-bit int.
  if (typeof seed === 'string') {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    }
    state = h >>> 0;
  } else {
    state = (seed | 0) >>> 0;
  }
  return seed;
}

export function rolledSeed() {
  // Generate a short, human-shareable seed and apply it.
  const s = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  setSeed(s);
  return s;
}

export const random = mulberry32;

export function randomInt(maxExclusive) {
  return Math.floor(random() * maxExclusive);
}

export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
