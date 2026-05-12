/**
 * Thanos snap sound: MyInstants clip + procedural fallback.
 */

const SNAP_SOUND_URL = 'https://www.myinstants.com/media/sounds/thanos_5TP94G5.mp3';

// Single shared Audio element — reused on each snap (button is disabled while
// a snap is in flight, so no overlap risk). preload='auto' so .duration is
// available by the first snap and the disintegrate timer can sync to it.
export const snapAudio = new Audio(SNAP_SOUND_URL);
snapAudio.volume = 0.5;
snapAudio.preload = 'auto';

export function playSnap() {
  try {
    snapAudio.currentTime = 0;
  } catch (_) { /* not yet loaded — play() will still kick the fetch */ }
  const p = snapAudio.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => playSnapProcedural());
  }
}

export function playSnapProcedural() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = ctx.sampleRate;
  const duration = 0.85;
  const length = Math.ceil(sampleRate * duration);
  const data = new Float32Array(length);

  const crackleLen = Math.ceil(0.012 * sampleRate);
  for (let i = 0; i < crackleLen; i++) {
    const w = Math.sin((i / crackleLen) * Math.PI);
    data[i] += (Math.random() * 2 - 1) * w * 0.35;
  }

  let prev = 0;
  const swellLen = Math.ceil(0.14 * sampleRate);
  for (let i = 0; i < swellLen; i++) {
    const t = i / swellLen;
    const swell = Math.sin(t * Math.PI * 0.5);
    const dust = prev * 0.4 + (Math.random() * 2 - 1) * 0.6;
    prev = dust;
    data[i] = (data[i] || 0) + dust * swell * 0.45;
  }

  const tailStartS = 0.06, tailEndS = 0.78;
  const numGrains = 140;
  for (let g = 0; g < numGrains; g++) {
    const u = Math.random();
    const grainStart = (tailStartS + u * (tailEndS - tailStartS)) * sampleRate;
    const grainLen = (0.025 + Math.random() * 0.06) * sampleRate;
    const falloff = Math.pow(1 - (grainStart / length), 0.6);
    const grainAmp = (0.2 + Math.random() * 0.35) * falloff;
    for (let i = 0; i < grainLen; i++) {
      const idx = Math.floor(grainStart + i);
      if (idx >= length) break;
      const t = i / grainLen;
      data[idx] = (data[idx] || 0) + (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * grainAmp;
    }
  }

  prev = 0;
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const bed = Math.pow(1 - t, 1.1);
    const n = prev * 0.5 + (Math.random() * 2 - 1) * 0.5;
    prev = n;
    data[i] = (data[i] || 0) + n * bed * 0.32;
  }

  let max = 0;
  for (let i = 0; i < length; i++) {
    data[i] *= Math.pow(1 - i / length, 0.75);
    max = Math.max(max, Math.abs(data[i]));
  }
  if (max > 0) for (let i = 0; i < length; i++) data[i] /= max * 1.25;

  const buffer = ctx.createBuffer(1, length, sampleRate);
  buffer.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.52, ctx.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 320;
  bandpass.Q.value = 0.65;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 75;
  src.connect(bandpass);
  bandpass.connect(highpass);
  highpass.connect(gain);
  gain.connect(ctx.destination);
  src.start(0);
}
