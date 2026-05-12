/**
 * Three.js globe, dots, and dust particles.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONTINENTS, drawContinent } from './data.js';

const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe@2.24.2/example/img/earth-day.jpg';

export function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lng * (Math.PI / 180);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createEarthTexture() {
  const w = 1024, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const oceanGrd = ctx.createLinearGradient(0, 0, w, h);
  oceanGrd.addColorStop(0, '#0a2840');
  oceanGrd.addColorStop(0.35, '#0d3555');
  oceanGrd.addColorStop(0.5, '#134a6e');
  oceanGrd.addColorStop(0.65, '#0d3555');
  oceanGrd.addColorStop(1, '#0a2840');
  ctx.fillStyle = oceanGrd;
  ctx.fillRect(0, 0, w, h);
  const landColors = ['#4a6b4a', '#5a7c52', '#3d5c40', '#557855', '#4d704d', '#456045', '#3a5538', '#507550', '#485d48', '#4e6b4e', '#426042', '#4a6548'];
  let ci = 0;
  for (const key of Object.keys(CONTINENTS)) {
    drawContinent(ctx, CONTINENTS[key], w, h, landColors[ci++ % landColors.length]);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createGlobe(canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 3.2;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0c0a0f, 1);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 6;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  // Stop auto-rotate when user grabs the globe, resume after a moment idle.
  let autoRotateTimer = null;
  const pauseAutoRotate = () => {
    controls.autoRotate = false;
    clearTimeout(autoRotateTimer);
    autoRotateTimer = setTimeout(() => { controls.autoRotate = true; }, 4000);
  };
  canvas.addEventListener('pointerdown', pauseAutoRotate);
  canvas.addEventListener('wheel', pauseAutoRotate, { passive: true });

  const globeRadius = 1;
  const earthGeo = new THREE.SphereGeometry(globeRadius, 64, 48);
  const earthMat = new THREE.MeshPhongMaterial({
    map: createEarthTexture(),
    shininess: 12,
    specular: new THREE.Color(0x334455),
    emissive: new THREE.Color(0x050810)
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  const globeGroup = new THREE.Group();
  globeGroup.add(earth);
  scene.add(globeGroup);

  new THREE.TextureLoader().load(
    EARTH_TEXTURE_URL,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      earthMat.map = tex;
    },
    undefined,
    () => {}
  );

  const atmosGeo = new THREE.SphereGeometry(globeRadius + 0.03, 64, 48);
  const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x4488bb,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.BackSide
  });
  globeGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

  scene.add(new THREE.AmbientLight(0x556677, 0.85));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
  sun.position.set(5, 3, 5);
  scene.add(sun);

  // Starfield — 2400 points distributed in a thin shell around the camera.
  // Two layers (bright + dim) so the field has depth instead of looking flat.
  const makeStars = (count, radius, size, opacity, color) => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity,
      sizeAttenuation: true,
      depthWrite: false
    });
    return new THREE.Points(geo, mat);
  };
  const starsFar = makeStars(1800, 40, 0.18, 0.55, 0xbfb6d6);
  const starsNear = makeStars(600, 25, 0.10, 0.85, 0xffffff);
  scene.add(starsFar);
  scene.add(starsNear);

  const dotGeo = new THREE.SphereGeometry(0.018, 12, 8);
  const pickGeo = new THREE.SphereGeometry(0.055, 8, 6);
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x8b7a68 });
  const dotMaterialSurvived = new THREE.MeshBasicMaterial({ color: 0x6b9c7a });
  const dotMaterialSelected = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const dotMaterialImmortal = new THREE.MeshBasicMaterial({ color: 0xfb923c });
  const dotMaterialSacrificed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const dotRadius = globeRadius + 0.012;

  const dustGeo = new THREE.SphereGeometry(0.006, 6, 4);
  const dustParticles = [];

  function spawnDust(position, disintegrateMs = 800) {
    const dustDurationMs = Math.min(1400, disintegrateMs * 0.5);
    const outward = position.clone().normalize();
    const tangent = Math.abs(outward.y) < 0.99
      ? new THREE.Vector3(0, 1, 0).cross(outward).normalize()
      : new THREE.Vector3(1, 0, 0).cross(outward).normalize();
    for (let i = 0; i < 6 + Math.floor(Math.random() * 4); i++) {
      const drift = outward.clone().multiplyScalar(0.008 + Math.random() * 0.01)
        .add(tangent.clone().multiplyScalar((Math.random() - 0.5) * 0.012));
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa89888,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(dustGeo, mat);
      mesh.position.copy(position);
      globeGroup.add(mesh);
      dustParticles.push({ mesh, velocity: drift, startTime: performance.now(), duration: dustDurationMs });
    }
  }

  const dotMeshes = [];
  const pickMeshes = [];

  function addDot(person, index, isSurvivor = false) {
    const pos = latLngToVector3(person.lat, person.lng, dotRadius);
    const mat = (isSurvivor ? dotMaterialSurvived : dotMaterial).clone();
    const mesh = new THREE.Mesh(dotGeo, mat);
    mesh.position.copy(pos);
    mesh.userData = { name: person.name, index };
    globeGroup.add(mesh);
    dotMeshes.push({ mesh, person, index });
    const pickMesh = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial({ visible: false }));
    pickMesh.position.copy(pos);
    pickMesh.userData = { name: person.name, index };
    globeGroup.add(pickMesh);
    pickMeshes.push(pickMesh);
    return mesh;
  }

  function setDotState(index, state) {
    const entry = dotMeshes.find((d) => d.index === index);
    if (!entry) return;
    const target = {
      selected: dotMaterialSelected,
      immortal: dotMaterialImmortal,
      sacrificed: dotMaterialSacrificed,
      survivor: dotMaterialSurvived,
      default: dotMaterial
    }[state] || dotMaterial;
    entry.mesh.material = target.clone();
    // Pulse the selected/immortal dots up slightly so they read at a glance.
    const scale = (state === 'selected' || state === 'immortal' || state === 'sacrificed') ? 1.5 : 1.0;
    entry.mesh.scale.setScalar(scale);
  }

  function clearDots() {
    dotMeshes.forEach(({ mesh }) => { if (mesh.parent) mesh.parent.remove(mesh); });
    dotMeshes.length = 0;
    pickMeshes.forEach(m => { if (m.parent) m.parent.remove(m); });
    pickMeshes.length = 0;
  }

  function renderPeople(people) {
    clearDots();
    people.forEach((p, i) => addDot(p, i, false));
  }

  function updateDust(dt) {
    for (let i = dustParticles.length - 1; i >= 0; i--) {
      const p = dustParticles[i];
      const elapsed = performance.now() - p.startTime;
      if (elapsed >= p.duration) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        dustParticles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.material.opacity = 0.85 * (1 - elapsed / p.duration);
    }
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    globeGroup,
    dotMeshes,
    pickMeshes,
    dustParticles,
    addDot,
    clearDots,
    renderPeople,
    spawnDust,
    updateDust,
    setDotState,
    latLngToVector3,
    globeRadius
  };
}
