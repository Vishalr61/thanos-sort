/**
 * Three.js globe, dots, and dust particles.
 *
 * Each planet's surface and cloud layer are generated procedurally from a
 * 3D simplex-noise heightmap (see terrain.js). Named worlds use fixed seeds
 * so Vormir always looks like Vormir; procedural worlds get random seeds.
 * No external texture dependencies — everything paints in-canvas.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WORLDS, generateProceduralWorld } from './worlds.js';
import { generateSurface, generateClouds } from './terrain.js';

export function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lng * (Math.PI / 180);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Texture dimensions — 512×256 for surface (visible detail), 256×128 for
// clouds (blurry anyway). Generation is ~500-700ms total per world switch.
const SURFACE_W = 1024, SURFACE_H = 512;
const CLOUD_W = 512, CLOUD_H = 256;

// Real-Earth satellite photo — loaded once, passed to the surface generator
// when the current world is 'realEarth' mode. crossOrigin so canvas can
// drawImage without tainting.
const EARTH_PHOTO_URL = 'https://unpkg.com/three-globe@2.24.2/example/img/earth-day.jpg';
const earthImage = new Image();
earthImage.crossOrigin = 'anonymous';
earthImage.src = EARTH_PHOTO_URL;

function createSurfaceTexture(world) {
  const canvas = document.createElement('canvas');
  canvas.width = SURFACE_W;
  canvas.height = SURFACE_H;
  generateSurface(canvas, world, { earthImage });
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createCloudTexture(world) {
  const canvas = document.createElement('canvas');
  canvas.width = CLOUD_W;
  canvas.height = CLOUD_H;
  generateClouds(canvas, world);
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
  // Transparent clear color so the body's nebula gradient shows through
  // the gaps between stars + around the globe.
  renderer.setClearColor(0x000000, 0);

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
  let currentWorld = WORLDS.earth;
  const earthMat = new THREE.MeshPhongMaterial({
    map: createSurfaceTexture(currentWorld),
    shininess: 12,
    specular: new THREE.Color(0x334455),
    emissive: new THREE.Color(0x050810)
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  const globeGroup = new THREE.Group();
  globeGroup.add(earth);
  scene.add(globeGroup);

  // Cloud sphere — slightly above the surface, rotates independently for
  // the parallax-drift effect that sells "real planet" more than anything
  // else. Worlds with cloudDensity=0 (Knowhere) get a fully transparent
  // texture so the mesh effectively disappears.
  const cloudGeo = new THREE.SphereGeometry(globeRadius + 0.012, 64, 48);
  const cloudMat = new THREE.MeshPhongMaterial({
    map: createCloudTexture(currentWorld),
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  globeGroup.add(clouds);

  // When the Earth photo finishes loading, repaint the surface so the
  // placeholder gradient is replaced with real continents. Only applies
  // if we're currently on a realEarth world.
  if (!earthImage.complete) {
    earthImage.addEventListener('load', () => {
      if (currentWorld.surfaceMode === 'realEarth') {
        if (earthMat.map) earthMat.map.dispose();
        earthMat.map = createSurfaceTexture(currentWorld);
        earthMat.needsUpdate = true;
      }
    }, { once: true });
  }

  // Thin fresnel atmosphere — rim color reads from the active world so
  // Vormir glows red, Asgard gold, etc. Updated via setWorld().
  const atmosGeo = new THREE.SphereGeometry(globeRadius + 0.025, 64, 48);
  const atmosMat = new THREE.ShaderMaterial({
    uniforms: {
      rimColor:  { value: new THREE.Color(currentWorld.atmosphere) },
      rimPower:  { value: 6.0 },
      intensity: { value: 0.55 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 rimColor;
      uniform float rimPower;
      uniform float intensity;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float rim = pow(1.0 - abs(dot(viewDir, vNormal)), rimPower);
        gl_FragColor = vec4(rimColor, rim * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
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
  // Parent the stars to the camera so they stay fixed relative to the
  // viewport — when OrbitControls spins the camera around the globe, the
  // globe rotates but the starfield doesn't, which is how space should look.
  // Without this, the stars rotate with the camera and the whole scene
  // feels like it's inside a snow globe.
  camera.add(starsFar);
  camera.add(starsNear);
  scene.add(camera);

  // Dots: brighter, larger, additive-blended so they read as luminous points
  // of life on the globe rather than dull dust. The halo sprite (built below)
  // gives each dot a soft glow that scales with the camera distance.
  const dotGeo = new THREE.SphereGeometry(0.017, 14, 10);
  const pickGeo = new THREE.SphereGeometry(0.055, 8, 6);
  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd9a8,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dotMaterialSurvived = new THREE.MeshBasicMaterial({
    color: 0x9ce8af,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dotMaterialSelected = new THREE.MeshBasicMaterial({
    color: 0xffe860,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dotMaterialImmortal = new THREE.MeshBasicMaterial({
    color: 0xffaf6e,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dotMaterialSacrificed = new THREE.MeshBasicMaterial({
    color: 0xff5757,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dotRadius = globeRadius + 0.012;

  // Procedural halo texture — a soft circular gradient drawn on a canvas
  // once, reused for every dot as a sprite. Cheaper than per-dot geometry
  // and the camera-facing billboard means halos always read symmetric.
  const haloTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
  })();

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

    // Halo sprite — a soft billboarded glow per dot. Earlier sizes
    // (0.085 / 0.12) read as country-sized blobs in screenshots; pulling
    // back to 0.035 / 0.05 so the halo enhances the dot without covering
    // a continent.
    const haloMat = new THREE.SpriteMaterial({
      map: haloTexture,
      color: isSurvivor ? 0x9ce8af : 0xffd9a8,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: isSurvivor ? 0.55 : 0.3
    });
    const halo = new THREE.Sprite(haloMat);
    const haloScale = isSurvivor ? 0.042 : 0.028;
    halo.scale.set(haloScale, haloScale, 1);
    halo.position.copy(pos);
    halo.userData = { isSurvivor, basePulse: Math.random() * Math.PI * 2, baseScale: haloScale };
    globeGroup.add(halo);

    dotMeshes.push({ mesh, person, index, halo });

    const pickMesh = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial({ visible: false }));
    pickMesh.position.copy(pos);
    pickMesh.userData = { name: person.name, index };
    globeGroup.add(pickMesh);
    pickMeshes.push(pickMesh);
    return mesh;
  }

  /**
   * Swap the world being displayed. Regenerates the procedural surface +
   * cloud textures, updates atmosphere rim color. Accepts either a world id
   * ('vormir', 'random'...) or a full world config (for procedural worlds
   * generated externally).
   */
  function setWorld(world) {
    let resolved = world;
    if (typeof world === 'string') {
      if (world === 'random') resolved = generateProceduralWorld();
      else resolved = WORLDS[world] || WORLDS.earth;
    }
    currentWorld = resolved;
    // Dispose old textures to avoid GPU memory leak across many switches.
    if (earthMat.map) earthMat.map.dispose();
    if (cloudMat.map) cloudMat.map.dispose();
    earthMat.map = createSurfaceTexture(resolved);
    cloudMat.map = createCloudTexture(resolved);
    earthMat.needsUpdate = true;
    cloudMat.needsUpdate = true;
    atmosMat.uniforms.rimColor.value.set(resolved.atmosphere);
    return resolved;
  }
  function getWorld() { return currentWorld; }

  // Slow independent cloud drift. dt is the per-frame delta seconds — at
  // 60fps this is ~0.016, so 0.012 rad/s adds a barely-perceptible spin.
  function updateClouds(dt) {
    clouds.rotation.y += 0.012 * dt;
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
    dotMeshes.forEach(({ mesh, halo }) => {
      if (mesh.parent) mesh.parent.remove(mesh);
      if (halo && halo.parent) halo.parent.remove(halo);
    });
    dotMeshes.length = 0;
    pickMeshes.forEach(m => { if (m.parent) m.parent.remove(m); });
    pickMeshes.length = 0;
  }

  // Per-frame halo pulse. Survivor halos breathe more visibly so they read
  // as "alive earned through the snap" rather than residual.
  function updateHalos(elapsed) {
    for (const { halo } of dotMeshes) {
      if (!halo) continue;
      const t = elapsed * 0.0015 + (halo.userData.basePulse || 0);
      const breathe = 0.88 + 0.18 * Math.sin(t);
      const base = halo.userData.baseScale || 0.035;
      const scale = base * breathe;
      halo.scale.set(scale, scale, 1);
      if (halo.userData.isSurvivor) {
        halo.material.opacity = 0.4 + 0.2 * (0.5 + 0.5 * Math.sin(t));
      }
    }
  }

  function renderPeople(people, opts = {}) {
    clearDots();
    people.forEach((p, i) => addDot(p, i, false));
    if (opts.animate) spawnAnimate();
  }

  /**
   * Stagger the dots in over ~1.5s — each starts invisible at scale 0 and
   * scales up over 400ms with a 30ms offset between dots. Reset feels like
   * the universe materializing rather than blinking into existence.
   */
  function spawnAnimate() {
    const total = dotMeshes.length;
    const start = performance.now();
    const stagger = Math.min(40, Math.max(15, 1200 / total));
    const dur = 480;
    dotMeshes.forEach(({ mesh, halo }, i) => {
      const delay = i * stagger;
      mesh.scale.setScalar(0);
      if (halo) halo.scale.setScalar(0);
      const animate = () => {
        const t = (performance.now() - start - delay) / dur;
        if (t < 0) { requestAnimationFrame(animate); return; }
        if (t >= 1) {
          mesh.scale.setScalar(1);
          if (halo) halo.scale.setScalar(halo.userData.baseScale || 0.028);
          return;
        }
        // easeOutBack — slight overshoot for satisfying snap
        const s = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
        mesh.scale.setScalar(Math.max(0, s));
        if (halo) halo.scale.setScalar((halo.userData.baseScale || 0.028) * Math.max(0, s));
        requestAnimationFrame(animate);
      };
      animate();
    });
  }

  /**
   * Hover ring sprite — a small white-outlined ring that appears at a world
   * position when the cursor is over a dot. Caller updates position via
   * setHoverRing(pos) and clears with setHoverRing(null).
   */
  const ringTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
  })();
  const hoverRing = new THREE.Sprite(new THREE.SpriteMaterial({
    map: ringTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  hoverRing.scale.set(0.08, 0.08, 1);
  globeGroup.add(hoverRing);

  let hoverRingTarget = null;
  function setHoverRing(pos) {
    hoverRingTarget = pos;
  }
  function updateHoverRing(elapsed) {
    if (hoverRingTarget) {
      hoverRing.position.lerp(hoverRingTarget, 0.35);
      hoverRing.material.opacity = Math.min(1, hoverRing.material.opacity + 0.12);
      // Subtle breathe
      const breathe = 0.075 + 0.012 * Math.sin(elapsed * 0.005);
      hoverRing.scale.set(breathe, breathe, 1);
    } else {
      hoverRing.material.opacity = Math.max(0, hoverRing.material.opacity - 0.15);
    }
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
    updateClouds,
    updateHalos,
    setHoverRing,
    updateHoverRing,
    setDotState,
    setWorld,
    getWorld,
    latLngToVector3,
    globeRadius
  };
}
