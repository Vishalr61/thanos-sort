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
import { playSnap, snapAudio, startAmbient, setAmbientLevel, playTone, playEndgameChord, playClick, playWhoosh, playDing } from './sound.js';
import { createGlobe } from './globe.js';
import { MODES, modeIds } from './modes.js';
import { SORTS } from './sorts.js';
import * as chips from './chips.js';
import * as bars from './bars.js';
import * as history from './history.js';
import * as stats from './stats.js';
import { setSeed, rolledSeed } from './rng.js';
import { tick as tickNumber, sparkline as renderSparkline } from './counter.js';
import * as achievements from './achievements.js';
import * as settings from './settings.js';
import { WORLDS, listIds as listWorldIds, generateProceduralWorld } from './worlds.js';

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
const algoTrigger = document.getElementById('algoTrigger');
const algoMenu = document.getElementById('algoMenu');
const algoCurrent = document.getElementById('algoCurrent');

// Chip clicks mirror dot clicks — keyboard users get the same selection
// affordance without needing to reach the canvas (which isn't focusable).
chips.init(panelChipsEl, {
  onActivate: (index) => {
    if (MODES[currentMode].selectable && currentAlgo === 'thanos') {
      toggleSelect(index);
    }
  }
});
// Init bar visualizer.
const barsCanvas = document.getElementById('panelBars');
if (barsCanvas) bars.init(barsCanvas);

let sortView = 'chips';
document.querySelectorAll('.view-toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    sortView = btn.dataset.view;
    document.querySelectorAll('.view-toggle-btn').forEach((b) => b.classList.toggle('active', b === btn));
    panelChipsEl.hidden = (sortView !== 'chips');
    barsCanvas.hidden = (sortView !== 'bars');
    if (sortView === 'bars') bars.render(people);
  });
});

function announce(text) {
  const el = document.getElementById('sr-live');
  if (el) el.textContent = text;
}

// ─── Achievements glue ───
const toastHost = document.getElementById('toasts');
function checkAchievements() {
  const fresh = achievements.tick(stats.get());
  fresh.forEach((def) => achievements.showToast(toastHost, def));
  if (fresh.length) renderAchievementsGrid();
}

function renderAchievementsGrid() {
  const grid = document.getElementById('achievementsGrid');
  const count = document.getElementById('achCount');
  if (!grid) return;
  grid.innerHTML = '';
  achievements.ACHIEVEMENTS.forEach((def) => {
    const cell = document.createElement('div');
    const unlocked = achievements.isUnlocked(def.id);
    cell.className = `achievement-badge${unlocked ? ' unlocked' : ''}`;
    cell.textContent = unlocked ? def.icon : '·';
    cell.title = unlocked ? `${def.title} — ${def.sub}` : 'Locked';
    grid.appendChild(cell);
  });
  if (count) count.textContent = `${achievements.allUnlocked().size}/${achievements.ACHIEVEMENTS.length}`;
}

function renderModeUsage() {
  const host = document.getElementById('modeUsage');
  if (!host) return;
  const counts = stats.get().modeUseCount;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  host.innerHTML = '';
  if (total === 0) {
    host.style.opacity = '0.5';
    const empty = document.createElement('div');
    empty.className = 'mode-usage-segment';
    empty.style.cssText = `flex: 1; background: var(--text-faint)`;
    host.appendChild(empty);
    return;
  }
  host.style.opacity = '1';
  Object.entries(counts).forEach(([id, n]) => {
    if (!n) return;
    const m = MODES[id];
    if (!m) return;
    const seg = document.createElement('div');
    seg.className = 'mode-usage-segment';
    seg.style.cssText = `flex: ${n}; background: ${m.color}`;
    seg.title = `${m.label}: ${n}`;
    host.appendChild(seg);
  });
}

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
const { scene, camera, renderer, controls, dotMeshes, pickMeshes, renderPeople, spawnDust, updateDust, updateClouds, updateHalos, setHoverRing, updateHoverRing, setWorld, getWorld } = globe;
let INITIAL_SIZE = LAND_COORDS.length;
let people = generatePeople();
INITIAL_SIZE = people.length;
let snapCount = 0;
// Population over time — feeds the sparkline. Index 0 is initial size,
// each snap appends new remaining count, reset clears.
let populationHistory = [INITIAL_SIZE];
let currentMode = 'space';
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
buildAlgoDropdown();
snapBtn.setAttribute('data-mode', currentMode);
updateModeUI();
updatePanel();
updateAmbient();
// Hero intro: shown only on first visit, before the loading screen fades out.
// Sequence is hero (2.4s) → loading fade → onboarding (if applicable).
let heroSeen;
try { heroSeen = localStorage.getItem('thanos-sort:hero-seen'); } catch { heroSeen = '1'; }
const heroEl = document.getElementById('hero-intro');

