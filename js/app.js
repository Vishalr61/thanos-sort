/**
 * Thanos Sort: main app — UI, snap logic, and animation loop.
 */

import * as THREE from 'three';
import { generatePeople } from './data.js';
import { playSnap, snapAudio } from './sound.js';
import { createGlobe } from './globe.js';

const canvas = document.getElementById('canvas');
const tooltip = document.getElementById('tooltip');
const messageEl = document.getElementById('message');
const snapBtn = document.getElementById('snapBtn');
const resetBtn = document.getElementById('resetBtn');
const panelToggle = document.getElementById('panelToggle');
const sidePanel = document.getElementById('sidePanel');
const snapQuoteEl = document.getElementById('snapQuote');

const INITIAL_SIZE = 50;
let snapCount = 0;
let panelBeforeNames = [];

const THANOS_QUOTES = [
  'Perfectly balanced. As all things should be.',
  'Reality is often disappointing.',
  'I am inevitable.',
  'Dread it. Run from it. Destiny arrives all the same.',
  'The hardest choices require the strongest wills.',
  'You should have gone for the head.',
  'Fun isn\'t something one considers when balancing the universe… but this does put a smile on my face.',
  'You could not live with your own failure. Where did that bring you? Back to me.',
  'I know what it\'s like to lose. To feel so desperately that you\'re right, yet to fail all the same.',
  'In all my years of conquest… violence, slaughter… it was never personal. But I\'ll tell you now — what I\'m about to do to your stubborn little planet… I\'m going to enjoy it.'
];

function randomQuote() {
  return THANOS_QUOTES[Math.floor(Math.random() * THANOS_QUOTES.length)];
}

const globe = createGlobe(canvas);
const {
  scene,
  camera,
  renderer,
  controls,
  dotMeshes,
  pickMeshes,
  renderPeople,
  spawnDust,
  updateDust
} = globe;

let people = generatePeople();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderPeople(people);
document.getElementById('file-protocol-warning')?.remove();
panelBeforeNames = people.map(p => p.name);
updatePanel();

function updatePanel(afterNames = people.map(p => p.name)) {
  const sizeEl = document.getElementById('panelSize');
  const snapEl = document.getElementById('panelSnap');
  const remainingEl = document.getElementById('panelRemaining');
  const arrayEl = document.getElementById('panelArray');
  const arrayAfterEl = document.getElementById('panelArrayAfter');
  const resultEl = document.getElementById('panelResult');
  if (!sizeEl) return;
  sizeEl.textContent = INITIAL_SIZE;
  snapEl.textContent = snapCount;
  remainingEl.textContent = people.length;
  const format = (arr) => arr.length ? arr.join(' | ') : '—';
  const before = panelBeforeNames.length ? `[ ${format(panelBeforeNames)} ]` : '[ — ]';
  arrayEl.textContent = before;
  arrayAfterEl.textContent = snapCount > 0 && afterNames.length ? `[ ${format(afterNames)} ]` : '—';
  if (people.length <= 1) {
    resultEl.innerHTML = people.length
      ? `[ ${people[0].name} ]<br><span class="panel-done">Dataset fully balanced.</span>`
      : '[ ]<br><span class="panel-done">Nothing remains.</span>';
  } else {
    resultEl.textContent = '—';
  }
}

function updateTooltip(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickMeshes);
  if (hits.length) {
    tooltip.textContent = hits[0].object.userData.name;
    tooltip.classList.add('visible');
    tooltip.style.left = (clientX + 12) + 'px';
    tooltip.style.top = (clientY + 12) + 'px';
    return true;
  }
  tooltip.classList.remove('visible');
  return false;
}

canvas.addEventListener('pointermove', (event) => {
  updateTooltip(event.clientX, event.clientY);
});

canvas.addEventListener('pointerdown', (event) => {
  const hit = updateTooltip(event.clientX, event.clientY);
  if (hit) event.preventDefault();
});

