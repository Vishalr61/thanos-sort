/**
 * Worlds — every planet you can land on.
 *
 * Two surface modes:
 *   - 'realEarth' uses the iconic NASA satellite photo (Earth only). The
 *     real continents are unmistakable.
 *   - 'procedural' uses a 3D simplex-noise heightmap painted with the
 *     world's palette. Used for every other named world + procedural rolls.
 *
 * Each world can declare optional `features` that paint small decorative
 * details on top: cities for Earth, mystic spires for Vormir, golden
 * bridges for Asgard, ruined structure marks for Titan, mining lights
 * for Knowhere, etc. Kept lightweight — just enough to give the world
 * a sense of place.
 */

import { random } from './rng.js';

export const WORLDS = {
  earth: {
    id: 'earth',
    label: 'Earth',
    sub: 'Blue, green, alive.',
    surfaceMode: 'realEarth',
    cloudDensity: 0.42,
    cloudColor: [255, 255, 255],
    atmosphere: 0x8aa8ff,
    accent: 0xa78bfa,
    features: [
      // City lights scattered across continents.
      { type: 'cities', count: 70, color: '#ffe070', size: 1.1, opacity: 0.65 }
    ]
  },
  vormir: {
    id: 'vormir',
    label: 'Vormir',
    sub: 'A soul for a soul.',
    surfaceMode: 'procedural',
    seed: 213,
    oceanDeep:    [45, 12, 8],
    oceanShallow: [80, 25, 15],
    landLow:      [115, 50, 30],
    landHigh:     [85, 35, 20],
    landPeak:     [60, 22, 14],
    seaLevel: 0.08,
    cloudDensity: 0.22,
    cloudColor: [180, 80, 50],
    atmosphere: 0xff7a4d,
    accent: 0xfb923c,
    features: [
      // Dark mystic spires + a single Soul Stone shrine glow.
      { type: 'spires', count: 4, color: '#1a0608', length: 14 },
      { type: 'shrine', lat: -28, lng: 110, color: '#ffa552', radius: 4 }
    ]
  },
  sakaar: {
    id: 'sakaar',
    label: 'Sakaar',
    sub: "The Grandmaster's junkyard.",
    surfaceMode: 'procedural',
    seed: 347,
    oceanDeep:    [40, 30, 12],
    oceanShallow: [90, 65, 25],
    landLow:      [145, 100, 50],
    landHigh:     [185, 135, 65],
    landPeak:     [225, 175, 85],
    seaLevel: 0.32,
    cloudDensity: 0.40,
    cloudColor: [230, 180, 80],
    atmosphere: 0xffa040,
    accent: 0xffaa55,
    features: [
      // Junk piles + a couple of portal rings (Sakaar's signature wormholes).
      { type: 'junk', count: 22, color: '#2a1810', size: 2.2 },
      { type: 'rings', count: 3, color: '#ffd060', radius: 6 }
    ]
  },
  asgard: {
    id: 'asgard',
    label: 'Asgard',
    sub: 'Realm eternal.',
    surfaceMode: 'procedural',
    seed: 451,
    oceanDeep:    [40, 20, 60],
    oceanShallow: [90, 50, 110],
    landLow:      [180, 140, 70],
    landHigh:     [225, 185, 100],
    landPeak:     [255, 225, 140],
    seaLevel: 0.42,
    cloudDensity: 0.55,
    cloudColor: [255, 240, 200],
    atmosphere: 0xffd47a,
    accent: 0xffcf60,
    features: [
      // Bright golden spires + the Bifrost light streak.
      { type: 'bridge', lat: 25, lng: -30, length: 80, color: '#fff5b8' },
      { type: 'cities', count: 14, color: '#fff0a0', size: 1.5, opacity: 0.9 }
    ]
  },
  titan: {
    id: 'titan',
    label: 'Titan',
    sub: 'Home. Once vibrant. Now ruined.',
    surfaceMode: 'procedural',
    seed: 562,
    oceanDeep:    [24, 12, 10],
    oceanShallow: [48, 24, 22],
    landLow:      [105, 55, 42],
    landHigh:     [75, 32, 25],
    landPeak:     [50, 22, 18],
    seaLevel: 0.04,
    cloudDensity: 0.18,
    cloudColor: [170, 95, 75],
    atmosphere: 0xd96a4a,
    accent: 0xef4444,
    features: [
      // Ruined structures + cracks running across the surface.
      { type: 'ruins', count: 8, color: '#1a0808', size: 2.0 },
      { type: 'cracks', count: 14, color: '#1a0408', length: 16 }
    ]
  },
  knowhere: {
    id: 'knowhere',
    label: 'Knowhere',
    sub: 'Severed Celestial head.',
    surfaceMode: 'procedural',
    seed: 673,
    oceanDeep:    [22, 14, 38],
    oceanShallow: [38, 24, 68],
    landLow:      [110, 80, 130],
    landHigh:     [85, 60, 105],
    landPeak:     [60, 45, 80],
    seaLevel: 0,
    cloudDensity: 0,
    cloudColor: [180, 150, 200],
    atmosphere: 0xa78bfa,
    accent: 0xc084fc,
    features: [
      // Mining colony lights scattered across the rock + dark "eye sockets".
      { type: 'cities', count: 28, color: '#ffd680', size: 1.0, opacity: 0.9 },
      { type: 'crater', lat: 20, lng: -40, color: '#0a0512', radius: 9 },
      { type: 'crater', lat: 20, lng: 40, color: '#0a0512', radius: 9 }
    ]
  }
};

