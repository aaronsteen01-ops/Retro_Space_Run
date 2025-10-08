/**
 * audio.js — lightweight synthesised audio cues for Retro Space Run.
 */
let audioOn = true;
let ac;
let master;
let musicGain;
let musicSource = null;
let currentMusicKey = null;
let requestedMusicKey = null;

const DEFAULT_MASTER_GAIN = 0.12;
let masterVolumeScalar = 1;

const MUSIC_VOLUME = 0.38;
const DEFAULT_MUSIC_THEME = 'synth-horizon';
const TAU = Math.PI * 2;

const SFX_PRESETS = {
  hit: [
    { type: 'triangle', freq: 200, len: 0.22, gain: 0.32 },
    { type: 'sine', freq: 420, len: 0.08, gain: 0.18, delay: 0.02 },
  ],
  explode: [
    { type: 'square', freq: 160, len: 0.32, gain: 0.35 },
    { type: 'sawtooth', freq: 90, len: 0.46, gain: 0.26, delay: 0.04 },
  ],
  upgrade: [
    { type: 'triangle', freq: 780, len: 0.24, gain: 0.26 },
    { type: 'square', freq: 520, len: 0.18, gain: 0.18, delay: 0.04 },
  ],
  bossDown: [
    { type: 'sawtooth', freq: 260, len: 0.5, gain: 0.32 },
    { type: 'triangle', freq: 140, len: 0.64, gain: 0.28, delay: 0.06 },
  ],
};

function ensureAudio() {
  if (ac) {
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    audioOn = false;
    return;
  }
  ac = new Ctx();
  master = ac.createGain();
  musicGain = ac.createGain();
  musicGain.gain.value = audioOn ? MUSIC_VOLUME : 0;
  musicGain.connect(master);
  applyVolume();
  master.connect(ac.destination);
}

function applyVolume() {
  if (!master) {
    return;
  }
  const gainValue = audioOn ? DEFAULT_MASTER_GAIN * masterVolumeScalar : 0;
  master.gain.value = gainValue;
  if (musicGain) {
    const now = ac ? ac.currentTime : 0;
    musicGain.gain.cancelScheduledValues(now);
    const target = audioOn ? MUSIC_VOLUME : 0;
    musicGain.gain.setValueAtTime(target, now);
  }
}

function playTone(type, freq, len, gain, delay = 0) {
  if (!audioOn) {
    return;
  }
  ensureAudio();
  if (!ac) {
    return;
  }
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const duration = Math.max(0.02, len);
  const startDelay = Math.max(0, delay);
  const t = ac.currentTime + startDelay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.value = Math.max(0, gain);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  g.gain.setValueAtTime(Math.max(0.0001, gain), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.stop(t + duration + 0.05);
}

export function playSfx(id) {
  if (!audioOn) {
    return;
  }
  const preset = SFX_PRESETS[id];
  if (!preset) {
    return;
  }
  for (const tone of preset) {
    playTone(tone.type, tone.freq, tone.len, tone.gain, tone.delay ?? 0);
  }
}

export function playZap() {
  playTone('sawtooth', 320, 0.12, 0.25);
}

export function playPew() {
  playTone('square', 920, 0.06, 0.25);
}

export function playHit() {
  playSfx('hit');
}

export function playPow() {
  playSfx('explode');
}

export function playUpgrade() {
  playSfx('upgrade');
}

export function playBossDown() {
  playSfx('bossDown');
}

export function toggleAudio() {
  audioOn = !audioOn;
  if (audioOn) {
    ensureAudio();
    if (masterVolumeScalar <= 0) {
      masterVolumeScalar = 1;
    }
    applyVolume();
    playPow();
  }
  applyVolume();
  refreshMusic();
  return audioOn;
}

export function setAudioEnabled(enabled) {
  audioOn = enabled;
  if (audioOn) {
    ensureAudio();
    applyVolume();
  }
  applyVolume();
  refreshMusic();
}

export function isAudioEnabled() {
  return audioOn;
}

export function getVolume() {
  if (!audioOn) {
    return 0;
  }
  return masterVolumeScalar;
}

export function setVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return getVolume();
  }
  const clamped = Math.max(0, Math.min(1, numeric));
  masterVolumeScalar = clamped;
  if (clamped <= 0) {
    audioOn = false;
  } else {
    audioOn = true;
    ensureAudio();
  }
  applyVolume();
  return getVolume();
}

