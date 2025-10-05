const STORAGE_KEY = 'retro-space-run.meta';

const DEFAULT_META = Object.freeze({
  highestUnlockedLevel: 1,
  bestScore: 0,
  preferredTheme: null,
  difficulty: 'normal',
  assist: false,
});

let cachedMeta = null;

function readRawMeta() {
  if (cachedMeta) {
    return cachedMeta;
  }
  if (typeof window === 'undefined') {
    cachedMeta = { ...DEFAULT_META };
    return cachedMeta;
  }
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (!stored) {
      cachedMeta = { ...DEFAULT_META };
      return cachedMeta;
    }
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object') {
      cachedMeta = { ...DEFAULT_META, ...parsed };
      return cachedMeta;
    }
  } catch (err) {
    // Ignore parse/storage errors and fall back to defaults.
  }
  cachedMeta = { ...DEFAULT_META };
  return cachedMeta;
}

function writeMeta(meta) {
  if (typeof window === 'undefined') {
    cachedMeta = { ...DEFAULT_META, ...meta };
    return;
  }
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch (err) {
    // Ignore persistence issues.
  }
  cachedMeta = meta;
}

function sanitiseMetaPatch(patch) {
  const normalised = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'highestUnlockedLevel')) {
    const raw = Number.parseInt(patch.highestUnlockedLevel, 10);
    if (Number.isFinite(raw) && raw >= 1) {
      normalised.highestUnlockedLevel = raw;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'bestScore')) {
    const raw = Number.parseInt(patch.bestScore, 10);
    if (Number.isFinite(raw) && raw >= 0) {
      normalised.bestScore = raw;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'preferredTheme')) {
    const raw = patch.preferredTheme;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      normalised.preferredTheme = raw;
    } else if (raw === null) {
      normalised.preferredTheme = null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'difficulty')) {
    const raw = patch.difficulty;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      normalised.difficulty = raw.trim();
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'assist')) {
    normalised.assist = Boolean(patch.assist);
  }
  return normalised;
}

export function getStoredMeta() {
  return { ...DEFAULT_META, ...readRawMeta() };
}

export function getMetaValue(key, fallback = null) {
  const meta = getStoredMeta();
  if (Object.prototype.hasOwnProperty.call(meta, key)) {
    return meta[key];
  }
  return fallback;
}

export function updateStoredMeta(patch) {
  const current = getStoredMeta();
  const updates = sanitiseMetaPatch(patch);
  if (!Object.keys(updates).length) {
    return current;
  }
  const next = { ...current, ...updates };
  writeMeta(next);
  return next;
}

export function resetStoredMeta() {
  writeMeta({ ...DEFAULT_META });
}
