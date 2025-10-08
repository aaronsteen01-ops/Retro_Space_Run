/**
 * meta.js — persistent meta-progression tracking for Retro Space Run.
 */

const META_STORAGE_KEY = 'retro-space-run.progress';

const DEFAULT_PROGRESS = Object.freeze({
  totalRuns: 0,
  totalScore: 0,
  bossesDefeated: 0,
  shipsUnlocked: ['pioneer'],
  upgradesUnlocked: [],
  lastSelectedShip: 'pioneer',
  bestEndlessScore: 0,
  bestEndlessTime: 0,
});

let cachedProgress = null;

function readStoredProgress() {
  if (cachedProgress) {
    return cachedProgress;
  }
  if (typeof window === 'undefined') {
    cachedProgress = { ...DEFAULT_PROGRESS };
    return cachedProgress;
  }
  try {
    const stored = window.localStorage?.getItem(META_STORAGE_KEY);
    if (!stored) {
      cachedProgress = { ...DEFAULT_PROGRESS };
      return cachedProgress;
    }
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object') {
      cachedProgress = normaliseProgress(parsed);
      return cachedProgress;
    }
  } catch (err) {
    // Ignore persistence errors and fall back to defaults.
  }
  cachedProgress = { ...DEFAULT_PROGRESS };
  return cachedProgress;
}

function writeProgress(progress) {
  const normalised = normaliseProgress(progress);
  if (typeof window === 'undefined') {
    cachedProgress = normalised;
    return;
  }
  try {
    window.localStorage?.setItem(META_STORAGE_KEY, JSON.stringify(normalised));
  } catch (err) {
    // Ignore persistence errors.
  }
  cachedProgress = normalised;
}

function uniqueArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
}

function normaliseProgress(raw = {}) {
  const base = { ...DEFAULT_PROGRESS };
  const result = { ...base };
  if (Number.isFinite(raw.totalRuns) && raw.totalRuns >= 0) {
    result.totalRuns = Math.floor(raw.totalRuns);
  }
  if (Number.isFinite(raw.totalScore) && raw.totalScore >= 0) {
    result.totalScore = Math.floor(raw.totalScore);
  }
  if (Number.isFinite(raw.bossesDefeated) && raw.bossesDefeated >= 0) {
    result.bossesDefeated = Math.floor(raw.bossesDefeated);
  }
  if (Number.isFinite(raw.bestEndlessScore) && raw.bestEndlessScore >= 0) {
    result.bestEndlessScore = Math.floor(raw.bestEndlessScore);
  }
  if (Number.isFinite(raw.bestEndlessTime) && raw.bestEndlessTime >= 0) {
    result.bestEndlessTime = Math.floor(raw.bestEndlessTime);
  }
  result.shipsUnlocked = uniqueArray(raw.shipsUnlocked);
  if (!result.shipsUnlocked.includes('pioneer')) {
    result.shipsUnlocked.unshift('pioneer');
  }
  result.upgradesUnlocked = uniqueArray(raw.upgradesUnlocked);
  if (typeof raw.lastSelectedShip === 'string' && raw.lastSelectedShip.trim().length > 0) {
    result.lastSelectedShip = raw.lastSelectedShip.trim();
  }
  if (!result.shipsUnlocked.includes(result.lastSelectedShip)) {
    result.lastSelectedShip = result.shipsUnlocked[0] ?? 'pioneer';
  }
  return result;
}

function cloneProgress(progress) {
  return {
    totalRuns: progress.totalRuns,
    totalScore: progress.totalScore,
    bossesDefeated: progress.bossesDefeated,
    shipsUnlocked: progress.shipsUnlocked.slice(),
    upgradesUnlocked: progress.upgradesUnlocked.slice(),
    lastSelectedShip: progress.lastSelectedShip,
    bestEndlessScore: progress.bestEndlessScore,
    bestEndlessTime: progress.bestEndlessTime,
  };
}

function applyAutomaticUnlocks(progress) {
  const next = cloneProgress(progress);
  let changed = false;
  if (next.bossesDefeated >= 3 && !next.shipsUnlocked.includes('vanguard')) {
    next.shipsUnlocked.push('vanguard');
    changed = true;
  }
  if (next.totalScore >= 50000 && !next.shipsUnlocked.includes('nova')) {
    next.shipsUnlocked.push('nova');
    changed = true;
  }
  if (changed) {
    next.shipsUnlocked = uniqueArray(next.shipsUnlocked);
  }
  return changed ? next : progress;
}

