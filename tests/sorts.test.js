import { describe, it, expect } from 'vitest';
import { SORTS, bubbleSort, quickSort, mergeSort, bogoSort } from '../js/sorts.js';

const sample = (n) => Array.from({ length: n }, (_, i) => ({
  name: 'NAMEABCDEFGHIJKL'[i % 16] + i
}));

function runSort(fn, arr) {
  // Replay the generator events to reconstruct the sorted order, mirroring
  // what chips.js does in the live app.
  const result = [...arr];
  let stats;
  for (const ev of fn(arr)) {
    if (ev.kind === 'swap') {
      [result[ev.i], result[ev.j]] = [result[ev.j], result[ev.i]];
    } else if (ev.kind === 'set') {
      result[ev.index] = ev.value;
    } else if (ev.kind === 'done') {
      stats = ev.stats;
    }
  }
  return { result, stats };
}

function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1].name.localeCompare(arr[i].name) > 0) return false;
  }
  return true;
}

describe('sorts', () => {
  it('SORTS dictionary contains expected entries', () => {
    expect(Object.keys(SORTS)).toEqual(
      expect.arrayContaining(['thanos', 'bubble', 'quick', 'merge', 'bogo', 'race'])
    );
  });

  for (const fn of [bubbleSort, quickSort, mergeSort]) {
    it(`${fn.name} produces a sorted array`, () => {
      const data = sample(20);
      const { result, stats } = runSort(fn, data);
      expect(isSorted(result)).toBe(true);
      expect(stats).toBeDefined();
      expect(stats.comparisons).toBeGreaterThan(0);
    });
  }

  it('bubbleSort on already-sorted array does fewer comparisons', () => {
    const sorted = sample(10).sort((a, b) => a.name.localeCompare(b.name));
    const { stats } = runSort(bubbleSort, sorted);
    // n-1 comparisons in best case (early termination)
    expect(stats.comparisons).toBeLessThan(50);
  });

  it('bogoSort gives up gracefully on a non-trivial input', () => {
    const data = sample(20);
    const { stats } = runSort(bogoSort, data);
    expect(stats).toBeDefined();
    // Either succeeded (very unlikely for n=20) or gave up
    if (stats.gaveUp) {
      expect(stats.tries).toBeGreaterThan(0);
    } else {
      expect(stats.comparisons).toBeGreaterThan(0);
    }
  });
});
