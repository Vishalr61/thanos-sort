/**
 * Thanos Sort — main app.
 *
 * Responsibilities: own the state, render the UI, dispatch mode/algorithm
 * actions, and orchestrate animations across the globe, the chips, and audio.
 * Mode logic lives in modes.js; algorithm logic lives in sorts.js; chip
 * rendering lives in chips.js — this file is the glue.
 */

import * as THREE from 'three';
import { generatePeople, LAND_COORDS } from './data.js';
import { playSnap, snapAudio, startAmbient, setAmbientLevel } from './sound.js';
import { createGlobe } from './globe.js';
import { MODES, modeIds } from './modes.js';
import { SORTS } from './sorts.js';
import * as chips from './chips.js';
import * as history from './history.js';
import * as stats from './stats.js';
import { setSeed, rolledSeed } from './rng.js';

// ─── Seed the RNG before anything else generates randomness ───
const url = new URL(window.location.href);
let currentSeed = url.searchParams.get('seed');
if (currentSeed) setSeed(currentSeed);
else currentSeed = rolledSeed();
syncSeedURL();

function syncSeedURL() {
  const u = new URL(window.location.href);
  u.searchParams.set('seed', currentSeed);
  // Note: history.replaceState is the browser API on window — must use
  // window.history because we imported the undo-stack module as `history`.
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, '', u);
  }
}

const canvas = document.getElementById('canvas');
const tooltip = document.getElementById('tooltip');
const messageEl = document.getElementById('message');
const snapBtn = document.getElementById('snapBtn');
const resetBtn = document.getElementById('resetBtn');
const panelToggle = document.getElementById('panelToggle');
const sidePanel = document.getElementById('sidePanel');
const snapQuoteEl = document.getElementById('snapQuote');
const algorithmSelect = document.getElementById('algorithmSelect');
const stonesRow = document.getElementById('stonesRow');
const modeHintEl = document.getElementById('modeHint');
const importBtn = document.getElementById('importBtn');
const importBackdrop = document.getElementById('importBackdrop');
const importTextarea = document.getElementById('importTextarea');
const importFile = document.getElementById('importFile');
const importApply = document.getElementById('importApply');
const importCancel = document.getElementById('importCancel');
const importRandomise = document.getElementById('importRandomise');
const panelSize = document.getElementById('panelSize');
const panelSnap = document.getElementById('panelSnap');
const panelRemaining = document.getElementById('panelRemaining');
const panelModeEl = document.getElementById('panelMode');
const panelComplexity = document.getElementById('panelComplexity');
const panelChipsEl = document.getElementById('panelChips');
const panelStatsSection = document.getElementById('panelStatsSection');
const panelStats = document.getElementById('panelStats');

chips.init(panelChipsEl);

const THANOS_QUOTES = [
  'Perfectly balanced. As all things should be.',
  'Reality is often disappointing.',
  'I am inevitable.',
  'Dread it. Run from it. Destiny arrives all the same.',
  'The hardest choices require the strongest wills.',
  'You should have gone for the head.',
  'Fun isn\'t something one considers when balancing the universe… but this does put a smile on my face.',
  'You could not live with your own failure. Where did that bring you? Back to me.',
  'I know what it\'s like to lose. To feel so desperately that you\'re right, yet to fail all the same.'
];
const randomQuote = () => THANOS_QUOTES[Math.floor(Math.random() * THANOS_QUOTES.length)];

// ─── State ───
const globe = createGlobe(canvas);
const { scene, camera, renderer, controls, dotMeshes, pickMeshes, renderPeople, spawnDust, updateDust } = globe;
let INITIAL_SIZE = LAND_COORDS.length;
let people = generatePeople();
INITIAL_SIZE = people.length;
let snapCount = 0;
let currentMode = 'snap';
let currentAlgo = 'thanos';
let selected = []; // ordered list of selected person indices (for Soul/Mind)
let immortalSet = new Set(); // person identities (by name+lat+lng) that cannot be removed
let busy = false; // true during a snap animation or sort run
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Initial render ───
renderPeople(people);
chips.render(people);
document.getElementById('file-protocol-warning')?.remove();
buildStonesRow();
updateModeUI();
updatePanel();
updateAmbient();
maybeShowOnboarding();
// Loading screen fades out once the globe is rendered.
requestAnimationFrame(() => {
  const ls = document.getElementById('loading-screen');
  if (ls) ls.classList.add('fade');
  setTimeout(() => ls?.remove(), 600);
});