function dismissHero() {
  if (!heroEl) return;
  heroEl.classList.add('fade');
  setTimeout(() => heroEl.remove(), 800);
  try { localStorage.setItem('thanos-sort:hero-seen', '1'); } catch {}
}

if (!heroSeen && heroEl) {
  heroEl.hidden = false;
  setTimeout(() => heroEl.classList.add('fade'), 2400);
  setTimeout(() => heroEl.remove(), 3200);
  try { localStorage.setItem('thanos-sort:hero-seen', '1'); } catch {}
} else if (heroEl) {
  // Defensive: force-hide on return visits in case any CSS rule clobbered
  // the [hidden] attribute. Without this, returning users would be stuck.
  heroEl.hidden = true;
}

// Click/tap anywhere on the hero dismisses it — escape valve in case
// the timed sequence stalls or the user is impatient.
heroEl?.addEventListener('click', dismissHero);

// Loading screen + onboarding fire after the hero (or immediately on return visits).
const postHeroDelay = (!heroSeen && heroEl) ? 2400 : 0;
setTimeout(() => {
  maybeShowOnboarding();
// Render achievement gallery on boot so it's visible even before first snap.
renderAchievementsGrid();
renderModeUsage();
  const ls = document.getElementById('loading-screen');
  if (ls) ls.classList.add('fade');
  setTimeout(() => ls?.remove(), 600);
}, postHeroDelay);

// ─── Stones row ───
// Hover frequencies per stone, mapped roughly to color wavelength.
// Red is low (long wavelength), violet/blue is high (short wavelength).
const STONE_FREQ = {
  reality: 220,   // red — A3
  soul:    277,   // orange — C#4
  power:   330,   // violet — E4
  mind:    370,   // yellow — F#4
  time:    415,   // green — G#4
  space:   494    // blue — B4
};

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
    btn.addEventListener('mouseenter', () => {
      playTone(STONE_FREQ[id] || 330, { duration: 0.14, peak: 0.04 });
    });
    btn.addEventListener('click', (e) => {
      // Spawn a ripple at the click point — animates outward then fades.
      spawnRipple(btn, e);
      playTone(STONE_FREQ[id] || 330, { duration: 0.22, peak: 0.08 });
      setMode(id);
    });
    stonesRow.appendChild(btn);
  });
}

function spawnRipple(host, event) {
  const r = document.createElement('span');
  r.className = 'stone-ripple';
  const rect = host.getBoundingClientRect();
  const x = (event.clientX - rect.left);
  const y = (event.clientY - rect.top);
  r.style.left = `${x}px`;
  r.style.top = `${y}px`;
  host.appendChild(r);
  setTimeout(() => r.remove(), 700);
}

function setMode(id) {
  if (busy) return;
  currentMode = id;
  selected = [];
  // Set data-mode on the gauntlet so CSS per-stone pose kicks in.
  snapBtn.setAttribute('data-mode', id);
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
  stonesRow.querySelectorAll('.stone').forEach((b) => {
    const active = b.dataset.mode === currentMode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', String(active));
  });
  const algo = SORTS[currentAlgo];
  const mode = MODES[currentMode];
  const newGlow = (currentAlgo !== 'thanos') ? '#9ca3af' : mode.color;
  const newHint = (currentAlgo !== 'thanos')
    ? `Click the gauntlet to run ${algo.label}. Watch the panel.`
    : mode.hint;
  const newPanelMode = (currentAlgo !== 'thanos') ? algo.label : `Thanos · ${mode.label}`;

  // Cross-fade the hint text: fade out, swap content, fade in. ~250ms total.
  if (modeHintEl.textContent !== newHint) {
    modeHintEl.classList.add('fading');
    setTimeout(() => {
      modeHintEl.textContent = newHint;
      modeHintEl.classList.remove('fading');
    }, 200);
  }

  snapBtn.style.setProperty('--mode-glow', newGlow);
  snapBtn.dataset.modeGlow = 'on';
  panelModeEl.textContent = newPanelMode;
  panelComplexity.textContent = algo.complexity;
}

