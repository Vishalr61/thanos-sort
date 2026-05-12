/**
 * Thanos snap sound: real mp3 is the primary (it has the actual impact);
 * procedural Web Audio synthesis is the fallback if the mp3 fails to load
 * or play (offline, CDN down, autoplay blocked, etc.).
 *
 * To remove the external dependency without sacrificing impact, download
 * the mp3 once and ship it from `assets/snap.mp3`, then change SNAP_SOUND_URL
 * to `'assets/snap.mp3'`. The file is ~50KB.
 */

const SNAP_SOUND_URL = 'https://www.myinstants.com/media/sounds/thanos_5TP94G5.mp3';
const PROCEDURAL_FALLBACK_DURATION_S = 1.6;

// Single shared Audio element — reused on each snap (button is disabled
// during snap so no overlap risk). preload='auto' so .duration is available
// by the first snap and the disintegrate timer can sync to real audio length.
export const snapAudio = new Audio(SNAP_SOUND_URL);
snapAudio.volume = 0.5;
snapAudio.preload = 'auto';

// If the mp3 ever fails to load, app.js still needs a duration to time
// disintegration. Fall back to the procedural length.
snapAudio.addEventListener('error', () => {
  if (!isFinite(snapAudio.duration)) {
    Object.defineProperty(snapAudio, 'duration', { value: PROCEDURAL_FALLBACK_DURATION_S, configurable: true });
  }
}, { once: true });

export function playSnap() {
  // Haptic feedback for mobile devices that support it (Android Chrome).
  // Three quick taps mirror the "snap" rhythm. iOS Safari ignores this.
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([60, 30, 90]);
  }
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

/**
 * Ambient crowd murmur. Volume tracks population: as people disintegrate the
 * crowd thins out audibly. Procedural — no external dependency.
 */

let ambientCtx = null;
let ambientGain = null;
let ambientStarted = false;
const AMBIENT_BASE = 0.18;

export function startAmbient() {
  if (ambientStarted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ambientCtx = new AC();

    // Pink-noise-ish buffer, vocal-band filtered, slowly modulated.
    const bufferSize = ambientCtx.sampleRate * 2; // 2s loop
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    const src = ambientCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const bp = ambientCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380;
    bp.Q.value = 0.55;

    const lp = ambientCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;

    // Slow LFO on gain so the murmur breathes.
    const lfo = ambientCtx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ambientCtx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);

    ambientGain = ambientCtx.createGain();
    ambientGain.gain.value = AMBIENT_BASE;
    lfoGain.connect(ambientGain.gain);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(ambientGain);
    ambientGain.connect(ambientCtx.destination);

    src.start(0);
    lfo.start(0);
    ambientStarted = true;
  } catch (_) {
    // Autoplay policy or unsupported — ambient just stays silent.
  }
}

export function setAmbientLevel(ratio) {
  if (!ambientGain || !ambientCtx) return;
  const clamped = Math.max(0, Math.min(1, ratio));
  const target = AMBIENT_BASE * clamped;
  const now = ambientCtx.currentTime;
  ambientGain.gain.cancelScheduledValues(now);
  ambientGain.gain.linearRampToValueAtTime(target, now + 0.4);
}

/**
 * Brief tone played on stone hover/click. Frequency maps to stone color
 * (red ≈ low, violet ≈ high), so the toolbar becomes a faint instrument.
 */
export function playTone(freq, opts = {}) {
  if (!ambientCtx) return;
  try {
    const dur = opts.duration ?? 0.18;
    const peak = opts.peak ?? 0.06;
    const osc = ambientCtx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.value = freq;
    const g = ambientCtx.createGain();
    g.gain.setValueAtTime(0, ambientCtx.currentTime);
    g.gain.linearRampToValueAtTime(peak, ambientCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ambientCtx.currentTime + dur);
    osc.connect(g);
    g.connect(ambientCtx.destination);
    osc.start();
    osc.stop(ambientCtx.currentTime + dur + 0.05);
  } catch (_) { /* autoplay not unlocked yet */ }
}

/**
 * Brief click tick — for button presses. Sub-50ms blip in the mid-low
 * register, barely audible but tactilely satisfying.
 */
export function playClick() {
  if (!ambientCtx) return;
  try {
    const osc = ambientCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 540;
    const g = ambientCtx.createGain();
    g.gain.setValueAtTime(0, ambientCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.045, ambientCtx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ambientCtx.currentTime + 0.06);
    osc.connect(g);
    g.connect(ambientCtx.destination);
    osc.start();
    osc.stop(ambientCtx.currentTime + 0.08);
  } catch {}
}

/**
 * Whoosh — for panel open/close. Filtered noise burst, ~250ms.
 */
export function playWhoosh() {
  if (!ambientCtx) return;
  try {
    const dur = 0.25;
    const buf = ambientCtx.createBuffer(1, ambientCtx.sampleRate * dur, ambientCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ambientCtx.createBufferSource();
    src.buffer = buf;
    const filt = ambientCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 800;
    filt.Q.value = 0.8;
    const g = ambientCtx.createGain();
    g.gain.value = 0.08;
    src.connect(filt);
    filt.connect(g);
    g.connect(ambientCtx.destination);
    src.start();
    src.stop(ambientCtx.currentTime + dur);
  } catch {}
}

/**
 * Ding — algorithm completion. Two-note bell.
 */
export function playDing() {
  if (!ambientCtx) return;
  try {
    [880, 1318].forEach((f, i) => {
      const osc = ambientCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ambientCtx.createGain();
      const start = ambientCtx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.055, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(g);
      g.connect(ambientCtx.destination);
      osc.start(start);
      osc.stop(start + 1);
    });
  } catch {}
}

/**
 * Soft chord swell — played on end-game reveal. Three slightly detuned
 * sines blended into a Lydian-ish chord; sounds film-cue-ish without
 * being intrusive.
 */
export function playEndgameChord() {
  if (!ambientCtx) return;
  try {
    const root = 220;
    const intervals = [1, 1.5, 1.88, 2.66]; // root, fifth, major7-ish, major9
    intervals.forEach((mul, i) => {
      const osc = ambientCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = root * mul;
      const g = ambientCtx.createGain();
      const start = ambientCtx.currentTime + i * 0.05;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.05, start + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 3.5);
      osc.connect(g);
      g.connect(ambientCtx.destination);
      osc.start(start);
      osc.stop(start + 3.6);
    });
  } catch (_) { /* ignore */ }
}

