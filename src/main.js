/**
 * main.js — bootstraps Retro Space Run, orchestrating modules and the core game loop.
 */
import { rand, coll, addParticle } from './utils.js';
import {
  ctx,
  showOverlay,
  hideOverlay,
  showPauseOverlay,
  updateLives,
  updateScore,
  updateComboMultiplier,
  updateTime,
  updatePower,
  updateLevelChip,
  getActiveThemePalette,
  onThemeChange,
  getViewSize,
  getAssistMode,
  toggleAssistMode,
  onAssistChange,
  getAutoFire,
  toggleAutoFire,
  onAutoFireChange,
  setTheme,
  setGamepadIndicator,
  pulseMutatorIcon,
} from './ui.js';
import { playZap, playHit, toggleAudio, resumeAudioContext, playPow, playSfx, playBossDown } from './audio.js';
import { resetPlayer, updatePlayer, clampPlayerToBounds, drawPlayer } from './player.js';
import {
  spawn,
  updateEnemies,
  drawEnemies,
  spawnBoss,
  updateBoss,
  drawBoss,
  drawBossHealth,
  isPointInBossBeam,
} from './enemies.js';
import {
  resetPowerTimers,
  maybeSpawnPowerup,
  ensureGuaranteedPowerups,
  updatePowerups,
  drawPowerups,
  clearExpiredPowers,
  resetPowerState,
} from './powerups.js';
import {
  handlePlayerShooting,
  drawPlayerBullets,
  drawEnemyBullets,
  setupWeapons,
  updateWeaponDrops,
  drawWeaponDrops,
  maybeDropWeaponToken,
  ensureGuaranteedWeaponDrop,
  updateMuzzleFlashes,
  drawMuzzleFlashes,
  updateWeaponHud,
} from './weapons.js';
import { DEFAULT_THEME_KEY, DEFAULT_THEME_PALETTE, resolvePaletteSection } from './themes.js';
import { LEVELS } from './levels.js';
import { getDifficultyMode, getDifficultyMultipliers, onDifficultyModeChange } from './difficulty.js';
import { updateBullets, freeBullet, drainBullets } from './bullets.js';
import { getState as getInputState, onAction as onInputAction, clearInput, ACTIONS as INPUT_ACTIONS } from './input.js';
import {
  shakeScreen,
  updateEffects,
  getScreenShakeOffset,
  resetEffects,
  spawnExplosion,
  showToast,
  triggerDamagePulse,
  drawDamagePulse,
} from './effects.js';

let activePalette = getActiveThemePalette() ?? DEFAULT_THEME_PALETTE;

const DEFAULT_LEVEL = LEVELS[0] ?? null;

const PROGRESS_STORAGE_KEY = 'retro-space-run.highest-level';

const MAX_WIND_DRIFT = 80;

const COMBO_DECAY_DELAY = 3.5;
const COMBO_MAX_VALUE = 20;
const COMBO_STEP = 0.1;
const COMBO_MAX_MULTIPLIER = 3;
const PASSIVE_SCORE_RATE = 30;

function defaultStarfieldConfig() {
  return {
    density: 1,
    depthRange: [0.4, 1.6],
    sizeRange: [1.4, 2.4],
    twinkle: { amplitude: 0.22, speed: 1.1 },
    baseAlpha: 0.42,
    brightThreshold: 1.18,
    brightBoost: 1.4,
    windFactor: 0.04,
    scrollSpeed: 60,
    scrollSpeedFactor: 0.05,
  };
}

function mergeStarfieldConfig(overrides = {}) {
  const defaults = defaultStarfieldConfig();
  const sizeRange = Array.isArray(overrides.sizeRange) && overrides.sizeRange.length >= 2
    ? overrides.sizeRange
    : defaults.sizeRange;
  const depthRange = Array.isArray(overrides.depthRange) && overrides.depthRange.length >= 2
    ? overrides.depthRange
    : defaults.depthRange;
  const twinkleDefaults = defaults.twinkle ?? {};
  const twinkleOverrides = overrides.twinkle ?? {};
  const twinkleAmplitude = Number.isFinite(twinkleOverrides.amplitude)
    ? Math.max(0, twinkleOverrides.amplitude)
    : twinkleDefaults.amplitude;
  const twinkleSpeed = Number.isFinite(twinkleOverrides.speed)
    ? Math.max(0, twinkleOverrides.speed)
    : twinkleDefaults.speed;
  return {
    ...defaults,
    ...overrides,
    density: Number.isFinite(overrides.density) ? Math.max(0.2, overrides.density) : defaults.density,
    baseAlpha: Number.isFinite(overrides.baseAlpha) ? Math.max(0.05, overrides.baseAlpha) : defaults.baseAlpha,
    brightThreshold: Number.isFinite(overrides.brightThreshold)
      ? Math.max(0.1, overrides.brightThreshold)
      : defaults.brightThreshold,
    brightBoost: Number.isFinite(overrides.brightBoost)
      ? Math.max(1, overrides.brightBoost)
      : defaults.brightBoost,
    windFactor: Number.isFinite(overrides.windFactor) ? overrides.windFactor : defaults.windFactor,
    scrollSpeed: Number.isFinite(overrides.scrollSpeed) ? Math.max(0, overrides.scrollSpeed) : defaults.scrollSpeed,
    scrollSpeedFactor: Number.isFinite(overrides.scrollSpeedFactor)
      ? Math.max(0, overrides.scrollSpeedFactor)
      : defaults.scrollSpeedFactor,
    sizeRange: [
      Math.max(0.2, sizeRange[0]),
      Math.max(Math.max(0.2, sizeRange[0]), sizeRange[1]),
    ],
    depthRange: [
      Math.max(0.05, depthRange[0]),
      Math.max(Math.max(0.05, depthRange[0]), depthRange[1]),
    ],
    twinkle: {
      amplitude: twinkleAmplitude,
      speed: twinkleSpeed,
    },
  };
}

function readHighestUnlockedLevel() {
  try {
    const stored = window.localStorage?.getItem(PROGRESS_STORAGE_KEY);
    const parsed = Number.parseInt(stored ?? '', 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed;
    }
  } catch (err) {
    /* ignore storage access issues */
  }
  return 1;
}

function writeHighestUnlockedLevel(value) {
  try {
    window.localStorage?.setItem(PROGRESS_STORAGE_KEY, String(value));
  } catch (err) {
    /* ignore storage access issues */
  }
}

let highestUnlockedLevel = Math.max(1, Math.min(LEVELS.length, readHighestUnlockedLevel()));

function unlockLevel(levelIndex) {
  const capped = Math.max(1, Math.min(LEVELS.length, Math.floor(levelIndex)));
  if (capped > highestUnlockedLevel) {
    highestUnlockedLevel = capped;
    writeHighestUnlockedLevel(capped);
  }
}

