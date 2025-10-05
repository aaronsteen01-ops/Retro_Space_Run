/**
 * difficulty.js — player-selectable global difficulty multipliers.
 */

export const DIFFICULTY = Object.freeze({
  easy: { density: 0.85, speed: 0.9, hp: 0.9 },
  normal: { density: 1, speed: 1, hp: 1 },
  hard: { density: 1.2, speed: 1.1, hp: 1.1 },
});

const DEFAULT_MODE = 'normal';
const STORAGE_KEY = 'retro-space-run.difficulty';
const listeners = new Set();

function normaliseMode(mode) {
  if (typeof mode !== 'string') {
    return DEFAULT_MODE;
  }
  const key = mode.toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY, key) ? key : DEFAULT_MODE;
}

function readStoredMode() {
  if (typeof window === 'undefined') {
    return DEFAULT_MODE;
  }
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_MODE;
    }
    return normaliseMode(stored);
  } catch (err) {
    return DEFAULT_MODE;
  }
}

let currentMode = readStoredMode();

function persistMode(mode) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage?.setItem(STORAGE_KEY, mode);
  } catch (err) {
    /* ignore persistence issues */
  }
}

function emitChange(mode) {
  listeners.forEach((listener) => {
    try {
      listener(mode);
    } catch (err) {
      /* swallow listener errors */
    }
  });
}

export function getDifficultyMode() {
  return currentMode;
}

export function setDifficultyMode(mode, { persist = true } = {}) {
  const next = normaliseMode(mode);
  if (next === currentMode) {
    return currentMode;
  }
  currentMode = next;
  if (persist) {
    persistMode(currentMode);
  }
  emitChange(currentMode);
  return currentMode;
}

export function getDifficultyMultipliers(mode = currentMode) {
  const key = normaliseMode(mode);
  return DIFFICULTY[key] ?? DIFFICULTY[DEFAULT_MODE];
}

export function onDifficultyModeChange(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