function snap() {
  panelBeforeNames = people.map(p => p.name);
  if (people.length <= 1) {
    messageEl.textContent = people.length
      ? `The universe is balanced. Survivor: ${people[0].name}`
      : 'Nothing remains. Perfect balance.';
    messageEl.classList.add('final');
    snapBtn.disabled = true;
    return;
  }

  snapQuoteEl.textContent = randomQuote();
  snapBtn.classList.add('snap-feedback');
  playSnap();
  snapBtn.disabled = true;
  messageEl.textContent = '';
  messageEl.classList.remove('final');

  const toRemoveCount = Math.floor(people.length / 2);
  const indices = people.map((_, i) => i);
  const toRemoveSet = new Set();
  for (let i = 0; i < toRemoveCount; i++) {
    const idx = Math.floor(Math.random() * indices.length);
    toRemoveSet.add(indices.splice(idx, 1)[0]);
  }

  const toRemove = dotMeshes.filter(d => toRemoveSet.has(d.index));
  const toKeep = dotMeshes.filter(d => !toRemoveSet.has(d.index));

  const soundDurationMs = (snapAudio.duration && isFinite(snapAudio.duration)) ? snapAudio.duration * 1000 : 2400;
  const disintegrateMs = Math.max(1200, soundDurationMs);

  toRemove.forEach(({ mesh }) => {
    spawnDust(mesh.position.clone(), disintegrateMs);
    const mat = mesh.material;
    if (!mat.transparent) {
      mat.transparent = true;
      mat.opacity = 1;
    }
    const startTime = performance.now();
    function animateDisintegrate() {
      const t = (performance.now() - startTime) / disintegrateMs;
      if (t >= 1) {
        if (mesh.parent) mesh.parent.remove(mesh);
        return;
      }
      const s = 1 - t;
      mesh.scale.setScalar(s);
      mat.opacity = s;
      requestAnimationFrame(animateDisintegrate);
    }
    animateDisintegrate();
  });

  toKeep.forEach(({ mesh }) => {
    mesh.material.color.copy(new THREE.Color(0x6b9c7a));
  });

  setTimeout(() => {
    // Use clearDots() so both dotMeshes AND pickMeshes are torn down — the
    // disintegrate animation only removes the visible dot, so without this
    // pickMeshes leak stale hitboxes for vanished people across the globe.
    globe.clearDots();
    people = people.filter((_, i) => !toRemoveSet.has(i));
    people.forEach((p, i) => globe.addDot(p, i, true));
    snapCount++;
    updatePanel(people.map(p => p.name));
    panelBeforeNames = people.map(p => p.name);
    messageEl.textContent = `Snap. ${toRemoveCount} eliminated. ${people.length} remain.`;
    snapBtn.classList.remove('snap-feedback');
    snapBtn.disabled = false;
    if (people.length <= 1) {
      messageEl.textContent = people.length
        ? `The universe is balanced. Survivor: ${people[0].name}`
        : 'Nothing remains. Perfect balance.';
      messageEl.classList.add('final');
      snapBtn.disabled = true;
    }
  }, disintegrateMs + 80);
}

function reset() {
  people = generatePeople();
  snapCount = 0;
  panelBeforeNames = people.map(p => p.name);
  updatePanel();
  snapQuoteEl.textContent = '';
  messageEl.textContent = '50 souls. One snap away from balance.';
  messageEl.classList.remove('final');
  snapBtn.classList.remove('snap-feedback');
  snapBtn.disabled = false;
  renderPeople(people);
}

function setPanelOpen(open) {
  sidePanel.classList.toggle('open', open);
  document.body.classList.toggle('panel-open', open);
  panelToggle.setAttribute('aria-expanded', open);
  sidePanel.setAttribute('aria-hidden', !open);
  requestAnimationFrame(() => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
}

panelToggle.addEventListener('click', () => setPanelOpen(!sidePanel.classList.contains('open')));
document.getElementById('panelClose').addEventListener('click', () => setPanelOpen(false));

snapBtn.addEventListener('click', snap);
resetBtn.addEventListener('click', reset);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updateDust(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();
