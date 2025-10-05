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
import { DEFAULT_THEME_PALETTE, resolvePaletteSection } from './themes.js';
import { LEVELS } from './levels.js';
import { getDifficulty } from './difficulty.js';
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
  score: 0,
  lives: 3,
  player: null,
  bullets: [],
  enemies: [],
  enemyBullets: [],
  particles: [],
  powerups: [],
  weaponDrops: [],
  weaponDropSecured: false,
  muzzleFlashes: [],
  weaponPickupFlash: null,
  levelOverlay: null,
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
  levelContext: { spawnTweaks: {}, enemyWeights: {}, mechanics: {}, themeKey: null },
  weather: { windX: 0, squall: null },
};

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
  state.paused = !state.paused;
  if (state.paused) {
    showPauseOverlay();
  } else {
    hideOverlay();
  }
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

function applyLevelMechanics(mechanics = {}) {
  const wind = Number.isFinite(mechanics.windX) ? mechanics.windX : 0;
  state.weather.windX = wind;
  const squallConfig = mechanics.squallBursts;
  if (squallConfig) {
    const interval = Array.isArray(squallConfig.interval) && squallConfig.interval.length >= 2
      ? squallConfig.interval
      : [10, 14];
    const rawMin = Number(interval[0]);
    const rawMax = Number(interval[1]);
    const intervalMin = Number.isFinite(rawMin) ? Math.max(1, rawMin) : 10;
    const intervalMax = Number.isFinite(rawMax) ? Math.max(intervalMin, rawMax) : Math.max(intervalMin, intervalMin + 4);
    const duration = Number.isFinite(squallConfig.duration) ? Math.max(0.2, squallConfig.duration) : 1.2;
    const playerSpread = Number.isFinite(squallConfig.playerSpread)
      ? Math.max(0, squallConfig.playerSpread)
      : Number.isFinite(squallConfig.spread)
        ? Math.max(0, squallConfig.spread)
        : 0;
    const enemySpread = Number.isFinite(squallConfig.enemySpread)
      ? Math.max(0, squallConfig.enemySpread)
      : Math.max(0, playerSpread * 0.3);
    const dimFactor = Number.isFinite(squallConfig.dimFactor)
      ? Math.max(0.15, Math.min(1, squallConfig.dimFactor))
      : 0.55;
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
  } else if (squall.active && time >= squall.endsAt) {
    squall.active = false;
    squall.startedAt = time;
    squall.nextAt = time + rand(squall.intervalMin, squall.intervalMax);
  }
}

function clearLevelEntities() {
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
  resetPowerState(state);
  resetPowerTimers();
  resetEffects();
  spawnStars();
  resetPlayer(state);
  updatePower('None');
  updateTime(0);
}

function configureLevelContext(level) {
  const modifiers = level?.modifiers ?? {};
  state.levelContext = {
    spawnTweaks: modifiers.spawn ?? {},
    enemyWeights: modifiers.enemyWeights ?? {},
    mechanics: level?.mechanics ?? {},
    themeKey: level?.theme ?? null,
  };
  applyLevelMechanics(state.levelContext.mechanics);
}

function levelIntro(level) {
  const themeKey = state.levelContext?.themeKey ?? level?.theme ?? DEFAULT_THEME_KEY;
  if (themeKey) {
    setTheme(themeKey, { persist: false });
  }
  const palette = getActiveThemePalette() ?? DEFAULT_THEME_PALETTE;
  state.theme = palette;
  const overlayDef = level?.visuals?.overlay ?? null;
  if (overlayDef) {
    const background = resolvePaletteSection(palette, 'background');
    const fallbackColour = background?.base ?? '#000000';
    const colour = overlayDef.colour ?? overlayDef.color ?? fallbackColour;
    const alpha = Number.isFinite(overlayDef.alpha) ? Math.max(0, Math.min(1, overlayDef.alpha)) : 0;
    state.levelOverlay = colour && alpha > 0 ? { colour, alpha } : null;
  } else {
    state.levelOverlay = null;
  }
  const starfieldOverrides = level?.visuals?.starfield ?? {};
  state.starfield = mergeStarfieldConfig(starfieldOverrides);
  const mutators = Array.isArray(level?.mutators)
    ? level.mutators.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    : [];
  updateLevelChip({
    levelIndex: state.levelIndex,
    name: level?.name ?? null,
    mutators,
  });
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
  const bandAlpha = Math.max(0, Math.min(1, bandAlphaBase + pulse * bandPulse));
  ctx.globalAlpha = bandAlpha;
  ctx.fillStyle = bandColour;
  ctx.fillRect(0, viewH * 0.15, viewW, 4);
  ctx.fillRect(0, viewH * 0.35, viewW, 3);
  ctx.fillRect(0, viewH * 0.55, viewW, 4);
  ctx.restore();
}

