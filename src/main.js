/**
 * main.js — bootstraps Retro Space Run, orchestrating modules and the core game loop.
 */
// CHANGELOG: Introduced GameEvents integration, damage handling, and spawn scheduler wiring.
import { rand, coll, addParticle, clamp } from './utils.js';
import {
  canvas,
  ctx,
  showOverlay,
  hideOverlay,
  showPauseOverlay,
  updateLives,
  updateScore,
  updateComboMultiplier,
  updateTime,
  updatePower,
  updateShield,
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
  getActiveThemeKey,
  setGamepadIndicator,
  pulseMutatorIcon,
  refreshThemeOptions,
  ui,
} from './ui.js';
import {
  playZap,
  playHit,
  toggleAudio,
  resumeAudioContext,
  playPow,
  playSfx,
  playBossDown,
  getVolume,
  setVolume,
  setMusicTheme,
} from './audio.js';
import { resetPlayer, updatePlayer, clampPlayerToBounds, drawPlayer } from './player.js';
import {
  spawn,
  updateEnemies,
  drawEnemies,
  spawnBoss,
  spawnMidBoss,
  updateBoss,
  drawBoss,
  drawBossHealth,
  isPointInBossBeam,
  handleEnemyDestroyed,
} from './enemies.js';
import {
  resetPowerTimers,
  maybeSpawnPowerup,
  dropPowerup,
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
  spawnWeaponToken,
  ensureGuaranteedWeaponDrop,
  updateMuzzleFlashes,
  drawMuzzleFlashes,
  updateWeaponHud,
} from './weapons.js';
import {
  DEFAULT_THEME_KEY,
  DEFAULT_THEME_PALETTE,
  resolvePaletteSection,
  getThemeKeys,
  getThemeLabel,
  getThemeBehaviour,
  applyThemeBehaviourToPalette,
} from './themes.js';
import { LEVELS } from './levels.js';
import {
  DIFFICULTY,
  getDifficultyMode,
  getDifficultyMultipliers,
  getDifficultyConfig,
  onDifficultyModeChange,
  setDifficulty,
} from './difficulty.js';
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
import { getMetaValue, updateStoredMeta } from './storage.js';
import { GameEvents } from './events.js';
import { configureSpawner, startLevelSpawns, stopLevelSpawns, tickSpawner } from './spawner.js';
import {
  recordRunEnd,
  getSelectedShipKey,
  setSelectedShip,
  getMetaProgress,
  isPaletteUnlocked,
  unlockPalette,
  getUnlockedShips,
  getEndlessPersonalBests,
  recordEndlessResult,
} from './meta.js';
import { getStoryBeat } from './story.js';
import {
  SHIP_CATALOGUE,
  getShipByKey,
  getDefaultShipKey,
  getShipDisplayStats,
  getShipRequirement,
} from './ships.js';
import { evaluateAchievements, getAchievementProgress } from './achievements.js';

let activePalette = getActiveThemePalette() ?? DEFAULT_THEME_PALETTE;

const DEFAULT_LEVEL = LEVELS[0] ?? null;

const LEGACY_PROGRESS_STORAGE_KEY = 'retro-space-run.highest-level';

const MAX_WIND_DRIFT = 80;

const COMBO_DECAY_DELAY = 3.5;
const COMBO_MAX_VALUE = 20;
const COMBO_STEP = 0.1;
const COMBO_MAX_MULTIPLIER = 3;
const PASSIVE_SCORE_RATE = 30;

const STORY_OVERLAY_DURATION = 1800;

const MENU_SELECTION_STORAGE_KEY = 'retro-space-run.menu-selection';

const GAME_MODES = Object.freeze({
  CAMPAIGN: 'campaign',
  ENDLESS: 'endless',
});

const APP_VIEW_STATES = Object.freeze({
  MENU: 'MENU',
  GAMEPLAY: 'GAMEPLAY',
  ENDLESS: 'ENDLESS',
  GARAGE: 'GARAGE',
  ACHIEVEMENTS: 'ACHIEVEMENTS',
  OPTIONS: 'OPTIONS',
});

let currentViewState = APP_VIEW_STATES.MENU;
let previousViewState = APP_VIEW_STATES.MENU;

if (canvas && typeof canvas.addEventListener === 'function') {
  canvas.addEventListener('mousedown', (event) => {
    if (!ui || typeof ui.onClick !== 'function') {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? canvas.width / rect.width : 1;
    const scaleY = rect.height ? canvas.height / rect.height : 1;
    const mx = (event.clientX - rect.left) * scaleX;
    const my = (event.clientY - rect.top) * scaleY;
    ui.onClick(mx, my);
  });
}

const ENDLESS_SCALE_STEP = 0.1;
const ENDLESS_BOSS_WAVE_MIN = 4;
const ENDLESS_BOSS_WAVE_MAX = 5;

const overlayElement = typeof document !== 'undefined' ? document.getElementById('overlay') : null;

const storyOverlayState = {
  active: false,
  timeout: null,
  keyHandler: null,
  clickHandler: null,
};

function isDebugEnabled() {
  if (typeof window !== 'undefined') {
    return Boolean(window.__rsrDebug);
  }
  return false;
}

function dlog(...args) {
  if (isDebugEnabled()) {
    console.log('[RSR]', ...args);
  }
}

function dismissStoryOverlay({ hide = false } = {}) {
  if (storyOverlayState.timeout) {
    if (typeof window !== 'undefined') {
      window.clearTimeout(storyOverlayState.timeout);
    }
    storyOverlayState.timeout = null;
  }
  if (overlayElement && storyOverlayState.clickHandler) {
    overlayElement.removeEventListener('click', storyOverlayState.clickHandler);
  }
  if (typeof window !== 'undefined' && storyOverlayState.keyHandler) {
    window.removeEventListener('keydown', storyOverlayState.keyHandler, true);
  }
  storyOverlayState.clickHandler = null;
  storyOverlayState.keyHandler = null;
  if (hide && storyOverlayState.active) {
    hideOverlay();
  }
  storyOverlayState.active = false;
}

function showStoryOverlay(beat) {
  if (!beat || !overlayElement) {
    return;
  }
  dismissStoryOverlay({ hide: true });
  const lines = Array.isArray(beat.textLines)
    ? beat.textLines
        .filter((line) => typeof line === 'string' && line.trim().length)
        .map((line) => `<p class="story-card__line">${line}</p>`)
        .join('')
    : '';
  const hint = '<p class="story-card__hint">Press Space or click to skip</p>';
  const headingTag = beat.title ? `<h2>${beat.title}</h2>` : '';
  showOverlay(`
    <article class="story-card" role="status" aria-live="polite">
      ${headingTag}
      <div class="story-card__body">${lines}</div>
      ${hint}
    </article>
  `);
  storyOverlayState.active = true;

  const finish = () => {
    if (!storyOverlayState.active) {
      return;
    }
    const shouldHide = overlayElement?.querySelector('.story-card');
    dismissStoryOverlay();
    if (shouldHide) {
      hideOverlay();
    }
  };

  storyOverlayState.clickHandler = (event) => {
    event?.preventDefault?.();
    finish();
  };
  storyOverlayState.keyHandler = (event) => {
    if (!event) {
      return;
    }
    const code = event.code || event.key;
    if (code === 'Space' || code === 'Spacebar' || event.key === ' ') {
      event.preventDefault();
      finish();
    }
  };
  overlayElement.addEventListener('click', storyOverlayState.clickHandler);
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', storyOverlayState.keyHandler, true);
    storyOverlayState.timeout = window.setTimeout(finish, STORY_OVERLAY_DURATION);
  }
}

function createThemeFxState() {
  return {
    overlay: null,
    overlayTime: 0,
    enemySpeedMultiplier: 1,
    powerupIntervalMultiplier: 1,
    powerupDurationMultiplier: 1,
  };
}

function cloneEnemyWeights(weights = {}) {
  const clone = {};
  for (const [type, value] of Object.entries(weights)) {
    if (Number.isFinite(value)) {
      clone[type] = value;
    }
  }
  return clone;
}

function applyEnemyWeightMultipliers(weights = {}, multipliers = {}) {
  if (!multipliers) {
    return weights;
  }
  const clone = { ...weights };
  for (const [type, multiplier] of Object.entries(multipliers)) {
    if (!Number.isFinite(multiplier)) {
      continue;
    }
    const base = Number.isFinite(clone[type]) ? clone[type] : 1;
    clone[type] = Math.max(0, base * multiplier);
  }
  return clone;
}

function getMidBossConfig(level) {
  if (!level?.boss) {
    return null;
  }
  return level.boss.midBoss ?? null;
}

function getFinalBossConfig(level) {
  if (!level?.boss) {
    return null;
  }
  if (level.boss.finalBoss) {
    return level.boss.finalBoss;
  }
  return level.boss.kind ? level.boss : null;
}

function resolveMidBossTrigger(level, duration) {
  const config = getMidBossConfig(level);
  if (!config) {
    return null;
  }
  if (Number.isFinite(config.triggerTime)) {
    return Math.max(0, config.triggerTime);
  }
  const ratio = Number.isFinite(config.triggerRatio) ? clamp(config.triggerRatio, 0.1, 0.95) : 0.6;
  const baseDuration = Number.isFinite(duration) ? duration : level?.duration ?? 0;
  return baseDuration * ratio;
}

function maybeSpawnMidBossFight() {
  const level = state.level;
  const config = getMidBossConfig(level);
  if (!config) {
    return;
  }
  if (state.midBossSpawned || state.midBossDefeated || state.boss || state.bossSpawned) {
    return;
  }
  const triggerAt = resolveMidBossTrigger(level, state.levelDur);
  if (!Number.isFinite(triggerAt)) {
    return;
  }
  if (state.time >= triggerAt) {
    spawnMidBoss(state, config);
    state.midBossSpawned = true;
    state.bossType = 'mid';
    GameEvents.emit('boss:spawned', { type: 'mid', config });
    showToast('INTRUDER ALERT', 900);
  }
}

function clampMultiplier(value, fallback = 1, min = 0.1, max = 5) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

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

function clampLevelIndex(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(LEVELS.length, Math.floor(value)));
}

function readHighestUnlockedLevel() {
  const metaValue = Number.parseInt(getMetaValue('highestUnlockedLevel', 1), 10);
  if (Number.isFinite(metaValue) && metaValue >= 1) {
    return clampLevelIndex(metaValue);
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage?.getItem(LEGACY_PROGRESS_STORAGE_KEY);
      const parsed = Number.parseInt(stored ?? '', 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        const clamped = clampLevelIndex(parsed);
        updateStoredMeta({ highestUnlockedLevel: clamped });
        return clamped;
      }
    } catch (err) {
      /* ignore storage access issues */
    }
  }
  return 1;
}

function writeHighestUnlockedLevel(value) {
  const clamped = clampLevelIndex(value);
  const meta = updateStoredMeta({ highestUnlockedLevel: clamped });
  const stored = Number.parseInt(meta.highestUnlockedLevel ?? clamped, 10);
  return clampLevelIndex(Number.isFinite(stored) ? stored : clamped);
}

const LIFE_CAP_BASE = 5;
const ASSIST_LIFE_CAP = 6;
const SHIELD_BASE_DURATION = 8000;
const MIN_FIRE_RATE_MULTIPLIER = 0.4;
const FIRE_RATE_STEP = 0.9;
const MOVE_SPEED_STEP = 1.08;
const MAX_MOVE_SPEED_MULTIPLIER = 1.8;
const SHIELD_DURATION_STEP = 1.2;
const MAX_SHIELD_DURATION_MULTIPLIER = 3;
const DUPLICATE_SHIELD_RATIO = 0.5;

function createRunUpgradeState() {
  return {
    fireRateMultiplier: 1,
    moveSpeedMultiplier: 1,
    shieldDurationMultiplier: 1,
    duplicateConversion: 'score',
  };
}

function createRunStats({ level = 1, shipKey = null } = {}) {
  const initialLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return {
    bosses: 0,
    kills: 0,
    livesLost: 0,
    score: 0,
    highestLevel: initialLevel,
    ship: shipKey,
  };
}

function getLifeCap(stateLike) {
  return stateLike.assistEnabled ? ASSIST_LIFE_CAP : LIFE_CAP_BASE;
}

function getShieldCapacity(stateLike) {
  const multiplier = stateLike.runUpgrades?.shieldDurationMultiplier ?? 1;
  return SHIELD_BASE_DURATION * multiplier;
}

