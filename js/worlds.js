/**
 * Worlds — every planet you can land on.
 *
 * Each preset defines:
 *   id, label, sub                     — identification
 *   ocean, land, atmosphere, accent    — palette (canvas + atmosphere shader)
 *   landStyle                          — how to draw the surface
 *     'continents'  → use real Earth continent polygons
 *     'shards'      → broken angular plates (Vormir, Titan)
 *     'islands'     → scattered blobs (Sakaar, Knowhere)
 *     'whole'       → land covers most of the globe (Asgard)
 *     'random'      → procedurally-shaped blobs
 *
 * generateProceduralWorld() returns a random {palette, landStyle} drawn
 * from broad-but-thematic palette families — different every reset.
 */

import { CONTINENTS, lngLatToXY, drawContinent } from './data.js';
import { random } from './rng.js';

export const WORLDS = {
  earth: {
    id: 'earth',
    label: 'Earth',
    sub: 'Default. Half disappear at random.',
    ocean: ['#0a2840', '#0d3555', '#134a6e', '#0d3555', '#0a2840'],
    land: ['#4a6b4a', '#5a7c52', '#3d5c40', '#557855', '#4d704d', '#456045', '#3a5538', '#507550', '#485d48', '#4e6b4e'],
    atmosphere: 0x8aa8ff,
    accent: 0xa78bfa,
    landStyle: 'continents'
  },
  vormir: {
    id: 'vormir',
    label: 'Vormir',
    sub: 'A soul for a soul. Cold and orange.',
    ocean: ['#1a0608', '#2a0a0d', '#3d0e12', '#2a0a0d', '#1a0608'],
    land: ['#6e2419', '#7a2d20', '#5d1d14', '#8a3826', '#6e2419', '#5d1d14', '#7a2d20', '#6e2419'],
    atmosphere: 0xff7a4d,
    accent: 0xfb923c,
    landStyle: 'shards'
  },
  sakaar: {
    id: 'sakaar',
    label: 'Sakaar',
    sub: 'The Grandmaster\'s junkyard.',
    ocean: ['#0c0a0c', '#1a1414', '#2a1f1a', '#1a1414', '#0c0a0c'],
    land: ['#8a5a2a', '#a06a35', '#b07640', '#7a4f25', '#9c6230', '#8a5a2a', '#604015', '#a06a35'],
    atmosphere: 0xffa040,
    accent: 0xffaa55,
    landStyle: 'islands'
  },
  asgard: {
    id: 'asgard',
    label: 'Asgard',
    sub: 'Realm eternal. Bridge of light.',
    ocean: ['#0a0612', '#1a0e1f', '#2a1830', '#1a0e1f', '#0a0612'],
    land: ['#c9a14a', '#d4b258', '#b88a3e', '#e0c068', '#a87832', '#cfa850', '#c9a14a', '#b88a3e'],
    atmosphere: 0xffd47a,
    accent: 0xffcf60,
    landStyle: 'whole'
  },
  titan: {
    id: 'titan',
    label: 'Titan',
    sub: 'Home. Once vibrant. Now ruined.',
    ocean: ['#1a0c14', '#2a1620', '#3a1f2a', '#2a1620', '#1a0c14'],
    land: ['#7c4738', '#8c5444', '#6c3a2c', '#a06354', '#7c4738', '#5e2a1f', '#8c5444', '#6c3a2c'],
    atmosphere: 0xd96a4a,
    accent: 0xef4444,
    landStyle: 'shards'
  },
  knowhere: {
    id: 'knowhere',
    label: 'Knowhere',
    sub: 'Severed Celestial head. Mining colony.',
    ocean: ['#0a0a16', '#161628', '#252540', '#161628', '#0a0a16'],
    land: ['#7a5fa0', '#9075b8', '#5e4880', '#a585c8', '#7a5fa0', '#5e4880', '#9075b8', '#705590'],
    atmosphere: 0xa78bfa,
    accent: 0xc084fc,
    landStyle: 'islands'
  }
};

const PROCEDURAL_PALETTES = [
  { name: 'verdant',  ocean: ['#0a1f3a', '#0d2f55', '#1a4574', '#0d2f55', '#0a1f3a'], lands: ['#4a8a55', '#5a9c62', '#3d7a40', '#558855', '#4d8048', '#406040'], atmos: 0x88c8ff, accent: 0x88dd99 },
  { name: 'crimson',  ocean: ['#1a0814', '#2a0e20', '#3a1830', '#2a0e20', '#1a0814'], lands: ['#8a3a48', '#a04a55', '#742f3a', '#b85060', '#8a3a48'], atmos: 0xff6a8a, accent: 0xff7088 },
  { name: 'amber',    ocean: ['#0a0a1a', '#181828', '#2a2638', '#181828', '#0a0a1a'], lands: ['#c08832', '#d49a42', '#a87026', '#e8b058', '#c08832'], atmos: 0xffc88a, accent: 0xffb060 },
  { name: 'oceanic',  ocean: ['#020a18', '#04162a', '#082548', '#04162a', '#020a18'], lands: ['#1a6a8a', '#2880a0', '#155575', '#3898b8', '#1a6a8a'], atmos: 0x66c8ee, accent: 0x80d4ee },
  { name: 'glacial',  ocean: ['#0e1828', '#1a2840', '#283e5c', '#1a2840', '#0e1828'], lands: ['#9ab0c4', '#b0c4d8', '#8098b0', '#c4d8ec', '#9ab0c4'], atmos: 0xddeeff, accent: 0xe8f4ff },
  { name: 'jade',     ocean: ['#04181a', '#082828', '#0c4040', '#082828', '#04181a'], lands: ['#3a8a78', '#4aa088', '#2e7468', '#5cb898', '#3a8a78'], atmos: 0x80e8c8, accent: 0x9af0d0 },
  { name: 'volcanic', ocean: ['#1a0408', '#280810', '#3a0c18', '#280810', '#1a0408'], lands: ['#a0382a', '#b84838', '#882c20', '#cc5848', '#a0382a'], atmos: 0xff5a3a, accent: 0xff7050 },
  { name: 'violet',   ocean: ['#0c0824', '#181238', '#241850', '#181238', '#0c0824'], lands: ['#7048a8', '#8458c0', '#5a3a8a', '#9868d0', '#7048a8'], atmos: 0xa078e8, accent: 0xb088f0 }
];

