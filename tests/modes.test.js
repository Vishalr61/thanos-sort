import { describe, it, expect } from 'vitest';
import { MODES, modeIds } from '../js/modes.js';
import * as history from '../js/history.js';
import { setSeed } from '../js/rng.js';

const samplePeople = (n) => Array.from({ length: n }, (_, i) => ({
  name: `Person ${i}`,
  lat: i,
  lng: i
}));

describe('modes', () => {
  it('exposes all six expected stones', () => {
    expect(modeIds().sort()).toEqual(['mind', 'power', 'reality', 'soul', 'space', 'time'].sort());
  });

  describe('space (default snap)', () => {
    it('removes exactly floor(n/2) at random', () => {
      setSeed('test');
      const people = samplePeople(10);
      const plan = MODES.space.plan({ people });
      expect(plan.kind).toBe('remove');
      expect(plan.toRemove.size).toBe(5);
    });
    it('is a noop when 1 or 0 people remain', () => {
      expect(MODES.space.plan({ people: [] }).kind).toBe('noop');
      expect(MODES.space.plan({ people: samplePeople(1) }).kind).toBe('noop');
    });
  });

  describe('mind', () => {
    it('removes everyone NOT selected', () => {
      const people = samplePeople(10);
      const plan = MODES.mind.plan({ people, selected: [2, 4, 6] });
      expect(plan.kind).toBe('remove');
      expect(plan.toRemove.size).toBe(7);
      expect(plan.toRemove.has(2)).toBe(false);
      expect(plan.toRemove.has(4)).toBe(false);
      expect(plan.toRemove.has(6)).toBe(false);
    });
    it('is a noop when nothing selected', () => {
      expect(MODES.mind.plan({ people: samplePeople(5), selected: [] }).kind).toBe('noop');
    });
    it('is a noop when everyone selected', () => {
      const people = samplePeople(3);
      expect(MODES.mind.plan({ people, selected: [0, 1, 2] }).kind).toBe('noop');
    });
  });

  describe('soul', () => {
    it('returns toRemove with sacrifice and immortalIndex with rescue', () => {
      const people = samplePeople(5);
      const plan = MODES.soul.plan({ people, selected: [1, 3] });
      expect(plan.kind).toBe('soul');
      expect([...plan.toRemove]).toEqual([1]);
      expect(plan.immortalIndex).toBe(3);
    });
    it('requires exactly two selections', () => {
      expect(MODES.soul.plan({ people: samplePeople(5), selected: [1] }).kind).toBe('noop');
      expect(MODES.soul.plan({ people: samplePeople(5), selected: [1, 2, 3] }).kind).toBe('noop');
    });
  });

  describe('power', () => {
    it('removes everyone', () => {
      const people = samplePeople(7);
      const plan = MODES.power.plan({ people });
      expect(plan.kind).toBe('remove');
      expect(plan.toRemove.size).toBe(7);
    });
  });

  describe('reality', () => {
    it('returns toReplace with half the indices', () => {
      setSeed('reality');
      const people = samplePeople(10);
      const plan = MODES.reality.plan({ people });
      expect(plan.kind).toBe('reality');
      expect(plan.toReplace.size).toBe(5);
    });
  });

  describe('time', () => {
    it('returns noop when history is empty', () => {
      history.clear();
      expect(MODES.time.plan({ history }).kind).toBe('noop');
    });
    it('returns undo when history has entries', () => {
      history.clear();
      history.push({ people: [], snapCount: 1, immortals: new Set() });
      expect(MODES.time.plan({ history }).kind).toBe('undo');
    });
  });
});
