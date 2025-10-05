/**
 * difficulty.js — player-selectable global difficulty multipliers.
 */

export const DIFFICULTY = Object.freeze({
  easy: { density: 0.85, speed: 0.9, hp: 0.9 },
  normal: { density: 1, speed: 1, hp: 1 },
  hard: { density: 1.2, speed: 1.1, hp: 1.1 },
});

import { getMetaValue, updateStoredMeta } from './storage.js';

const DEFAULT_MODE = 'normal';
const listeners = new Set();

function normaliseMode(mode) {
  if (typeof mode !== 'string') {
    return DEFAULT_MODE;
  }
  const key = mode.toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY, key) ? key : DEFAULT_MODE;
}

function readStoredMode() {
  const stored = getMetaValue('difficulty', DEFAULT_MODE);
  return normaliseMode(stored);
}

let currentMode = readStoredMode();

function persistMode(mode) {
  updateStoredMeta({ difficulty: mode });
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