const state = {
  running: false,
  paused: false,
  levelDur: DEFAULT_LEVEL?.duration ?? 0,
  levelIndex: 1,
  level: DEFAULT_LEVEL,
  nextWaveIndex: 0,
  time: 0,
  levelStartScore: 0,
  levelStartTime: 0,
  levelStartLives: 3,
  levelStartWeapon: null,
  score: 0,
  lives: 3,
  combo: { value: 0, decayTimer: 0, multiplier: 1 },
  passiveScoreCarry: 0,
  difficultyMode: getDifficultyMode(),
  difficulty: getDifficultyMultipliers(),
  player: null,
  bullets: [],
  enemies: [],
  enemyBullets: [],
  particles: [],
  windStrands: [],
  powerups: [],
  weaponDrops: [],
  weaponDropSecured: false,
  muzzleFlashes: [],
  weaponPickupFlash: null,
  levelOverlay: null,
  restartPromptVisible: false,
  starfield: mergeStarfieldConfig(),
  stars: [],
  finishGate: null,
  boss: null,
  bossSpawned: false,
  bossDefeatedAt: 0,
  bossMercyUntil: 0,
  lastShot: 0,
  shotDelay: 180,
  speed: 260,
  power: { name: null, until: 0 },
  powerupsGrantedL1: 0,
  lastGuaranteedPowerup: null,
  weapon: null,
  theme: activePalette,
  assistEnabled: getAssistMode(),
  settings: {
    autoFire: getAutoFire(),
  },
  levelContext: { enemyWeights: {}, mutators: {}, themeKey: null },
  weather: { windX: 0, windDrift: 0, squall: null },
  levelIntroTimeout: null,
};

function getComboState() {
  if (!state.combo) {
    state.combo = { value: 0, decayTimer: 0, multiplier: 1 };
  }
  return state.combo;
}

function computeComboMultiplier(value = 0) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(COMBO_MAX_VALUE, value)) : 0;
  const raw = 1 + safeValue * COMBO_STEP;
  return Math.min(COMBO_MAX_MULTIPLIER, raw);
}

function applyComboValue(value, { allowHighlight = false } = {}) {
  const comboState = getComboState();
  const prevMultiplier = comboState.multiplier ?? computeComboMultiplier(comboState.value ?? 0);
  const safeValue = Math.max(0, Math.min(COMBO_MAX_VALUE, Number.isFinite(value) ? value : comboState.value || 0));
  comboState.value = safeValue;
  comboState.decayTimer = safeValue > 0 ? COMBO_DECAY_DELAY : 0;
  if (safeValue <= 0) {
    state.passiveScoreCarry = 0;
  }
  const newMultiplier = computeComboMultiplier(safeValue);
  comboState.multiplier = newMultiplier;
  const highlight = allowHighlight && newMultiplier > prevMultiplier + 0.001;
  updateComboMultiplier(newMultiplier, { highlight });
}

function incrementCombo() {
  const comboState = getComboState();
  applyComboValue((comboState.value ?? 0) + 1, { allowHighlight: true });
}

function resetCombo() {
  applyComboValue(0);
}

function updateComboTimer(dt) {
  const comboState = getComboState();
  if (comboState.value <= 0) {
    return;
  }
  comboState.decayTimer -= dt;
  if (comboState.decayTimer <= 0) {
    applyComboValue(0);
  }
}

function getScoreMultiplier() {
  const comboState = getComboState();
  return comboState.multiplier ?? computeComboMultiplier(comboState.value ?? 0);
}

function addScore(basePoints, { allowFraction = false } = {}) {
  const numericBase = Number(basePoints);
  if (!Number.isFinite(numericBase) || numericBase <= 0) {
    return 0;
  }
  const multiplier = getScoreMultiplier();
  if (allowFraction) {
    state.passiveScoreCarry = (state.passiveScoreCarry ?? 0) + numericBase * multiplier;
    const whole = Math.floor(state.passiveScoreCarry);
    if (whole > 0) {
      state.passiveScoreCarry -= whole;
      state.score += whole;
      updateScore(state.score);
    }
    return whole;
  }
  const awarded = Math.max(0, Math.round(numericBase * multiplier));
  if (awarded > 0) {
    state.score += awarded;
    updateScore(state.score);
  }
  return awarded;
}

state.addScore = addScore;

onDifficultyModeChange((mode) => {
  state.difficultyMode = mode;
  state.difficulty = getDifficultyMultipliers(mode);
});

onThemeChange((_, palette) => {
  activePalette = palette ?? DEFAULT_THEME_PALETTE;
  state.theme = activePalette;
});

onAssistChange((enabled) => {
  state.assistEnabled = enabled;
});

onAutoFireChange((enabled) => {
  state.settings.autoFire = enabled;
});

onInputAction(INPUT_ACTIONS.ASSIST, () => {
  toggleAssistMode();
});

onInputAction(INPUT_ACTIONS.AUTO_FIRE, () => {
  toggleAutoFire();
});

onInputAction(INPUT_ACTIONS.PAUSE, () => {
  if (!state.running) {
    return;
  }
  if (state.restartPromptVisible) {
    state.restartPromptVisible = false;
    hideOverlay();
    state.paused = false;
    clearInput();
    return;
  }
  state.paused = !state.paused;
  if (state.paused) {
    showPauseOverlay();
  } else {
    hideOverlay();
  }
});

onInputAction(INPUT_ACTIONS.RESTART, () => {
  if (!state.running || state.restartPromptVisible) {
    return;
  }
  if (!state.level) {
    return;
  }
  state.paused = true;
  clearInput();
  promptLevelRestart();
});

onInputAction(INPUT_ACTIONS.MUTE, () => {
  if (!state.running) {
    return;
  }
  toggleAudio();
});

