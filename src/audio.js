/**
 * audio.js — lightweight synthesised audio cues for Retro Space Run.
 */
let audioOn = true;
let ac;
let master;

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

function playTone(type, freq, len, gain) {
  if (!audioOn) {
    return;
  }
  ensureAudio();
  if (!ac) {
    return;
  }
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(master);
  const t = ac.currentTime;
  osc.start(t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.stop(t + len + 0.02);
}

export function playZap() {
  playTone('sawtooth', 320, 0.12, 0.25);
}

export function playPew() {
  playTone('square', 920, 0.06, 0.25);
}

export function playHit() {
  playTone('triangle', 180, 0.2, 0.35);
}

export function playPow() {
  playTone('sine', 560, 0.25, 0.28);
}

export function playUpgrade() {
  playTone('triangle', 760, 0.18, 0.28);
  playTone('square', 520, 0.12, 0.18);
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
