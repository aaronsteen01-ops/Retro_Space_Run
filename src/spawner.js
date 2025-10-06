// CHANGELOG: Added continuous enemy and asteroid spawn scheduler.

import { spawn } from './enemies.js';
import { GameEvents } from './events.js';

const spawner = {
  state: null,
  config: null,
  asteroidTimer: 0,
  waveTimer: 0,
  waveCount: 0,
  debug: false,
};

function getDebugFlag() {
  if (typeof window !== 'undefined' && typeof window.__rsrDebug !== 'undefined') {
    return Boolean(window.__rsrDebug);
  }
  return spawner.debug;
}

function rand(min, max) {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : lo;
  if (hi <= lo) {
    return lo;
  }
  return lo + Math.random() * (hi - lo);
}

function randInt(min, max) {
  return Math.round(rand(min, max));
}

function weightedPick(patterns = []) {
  const entries = patterns.filter((pattern) => pattern && pattern.entries?.length);
  if (!entries.length) {
    return null;
  }
  const totalWeight = entries.reduce((sum, pattern) => sum + Math.max(0.01, Number(pattern.weight) || 0), 0);
  let roll = Math.random() * totalWeight;
  for (const pattern of entries) {
    roll -= Math.max(0.01, Number(pattern.weight) || 0);
    if (roll <= 0) {
      return pattern;
    }
  }
  return entries[entries.length - 1];
}

function spawnAsteroidBatch(state, config = {}) {
  const { countRange, count, params = {}, intervalJitter = 0.35 } = config;
  const batchCount = Array.isArray(countRange)
    ? randInt(countRange[0], countRange[1])
    : Math.max(1, Math.round(Number.isFinite(count) ? count : 1));
  spawn(state, 'asteroid', { count: batchCount, ...params });
  if (getDebugFlag()) {
    console.log('[RSR][spawn] asteroid batch', { batchCount, params });
  }
  const baseInterval = Number.isFinite(config.interval) ? config.interval : 1.5;
  const jitter = baseInterval * intervalJitter;
  return Math.max(0.6, baseInterval + rand(-jitter, jitter));
}

function spawnWave(state, pattern) {
  if (!pattern || !Array.isArray(pattern.entries)) {
    return;
  }
  pattern.entries.forEach((entry) => {
    if (!entry?.type) {
      return;
    }
    spawn(state, entry.type, {
      count: entry.count,
      params: entry.params,
    });
  });
  spawner.waveCount += 1;
  if (getDebugFlag()) {
    console.log('[RSR][spawn] wave', { index: spawner.waveCount, pattern });
  }
  GameEvents.emit('wave:spawned', {
    index: spawner.waveCount,
    pattern,
  });
}

function resetTimers() {
  spawner.asteroidTimer = 0;
  spawner.waveTimer = 0;
  spawner.waveCount = 0;
}

export function configureSpawner(state) {
  spawner.state = state;
  spawner.debug = getDebugFlag();
}

export function startLevelSpawns(config) {
  if (!spawner.state) {
    return;
  }
  spawner.config = config;
  resetTimers();
  const asteroidCfg = config?.asteroids ?? {};
  const waveCfg = config?.waves ?? {};
  spawner.asteroidTimer = Number.isFinite(asteroidCfg.interval) ? asteroidCfg.interval : 1.5;
  spawner.waveTimer = Number.isFinite(waveCfg.initialDelay) ? waveCfg.initialDelay : 4;
  if (getDebugFlag()) {
    console.log('[RSR][spawn] start level', { config });
  }
}

export function stopLevelSpawns() {
  spawner.config = null;
  resetTimers();
}

export function tickSpawner(dt) {
  const state = spawner.state;
  if (!state || !spawner.config || !state.running || state.paused) {
    return;
  }
  const asteroidCfg = spawner.config.asteroids ?? {};
  const waveCfg = spawner.config.waves ?? {};
  if (asteroidCfg && state.lives > 0) {
    spawner.asteroidTimer -= dt;
    if (spawner.asteroidTimer <= 0) {
      spawner.asteroidTimer = spawnAsteroidBatch(state, asteroidCfg);
    }
  }
  if (waveCfg && state.lives > 0 && !state.boss && !state.bossSpawned) {
    spawner.waveTimer -= dt;
    if (spawner.waveTimer <= 0) {
      const pattern = weightedPick(waveCfg.patterns);
      if (pattern) {
        spawnWave(state, pattern);
      }
      const [minGap, maxGap] = Array.isArray(waveCfg.intervalRange)
        ? waveCfg.intervalRange
        : [waveCfg.interval ?? 8, (waveCfg.interval ?? 8) + 2];
      spawner.waveTimer = Math.max(4, rand(minGap, maxGap));
    }
  }
}

export function getSpawnConfig() {
  return spawner.config;
}

export function resetSpawner() {
  stopLevelSpawns();
  spawner.state = null;
}
