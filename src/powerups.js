/**
 * powerups.js — spawning, application, and rendering of power-ups for Retro Space Run.
 */
// CHANGELOG: Emitted GameEvents when power-ups modify shield or HUD state.
import { rand, TAU, coll, clamp } from './utils.js';
import { playPow } from './audio.js';
import { updatePower, updateShield, getViewSize } from './ui.js';
import { resolvePaletteSection } from './themes.js';
import { GameEvents } from './events.js';

const spawnState = {
  last: 0,
};

const kinds = ['shield', 'rapid', 'boost'];
const GUARANTEE_CHECKPOINTS_MS = [20000, 40000];

function pickPowerupType(lastType = null) {
  const options = lastType
    ? kinds.filter((k) => k !== lastType)
    : kinds.slice();
  const pool = options.length > 0 ? options : kinds;
  return pool[Math.floor(Math.random() * pool.length)];
}

function spawnPowerupEntity(state, type, x, opts = {}) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const minX = 40;
  const maxX = Math.max(viewW - 40, 40);
  state.powerups.push({
    type,
    x: clamp(x ?? rand(minX, maxX), minX, maxX),
    y: -30,
    vy: opts.vy ?? 110,
    r: 12,
    t: 9000,
    guaranteed: opts.guaranteed ?? false,
  });
}

export function resetPowerTimers() {
  spawnState.last = performance.now();
}

export function maybeSpawnPowerup(state, now) {
  const interval = state.level?.powerups?.intervalMs ?? 12000;
  const assistFactor = state.assistEnabled ? 2 / 3 : 1;
  const themeFactor = Number.isFinite(state.themeFx?.powerupIntervalMultiplier)
    ? Math.max(0.2, state.themeFx.powerupIntervalMultiplier)
    : 1;
  const targetInterval = interval * assistFactor * themeFactor;
  if (now - spawnState.last < targetInterval) {
    return;
  }
  spawnState.last = now;
  const type = pickPowerupType();
  spawnPowerupEntity(state, type);
}

export function ensureGuaranteedPowerups(state, now) {
  if (state.levelIndex !== 1) {
    return;
  }
  if (!state.power) {
    return;
  }
  if (state.powerupsGrantedL1 >= GUARANTEE_CHECKPOINTS_MS.length) {
    return;
  }
  const elapsedMs = state.time * 1000;
  const nextCheckpoint = GUARANTEE_CHECKPOINTS_MS[state.powerupsGrantedL1];
  if (elapsedMs < nextCheckpoint) {
    return;
  }
  const hasActivePower = state.power.name && now < state.power.until;
  if (hasActivePower) {
    return;
  }
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const baseX = state.player ? state.player.x : viewW / 2;
  const spawnX = baseX + rand(-120, 120);
  const type = pickPowerupType(state.lastGuaranteedPowerup);
  spawnPowerupEntity(state, type, spawnX, { guaranteed: true });
  state.lastGuaranteedPowerup = type;
  state.powerupsGrantedL1 += 1;
  spawnState.last = now;
}

export function applyPower(state, kind, now) {
  const baseDuration = 8000;
  let duration = baseDuration;
  if (kind === 'shield') {
    const multiplier = state.runUpgrades?.shieldDurationMultiplier ?? 1;
    duration = baseDuration * multiplier;
  }
  const durationMultiplier = Number.isFinite(state.themeFx?.powerupDurationMultiplier)
    ? Math.max(0.1, state.themeFx.powerupDurationMultiplier)
    : 1;
  duration = Math.round(duration * durationMultiplier);
  state.power.name = kind;
  state.power.until = now + duration;
  const label = kind.toUpperCase();
  updatePower(label);
  GameEvents.emit('powerup:changed', label);
  playPow();
  switch (kind) {
    case 'shield':
      if (state.player) {
        state.player.shield = duration;
      }
      state.shieldCapacity = duration;
      updateShield(duration, duration);
      GameEvents.emit('shield:changed', { value: duration, max: duration });
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
    if (state.power.name === 'shield' || (state.player?.shield ?? 0) > 0) {
      if (state.player) {
        state.player.shield = 0;
      }
      state.shieldCapacity = 0;
      updateShield(0, 1);
      GameEvents.emit('shield:changed', { value: 0, max: 1 });
    }
    state.power.name = null;
    state.power.until = 0;
    updatePower('None');
    GameEvents.emit('powerup:changed', 'None');
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
  const powerPalette = resolvePaletteSection(palette, 'powerups');
  for (const p of powerups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = powerPalette.glow;
    ctx.shadowBlur = 10;
    if (p.type === 'shield') {
      ctx.strokeStyle = powerPalette.shield;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.stroke();
    } else if (p.type === 'rapid') {
      ctx.strokeStyle = powerPalette.rapid;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(8, 6);
      ctx.moveTo(-8, 6);
      ctx.lineTo(8, -6);
      ctx.stroke();
    } else if (p.type === 'boost') {
      ctx.strokeStyle = powerPalette.boost;
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
  updatePower('None');
  GameEvents.emit('powerup:changed', 'None');
  state.shieldCapacity = 0;
  updateShield(0, 1);
  GameEvents.emit('shield:changed', { value: 0, max: 1 });
  if (state.player) {
    state.player.shield = 0;
    state.player.speed = 260;
  }
}