let highestUnlockedLevel = clampLevelIndex(readHighestUnlockedLevel());
let bestScore = Math.max(0, Number.parseInt(getMetaValue('bestScore', 0), 10) || 0);
const initialEndlessBests = getEndlessPersonalBests();
let bestEndlessScore = Math.max(0, Number.isFinite(initialEndlessBests.score) ? initialEndlessBests.score : 0);
let bestEndlessTime = Math.max(0, Number.isFinite(initialEndlessBests.time) ? initialEndlessBests.time : 0);
const defaultShipKey = getDefaultShipKey();
const initialShipKey = getSelectedShipKey() || defaultShipKey;
const initialShip = getShipByKey(initialShipKey) ?? getShipByKey(defaultShipKey);

function unlockLevel(levelIndex) {
  const capped = clampLevelIndex(levelIndex);
  if (capped > highestUnlockedLevel) {
    highestUnlockedLevel = writeHighestUnlockedLevel(capped);
  }
}

function recordBestScore(score) {
  const numeric = Math.max(0, Math.floor(Number.isFinite(score) ? score : Number(score) || 0));
  if (numeric > bestScore) {
    bestScore = numeric;
    const meta = updateStoredMeta({ bestScore: numeric });
    const stored = Number.parseInt(meta.bestScore ?? numeric, 10);
    if (Number.isFinite(stored) && stored >= 0) {
      bestScore = Math.max(bestScore, stored);
    }
  }
}

function computeDifficultyMultipliers(mode = state.difficultyMode) {
  const base = { ...getDifficultyMultipliers(mode) };
  if (state.gameMode === GAME_MODES.ENDLESS) {
    const scale = Number.isFinite(state.endless?.difficultyScale)
      ? Math.max(0.5, state.endless.difficultyScale)
      : 1;
    return {
      density: (base.density ?? 1) * scale,
      speed: (base.speed ?? 1) * scale,
      hp: (base.hp ?? 1) * scale,
    };
  }
  return base;
}

function applyDifficultyMode(mode = state.difficultyMode) {
  const nextMode = mode ?? state.difficultyMode;
  state.difficultyMode = nextMode;
  state.difficulty = computeDifficultyMultipliers(nextMode);
}

function buildEndlessThemeOrder() {
  const keys = getThemeKeys();
  if (!Array.isArray(keys) || keys.length === 0) {
    return [DEFAULT_THEME_KEY];
  }
  return keys.slice();
}

function rollEndlessBossWave() {
  return Math.floor(Math.random() * (ENDLESS_BOSS_WAVE_MAX - ENDLESS_BOSS_WAVE_MIN + 1)) + ENDLESS_BOSS_WAVE_MIN;
}

function resetEndlessState() {
  const order = buildEndlessThemeOrder();
  const endless = state.endless ?? {};
  endless.active = true;
  endless.loop = 0;
  endless.stage = 1;
  endless.levelPointer = 0;
  endless.themeOrder = order;
  endless.themeIndex = 0;
  endless.currentTheme = order[0] ?? DEFAULT_THEME_KEY;
  endless.difficultyScale = 1;
  endless.waveCounter = 0;
  endless.nextBossWave = rollEndlessBossWave();
  endless.totalTime = 0;
  endless.randomBossActive = false;
  state.endless = endless;
  applyDifficultyMode(state.difficultyMode);
}

function getEndlessBaseLevel() {
  const levelsCount = LEVELS.length;
  if (levelsCount === 0) {
    return DEFAULT_LEVEL;
  }
  const pointer = state.endless?.levelPointer ?? 0;
  const index = ((pointer % levelsCount) + levelsCount) % levelsCount;
  return LEVELS[index] ?? DEFAULT_LEVEL;
}

function createEndlessLevelOverride() {
  const baseLevel = getEndlessBaseLevel();
  const endless = state.endless ?? {};
  if (!Array.isArray(endless.themeOrder) || endless.themeOrder.length === 0) {
    endless.themeOrder = buildEndlessThemeOrder();
    endless.themeIndex = 0;
  }
  const order = endless.themeOrder;
  const themeIndex = Number.isFinite(endless.themeIndex) ? endless.themeIndex : 0;
  const themeKey = order.length ? order[(themeIndex % order.length + order.length) % order.length] : baseLevel?.theme ?? DEFAULT_THEME_KEY;
  endless.themeIndex = order.length ? (themeIndex + 1) % order.length : 0;
  endless.currentTheme = themeKey;
  const behaviour = getThemeBehaviour(themeKey);
  return {
    ...baseLevel,
    theme: themeKey,
    themeBehaviour: behaviour,
  };
}

function advanceEndlessProgression() {
  const endless = state.endless ?? {};
  const levelsCount = LEVELS.length;
  endless.waveCounter = 0;
  endless.randomBossActive = false;
  endless.nextBossWave = rollEndlessBossWave();
  if (levelsCount > 0) {
    endless.levelPointer = (Number.isFinite(endless.levelPointer) ? endless.levelPointer : 0) + 1;
    if (endless.levelPointer >= levelsCount) {
      endless.levelPointer = 0;
      endless.loop = (endless.loop ?? 0) + 1;
      endless.difficultyScale = 1 + endless.loop * ENDLESS_SCALE_STEP;
      applyDifficultyMode(state.difficultyMode);
      showToast('Threat level rising!', 1200);
    }
  }
  endless.stage = (endless.stage ?? 1) + 1;
  state.endless = endless;
}

function cloneBossConfig(config = {}) {
  return JSON.parse(JSON.stringify(config));
}

function pickRandomEndlessBossConfig() {
  const pool = LEVELS.map((level) => getFinalBossConfig(level)).filter(Boolean);
  if (!pool.length) {
    return null;
  }
  const index = Math.floor(Math.random() * pool.length);
  return cloneBossConfig(pool[index]);
}

function spawnRandomEndlessBoss() {
  if (state.gameMode !== GAME_MODES.ENDLESS) {
    return;
  }
  if (state.boss || state.bossSpawned || state.endless?.randomBossActive) {
    return;
  }
  const config = pickRandomEndlessBossConfig();
  if (!config) {
    return;
  }
  const bossConfig = {
    ...config,
    role: 'endless',
    introMessage: config.introMessage ?? 'ENDLESS PROTOCOL',
    introColour: config.introColour ?? '#ff9dfd',
    bannerColour: config.bannerColour ?? 'rgba(255, 230, 255, 0.9)',
    healthLabel: config.healthLabel ?? 'Flagship Integrity',
  };
  spawnBoss(state, bossConfig);
  state.bossSpawned = true;
  state.bossType = 'endless';
  state.endless.randomBossActive = true;
  state.endless.waveCounter = 0;
  state.endless.nextBossWave = rollEndlessBossWave();
  showToast('ENEMY FLAGSHIP DETECTED', 1100);
  GameEvents.emit('boss:spawned', { type: 'endless', config: bossConfig });
}

const state = {
  running: false,
  paused: false,
  gameMode: GAME_MODES.CAMPAIGN,
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
  ship: initialShip,
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
  endless: {
    active: false,
    loop: 0,
    stage: 1,
    levelPointer: 0,
    themeIndex: 0,
    themeOrder: [],
    currentTheme: DEFAULT_THEME_KEY,
    difficultyScale: 1,
    waveCounter: 0,
    nextBossWave: ENDLESS_BOSS_WAVE_MIN,
    totalTime: 0,
    randomBossActive: false,
  },
  finishGate: null,
  boss: null,
  bossType: null,
  bossSpawned: false,
  midBossSpawned: false,
  midBossDefeated: false,
  midBossDefeatedAt: 0,
  bossDefeatedAt: 0,
  bossMercyUntil: 0,
  lastShot: 0,
  shotDelay: 180,
  speed: 260,
  power: { name: null, until: 0 },
  shieldCapacity: 0,
  powerupsGrantedL1: 0,
  lastGuaranteedPowerup: null,
  weapon: null,
  theme: activePalette,
  renderPalette: activePalette,
  assistEnabled: getAssistMode(),
  settings: {
    autoFire: getAutoFire(),
    difficulty: getDifficultyMode(),
  },
  levelContext: { enemyWeights: {}, mutators: {}, themeKey: null, themeBehaviour: null },
  weather: { windX: 0, windDrift: 0, squall: null },
  levelIntroTimeout: null,
  runUpgrades: createRunUpgradeState(),
  themeFx: createThemeFxState(),
  runStats: createRunStats({ level: 1, shipKey: initialShip?.key ?? defaultShipKey }),
  storyOutroShown: false,
};

configureSpawner(state);
GameEvents.emit('difficulty:changed', {
  mode: state.difficultyMode,
  config: getDifficultyConfig(state.difficultyMode, DEFAULT_LEVEL?.key ?? DEFAULT_LEVEL ?? 'L1'),
});
dlog('Difficulty boot', state.difficultyMode);

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
      GameEvents.emit('score:changed', state.score);
      dlog('Score increment', whole, '→', state.score);
    }
    return whole;
  }
  const awarded = Math.max(0, Math.round(numericBase * multiplier));
  if (awarded > 0) {
    state.score += awarded;
    if (state.runStats) {
      state.runStats.score = (state.runStats.score ?? 0) + awarded;
    }
    updateScore(state.score);
    GameEvents.emit('score:changed', state.score);
    dlog('Score award', awarded, '→', state.score);
  }
  return awarded;
}

state.addScore = addScore;

function emitLivesChanged() {
  updateLives(state.lives);
  GameEvents.emit('lives:changed', state.lives);
  dlog('Lives', state.lives);
}

function emitShieldChanged(value = 0, maxValue = 1) {
  const resolvedMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : getShieldCapacity(state) || SHIELD_BASE_DURATION;
  updateShield(value, resolvedMax);
  GameEvents.emit('shield:changed', { value, max: resolvedMax });
  dlog('Shield', value, '/', resolvedMax);
}

function emitPowerChanged(label) {
  const clean = typeof label === 'string' && label.trim().length ? label.trim() : 'None';
  const display = clean === 'None' ? 'None' : clean.toUpperCase();
  updatePower(display);
  GameEvents.emit('powerup:changed', display);
  dlog('Power-up', display);
}

function emitWeaponChanged() {
  updateWeaponHud(state);
  const weapon = state.weapon;
  if (weapon && typeof weapon === 'object') {
    dlog('Weapon', weapon.name ?? weapon.label ?? 'Weapon', 'Lv', weapon.level ?? 0);
  } else {
    dlog('Weapon', 'None');
  }
}

function applyPlayerDamage(damage) {
  const player = state.player;
  if (!player || !Number.isFinite(damage) || damage <= 0) {
    return { defeated: false, absorbed: 0, overflow: 0, lostLife: false };
  }
  const amount = Math.max(0, damage);
  const capacity = state.shieldCapacity || getShieldCapacity(state);
  const shieldBefore = Math.max(0, player.shield ?? 0);
  const absorbed = Math.min(shieldBefore, amount);
  let overflow = Math.max(0, amount - absorbed);
  if (absorbed > 0) {
    player.shield = Math.max(0, shieldBefore - absorbed);
    if (player.shield <= 0) {
      player.shield = 0;
      state.shieldCapacity = 0;
      if (state.power.name === 'shield') {
        state.power.name = null;
        state.power.until = 0;
        emitPowerChanged('None');
      }
    }
  }
  if (overflow > 0 && player.invuln > 0) {
    overflow = 0;
  }
  emitShieldChanged(player.shield, capacity || SHIELD_BASE_DURATION);
  const result = {
    defeated: false,
    absorbed,
    overflow,
    lostLife: false,
  };
  if (overflow > 0) {
    const lifeLoss = Math.max(1, Math.ceil(overflow));
    state.lives = Math.max(0, state.lives - lifeLoss);
    if (state.runStats && lifeLoss > 0) {
      state.runStats.livesLost = (state.runStats.livesLost ?? 0) + lifeLoss;
    }
    result.lostLife = lifeLoss > 0;
    emitLivesChanged();
    triggerDamagePulse(state.lives <= 1 ? 0.85 : 0.55);
    if (state.lives <= 0) {
      result.defeated = true;
    } else {
      player.invuln = state.assistEnabled ? 3000 : 2000;
    }
  }
  GameEvents.emit('player:hit', {
    damage: amount,
    absorbed,
    overflow,
    lives: state.lives,
    shield: player.shield,
  });
  dlog('Player hit', { damage: amount, absorbed, overflow, lives: state.lives, shield: player.shield });
  return result;
}

onDifficultyModeChange((mode) => {
  applyDifficultyMode(mode);
  state.settings.difficulty = mode;
  if (state.running && state.level) {
    const config = getDifficultyConfig(state.difficultyMode, state.level?.key ?? state.level);
    startLevelSpawns(config);
    dlog('Difficulty mode updated', mode, config);
  }
});

