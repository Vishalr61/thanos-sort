/**
 * Undo stack for the Time Stone. Snapshots are taken before each snap;
 * undo restores the most recent snapshot.
 */

const stack = [];
const MAX_DEPTH = 32;

export function push(snapshot) {
  stack.push(snapshot);
  if (stack.length > MAX_DEPTH) stack.shift();
}

export function pop() {
  return stack.pop();
}

export function peek() {
  return stack[stack.length - 1];
}

export function size() {
  return stack.length;
}

export function clear() {
  stack.length = 0;
}