export function resumeAudioContext() {
  if (ac && ac.state === 'suspended') {
    ac.resume();
  }
}

const musicCache = new Map();

function pseudoRand(index, seed = 0) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getSequenceFrequency(layer, t) {
  if (!Array.isArray(layer.sequence) || layer.sequence.length === 0) {
    return layer.baseFreq || 220;
  }
  const stepLength = Math.max(0.05, layer.stepLength || 0.5);
  const stepIndex = Math.floor(t / stepLength) % layer.sequence.length;
  const base = layer.baseFreq || 220;
  const semitone = layer.sequence[stepIndex];
  return base * Math.pow(2, semitone / 12);
}

function computeEnvelopeGain(layer, t) {
  if (!Array.isArray(layer.sequence) || layer.sequence.length === 0) {
    return 1;
  }
  const stepLength = Math.max(0.05, layer.stepLength || 0.5);
  const stepPosition = (t % stepLength) / stepLength;
  const env = layer.envelope || {};
  const attack = Math.max(0, Math.min(1, env.attack ?? 0.1));
  const release = Math.max(0, Math.min(1, env.release ?? 0.3));
  let gain = 1;
  if (attack > 0) {
    gain *= Math.min(1, stepPosition / attack);
  }
  if (release > 0) {
    const relStart = 1 - release;
    if (stepPosition >= relStart) {
      const relProgress = (stepPosition - relStart) / Math.max(0.0001, release);
      gain *= Math.max(0, 1 - relProgress);
    }
  }
  return Math.max(0, Math.min(1, gain));
}

function lfoValue(lfo, t) {
  if (!lfo) {
    return 0;
  }
  const freq = Math.max(0, lfo.freq ?? 0.5);
  const phase = lfo.phase ?? 0;
  const type = lfo.type ?? 'sine';
  const depth = lfo.depth ?? 0;
  const angle = t * freq * TAU + phase;
  let value = 0;
  if (type === 'triangle') {
    value = 2 * Math.abs(((angle / Math.PI) % 2) - 1) - 1;
  } else if (type === 'square') {
    value = Math.sign(Math.sin(angle));
  } else {
    value = Math.sin(angle);
  }
  return value * depth;
}

function panGains(pan = 0) {
  const clamped = Math.max(-1, Math.min(1, pan));
  const theta = (clamped + 1) * (Math.PI / 4);
  return { left: Math.cos(theta), right: Math.sin(theta) };
}

function generateMusicBuffer(config) {
  ensureAudio();
  if (!ac) {
    return null;
  }
  const duration = Math.max(1, config.duration || 8);
  const channels = 2;
  const sampleRate = ac.sampleRate || 44100;
  const frameCount = Math.floor(sampleRate * duration);
  const buffer = ac.createBuffer(channels, frameCount, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const layers = Array.isArray(config.layers) ? config.layers : [];
  const layerCount = layers.length || 1;
  let maxSample = 0;
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;
    for (let l = 0; l < layers.length; l++) {
      const layer = layers[l];
      let value = 0;
      if (layer.noise) {
        const noise = pseudoRand(i, l + (layer.seed ?? 0));
        const smooth = layer.smooth ?? 0.2;
        const prev = i > 0 ? left[i - 1] : 0;
        value = (noise * 2 - 1) * (layer.amp ?? 0.1);
        value = prev * smooth + value * (1 - smooth);
      } else {
        let freq = getSequenceFrequency(layer, t);
        const freqMod = lfoValue(layer.freqLfo, t);
        if (freqMod) {
          freq += freq * freqMod;
        }
        const phase = (layer.phase ?? 0) + t * freq * TAU;
        const waveform = layer.type ?? 'sine';
        if (waveform === 'square') {
          value = Math.sign(Math.sin(phase));
        } else if (waveform === 'triangle') {
          value = 2 * Math.abs(((phase / Math.PI) % 2) - 1) - 1;
        } else if (waveform === 'sawtooth') {
          const cycle = phase / TAU;
          value = 2 * (cycle - Math.floor(cycle + 0.5));
        } else {
          value = Math.sin(phase);
        }
        const envGain = computeEnvelopeGain(layer, t);
        const ampLfo = lfoValue(layer.ampLfo, t);
        const amp = Math.max(0, (layer.amp ?? 0.2) + ampLfo);
        value *= amp * envGain;
      }
      const { left: gainL, right: gainR } = panGains(layer.pan);
      sampleL += value * gainL;
      sampleR += value * gainR;
    }
    sampleL /= layerCount;
    sampleR /= layerCount;
    left[i] = sampleL;
    right[i] = sampleR;
    maxSample = Math.max(maxSample, Math.abs(sampleL), Math.abs(sampleR));
  }
  if (maxSample > 0.99) {
    const normalise = 0.99 / maxSample;
    for (let i = 0; i < frameCount; i++) {
      left[i] *= normalise;
      right[i] *= normalise;
    }
  }
  return buffer;
}

