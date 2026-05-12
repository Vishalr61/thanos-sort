/**
 * Stone modes. Each describes:
 *   - label/color/hint        for the toolbar + mode-hint affordance
 *   - selectable              whether dot-clicks select people
 *   - plan(state)             pure function returning a removal/transform plan
 *
 * The main app reads the plan and executes the disintegrate animation, then
 * applies the resulting state. Keeping mode logic pure makes it testable and
 * keeps app.js as the single orchestrator.
 */

import { random } from './rng.js';

export const MODES = {
  snap: {
    label: 'Snap',
    icon: '∞',
    color: '#a78bfa',
    hint: 'Half the universe disintegrates at random. Click the gauntlet.',
    selectable: false,
    minSelected: 0,
    plan({ people }) {
      if (people.length <= 1) return { kind: 'noop' };
      const n = people.length;
      const toRemove = new Set();
      const target = Math.floor(n / 2);
      const pool = people.map((_, i) => i);
      for (let k = 0; k < target; k++) {
        const idx = Math.floor(random() * pool.length);
        toRemove.add(pool.splice(idx, 1)[0]);
      }
      return { kind: 'remove', toRemove };
    }
  },

  time: {
    label: 'Time',
    icon: '⏳',
    color: '#4ade80',
    hint: 'Click the gauntlet to undo the last snap.',
    selectable: false,
    minSelected: 0,
    plan({ history }) {
      if (history.size() === 0) return { kind: 'noop', reason: 'No snaps to undo.' };
      return { kind: 'undo' };
    }
  },

  soul: {
    label: 'Soul',
    icon: '♥',
    color: '#fb923c',
    hint: 'Click two dots: the first is sacrificed so the second becomes immortal. Then click the gauntlet.',
    selectable: true,
    minSelected: 2,
    maxSelected: 2,
    plan({ people, selected }) {
      if (selected.length !== 2) return { kind: 'noop', reason: 'Pick exactly two people.' };
      const [sacrificeIdx, savedIdx] = selected;
      return {
        kind: 'soul',
        toRemove: new Set([sacrificeIdx]),
        immortalIndex: savedIdx
      };
    }
  },

  mind: {
    label: 'Mind',
    icon: '✦',
    color: '#facc15',
    hint: 'Click dots to mark who lives. The gauntlet removes everyone else.',
    selectable: true,
    minSelected: 1,
    plan({ people, selected }) {
      if (selected.length === 0) return { kind: 'noop', reason: 'Mark at least one survivor.' };
      if (selected.length >= people.length) return { kind: 'noop', reason: 'Everyone is marked — no one to remove.' };
      const survive = new Set(selected);
      const toRemove = new Set();
      people.forEach((_, i) => { if (!survive.has(i)) toRemove.add(i); });
      return { kind: 'remove', toRemove };
    }
  },

  power: {
    label: 'Power',
    icon: '◉',
    color: '#c084fc',
    hint: 'Total annihilation. Nothing remains.',
    selectable: false,
    minSelected: 0,
    plan({ people }) {
      if (people.length === 0) return { kind: 'noop' };
      const toRemove = new Set(people.map((_, i) => i));
      return { kind: 'remove', toRemove };
    }
  },

  reality: {
    label: 'Reality',
    icon: '◈',
    color: '#ef4444',
    hint: 'Half disappear — new identities arrive in their place. Population stays the same.',
    selectable: false,
    minSelected: 0,
    plan({ people }) {
      if (people.length === 0) return { kind: 'noop' };
      const n = people.length;
      const toReplace = new Set();
      const target = Math.floor(n / 2);
      const pool = people.map((_, i) => i);
      for (let k = 0; k < target; k++) {
        const idx = Math.floor(random() * pool.length);
        toReplace.add(pool.splice(idx, 1)[0]);
      }
      return { kind: 'reality', toReplace };
    }
  }
};

export function modeIds() {
  return Object.keys(MODES);
}