// ─── Stones row ───
function buildStonesRow() {
  stonesRow.innerHTML = '';
  modeIds().forEach((id) => {
    const m = MODES[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stone';
    btn.dataset.mode = id;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(id === currentMode));
    btn.title = `${m.label} Stone — ${m.hint}`;
    btn.style.setProperty('--stone-color', m.color);
    btn.innerHTML = `<span class="stone-orb"></span><span class="stone-label">${m.label}</span>`;
    btn.addEventListener('click', () => setMode(id));
    stonesRow.appendChild(btn);
  });
}

function setMode(id) {
  if (busy) return;
  currentMode = id;
  selected = [];
  refreshDotStates();
  updateModeUI();
}

function setAlgorithm(id) {
  if (busy) return;
  currentAlgo = id;
  selected = [];
  refreshDotStates();
  // Hide stones row when not in Thanos algorithm — modes only apply to Thanos.
  stonesRow.classList.toggle('hidden', id !== 'thanos');
  // Reset chip highlights from any previous sort run.
  chips.reset();
  panelStatsSection.hidden = true;
  updateModeUI();
}

function updateModeUI() {
  // Stone-row active state + glow tint of the gauntlet button.
  stonesRow.querySelectorAll('.stone').forEach((b) => {
    const active = b.dataset.mode === currentMode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', String(active));
  });
  const algo = SORTS[currentAlgo];
  const mode = MODES[currentMode];

  if (currentAlgo !== 'thanos') {
    modeHintEl.textContent = `Click the gauntlet to run ${algo.label}. Watch the panel.`;
    snapBtn.style.setProperty('--mode-glow', '#9ca3af');
    snapBtn.dataset.modeGlow = 'on';
    panelModeEl.textContent = algo.label;
  } else {
    modeHintEl.textContent = mode.hint;
    snapBtn.style.setProperty('--mode-glow', mode.color);
    snapBtn.dataset.modeGlow = 'on';
    panelModeEl.textContent = `Thanos · ${mode.label}`;
  }
  panelComplexity.textContent = algo.complexity;
}

// ─── Panel ───
function updatePanel() {
  panelSize.textContent = INITIAL_SIZE;
  panelSnap.textContent = snapCount;
  panelRemaining.textContent = people.length;
  renderCareerStats();
  renderSeedRow();
}

