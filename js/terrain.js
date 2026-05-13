/**
 * Procedural terrain generator — paints heightmap-based surface and cloud
 * textures into canvases for use as Three.js CanvasTextures.
 *
 * Uses 3D simplex noise sampled on the sphere surface (so there's no
 * polar distortion — continents wrap naturally around the poles).
 * Each world has a fixed seed so the same world ID always paints the
 * same continents; procedural worlds get a random seed.
 */

// ─── 3D simplex noise (Stefan Gustavson reference, seeded permutation) ──
const F3 = 1 / 3;
const G3 = 1 / 6;

const grad3 = [
  [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0],
  [1,0,1], [-1,0,1], [1,0,-1], [-1,0,-1],
  [0,1,1], [0,-1,1], [0,1,-1], [0,-1,-1]
];

function buildPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = (seed | 0) || 1;
  // Park-Miller LCG to shuffle deterministically from the seed.
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  return { perm, permMod12 };
}

export function createNoise3D(seed) {
  const { perm, permMod12 } = buildPerm(seed);
  return function noise3D(xin, yin, zin) {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else               { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0)       { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0)  { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else               { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const x1 = x0 - i1 + G3,   y1 = y0 - j1 + G3,   z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3;
    const x3 = x0 - 1 + 3*G3,  y3 = y0 - 1 + 3*G3,  z3 = z0 - 1 + 3*G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;
    const gi0 = permMod12[ii + perm[jj + perm[kk]]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
    const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
    const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]];

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 >= 0) { const g = grad3[gi0]; t0 *= t0; n0 = t0 * t0 * (g[0]*x0 + g[1]*y0 + g[2]*z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 >= 0) { const g = grad3[gi1]; t1 *= t1; n1 = t1 * t1 * (g[0]*x1 + g[1]*y1 + g[2]*z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 >= 0) { const g = grad3[gi2]; t2 *= t2; n2 = t2 * t2 * (g[0]*x2 + g[1]*y2 + g[2]*z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 >= 0) { const g = grad3[gi3]; t3 *= t3; n3 = t3 * t3 * (g[0]*x3 + g[1]*y3 + g[2]*z3); }

    return 32 * (n0 + n1 + n2 + n3); // roughly [-1, 1]
  };
}

// ─── Heightmap → surface texture ──
function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

// (lng, lat) in degrees → (x, y) in canvas pixel space, equirectangular.
function lngLatToXY(lng, lat, w, h) {
  return [((lng + 180) / 360) * w, ((90 - lat) / 180) * h];
}

/**
 * Paint a planet surface onto a canvas. Either:
 *  - draws the real Earth photo (surfaceMode='realEarth') for recognizable
 *    geography, or
 *  - paints a procedural heightmap from 3D simplex noise on a sphere.
 * Then paints any per-world feature overlays on top.
 */
export function generateSurface(canvas, world, context = {}) {
  if (world.surfaceMode === 'realEarth') {
    paintEarthPhoto(canvas, context.earthImage);
    paintFeatures(canvas, world);
    return;
  }
  paintProceduralSurface(canvas, world);
  paintFeatures(canvas, world);
}

function paintEarthPhoto(canvas, image) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  if (image && image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, 0, 0, w, h);
  } else {
    // Placeholder while the photo loads — solid ocean-ish gradient.
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#0a2840');
    grd.addColorStop(0.5, '#134a6e');
    grd.addColorStop(1, '#0a2840');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }
}

function paintProceduralSurface(canvas, world) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  const noise = createNoise3D(world.seed);

  const oceanDeep = world.oceanDeep;
  const oceanShallow = world.oceanShallow;
  const landLow = world.landLow;
  const landHigh = world.landHigh;
  const landPeak = world.landPeak;
  const seaLevel = world.seaLevel;

  for (let y = 0; y < h; y++) {
    const lat = (y / (h - 1) - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = (x / w - 0.5) * 2 * Math.PI;
      const cx = cosLat * Math.cos(lon);
      const cy = sinLat;
      const cz = cosLat * Math.sin(lon);

      // 4-octave fractal noise on the sphere
      let height = 0, amp = 1, freq = 2.4, totalAmp = 0;
      for (let o = 0; o < 4; o++) {
        height += noise(cx * freq, cy * freq, cz * freq) * amp;
        totalAmp += amp;
        amp *= 0.5;
        freq *= 2;
      }
      height = (height / totalAmp + 1) * 0.5; // [0, 1]

      let color;
      if (height < seaLevel) {
        const t = seaLevel > 0 ? height / seaLevel : 0;
        color = lerp(oceanDeep, oceanShallow, t);
      } else {
        const t = (height - seaLevel) / Math.max(0.001, 1 - seaLevel);
        if (t < 0.55) {
          color = lerp(landLow, landHigh, t / 0.55);
        } else {
          color = lerp(landHigh, landPeak, (t - 0.55) / 0.45);
        }
      }

      const idx = (y * w + x) * 4;
      data[idx]     = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Paint a transparent cloud layer onto a canvas. Same noise scheme but
 * different seed offset + frequency + threshold mapped to alpha.
 * Worlds with cloudDensity = 0 (airless, like Knowhere) get a transparent
 * canvas — caller can skip painting the cloud mesh entirely.
 */
export function generateClouds(canvas, world) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  if (!world.cloudDensity || world.cloudDensity <= 0) {
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  const noise = createNoise3D(world.seed + 1000);
  const [cr, cg, cb] = world.cloudColor || [255, 255, 255];
  const threshold = 1 - world.cloudDensity;

  for (let y = 0; y < h; y++) {
    const lat = (y / (h - 1) - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = (x / w - 0.5) * 2 * Math.PI;
      const cx = cosLat * Math.cos(lon);
      const cy = sinLat;
      const cz = cosLat * Math.sin(lon);

      let v = 0, amp = 1, freq = 3.2, totalAmp = 0;
      for (let o = 0; o < 3; o++) {
        v += noise(cx * freq, cy * freq, cz * freq) * amp;
        totalAmp += amp;
        amp *= 0.5;
        freq *= 2;
      }
      v = (v / totalAmp + 1) * 0.5;

      let alpha = 0;
      if (v > threshold) {
        alpha = ((v - threshold) / (1 - threshold)) * 220;
      }

      const idx = (y * w + x) * 4;
      data[idx]     = cr;
      data[idx + 1] = cg;
      data[idx + 2] = cb;
      data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── Feature overlays — small decorative details per world ──
// Each takes (ctx, w, h, featureConfig). Lightweight canvas drawing,
// no per-pixel work. Painted on top of the base surface.

function paintFeatures(canvas, world) {
  if (!world.features || !world.features.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // Use a separate noise seed so feature placement is deterministic per
  // world but doesn't repeat the terrain's pattern.
  const featRand = mulberryLite((world.seed || 0) + 7919);
  for (const f of world.features) {
    switch (f.type) {
      case 'cities':   drawCities(ctx, w, h, f, featRand); break;
      case 'spires':   drawSpires(ctx, w, h, f, featRand); break;
      case 'junk':     drawJunk(ctx, w, h, f, featRand); break;
      case 'rings':    drawRings(ctx, w, h, f, featRand); break;
      case 'ruins':    drawRuins(ctx, w, h, f, featRand); break;
      case 'cracks':   drawCracks(ctx, w, h, f, featRand); break;
      case 'bridge':   drawBridge(ctx, w, h, f); break;
      case 'shrine':   drawShrine(ctx, w, h, f); break;
      case 'crater':   drawCrater(ctx, w, h, f); break;
      case 'arena':    drawArena(ctx, w, h, f); break;
      case 'ridges':   drawRidges(ctx, w, h, f, featRand); break;
      case 'trails':   drawTrails(ctx, w, h, f, featRand); break;
      case 'molten':   drawMolten(ctx, w, h, f, featRand); break;
      case 'debris':   drawDebris(ctx, w, h, f, featRand); break;
      case 'sprawl':   drawSprawl(ctx, w, h, f, featRand); break;
    }
  }
}

// Tiny PRNG so feature placement is deterministic per world.
function mulberryLite(seed) {
  let s = (seed | 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawCities(ctx, w, h, f, rand) {
  ctx.save();
  ctx.globalAlpha = f.opacity ?? 0.7;
  ctx.fillStyle = f.color;
  const size = f.size ?? 1;
  for (let i = 0; i < f.count; i++) {
    // Bias toward mid-latitudes so cities mostly sit on continents.
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 130) - 65;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    // Tiny glow
    ctx.beginPath();
    ctx.arc(x, y, size * 1.6, 0, Math.PI * 2);
    ctx.globalAlpha = (f.opacity ?? 0.7) * 0.35;
    ctx.fill();
    // Bright center
    ctx.globalAlpha = f.opacity ?? 0.7;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpires(ctx, w, h, f, rand) {
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 100) - 50;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 4, y - f.length);
    ctx.stroke();
    // Spire shadow dot at base
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawJunk(ctx, w, h, f, rand) {
  ctx.save();
  ctx.fillStyle = f.color;
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 120) - 60;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    const sz = f.size + rand() * 2;
    // Irregular rectangle suggesting a junk pile
    ctx.fillRect(x - sz, y - sz * 0.6, sz * 2, sz * 1.2);
    ctx.fillRect(x - sz * 0.5, y - sz * 1.2, sz, sz * 0.8);
  }
  ctx.restore();
}

function drawRings(ctx, w, h, f, rand) {
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 100) - 50;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, f.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x, y, f.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRuins(ctx, w, h, f, rand) {
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 110) - 55;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    const s = f.size;
    // Crossed-out X mark = broken structure
    ctx.beginPath();
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCracks(ctx, w, h, f, rand) {
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 130) - 65;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    // Jagged crack — 3-4 segments at random angles
    ctx.beginPath();
    let cx = x, cy = y;
    ctx.moveTo(cx, cy);
    const segs = 3 + Math.floor(rand() * 2);
    for (let j = 0; j < segs; j++) {
      const ang = rand() * Math.PI * 2;
      const len = f.length * (0.4 + rand() * 0.6);
      cx += Math.cos(ang) * len;
      cy += Math.sin(ang) * len;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBridge(ctx, w, h, f) {
  // The Bifrost — a single bright streak at a fixed lat/lng
  const [x, y] = lngLatToXY(f.lng ?? 0, f.lat ?? 0, w, h);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 6);
  // Soft outer halo
  const grd = ctx.createLinearGradient(-f.length, 0, f.length, 0);
  grd.addColorStop(0, 'rgba(255, 245, 184, 0)');
  grd.addColorStop(0.5, f.color);
  grd.addColorStop(1, 'rgba(255, 245, 184, 0)');
  ctx.fillStyle = grd;
  ctx.fillRect(-f.length, -3, f.length * 2, 6);
  // Bright core
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(-f.length * 0.8, -1, f.length * 1.6, 2);
  ctx.restore();
}

function drawShrine(ctx, w, h, f) {
  // Glowing radial point — the Soul Stone shrine on Vormir.
  const [x, y] = lngLatToXY(f.lng, f.lat, w, h);
  const grd = ctx.createRadialGradient(x, y, 0, x, y, f.radius * 2);
  grd.addColorStop(0, f.color);
  grd.addColorStop(1, 'rgba(255, 165, 82, 0)');
  ctx.save();
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, f.radius * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrater(ctx, w, h, f) {
  // Large dark socket — Knowhere's "eye sockets" in the Celestial skull
  const [x, y] = lngLatToXY(f.lng, f.lat, w, h);
  ctx.save();
  ctx.fillStyle = f.color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, f.radius, 0, Math.PI * 2);
  ctx.fill();
  // Subtle ring around the crater
  ctx.strokeStyle = f.color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, f.radius * 1.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawArena(ctx, w, h, f) {
  // Sakaar's gladiator arena — large concentric rings + center
  const [x, y] = lngLatToXY(f.lng, f.lat, w, h);
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 1.5;
  [1.0, 0.7, 0.45].forEach((scale, i) => {
    ctx.globalAlpha = 0.85 - i * 0.2;
    ctx.beginPath();
    ctx.arc(x, y, f.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  });
  // Bright central spot
  ctx.fillStyle = f.color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  // Spoke lines from center
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * f.radius * 0.45, y + Math.sin(a) * f.radius * 0.45);
    ctx.lineTo(x + Math.cos(a) * f.radius, y + Math.sin(a) * f.radius);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRidges(ctx, w, h, f, rand) {
  // Bone-like curved ridges — skull plates on Knowhere, plate boundaries elsewhere
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 110) - 55;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    const ang = rand() * Math.PI * 2;
    const len = (f.length || 20) * (0.8 + rand() * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const cx = x + Math.cos(ang) * len * 0.5 + (rand() - 0.5) * 8;
    const cy = y + Math.sin(ang) * len * 0.5 + (rand() - 0.5) * 8;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrails(ctx, w, h, f, rand) {
  // Faint dashed roads/trails — mining routes, supply lines
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 0.6;
  ctx.globalAlpha = f.opacity ?? 0.45;
  ctx.setLineDash([2, 3]);
  for (let i = 0; i < f.count; i++) {
    const lng1 = (rand() * 360) - 180;
    const lat1 = (rand() * 100) - 50;
    const lng2 = lng1 + (rand() - 0.5) * 35;
    const lat2 = lat1 + (rand() - 0.5) * 22;
    const [x1, y1] = lngLatToXY(lng1, lat1, w, h);
    const [x2, y2] = lngLatToXY(lng2, lat2, w, h);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawMolten(ctx, w, h, f, rand) {
  // Glowing molten/lava spots — Titan still cooling, Sakaar electricity
  ctx.save();
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 120) - 60;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    const r = (f.size || 3) * (0.7 + rand() * 0.6);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
    grd.addColorStop(0, f.color);
    grd.addColorStop(0.4, f.color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Bright hot core
    ctx.fillStyle = f.coreColor || '#ffffaa';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawDebris(ctx, w, h, f, rand) {
  // Small scattered specks — orbital debris, dust storm particles, junk fragments
  ctx.save();
  ctx.fillStyle = f.color;
  ctx.globalAlpha = f.opacity ?? 0.5;
  for (let i = 0; i < f.count; i++) {
    const lng = (rand() * 360) - 180;
    const lat = (rand() * 140) - 70;
    const [x, y] = lngLatToXY(lng, lat, w, h);
    const sz = 0.5 + rand() * 1.2;
    if (rand() > 0.6) {
      ctx.fillRect(x, y, sz, sz * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, sz * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSprawl(ctx, w, h, f, rand) {
  // Dense settlement sprawl — many bright points clustered in a few zones.
  // Used for major Sakaar cities, Titan ruin clusters, Knowhere mining ops.
  ctx.save();
  const clusters = f.count || 4;
  for (let c = 0; c < clusters; c++) {
    const cLng = (rand() * 360) - 180;
    const cLat = (rand() * 100) - 50;
    const dots = 12 + Math.floor(rand() * 18);
    for (let i = 0; i < dots; i++) {
      const dLng = (rand() - 0.5) * 14;
      const dLat = (rand() - 0.5) * 9;
      const [x, y] = lngLatToXY(cLng + dLng, cLat + dLat, w, h);
      ctx.globalAlpha = (f.opacity ?? 0.7) * (0.4 + rand() * 0.6);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rand() * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
