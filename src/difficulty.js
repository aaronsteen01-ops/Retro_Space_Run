/**
 * difficulty.js — player-selectable global difficulty multipliers.
 */
// CHANGELOG: Added spawn configuration resolver and difficulty event emissions.

export const DIFFICULTY = Object.freeze({
  easy: { density: 0.85, speed: 0.9, hp: 0.9 },
  normal: { density: 1, speed: 1, hp: 1 },
  hard: { density: 1.25, speed: 1.1, hp: 1.1 },
});

import { getMetaValue, updateStoredMeta } from './storage.js';
import { GameEvents } from './events.js';

const DEFAULT_MODE = 'normal';
const listeners = new Set();

const DEFAULT_LEVEL_KEY = 'L1';

const BASE_SPAWN_CONFIG = Object.freeze({
  asteroids: {
    interval: 1.9,
    countRange: [1, 3],
    params: { vy: [70, 140], vx: [-40, 40] },
  },
  waves: {
    initialDelay: 3,
    intervalRange: [9, 11],
    patterns: [
      { weight: 1, entries: [{ type: 'strafer', count: 3, params: { fireCd: [900, 1300] } }] },
      { weight: 0.8, entries: [{ type: 'drone', count: 4, params: { steerAccel: 28 } }] },
      { weight: 0.6, entries: [{ type: 'asteroid', count: 6, params: { vy: [90, 160] } }] },
    ],
  },
});

const LEVEL_SPAWN_OVERRIDES = Object.freeze({
  L1: {
    asteroids: {
      interval: 1.7,
      countRange: [1, 3],
      params: { vy: [80, 150], vx: [-60, 60], radiusMin: 10, radiusMax: 22 },
    },
    waves: {
      initialDelay: 2.4,
      intervalRange: [8, 10],
      patterns: [
        { weight: 1, entries: [{ type: 'strafer', count: 3, params: { fireCd: [900, 1200] } }] },
        { weight: 0.9, entries: [{ type: 'drone', count: 4, params: { steerAccel: 28 } }] },
        { weight: 0.7, entries: [{ type: 'asteroid', count: 5, params: { vy: [80, 140] } }] },
        { weight: 0.6, entries: [{ type: 'turret', count: 1, params: { fireCd: [1400, 2000] } }] },
      ],
    },
  },
  L2: {
    asteroids: {
      interval: 1.4,
      countRange: [2, 3],
      params: { vy: [90, 170], vx: [-80, 80], radiusMin: 12, radiusMax: 26 },
    },
    waves: {
      initialDelay: 2.6,
      intervalRange: [7.2, 9],
      patterns: [
        { weight: 1.1, entries: [{ type: 'drone', count: 5, params: { steerAccel: 34 } }] },
        { weight: 0.8, entries: [{ type: 'strafer', count: 4, params: { fireCd: [800, 1200] } }] },
        { weight: 0.7, entries: [{ type: 'turret', count: 2, params: { fireCd: [1100, 1500], bulletSpeed: 260 } }] },
        { weight: 0.6, entries: [{ type: 'asteroid', count: 7, params: { vy: [100, 180] } }] },
      ],
    },
  },
  L4: {
    asteroids: {
      interval: 1.5,
      countRange: [2, 4],
      params: { vy: [90, 180], vx: [-60, 60], radiusMin: 12, radiusMax: 26 },
    },
    waves: {
      initialDelay: 2.4,
      intervalRange: [6.6, 8.6],
      patterns: [
        {
          weight: 1.1,
          entries: [
            { type: 'splitter', count: 2, params: { hp: 5, accel: 48, childRange: [2, 3], startOffset: [20, 120] } },
          ],
        },
        {
          weight: 1,
          entries: [
            { type: 'shield-drone', count: 1, params: { cooldown: 3400, duration: 3200, range: 200 } },
          ],
        },
        { weight: 0.9, entries: [{ type: 'drone', count: 5, params: { steerAccel: 38 } }] },
        { weight: 0.75, entries: [{ type: 'turret', count: 2, params: { fireCd: [900, 1300], bulletSpeed: 250 } }] },
        { weight: 0.65, entries: [{ type: 'strafer', count: 3, params: { fireCd: [760, 1150] } }] },
      ],
    },
  },
});

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function mergeSpawnConfig(base, override = {}) {
  const merged = cloneConfig(base);
  if (!override) {
    return merged;
  }
  if (override.asteroids) {
    merged.asteroids = {
      ...merged.asteroids,
      ...cloneConfig(override.asteroids),
      params: {
        ...cloneConfig(merged.asteroids.params ?? {}),
        ...cloneConfig(override.asteroids.params ?? {}),
      },
    };
  }
  if (override.waves) {
    merged.waves = {
      ...merged.waves,
      ...cloneConfig(override.waves),
    };
    if (override.waves.patterns) {
      merged.waves.patterns = override.waves.patterns.map((pattern) => cloneConfig(pattern));
    }
  }
  return merged;
}