/**
 * Roll a procedural world. Random palette + random seed + maybe a feature.
 */
const PROCEDURAL_PRESETS = [
  { name: 'Verdant',  oceanDeep:[6,30,40],   oceanShallow:[30,90,120], landLow:[60,130,55], landHigh:[140,150,70],  landPeak:[220,225,215], seaLevel: 0.45, cloudDensity: 0.4,  cloudColor:[255,255,255], atmos: 0x88dd99, accent: 0x9ce8af },
  { name: 'Crimson',  oceanDeep:[40,10,15],  oceanShallow:[80,25,30],  landLow:[140,55,55], landHigh:[180,75,75],   landPeak:[230,140,140], seaLevel: 0.30, cloudDensity: 0.3,  cloudColor:[220,150,150], atmos: 0xff6a8a, accent: 0xff7088 },
  { name: 'Amber',    oceanDeep:[35,20,8],   oceanShallow:[80,55,20],  landLow:[160,115,45],landHigh:[200,150,55],  landPeak:[245,205,110], seaLevel: 0.25, cloudDensity: 0.5,  cloudColor:[240,210,140], atmos: 0xffc88a, accent: 0xffb060 },
  { name: 'Oceanic',  oceanDeep:[4,14,40],   oceanShallow:[20,50,100], landLow:[40,90,120], landHigh:[80,135,160],  landPeak:[170,200,220], seaLevel: 0.72, cloudDensity: 0.35, cloudColor:[230,240,255], atmos: 0x66c8ee, accent: 0x80d4ee },
  { name: 'Glacial',  oceanDeep:[40,55,80],  oceanShallow:[110,140,170],landLow:[170,190,210],landHigh:[210,225,235],landPeak:[245,250,255], seaLevel: 0.30, cloudDensity: 0.6,  cloudColor:[255,255,255], atmos: 0xddeeff, accent: 0xe8f4ff },
  { name: 'Jade',     oceanDeep:[6,32,30],   oceanShallow:[24,80,68],  landLow:[60,120,90], landHigh:[100,160,130], landPeak:[200,230,220], seaLevel: 0.50, cloudDensity: 0.4,  cloudColor:[210,240,225], atmos: 0x80e8c8, accent: 0x9af0d0 },
  { name: 'Volcanic', oceanDeep:[28,8,8],    oceanShallow:[80,20,15],  landLow:[155,55,35], landHigh:[120,40,25],   landPeak:[70,25,18],    seaLevel: 0.10, cloudDensity: 0.25, cloudColor:[200,80,50],   atmos: 0xff5a3a, accent: 0xff7050 },
  { name: 'Violet',   oceanDeep:[20,12,40],  oceanShallow:[50,30,90],  landLow:[105,75,140],landHigh:[135,95,170],  landPeak:[195,165,220], seaLevel: 0.35, cloudDensity: 0.4,  cloudColor:[210,180,235], atmos: 0xa078e8, accent: 0xb088f0 },
  { name: 'Toxic',    oceanDeep:[40,55,10],  oceanShallow:[80,110,20], landLow:[130,150,40],landHigh:[170,190,55],  landPeak:[220,240,90],  seaLevel: 0.35, cloudDensity: 0.5,  cloudColor:[210,230,120], atmos: 0xa8ff5a, accent: 0xb0ff60 },
  { name: 'Cobalt',   oceanDeep:[5,15,55],   oceanShallow:[20,40,110], landLow:[30,55,140], landHigh:[70,90,180],   landPeak:[170,190,240], seaLevel: 0.60, cloudDensity: 0.35, cloudColor:[230,235,255], atmos: 0x4a78ff, accent: 0x6090ff }
];

export function generateProceduralWorld() {
  const p = PROCEDURAL_PRESETS[Math.floor(random() * PROCEDURAL_PRESETS.length)];
  const seed = Math.floor(random() * 100000);
  // 50% chance of city lights, suggests the world is inhabited.
  const features = random() > 0.5
    ? [{ type: 'cities', count: 18 + Math.floor(random() * 25), color: '#ffe590', size: 1.0, opacity: 0.7 }]
    : [];
  return {
    id: `proc-${p.name.toLowerCase()}-${seed}`,
    label: p.name,
    sub: `A ${p.name.toLowerCase()} world.`,
    surfaceMode: 'procedural',
    seed,
    oceanDeep: p.oceanDeep,
    oceanShallow: p.oceanShallow,
    landLow: p.landLow,
    landHigh: p.landHigh,
    landPeak: p.landPeak,
    seaLevel: p.seaLevel,
    cloudDensity: p.cloudDensity,
    cloudColor: p.cloudColor,
    atmosphere: p.atmos,
    accent: p.accent,
    features,
    procedural: true
  };
}

export function listIds() {
  return ['earth', 'vormir', 'sakaar', 'asgard', 'titan', 'knowhere', 'random'];
}