function renderCareerStats() {
  const careerEl = document.getElementById('panelCareer');
  if (!careerEl) return;
  const s = stats.get();
  const mostUsed = Object.entries(s.modeUseCount).sort((a, b) => b[1] - a[1])[0];
  const fastest = s.fastestSortMs != null ? `${s.fastestSortLabel} · ${s.fastestSortMs.toLocaleString()}ms` : '—';
  careerEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">Snaps performed</span><span>${s.totalSnaps.toLocaleString()}</span></div>
    <div class="stat-row"><span class="stat-label">Total eliminated</span><span>${s.totalEliminated.toLocaleString()}</span></div>
    <div class="stat-row"><span class="stat-label">Universes reset</span><span>${s.universesReset.toLocaleString()}</span></div>
    <div class="stat-row"><span class="stat-label">Fastest sort</span><span>${fastest}</span></div>
    ${mostUsed ? `<div class="stat-row"><span class="stat-label">Favourite stone</span><span>${MODES[mostUsed[0]]?.label ?? mostUsed[0]} (${mostUsed[1]}×)</span></div>` : ''}
  `;
}

function renderSeedRow() {
  const seedEl = document.getElementById('panelSeed');
  if (!seedEl) return;
  seedEl.textContent = currentSeed;
}

// ─── Selection (Soul / Mind) ───
function isImmortal(person) {
  return immortalSet.has(personKey(person));
}
function personKey(p) {
  return `${p.name}@${p.lat},${p.lng}`;
}

function toggleSelect(index) {
  if (busy) return;
  const mode = MODES[currentMode];
  if (!mode.selectable) return;

  const at = selected.indexOf(index);
  if (at >= 0) {
    selected.splice(at, 1);
  } else {
    if (mode.maxSelected && selected.length >= mode.maxSelected) {
      // Soul Stone — replace the oldest selection so we always cap at 2.
      selected.shift();
    }
    selected.push(index);
  }
  refreshDotStates();
}

function refreshDotStates() {
  // Recompute visual state for every dot from scratch — cheap with N=50.
  people.forEach((p, i) => {
    if (isImmortal(p)) {
      globe.setDotState(i, 'immortal');
      chips.markImmortal(p);
      return;
    }
    if (MODES[currentMode].selectable && selected.includes(i)) {
      if (currentMode === 'soul') {
        // First click is sacrifice (red), second is rescue (orange-yellow).
        const role = selected.indexOf(i) === 0 ? 'sacrificed' : 'selected';
        globe.setDotState(i, role);
        if (role === 'sacrificed') chips.markSacrificed(p);
        else chips.markSelected(p, true);
      } else {
        globe.setDotState(i, 'selected');
        chips.markSelected(p, true);
      }
    } else {
      globe.setDotState(i, snapCount > 0 ? 'survivor' : 'default');
      chips.markSelected(p, false);
    }
  });
}

// ─── Pointer / hover ───
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function pick(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickMeshes);
  return hits.length ? hits[0].object.userData : null;
}

function updateTooltip(clientX, clientY) {
  const hit = pick(clientX, clientY);
  if (hit) {
    tooltip.textContent = hit.name;
    tooltip.classList.add('visible');
    tooltip.style.left = (clientX + 12) + 'px';
    tooltip.style.top = (clientY + 12) + 'px';
    return true;
  }
  tooltip.classList.remove('visible');
  return false;
}

canvas.addEventListener('pointermove', (e) => updateTooltip(e.clientX, e.clientY));
canvas.addEventListener('pointerdown', (e) => {
  startAmbient(); // first gesture unlocks autoplay
  const hit = pick(e.clientX, e.clientY);
  if (!hit) return;
  e.preventDefault();
  updateTooltip(e.clientX, e.clientY);
  if (MODES[currentMode].selectable && currentAlgo === 'thanos') {
    toggleSelect(hit.index);
  }
});

// ─── Gauntlet ───
snapBtn.addEventListener('click', () => {
  startAmbient();
  if (busy) return;
  if (currentAlgo === 'race') return runRace();
  if (currentAlgo !== 'thanos') return runSort();
  runMode();
});

function runMode() {
  const mode = MODES[currentMode];
  const plan = mode.plan({ people, history, selected });

  if (plan.kind === 'noop') {
    if (plan.reason) flashMessage(plan.reason);
    return;
  }

  if (plan.kind === 'undo') return runUndo();
  if (plan.kind === 'reality') return runReality(plan);
  if (plan.kind === 'soul') return runSoul(plan);
  if (plan.kind === 'remove') return runRemove(plan);
}

function flashMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove('final');
}

function snapshot() {
  history.push({
    people: people.map((p) => ({ ...p })),
    snapCount,
    immortals: new Set(immortalSet)
  });
}

function runRemove(plan) {
  busy = true;
  snapshot();
  // Honor immortality: any immortal index is removed from the toRemove set.
  const toRemove = new Set([...plan.toRemove].filter((i) => !isImmortal(people[i])));
  if (toRemove.size === 0) {
    busy = false;
    flashMessage('All targets were immortal. Nothing happened.');
    return;
  }

  snapQuoteEl.textContent = randomQuote();
  snapBtn.classList.add('snap-feedback');
  playSnap();
  snapBtn.disabled = true;

  const doomed = [...toRemove].map((i) => people[i]);
  chips.strike(doomed);
  disintegrate(toRemove, () => {
    people = people.filter((_, i) => !toRemove.has(i));
    snapCount++;
    selected = [];
    stats.recordSnap(currentMode, toRemove.size);
    chips.removeStruck().then(() => {
      globe.clearDots();
      people.forEach((p, i) => globe.addDot(p, i, true));
      refreshDotStates();
      updatePanel();
      updateAmbient();
      messageEl.textContent = `Snap. ${toRemove.size} eliminated. ${people.length} remain.`;
      snapBtn.classList.remove('snap-feedback');
      snapBtn.disabled = false;
      busy = false;
      if (people.length <= 1) {
        playEndgameCinematic();
      }
    });
  });
}

function runSoul(plan) {
  const sacrificeIdx = [...plan.toRemove][0];
  const savedIdx = plan.immortalIndex;
  const savedPerson = people[savedIdx];
  immortalSet.add(personKey(savedPerson));
  chips.markImmortal(savedPerson);
  runRemove({ toRemove: plan.toRemove });
}

function runReality(plan) {
  busy = true;
  snapshot();
  const toReplace = new Set([...plan.toReplace].filter((i) => !isImmortal(people[i])));
  if (toReplace.size === 0) {
    busy = false;
    const why = plan.toReplace.size === 0 ? 'Not enough souls to fold.' : 'All targets were immortal. Reality holds.';
    flashMessage(why);
    return;
  }
  snapQuoteEl.textContent = randomQuote();
  snapBtn.classList.add('snap-feedback');
  playSnap();
  snapBtn.disabled = true;

  const doomed = [...toReplace].map((i) => people[i]);
  chips.strike(doomed);
  disintegrate(toReplace, () => {
    // Replace each removed index with a freshly-generated person.
    const fresh = generatePeople();
    const replacements = fresh.slice(0, toReplace.size);
    let r = 0;
    people = people.map((p, i) => toReplace.has(i) ? replacements[r++] : p);
    snapCount++;
    chips.removeStruck().then(() => {
      chips.render(people);
      globe.clearDots();
      people.forEach((p, i) => globe.addDot(p, i, snapCount > 0));
      refreshDotStates();
      updatePanel();
      updateAmbient();
      messageEl.textContent = `Reality folds. ${toReplace.size} replaced.`;
      snapBtn.classList.remove('snap-feedback');
      snapBtn.disabled = false;
      busy = false;
    });
  });
}

function runUndo() {
  const snap = history.pop();
  if (!snap) {
    flashMessage('No snaps to undo.');
    return;
  }
  busy = true;
  people = snap.people;
  snapCount = Math.max(0, snap.snapCount);
  immortalSet = new Set(snap.immortals);
  selected = [];
  chips.render(people);
  globe.clearDots();
  people.forEach((p, i) => globe.addDot(p, i, snapCount > 0));
  refreshDotStates();
  updatePanel();
  updateAmbient();
  dismissEndgame();
  messageEl.textContent = `Time rewound. ${people.length} restored.`;
  messageEl.classList.remove('final');
  snapBtn.disabled = false;
  busy = false;
}

function disintegrate(toRemoveSet, done) {
  const soundDurationMs = (snapAudio.duration && isFinite(snapAudio.duration)) ? snapAudio.duration * 1000 : 2400;
  const disintegrateMs = reducedMotion ? 200 : Math.max(1200, soundDurationMs);

  const toRemoveDots = dotMeshes.filter((d) => toRemoveSet.has(d.index));
  toRemoveDots.forEach(({ mesh }) => {
    if (!reducedMotion) spawnDust(mesh.position.clone(), disintegrateMs);
    const mat = mesh.material;
    if (!mat.transparent) {
      mat.transparent = true;
      mat.opacity = 1;
    }
    if (reducedMotion) {
      // Skip the long animation; just fade out instantly.
      mat.opacity = 0;
      mesh.scale.setScalar(0);
      return;
    }
    const start = performance.now();
    function step() {
      const t = (performance.now() - start) / disintegrateMs;
      if (t >= 1) {
        if (mesh.parent) mesh.parent.remove(mesh);
        return;
      }
      const s = 1 - t;
      mesh.scale.setScalar(s);
      mat.opacity = s;
      requestAnimationFrame(step);
    }
    step();
  });

  setTimeout(done, disintegrateMs + 80);
}

// ─── Sort algorithms ───
let sortAbort = false;
async function runSort() {
  const sort = SORTS[currentAlgo];
  if (!sort.fn) return;
  busy = true;
  sortAbort = false;
  snapBtn.disabled = true;
  snapBtn.classList.add('snap-feedback');
  panelStatsSection.hidden = true;
  chips.reset();
  // Always re-render chips in current order so the animation starts clean.
  chips.render(people);

  const gen = sort.fn(people);
  // Per-algorithm pacing: bubble sort has ~25× more steps than quick/merge,
  // so it gets a faster delay. Total runtime stays in the "watchable" zone.
  const stepDelay = reducedMotion ? 0 : ({ bubble: 6, quick: 22, merge: 22 }[currentAlgo] ?? 12);
  const arr = [...people];
  const start = performance.now();
  let stats = { comparisons: 0, swaps: 0 };

  for (const step of gen) {
    if (sortAbort) break;
    if (step.kind === 'compare') chips.highlight([step.i, step.j], 'cmp');
    else if (step.kind === 'swap') {
      chips.highlight([step.i, step.j], 'swap');
      [arr[step.i], arr[step.j]] = [arr[step.j], arr[step.i]];
      chips.swapAt(step.i, step.j);
    } else if (step.kind === 'set') {
      arr[step.index] = step.value;
      chips.setAt(step.index, step.value);
    } else if (step.kind === 'mark-sorted') {
      chips.markSorted(step.i);
    } else if (step.kind === 'done') {
      stats = step.stats;
    }
    if (stepDelay) await wait(stepDelay);
  }

  chips.clearHighlights();
  // Commit the sorted order back to the people array, then re-render chips so
  // chipById matches DOM. Without this, merge sort's `set` ops leave the
  // chipById map stale and a subsequent Thanos snap would strike the wrong
  // pills. Skip when bogosort gave up — the array isn't actually sorted then,
  // and forcing a sort would contradict the "gave up" stat.
  if (!sortAbort && !stats.gaveUp) {
    people.sort((a, b) => a.name.localeCompare(b.name));
    chips.render(people);
    people.forEach((_, i) => chips.markSorted(i));
  }
  const elapsedMs = Math.round(performance.now() - start);
  showRunStats(sort, stats, elapsedMs);
  snapBtn.classList.remove('snap-feedback');
  snapBtn.disabled = false;
  busy = false;
  messageEl.textContent = `${sort.label} done in ${elapsedMs.toLocaleString()}ms. The snap takes one click.`;
}

function showRunStats(sort, runStats, elapsedMs) {
  panelStatsSection.hidden = false;
  const tail = runStats.gaveUp
    ? `<div class="stat-row"><span class="stat-label">Result</span><span style="color: var(--danger)">Gave up after ${runStats.tries.toLocaleString()} tries.</span></div>`
    : '';
  panelStats.innerHTML = `
    <div class="stat-row"><span class="stat-label">Algorithm</span><span>${sort.label}</span></div>
    <div class="stat-row"><span class="stat-label">Comparisons</span><span>${runStats.comparisons.toLocaleString()}</span></div>
    <div class="stat-row"><span class="stat-label">Swaps/writes</span><span>${runStats.swaps.toLocaleString()}</span></div>
    <div class="stat-row"><span class="stat-label">Elapsed</span><span>${elapsedMs.toLocaleString()}ms</span></div>
    ${tail}
    <div class="stat-final">Thanos Sort: 1 snap. O(log n).</div>
  `;
  if (!runStats.gaveUp) stats.recordSort(sort.label, elapsedMs);
}

// ─── Race mode ───
async function runRace() {
  busy = true;
  snapBtn.disabled = true;
  snapBtn.classList.add('snap-feedback');
  panelStatsSection.hidden = true;
  const original = [...people];
  const contestants = ['bubble', 'quick', 'merge'];
  const results = [];
  for (const id of contestants) {
    if (sortAbort) break;
    people = original.map((p) => ({ ...p }));
    chips.render(people);
    messageEl.textContent = `Racing ${SORTS[id].label}...`;
    const sort = SORTS[id];
    const gen = sort.fn(people);
    const stepDelay = ({ bubble: 4, quick: 14, merge: 14 }[id]) ?? 8;
    const start = performance.now();
    let s = { comparisons: 0, swaps: 0 };
    for (const step of gen) {
      if (sortAbort) break;
      if (step.kind === 'compare') chips.highlight([step.i, step.j], 'cmp');
      else if (step.kind === 'swap') { chips.highlight([step.i, step.j], 'swap'); chips.swapAt(step.i, step.j); }
      else if (step.kind === 'set')  chips.setAt(step.index, step.value);
      else if (step.kind === 'mark-sorted') chips.markSorted(step.i);
      else if (step.kind === 'done') s = step.stats;
      if (stepDelay) await wait(stepDelay);
    }
    chips.clearHighlights();
    results.push({ id, label: sort.label, stats: s, elapsedMs: Math.round(performance.now() - start) });
    await wait(250);
  }
  // Final state: original order.
  people = original;
  chips.render(people);
  showRaceResults(results);
  snapBtn.classList.remove('snap-feedback');
  snapBtn.disabled = false;
  busy = false;
}

function showRaceResults(results) {
  if (!results.length) return;
  panelStatsSection.hidden = false;
  const winner = [...results].sort((a, b) => a.elapsedMs - b.elapsedMs)[0];
  const rows = results.map((r) => {
    const isWin = r.id === winner.id;
    return `<div class="stat-row${isWin ? ' stat-row-winner' : ''}">
      <span class="stat-label">${r.label}${isWin ? ' 🏆' : ''}</span>
      <span>${r.elapsedMs.toLocaleString()}ms · ${r.stats.comparisons.toLocaleString()} cmp</span>
    </div>`;
  }).join('');
  panelStats.innerHTML = `
    ${rows}
    <div class="stat-final">Thanos Sort: 1 snap. Race over before it began.</div>
  `;
  messageEl.textContent = `${winner.label} won. Thanos still snaps faster.`;
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── End-game cinematic ───
function playEndgameCinematic() {
  // Final state overlay.
  const overlay = document.getElementById('endgame');
  const titleEl = document.getElementById('endgameTitle');
  const subEl = document.getElementById('endgameSub');
  if (!overlay) return;
  if (people.length === 1) {
    titleEl.textContent = people[0].name.toUpperCase();
    subEl.textContent = 'The last soul. The universe is balanced.';
  } else {
    titleEl.textContent = 'NOTHING';
    subEl.textContent = 'Perfect balance. Nothing remains.';
  }
  overlay.classList.add('visible');

  // Camera dolly toward survivor's lat/lng (or pull back if none).
  if (people.length === 1) {
    const survivor = people[0];
    const target = globe.latLngToVector3(survivor.lat, survivor.lng, 1.0);
    const start = camera.position.clone();
    const end = target.clone().normalize().multiplyScalar(2.0);
    const dur = 1800;
    const t0 = performance.now();
    function step() {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(start, end, eased);
      camera.lookAt(0, 0, 0);
      if (t < 1) requestAnimationFrame(step);
    }
    step();
  }

  messageEl.classList.add('final');
  snapBtn.disabled = true;
}

function dismissEndgame() {
  document.getElementById('endgame')?.classList.remove('visible');
  // Re-enable the gauntlet so Time Stone can still rewind from the
  // balanced state. If snap mode is selected with 1 person, plan()
  // returns noop and flashes a message — safe either way.
  snapBtn.disabled = false;
}

// ─── Reset ───
function reset() {
  if (busy) return;
  // New seed every reset → URL updates → share link reflects current state.
  currentSeed = rolledSeed();
  syncSeedURL();
  stats.recordReset();
  people = generatePeople();
  INITIAL_SIZE = people.length;
  snapCount = 0;
  immortalSet.clear();
  selected = [];
  history.clear();
  sortAbort = true;
  snapQuoteEl.textContent = '';
  messageEl.textContent = `${INITIAL_SIZE} souls. One snap away from balance.`;
  messageEl.classList.remove('final');
  snapBtn.classList.remove('snap-feedback');
  snapBtn.disabled = false;
  renderPeople(people);
  chips.render(people);
  panelStatsSection.hidden = true;
  dismissEndgame();
  // Camera returns to default position.
  camera.position.set(0, 0, 3.2);
  camera.lookAt(0, 0, 0);
  updatePanel();
  updateAmbient();
  refreshDotStates();
}

// ─── Ambient audio ───
function updateAmbient() {
  setAmbientLevel(INITIAL_SIZE ? people.length / INITIAL_SIZE : 0);
}

// ─── Import names modal ───
function openImport() {
  importBackdrop.hidden = false;
  importTextarea.value = people.map((p) => p.name).join('\n');
  setTimeout(() => importTextarea.focus(), 0);
}
function closeImport() { importBackdrop.hidden = true; }

importBtn.addEventListener('click', openImport);
importCancel.addEventListener('click', closeImport);
importBackdrop.addEventListener('click', (e) => {
  if (e.target === importBackdrop) closeImport();
});
importFile.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  importTextarea.value = text;
});
importApply.addEventListener('click', () => {
  const names = importTextarea.value
    .split(/\r?\n|,/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, LAND_COORDS.length);
  if (!names.length) {
    flashMessage('Need at least one name.');
    return;
  }
  applyImportedNames(names);
  closeImport();
});

importRandomise.addEventListener('click', () => {
  const fresh = generatePeople();
  importTextarea.value = fresh.map((p) => p.name).join('\n');
});

function applyImportedNames(names) {
  const coords = [...LAND_COORDS]
    .sort(() => Math.random() - 0.5)
    .slice(0, names.length);
  people = names.map((name, i) => ({
    name,
    lat: coords[i][0],
    lng: coords[i][1]
  }));
  INITIAL_SIZE = people.length;
  snapCount = 0;
  immortalSet.clear();
  selected = [];
  history.clear();
  renderPeople(people);
  chips.render(people);
  panelStatsSection.hidden = true;
  updatePanel();
  updateAmbient();
  refreshDotStates();
  messageEl.textContent = `${INITIAL_SIZE} souls of your choosing. The snap doesn't care who.`;
  messageEl.classList.remove('final');
  snapBtn.disabled = false;
}