export function getMetaProgress() {
  return cloneProgress(readStoredProgress());
}

export function setMetaProgress(progress) {
  writeProgress(progress);
  return getMetaProgress();
}

export function updateMetaProgress(updater) {
  const current = readStoredProgress();
  const next = typeof updater === 'function' ? updater(cloneProgress(current)) : { ...current, ...(updater ?? {}) };
  const withUnlocks = applyAutomaticUnlocks(normaliseProgress(next));
  writeProgress(withUnlocks);
  return getMetaProgress();
}

export function recordRunEnd({ score = 0, bossesDefeated = 0 } = {}) {
  const numericScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const bossCount = Number.isFinite(bossesDefeated) ? Math.max(0, Math.floor(bossesDefeated)) : 0;
  return updateMetaProgress((progress) => {
    const next = cloneProgress(progress);
    next.totalRuns += 1;
    next.totalScore += numericScore;
    next.bossesDefeated += bossCount;
    return next;
  });
}

export function getEndlessPersonalBests() {
  const progress = readStoredProgress();
  return {
    score: Number.isFinite(progress.bestEndlessScore) ? progress.bestEndlessScore : 0,
    time: Number.isFinite(progress.bestEndlessTime) ? progress.bestEndlessTime : 0,
  };
}

export function recordEndlessResult({ score = 0, time = 0 } = {}) {
  const numericScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const numericTime = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
  const updated = updateMetaProgress((progress) => {
    const next = cloneProgress(progress);
    next.bestEndlessScore = Math.max(progress.bestEndlessScore ?? 0, numericScore);
    next.bestEndlessTime = Math.max(progress.bestEndlessTime ?? 0, numericTime);
    return next;
  });
  return {
    score: Number.isFinite(updated.bestEndlessScore) ? updated.bestEndlessScore : 0,
    time: Number.isFinite(updated.bestEndlessTime) ? updated.bestEndlessTime : 0,
  };
}

export function unlockShip(key) {
  if (typeof key !== 'string' || !key.trim()) {
    return getMetaProgress();
  }
  return updateMetaProgress((progress) => {
    const next = cloneProgress(progress);
    if (!next.shipsUnlocked.includes(key)) {
      next.shipsUnlocked.push(key);
    }
    return next;
  });
}

export function unlockPalette(key) {
  if (typeof key !== 'string' || !key.trim()) {
    return getMetaProgress();
  }
  const token = `palette:${key}`;
  return updateMetaProgress((progress) => {
    const next = cloneProgress(progress);
    if (!next.upgradesUnlocked.includes(token)) {
      next.upgradesUnlocked.push(token);
    }
    return next;
  });
}

export function isPaletteUnlocked(key) {
  if (typeof key !== 'string' || !key.trim()) {
    return true;
  }
  const token = `palette:${key}`;
  const progress = readStoredProgress();
  return progress.upgradesUnlocked.includes(token);
}

export function getUnlockedShips() {
  const progress = readStoredProgress();
  return progress.shipsUnlocked.slice();
}

export function isShipUnlocked(key) {
  if (typeof key !== 'string' || !key.trim()) {
    return false;
  }
  const progress = readStoredProgress();
  return progress.shipsUnlocked.includes(key);
}

export function setSelectedShip(key) {
  if (typeof key !== 'string' || !key.trim()) {
    return getSelectedShipKey();
  }
  const trimmed = key.trim();
  const progress = updateMetaProgress((current) => {
    const next = cloneProgress(current);
    if (next.shipsUnlocked.includes(trimmed)) {
      next.lastSelectedShip = trimmed;
    }
    return next;
  });
  return progress.lastSelectedShip;
}

export function getSelectedShipKey() {
  const progress = readStoredProgress();
  return progress.lastSelectedShip;
}

export function hasUnlockedPaletteToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return false;
  }
  const progress = readStoredProgress();
  return progress.upgradesUnlocked.includes(token.trim());
}

export function resetMetaProgress() {
  writeProgress({ ...DEFAULT_PROGRESS });
  return getMetaProgress();
}
