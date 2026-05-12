/**
 * Real sorting algorithms as generators that yield step-by-step events.
 * Driven by chips.js to animate the panel during a "run".
 *
 * Each yield is {kind, ...}:
 *   - {kind:'compare', i, j}    — highlight indices being compared
 *   - {kind:'swap', i, j}       — swap positions i and j in the array view
 *   - {kind:'mark-sorted', i}   — index is in its final position
 *   - {kind:'done', stats}      — sort finished; stats = {comparisons, swaps}
 */

export function* bubbleSort(arr) {
  const a = [...arr];
  let comparisons = 0, swaps = 0;
  for (let i = 0; i < a.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - i - 1; j++) {
      comparisons++;
      yield { kind: 'compare', i: j, j: j + 1 };
      if (cmp(a[j], a[j + 1]) > 0) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swaps++;
        swapped = true;
        yield { kind: 'swap', i: j, j: j + 1 };
      }
    }
    yield { kind: 'mark-sorted', i: a.length - i - 1 };
    if (!swapped) {
      for (let k = a.length - i - 2; k >= 0; k--) yield { kind: 'mark-sorted', i: k };
      break;
    }
  }
  yield { kind: 'done', stats: { comparisons, swaps } };
}

export function* quickSort(arr) {
  const a = [...arr];
  const stats = { comparisons: 0, swaps: 0 };
  yield* quickRun(a, 0, a.length - 1, stats);
  for (let k = 0; k < a.length; k++) yield { kind: 'mark-sorted', i: k };
  yield { kind: 'done', stats };
}

function* quickRun(a, lo, hi, stats) {
  if (lo >= hi) {
    if (lo === hi) yield { kind: 'mark-sorted', i: lo };
    return;
  }
  // Lomuto partition with last element as pivot.
  const pivot = a[hi];
  let i = lo - 1;
  for (let j = lo; j < hi; j++) {
    stats.comparisons++;
    yield { kind: 'compare', i: j, j: hi };
    if (cmp(a[j], pivot) <= 0) {
      i++;
      if (i !== j) {
        [a[i], a[j]] = [a[j], a[i]];
        stats.swaps++;
        yield { kind: 'swap', i, j };
      }
    }
  }
  if (i + 1 !== hi) {
    [a[i + 1], a[hi]] = [a[hi], a[i + 1]];
    stats.swaps++;
    yield { kind: 'swap', i: i + 1, j: hi };
  }
  yield { kind: 'mark-sorted', i: i + 1 };
  yield* quickRun(a, lo, i, stats);
  yield* quickRun(a, i + 2, hi, stats);
}

export function* mergeSort(arr) {
  const a = [...arr];
  const stats = { comparisons: 0, swaps: 0 };
  yield* mergeRun(a, 0, a.length - 1, stats);
  for (let k = 0; k < a.length; k++) yield { kind: 'mark-sorted', i: k };
  yield { kind: 'done', stats };
}

function* mergeRun(a, lo, hi, stats) {
  if (lo >= hi) return;
  const mid = Math.floor((lo + hi) / 2);
  yield* mergeRun(a, lo, mid, stats);
  yield* mergeRun(a, mid + 1, hi, stats);
  yield* merge(a, lo, mid, hi, stats);
}

function* merge(a, lo, mid, hi, stats) {
  const left = a.slice(lo, mid + 1);
  const right = a.slice(mid + 1, hi + 1);
  let i = 0, j = 0, k = lo;
  while (i < left.length && j < right.length) {
    stats.comparisons++;
    yield { kind: 'compare', i: lo + i, j: mid + 1 + j };
    if (cmp(left[i], right[j]) <= 0) {
      a[k] = left[i++];
    } else {
      a[k] = right[j++];
      stats.swaps++;
    }
    yield { kind: 'set', index: k, value: a[k] };
    k++;
  }
  while (i < left.length) {
    a[k] = left[i++];
    yield { kind: 'set', index: k, value: a[k] };
    k++;
  }
  while (j < right.length) {
    a[k] = right[j++];
    yield { kind: 'set', index: k, value: a[k] };
    k++;
  }
}

function cmp(a, b) {
  return a.name.localeCompare(b.name);
}

/**
 * Bogosort — shuffle the array, check if sorted, repeat. Capped at MAX_TRIES
 * iterations because n! is astronomical even for n=10. The cap is also the
 * joke: real Bogosort would never finish in the heat death of the universe.
 */
export function* bogoSort(arr) {
  const MAX_TRIES = 1500;
  let a = [...arr];
  let stats = { comparisons: 0, swaps: 0 };
  let tries = 0;
  while (tries < MAX_TRIES) {
    // Fisher-Yates shuffle, yielding swap events so chips animate.
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      if (i !== j) {
        [a[i], a[j]] = [a[j], a[i]];
        stats.swaps++;
        yield { kind: 'swap', i, j };
      }
    }
    // Check sorted in one pass.
    let sorted = true;
    for (let i = 1; i < a.length; i++) {
      stats.comparisons++;
      if (cmp(a[i - 1], a[i]) > 0) { sorted = false; break; }
    }
    tries++;
    if (sorted) {
      for (let k = 0; k < a.length; k++) yield { kind: 'mark-sorted', i: k };
      yield { kind: 'done', stats };
      return;
    }
  }
  // Gave up.
  yield { kind: 'done', stats: { ...stats, gaveUp: true, tries } };
}

export const SORTS = {
  thanos:  { label: 'Thanos Sort',  fn: null,        complexity: 'O(log n) snaps' },
  bubble:  { label: 'Bubble Sort',  fn: bubbleSort,  complexity: 'O(n²)' },
  quick:   { label: 'Quick Sort',   fn: quickSort,   complexity: 'O(n log n) avg' },
  merge:   { label: 'Merge Sort',   fn: mergeSort,   complexity: 'O(n log n)' },
  bogo:    { label: 'Bogosort',     fn: bogoSort,    complexity: 'O((n+1)!) ' },
  race:    { label: 'Race (all)',   fn: null,        complexity: 'sequential head-to-head' }
};
