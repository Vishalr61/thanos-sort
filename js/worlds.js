/**
 * Worlds — every planet you can land on.
 *
 * The visual approach: every world reuses the same real-Earth satellite photo
 * as its base texture, then applies a canvas filter to recolor it. So every
 * planet shares the iconic photographic map style — but Vormir is bathed in
 * red-orange, Asgard is golden, Knowhere violet, etc. Map continuity at no
 * extra texture cost.
 *
 * Procedural worlds get a random hue rotation + saturation/brightness shift.
 */

import { random } from './rng.js';

export const WORLDS = {
  earth: {
    id: 'earth',
    label: 'Earth',
    sub: 'Default. Half disappear at random.',
    filter: 'none',
    atmosphere: 0x8aa8ff,
    accent: 0xa78bfa,
    overlay: null
  },
  vormir: {
    id: 'vormir',
    label: 'Vormir',
    sub: 'A soul for a soul. Cold and orange.',
    filter: 'sepia(0.85) hue-rotate(-20deg) saturate(2.2) brightness(0.6) contrast(1.3)',
    atmosphere: 0xff7a4d,
    accent: 0xfb923c,
    overlay: { color: 'rgba(80, 10, 5, 0.25)', op: 'multiply' }
  },
  sakaar: {
    id: 'sakaar',
    label: 'Sakaar',
    sub: 'The Grandmaster\'s junkyard.',
    filter: 'sepia(1) hue-rotate(-30deg) saturate(1.8) brightness(0.75) contrast(1.15)',
    atmosphere: 0xffa040,
    accent: 0xffaa55,
    overlay: { color: 'rgba(60, 30, 0, 0.18)', op: 'multiply' }
  },
  asgard: {
    id: 'asgard',
    label: 'Asgard',
    sub: 'Realm eternal. Bridge of light.',
    filter: 'sepia(1) hue-rotate(-10deg) saturate(1.6) brightness(1.05) contrast(1.1)',
    atmosphere: 0xffd47a,
    accent: 0xffcf60,
    overlay: { color: 'rgba(255, 200, 100, 0.12)', op: 'overlay' }
  },
  titan: {
    id: 'titan',
    label: 'Titan',
    sub: 'Home. Once vibrant. Now ruined.',
    filter: 'sepia(0.9) hue-rotate(-15deg) saturate(1.5) brightness(0.5) contrast(1.4)',
    atmosphere: 0xd96a4a,
    accent: 0xef4444,
    overlay: { color: 'rgba(40, 5, 0, 0.35)', op: 'multiply' }
  },
  knowhere: {
    id: 'knowhere',
    label: 'Knowhere',
    sub: 'Severed Celestial head. Mining colony.',
    filter: 'hue-rotate(220deg) saturate(1.4) brightness(0.7) contrast(1.2)',
    atmosphere: 0xa78bfa,
    accent: 0xc084fc,
    overlay: { color: 'rgba(40, 20, 60, 0.2)', op: 'multiply' }
  }
};

/**
 * Generate a random procedural world. Pulls from a curated set of
 * hue/saturation/brightness combinations so every result still looks
 * planet-like rather than psychedelic.
 */
export function generateProceduralWorld() {
  const presets = [
    { name: 'Verdant',  hue: 30,  sat: 1.3, bright: 1.0, atmos: 0x88dd99, accent: 0x9ce8af },
    { name: 'Crimson',  hue: -30, sat: 1.6, bright: 0.7, atmos: 0xff6a8a, accent: 0xff7088 },
    { name: 'Amber',    hue: -15, sat: 1.5, bright: 0.95,atmos: 0xffc88a, accent: 0xffb060 },
    { name: 'Oceanic',  hue: 200, sat: 1.4, bright: 0.85,atmos: 0x66c8ee, accent: 0x80d4ee },
    { name: 'Glacial',  hue: 180, sat: 0.3, bright: 1.1, atmos: 0xddeeff, accent: 0xe8f4ff },
    { name: 'Jade',     hue: 100, sat: 1.4, bright: 0.85,atmos: 0x80e8c8, accent: 0x9af0d0 },
    { name: 'Volcanic', hue: -40, sat: 1.8, bright: 0.55,atmos: 0xff5a3a, accent: 0xff7050 },
    { name: 'Violet',   hue: 250, sat: 1.3, bright: 0.7, atmos: 0xa078e8, accent: 0xb088f0 },
    { name: 'Toxic',    hue: 75,  sat: 1.6, bright: 0.85,atmos: 0xa8ff5a, accent: 0xb0ff60 },
    { name: 'Cobalt',   hue: 220, sat: 1.5, bright: 0.7, atmos: 0x4a78ff, accent: 0x6090ff }
  ];
  const p = presets[Math.floor(random() * presets.length)];
  return {
    id: `proc-${p.name.toLowerCase()}`,
    label: p.name,
    sub: `A ${p.name.toLowerCase()} world.`,
    filter: `sepia(${p.sat * 0.4}) hue-rotate(${p.hue}deg) saturate(${p.sat}) brightness(${p.bright}) contrast(1.15)`,
    atmosphere: p.atmos,
    accent: p.accent,
    overlay: null,
    procedural: true
  };
}

/**
 * Paint a world's surface onto a 2D canvas by drawing the base Earth image
 * with the world's CSS-style filter applied. Optionally lays an overlay
 * color on top using a blend mode (e.g., multiply for darker rocky worlds).
 *
 * If baseImage isn't loaded yet (network race on first paint), draws a
 * solid fallback gradient so we still see something.
 */
export function paintWorld(ctx, world, w, h, baseImage) {
  if (!baseImage || !baseImage.complete || baseImage.naturalWidth === 0) {
    // Fallback: solid gradient in the atmosphere color. Earth normally loads
    // within ~200ms so this only flashes for a moment, if at all.
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#0a2840');
    grd.addColorStop(0.5, '#134a6e');
    grd.addColorStop(1, '#0a2840');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  // Filter the source draw — Canvas2D.filter applies per-draw.
  ctx.save();
  ctx.filter = world.filter || 'none';
  ctx.drawImage(baseImage, 0, 0, w, h);
  ctx.restore();

  // Optional overlay pass for moody worlds (darker reds for Vormir/Titan, etc).
  if (world.overlay) {
    ctx.save();
    ctx.globalCompositeOperation = world.overlay.op || 'multiply';
    ctx.fillStyle = world.overlay.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export function listIds() {
  return ['earth', 'vormir', 'sakaar', 'asgard', 'titan', 'knowhere', 'random'];
}