onThemeChange((key, palette) => {
  activePalette = palette ?? DEFAULT_THEME_PALETTE;
  refreshActivePalette();
  setMusicTheme(key);
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

GameEvents.on('wave:spawned', () => {
  if (state.gameMode !== GAME_MODES.ENDLESS || !state.endless?.active) {
    return;
  }
  if (state.boss || state.bossSpawned) {
    return;
  }
  state.endless.waveCounter = (state.endless.waveCounter ?? 0) + 1;
  if (state.endless.waveCounter >= state.endless.nextBossWave) {
    spawnRandomEndlessBoss();
  }
});

onInputAction(INPUT_ACTIONS.AUTO_FIRE, () => {
  toggleAutoFire();
});

onInputAction(INPUT_ACTIONS.OPTIONS, () => {
  if (optionsOverlayOpen) {
    closeOptionsOverlay();
    return;
  }
  if (state.running) {
    setAppState(APP_VIEW_STATES.OPTIONS, {
      context: 'game',
      onClose: () => {
        hideOverlay();
        state.paused = false;
        clearInput();
        setAppState(APP_VIEW_STATES.GAMEPLAY, { resume: true });
      },
    });
    return;
  }
  if (atMenuScreen) {
    setAppState(APP_VIEW_STATES.OPTIONS, {
      context: 'menu',
      onClose: () => {
        setAppState(APP_VIEW_STATES.MENU, { force: true });
      },
    });
  }
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
let atMenuScreen = false;
let optionsOverlayOpen = false;
let optionsOverlayCloseHandler = null;

function syncGamepadIndicator(connected) {
  const isConnected = Boolean(connected);
  if (isConnected === lastGamepadIndicatorState) {
    return;
  }
  lastGamepadIndicatorState = isConnected;
  setGamepadIndicator(isConnected);
}

syncGamepadIndicator(false);

function closeOptionsOverlay() {
  if (!optionsOverlayOpen) {
    return;
  }
  const handler = optionsOverlayCloseHandler;
  optionsOverlayOpen = false;
  optionsOverlayCloseHandler = null;
  if (typeof handler === 'function') {
    handler();
  } else {
    hideOverlay();
  }
}

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
  stopLevelSpawns();
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
  state.bossType = null;
  state.bossSpawned = false;
  state.midBossSpawned = false;
  state.midBossDefeated = false;
  state.midBossDefeatedAt = 0;
  state.bossDefeatedAt = 0;
  state.bossMercyUntil = 0;
  state.storyOutroShown = false;
  state.weaponDropSecured = false;
  state.powerupsGrantedL1 = 0;
  state.lastGuaranteedPowerup = null;
  state.weaponPickupFlash = null;
  state.lastShot = 0;
  if (state.themeFx) {
    state.themeFx.overlayTime = 0;
  }
  state.power = { name: null, until: 0 };
  state.restartPromptVisible = false;
  resetPowerState(state);
  resetPowerTimers();
  resetEffects();
  spawnStars();
  resetPlayer(state, state.ship);
  const baseShield = Math.max(0, state.player?.baseShield ?? 0);
  state.shieldCapacity = baseShield;
  if (state.player) {
    state.player.shield = baseShield;
    state.player.speed = Math.max(120, state.player.baseSpeed ?? state.player.speed ?? 260);
  }
  emitShieldChanged(baseShield, Math.max(baseShield, 1));
  emitPowerChanged('None');
  updateTime(0);
}

function resetGame(levelIndex = state.levelIndex) {
  if (state.gameMode === GAME_MODES.ENDLESS) {
    startRun(1, { gameMode: GAME_MODES.ENDLESS });
    return;
  }
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
  GameEvents.emit('score:changed', state.score);
  emitLivesChanged();
  state.power = { name: null, until: 0 };
  const baseShield = Math.max(0, state.player?.baseShield ?? 0);
  state.shieldCapacity = baseShield;
  if (state.player) {
    state.player.shield = baseShield;
    state.player.speed = Math.max(120, state.player.baseSpeed ?? state.player.speed ?? 260);
  }
  emitShieldChanged(baseShield, Math.max(baseShield, 1));
  if (startWeapon) {
    state.weapon = { ...startWeapon };
  } else {
    setupWeapons(state);
  }
  emitWeaponChanged();
  emitPowerChanged('None');
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
  if (state.gameMode === GAME_MODES.ENDLESS) {
    state.restartPromptVisible = true;
    showOverlay(`
      <h1>Restart Endless Run?</h1>
      <p>Restart from the beginning with base threat level?</p>
      <div class="overlay-actions">
        <button id="confirm-restart" class="btn" autofocus>Restart Endless</button>
        <button id="cancel-restart" class="btn btn-secondary">Resume</button>
      </div>
    `);
    const confirmBtn = document.getElementById('confirm-restart');
    confirmBtn?.addEventListener('click', () => {
      state.restartPromptVisible = false;
      startRun(1, { gameMode: GAME_MODES.ENDLESS });
    });
    const cancelBtn = document.getElementById('cancel-restart');
    cancelBtn?.addEventListener('click', () => {
      state.restartPromptVisible = false;
      hideOverlay();
      state.paused = false;
      clearInput();
    });
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
  const themeKey = level?.theme ?? DEFAULT_THEME_KEY;
  const baseWeights = cloneEnemyWeights(level?.enemyWeights ?? {});
  const behaviour = level?.themeBehaviour ?? getThemeBehaviour(themeKey);
  state.levelContext = {
    enemyWeights: baseWeights,
    mutators: level?.mutators ?? {},
    themeKey,
    themeBehaviour: behaviour,
  };
  applyThemeBehaviourState(behaviour, { baseWeights });
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

function refreshActivePalette() {
  const behaviour = state.levelContext?.themeBehaviour ?? null;
  const palette = applyThemeBehaviourToPalette(activePalette ?? DEFAULT_THEME_PALETTE, behaviour);
  state.renderPalette = palette;
  state.theme = palette;
}

function applyThemeBehaviourState(behaviour, { baseWeights } = {}) {
  const spawnModifiers = behaviour?.spawnModifiers ?? {};
  const weightMultipliers = spawnModifiers.enemyWeightMultipliers ?? null;
  if (baseWeights) {
    state.levelContext.enemyWeights = applyEnemyWeightMultipliers(baseWeights, weightMultipliers);
  } else if (state.levelContext?.enemyWeights) {
    state.levelContext.enemyWeights = applyEnemyWeightMultipliers(
      cloneEnemyWeights(state.levelContext.enemyWeights),
      weightMultipliers,
    );
  }
  const speedMultiplier = clampMultiplier(spawnModifiers.enemySpeedMultiplier, 1);
  const intervalMultiplier = clampMultiplier(spawnModifiers.powerupIntervalMultiplier, 1);
  const durationMultiplier = clampMultiplier(spawnModifiers.powerupDurationMultiplier, 1);
  if (!state.themeFx) {
    state.themeFx = createThemeFxState();
  }
  state.themeFx.enemySpeedMultiplier = speedMultiplier;
  state.themeFx.powerupIntervalMultiplier = intervalMultiplier;
  state.themeFx.powerupDurationMultiplier = durationMultiplier;
  const overlay = behaviour?.overlay ?? null;
  state.themeFx.overlay = overlay
    ? { ...overlay, colours: overlay.colours ? { ...overlay.colours } : {} }
    : null;
  state.themeFx.overlayTime = 0;
  refreshActivePalette();
}

function levelIntro(level) {
  if (state.levelIntroTimeout) {
    clearTimeout(state.levelIntroTimeout);
    state.levelIntroTimeout = null;
  }
  dismissStoryOverlay({ hide: true });
  const themeKey = state.levelContext?.themeKey ?? level?.theme ?? DEFAULT_THEME_KEY;
  if (themeKey) {
    setTheme(themeKey, { persist: false });
  }
  const palette = state.renderPalette ?? getActiveThemePalette() ?? DEFAULT_THEME_PALETTE;
  state.theme = palette;
  const overlayTint = normaliseOverlayTint(level?.overlays?.tint);
  state.levelOverlay = overlayTint && overlayTint.alpha > 0 ? overlayTint : null;
  const starfieldOverrides = level?.starfield ?? {};
  state.starfield = mergeStarfieldConfig(starfieldOverrides);
  clearLevelEntities();
  const mutatorDescriptors = resolveMutatorDescriptors(level?.mutators);
  const behaviour = state.levelContext?.themeBehaviour ?? getThemeBehaviour(themeKey);
  const themeLabel = themeKey ? getThemeLabel(themeKey) : null;
  const themeIcon = behaviour?.icon ?? '';
  const themeSummary = behaviour?.summary ?? '';
  updateLevelChip({
    levelIndex: state.levelIndex,
    name: level?.name ?? null,
    mutators: mutatorDescriptors,
    theme: themeLabel ? { icon: themeIcon, label: themeLabel } : null,
  });
  const overlayName = level?.name ?? `Level ${state.levelIndex}`;
  const themeMarkup = themeLabel
    ? [
        `<p class="level-card__theme" aria-label="Sector theme: ${themeLabel}${themeSummary ? `. ${themeSummary}` : ''}">`,
        themeIcon ? `<span class="level-card__theme-icon" aria-hidden="true">${themeIcon}</span>` : '',
        `<span class="level-card__theme-label">${themeLabel}</span>`,
        themeSummary
          ? `<span class="level-card__theme-divider">—</span><span class="level-card__theme-summary">${themeSummary}</span>`
          : '',
        '</p>',
      ]
        .filter(Boolean)
        .join('')
    : '';
  const mutatorMarkup = mutatorDescriptors.length
    ? mutatorDescriptors
        .map((entry) => `<span class="level-card__mutator" title="${entry.label}" aria-label="${entry.label}">${entry.icon}</span>`)
        .join(' ')
    : '<span class="level-card__mutator" title="Standard Conditions" aria-label="Standard Conditions">✅</span>';
  showOverlay(`
    <div class="level-card" role="status" aria-live="polite">
      <p class="level-card__label">Level ${state.levelIndex}</p>
      <h1>${overlayName}</h1>
      ${themeMarkup}
      <div class="level-card__mutators" role="presentation">
        ${mutatorMarkup}
      </div>
    </div>
  `);
  const storyKey = typeof level?.key === 'string' ? level.key : null;
  const storyIntro = storyKey ? getStoryBeat(storyKey, 'intro') : null;
  const introDuration = storyIntro ? 1200 : 1600;
  state.levelIntroTimeout = window.setTimeout(() => {
    hideOverlay();
    state.levelIntroTimeout = null;
    if (storyIntro) {
      showStoryOverlay(storyIntro);
    }
  }, introDuration);
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

function drawThemeOverlay(viewW, viewH, dt) {
  const overlayConfig = state.themeFx?.overlay;
  if (!overlayConfig) {
    return;
  }
  const fx = state.themeFx;
  const speed = Number.isFinite(overlayConfig.speed) ? overlayConfig.speed : 0.25;
  fx.overlayTime = (fx.overlayTime ?? 0) + dt * speed;
  const time = fx.overlayTime;
  const intensity = Number.isFinite(overlayConfig.intensity)
    ? Math.max(0, overlayConfig.intensity)
    : 0.3;
  ctx.save();
  if (overlayConfig.kind === 'fog') {
    const layers = Math.max(2, Math.floor(overlayConfig.layers ?? 3));
    const colours = overlayConfig.colours ?? {};
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < layers; i++) {
      const progress = (i + 1) / (layers + 1);
      const bandHeight = viewH * 0.5;
      const offset = Math.sin(time * (0.8 + i * 0.22) + i) * 40;
      const y = viewH * progress + offset;
      const gradient = ctx.createLinearGradient(0, y - bandHeight / 2, 0, y + bandHeight / 2);
      gradient.addColorStop(0, colours.far ?? 'rgba(36, 245, 217, 0.08)');
      gradient.addColorStop(0.55, colours.near ?? 'rgba(22, 128, 255, 0.16)');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = Math.max(0, Math.min(1, intensity * (0.7 - i * 0.12)));
      ctx.fillStyle = gradient;
      ctx.fillRect(-viewW * 0.1, y - bandHeight / 2, viewW * 1.2, bandHeight);
      if (colours.highlight) {
        ctx.globalAlpha = Math.max(0, Math.min(1, intensity * 0.35));
        ctx.fillStyle = colours.highlight;
        ctx.fillRect(-viewW * 0.1, y - 6, viewW * 1.2, 12);
      }
    }
  } else if (overlayConfig.kind === 'heat') {
    const colours = overlayConfig.colours ?? {};
    const waves = Math.max(3, Math.floor(overlayConfig.waves ?? 4));
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(6px)';
    for (let i = 0; i < waves; i++) {
      const progress = (i + 0.5) / waves;
      const bandHeight = (viewH / waves) * 1.1;
      const offset = Math.sin(time * (1 + i * 0.18) + progress * Math.PI) * 30;
      const y = viewH * progress + offset;
      const gradient = ctx.createLinearGradient(0, y - bandHeight / 2, 0, y + bandHeight / 2);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.4, colours.warm ?? 'rgba(255, 189, 45, 0.18)');
      gradient.addColorStop(0.7, colours.hot ?? 'rgba(255, 123, 57, 0.24)');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = Math.max(0, Math.min(1, intensity * (0.9 - i * 0.1)));
      ctx.fillStyle = gradient;
      ctx.fillRect(-viewW * 0.05, y - bandHeight / 2, viewW * 1.1, bandHeight);
    }
    ctx.filter = 'none';
    if (colours.highlight) {
      ctx.globalAlpha = Math.max(0, Math.min(1, intensity * 0.35));
      ctx.fillStyle = colours.highlight;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  } else if (overlayConfig.kind === 'laser') {
    const colours = overlayConfig.colours ?? {};
    const spacing = Number.isFinite(overlayConfig.spacing) ? overlayConfig.spacing : 240;
    const bandWidth = spacing * 0.45;
    ctx.globalCompositeOperation = 'lighter';
    const count = Math.ceil((viewW + bandWidth * 2) / spacing) + 3;
    const offset = ((time % 1) * spacing) - spacing;
    for (let i = -2; i < count; i++) {
      const x = i * spacing + offset;
      const gradient = ctx.createLinearGradient(x - bandWidth, 0, x + bandWidth, viewH);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.45, colours.primary ?? 'rgba(0, 229, 255, 0.22)');
      gradient.addColorStop(0.5, colours.secondary ?? 'rgba(255, 61, 247, 0.16)');
      gradient.addColorStop(0.55, colours.primary ?? 'rgba(0, 229, 255, 0.22)');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = Math.max(0, Math.min(1, intensity));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - bandWidth, -viewH * 0.1, bandWidth * 2, viewH * 1.2);
    }
  }
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

function startLevel(levelIndex, options = {}) {
  const { levelOverride = null, stageNumber = null } = options;
  const targetLevel = levelOverride ?? LEVELS[levelIndex - 1] ?? DEFAULT_LEVEL;
  if (!targetLevel) {
    return;
  }
  state.levelIndex = Number.isFinite(stageNumber) ? stageNumber : levelIndex;
  state.level = targetLevel;
  state.levelDur = targetLevel?.duration ?? 0;
  if (state.runStats) {
    state.runStats.highestLevel = Math.max(state.runStats.highestLevel ?? 0, state.levelIndex);
  }
  state.boss = null;
  state.bossType = null;
  state.bossSpawned = false;
  state.midBossSpawned = false;
  state.midBossDefeated = false;
  state.midBossDefeatedAt = 0;
  state.bossDefeatedAt = 0;
  state.bossMercyUntil = 0;
  state.nextWaveIndex = 0;
  state.time = 0;
  state.levelStartScore = state.score;
  state.levelStartTime = performance.now();
  state.levelStartLives = state.lives;
  state.levelStartWeapon = state.weapon ? { ...state.weapon } : null;
  state.passiveScoreCarry = 0;
  resetCombo();
  if (state.gameMode === GAME_MODES.ENDLESS) {
    state.endless.waveCounter = 0;
    state.endless.randomBossActive = false;
  }
  configureLevelContext(targetLevel);
  levelIntro(targetLevel);
  updateScore(state.score);
  GameEvents.emit('score:changed', state.score);
  emitLivesChanged();
  emitWeaponChanged();
  emitPowerChanged(state.power?.name);
  emitShieldChanged(state.player?.shield ?? 0, state.shieldCapacity || getShieldCapacity(state) || SHIELD_BASE_DURATION);
  clearInput();
  state.running = true;
  state.paused = false;
  const spawnConfig = getDifficultyConfig(state.difficultyMode, targetLevel?.key ?? targetLevel);
  startLevelSpawns(spawnConfig);
  dlog('Level start', { level: targetLevel?.key ?? levelIndex, config: spawnConfig });
  GameEvents.emit('level:started', {
    id: targetLevel?.key ?? `L${levelIndex}`,
    index: state.levelIndex,
    name: targetLevel?.name ?? null,
    difficulty: state.difficultyMode,
    config: spawnConfig,
    lives: state.lives,
    shield: { value: state.player?.shield ?? 0, max: state.shieldCapacity || getShieldCapacity(state) || SHIELD_BASE_DURATION },
    score: state.score,
    weapon: state.weapon ? { name: state.weapon.name ?? 'Weapon', icon: state.weapon.icon ?? state.weapon.symbol ?? null } : 'None',
    powerup: state.power?.name ? state.power.name.toUpperCase() : 'None',
  });
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function startRun(levelIndex = 1, options = {}) {
  const { gameMode = GAME_MODES.CAMPAIGN } = options;
  atMenuScreen = false;
  optionsOverlayOpen = false;
  optionsOverlayCloseHandler = null;
  state.gameMode = gameMode;
  state.difficultyMode = getDifficultyMode();
  applyDifficultyMode(state.difficultyMode);
  state.settings.difficulty = state.difficultyMode;
  state.assistEnabled = getAssistMode();
  const selectedShipKey = getSelectedShipKey() || defaultShipKey;
  const selectedShip = getShipByKey(selectedShipKey) ?? getShipByKey(defaultShipKey);
  state.ship = selectedShip;
  state.runUpgrades = createRunUpgradeState();
  state.lives = state.assistEnabled ? 4 : 3;
  state.score = 0;
  state.levelStartScore = 0;
  state.levelStartTime = performance.now();
  state.passiveScoreCarry = 0;
  state.power = { name: null, until: 0 };
  resetCombo();
  emitLivesChanged();
  updateScore(state.score);
  GameEvents.emit('score:changed', state.score);
  emitPowerChanged('None');
  resetPlayer(state, state.ship);
  const initialStage = gameMode === GAME_MODES.ENDLESS ? 1 : levelIndex;
  state.runStats = createRunStats({ level: initialStage, shipKey: selectedShip?.key ?? defaultShipKey });
  const baseShield = Math.max(0, state.player?.baseShield ?? 0);
  state.shieldCapacity = baseShield;
  if (state.player) {
    state.player.shield = baseShield;
    state.player.speed = Math.max(120, state.player.baseSpeed ?? state.player.speed ?? 260);
  }
  emitShieldChanged(baseShield, Math.max(baseShield, 1));
  setupWeapons(state);
  emitWeaponChanged();
  state.endless.totalTime = 0;
  if (gameMode === GAME_MODES.ENDLESS) {
    resetEndlessState();
    state.runStats.highestLevel = state.endless.stage;
    const override = createEndlessLevelOverride();
    startLevel(1, { levelOverride: override, stageNumber: state.endless.stage });
  } else {
    state.endless.active = false;
    const nextLevel = Math.max(1, Math.min(LEVELS.length, Math.floor(levelIndex)));
    startLevel(nextLevel);
  }
}

function buildUpgradePoolForState() {
  const pool = [
    {
      id: 'fire-rate',
      title: 'Overclock Cannons',
      description: 'Increase fire rate by 10%.',
    },
    {
      id: 'shield-duration',
      title: 'Barrier Harmoniser',
      description: 'Shield power-ups last 20% longer.',
    },
    {
      id: 'move-speed',
      title: 'Engine Calibration',
      description: 'Ship acceleration +8%.',
    },
    {
      id: 'duplicate',
      title: 'Duplicate Converter',
      description: 'Choose the reward for duplicate weapon tokens.',
    },
  ];
  const lifeCap = getLifeCap(state);
  if (state.lives < lifeCap) {
    pool.splice(1, 0, {
      id: 'life',
      title: 'Hull Plating',
      description: `Gain +1 life (cap ${lifeCap}).`,
    });
  }
  return pool;
}

function sampleUpgradesFromPool(pool, count) {
  const sample = pool.slice();
  for (let i = sample.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sample[i], sample[j]] = [sample[j], sample[i]];
  }
  const limit = Math.min(count, sample.length);
  return sample.slice(0, limit);
}

function applyRunUpgrade(upgradeId, { choice } = {}) {
  switch (upgradeId) {
    case 'fire-rate': {
      const current = state.runUpgrades?.fireRateMultiplier ?? 1;
      const next = Math.max(MIN_FIRE_RATE_MULTIPLIER, current * FIRE_RATE_STEP);
      state.runUpgrades.fireRateMultiplier = next;
      state.lastShot = 0;
      return 'FIRE RATE +10%';
    }
    case 'life': {
      const cap = getLifeCap(state);
      state.lives = Math.min(cap, (state.lives ?? 0) + 1);
      emitLivesChanged();
      return 'LIFE +1';
    }
    case 'shield-duration': {
      const currentMultiplier = state.runUpgrades?.shieldDurationMultiplier ?? 1;
      const nextMultiplier = Math.min(
        MAX_SHIELD_DURATION_MULTIPLIER,
        currentMultiplier * SHIELD_DURATION_STEP,
      );
      const oldCapacity = SHIELD_BASE_DURATION * currentMultiplier;
      const newCapacity = SHIELD_BASE_DURATION * nextMultiplier;
      state.runUpgrades.shieldDurationMultiplier = nextMultiplier;
      if (state.power.name === 'shield' && state.player) {
        const bonus = Math.max(0, newCapacity - oldCapacity);
        const now = performance.now();
        const remainingTime = Math.max(0, state.power.until - now);
        const newRemaining = Math.min(newCapacity, remainingTime + bonus);
        const existingCharge = Math.max(state.player.shield ?? remainingTime, 0);
        const newCharge = Math.min(newCapacity, existingCharge + bonus);
        state.power.until = now + newRemaining;
        state.player.shield = newCharge;
        state.shieldCapacity = newCapacity;
        emitShieldChanged(newCharge, newCapacity);
      }
      return 'SHIELD DURATION +20%';
    }
    case 'move-speed': {
      const current = state.runUpgrades?.moveSpeedMultiplier ?? 1;
      const next = Math.min(MAX_MOVE_SPEED_MULTIPLIER, current * MOVE_SPEED_STEP);
      state.runUpgrades.moveSpeedMultiplier = next;
      return 'MOVE SPEED +8%';
    }
    case 'duplicate': {
      const selected = choice === 'shield' ? 'shield' : 'score';
      state.runUpgrades.duplicateConversion = selected;
      return selected === 'shield' ? 'DUPES → +50% SHIELD' : 'DUPES → +500 SCORE';
    }
    default:
      return null;
  }
}

function renderUpgradeSelection({ nextLevelIndex, nextLevel, levelTime, scoreDelta }) {
  atMenuScreen = false;
  optionsOverlayOpen = false;
  optionsOverlayCloseHandler = null;
  const options = sampleUpgradesFromPool(buildUpgradePoolForState(), 3);
  if (!options.length) {
    startLevel(nextLevelIndex);
    return;
  }
  const nextLabel = nextLevel
    ? `Level ${nextLevelIndex}: ${nextLevel.name}`
    : `Level ${nextLevelIndex}`;
  const currentDuplicate = state.runUpgrades?.duplicateConversion === 'shield'
    ? '+50% Shield'
    : '+500 Score';
  let autoFocusAssigned = false;
  const cards = options.map((upgrade) => {
    if (upgrade.id === 'duplicate') {
      const scoreFocus = autoFocusAssigned ? '' : ' autofocus';
      autoFocusAssigned = true;
      return `
        <div class="upgrade-card upgrade-card--choice" data-upgrade-card="duplicate">
          <p class="upgrade-card__title">${upgrade.title}</p>
          <p class="upgrade-card__desc">${upgrade.description}</p>
          <p class="upgrade-card__meta">Current: ${currentDuplicate}</p>
          <div class="upgrade-card__actions">
            <button type="button" class="btn" data-upgrade="duplicate" data-choice="score"${scoreFocus}>+500 Score</button>
            <button type="button" class="btn" data-upgrade="duplicate" data-choice="shield">+50% Shield</button>
          </div>
        </div>
      `;
    }
    const focusAttr = autoFocusAssigned ? '' : ' autofocus';
    autoFocusAssigned = true;
    return `
      <button type="button" class="upgrade-card" data-upgrade="${upgrade.id}"${focusAttr}>
        <span class="upgrade-card__title">${upgrade.title}</span>
        <span class="upgrade-card__desc">${upgrade.description}</span>
      </button>
    `;
  }).join('');
  const levelName = state.level?.name ?? 'Sector';
  recordBestScore(state.score);
  showOverlay(`
    <h1><span class="cyan">LEVEL ${state.levelIndex} COMPLETE</span></h1>
    <p>${levelName} cleared in <strong>${levelTime}s</strong>. Score gained: <strong>${Math.max(0, scoreDelta)}</strong> · Total Score: <strong>${state.score}</strong></p>
    <p>Select one upgrade for <strong>${nextLabel}</strong>.</p>
    <div class="upgrade-grid">${cards}</div>
    <div class="overlay-actions">
      <button id="restart-level" class="btn">Restart Level ${state.levelIndex}</button>
      <button id="summary-menu" class="btn btn-secondary">Menu</button>
    </div>
  `);
  const restart = document.getElementById('restart-level');
  restart?.addEventListener('click', () => {
    resetGame(state.levelIndex);
  });
  const menuBtn = document.getElementById('summary-menu');
  menuBtn?.addEventListener('click', () => {
    recordRunEnd({ score: state.score, bossesDefeated: state.runStats?.bosses ?? 0 });
    state.runStats = createRunStats({ shipKey: state.ship?.key ?? defaultShipKey });
    setAppState(APP_VIEW_STATES.MENU);
  });
  let handled = false;
  const buttons = Array.from(document.querySelectorAll('button[data-upgrade]'));
  const handleSelection = (id, choice) => {
    if (handled) {
      return;
    }
    if (id === 'duplicate' && !choice) {
      return;
    }
    handled = true;
    buttons.forEach((btn) => btn.setAttribute('disabled', 'disabled'));
    const message = applyRunUpgrade(id, { choice });
    hideOverlay();
    if (message) {
      showToast(message, 1100);
    }
    startLevel(nextLevelIndex);
  };
  buttons.forEach((btn) => {
    const id = btn.getAttribute('data-upgrade');
    const choice = btn.getAttribute('data-choice');
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      handleSelection(id, choice);
    });
  });
}

function buildAchievementSnapshot(levelKey) {
  const resolvedLevel = typeof levelKey === 'string' && levelKey.trim().length > 0 ? levelKey.trim() : null;
  return {
    kills: state.runStats?.kills ?? 0,
    bossesDefeated: state.runStats?.bosses ?? 0,
    livesLost: state.runStats?.livesLost ?? 0,
    score: state.score ?? 0,
    level: resolvedLevel,
  };
}

function announceAchievementUnlocks(unlocked = []) {
  unlocked.forEach((achievement, index) => {
    const name = achievement?.name ?? 'Achievement';
    const message = `Achievement Unlocked: ${name}`;
    if (typeof window !== 'undefined' && index > 0) {
      window.setTimeout(() => {
        showToast(message, 1400);
      }, index * 200);
    } else {
      showToast(message, 1400);
    }
  });
}

function evaluateAchievementsForLevel(levelKey) {
  const snapshot = buildAchievementSnapshot(levelKey);
  const { unlocked } = evaluateAchievements(snapshot);
  if (unlocked.length > 0) {
    announceAchievementUnlocks(unlocked);
  }
}

function completeLevel() {
  state.running = false;
  state.paused = false;
  const levelTime = Math.floor(state.time);
  const scoreDelta = state.score - (state.levelStartScore ?? 0);
  const nextLevelIndex = state.levelIndex + 1;
  const currentLevel = state.level;
  const levelId = currentLevel?.key ?? `L${state.levelIndex}`;
  applyLevelMutators({});
  clearLevelEntities();
  updateScore(state.score);
  GameEvents.emit('score:changed', state.score);
  emitLivesChanged();
  if (state.gameMode === GAME_MODES.ENDLESS) {
    dlog('Level end', { id: levelId, reason: 'completed', time: levelTime, score: state.score });
    GameEvents.emit('level:ended', {
      id: levelId,
      index: state.levelIndex,
      reason: 'completed',
      time: levelTime,
      score: state.score,
      nextLevel: null,
    });
    evaluateAchievementsForLevel(levelId);
    if (!LEVELS.length) {
      gameOver();
      return;
    }
    advanceEndlessProgression();
    const levelsCount = LEVELS.length;
    const pointer = ((state.endless.levelPointer % levelsCount) + levelsCount) % levelsCount;
    const stageNumber = state.endless.stage;
    const override = createEndlessLevelOverride();
    startLevel(pointer + 1, { levelOverride: override, stageNumber });
    return;
  }
  if (nextLevelIndex <= LEVELS.length) {
    unlockLevel(nextLevelIndex);
  }
  const nextLevel = LEVELS[nextLevelIndex - 1] ?? null;
  dlog('Level end', { id: levelId, reason: 'completed', time: levelTime, score: state.score });
  GameEvents.emit('level:ended', {
    id: levelId,
    index: state.levelIndex,
    reason: 'completed',
    time: levelTime,
    score: state.score,
    nextLevel: nextLevelIndex <= LEVELS.length ? nextLevelIndex : null,
  });
  evaluateAchievementsForLevel(levelId);
  if (state.levelIndex === 3 && !isPaletteUnlocked('cosmic-abyss')) {
    unlockPalette('cosmic-abyss');
    populateThemeUnlocks();
  }
  if (nextLevel) {
    renderUpgradeSelection({
      nextLevelIndex,
      nextLevel,
      levelTime,
      scoreDelta,
    });
    return;
  }
  const header = `LEVEL ${state.levelIndex} COMPLETE`;
  const restartLabel = `Restart Level ${state.levelIndex}`;
  recordRunEnd({ score: state.score, bossesDefeated: state.runStats?.bosses ?? 0 });
  state.runStats = createRunStats({ shipKey: state.ship?.key ?? defaultShipKey });
  recordBestScore(state.score);
  showOverlay(`
    <h1><span class="cyan">${header}</span></h1>
    <p>${currentLevel?.name ?? 'Sector'} cleared in <strong>${levelTime}s</strong>.</p>
    <p>Score gained: <strong>${Math.max(0, scoreDelta)}</strong> · Total Score: <strong>${state.score}</strong></p>
    <div class="overlay-actions">
      <button id="restart-level" class="btn" autofocus>${restartLabel}</button>
      <button id="summary-menu" class="btn btn-secondary">Menu</button>
    </div>
  `);
  document.getElementById('restart-level')?.addEventListener('click', () => {
    resetGame(state.levelIndex);
  });
  document.getElementById('summary-menu')?.addEventListener('click', () => {
    setAppState(APP_VIEW_STATES.MENU);
  });
}

function gameOver() {
  atMenuScreen = false;
  optionsOverlayOpen = false;
  optionsOverlayCloseHandler = null;
  state.running = false;
  state.paused = false;
  const levelTime = Math.floor(state.time);
  const scoreDelta = state.score - (state.levelStartScore ?? 0);
  const levelName = state.level?.name ?? 'Sector';
  recordRunEnd({ score: state.score, bossesDefeated: state.runStats?.bosses ?? 0 });
  state.runStats = createRunStats({ shipKey: state.ship?.key ?? defaultShipKey });
  applyLevelMutators({});
  clearLevelEntities();
  updateScore(state.score);
  GameEvents.emit('score:changed', state.score);
  emitLivesChanged();
  recordBestScore(state.score);
  const levelId = state.level?.key ?? `L${state.levelIndex}`;
  dlog('Level end', { id: levelId, reason: 'player-dead', time: levelTime, score: state.score });
  GameEvents.emit('level:ended', {
    id: levelId,
    index: state.levelIndex,
    reason: 'player-dead',
    time: levelTime,
    score: state.score,
  });
  evaluateAchievementsForLevel(levelId);
  if (state.gameMode === GAME_MODES.ENDLESS) {
    const survivalTime = Math.max(Math.floor(state.endless?.totalTime ?? 0), levelTime);
    const bests = recordEndlessResult({ score: state.score, time: survivalTime });
    bestEndlessScore = Math.max(0, bests.score ?? bestEndlessScore);
    bestEndlessTime = Math.max(0, bests.time ?? bestEndlessTime);
    state.endless.active = false;
    showOverlay(`
      <h1><span class="cyan">ENDLESS RUN TERMINATED</span></h1>
      <p>Final Score: <strong>${formatNumber(state.score)}</strong></p>
      <p>Longest Time Survived: <strong>${formatNumber(survivalTime)}s</strong></p>
      <p>Personal Best — Score: <strong>${formatNumber(bestEndlessScore)}</strong> · Time: <strong>${formatNumber(bestEndlessTime)}s</strong></p>
      <div class="overlay-actions">
        <button id="restart-level" class="btn" autofocus>Retry Endless</button>
        <button id="overlay-menu" class="btn btn-secondary">Menu</button>
      </div>
    `);
    document.getElementById('restart-level')?.addEventListener('click', () => {
      startRun(1, { gameMode: GAME_MODES.ENDLESS });
    });
  } else {
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
  }
  document.getElementById('overlay-menu')?.addEventListener('click', () => {
    setAppState(APP_VIEW_STATES.MENU, { resetHud: true });
  });
}

function formatNumber(value) {
  const numeric = Number.isFinite(value) ? value : Number.parseInt(value ?? 0, 10);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return numeric.toLocaleString();
}

function getShipUnlockInfo(ship, progress) {
  const unlockedShips = Array.isArray(progress?.shipsUnlocked) ? progress.shipsUnlocked : [];
  const unlocked = unlockedShips.includes(ship.key);
  const info = {
    unlocked,
    requirement: null,
    progressText: null,
  };
  if (unlocked || !ship.unlock || ship.unlock.type === 'default') {
    return info;
  }
  if (ship.unlock.type === 'bosses') {
    const target = Math.max(1, Number.isFinite(ship.unlock.count) ? ship.unlock.count : 0);
    const current = Math.max(0, Number.isFinite(progress?.bossesDefeated) ? progress.bossesDefeated : 0);
    info.requirement = ship.unlock.description ?? `Defeat ${target} bosses to unlock.`;
    info.progressText = `${Math.min(current, target)} / ${target} bosses defeated`;
    return info;
  }
  if (ship.unlock.type === 'score') {
    const target = Math.max(0, Number.isFinite(ship.unlock.score) ? ship.unlock.score : 0);
    const current = Math.max(0, Number.isFinite(progress?.totalScore) ? progress.totalScore : 0);
    info.requirement = ship.unlock.description ?? `Accumulate ${formatNumber(target)} total score.`;
    info.progressText = `${formatNumber(Math.min(current, target))} / ${formatNumber(target)} score banked`;
    return info;
  }
  info.requirement = getShipRequirement(ship);
  return info;
}

function buildShipCard(ship, progress, selectedKey, { interactive = true } = {}) {
  const info = getShipUnlockInfo(ship, progress);
  const stats = getShipDisplayStats(ship);
  const statsMarkup = stats
    .map((entry) => `<li class="ship-card__stat"><span class="ship-card__stat-label">${entry.label}</span><span class="ship-card__stat-value">${entry.value}</span></li>`)
    .join('');
  const statusLabel = ship.key === selectedKey
    ? 'Selected'
    : info.unlocked
      ? 'Unlocked'
      : 'Locked';
  const statusClass = ship.key === selectedKey
    ? 'ship-card__status--selected'
    : info.unlocked
      ? 'ship-card__status--unlocked'
      : 'ship-card__status--locked';
  const statusMarkup = `<span class="ship-card__status ${statusClass}">${statusLabel}</span>`;
  const header = `<div class="ship-card__header"><span class="ship-card__name">${ship.name}</span>${ship.role ? `<span class="ship-card__role">${ship.role}</span>` : ''}</div>`;
  const difficulty = ship.difficulty ? `<span class="ship-card__badge">${ship.difficulty}</span>` : '';
  const description = `<p class="ship-card__desc">${ship.description}</p>`;
  const statsBlock = `<ul class="ship-card__stats">${statsMarkup}</ul>`;
  const requirement = !info.unlocked && info.requirement
    ? `<p class="ship-card__lock">${info.requirement}</p>`
    : '';
  const progressLine = !info.unlocked && info.progressText
    ? `<p class="ship-card__progress">${info.progressText}</p>`
    : '';
  const classes = ['ship-card'];
  if (!info.unlocked) {
    classes.push('ship-card--locked');
  }
  if (ship.key === selectedKey) {
    classes.push('is-selected');
  }
  const content = `
    ${statusMarkup}
    ${header}
    ${difficulty}
    ${description}
    ${statsBlock}
    ${requirement}
    ${progressLine}
  `;
  if (info.unlocked && interactive) {
    return `<button type="button" class="${classes.join(' ')}" data-ship-option="${ship.key}" aria-pressed="${ship.key === selectedKey ? 'true' : 'false'}">${content}</button>`;
  }
  const attrs = [`class="${classes.join(' ')}"`, `data-ship-option="${ship.key}"`];
  if (!info.unlocked) {
    attrs.push('data-locked="true"', 'aria-disabled="true"');
  }
  return `<div ${attrs.join(' ')}>${content}</div>`;
}

function buildShipCards(progress, selectedKey, { interactive = true } = {}) {
  return SHIP_CATALOGUE.map((ship) => buildShipCard(ship, progress, selectedKey, { interactive })).join('');
}

function bindShipSelectionHandlers({ context = 'start' } = {}) {
  const cards = Array.from(document.querySelectorAll('[data-ship-option]'));
  cards.forEach((card) => {
    const key = card.getAttribute('data-ship-option');
    if (!key || card.hasAttribute('data-locked')) {
      return;
    }
    card.addEventListener('click', () => {
      const previous = getSelectedShipKey() || defaultShipKey;
      if (previous === key) {
        return;
      }
      setSelectedShip(key);
      if (context === 'garage') {
        renderGarageOverlay();
      } else {
        setAppState(APP_VIEW_STATES.MENU, { force: true });
      }
    });
  });
}

function populateThemeUnlocks() {
  if (typeof refreshThemeOptions === 'function') {
    refreshThemeOptions();
  }
}

function renderGarageOverlay() {
  populateThemeUnlocks();
  const progress = getMetaProgress();
  const selectedKey = getSelectedShipKey() || defaultShipKey;
  const shipGrid = buildShipCards(progress, selectedKey);
  const runs = formatNumber(progress.totalRuns);
  const score = formatNumber(progress.totalScore);
  const bosses = formatNumber(progress.bossesDefeated);
  const cosmicUnlocked = isPaletteUnlocked('cosmic-abyss');
  const cosmicStatus = cosmicUnlocked ? 'Unlocked' : 'Locked';
  const cosmicHint = cosmicUnlocked
    ? 'Abyssal hues ready for deployment.'
    : `Clear Level 3 to unlock. Highest unlocked level: L${highestUnlockedLevel}`;
  showOverlay(`
    <h1>GARAGE</h1>
    <p class="garage-summary">Runs: <strong>${runs}</strong> · Banked Score: <strong>${score}</strong> · Bosses Defeated: <strong>${bosses}</strong></p>
    <div class="garage-section">
      <h2 class="garage-section__title">Ships</h2>
      <div class="ship-select__grid ship-select__grid--garage">${shipGrid}</div>
    </div>
    <div class="garage-section">
      <h2 class="garage-section__title">Unlockables</h2>
      <div class="garage-upgrades">
        <div class="garage-upgrade${cosmicUnlocked ? ' garage-upgrade--unlocked' : ''}">
          <div class="garage-upgrade__title">Cosmic Abyss Palette</div>
          <div class="garage-upgrade__status">${cosmicStatus}</div>
          <p class="garage-upgrade__hint">${cosmicHint}</p>
        </div>
      </div>
    </div>
    <div class="overlay-actions">
      <button id="garage-back" class="btn">Back</button>
    </div>
  `);
  document.getElementById('garage-back')?.addEventListener('click', () => {
    setAppState(APP_VIEW_STATES.MENU);
  });
  bindShipSelectionHandlers({ context: 'garage' });
}

function renderAchievementsOverlay() {
  const progress = getAchievementProgress();
  const total = progress.length;
  const earned = progress.filter((entry) => entry.earned).length;
  const listItems = progress
    .map((entry) => {
      const statusIcon = entry.earned ? '✓' : '✗';
      const itemClass = entry.earned ? 'achievement-list__item achievement-list__item--earned' : 'achievement-list__item';
      const statusClass = entry.earned
        ? 'achievement-list__status achievement-list__status--earned'
        : 'achievement-list__status';
      const description = entry.description
        ? `<span class="achievement-list__desc">${entry.description}</span>`
        : '';
      return `
        <li class="${itemClass}">
          <span class="${statusClass}" aria-hidden="true">${statusIcon}</span>
          <span class="achievement-list__details">
            <span class="achievement-list__name">${entry.name}</span>
            ${description}
          </span>
        </li>
      `;
    })
    .join('');
  const listMarkup = total
    ? `<ul class="achievement-list" role="list">${listItems}</ul>`
    : '<p class="achievements-empty">No achievements logged yet.</p>';
  showOverlay(`
    <h1>Achievements</h1>
    <p class="achievements-summary">Unlocked <strong>${earned}</strong> of <strong>${total}</strong>.</p>
    ${listMarkup}
    <div class="overlay-actions">
      <button id="achievements-back" class="btn" autofocus>Back</button>
    </div>
  `);
  document.getElementById('achievements-back')?.addEventListener('click', () => {
    setAppState(APP_VIEW_STATES.MENU);
  });
}


function renderStartOverlay({ resetHud = false } = {}) {
  atMenuScreen = true;
  optionsOverlayOpen = false;
  optionsOverlayCloseHandler = null;
  state.running = false;
  state.paused = false;
  populateThemeUnlocks();
  state.runStats = createRunStats({ shipKey: state.ship?.key ?? initialShip?.key ?? defaultShipKey });
  state.endless.active = false;
  state.endless.totalTime = 0;
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
  GameEvents.emit('score:changed', state.score);
  emitLivesChanged();
  highestUnlockedLevel = clampLevelIndex(getMetaValue('highestUnlockedLevel', highestUnlockedLevel));
  const storedBest = Number.parseInt(getMetaValue('bestScore', bestScore), 10);
  if (Number.isFinite(storedBest) && storedBest >= 0) {
    bestScore = Math.max(bestScore, storedBest);
  }
  const storedEndless = getEndlessPersonalBests();
  if (Number.isFinite(storedEndless.score) && storedEndless.score >= 0) {
    bestEndlessScore = Math.max(bestEndlessScore, storedEndless.score);
  }
  if (Number.isFinite(storedEndless.time) && storedEndless.time >= 0) {
    bestEndlessTime = Math.max(bestEndlessTime, storedEndless.time);
  }
  const hasProgress = highestUnlockedLevel > 1;
  const unlockedLevels = LEVELS.slice(0, highestUnlockedLevel);
  const levelButtons = unlockedLevels
    .map((level, index) => {
      const levelNumber = index + 1;
      return `<button class="level-select__btn" data-level="${levelNumber}">L${levelNumber} · ${level.name}</button>`;
    })
    .join('');
  const metaProgress = getMetaProgress();
  const selectedShipKey = getSelectedShipKey() || defaultShipKey;
  const achievementsProgress = getAchievementProgress();
  const earnedAchievements = achievementsProgress.filter((entry) => entry.earned).length;
  const bestScoreLine = hasProgress || bestScore > 0
    ? `Best Score <strong>${formatNumber(bestScore)}</strong> · Highest Sector <strong>L${highestUnlockedLevel}</strong>`
    : '';
  const endlessSummaryLine = bestEndlessScore > 0 || bestEndlessTime > 0
    ? `Endless Best · Score <strong>${formatNumber(bestEndlessScore)}</strong> · Time <strong>${formatNumber(bestEndlessTime)}s</strong>`
    : '';
  const metaSummaryLine = `Runs <strong>${formatNumber(metaProgress.totalRuns)}</strong> · Banked Score <strong>${formatNumber(metaProgress.totalScore)}</strong> · Bosses Defeated <strong>${formatNumber(metaProgress.bossesDefeated)}</strong>`;
  const achievementsSummaryLine = achievementsProgress.length
    ? `Achievements <strong>${earnedAchievements}</strong> / <strong>${achievementsProgress.length}</strong>`
    : '';
  const statsMarkup = [bestScoreLine, endlessSummaryLine, metaSummaryLine, achievementsSummaryLine]
    .filter((line) => typeof line === 'string' && line.trim().length > 0)
    .map((line) => `<p>${line}</p>`)
    .join('');
  const unlockedShips = getUnlockedShips();
  const unlockedShipSet = new Set(unlockedShips);
  const totalShips = SHIP_CATALOGUE.length;
  const shipChipsMarkup = SHIP_CATALOGUE
    .map((ship) => {
      const unlocked = unlockedShipSet.has(ship.key);
      const isSelected = ship.key === selectedShipKey;
      const classes = ['meta-menu__chip'];
      if (unlocked) {
        classes.push('is-active');
      } else {
        classes.push('is-locked');
      }
      if (isSelected) {
        classes.push('is-selected');
      }
      const status = isSelected ? 'selected' : unlocked ? 'unlocked' : 'locked';
      const requirement = getShipRequirement(ship);
      const hint = isSelected
        ? 'Selected ship'
        : unlocked
          ? 'Unlocked ship'
          : requirement ?? 'Locked ship';
      const title = hint ? ` title="${hint.replace(/"/g, '&quot;')}"` : '';
      return `<span class="${classes.join(' ')}" data-status="${status}"${title}>${ship.name}</span>`;
    })
    .join('');
  const themeKeys = getThemeKeys();
  const activeThemeKey = getActiveThemeKey();
  const cosmicUnlocked = isPaletteUnlocked('cosmic-abyss');
  const cosmicHint = cosmicUnlocked
    ? 'Cosmic Abyss unlocked.'
    : `Clear Level 3 to unlock. Highest unlocked: L${highestUnlockedLevel}`;
  const themeEntries = themeKeys.map((key) => {
    const unlocked = key === 'cosmic-abyss' ? cosmicUnlocked : true;
    const hint = key === 'cosmic-abyss' ? cosmicHint : 'Theme unlocked';
    return {
      key,
      label: getThemeLabel(key),
      unlocked,
      hint,
    };
  });
  const unlockedThemeCount = themeEntries.filter((entry) => entry.unlocked).length;
  const themeChipsMarkup = themeEntries
    .map((entry) => {
      const classes = ['meta-menu__chip'];
      if (entry.unlocked) {
        classes.push('is-active');
      } else {
        classes.push('is-locked');
      }
      if (entry.key === activeThemeKey) {
        classes.push('is-selected');
      }
      return `<span class="${classes.join(' ')}" data-theme-chip="${entry.key}" title="${entry.hint}">${entry.label}</span>`;
    })
    .join('');
  const achievementChipsMarkup = achievementsProgress.length
    ? achievementsProgress
        .map((entry) => {
          const classes = ['meta-menu__chip'];
          if (entry.earned) {
            classes.push('is-active');
          } else {
            classes.push('is-locked');
          }
          const status = entry.earned ? 'earned' : 'locked';
          const desc = entry.description ? ` title="${entry.description.replace(/"/g, '&quot;')}"` : '';
          return `<span class="${classes.join(' ')}" data-status="${status}"${desc}>${entry.name}</span>`;
        })
        .join('')
    : '<p class="meta-detail__summary">Log runs to unlock achievements.</p>';
  let storedSelectionId = null;
  if (typeof window !== 'undefined') {
    try {
      storedSelectionId = window.localStorage?.getItem(MENU_SELECTION_STORAGE_KEY) ?? null;
    } catch (err) {
      storedSelectionId = null;
    }
  }
  const menuItems = [
    {
      id: 'campaign',
      label: 'Start Campaign',
      onActivate: () => {
        const targetLevel = hasProgress ? highestUnlockedLevel : 1;
        setAppState(APP_VIEW_STATES.GAMEPLAY, { level: targetLevel });
      },
      detail: () => {
        const primaryButton = hasProgress
          ? `<button id="meta-campaign-continue" class="btn" data-primary-action>Continue L${highestUnlockedLevel}</button>`
          : `<button id="meta-campaign-start" class="btn" data-primary-action>Launch Level 1</button>`;
        const restartButton = hasProgress
          ? `<button id="meta-campaign-restart" class="btn btn-secondary">Start Level 1</button>`
          : '';
        const toggleButton = `<button id="meta-campaign-toggle" class="btn btn-secondary" aria-expanded="false">Select Sector</button>`;
        const levelPanel = `<div id="meta-campaign-levels" class="level-select" hidden><p class="level-select__label">Unlocked Levels</p><div class="level-select__grid">${levelButtons}</div></div>`;
        const desc = hasProgress
          ? 'Resume your deepest unlocked sector or revisit previous encounters.'
          : 'Launch the story campaign and carve through escalating sectors.';
        const campaignStatsBlock = bestScoreLine
          ? `<p class="meta-detail__summary">${bestScoreLine}</p>`
          : '';
        const metaStatsBlock = metaSummaryLine
          ? `<p class="meta-detail__summary">${metaSummaryLine}</p>`
          : '';
        return {
          html: `
            <div class="meta-detail" data-meta-detail="campaign">
              <h2 class="meta-detail__title">Campaign</h2>
              <p class="meta-detail__desc">${desc}</p>
              ${campaignStatsBlock}
              ${metaStatsBlock}
              <div class="meta-detail__actions">
                ${primaryButton}
                ${restartButton}
                ${toggleButton}
              </div>
              ${levelPanel}
              <div class="difficulty-select">
                <label class="difficulty-select__label" for="difficulty-select">Difficulty</label>
                <select id="difficulty-select" class="difficulty-select__control">
                  <option value="easy">Easy · 85% density / 90% speed</option>
                  <option value="normal">Normal · Original balance</option>
                  <option value="hard">Hard · 120% density / 110% speed</option>
                </select>
                <p class="difficulty-select__hint">Adjust density, speed, and boss durability.</p>
              </div>
            </div>
          `,
          onMount: () => {
            document.getElementById('meta-campaign-continue')?.addEventListener('click', () => {
              setAppState(APP_VIEW_STATES.GAMEPLAY, { level: highestUnlockedLevel });
            });
            document.getElementById('meta-campaign-start')?.addEventListener('click', () => {
              setAppState(APP_VIEW_STATES.GAMEPLAY, { level: 1 });
            });
            document.getElementById('meta-campaign-restart')?.addEventListener('click', () => {
              setAppState(APP_VIEW_STATES.GAMEPLAY, { level: 1 });
            });
            const toggle = document.getElementById('meta-campaign-toggle');
            const levelPanelElement = document.getElementById('meta-campaign-levels');
            toggle?.addEventListener('click', () => {
              if (!levelPanelElement) {
                return;
              }
              const hidden = levelPanelElement.hasAttribute('hidden');
              if (hidden) {
                levelPanelElement.removeAttribute('hidden');
                toggle.setAttribute('aria-expanded', 'true');
                const firstLevelButton = levelPanelElement.querySelector('button:not([disabled])');
                firstLevelButton?.focus();
              } else {
                levelPanelElement.setAttribute('hidden', '');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
              }
            });
            levelPanelElement?.querySelectorAll('[data-level]').forEach((btn) => {
              const element = btn;
              const levelNumber = Number.parseInt(element.getAttribute('data-level') ?? '', 10);
              if (!Number.isFinite(levelNumber)) {
                return;
              }
              element.addEventListener('click', () => {
                setAppState(APP_VIEW_STATES.GAMEPLAY, { level: levelNumber });
              });
            });
            bindDifficultySelect();
          },
        };
      },
    },
    {
      id: 'endless',
      label: 'Endless Mode',
      onActivate: () => {
        setAppState(APP_VIEW_STATES.ENDLESS);
      },
      detail: () => {
        const endlessStatsBlock = endlessSummaryLine
          ? `<p class="meta-detail__summary">${endlessSummaryLine}</p>`
          : '<p class="meta-detail__summary">Face infinite waves for escalating score.</p>';
        return {
          html: `
            <div class="meta-detail" data-meta-detail="endless">
              <h2 class="meta-detail__title">Endless Mode</h2>
              <p class="meta-detail__desc">Survive escalating swarms and chase personal records.</p>
              ${endlessStatsBlock}
              <div class="meta-detail__actions">
                <button id="meta-endless-start" class="btn" data-primary-action>Launch Endless Run</button>
              </div>
            </div>
          `,
          onMount: () => {
            document.getElementById('meta-endless-start')?.addEventListener('click', () => {
              setAppState(APP_VIEW_STATES.ENDLESS);
            });
          },
        };
      },
    },
    {
      id: 'garage',
      label: 'Garage',
      onActivate: () => {
        setAppState(APP_VIEW_STATES.GARAGE);
      },
      detail: () => ({
        html: `
          <div class="meta-detail" data-meta-detail="garage">
            <h2 class="meta-detail__title">Garage</h2>
            <p class="meta-detail__desc">Review ships, swap loadouts, and inspect unlock progress.</p>
            <div class="meta-detail__chips">${shipChipsMarkup}</div>
            <div class="meta-detail__actions">
              <button id="meta-garage-open" class="btn" data-primary-action>Enter Garage</button>
            </div>
          </div>
        `,
        onMount: () => {
          document.getElementById('meta-garage-open')?.addEventListener('click', () => {
            setAppState(APP_VIEW_STATES.GARAGE);
          });
        },
      }),
    },
    {
      id: 'achievements',
      label: 'Achievements',
      onActivate: () => {
        setAppState(APP_VIEW_STATES.ACHIEVEMENTS);
      },
      detail: () => ({
        html: `
          <div class="meta-detail" data-meta-detail="achievements">
            <h2 class="meta-detail__title">Achievements</h2>
            <p class="meta-detail__desc">Track feats earned during your runs.</p>
            <div class="meta-detail__chips">${achievementChipsMarkup}</div>
            <div class="meta-detail__actions">
              <button id="meta-achievements-open" class="btn" data-primary-action>View Achievements</button>
            </div>
          </div>
        `,
        onMount: () => {
          document.getElementById('meta-achievements-open')?.addEventListener('click', () => {
            setAppState(APP_VIEW_STATES.ACHIEVEMENTS);
          });
        },
      }),
    },
    {
      id: 'options',
      label: 'Options',
      onActivate: () => {
        setAppState(APP_VIEW_STATES.OPTIONS, { context: 'menu' });
      },
      detail: () => {
        const assistEnabled = getAssistMode();
        const autoFireEnabled = getAutoFire();
        const themeLabel = getThemeLabel(activeThemeKey);
        return {
          html: `
            <div class="meta-detail" data-meta-detail="options">
              <h2 class="meta-detail__title">Options</h2>
              <p class="meta-detail__desc">Adjust presentation, input, and accessibility toggles.</p>
              <p class="meta-detail__summary">Assist Mode <strong>${assistEnabled ? 'On' : 'Off'}</strong> · Auto Fire <strong>${autoFireEnabled ? 'On' : 'Off'}</strong></p>
              <p class="meta-detail__summary">Current Theme <strong>${themeLabel}</strong></p>
              <div class="meta-detail__chips">${themeChipsMarkup}</div>
              <div class="meta-detail__actions">
                <button id="meta-options-open" class="btn" data-primary-action>Open Options</button>
              </div>
            </div>
          `,
          onMount: () => {
            document.getElementById('meta-options-open')?.addEventListener('click', () => {
              setAppState(APP_VIEW_STATES.OPTIONS, { context: 'menu' });
            });
          },
        };
      },
    },
  ];
  const storedIndex = menuItems.findIndex((item) => item.id === storedSelectionId);
  const initialIndex = storedIndex >= 0 ? storedIndex : 0;
  const navMarkup = menuItems
    .map((item, index) => {
      const tabindex = index === initialIndex ? '0' : '-1';
      const activeClass = index === initialIndex ? ' meta-menu__nav-item is-active' : ' meta-menu__nav-item';
      return `<button type="button" class="${activeClass.trim()}" data-menu-item="${item.id}" data-menu-index="${index}" role="menuitem" tabindex="${tabindex}">${item.label}</button>`;
    })
    .join('');
  const selectedShip = SHIP_CATALOGUE.find((ship) => ship.key === selectedShipKey);
  const selectedShipName = selectedShip?.name ?? 'Pioneer';
  const statsContent = statsMarkup || '<p class="meta-detail__summary">Begin a run to gather intel.</p>';
  const menuMarkup = `
    <div class="meta-menu" data-meta-menu>
      <div class="meta-menu__panel meta-menu__panel--brand">
        <div class="meta-menu__logo-wrap">
          <div class="meta-menu__logo-ring" aria-hidden="true"></div>
          <div class="meta-menu__logo">RETRO <span class="cyan">SPACE</span> <span class="heart">RUN</span></div>
        </div>
        <p class="meta-menu__tagline">Chart your next sortie.</p>
        <div class="meta-menu__stats">${statsContent}</div>
        <div class="meta-menu__unlocks">
          <div class="meta-menu__unlocks-item">Ships<span class="meta-menu__unlocks-value">${unlockedShips.length} / ${totalShips}</span></div>
          <div class="meta-menu__unlocks-item">Themes<span class="meta-menu__unlocks-value">${unlockedThemeCount} / ${themeEntries.length}</span></div>
          <div class="meta-menu__unlocks-item">Achievements<span class="meta-menu__unlocks-value">${earnedAchievements} / ${achievementsProgress.length}</span></div>
        </div>
        <p class="meta-menu__footnote">Current Ship: <strong>${selectedShipName}</strong></p>
      </div>
      <div class="meta-menu__panel meta-menu__panel--nav">
        <h2 class="meta-menu__heading">Mission Control</h2>
        <div class="meta-menu__nav" role="menu" data-meta-menu-nav>
          ${navMarkup}
        </div>
        <p class="meta-menu__footnote">Use ↑ ↓ to browse · Enter to launch</p>
      </div>
      <div class="meta-menu__panel meta-menu__panel--detail">
        <div class="meta-detail" id="meta-menu-detail" data-meta-menu-detail></div>
      </div>
    </div>
  `;
  showOverlay(menuMarkup, { className: 'overlay--meta-menu' });
  const overlayRoot = typeof document !== 'undefined' ? document.getElementById('overlay') : null;
  const detailContainer = overlayRoot?.querySelector('[data-meta-menu-detail]') ?? null;
  const navRoot = overlayRoot?.querySelector('[data-meta-menu-nav]') ?? null;
  const navButtons = Array.from(navRoot?.querySelectorAll('[data-menu-item]') ?? []);
  let activeIndex = initialIndex;
  const persistSelection = (id) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage?.setItem(MENU_SELECTION_STORAGE_KEY, id);
    } catch (err) {
      // Ignore storage failures.
    }
  };
  const renderDetail = (item) => {
    if (!detailContainer) {
      return;
    }
    if (!item || typeof item.detail !== 'function') {
      detailContainer.innerHTML = '';
      return;
    }
    const result = item.detail();
    if (!result || typeof result.html !== 'string') {
      detailContainer.innerHTML = '';
      return;
    }
    detailContainer.innerHTML = result.html;
    try {
      result.onMount?.();
    } catch (err) {
      // Swallow mount errors to avoid blocking menu.
    }
  };
  const updateSelection = (index, { focus = false, force = false } = {}) => {
    if (!menuItems.length) {
      return;
    }
    const max = menuItems.length;
    const nextIndex = ((index % max) + max) % max;
    const changed = nextIndex !== activeIndex;
    activeIndex = nextIndex;
    navButtons.forEach((button, idx) => {
      const isActive = idx === activeIndex;
      if (isActive) {
        button.classList.add('is-active');
        button.setAttribute('tabindex', '0');
        button.setAttribute('aria-selected', 'true');
        if (focus) {
          button.focus();
        }
      } else {
        button.classList.remove('is-active');
        button.setAttribute('tabindex', '-1');
        button.setAttribute('aria-selected', 'false');
      }
    });
    if (changed || force) {
      renderDetail(menuItems[activeIndex]);
      persistSelection(menuItems[activeIndex].id);
    }
  };
  const activateCurrent = () => {
    const item = menuItems[activeIndex];
    if (!item) {
      return;
    }
    const primary = detailContainer?.querySelector('[data-primary-action]');
    if (primary) {
      primary.click();
      primary.focus?.();
      return;
    }
    if (typeof item.onActivate === 'function') {
      item.onActivate();
    }
  };
  const handleNavKey = (event) => {
    if (!event) {
      return;
    }
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowLeft') {
      event.preventDefault();
      updateSelection(activeIndex - 1, { focus: true });
    } else if (key === 'ArrowDown' || key === 'ArrowRight') {
      event.preventDefault();
      updateSelection(activeIndex + 1, { focus: true });
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      activateCurrent();
    }
  };
  navButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      updateSelection(index, { focus: true });
    });
    button.addEventListener('mouseenter', () => {
      if (activeIndex !== index) {
        updateSelection(index, { focus: false });
      }
    });
    button.addEventListener('focus', () => {
      updateSelection(index, { focus: false });
    });
    button.addEventListener('keydown', handleNavKey);
  });
  navRoot?.addEventListener('keydown', handleNavKey);
  updateSelection(initialIndex, { focus: true, force: true });
}
function renderOptionsOverlay({ context = 'game', onClose } = {}) {
  if (optionsOverlayOpen) {
    return;
  }
  if (context === 'game') {
    state.paused = true;
    clearInput();
  }
  const closeHandler = typeof onClose === 'function'
    ? onClose
    : context === 'game'
      ? () => {
        hideOverlay();
        state.paused = false;
        clearInput();
        setAppState(APP_VIEW_STATES.GAMEPLAY, { resume: true });
      }
      : () => {
        setAppState(APP_VIEW_STATES.MENU, { force: true });
      };
  optionsOverlayOpen = true;
  optionsOverlayCloseHandler = closeHandler;
  const activeTheme = getActiveThemeKey();
  const themeButtons = getThemeKeys()
    .filter((key) => key !== 'cosmic-abyss' || isPaletteUnlocked('cosmic-abyss'))
    .map((key) => {
      const label = getThemeLabel(key);
      const isActive = key === activeTheme;
      const classes = isActive ? 'btn' : 'btn btn-secondary';
      const pressed = isActive ? 'true' : 'false';
      const disabled = isActive ? ' disabled aria-disabled="true"' : '';
      return `<button type="button" class="${classes}" data-theme-option="${key}" aria-pressed="${pressed}"${disabled}>${label}</button>`;
    })
    .join('');
  const currentDifficulty = getDifficultyMode();
  const difficultyOptions = Object.keys(DIFFICULTY)
    .map((key) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const selected = key === currentDifficulty ? ' selected' : '';
      return `<option value="${key}"${selected}>${label}</option>`;
    })
    .join('');
  const assistEnabled = getAssistMode();
  const assistLabel = `Assist: ${assistEnabled ? 'On' : 'Off'}`;
  const assistPressed = assistEnabled ? 'true' : 'false';
  const volumePercent = Math.round(getVolume() * 100);
  const resumeLabel = context === 'game' ? 'Resume' : 'Back';
  showOverlay(`
    <h1>Options</h1>
    <div class="options-section">
      <label for="options-volume">Volume <span id="options-volume-value">${volumePercent}%</span></label>
      <input id="options-volume" type="range" min="0" max="100" value="${volumePercent}" />
    </div>
    <div class="options-section">
      <p class="options-section__label">Theme</p>
      <div class="options-theme" role="group" aria-label="Theme selection">${themeButtons}</div>
    </div>
    <div class="options-section">
      <label class="options-section__label" for="options-difficulty">Difficulty</label>
      <select id="options-difficulty" class="difficulty-select__control">${difficultyOptions}</select>
    </div>
    <div class="options-section">
      <button id="options-assist" type="button" class="btn" aria-pressed="${assistPressed}">${assistLabel}</button>
    </div>
    <div class="overlay-actions">
      <button id="options-close" class="btn">${resumeLabel}</button>
    </div>
  `);
  const volumeControl = document.getElementById('options-volume');
  const volumeValue = document.getElementById('options-volume-value');
  const syncVolume = () => {
    if (volumeValue) {
      volumeValue.textContent = `${Math.round(getVolume() * 100)}%`;
    }
    if (volumeControl) {
      volumeControl.value = `${Math.round(getVolume() * 100)}`;
    }
  };
  volumeControl?.addEventListener('input', (event) => {
    const target = event.target;
    const numeric = Number.parseFloat(target.value);
    const clamped = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
    const applied = setVolume(clamped / 100);
    if (applied > 0) {
      resumeAudioContext();
    }
    syncVolume();
  });
  const themeButtonsEls = Array.from(document.querySelectorAll('[data-theme-option]'));
  const updateThemeButtons = (activeKey = getActiveThemeKey()) => {
    themeButtonsEls.forEach((button) => {
      const key = button.getAttribute('data-theme-option');
      const isActive = key === activeKey;
      button.className = isActive ? 'btn' : 'btn btn-secondary';
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) {
        button.setAttribute('disabled', 'disabled');
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.removeAttribute('disabled');
        button.removeAttribute('aria-disabled');
      }
    });
  };
  themeButtonsEls.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-theme-option');
      if (!key) {
        return;
      }
      setTheme(key);
      updateThemeButtons(key);
    });
  });
  const difficultySelect = document.getElementById('options-difficulty');
  difficultySelect?.addEventListener('change', (event) => {
    const target = event.target;
    const value = target.value;
    if (typeof value === 'string') {
      const next = setDifficulty(value);
      if (typeof next === 'string' && difficultySelect) {
        difficultySelect.value = next;
      }
    }
  });
  const assistButton = document.getElementById('options-assist');
  const syncAssistButton = () => {
    if (!assistButton) {
      return;
    }
    const enabled = getAssistMode();
    assistButton.textContent = `Assist: ${enabled ? 'On' : 'Off'}`;
    assistButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    assistButton.classList.toggle('is-on', enabled);
  };
  assistButton?.addEventListener('click', () => {
    toggleAssistMode();
    syncAssistButton();
  });
  syncAssistButton();
  updateThemeButtons();
  syncVolume();
  const closeBtn = document.getElementById('options-close');
  closeBtn?.addEventListener('click', () => {
    closeOptionsOverlay();
  });
  closeBtn?.focus();
}