onInputAction(INPUT_ACTIONS.FULLSCREEN, () => {
  if (!state.running) {
    return;
  }
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

let lastGamepadIndicatorState = false;

function syncGamepadIndicator(connected) {
  const isConnected = Boolean(connected);
  if (isConnected === lastGamepadIndicatorState) {
    return;
  }
  lastGamepadIndicatorState = isConnected;
  setGamepadIndicator(isConnected);
}

syncGamepadIndicator(false);

window.addEventListener('click', () => {
  resumeAudioContext();
});

function spawnStars() {
  state.stars.length = 0;
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const starfield = state.starfield ?? mergeStarfieldConfig();
  const density = Number.isFinite(starfield.density) ? Math.max(0.2, starfield.density) : 1;
  const baseCount = Math.ceil((viewW * viewH) / 9000);
  const count = Math.max(1, Math.floor(baseCount * density));
  const [depthMin, depthMax] = starfield.depthRange ?? [0.4, 1.6];
  const [sizeMin, sizeMax] = starfield.sizeRange ?? [1.4, 2.4];
  const twinkle = starfield.twinkle ?? {};
  const twinkleAmplitude = Number.isFinite(twinkle.amplitude) ? Math.max(0, twinkle.amplitude) : 0;
  const twinkleSpeed = Number.isFinite(twinkle.speed) ? Math.max(0, twinkle.speed) : 0;
  for (let i = 0; i < count; i++) {
    const depth = rand(depthMin, depthMax);
    const amplitude = twinkleAmplitude ? rand(twinkleAmplitude * 0.6, twinkleAmplitude * 1.2) : 0;
    state.stars.push({
      x: rand(0, viewW),
      y: rand(0, viewH),
      z: depth,
      size: rand(sizeMin, sizeMax),
      twinklePhase: rand(0, Math.PI * 2),
      twinkleSpeed: twinkleSpeed ? rand(twinkleSpeed * 0.75, twinkleSpeed * 1.25) : 0,
      twinkleAmplitude: amplitude,
    });
  }
  spawnWindStrands();
}

function spawnWindStrands() {
  state.windStrands.length = 0;
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  if (viewW <= 0 || viewH <= 0) {
    return;
  }
  const area = viewW * viewH;
  const baseCount = Math.max(6, Math.floor(area / 90000));
  const windMagnitude = Number.isFinite(state.weather?.windX) ? Math.abs(state.weather.windX) : 0;
  if (windMagnitude < 0.5) {
    return;
  }
  const emphasis = Math.max(0.6, Math.min(1.4, windMagnitude / 40 + 0.6));
  const count = Math.max(6, Math.floor(baseCount * emphasis));
  for (let i = 0; i < count; i++) {
    const depth = rand(0.45, 1.1);
    state.windStrands.push({
      x: rand(0, viewW),
      y: rand(0, viewH),
      speed: rand(90, 160) * depth,
      jitter: rand(-14, 14),
      length: rand(26, 46) * depth,
      alpha: rand(0.08, 0.18) * depth,
      depth,
    });
  }
}

window.addEventListener('resize', () => {
  spawnStars();
  if (state.player) {
    clampPlayerToBounds(state.player);
  }
  if (state.finishGate) {
    const { w } = getViewSize();
    state.finishGate.x = Math.max(w, 1) / 2;
  }
});

function ensureFinishGate() {
  if (state.finishGate) {
    return;
  }
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  state.finishGate = {
    x: viewW / 2,
    y: -200,
    vy: 80,
    w: 240,
    h: 12,
  };
}

function drawGate(gate, palette) {
  const gatePalette = resolvePaletteSection(palette, 'gate');
  ctx.save();
  ctx.translate(gate.x, gate.y);
  const glow = (Math.sin(performance.now() * 0.003) + 1) * 0.5;
  ctx.shadowColor = gatePalette.glow;
  ctx.shadowBlur = 20 + 20 * glow;
  ctx.fillStyle = gatePalette.fill;
  ctx.fillRect(-gate.w / 2, -gate.h / 2, gate.w, gate.h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = gatePalette.strut;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-gate.w / 2, -40);
  ctx.lineTo(-gate.w / 2, 40);
  ctx.moveTo(gate.w / 2, -40);
  ctx.lineTo(gate.w / 2, 40);
  ctx.stroke();
  ctx.restore();
}

function resolveSquallConfig(setting) {
  if (!setting) {
    return null;
  }
  const defaults = {
    intervalMin: 10,
    intervalMax: 14,
    duration: 1.2,
    dimFactor: 0.8,
    playerSpread: 140,
    enemySpread: 28,
    enemySpreadMultiplier: 1.3,
  };
  if (typeof setting === 'object') {
    const interval = Array.isArray(setting.interval) && setting.interval.length >= 2
      ? setting.interval
      : null;
    const rawIntervalMin = interval ? Number(interval[0]) : Number(setting.intervalMin);
    const rawIntervalMax = interval ? Number(interval[1]) : Number(setting.intervalMax);
    if (Number.isFinite(rawIntervalMin)) {
      defaults.intervalMin = Math.max(1, rawIntervalMin);
    }
    if (Number.isFinite(rawIntervalMax)) {
      defaults.intervalMax = Math.max(defaults.intervalMin, rawIntervalMax);
    }
    if (Number.isFinite(setting.duration)) {
      defaults.duration = Math.max(0.2, setting.duration);
    }
    if (Number.isFinite(setting.dimFactor)) {
      const rawDim = Math.max(0.15, Math.min(1, setting.dimFactor));
      defaults.dimFactor = rawDim;
    }
    const spreadSource = Number.isFinite(setting.playerSpread)
      ? setting.playerSpread
      : Number.isFinite(setting.spread)
        ? setting.spread
        : null;
    if (Number.isFinite(spreadSource)) {
      defaults.playerSpread = Math.max(0, spreadSource);
    }
    if (Number.isFinite(setting.enemySpread)) {
      defaults.enemySpread = Math.max(0, setting.enemySpread);
    } else if (spreadSource !== null) {
      defaults.enemySpread = Math.max(0, defaults.playerSpread * 0.2);
    }
    const spreadMultiplierSource = Number.isFinite(setting.enemySpreadMultiplier)
      ? setting.enemySpreadMultiplier
      : Number.isFinite(setting.spreadMultiplier)
        ? setting.spreadMultiplier
        : null;
    if (Number.isFinite(spreadMultiplierSource)) {
      defaults.enemySpreadMultiplier = Math.max(1, spreadMultiplierSource);
    }
  }
  return defaults;
}

function applyLevelMutators(mutators = {}) {
  const wind = Number.isFinite(mutators.windX) ? mutators.windX : 0;
  const drift = Math.max(-MAX_WIND_DRIFT, Math.min(MAX_WIND_DRIFT, wind));
  state.weather.windX = wind;
  state.weather.windDrift = drift;
  spawnWindStrands();
  const squallConfig = resolveSquallConfig(mutators.squalls);
  if (squallConfig) {
    const {
      intervalMin,
      intervalMax,
      duration,
      dimFactor,
      playerSpread,
      enemySpread,
      enemySpreadMultiplier,
    } = squallConfig;
    state.weather.squall = {
      active: false,
      intervalMin,
      intervalMax,
      duration,
      nextAt: rand(intervalMin, intervalMax),
      startedAt: 0,
      endsAt: 0,
      dimFactor,
      playerSpread,
      enemySpread,
      enemySpreadMultiplier,
    };
  } else {
    state.weather.squall = null;
  }
}

function updateWeather() {
  const squall = state.weather?.squall;
  if (!squall) {
    return;
  }
  const time = state.time;
  if (!squall.active && time >= squall.nextAt) {
    squall.active = true;
    squall.startedAt = time;
    squall.endsAt = time + squall.duration;
    squall.justActivated = true;
  } else if (squall.active && time >= squall.endsAt) {
    squall.active = false;
    squall.startedAt = time;
    squall.nextAt = time + rand(squall.intervalMin, squall.intervalMax);
    squall.justDeactivated = true;
  }
}

function clearLevelEntities() {
  resetCombo();
  state.passiveScoreCarry = 0;
  drainBullets(state.bullets);
  drainBullets(state.enemyBullets);
  state.enemies.length = 0;
  state.powerups.length = 0;
  state.weaponDrops.length = 0;
  state.muzzleFlashes.length = 0;
  state.particles.length = 0;
  state.finishGate = null;
  state.boss = null;
  state.bossSpawned = false;
  state.bossDefeatedAt = 0;
  state.bossMercyUntil = 0;
  state.weaponDropSecured = false;
  state.powerupsGrantedL1 = 0;
  state.lastGuaranteedPowerup = null;
  state.weaponPickupFlash = null;
  state.lastShot = 0;
  state.power = { name: null, until: 0 };
  state.restartPromptVisible = false;
  resetPowerState(state);
  resetPowerTimers();
  resetEffects();
  spawnStars();
  resetPlayer(state);
  updatePower('None');
  updateTime(0);
}

function resetGame(levelIndex = state.levelIndex) {
  const fallbackIndex = Number.isFinite(levelIndex) ? levelIndex : state.levelIndex;
  const targetLevelIndex = Math.max(1, Math.min(LEVELS.length, Math.floor(fallbackIndex || 1)));
  const startScore = Number.isFinite(state.levelStartScore) ? state.levelStartScore : state.score;
  const startLives = Number.isFinite(state.levelStartLives) ? state.levelStartLives : state.lives;
  const startWeapon = state.levelStartWeapon ? { ...state.levelStartWeapon } : null;
  state.score = startScore;
  state.lives = startLives;
  state.passiveScoreCarry = 0;
  resetCombo();
  updateScore(state.score);
  updateLives(state.lives);
  if (startWeapon) {
    state.weapon = { ...startWeapon };
  } else {
    setupWeapons(state);
  }
  state.restartPromptVisible = false;
  state.running = false;
  state.paused = false;
  hideOverlay();
  clearInput();
  startLevel(targetLevelIndex);
}

function promptLevelRestart() {
  if (!state.level) {
    return;
  }
  const levelName = state.level?.name;
  const levelLabel = levelName ? `Level ${state.levelIndex}: ${levelName}` : `Level ${state.levelIndex}`;
  state.restartPromptVisible = true;
  showOverlay(`
    <h1>Restart Level?</h1>
    <p>Restart <strong>${levelLabel}</strong> from the beginning?</p>
    <div class="overlay-actions">
      <button id="confirm-restart" class="btn" autofocus>Restart</button>
      <button id="cancel-restart" class="btn btn-secondary">Resume</button>
    </div>
  `);
  const confirm = document.getElementById('confirm-restart');
  confirm?.addEventListener('click', () => {
    state.restartPromptVisible = false;
    resetGame(state.levelIndex);
  });
  const cancel = document.getElementById('cancel-restart');
  cancel?.addEventListener('click', () => {
    state.restartPromptVisible = false;
    hideOverlay();
    state.paused = false;
    clearInput();
  });
}

function configureLevelContext(level) {
  state.levelContext = {
    enemyWeights: level?.enemyWeights ?? {},
    mutators: level?.mutators ?? {},
    themeKey: level?.theme ?? null,
  };
  applyLevelMutators(state.levelContext.mutators);
}

function normaliseOverlayTint(tint) {
  if (typeof tint !== 'string') {
    return null;
  }
  const trimmed = tint.trim();
  if (!trimmed) {
    return null;
  }
  const rgbaMatch = trimmed.match(/^rgba?\((.+)\)$/i);
  if (!rgbaMatch) {
    return { colour: trimmed, alpha: 1 };
  }
  const parts = rgbaMatch[1]
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (parts.length < 3) {
    return { colour: trimmed, alpha: 1 };
  }
  const rgbValues = parts.slice(0, 3).map((value) => Number.parseFloat(value));
  const hasNumericRgb = rgbValues.every((value) => Number.isFinite(value));
  const colour = hasNumericRgb
    ? `rgb(${rgbValues.map((value) => Math.max(0, value)).join(', ')})`
    : trimmed;
  const rawAlpha = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
  const alpha = Number.isFinite(rawAlpha) ? Math.max(0, Math.min(1, rawAlpha)) : 1;
  return { colour, alpha };
}

function resolveMutatorDescriptors(mutators = {}) {
  if (!mutators) {
    return [];
  }
  const descriptors = [];
  const wind = Number.isFinite(mutators.windX) ? mutators.windX : 0;
  if (Math.abs(wind) >= 1) {
    const direction = wind > 0 ? 'right' : 'left';
    const icon = direction === 'right' ? '→' : '←';
    const descriptor = wind > 0 ? 'Solar Wind →' : 'Solar Wind ←';
    const magnitude = Math.abs(Math.round(wind));
    const label = magnitude ? `${descriptor} ${magnitude}` : descriptor;
    descriptors.push({ icon, label, kind: 'wind', direction });
  }
  if (mutators.squalls) {
    descriptors.push({ icon: '⟲', label: 'Ion Squalls', kind: 'squall' });
  }
  return descriptors;
}

function levelIntro(level) {
  if (state.levelIntroTimeout) {
    clearTimeout(state.levelIntroTimeout);
    state.levelIntroTimeout = null;
  }
  const themeKey = state.levelContext?.themeKey ?? level?.theme ?? DEFAULT_THEME_KEY;
  if (themeKey) {
    setTheme(themeKey, { persist: false });
  }
  const palette = getActiveThemePalette() ?? DEFAULT_THEME_PALETTE;
  state.theme = palette;
  const overlayTint = normaliseOverlayTint(level?.overlays?.tint);
  state.levelOverlay = overlayTint && overlayTint.alpha > 0 ? overlayTint : null;
  const starfieldOverrides = level?.starfield ?? {};
  state.starfield = mergeStarfieldConfig(starfieldOverrides);
  clearLevelEntities();
  const mutatorDescriptors = resolveMutatorDescriptors(level?.mutators);
  updateLevelChip({
    levelIndex: state.levelIndex,
    name: level?.name ?? null,
    mutators: mutatorDescriptors,
  });
  const overlayName = level?.name ?? `Level ${state.levelIndex}`;
  const mutatorMarkup = mutatorDescriptors.length
    ? mutatorDescriptors
        .map((entry) => `<span class="level-card__mutator" title="${entry.label}" aria-label="${entry.label}">${entry.icon}</span>`)
        .join(' ')
    : '<span class="level-card__mutator" title="Standard Conditions" aria-label="Standard Conditions">✅</span>';
  showOverlay(`
    <div class="level-card" role="status" aria-live="polite">
      <p class="level-card__label">Level ${state.levelIndex}</p>
      <h1>${overlayName}</h1>
      <div class="level-card__mutators" role="presentation">
        ${mutatorMarkup}
      </div>
    </div>
  `);
  state.levelIntroTimeout = window.setTimeout(() => {
    hideOverlay();
    state.levelIntroTimeout = null;
  }, 1600);
}

function pickReplacementType(originalType, weights) {
  const entries = Object.entries(weights || {})
    .filter(([type, weight]) => type !== originalType && Number.isFinite(weight) && weight > 0)
    .map(([type, weight]) => [type, weight]);
  if (!entries.length) {
    return null;
  }
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  if (total <= 0) {
    return null;
  }
  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) {
      return type;
    }
  }
  return entries[entries.length - 1][0];
}