function scaleValue(value, factor) {
  if (!Number.isFinite(value)) {
    return value;
  }
  return value * factor;
}

function scalePatternEntry(entry, density, speed) {
  const scaled = cloneConfig(entry);
  const count = Number.isFinite(entry.count) ? entry.count : 1;
  scaled.count = Math.max(1, Math.round(count * density));
  if (scaled.params) {
    if (Number.isFinite(scaled.params.speedMin)) {
      scaled.params.speedMin = scaleValue(scaled.params.speedMin, speed);
    }
    if (Number.isFinite(scaled.params.speedMax)) {
      scaled.params.speedMax = scaleValue(scaled.params.speedMax, speed);
    }
    if (Array.isArray(scaled.params.vy)) {
      scaled.params.vy = scaled.params.vy.map((v) => scaleValue(v, speed));
    }
    if (Array.isArray(scaled.params.fireCd)) {
      scaled.params.fireCd = scaled.params.fireCd.map((v) => Math.max(400, v / speed));
    }
  }
  return scaled;
}

function scaleSpawnConfig(config, mode) {
  const multipliers = DIFFICULTY[mode] ?? DIFFICULTY[DEFAULT_MODE];
  const density = Number.isFinite(multipliers?.density) ? multipliers.density : 1;
  const speed = Number.isFinite(multipliers?.speed) ? multipliers.speed : 1;
  const scaled = cloneConfig(config);
  if (scaled.asteroids) {
    if (Number.isFinite(scaled.asteroids.interval)) {
      scaled.asteroids.interval = Math.max(0.6, scaled.asteroids.interval / density);
    }
    if (Array.isArray(scaled.asteroids.countRange)) {
      scaled.asteroids.countRange = scaled.asteroids.countRange.map((value) =>
        Math.max(1, Math.round(value * density)),
      );
    } else if (Number.isFinite(scaled.asteroids.count)) {
      scaled.asteroids.count = Math.max(1, Math.round(scaled.asteroids.count * density));
    }
    if (scaled.asteroids.params) {
      if (Array.isArray(scaled.asteroids.params.vy)) {
        scaled.asteroids.params.vy = scaled.asteroids.params.vy.map((value) => scaleValue(value, speed));
      }
    }
  }
  if (scaled.waves) {
    if (Array.isArray(scaled.waves.intervalRange)) {
      scaled.waves.intervalRange = scaled.waves.intervalRange.map((value) => Math.max(4, value / density));
    }
    if (scaled.waves.patterns) {
      scaled.waves.patterns = scaled.waves.patterns.map((pattern) => {
        const weight = Number.isFinite(pattern.weight) ? pattern.weight : 1;
        return {
          ...pattern,
          weight,
          entries: Array.isArray(pattern.entries)
            ? pattern.entries.map((entry) => scalePatternEntry(entry, density, speed))
            : [],
        };
      });
    }
  }
  return scaled;
}

function resolveLevelKey(level) {
  if (!level) {
    return DEFAULT_LEVEL_KEY;
  }
  if (typeof level === 'string') {
    return level;
  }
  if (typeof level.key === 'string') {
    return level.key;
  }
  return DEFAULT_LEVEL_KEY;
}

export function getDifficultyConfig(mode = currentMode, level = DEFAULT_LEVEL_KEY) {
  const key = resolveLevelKey(level);
  const base = mergeSpawnConfig(BASE_SPAWN_CONFIG, LEVEL_SPAWN_OVERRIDES[key] ?? {});
  const scaled = scaleSpawnConfig(base, mode);
  return { ...scaled, difficulty: mode, level: key };
}

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
  GameEvents.emit('difficulty:changed', {
    mode,
    config: getDifficultyConfig(mode),
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

export function setDifficulty(mode, options) {
  return setDifficultyMode(mode, options);
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
