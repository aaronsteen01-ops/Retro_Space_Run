/**
 * main.js — bootstraps Retro Space Run, orchestrating modules and the core game loop.
 */
import { rand, coll, addParticle } from './utils.js';
import {
  ctx,
  setStartHandler,
  showOverlay,
  hideOverlay,
  showPauseOverlay,
  updateLives,
  updateScore,
  updateTime,
  updatePower,
  getActiveThemePalette,
  onThemeChange,
  getViewSize,
  getAssistMode,
  toggleAssistMode,
  onAssistChange,
} from './ui.js';
import { playZap, playHit, toggleAudio, resumeAudioContext, playPow } from './audio.js';
import { resetPlayer, updatePlayer, clampPlayerToBounds, drawPlayer } from './player.js';
import {
  spawn,
  updateEnemies,
  drawEnemies,
  spawnBoss,
  updateBoss,
  drawBoss,
  drawBossHealth,
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
  updatePlayerBullets,
  drawPlayerBullets,
  updateEnemyBullets,
  drawEnemyBullets,
  setupWeapons,
  updateWeaponDrops,
  drawWeaponDrops,
  maybeDropWeaponToken,
  ensureGuaranteedWeaponDrop,
  updateMuzzleFlashes,
  drawMuzzleFlashes,
} from './weapons.js';
import { DEFAULT_THEME_PALETTE, resolvePaletteSection } from './themes.js';
import { LEVELS } from './levels.js';
import { getDifficulty } from './difficulty.js';

let activePalette = getActiveThemePalette() ?? DEFAULT_THEME_PALETTE;

const DEFAULT_LEVEL = LEVELS[0] ?? null;

const state = {
  running: false,
  paused: false,
  levelDur: DEFAULT_LEVEL?.duration ?? 0,
  levelIndex: 1,
  level: DEFAULT_LEVEL,
  nextWaveIndex: 0,
  time: 0,
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
  screenShake: { time: 0, duration: 0, magnitude: 0, offsetX: 0, offsetY: 0 },
  stars: [],
  finishGate: null,
  boss: null,
  bossSpawned: false,
  bossDefeatedAt: 0,
  lastShot: 0,
  shotDelay: 180,
  speed: 260,
  power: { name: null, until: 0 },
  powerupsGrantedL1: 0,
  lastGuaranteedPowerup: null,
  weapon: null,
  theme: activePalette,
  assistEnabled: getAssistMode(),
};

onThemeChange((_, palette) => {
  activePalette = palette ?? DEFAULT_THEME_PALETTE;
  state.theme = activePalette;
});

onAssistChange((enabled) => {
  state.assistEnabled = enabled;
});