// ─── Panel ───
function updatePanel() {
  // Animated counters via rAF easing — values tick rather than jump.
  tickNumber(panelSize, INITIAL_SIZE);
  tickNumber(panelSnap, snapCount);
  tickNumber(panelRemaining, people.length);
  renderCareerStats();
  renderSeedRow();
  renderModeUsage();
  renderAchievementsGrid();
  // Sparkline reflects current population history (hide if user disabled it).
  const sparkEl = document.getElementById('sparkline');
  if (sparkEl) {
    sparkEl.style.display = settings.get().showSparkline ? '' : 'none';
    if (settings.get().showSparkline) renderSparkline(sparkEl, populationHistory);
  }
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
  if (seedEl) seedEl.textContent = currentSeed;
  const seedVal = document.getElementById('seedValue');
  if (seedVal) seedVal.textContent = currentSeed;
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
    // Light up the hover ring at the dot's world position.
    const dotEntry = dotMeshes.find((d) => d.index === hit.index);
    if (dotEntry) setHoverRing(dotEntry.mesh.position);
    canvas.style.cursor = 'pointer';
    return true;
  }
  tooltip.classList.remove('visible');
  setHoverRing(null);
  canvas.style.cursor = '';
  return false;
}

canvas.addEventListener('pointermove', (e) => {
  updateTooltip(e.clientX, e.clientY);
  dismissGlobeHint();
});

