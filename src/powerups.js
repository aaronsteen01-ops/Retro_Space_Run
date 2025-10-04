/**
 * powerups.js — spawning, application, and rendering of power-ups for Retro Space Run.
 */
import { rand, TAU, coll } from './utils.js';
import { playPow } from './audio.js';
import { updatePower, getViewSize } from './ui.js';
import { getDifficulty } from './difficulty.js';

const spawnState = {
  last: 0,
};

const kinds = ['shield', 'rapid', 'boost'];

export function resetPowerTimers() {
  spawnState.last = performance.now();
}

export function maybeSpawnPowerup(state, now) {
  const difficulty = getDifficulty(state.levelIndex);
  const interval = difficulty?.powerupIntervalMs ?? 12000;
  const assistFactor = state.assistEnabled ? 2 / 3 : 1;
  const targetInterval = interval * assistFactor;
  if (now - spawnState.last < targetInterval) {
    return;
  }
  spawnState.last = now;
  const type = kinds[Math.floor(Math.random() * kinds.length)];
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const maxX = Math.max(viewW - 40, 40);
  state.powerups.push({
    type,
    x: rand(40, maxX),
    y: -30,
    vy: 110,
    r: 12,
    t: 9000,
  });
}

export function applyPower(state, kind, now) {
  state.power.name = kind;
  state.power.until = now + 8000;
  updatePower(kind.toUpperCase());
  playPow();
  switch (kind) {
    case 'shield':
      state.player.shield = 8000;
      break;
    case 'rapid':
      state.lastShot = 0;
      break;
    case 'boost':
      state.player.speed = 360;
      break;
    default:
      break;
  }
}

export function clearExpiredPowers(state, now) {
  if (state.power.name && now > state.power.until) {
    if (state.power.name === 'boost') {
      state.player.speed = 260;
    }
    state.player.shield = 0;
    state.power.name = null;
    state.power.until = 0;
    updatePower('—');
  }
}

export function updatePowerups(state, dt, now) {
  const { h } = getViewSize();
  const viewH = Math.max(h, 1);
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const pu = state.powerups[i];
    pu.y += pu.vy * dt;
    pu.t -= dt * 1000;
    if (pu.t <= 0 || pu.y > viewH + 30) {
      state.powerups.splice(i, 1);
      continue;
    }
    if (coll(state.player, pu)) {
      applyPower(state, pu.type, now);
      state.powerups.splice(i, 1);
    }
  }
}

export function drawPowerups(ctx, powerups, palette) {
  const powerPalette = palette?.powerups ?? {};
  for (const p of powerups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = powerPalette.glow || '#fff';
    ctx.shadowBlur = 10;
    if (p.type === 'shield') {
      ctx.strokeStyle = powerPalette.shield || '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.stroke();
    } else if (p.type === 'rapid') {
      ctx.strokeStyle = powerPalette.rapid || '#ff3df7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(8, 6);
      ctx.moveTo(-8, 6);
      ctx.lineTo(8, -6);
      ctx.stroke();
    } else if (p.type === 'boost') {
      ctx.strokeStyle = powerPalette.boost || '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-6, 8);
      ctx.lineTo(6, 8);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function resetPowerState(state) {
  state.power.name = null;
  state.power.until = 0;
  updatePower('—');
  state.player.shield = 0;
  state.player.speed = 260;
}