const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  const key = e.key.toLowerCase();
  keys.add(key);
  if (key === 'h') {
    toggleAssistMode();
  }
  if (!state.running) {
    return;
  }
  if (key === 'p') {
    state.paused = !state.paused;
    if (state.paused) {
      showPauseOverlay();
    } else {
      hideOverlay();
    }
  } else if (key === 'm') {
    toggleAudio();
  } else if (key === 'f') {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

window.addEventListener('click', () => {
  resumeAudioContext();
});

function triggerScreenShake(intensity = 3, duration = 160) {
  const shake = state.screenShake;
  if (!shake) {
    state.screenShake = {
      time: duration,
      duration,
      magnitude: intensity,
      offsetX: 0,
      offsetY: 0,
    };
    return;
  }
  shake.time = Math.max(shake.time, duration);
  shake.duration = Math.max(shake.duration, duration);
  shake.magnitude = Math.max(shake.magnitude, intensity);
}

function updateScreenShake(dt) {
  const shake = state.screenShake;
  if (!shake) {
    return;
  }
  if (shake.time > 0) {
    shake.time = Math.max(0, shake.time - dt * 1000);
    const progress = shake.duration > 0 ? shake.time / shake.duration : 0;
    const strength = shake.magnitude * progress;
    if (strength > 0) {
      shake.offsetX = rand(-strength, strength);
      shake.offsetY = rand(-strength, strength);
    } else {
      shake.offsetX = 0;
      shake.offsetY = 0;
    }
  } else {
    shake.offsetX = 0;
    shake.offsetY = 0;
    shake.magnitude = 0;
    shake.duration = 0;
  }
}

function spawnStars() {
  state.stars.length = 0;
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const count = Math.ceil((viewW * viewH) / 9000);
  for (let i = 0; i < count; i++) {
    state.stars.push({ x: rand(0, viewW), y: rand(0, viewH), z: rand(0.4, 1.6) });
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

function spawnWaveFromSchedule(wave, difficulty) {
  if (!wave || !wave.type) {
    return;
  }
  const spawnConfig = difficulty?.spawn || {};
  const typeConfig = spawnConfig[wave.type] || {};
  const { density = 1, count: typeCount, countRange: typeRange, ...typeParams } = typeConfig;
  const rawWaveParams = wave.params ? { ...wave.params } : {};
  const { countRange: waveRange, ...waveParams } = rawWaveParams;
  let baseCount = typeof wave.count === 'number' ? wave.count : undefined;
  if (baseCount === undefined && typeof typeCount === 'number') {
    baseCount = typeCount;
  }
  const range = Array.isArray(waveRange) && waveRange.length >= 2
    ? waveRange
    : Array.isArray(typeRange) && typeRange.length >= 2
      ? typeRange
      : null;
  if (range) {
    const min = Math.floor(range[0]);
    const max = Math.floor(range[1]);
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const safeLow = Math.max(0, low);
    const safeHigh = Math.max(safeLow, high);
    baseCount = Math.floor(rand(safeLow, safeHigh + 1));
  }
  if (baseCount === undefined) {
    baseCount = 1;
  }
  const densityMultiplier = Number.isFinite(density) ? density : 1;
  const finalCount = Math.max(0, Math.round(baseCount * densityMultiplier));
  const finalParams = { ...typeParams, ...waveParams, count: finalCount, spawnTime: state.time };
  delete finalParams.countRange;
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

function resetState() {
  state.running = true;
  state.paused = false;
  state.levelIndex = 1;
  state.level = LEVELS[state.levelIndex - 1] ?? DEFAULT_LEVEL;
  state.levelDur = state.level?.duration ?? 0;
  state.nextWaveIndex = 0;
  state.time = 0;
  state.score = 0;
  state.assistEnabled = getAssistMode();
  state.lives = state.assistEnabled ? 4 : 3;
  state.bullets.length = 0;
  state.enemies.length = 0;
  state.enemyBullets.length = 0;
  state.powerups.length = 0;
  state.particles.length = 0;
  state.finishGate = null;
  state.boss = null;
  state.bossSpawned = false;
  state.bossDefeatedAt = 0;
  state.lastShot = 0;
  state.weaponDropSecured = false;
  state.powerupsGrantedL1 = 0;
  state.lastGuaranteedPowerup = null;
  state.muzzleFlashes.length = 0;
  state.screenShake.time = 0;
  state.screenShake.duration = 0;
  state.screenShake.magnitude = 0;
  state.screenShake.offsetX = 0;
  state.screenShake.offsetY = 0;
  state.theme = activePalette;
  resetPlayer(state);
  resetPowerState(state);
  resetPowerTimers();
  setupWeapons(state);
  spawnStars();
  updateLives(state.lives);
  updateScore(state.score);
  updateTime(0);
  updatePower('None');
  hideOverlay();
  keys.clear();
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function gameOver(win) {
  state.running = false;
  state.paused = false;
  const time = Math.floor(state.time);
  const title = win
    ? '<span class="cyan">MISSION COMPLETE</span>'
    : '<span class="heart">GAME OVER</span>';
  const message = win ? 'You reached the finish gate.' : 'You lost all lives.';
  showOverlay(`
    <h1>${title}</h1>
    <p>Score: <strong>${state.score}</strong> · Time: <strong>${time}</strong>s</p>
    <p>${message} Press Start to try again.</p>
    <a id="btn">Start</a>
  `);
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
  addParticle(state, player.x, player.y, particles.playerHit, 30, 3.2, 500);
  playZap();
  player.invuln = state.assistEnabled ? 3000 : 2000;
  if (state.lives <= 0) {
    gameOver(false);
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
  const { w: viewW, h: viewH } = getViewSize();
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
  updateScreenShake(dt);

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
  if (state.screenShake.offsetX || state.screenShake.offsetY) {
    ctx.translate(state.screenShake.offsetX, state.screenShake.offsetY);
  }
  for (const star of state.stars) {
    star.y += (60 * star.z + state.speed * 0.05 * star.z) * dt;
    if (star.y > viewH) {
      star.y = -2;
      star.x = rand(0, viewW);
    }
    ctx.globalAlpha = 0.4 * star.z;
    ctx.fillStyle = star.z > 1.1 ? starPalette.bright : starPalette.dim;
    ctx.fillRect(star.x, star.y, 2, 2);
  }
  ctx.globalAlpha = 1;

  const player = state.player;
  updatePlayer(player, keys, dt, state.power.name === 'boost');
  clampPlayerToBounds(player);

  handlePlayerShooting(state, keys, now);
  updatePlayerBullets(state, dt);
  updateMuzzleFlashes(state, dt);

  updateEnemies(state, dt, now, player);
  updateBoss(state, dt, now, player, palette);
  updateEnemyBullets(state, dt);

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
      gameOver(true);
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
        enemy.hp -= bullet.damage || 1;
        if (bulletLevel >= 2) {
          triggerScreenShake(rand(2, 4), 160);
        }
        const enemyCol = enemy.type === 'strafer'
          ? particles.enemyHitStrafer
          : particles.enemyHitDefault;
        addParticle(state, enemy.x, enemy.y, enemyCol, 12, 2.6, 300);
        if (enemy.hp <= 0) {
          state.enemies.splice(i, 1);
          state.score += 25;
          updateScore(state.score);
          playHit();
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
        state.boss.hp -= bullet.damage || 1;
        if (bulletLevel >= 2) {
          triggerScreenShake(rand(2, 4), 160);
        }
        addParticle(state, state.boss.x, state.boss.y, particles.bossHit, 18, 3.4, 320);
        playHit();
        if (state.boss.hp <= 0) {
          const defeatedBoss = state.boss;
          addParticle(state, defeatedBoss.x, defeatedBoss.y, particles.bossHit, 60, 5, 1000);
          addParticle(state, defeatedBoss.x, defeatedBoss.y, particles.bossCore, 40, 4, 1000);
          playPow();
          state.score += 600;
          updateScore(state.score);
          if (!defeatedBoss.rewardDropped) {
            maybeDropWeaponToken(state, { x: defeatedBoss.x, y: defeatedBoss.y });
            defeatedBoss.rewardDropped = true;
          }
          state.boss = null;
          state.bossDefeatedAt = now;
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
  drawPlayerBullets(ctx, state.bullets);
  drawMuzzleFlashes(ctx, state.muzzleFlashes);
  if (state.finishGate) {
    drawGate(state.finishGate, palette);
  }
  drawPlayer(ctx, player, keys, palette);

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

function start() {
  resetState();
}

setStartHandler(start);