function resolveWaveType(waveType, weights) {
  const baseWeight = Number.isFinite(weights?.[waveType]) ? weights[waveType] : 1;
  if (baseWeight > 1) {
    return waveType;
  }
  if (baseWeight <= 0) {
    return pickReplacementType(waveType, weights);
  }
  if (Math.random() <= Math.min(1, baseWeight)) {
    return waveType;
  }
  const replacement = pickReplacementType(waveType, weights);
  if (replacement) {
    return replacement;
  }
  return null;
}

function normaliseWaveParams(params = {}) {
  const resolved = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value) && value.length >= 2) {
      const [minRaw, maxRaw] = value;
      const min = Number.isFinite(minRaw) ? minRaw : Number.parseFloat(minRaw);
      const max = Number.isFinite(maxRaw) ? maxRaw : Number.parseFloat(maxRaw);
      resolved[`${key}Min`] = Number.isFinite(min) ? min : minRaw;
      resolved[`${key}Max`] = Number.isFinite(max) ? max : maxRaw;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function drawSquallOverlay(viewW, viewH, palette) {
  const squall = state.weather?.squall;
  if (!squall?.active) {
    return;
  }
  const elapsed = Math.max(0, state.time - (squall.startedAt ?? 0));
  const progress = squall.duration > 0 ? Math.min(1, elapsed / squall.duration) : 1;
  const pulse = Math.sin(progress * Math.PI);
  const weather = resolvePaletteSection(palette, 'weather');
  const squallPalette = weather?.squall ?? {};
  const top = squallPalette.top ?? 'transparent';
  const mid = squallPalette.mid ?? top;
  const bottom = squallPalette.bottom ?? mid;
  const bandColour = squallPalette.band ?? mid;
  const gradientBase = Number.isFinite(squallPalette.gradientBase) ? squallPalette.gradientBase : 0.12;
  const gradientPulse = Number.isFinite(squallPalette.gradientPulse) ? squallPalette.gradientPulse : 0.25;
  const bandAlphaBase = Number.isFinite(squallPalette.bandAlpha) ? squallPalette.bandAlpha : 0.18;
  const bandPulse = Number.isFinite(squallPalette.bandPulse) ? squallPalette.bandPulse : 0.2;
  const hatchColour = squallPalette.hatch ?? 'rgba(255, 255, 255, 0.22)';
  const hatchAlphaBase = Number.isFinite(squallPalette.hatchAlpha) ? squallPalette.hatchAlpha : 0.18;
  const hatchPulse = Number.isFinite(squallPalette.hatchPulse) ? squallPalette.hatchPulse : 0.24;
  const hatchSpacing = Number.isFinite(squallPalette.hatchSpacing) ? squallPalette.hatchSpacing : 38;
  const hatchWidth = Number.isFinite(squallPalette.hatchWidth) ? squallPalette.hatchWidth : 2.2;
  ctx.save();
  const gradientAlpha = Math.max(0, Math.min(1, gradientBase + pulse * gradientPulse));
  ctx.globalAlpha = gradientAlpha;
  const gradient = ctx.createLinearGradient(0, 0, viewW, viewH * 0.6);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.45, mid);
  gradient.addColorStop(0.8, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.globalCompositeOperation = 'lighter';
  const hatchAlpha = Math.max(0, Math.min(1, hatchAlphaBase + pulse * hatchPulse));
  if (hatchAlpha > 0.02) {
    ctx.globalAlpha = hatchAlpha;
    ctx.strokeStyle = hatchColour;
    ctx.lineWidth = hatchWidth;
    ctx.beginPath();
    for (let x = -viewH; x < viewW + viewH; x += hatchSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + viewH * 0.85, viewH);
    }
    ctx.stroke();
  }
  const bandAlpha = Math.max(0, Math.min(1, bandAlphaBase + pulse * bandPulse));
  ctx.globalAlpha = bandAlpha;
  ctx.fillStyle = bandColour;
  ctx.fillRect(0, viewH * 0.15, viewW, 4);
  ctx.fillRect(0, viewH * 0.35, viewW, 3);
  ctx.fillRect(0, viewH * 0.55, viewW, 4);
  ctx.restore();
}