// First-contact globe hint — show once per session, dismiss on first drag.
let globeHintShown = false;
function maybeShowGlobeHint() {
  if (globeHintShown) return;
  let seen;
  try { seen = localStorage.getItem('thanos-sort:globe-hint-seen'); } catch { seen = '1'; }
  if (seen) { globeHintShown = true; return; }
  const hint = document.getElementById('globeHint');
  if (!hint) return;
  hint.hidden = false;
  globeHintShown = true;
  setTimeout(() => hint.remove(), 3000);
  try { localStorage.setItem('thanos-sort:globe-hint-seen', '1'); } catch {}
}
function dismissGlobeHint() {
  if (globeHintShown) return;
  maybeShowGlobeHint();
}
canvas.addEventListener('pointerover', maybeShowGlobeHint);
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
  // Mid-sort cancel: clicking the gauntlet while a sort is running aborts it.
  if (busy && (currentAlgo !== 'thanos' || currentAlgo === 'race')) {
    sortAbort = true;
    return;
  }
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
    immortals: new Set(immortalSet),
    populationHistory: [...populationHistory]
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
    populationHistory.push(people.length);
    stats.recordSnap(currentMode, toRemove.size);
    checkAchievements();
    chips.removeStruck().then(() => {
      globe.clearDots();
      people.forEach((p, i) => globe.addDot(p, i, true));
      refreshDotStates();
      updatePanel();
      updateAmbient();
      messageEl.textContent = `Snap. ${toRemove.size} eliminated. ${people.length} remain.`;
      announce(`Snap. ${toRemove.size} eliminated. ${people.length} remain.`);
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
  populationHistory = snap.populationHistory || [INITIAL_SIZE];
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
  toRemoveDots.forEach(({ mesh, halo }) => {
    if (!reducedMotion) spawnDust(mesh.position.clone(), disintegrateMs);
    const mat = mesh.material;
    if (!mat.transparent) {
      mat.transparent = true;
      mat.opacity = 1;
    }
    if (reducedMotion) {
      mat.opacity = 0;
      mesh.scale.setScalar(0);
      if (halo) { halo.material.opacity = 0; halo.scale.setScalar(0); }
      return;
    }
    const start = performance.now();
    function step() {
      const t = (performance.now() - start) / disintegrateMs;
      if (t >= 1) {
        if (mesh.parent) mesh.parent.remove(mesh);
        if (halo && halo.parent) halo.parent.remove(halo);
        return;
      }
      const s = 1 - t;
      mesh.scale.setScalar(s);
      mat.opacity = s;
      if (halo) {
        halo.material.opacity = (halo.userData.isSurvivor ? 0.7 : 0.45) * s;
      }
      requestAnimationFrame(step);
    }
    step();
  });

  setTimeout(done, disintegrateMs + 80);
}

// ─── Sort algorithms ───
let sortAbort = false;
const BOGO_CAP = 5;
async function runSort() {
  const sort = SORTS[currentAlgo];
  if (!sort.fn) return;
  busy = true;
  sortAbort = false;
  // Note: snapBtn stays clickable during sort so mid-sort cancel works.
  // The data-state attribute switches the gauntlet to a cancel-X visual.
  snapBtn.setAttribute('data-state', 'sorting');
  snapBtn.classList.add('snap-feedback');
  panelStatsSection.hidden = true;
  chips.reset();

  // Bogosort is O((n+1)!) — even n=10 is 36 million perms. Cap the working
  // set to 8 so the algorithm can actually finish sometimes.
  let working = people;
  let bogoSlice = false;
  if (currentAlgo === 'bogo' && people.length > BOGO_CAP) {
    working = people.slice(0, BOGO_CAP);
    bogoSlice = true;
    messageEl.textContent = `Bogosort can only handle ~${BOGO_CAP} elements. Trying that subset...`;
  }
  // Always re-render chips in current order so the animation starts clean.
  chips.render(working);

  const gen = sort.fn(working);
  // Per-algorithm pacing: bubble sort has ~25× more steps than quick/merge,
  // so it gets a faster delay. Total runtime stays in the "watchable" zone.
  const stepDelay = reducedMotion ? 0 : ({ bubble: 6, quick: 22, merge: 22, bogo: 30 }[currentAlgo] ?? 12);
  const arr = [...working];
  const start = performance.now();
  let stats = { comparisons: 0, swaps: 0 };

  // Dispatch each step to whichever visualizer is active.
  const viz = (sortView === 'bars') ? bars : chips;
  if (sortView === 'bars') bars.render(working);
  for (const step of gen) {
    if (sortAbort) break;
    if (step.kind === 'compare') viz.highlight([step.i, step.j], 'cmp');
    else if (step.kind === 'swap') {
      viz.highlight([step.i, step.j], 'swap');
      [arr[step.i], arr[step.j]] = [arr[step.j], arr[step.i]];
      viz.swapAt(step.i, step.j);
    } else if (step.kind === 'set') {
      arr[step.index] = step.value;
      // bars.setAt needs the full people array to recompute ranks; chips.setAt
      // only needs the per-element person.
      if (sortView === 'bars') bars.setAt(step.index, step.value, people);
      else chips.setAt(step.index, step.value);
    } else if (step.kind === 'mark-sorted') {
      viz.markSorted(step.i);
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
  } else if (bogoSlice) {
    // After bogosort on a slice, restore the full chip view so the user sees
    // the rest of the universe still intact.
    chips.render(people);
  }
  const elapsedMs = Math.round(performance.now() - start);
  if (sortAbort) {
    messageEl.textContent = `${sort.label} cancelled.`;
  } else {
    showRunStats(sort, stats, elapsedMs);
    messageEl.textContent = `${sort.label} done in ${elapsedMs.toLocaleString()}ms. The snap takes one click.`;
  }
  snapBtn.classList.remove('snap-feedback');
  snapBtn.removeAttribute('data-state');
  busy = false;
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
  if (!runStats.gaveUp) {
    stats.recordSort(sort.label, elapsedMs);
    playDing();
    checkAchievements();
  }
}

// ─── Race mode ───
async function runRace() {
  busy = true;
  sortAbort = false;
  snapBtn.setAttribute('data-state', 'sorting');
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
  if (sortAbort) {
    messageEl.textContent = 'Race cancelled.';
  } else {
    showRaceResults(results);
  }
  snapBtn.classList.remove('snap-feedback');
  snapBtn.removeAttribute('data-state');
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

  // Sound: dip the ambient murmur, play a soft chord swell on top.
  setAmbientLevel(0.05);
  setTimeout(() => playEndgameChord(), 350);
  // Restore ambient gradually after the swell finishes.
  setTimeout(() => setAmbientLevel(INITIAL_SIZE ? people.length / INITIAL_SIZE : 0), 4500);

  // Body class so we can brighten the nebula + starfield via CSS.
  document.body.classList.add('endgame-active');

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
  document.body.classList.remove('endgame-active');
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
  populationHistory = [INITIAL_SIZE];
  immortalSet.clear();
  selected = [];
  history.clear();
  sortAbort = true;
  snapQuoteEl.textContent = '';
  messageEl.textContent = `${INITIAL_SIZE} souls. One snap away from balance.`;
  messageEl.classList.remove('final');
  snapBtn.classList.remove('snap-feedback');
  snapBtn.disabled = false;
  // If the user has random-world-on-reset enabled, roll a fresh procedural
  // world so every new universe feels visually distinct.
  if (settings.get().randomWorldOnReset) {
    const w = setWorld('random');
    if (worldCurrent) worldCurrent.textContent = `Random · ${w.label}`;
  }
  renderPeople(people, { animate: true });
  chips.render(people);
  panelStatsSection.hidden = true;
  dismissEndgame();
  camera.position.set(0, 0, 3.2);
  camera.lookAt(0, 0, 0);
  playWhoosh();
  updatePanel();
  updateAmbient();
  refreshDotStates();
}

// ─── Ambient audio ───
function updateAmbient() {
  setAmbientLevel(INITIAL_SIZE ? people.length / INITIAL_SIZE : 0);
}

// ─── Import names modal ───
let modalPrevFocus = null;
function openImport() {
  modalPrevFocus = document.activeElement;
  importBackdrop.hidden = false;
  importTextarea.value = people.map((p) => p.name).join('\n');
  setTimeout(() => importTextarea.focus(), 0);
}
function closeImport() {
  // Trigger the exit animation first, then hide after it completes.
  importBackdrop.classList.add('closing');
  setTimeout(() => {
    importBackdrop.hidden = true;
    importBackdrop.classList.remove('closing');
    modalPrevFocus?.focus?.();
  }, 220);
}

// Focus trap: while the modal is open, Tab cycles only within it.
importBackdrop.addEventListener('keydown', (e) => {
  if (importBackdrop.hidden) return;
  if (e.key === 'Escape') { closeImport(); return; }
  if (e.key !== 'Tab') return;
  const focusables = importBackdrop.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

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
  populationHistory = [INITIAL_SIZE];
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
  playWhoosh();
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

// ─── Custom algorithm dropdown ───
// (Element refs are hoisted to the top of the file with the other DOM consts
// so buildAlgoDropdown() can run during initial render without hitting TDZ.)
function buildAlgoDropdown() {
  if (!algoMenu) return;
  algoMenu.innerHTML = '';
  Object.entries(SORTS).forEach(([id, def]) => {
    const li = document.createElement('li');
    li.className = 'dropdown-option';
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.dataset.value = id;
    li.innerHTML = `<span>${def.label}</span><span class="complexity">${def.complexity}</span>`;
    if (id === currentAlgo) li.classList.add('active');
    li.addEventListener('click', () => {
      setAlgorithm(id);
      algoCurrent.textContent = def.label;
      algorithmSelect.value = id;
      algoMenu.querySelectorAll('.dropdown-option').forEach((o) => o.classList.toggle('active', o.dataset.value === id));
      closeAlgoMenu();
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
    });
    algoMenu.appendChild(li);
  });
}

function openAlgoMenu() {
  algoMenu.hidden = false;
  algoTrigger.setAttribute('aria-expanded', 'true');
}
function closeAlgoMenu() {
  algoMenu.hidden = true;
  algoTrigger.setAttribute('aria-expanded', 'false');
}

algoTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  algoMenu.hidden ? openAlgoMenu() : closeAlgoMenu();
});
document.addEventListener('click', (e) => {
  if (!algoMenu) return;
  if (!algoMenu.hidden && !algoMenu.contains(e.target) && e.target !== algoTrigger) closeAlgoMenu();
});

// ─── Toolbar wiring ───
algorithmSelect.addEventListener('change', (e) => setAlgorithm(e.target.value));
resetBtn.addEventListener('click', reset);

// ─── Seed chip click-to-copy ───
const seedChip = document.getElementById('seedChip');
const seedValueEl = document.getElementById('seedValue');
seedChip?.addEventListener('click', async () => {
  const u = new URL(window.location.href);
  u.searchParams.set('seed', currentSeed);
  try {
    await navigator.clipboard.writeText(u.toString());
    seedChip.classList.add('copied');
    setTimeout(() => seedChip.classList.remove('copied'), 1500);
  } catch {
    prompt('Copy this share link:', u.toString());
  }
});

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

// ─── Shortcuts FAB click — toggle panel ───
document.querySelector('.shortcuts-trigger')?.addEventListener('click', () => {
  document.getElementById('shortcuts')?.classList.toggle('open');
});

// ─── World picker dropdown ───
const worldTrigger = document.getElementById('worldTrigger');
const worldMenu = document.getElementById('worldMenu');
const worldCurrent = document.getElementById('worldCurrent');

function buildWorldDropdown() {
  if (!worldMenu) return;
  worldMenu.innerHTML = '';
  listWorldIds().forEach((id) => {
    const w = (id === 'random') ? { label: 'Random', sub: 'A different world every snap.' } : WORLDS[id];
    const li = document.createElement('li');
    li.className = 'dropdown-option';
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.dataset.value = id;
    li.innerHTML = `<span>${w.label}</span><span class="complexity">${w.sub || ''}</span>`;
    li.addEventListener('click', () => {
      const resolved = setWorld(id);
      worldCurrent.textContent = id === 'random' ? `Random · ${resolved.label}` : resolved.label;
      closeWorldMenu();
      playClick();
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
    });
    worldMenu.appendChild(li);
  });
}
function openWorldMenu() { worldMenu.hidden = false; worldTrigger.setAttribute('aria-expanded', 'true'); }
function closeWorldMenu() { worldMenu.hidden = true; worldTrigger.setAttribute('aria-expanded', 'false'); }
worldTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  worldMenu.hidden ? openWorldMenu() : closeWorldMenu();
});
document.addEventListener('click', (e) => {
  if (!worldMenu) return;
  if (!worldMenu.hidden && !worldMenu.contains(e.target) && e.target !== worldTrigger) closeWorldMenu();
});
buildWorldDropdown();

