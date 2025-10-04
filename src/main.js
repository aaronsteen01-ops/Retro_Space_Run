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
} from './ui.js';
import { playZap, playHit, toggleAudio, resumeAudioContext, playPow } from './audio.js';
import { resetPlayer, updatePlayer, clampPlayerToBounds, drawPlayer } from './player.js';
import {
  spawnEnemies,
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
} from './weapons.js';

let activePalette = getActiveThemePalette();

const state = {
  running: false,
  paused: false,
  levelDur: 90,
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
  stars: [],
  finishGate: null,
  boss: null,
  bossSpawned: false,
  bossDefeatedAt: 0,
  lastShot: 0,
  shotDelay: 180,
  speed: 260,
  power: { name: null, until: 0 },
  weapon: null,
  theme: activePalette,
};

onThemeChange((_, palette) => {
  activePalette = palette;
  state.theme = palette;
});

const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key.toLowerCase());
  if (!state.running) {
    return;
  }
  const key = e.key.toLowerCase();
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
  const gatePalette = palette?.gate ?? {};
  ctx.save();
  ctx.translate(gate.x, gate.y);
  const glow = (Math.sin(performance.now() * 0.003) + 1) * 0.5;
  ctx.shadowColor = gatePalette.glow || '#00e5ffaa';
  ctx.shadowBlur = 20 + 20 * glow;
  ctx.fillStyle = gatePalette.fill || '#00e5ff';
  ctx.fillRect(-gate.w / 2, -gate.h / 2, gate.w, gate.h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = gatePalette.strut || gatePalette.trim || '#ff3df7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-gate.w / 2, -40);
  ctx.lineTo(-gate.w / 2, 40);
  ctx.moveTo(gate.w / 2, -40);
  ctx.lineTo(gate.w / 2, 40);
  ctx.stroke();
  ctx.restore();
}

function resetState() {
  state.running = true;
  state.paused = false;
  state.time = 0;
  state.score = 0;
  state.lives = 3;
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
  state.theme = activePalette;
  resetPlayer(state);
  resetPowerState(state);
  resetPowerTimers();
  setupWeapons(state);
  spawnStars();
  updateLives(state.lives);
  updateScore(state.score);
  updateTime(0);
  updatePower('—');
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
  const particles = state.theme?.particles ?? {};
  if (player.shield > 0) {
    player.shield -= 400;
    addParticle(state, player.x, player.y, particles.shieldHit || '#00e5ff', 20, 3, 400);
    playHit();
    return false;
  }
  if (player.invuln > 0) {
    return false;
  }
  state.lives -= 1;
  updateLives(state.lives);
  addParticle(state, player.x, player.y, particles.playerHit || '#ff3df7', 30, 3.2, 500);
  playZap();
  player.invuln = 2000;
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
  const palette = activePalette;
  const starPalette = palette?.stars ?? {};
  if (state.paused) {
    requestAnimationFrame(loop);
    return;
  }

  state.time += dt;
  updateTime(Math.floor(state.time));

  if (state.time >= state.levelDur) {
    if (!state.bossSpawned) {
      spawnBoss(state);
      state.bossSpawned = true;
    } else if (!state.boss && !state.finishGate && now - state.bossDefeatedAt > 600) {
      ensureFinishGate();
    }
  }

  ctx.clearRect(0, 0, viewW, viewH);
  for (const star of state.stars) {
    star.y += (60 * star.z + state.speed * 0.05 * star.z) * dt;
    if (star.y > viewH) {
      star.y = -2;
      star.x = rand(0, viewW);
    }
    ctx.globalAlpha = 0.4 * star.z;
    ctx.fillStyle = star.z > 1.1 ? starPalette.bright || '#00e5ff' : starPalette.dim || '#ff3df7';
    ctx.fillRect(star.x, star.y, 2, 2);
  }
  ctx.globalAlpha = 1;

  const player = state.player;
  updatePlayer(player, keys, dt, state.power.name === 'boost');
  clampPlayerToBounds(player);

  handlePlayerShooting(state, keys, now);
  updatePlayerBullets(state, dt);

  if (!state.boss) {
    spawnEnemies(state, now);
  }
  updateEnemies(state, dt, now, player);
  updateBoss(state, dt, now, player, palette);
  updateEnemyBullets(state, dt);

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
      return;
    }
  }

  const particles = state.theme?.particles ?? {};
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const bullet = state.bullets[j];
      if (coll(enemy, bullet, -4)) {
        state.bullets.splice(j, 1);
        enemy.hp -= bullet.damage || 1;
        const enemyCol = enemy.type === 'strafer'
          ? particles.enemyHitStrafer || '#ff3df7'
          : particles.enemyHitDefault || '#00e5ff';
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
        state.bullets.splice(j, 1);
        state.boss.hp -= bullet.damage || 1;
        addParticle(state, state.boss.x, state.boss.y, particles.bossHit || '#ff3df7', 18, 3.4, 320);
        playHit();
        if (state.boss.hp <= 0) {
          addParticle(state, state.boss.x, state.boss.y, particles.bossHit || '#ff3df7', 60, 5, 1000);
          addParticle(state, state.boss.x, state.boss.y, particles.bossCore || '#00e5ff', 40, 4, 1000);
          playPow();
          state.score += 600;
          updateScore(state.score);
          maybeDropWeaponToken(state, { x: state.boss.x, y: state.boss.y });
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
      return;
    }
  }
  if (state.boss && coll(player, state.boss, -26) && playerDefeated()) {
    return;
  }
  for (const bullet of state.enemyBullets) {
    if (coll(player, bullet, -2) && playerDefeated()) {
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

  state.score += Math.floor(30 * dt);
  updateScore(state.score);

  requestAnimationFrame(loop);
}

function start() {
  resetState();
}

setStartHandler(start);
