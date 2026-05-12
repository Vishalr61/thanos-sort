import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed, random, randomInt, shuffleInPlace } from '../js/rng.js';

describe('rng', () => {
  it('is deterministic given the same seed', () => {
    setSeed('test-seed');
    const a = [random(), random(), random()];
    setSeed('test-seed');
    const b = [random(), random(), random()];
    expect(a).toEqual(b);
  });

  it('produces different streams for different seeds', () => {
    setSeed('seed-a');
    const a = [random(), random(), random()];
    setSeed('seed-b');
    const b = [random(), random(), random()];
    expect(a).not.toEqual(b);
  });

  it('randomInt stays in range', () => {
    setSeed('range-test');
    for (let i = 0; i < 1000; i++) {
      const n = randomInt(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });

  it('shuffleInPlace preserves length and elements', () => {
    setSeed('shuffle');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const copy = [...arr];
    shuffleInPlace(arr);
    expect(arr).toHaveLength(10);
    expect([...arr].sort((a, b) => a - b)).toEqual(copy);
  });

  it('shuffle is deterministic with seed', () => {
    setSeed('det');
    const a = shuffleInPlace([1, 2, 3, 4, 5]);
    setSeed('det');
    const b = shuffleInPlace([1, 2, 3, 4, 5]);
    expect(a).toEqual(b);
  });
});