// ─── Panel toggle / resize ───
function setPanelOpen(open) {
  sidePanel.classList.toggle('open', open);
  document.body.classList.toggle('panel-open', open);
  panelToggle.setAttribute('aria-expanded', String(open));
  sidePanel.setAttribute('aria-hidden', String(!open));
}
panelToggle.addEventListener('click', () => setPanelOpen(!sidePanel.classList.contains('open')));
document.getElementById('panelClose').addEventListener('click', () => setPanelOpen(false));

// Listen for the panel transition to finish, then resize the renderer.
// Cleaner than rAF-after-toggle which fires before CSS has settled.
const handleCanvasResize = () => {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
sidePanel.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'transform') handleCanvasResize();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Toolbar wiring ───
algorithmSelect.addEventListener('change', (e) => setAlgorithm(e.target.value));
resetBtn.addEventListener('click', reset);

// Make sure dropdown also lists newer algorithms added to SORTS.
syncAlgorithmDropdown();
function syncAlgorithmDropdown() {
  const existing = new Set([...algorithmSelect.options].map((o) => o.value));
  Object.entries(SORTS).forEach(([id, def]) => {
    if (existing.has(id)) return;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = def.label;
    algorithmSelect.appendChild(opt);
  });
}

// ─── Share button ───
document.getElementById('shareBtn')?.addEventListener('click', async () => {
  const u = new URL(window.location.href);
  u.searchParams.set('seed', currentSeed);
  const link = u.toString();
  try {
    await navigator.clipboard.writeText(link);
    flashMessage('Share link copied to clipboard.');
  } catch {
    prompt('Copy this share link:', link);
  }
});