function spawnWaveFromSchedule(wave, difficulty) {
  if (!wave || !wave.type) {
    return;
  }
  const spawnConfig = difficulty?.spawn || {};
  const typeConfig = spawnConfig[wave.type] || {};
  const levelTweaks = state.levelContext.spawnTweaks?.[wave.type] || {};
  const waveOverrides = wave.params ? { ...wave.params } : {};
  const mergedParams = { ...typeConfig, ...levelTweaks, ...waveOverrides };
  const weight = Number.isFinite(state.levelContext.enemyWeights?.[wave.type])
    ? state.levelContext.enemyWeights[wave.type]
    : 1;
  const baseDensity = Number.isFinite(mergedParams.density) ? mergedParams.density : 1;
  const density = Math.max(0, baseDensity * (Number.isFinite(weight) ? weight : 1));
  const waveRange = Array.isArray(wave.countRange) && wave.countRange.length >= 2 ? wave.countRange : null;
  const mergedRange = Array.isArray(mergedParams.countRange) && mergedParams.countRange.length >= 2
    ? mergedParams.countRange
    : null;
  const range = waveRange ?? mergedRange;
  const baseCount = Number.isFinite(wave.count)
    ? wave.count
    : Number.isFinite(mergedParams.count)
      ? mergedParams.count
      : 1;
  const finalParams = { ...mergedParams };
  if (range) {
    finalParams.countRange = range.map((value) => value * density);
    delete finalParams.count;
  } else {
    finalParams.count = baseCount * density;
    delete finalParams.countRange;
  }
  delete finalParams.density;
  finalParams.spawnTime = state.time;
  spawn(state, wave.type, finalParams);
}

function scheduleLevelWaves() {
  const level = state.level;
  if (!level || state.boss || state.bossSpawned) {
    return;
  }
  const difficulty = getDifficulty(state.levelIndex);
  while (state.nextWaveIndex < level.waves.length) {
    const wave = level.waves[state.nextWaveIndex];
    if (!wave || state.time < wave.at) {
      break;
    }
    spawnWaveFromSchedule(wave, difficulty);
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
  configureLevelContext(targetLevel);
  levelIntro(targetLevel);
  clearLevelEntities();
  updateScore(state.score);
  updateLives(state.lives);
  updateWeaponHud(state);
  hideOverlay();
  clearInput();
  state.running = true;
  state.paused = false;
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function startRun(levelIndex = 1) {
  state.assistEnabled = getAssistMode();
  state.lives = state.assistEnabled ? 4 : 3;
  state.score = 0;
  state.levelStartScore = 0;
  state.levelStartTime = performance.now();
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
  applyLevelMechanics({});
  clearLevelEntities();
  updateScore(state.score);
  updateLives(state.lives);
  if (nextLevelIndex <= LEVELS.length) {
    unlockLevel(nextLevelIndex);
  }
  const nextLevel = LEVELS[nextLevelIndex - 1] ?? null;
  const header = `LEVEL ${state.levelIndex} COMPLETE`;
  const nextButton = nextLevel
    ? `<button id="next-level-btn" class="btn">Continue to L${nextLevelIndex}: ${nextLevel.name}</button>`
    : `<button id="return-hangar" class="btn">Return to Hangar</button>`;
  showOverlay(`
    <h1><span class="cyan">${header}</span></h1>
    <p>${currentLevel?.name ?? 'Sector'} cleared in <strong>${levelTime}s</strong>.</p>
    <p>Score gained: <strong>${Math.max(0, scoreDelta)}</strong> · Total Score: <strong>${state.score}</strong></p>
    <div class="overlay-actions">
      ${nextButton}
      <button id="summary-select-level" class="btn btn-secondary">Select Level</button>
    </div>
  `);
  const select = document.getElementById('summary-select-level');
  select?.addEventListener('click', () => {
    renderStartOverlay();
  });
  if (nextLevel) {
    const nextBtn = document.getElementById('next-level-btn');
    nextBtn?.addEventListener('click', () => {
      startLevel(nextLevelIndex);
    });
  } else {
    const hangar = document.getElementById('return-hangar');
    hangar?.addEventListener('click', () => {
      renderStartOverlay();
    });
  }
}

function gameOver() {
  state.running = false;
  state.paused = false;
  const levelTime = Math.floor(state.time);
  const scoreDelta = state.score - (state.levelStartScore ?? 0);
  const levelName = state.level?.name ?? 'Sector';
  applyLevelMechanics({});
  clearLevelEntities();
  updateScore(state.score);
  updateLives(state.lives);
  showOverlay(`
    <h1><span class="heart">SHIP DESTROYED</span></h1>
    <p>Level ${state.levelIndex}: ${levelName} after <strong>${levelTime}s</strong>.</p>
    <p>Score this run: <strong>${state.score}</strong> · Level gain: <strong>${Math.max(0, scoreDelta)}</strong></p>
    <div class="overlay-actions">
      <button id="retry-level" class="btn">Retry Level ${state.levelIndex}</button>
      <button id="overlay-select-level" class="btn btn-secondary">Select Level</button>
    </div>
  `);
  document.getElementById('retry-level')?.addEventListener('click', () => {
    startRun(state.levelIndex);
  });
  document.getElementById('overlay-select-level')?.addEventListener('click', () => {
    renderStartOverlay();
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
    <p>WASD / Arrow keys to steer · Space to fire · P pause · F fullscreen · M mute · H Assist Mode</p>
    <p>Pick a sector or continue your furthest run. Assist Mode toggles an extra life and softer spawns.</p>
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
    addParticle(state, player.x, player.y, particles.shieldHit, 20, 3, 400);
    playHit();
    return false;
  }
  if (player.invuln > 0) {
    return false;
  }
  state.lives -= 1;
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
  const wind = Number.isFinite(state.weather?.windX) ? state.weather.windX : 0;
  const squall = state.weather?.squall;
  const squallDim = squall?.active ? squall.dimFactor ?? 0.6 : 1;
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
    star.x += wind * windFactor * depth * dt;
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
  ctx.globalAlpha = 1;
  drawSquallOverlay(viewW, viewH, palette);

  const player = state.player;
  updatePlayer(player, inputState, dt, state.power.name === 'boost');
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
          state.score += 25;
          updateScore(state.score);
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
          state.score += 600;
          updateScore(state.score);
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

  state.score += Math.floor(30 * dt);
  updateScore(state.score);

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