function normaliseViewState(value) {
  if (typeof value !== 'string') {
    return APP_VIEW_STATES.MENU;
  }
  const key = value.toUpperCase();
  return Object.prototype.hasOwnProperty.call(APP_VIEW_STATES, key)
    ? APP_VIEW_STATES[key]
    : APP_VIEW_STATES.MENU;
}

function resetUiInteractionState() {
  if (ui && typeof ui.resetRegions === 'function') {
    ui.resetRegions();
  }
  if (ui && typeof ui === 'object') {
    ui.isDiffOpen = false;
  }
}

function markMenuContext() {
  atMenuScreen = true;
  state.running = false;
  state.paused = false;
}

function setAppState(newState, options = {}) {
  const next = normaliseViewState(newState);
  if (next === currentViewState && !options.force) {
    return currentViewState;
  }
  previousViewState = currentViewState;
  currentViewState = next;
  const isResume = next === APP_VIEW_STATES.GAMEPLAY && options.resume;
  if (!isResume) {
    resetUiInteractionState();
  }
  switch (next) {
    case APP_VIEW_STATES.MENU: {
      renderStartOverlay({ resetHud: Boolean(options.resetHud) });
      break;
    }
    case APP_VIEW_STATES.OPTIONS: {
      const context = options.context ?? (state.running ? 'game' : 'menu');
      if (context !== 'game') {
        markMenuContext();
      }
      renderOptionsOverlay({ context, onClose: options.onClose });
      break;
    }
    case APP_VIEW_STATES.GARAGE: {
      markMenuContext();
      renderGarageOverlay();
      break;
    }
    case APP_VIEW_STATES.ACHIEVEMENTS: {
      markMenuContext();
      renderAchievementsOverlay();
      break;
    }
    case APP_VIEW_STATES.ENDLESS: {
      hideOverlay();
      startRun(1, { gameMode: GAME_MODES.ENDLESS });
      break;
    }
    case APP_VIEW_STATES.GAMEPLAY: {
      if (options.resume) {
        return currentViewState;
      }
      hideOverlay();
      const desiredLevel = Number.isFinite(options.level)
        ? clampLevelIndex(options.level)
        : Math.max(1, highestUnlockedLevel || 1);
      startRun(desiredLevel);
      break;
    }
    default: {
      currentViewState = APP_VIEW_STATES.MENU;
      renderStartOverlay({ resetHud: Boolean(options.resetHud) });
      break;
    }
  }
  return currentViewState;
}

