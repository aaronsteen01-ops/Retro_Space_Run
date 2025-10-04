/**
 * weapons.js — player and enemy projectile management for Retro Space Run.
 */
import { playPew } from './audio.js';

export function handlePlayerShooting(state, keys, now) {
  const rapid = state.power.name === 'rapid';
  const delay = rapid ? 90 : state.shotDelay;
  if ((keys.has(' ') || keys.has('space')) && now - state.lastShot > delay) {
    state.lastShot = now;
    const spread = rapid ? 10 : 0;
    const shots = rapid ? 2 : 1;
    for (let i = 0; i < shots; i++) {
      state.bullets.push({
        x: state.player.x + (i ? spread : -spread),
        y: state.player.y - 18,
        vy: -520,
        r: 6,
      });
    }
    playPew();
  }
}

export function updatePlayerBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.y += b.vy * dt;
    if (b.y < -30) {
      state.bullets.splice(i, 1);
    }
  }
}

export function drawPlayerBullets(ctx, bullets) {
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = '#ff3df7aa';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffb8ff';
    ctx.fillRect(-2, -6, 4, 10);
    ctx.restore();
  }
}

export function updateEnemyBullets(state, dt, canvas) {
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    if (
      b.y < -40 ||
      b.y > canvas.height + 40 ||
      b.x < -40 ||
      b.x > canvas.width + 40
    ) {
      state.enemyBullets.splice(i, 1);
    }
  }
}

export function drawEnemyBullets(ctx, bullets) {
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = '#00e5ffaa';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#8af5ff';
    ctx.fillRect(-2, -5, 4, 9);
    ctx.restore();
  }
}