// ─── Settings popover ───
const settingsBtn = document.getElementById('settingsBtn');
const settingsPopover = document.getElementById('settingsPopover');
const setAnimSpeed = document.getElementById('setAnimSpeed');
const setAnimSpeedVal = document.getElementById('setAnimSpeedVal');
const setSoundOn = document.getElementById('setSoundOn');
const setReduceMotion = document.getElementById('setReduceMotion');
const setSparkline = document.getElementById('setSparkline');
const setRandomWorld = document.getElementById('setRandomWorld');
const settingsReset = document.getElementById('settingsReset');

function initSettingsUI() {
  const s = settings.get();
  if (setAnimSpeed) { setAnimSpeed.value = s.animSpeed; setAnimSpeedVal.textContent = `${s.animSpeed}×`; }
  if (setSoundOn) setSoundOn.checked = s.soundOn;
  if (setReduceMotion) setReduceMotion.checked = s.reduceMotion;
  if (setSparkline) setSparkline.checked = s.showSparkline;
  if (setRandomWorld) setRandomWorld.checked = s.randomWorldOnReset;
}
initSettingsUI();

settingsBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPopover.hidden = !settingsPopover.hidden;
  playClick();
});
document.addEventListener('click', (e) => {
  if (!settingsPopover) return;
  if (!settingsPopover.hidden && !settingsPopover.contains(e.target) && e.target !== settingsBtn) {
    settingsPopover.hidden = true;
  }
});
setAnimSpeed?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  setAnimSpeedVal.textContent = `${v}×`;
  settings.set('animSpeed', v);
});
setSoundOn?.addEventListener('change', (e) => settings.set('soundOn', e.target.checked));
setReduceMotion?.addEventListener('change', (e) => settings.set('reduceMotion', e.target.checked));
setSparkline?.addEventListener('change', (e) => {
  settings.set('showSparkline', e.target.checked);
  updatePanel();
});
setRandomWorld?.addEventListener('change', (e) => settings.set('randomWorldOnReset', e.target.checked));
settingsReset?.addEventListener('click', () => {
  settings.reset();
  initSettingsUI();
  updatePanel();
});