const MUSIC_DEFS = {
  'synth-horizon': {
    duration: 8,
    layers: [
      {
        type: 'sawtooth',
        baseFreq: 110,
        sequence: [0, 5, 7, 12],
        stepLength: 0.75,
        amp: 0.32,
        pan: -0.25,
        envelope: { attack: 0.12, release: 0.4 },
        ampLfo: { freq: 0.22, depth: 0.08 },
      },
      {
        type: 'square',
        baseFreq: 220,
        sequence: [0, 3, 7, 10],
        stepLength: 0.375,
        amp: 0.24,
        pan: 0.35,
        envelope: { attack: 0.05, release: 0.3 },
        freqLfo: { freq: 0.12, depth: 0.015, phase: Math.PI / 3 },
      },
      {
        type: 'sine',
        baseFreq: 440,
        sequence: [0, 7, 12, 7],
        stepLength: 1.5,
        amp: 0.16,
        pan: 0.55,
        envelope: { attack: 0.4, release: 0.4 },
        ampLfo: { freq: 0.18, depth: 0.06 },
      },
      {
        noise: true,
        amp: 0.12,
        smooth: 0.6,
        pan: 0,
        seed: 11,
      },
    ],
  },
  'luminous-depths': {
    duration: 9,
    layers: [
      {
        type: 'sine',
        baseFreq: 98,
        sequence: [0, -3, -5, -7],
        stepLength: 1.2,
        amp: 0.28,
        pan: -0.2,
        envelope: { attack: 0.3, release: 0.5 },
        ampLfo: { freq: 0.14, depth: 0.08, phase: Math.PI / 2 },
      },
      {
        type: 'triangle',
        baseFreq: 196,
        sequence: [0, 2, 4, 7],
        stepLength: 0.9,
        amp: 0.22,
        pan: 0.25,
        envelope: { attack: 0.12, release: 0.36 },
        freqLfo: { freq: 0.18, depth: 0.02 },
      },
      {
        type: 'sine',
        baseFreq: 392,
        sequence: [0, 5, 7, 9],
        stepLength: 0.6,
        amp: 0.16,
        pan: -0.55,
        envelope: { attack: 0.08, release: 0.25 },
        ampLfo: { freq: 0.3, depth: 0.05 },
      },
      {
        noise: true,
        amp: 0.08,
        smooth: 0.75,
        pan: 0.4,
        seed: 23,
      },
    ],
  },
  'ember-overdrive': {
    duration: 8,
    layers: [
      {
        type: 'square',
        baseFreq: 146,
        sequence: [0, 5, 7, 10],
        stepLength: 0.6,
        amp: 0.34,
        pan: -0.35,
        envelope: { attack: 0.08, release: 0.32 },
        ampLfo: { freq: 0.22, depth: 0.07 },
      },
      {
        type: 'sawtooth',
        baseFreq: 220,
        sequence: [0, 3, 7, 8],
        stepLength: 0.4,
        amp: 0.26,
        pan: 0.45,
        envelope: { attack: 0.05, release: 0.26 },
        freqLfo: { freq: 0.25, depth: 0.025 },
      },
      {
        type: 'triangle',
        baseFreq: 330,
        sequence: [0, 7, 12, 7],
        stepLength: 1.2,
        amp: 0.18,
        pan: 0.2,
        envelope: { attack: 0.18, release: 0.34 },
        ampLfo: { freq: 0.3, depth: 0.04, phase: Math.PI / 4 },
      },
      {
        noise: true,
        amp: 0.1,
        smooth: 0.55,
        pan: -0.5,
        seed: 7,
      },
    ],
  },
  'neon-void': {
    duration: 10,
    layers: [
      {
        type: 'sine',
        baseFreq: 82,
        sequence: [0, -2, -5, -7],
        stepLength: 1.6,
        amp: 0.3,
        pan: 0,
        envelope: { attack: 0.4, release: 0.52 },
        ampLfo: { freq: 0.12, depth: 0.1 },
      },
      {
        type: 'triangle',
        baseFreq: 164,
        sequence: [0, 3, 7, 10],
        stepLength: 1.0,
        amp: 0.24,
        pan: -0.4,
        envelope: { attack: 0.1, release: 0.4 },
        freqLfo: { freq: 0.22, depth: 0.03 },
      },
      {
        type: 'square',
        baseFreq: 246,
        sequence: [0, 5, 7, 12],
        stepLength: 0.8,
        amp: 0.18,
        pan: 0.45,
        envelope: { attack: 0.12, release: 0.24 },
        ampLfo: { freq: 0.35, depth: 0.05, type: 'triangle' },
      },
      {
        noise: true,
        amp: 0.12,
        smooth: 0.7,
        pan: -0.2,
        seed: 15,
      },
    ],
  },
  'cosmic-abyss': {
    duration: 11,
    layers: [
      {
        type: 'sine',
        baseFreq: 87,
        sequence: [0, -4, -7, -9],
        stepLength: 1.8,
        amp: 0.32,
        pan: -0.15,
        envelope: { attack: 0.42, release: 0.5 },
        ampLfo: { freq: 0.1, depth: 0.12, phase: Math.PI / 3 },
      },
      {
        type: 'triangle',
        baseFreq: 174,
        sequence: [0, 2, 5, 9],
        stepLength: 1.1,
        amp: 0.24,
        pan: 0.35,
        envelope: { attack: 0.16, release: 0.42 },
        freqLfo: { freq: 0.16, depth: 0.035 },
      },
      {
        type: 'sine',
        baseFreq: 348,
        sequence: [0, 3, 7, 10],
        stepLength: 0.9,
        amp: 0.18,
        pan: -0.55,
        envelope: { attack: 0.2, release: 0.36 },
        ampLfo: { freq: 0.28, depth: 0.06 },
      },
      {
        noise: true,
        amp: 0.1,
        smooth: 0.82,
        pan: 0.5,
        seed: 31,
      },
    ],
  },
};