function handlePlayerHit() {
  const player = state.player;
  const particles = resolvePaletteSection(state.theme, 'particles');
  resetCombo();
  const result = applyPlayerDamage(1);
  if (result.absorbed > 0 && result.overflow <= 0) {
    addParticle(state, player.x, player.y, particles.shieldHit, 20, 3, 400);
    playHit();
    return false;
  }
  if (!result.lostLife) {
    return result.defeated;
  }
  addParticle(state, player.x, player.y, particles.playerHit, 30, 3.2, 500);
  playZap();
  state.bossMercyUntil = performance.now() + 600;
  if (result.defeated) {
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
  const palette = state.renderPalette ?? activePalette ?? DEFAULT_THEME_PALETTE;
  const starPalette = resolvePaletteSection(palette, 'stars');
  const weatherPalette = resolvePaletteSection(palette, 'weather') ?? {};
  const windPalette = weatherPalette.wind ?? {};
  if (state.paused) {
    requestAnimationFrame(loop);
    return;
  }

  state.time += dt;
  if (state.gameMode === GAME_MODES.ENDLESS && state.endless?.active) {
    state.endless.totalTime = (state.endless.totalTime ?? 0) + dt;
  }
  updateTime(Math.floor(state.time));
  ensureGuaranteedWeaponDrop(state);
  maybeSpawnMidBossFight();
  scheduleLevelWaves();
  tickSpawner(dt);
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
    const midConfig = getMidBossConfig(state.level);
    const finalBossConfig = getFinalBossConfig(state.level);
    const midCleared = !midConfig || state.midBossDefeated;
    if (!state.bossSpawned && !state.boss && midCleared && finalBossConfig) {
      spawnBoss(state, finalBossConfig);
      state.bossSpawned = true;
    } else if (
      state.bossSpawned &&
      !state.boss &&
      !state.finishGate &&
      now - state.bossDefeatedAt > 600
    ) {
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
  drawThemeOverlay(viewW, viewH, dt);
  drawSquallOverlay(viewW, viewH, palette);

  const player = state.player;
  const speedMultiplier = state.runUpgrades?.moveSpeedMultiplier ?? 1;
  updatePlayer(player, inputState, dt, state.power.name === 'boost', wind, speedMultiplier);
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
        if (Number.isFinite(enemy.shieldTimer) && enemy.shieldTimer > 0) {
          enemy.shieldTimer = 0;
          enemy.shieldEmitter = null;
          enemy.shieldStrength = 0;
          const shieldColour = particles.shieldHit ?? particles.enemyHitDefault;
          addParticle(state, enemy.x, enemy.y, shieldColour, 16, 3.2, 260);
          playHit();
          break;
        }
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
          handleEnemyDestroyed(state, enemy);
          if (state.runStats) {
            state.runStats.kills = (state.runStats.kills ?? 0) + 1;
          }
          incrementCombo();
          addScore(25);
          playSfx('explode');
          maybeDropWeaponToken(state, enemy);
          GameEvents.emit(enemy.type === 'asteroid' ? 'asteroid:destroyed' : 'enemy:destroyed', {
            type: enemy.type,
            position: { x: enemy.x, y: enemy.y },
            combo: state.combo?.multiplier ?? 1,
          });
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
          const isMidBoss = defeatedBoss?.role === 'mid' || defeatedBoss?.variant === 'mid' || state.bossType === 'mid';
          spawnExplosion(defeatedBoss.x, defeatedBoss.y, 'boss');
          if (state.runStats) {
            state.runStats.kills = (state.runStats.kills ?? 0) + 1;
          }
          shakeScreen(isMidBoss ? 4 : 6, isMidBoss ? 360 : 500);
          incrementCombo();
          if (isMidBoss) {
            showToast('INTRUDER NEUTRALISED', 1000);
            playPow();
            addScore(250);
          } else {
            showToast('BOSS DEFEATED', 1200);
            playBossDown();
            addScore(600);
          }
          if (!defeatedBoss.rewardDropped) {
            defeatedBoss.rewardDropped = true;
            if (isMidBoss) {
              if (Math.random() < 0.5) {
                dropPowerup(state, { x: defeatedBoss.x, y: defeatedBoss.y, vy: 80 });
              } else {
                spawnWeaponToken(state, defeatedBoss.x, defeatedBoss.y);
              }
            } else {
              maybeDropWeaponToken(state, { x: defeatedBoss.x, y: defeatedBoss.y });
            }
          }
          state.boss = null;
          state.bossType = null;
          if (state.gameMode === GAME_MODES.ENDLESS && defeatedBoss?.role === 'endless') {
            state.bossSpawned = false;
            state.endless.randomBossActive = false;
            state.endless.waveCounter = 0;
            state.endless.nextBossWave = rollEndlessBossWave();
          }
          if (isMidBoss) {
            state.midBossDefeated = true;
            state.midBossDefeatedAt = now;
          } else {
            state.bossDefeatedAt = now;
            if (state.runStats) {
              state.runStats.bosses = (state.runStats.bosses ?? 0) + 1;
            }
            if (!state.storyOutroShown) {
              const outroKey = typeof state.level?.key === 'string' ? state.level.key : null;
              const outroBeat = outroKey ? getStoryBeat(outroKey, 'outro') : null;
              if (outroBeat) {
                showStoryOverlay(outroBeat);
                state.storyOutroShown = true;
              }
            }
          }
          state.bossMercyUntil = 0;
          GameEvents.emit('enemy:destroyed', {
            type: isMidBoss ? 'midBoss' : 'boss',
            position: { x: defeatedBoss.x, y: defeatedBoss.y },
          });
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

const mainInterface = {
  setState: setAppState,
  getState: () => currentViewState,
  getPreviousState: () => previousViewState,
  state,
  settings: state.settings,
  constants: {
    STATES: APP_VIEW_STATES,
    GAME_MODES,
  },
  startCampaign(level) {
    return setAppState(APP_VIEW_STATES.GAMEPLAY, { level });
  },
  startEndless() {
    return setAppState(APP_VIEW_STATES.ENDLESS);
  },
  showMenu(options) {
    return setAppState(APP_VIEW_STATES.MENU, options);
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.main = mainInterface;
}

export const main = mainInterface;

monitorGamepadIdle();

setAppState(APP_VIEW_STATES.MENU, { resetHud: true, force: true });