// Click ticks on every toolbar button
document.querySelectorAll('.toolbar-btn, .reset-btn, .stone, .panel-close, .modal-btn').forEach((btn) => {
  btn.addEventListener('click', () => playClick());
});

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
  const dots = [...overlay.querySelectorAll('.onboard-dot')];
  const nextBtn = overlay.querySelector('#onboardNext');
  function show(i) {
    steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
    nextBtn.textContent = (i === steps.length - 1) ? 'Got it' : 'Next';
  }
  show(0);
  function dismiss() {
    overlay.hidden = true;
    try { localStorage.setItem('thanos-sort:onboarded', '1'); } catch {}
  }
  nextBtn.addEventListener('click', () => {
    step++;
    if (step >= steps.length) return dismiss();
    show(step);
  });
  overlay.querySelector('#onboardSkip').addEventListener('click', dismiss);
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
    case 'k': case 'K':
      // K toggles the shortcuts PANEL (the cheat-sheet listing). The ?
      // FAB button itself stays visible — only the dropdown is minimized
      // so users can re-summon it.
      document.getElementById('shortcuts')?.classList.toggle('open');
      break;
    case 'Escape':
      if (busy && currentAlgo !== 'thanos') {
        sortAbort = true;
      }
      dismissEndgame();
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
  updateClouds(dt);
  const now = performance.now();
  updateHalos(now);
  updateHoverRing(now);
  controls.update();
  renderer.render(scene, camera);
}
animate();