function getMusicBuffer(themeKey) {
  if (!themeKey || !MUSIC_DEFS[themeKey]) {
    return null;
  }
  if (musicCache.has(themeKey)) {
    return musicCache.get(themeKey);
  }
  const buffer = generateMusicBuffer(MUSIC_DEFS[themeKey]);
  if (buffer) {
    musicCache.set(themeKey, buffer);
  }
  return buffer;
}

function stopMusic({ fade = 0.2 } = {}) {
  if (!musicSource || !ac) {
    if (musicGain) {
      musicGain.gain.value = audioOn ? MUSIC_VOLUME : 0;
    }
    return;
  }
  const now = ac.currentTime;
  if (musicGain) {
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0, now + Math.max(0.05, fade));
  }
  try {
    musicSource.stop(now + Math.max(0.05, fade));
  } catch (err) {
    // Ignore playback errors when stopping music.
  }
  musicSource.disconnect();
  musicSource = null;
  currentMusicKey = null;
}

function startMusic(themeKey) {
  if (!audioOn) {
    return;
  }
  ensureAudio();
  if (!ac) {
    return;
  }
  if (!musicGain) {
    musicGain = ac.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    musicGain.connect(master);
  }
  if (currentMusicKey === themeKey && musicSource) {
    return;
  }
  const buffer = getMusicBuffer(themeKey);
  if (!buffer) {
    stopMusic();
    return;
  }
  if (musicSource) {
    stopMusic({ fade: 0.18 });
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(musicGain);
  const now = ac.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(0, now);
  musicGain.gain.linearRampToValueAtTime(audioOn ? MUSIC_VOLUME : 0, now + 0.8);
  source.start(now + 0.05);
  musicSource = source;
  currentMusicKey = themeKey;
}

function refreshMusic() {
  if (!requestedMusicKey || !audioOn) {
    stopMusic({ fade: 0.2 });
    return;
  }
  startMusic(requestedMusicKey);
}

export function setMusicTheme(themeKey) {
  if (themeKey === null) {
    requestedMusicKey = null;
  } else if (typeof themeKey === 'string' && MUSIC_DEFS[themeKey]) {
    requestedMusicKey = themeKey;
  } else if (typeof themeKey === 'string') {
    requestedMusicKey = DEFAULT_MUSIC_THEME;
  } else {
    requestedMusicKey = DEFAULT_MUSIC_THEME;
  }
  refreshMusic();
}
