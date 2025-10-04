/**
 * main.js — bootstraps Retro Space Run, orchestrating modules and the core game loop.
 */
import { rand, coll, addParticle } from './utils.js';
import {
  canvas,
  ctx,
  setStartHandler,
  showOverlay,
  hideOverlay,
  showPauseOverlay,
  updateLives,
  updateScore,
  updateTime,
  updatePower,
} from './ui.js';
import { playZap, playHit, toggleAudio, resumeAudioContext, playPow } from './audio.js';
import { resetPlayer, updatePlayer, clampPlayerToBounds, drawPlayer } from './player.js';
import { spawnEnemies, updateEnemies, drawEnemies } from './enemies.js';
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
} from './weapons.js';

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
  stars: [],
  finishGate: null,
  lastShot: 0,
  shotDelay: 180,
  speed: 260,
  power: { name: null, until: 0 },
};

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
  const count = Math.ceil((canvas.width * canvas.height) / 9000);
  for (let i = 0; i < count; i++) {
    state.stars.push({ x: rand(0, canvas.width), y: rand(0, canvas.height), z: rand(0.4, 1.6) });
  }
}

function ensureFinishGate() {
  if (state.finishGate) {
    return;
  }
  state.finishGate = {
    x: canvas.width / 2,
    y: -200,
    vy: 80,
    w: 240,
    h: 12,
  };
}

function drawGate(gate) {
  ctx.save();
  ctx.translate(gate.x, gate.y);
  const glow = (Math.sin(performance.now() * 0.003) + 1) * 0.5;
  ctx.shadowColor = '#00e5ffaa';
  ctx.shadowBlur = 20 + 20 * glow;
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(-gate.w / 2, -gate.h / 2, gate.w, gate.h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ff3df7';
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
  state.lastShot = 0;
  resetPlayer(state, canvas);
  resetPowerState(state);
  resetPowerTimers();
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
  if (player.shield > 0) {
    player.shield -= 400;
    addParticle(state, player.x, player.y, '#00e5ff', 20, 3, 400);
    playHit();
    return false;
  }
  if (player.invuln > 0) {
    return false;
  }
  state.lives -= 1;
  updateLives(state.lives);
  addParticle(state, player.x, player.y, '#ff3df7', 30, 3.2, 500);
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
  if (state.paused) {
    requestAnimationFrame(loop);
    return;
  }

  state.time += dt;
  updateTime(Math.floor(state.time));

  if (state.time >= state.levelDur && !state.finishGate) {
    ensureFinishGate();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const star of state.stars) {
    star.y += (60 * star.z + state.speed * 0.05 * star.z) * dt;
    if (star.y > canvas.height) {
      star.y = -2;
      star.x = rand(0, canvas.width);
    }
    ctx.globalAlpha = 0.4 * star.z;
    ctx.fillStyle = star.z > 1.1 ? '#00e5ff' : '#ff3df7';
    ctx.fillRect(star.x, star.y, 2, 2);
  }
  ctx.globalAlpha = 1;

  const player = state.player;
  updatePlayer(player, keys, dt, state.power.name === 'boost');
  clampPlayerToBounds(player, canvas);

  handlePlayerShooting(state, keys, now);
  updatePlayerBullets(state, dt);

  spawnEnemies(state, now, canvas);
  updateEnemies(state, dt, now, player, canvas);
  updateEnemyBullets(state, dt, canvas);

  maybeSpawnPowerup(state, now, canvas);
  updatePowerups(state, dt, now, canvas);
  clearExpiredPowers(state, now);

  if (state.finishGate) {
    const gate = state.finishGate;
    gate.y += gate.vy * dt;
    if (gate.y > canvas.height * 0.25) {
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

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const bullet = state.bullets[j];
      if (coll(enemy, bullet, -4)) {
        state.bullets.splice(j, 1);
        enemy.hp -= 1;
        addParticle(state, enemy.x, enemy.y, enemy.type === 'strafer' ? '#ff3df7' : '#00e5ff', 12, 2.6, 300);
        if (enemy.hp <= 0) {
          state.enemies.splice(i, 1);
          state.score += 25;
          updateScore(state.score);
          playHit();
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
  for (const bullet of state.enemyBullets) {
    if (coll(player, bullet, -2) && playerDefeated()) {
      return;
    }
  }

  if (player.invuln > 0) {
    player.invuln -= dt * 1000;
  }

  drawPowerups(ctx, state.powerups);
  drawEnemies(ctx, state.enemies);
  drawEnemyBullets(ctx, state.enemyBullets);
  drawPlayerBullets(ctx, state.bullets);
  if (state.finishGate) {
    drawGate(state.finishGate);
  }
  drawPlayer(ctx, player, keys);

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
