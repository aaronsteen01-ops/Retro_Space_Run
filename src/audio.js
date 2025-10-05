/**
 * audio.js — lightweight synthesised audio cues for Retro Space Run.
 */
let audioOn = true;
let ac;
let master;

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
  master.gain.value = 0.12;
  master.connect(ac.destination);
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
    playPow();
  }
  return audioOn;
}

export function setAudioEnabled(enabled) {
  audioOn = enabled;
  if (audioOn) {
    ensureAudio();
  }
}

export function isAudioEnabled() {
  return audioOn;
}

export function resumeAudioContext() {
  if (ac && ac.state === 'suspended') {
    ac.resume();
  }
}
