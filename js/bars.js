/**
 * Canvas-based bar visualizer for sort algorithms.
 *
 * Chips read as "names shuffling around"; bars read as "an algorithm
 * structurally working." Each person becomes a vertical bar whose height
 * encodes their alphabetical rank — sorted view shows a clean ramp.
 *
 * Swap and set ops mutate the position array; redraw is debounced via
 * requestAnimationFrame so a 1000-step sort doesn't blow out the main thread.
 */

let canvas = null;
let ctx = null;
let positions = []; // array of bar values (alphabetical rank, 0..n-1)
let highlights = new Map(); // index → 'cmp' | 'swap'
let sortedSet = new Set();
let drawScheduled = false;

export function init(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scheduleDraw();
}

export function render(people) {
  if (!canvas) return;
  // Rank each person alphabetically so the sorted state forms a clean ramp.
  const ranks = new Map();
  [...people].sort((a, b) => a.name.localeCompare(b.name)).forEach((p, i) => {
    ranks.set(p, i);
  });
  positions = people.map((p) => ranks.get(p));
  highlights = new Map();
  sortedSet = new Set();
  resize();
}

export function swapAt(i, j) {
  if (i === j) return;
  [positions[i], positions[j]] = [positions[j], positions[i]];
  scheduleDraw();
}

export function setAt(i, person, allPeople) {
  // For merge sort: rebuild rank for this position.
  if (!allPeople) return;
  const sorted = [...allPeople].sort((a, b) => a.name.localeCompare(b.name));
  positions[i] = sorted.indexOf(person);
  scheduleDraw();
}

export function highlight(indices, kind = 'cmp') {
  highlights = new Map();
  indices.forEach((i) => highlights.set(i, kind));
  scheduleDraw();
}

export function clearHighlights() {
  highlights = new Map();
  scheduleDraw();
}

export function markSorted(i) {
  sortedSet.add(i);
  scheduleDraw();
}

export function reset() {
  highlights = new Map();
  sortedSet = new Set();
  scheduleDraw();
}

function scheduleDraw() {
  if (drawScheduled || !ctx) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    drawScheduled = false;
    draw();
  });
}

function draw() {
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (!positions.length) return;
  const n = positions.length;
  const barW = w / n;
  const maxRank = n - 1;
  positions.forEach((rank, i) => {
    const ratio = maxRank > 0 ? rank / maxRank : 0;
    const barH = h * (0.15 + 0.85 * ratio);
    const x = i * barW;
    const y = h - barH;
    const hl = highlights.get(i);
    if (hl === 'swap') {
      ctx.fillStyle = '#facc15'; // gold
    } else if (hl === 'cmp') {
      ctx.fillStyle = '#a78bfa'; // accent
    } else if (sortedSet.has(i)) {
      ctx.fillStyle = '#6b9c7a'; // survivor green
    } else {
      // Gradient by rank — visual interest, no information loss
      const hue = 240 + ratio * 80; // purple → pink as you climb
      ctx.fillStyle = `hsl(${hue}, 55%, 60%)`;
    }
    ctx.fillRect(x, y, Math.max(1, barW - 1), barH);
  });
}