const STYLES = ['continents', 'shards', 'islands', 'random'];

export function generateProceduralWorld() {
  const palette = PROCEDURAL_PALETTES[Math.floor(random() * PROCEDURAL_PALETTES.length)];
  const landStyle = STYLES[Math.floor(random() * STYLES.length)];
  return {
    id: `proc-${palette.name}-${landStyle}`,
    label: titleCase(palette.name),
    sub: `A ${palette.name} ${landStyle} world.`,
    ocean: palette.ocean,
    land: palette.lands,
    atmosphere: palette.atmos,
    accent: palette.accent,
    landStyle,
    procedural: true
  };
}

function titleCase(s) { return s[0].toUpperCase() + s.slice(1); }

/**
 * Paint a world's surface onto a 2D canvas. Used to build the THREE
 * texture. Each style draws differently:
 *   - 'continents' uses the real Earth polygons
 *   - 'shards' draws angular plates with gaps between
 *   - 'islands' scatters Voronoi-like blobs across the surface
 *   - 'random' rotates the continent polygons and adds noise
 *   - 'whole' fills the surface with land (sparse ocean breaks)
 */
export function paintWorld(ctx, world, w, h) {
  const oceanGrd = ctx.createLinearGradient(0, 0, w, h);
  world.ocean.forEach((c, i, arr) => oceanGrd.addColorStop(i / (arr.length - 1), c));
  ctx.fillStyle = oceanGrd;
  ctx.fillRect(0, 0, w, h);

  const colors = world.land;
  const pick = () => colors[Math.floor(random() * colors.length)];

  switch (world.landStyle) {
    case 'continents':
      Object.values(CONTINENTS).forEach((poly, i) => drawContinent(ctx, poly, w, h, colors[i % colors.length]));
      break;

    case 'whole':
      // Big bright continents covering most of the surface
      Object.values(CONTINENTS).forEach((poly, i) => drawContinent(ctx, poly, w, h, colors[i % colors.length]));
      // Plus scattered fill
      for (let i = 0; i < 12; i++) {
        const lng = (random() * 360) - 180;
        const lat = (random() * 140) - 70;
        const r = 6 + random() * 14;
        drawBlob(ctx, lng, lat, r, w, h, pick());
      }
      break;

    case 'shards':
      // Angular tectonic plates: triangulated, dark veins between
      for (let i = 0; i < 14; i++) {
        const lng = (random() * 360) - 180;
        const lat = (random() * 140) - 70;
        drawShard(ctx, lng, lat, 18 + random() * 22, w, h, pick());
      }
      break;

    case 'islands':
      // Many small scattered blobs
      for (let i = 0; i < 28; i++) {
        const lng = (random() * 360) - 180;
        const lat = (random() * 140) - 70;
        const r = 3 + random() * 9;
        drawBlob(ctx, lng, lat, r, w, h, pick());
      }
      break;

    case 'random':
    default:
      // Rotated continent polygons + extra blobs
      const offset = random() * 360;
      Object.values(CONTINENTS).forEach((poly, i) => {
        const rotated = poly.map(([lng, lat]) => [(lng + offset + 540) % 360 - 180, lat]);
        drawContinent(ctx, rotated, w, h, colors[i % colors.length]);
      });
      for (let i = 0; i < 6; i++) {
        const lng = (random() * 360) - 180;
        const lat = (random() * 140) - 70;
        const r = 4 + random() * 10;
        drawBlob(ctx, lng, lat, r, w, h, pick());
      }
      break;
  }
}

function drawBlob(ctx, lng, lat, radiusLat, w, h, fill) {
  const segments = 16;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const wobble = 0.7 + random() * 0.6;
    const dLng = Math.cos(angle) * radiusLat * 1.5 * wobble / Math.max(0.3, Math.cos(lat * Math.PI / 180));
    const dLat = Math.sin(angle) * radiusLat * wobble;
    const p = lngLatToXY(lng + dLng, lat + dLat, w, h);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawShard(ctx, lng, lat, size, w, h, fill) {
  const points = 4 + Math.floor(random() * 3); // 4-6 sided shard
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 + random() * 0.6;
    const r = size * (0.6 + random() * 0.7);
    const dLng = Math.cos(angle) * r * 1.5 / Math.max(0.3, Math.cos(lat * Math.PI / 180));
    const dLat = Math.sin(angle) * r;
    const p = lngLatToXY(lng + dLng, lat + dLat, w, h);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function listIds() {
  return ['earth', 'vormir', 'sakaar', 'asgard', 'titan', 'knowhere', 'random'];
}