function spawnWaveFromSchedule(wave) {
  if (!wave || !wave.type) {
    return;
  }
  const weights = state.levelContext?.enemyWeights ?? {};
  const resolvedType = resolveWaveType(wave.type, weights);
  if (!resolvedType) {
    return;
  }
  const params = normaliseWaveParams(wave.params ?? {});
  if (Array.isArray(wave.countRange) && wave.countRange.length >= 2) {
    params.countRange = wave.countRange.slice();
  } else if (Number.isFinite(wave.count)) {
    params.count = wave.count;
  }
  spawn(state, resolvedType, params);
}

function scheduleLevelWaves() {
  const level = state.level;
  if (!level || state.boss || state.bossSpawned) {
    return;
  }
  while (state.nextWaveIndex < level.waves.length) {
    const wave = level.waves[state.nextWaveIndex];
    if (!wave || state.time < wave.at) {
      break;
    }
    spawnWaveFromSchedule(wave);
    state.nextWaveIndex += 1;
  }
}

function startLevel(levelIndex) {
  const targetLevel = LEVELS[levelIndex - 1] ?? DEFAULT_LEVEL;
  if (!targetLevel) {
    return;
  }
  state.levelIndex = levelIndex;
  state.level = targetLevel;
  state.levelDur = targetLevel?.duration ?? 0;
  state.nextWaveIndex = 0;
  state.time = 0;
  state.levelStartScore = state.score;
  state.levelStartTime = performance.now();
  state.levelStartLives = state.lives;
  state.levelStartWeapon = state.weapon ? { ...state.weapon } : null;
  state.passiveScoreCarry = 0;
  resetCombo();
  configureLevelContext(targetLevel);
  levelIntro(targetLevel);
  updateScore(state.score);
  updateLives(state.lives);
  updateWeaponHud(state);
  clearInput();
  state.running = true;
  state.paused = false;
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function startRun(levelIndex = 1) {
  state.difficultyMode = getDifficultyMode();
  state.difficulty = getDifficultyMultipliers(state.difficultyMode);
  state.assistEnabled = getAssistMode();
  state.lives = state.assistEnabled ? 4 : 3;
  state.score = 0;
  state.levelStartScore = 0;
  state.levelStartTime = performance.now();
  state.passiveScoreCarry = 0;
  resetCombo();
  updateLives(state.lives);
  updateScore(state.score);
  setupWeapons(state);
  const nextLevel = Math.max(1, Math.min(LEVELS.length, Math.floor(levelIndex)));
  startLevel(nextLevel);
}

function completeLevel() {
  state.running = false;
  state.paused = false;
  const levelTime = Math.floor(state.time);
  const scoreDelta = state.score - (state.levelStartScore ?? 0);
  const nextLevelIndex = state.levelIndex + 1;
  const currentLevel = state.level;
  applyLevelMutators({});
  clearLevelEntities();
  updateScore(state.score);
  updateLives(state.lives);
  if (nextLevelIndex <= LEVELS.length) {
    unlockLevel(nextLevelIndex);
  }
  const nextLevel = LEVELS[nextLevelIndex - 1] ?? null;
  const header = `LEVEL ${state.levelIndex} COMPLETE`;
  const restartLabel = `Restart Level ${state.levelIndex}`;
  const continueButton = nextLevel
    ? `<button id="next-level-btn" class="btn">Continue to L${nextLevelIndex}: ${nextLevel.name}</button>`
    : '';
  showOverlay(`
    <h1><span class="cyan">${header}</span></h1>
    <p>${currentLevel?.name ?? 'Sector'} cleared in <strong>${levelTime}s</strong>.</p>
    <p>Score gained: <strong>${Math.max(0, scoreDelta)}</strong> · Total Score: <strong>${state.score}</strong></p>
    <div class="overlay-actions">
      <button id="restart-level" class="btn" autofocus>${restartLabel}</button>
      <button id="summary-menu" class="btn btn-secondary">Menu</button>
      ${continueButton}
    </div>
  `);
  const restart = document.getElementById('restart-level');
  restart?.addEventListener('click', () => {
    resetGame(state.levelIndex);
  });
  const select = document.getElementById('summary-menu');
  select?.addEventListener('click', () => {
    renderStartOverlay();
  });
  if (nextLevel) {
    const nextBtn = document.getElementById('next-level-btn');
    nextBtn?.addEventListener('click', () => {
      startLevel(nextLevelIndex);
    });
  }
}

function gameOver() {
  state.running = false;
  state.paused = false;
  const levelTime = Math.floor(state.time);
  const scoreDelta = state.score - (state.levelStartScore ?? 0);
  const levelName = state.level?.name ?? 'Sector';
  applyLevelMutators({});
  clearLevelEntities();
  updateScore(state.score);
  updateLives(state.lives);
  showOverlay(`
    <h1><span class="heart">SHIP DESTROYED</span></h1>
    <p>Level ${state.levelIndex}: ${levelName} after <strong>${levelTime}s</strong>.</p>
    <p>Score this run: <strong>${state.score}</strong> · Level gain: <strong>${Math.max(0, scoreDelta)}</strong></p>
    <div class="overlay-actions">
      <button id="restart-level" class="btn" autofocus>Restart Level ${state.levelIndex}</button>
      <button id="overlay-menu" class="btn btn-secondary">Menu</button>
    </div>
  `);
  document.getElementById('restart-level')?.addEventListener('click', () => {
    startRun(state.levelIndex);
  });
  document.getElementById('overlay-menu')?.addEventListener('click', () => {
    renderStartOverlay({ resetHud: true });
  });
}

function renderStartOverlay({ resetHud = false } = {}) {
  state.running = false;
  state.paused = false;
  if (resetHud) {
    state.assistEnabled = getAssistMode();
    state.lives = state.assistEnabled ? 4 : 3;
    state.score = 0;
  }
  configureLevelContext(null);
  state.starfield = mergeStarfieldConfig();
  state.levelOverlay = null;
  updateLevelChip();
  clearLevelEntities();
  state.level = null;
  state.levelDur = 0;
  state.nextWaveIndex = 0;
  state.levelIndex = 1;
  updateScore(state.score);
  updateLives(state.lives);
  const continueLabel = highestUnlockedLevel > 1
    ? `Continue (Level ${highestUnlockedLevel})`
    : 'Start Level 1';
  const levelButtons = LEVELS.map((level, index) => {
    const levelNumber = index + 1;
    const locked = levelNumber > highestUnlockedLevel;
    const lockedClass = locked ? ' level-select__btn--locked' : '';
    const disabled = locked ? ' disabled aria-disabled="true"' : '';
    return `<button class="level-select__btn${lockedClass}" data-level="${levelNumber}"${disabled}>L${levelNumber} · ${level.name}</button>`;
  }).join('');
  showOverlay(`
    <h1>RETRO <span class="cyan">SPACE</span> <span class="heart">RUN</span></h1>
    <p>WASD / Arrow keys to steer · Space to fire · P pause · R restart level · F fullscreen · M mute · H Assist Mode</p>
    <p>Pick a sector or continue your furthest run. Assist Mode toggles an extra life and softer spawns.</p>
    <div class="difficulty-select">
      <label class="difficulty-select__label" for="difficulty-select">Difficulty</label>
      <select id="difficulty-select" class="difficulty-select__control">
        <option value="easy">Easy · 85% density / 90% speed</option>
        <option value="normal">Normal · Original balance</option>
        <option value="hard">Hard · 120% density / 110% speed</option>
      </select>
      <p class="difficulty-select__hint">Adjust enemy density, projectile speed, and boss durability. Normal preserves the current challenge.</p>
    </div>
    <div class="overlay-actions">
      <button id="continue-btn" class="btn">${continueLabel}</button>
      <button id="toggle-level-select" class="btn btn-secondary" aria-expanded="false">Select Level</button>
    </div>
    <div id="level-select" class="level-select" hidden>
      <p class="level-select__label">Unlocked Levels</p>
      <div class="level-select__grid">${levelButtons}</div>
    </div>
  `);
  const continueBtn = document.getElementById('continue-btn');
  continueBtn?.addEventListener('click', () => {
    startRun(highestUnlockedLevel);
  });
  const toggle = document.getElementById('toggle-level-select');
  const panel = document.getElementById('level-select');
  toggle?.addEventListener('click', () => {
    if (!panel) {
      return;
    }
    const isHidden = panel.hasAttribute('hidden');
    if (isHidden) {
      panel.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      panel.setAttribute('hidden', 'hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  panel?.querySelectorAll('[data-level]').forEach((btn) => {
    const element = btn;
    const levelNumber = Number.parseInt(element.getAttribute('data-level') ?? '', 10);
    if (element.hasAttribute('disabled')) {
      return;
    }
    element.addEventListener('click', () => {
      startRun(levelNumber);
    });
  });
}

function handlePlayerHit() {
  const player = state.player;
  const particles = resolvePaletteSection(state.theme, 'particles');
  if (player.shield > 0) {
    player.shield -= 400;
    resetCombo();
    addParticle(state, player.x, player.y, particles.shieldHit, 20, 3, 400);
    playHit();
    return false;
  }
  if (player.invuln > 0) {
    return false;
  }
  state.lives -= 1;
  resetCombo();
  updateLives(state.lives);
  triggerDamagePulse(state.lives <= 1 ? 0.85 : 0.55);
  addParticle(state, player.x, player.y, particles.playerHit, 30, 3.2, 500);
  playZap();
  state.bossMercyUntil = performance.now() + 600;
  player.invuln = state.assistEnabled ? 3000 : 2000;
  if (state.lives <= 0) {
    gameOver();
    return true;
  }
  return false;
}

let lastFrame = 0;

function loop(now) {
  if (!state.running) {
    return;
  }
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  const inputState = getInputState();
  syncGamepadIndicator(inputState.gamepad?.connected);
  const { w: viewW, h: viewH } = getViewSize();
  const bulletBounds = { minX: -40, maxX: viewW + 40, minY: -40, maxY: viewH + 40 };
  const palette = activePalette ?? DEFAULT_THEME_PALETTE;
  const starPalette = resolvePaletteSection(palette, 'stars');
  const weatherPalette = resolvePaletteSection(palette, 'weather') ?? {};
  const windPalette = weatherPalette.wind ?? {};
  if (state.paused) {
    requestAnimationFrame(loop);
    return;
  }

  state.time += dt;
  updateTime(Math.floor(state.time));
  ensureGuaranteedWeaponDrop(state);
  scheduleLevelWaves();
  updateEffects(state, dt);
  updateWeather();
  updateComboTimer(dt);
  const squall = state.weather?.squall;
  if (squall?.justActivated) {
    showToast('SQUALL!', 1000);
    pulseMutatorIcon('squall');
    squall.justActivated = false;
  }
  if (squall?.justDeactivated) {
    squall.justDeactivated = false;
  }

  if (state.time >= state.levelDur) {
    if (!state.bossSpawned) {
      spawnBoss(state, state.level?.boss);
      state.bossSpawned = true;
    } else if (!state.boss && !state.finishGate && now - state.bossDefeatedAt > 600) {
      ensureFinishGate();
    }
  }

  ctx.clearRect(0, 0, viewW, viewH);
  ctx.save();
  const shake = getScreenShakeOffset();
  if (shake.offsetX || shake.offsetY) {
    ctx.translate(shake.offsetX, shake.offsetY);
  }
  const overlayTint = state.levelOverlay;
  if (overlayTint?.colour && overlayTint.alpha > 0) {
    ctx.globalAlpha = overlayTint.alpha;
    ctx.fillStyle = overlayTint.colour;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;
  }
  const windVisual = Number.isFinite(state.weather?.windX) ? state.weather.windX : 0;
  const wind = Number.isFinite(state.weather?.windDrift) ? state.weather.windDrift : windVisual;
  const squallDim = squall?.active ? squall.dimFactor ?? 0.8 : 1;
  const starfield = state.starfield ?? mergeStarfieldConfig();
  const baseAlpha = Number.isFinite(starfield.baseAlpha) ? starfield.baseAlpha : 0.4;
  const brightThreshold = Number.isFinite(starfield.brightThreshold) ? starfield.brightThreshold : 1.1;
  const brightBoost = Number.isFinite(starfield.brightBoost) ? starfield.brightBoost : 1.35;
  const windFactor = Number.isFinite(starfield.windFactor) ? starfield.windFactor : 0.04;
  const scrollBase = Number.isFinite(starfield.scrollSpeed) ? starfield.scrollSpeed : 60;
  const scrollFactor = Number.isFinite(starfield.scrollSpeedFactor) ? starfield.scrollSpeedFactor : 0.05;
  const [depthMin, depthMax] = starfield.depthRange ?? [0.4, 1.6];
  const [sizeMin, sizeMax] = starfield.sizeRange ?? [1.4, 2.4];
  const twinkleAmpBase = Number.isFinite(starfield.twinkle?.amplitude) ? Math.max(0, starfield.twinkle.amplitude) : 0;
  const twinkleSpeedBase = Number.isFinite(starfield.twinkle?.speed) ? Math.max(0, starfield.twinkle.speed) : 0;
  const timeSeconds = performance.now() * 0.001;
  for (const star of state.stars) {
    const depth = star.z ?? 1;
    star.x += windVisual * windFactor * depth * dt;
    star.y += (scrollBase * depth + state.speed * scrollFactor * depth) * dt;
    if (star.x < -2) {
      star.x = viewW + 2;
    } else if (star.x > viewW + 2) {
      star.x = -2;
    }
    if (star.y > viewH) {
      star.y = -2;
      star.x = rand(0, viewW);
      star.z = rand(depthMin, depthMax);
      star.size = rand(sizeMin, sizeMax);
      star.twinklePhase = rand(0, Math.PI * 2);
      star.twinkleSpeed = twinkleSpeedBase ? rand(twinkleSpeedBase * 0.75, twinkleSpeedBase * 1.25) : 0;
      star.twinkleAmplitude = twinkleAmpBase ? rand(twinkleAmpBase * 0.6, twinkleAmpBase * 1.2) : 0;
    }
    const twinkleAmplitude = Number.isFinite(star.twinkleAmplitude) ? star.twinkleAmplitude : twinkleAmpBase;
    const twinkleSpeed = Number.isFinite(star.twinkleSpeed) ? star.twinkleSpeed : twinkleSpeedBase;
    const twinklePhase = Number.isFinite(star.twinklePhase) ? star.twinklePhase : 0;
    const twinkle = twinkleAmplitude && twinkleSpeed
      ? Math.sin(timeSeconds * twinkleSpeed + twinklePhase) * twinkleAmplitude
      : 0;
    const brightness = depth > brightThreshold ? brightBoost : 1;
    const alpha = Math.max(0, Math.min(1, (baseAlpha * depth * brightness + twinkle) * squallDim));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = depth > brightThreshold ? starPalette.bright : starPalette.dim;
    const size = Number.isFinite(star.size) ? Math.max(1, star.size) : 2;
    ctx.fillRect(star.x, star.y, size, size);
  }
  const windStrands = state.windStrands ?? [];
  if (windStrands.length) {
    const windStrength = Math.abs(wind);
    const alphaScale = Math.max(0, Math.min(1, windStrength / MAX_WIND_DRIFT));
    const streakColour = windPalette.streak ?? '#c5f6ff';
    const glowColour = windPalette.glow ?? 'rgba(0, 229, 255, 0.35)';
    const baseAlpha = Number.isFinite(windPalette.alpha) ? Math.max(0, windPalette.alpha) : 0.18;
    const spawnLeft = windVisual >= 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = glowColour;
    ctx.shadowBlur = Number.isFinite(windPalette.shadow)
      ? Math.max(0, windPalette.shadow)
      : 6;
    ctx.lineWidth = 2;
    for (const streak of windStrands) {
      const vx = wind * 1.25 + streak.jitter * 0.25;
      const vy = streak.speed;
      streak.x += vx * dt;
      streak.y += vy * dt;
      if (streak.y > viewH + streak.length) {
        streak.y = -rand(20, viewH * 0.25);
        streak.x = spawnLeft ? rand(-40, viewW * 0.4) : rand(viewW * 0.6, viewW + 40);
        streak.jitter = rand(-14, 14);
      } else if (streak.x < -80 || streak.x > viewW + 80) {
        streak.x = spawnLeft ? rand(-40, 0) : rand(viewW, viewW + 40);
        streak.y = rand(-viewH * 0.1, viewH * 0.9);
        streak.jitter = rand(-14, 14);
      }
      const dx = vx;
      const dy = vy;
      const len = streak.length;
      const mag = Math.hypot(dx, dy) || 1;
      const ux = dx / mag;
      const uy = dy / mag;
      const half = len / 2;
      const startX = streak.x - ux * half;
      const startY = streak.y - uy * half;
      const endX = streak.x + ux * half;
      const endY = streak.y + uy * half;
      const streakAlpha = Math.max(
        0.04,
        Math.min(0.7, (baseAlpha + streak.alpha * 0.6) * (0.4 + alphaScale * 1.2)),
      );
      ctx.globalAlpha = streakAlpha;
      ctx.strokeStyle = streakColour;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  drawSquallOverlay(viewW, viewH, palette);

  const player = state.player;
  updatePlayer(player, inputState, dt, state.power.name === 'boost', wind);
  clampPlayerToBounds(player);

  const bulletTime = state.time * 1000;

  const wantsFire = inputState.fire || Boolean(state.settings?.autoFire && !inputState.fire);
  handlePlayerShooting(state, { fire: wantsFire }, now);
  updateBullets(state.bullets, bulletTime, bulletBounds, { windX: wind });
  updateMuzzleFlashes(state, dt);

  updateEnemies(state, dt, now, player);
  updateBoss(state, dt, now, player, palette);
  updateBullets(state.enemyBullets, bulletTime, bulletBounds, { windX: wind });

  ensureGuaranteedPowerups(state, now);
  maybeSpawnPowerup(state, now);
  updatePowerups(state, dt, now);
  updateWeaponDrops(state, dt);
  clearExpiredPowers(state, now);

  if (state.finishGate) {
    const gate = state.finishGate;
    gate.y += gate.vy * dt;
    if (gate.y > viewH * 0.25) {
      gate.vy = 0;
    }
    if (Math.abs(player.y - gate.y) < 28 && Math.abs(player.x - gate.x) < gate.w / 2) {
      playZap();
      playZap();
      playPow();
      completeLevel();
      ctx.restore();
      return;
    }
  }

  const particles = resolvePaletteSection(state.theme, 'particles');
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const bullet = state.bullets[j];
      if (coll(enemy, bullet, -4)) {
        const bulletLevel = bullet.level ?? 0;
        state.bullets.splice(j, 1);
        freeBullet(bullet);
        enemy.hp -= bullet.damage || 1;
        if (bulletLevel >= 2) {
          shakeScreen(rand(2, 4), 160);
        }
        const enemyCol = enemy.type === 'strafer'
          ? particles.enemyHitStrafer
          : particles.enemyHitDefault;
        addParticle(state, enemy.x, enemy.y, enemyCol, 12, 2.6, 300);
        playHit();
        if (enemy.hp <= 0) {
          spawnExplosion(enemy.x, enemy.y, 'small');
          state.enemies.splice(i, 1);
          incrementCombo();
          addScore(25);
          playSfx('explode');
          maybeDropWeaponToken(state, enemy);
        }
        break;
      }
    }
  }

  if (state.boss) {
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const bullet = state.bullets[j];
      if (coll(state.boss, bullet, -12)) {
        const bulletLevel = bullet.level ?? 0;
        state.bullets.splice(j, 1);
        freeBullet(bullet);
        state.boss.hp -= bullet.damage || 1;
        if (bulletLevel >= 2) {
          shakeScreen(rand(2, 4), 160);
        }
        addParticle(state, state.boss.x, state.boss.y, particles.bossHit, 18, 3.4, 320);
        playHit();
        if (state.boss.hp <= 0) {
          const defeatedBoss = state.boss;
          spawnExplosion(defeatedBoss.x, defeatedBoss.y, 'boss');
          shakeScreen(6, 500);
          showToast('BOSS DEFEATED', 1200);
          playBossDown();
          incrementCombo();
          addScore(600);
          if (!defeatedBoss.rewardDropped) {
            defeatedBoss.rewardDropped = true;
            maybeDropWeaponToken(state, { x: defeatedBoss.x, y: defeatedBoss.y });
          }
          state.boss = null;
          state.bossDefeatedAt = now;
          state.bossMercyUntil = 0;
        }
        break;
      }
    }
  }

  const playerDefeated = () => {
    const eliminated = handlePlayerHit();
    if (eliminated) {
      return true;
    }
    return false;
  };

  for (const enemy of state.enemies) {
    if (coll(player, enemy, -4) && playerDefeated()) {
      ctx.restore();
      return;
    }
  }
  if (state.boss && coll(player, state.boss, -26) && playerDefeated()) {
    ctx.restore();
    return;
  }
  for (const bullet of state.enemyBullets) {
    if (coll(player, bullet, -2) && playerDefeated()) {
      ctx.restore();
      return;
    }
  }
  if (state.boss && isPointInBossBeam(state.boss, player.x, player.y) && playerDefeated()) {
    ctx.restore();
    return;
  }

  if (player.invuln > 0) {
    player.invuln -= dt * 1000;
  }

  drawWeaponDrops(ctx, state.weaponDrops, palette);
  drawPowerups(ctx, state.powerups, palette);
  drawEnemies(ctx, state.enemies, palette);
  if (state.boss) {
    drawBoss(ctx, state.boss, palette);
  }
  drawEnemyBullets(ctx, state.enemyBullets, palette);
  drawPlayerBullets(ctx, state.bullets, palette);
  drawMuzzleFlashes(ctx, state.muzzleFlashes, palette);
  if (state.finishGate) {
    drawGate(state.finishGate, palette);
  }
  drawPlayer(ctx, player, inputState, palette, state.weaponPickupFlash);
  drawDamagePulse(ctx, viewW, viewH);

  if (state.boss) {
    drawBossHealth(ctx, state.boss, palette);
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.t -= dt * 1000;
    p.x += p.vx;
    p.y += p.vy;
    if (p.t <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = p.t / p.life;
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x, p.y, 2, 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  addScore(PASSIVE_SCORE_RATE * dt, { allowFraction: true });

  requestAnimationFrame(loop);
}

function monitorGamepadIdle() {
  if (state.running) {
    requestAnimationFrame(monitorGamepadIdle);
    return;
  }
  const inputState = getInputState();
  syncGamepadIndicator(inputState.gamepad?.connected);
  requestAnimationFrame(monitorGamepadIdle);
}

monitorGamepadIdle();

renderStartOverlay({ resetHud: true });