// ─── Endgame overlay close ───
document.getElementById('endgameClose')?.addEventListener('click', dismissEndgame);

// ─── Onboarding ───
function maybeShowOnboarding() {
  let done;
  try { done = localStorage.getItem('thanos-sort:onboarded'); } catch { done = '1'; }
  if (done) return;
  const overlay = document.getElementById('onboarding');
  if (!overlay) return;
  overlay.hidden = false;
  let step = 0;
  const steps = [...overlay.querySelectorAll('[data-onboard-step]')];
  function show(i) {
    steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
  }
  show(0);
  overlay.querySelector('#onboardNext').addEventListener('click', () => {
    step++;
    if (step >= steps.length) {
      overlay.hidden = true;
      try { localStorage.setItem('thanos-sort:onboarded', '1'); } catch {}
      return;
    }
    show(step);
  });
  overlay.querySelector('#onboardSkip').addEventListener('click', () => {
    overlay.hidden = true;
    try { localStorage.setItem('thanos-sort:onboarded', '1'); } catch {}
  });
}

// ─── Keyboard shortcuts ───
window.addEventListener('keydown', (e) => {
  // Ignore when typing into inputs / textareas / when modal is open.
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (!importBackdrop.hidden) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      snapBtn.click();
      break;
    case 'r': case 'R':
      reset();
      break;
    case 'i': case 'I':
      openImport();
      break;
    case 'a': case 'A':
      algorithmSelect.focus();
      break;
    case 'p': case 'P':
      setPanelOpen(!sidePanel.classList.contains('open'));
      break;
    case '?':
      document.getElementById('shortcuts')?.classList.toggle('visible');
      break;
    case 'Escape':
      dismissEndgame();
      document.getElementById('shortcuts')?.classList.remove('visible');
      break;
    default:
      if (currentAlgo !== 'thanos') return;
      // 1..6 select stones by position
      const idx = Number(e.key) - 1;
      const ids = modeIds();
      if (idx >= 0 && idx < ids.length) {
        setMode(ids[idx]);
      }
  }
});

// ─── Animation loop ───
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updateDust(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();
