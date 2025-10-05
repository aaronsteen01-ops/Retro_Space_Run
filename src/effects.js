/**
 * effects.js — lightweight screen shake, explosions, and toast feedback helpers.
 */
import { rand, addParticle } from './utils.js';
import { DEFAULT_THEME_PALETTE, resolvePaletteSection } from './themes.js';

const shakeState = {
  time: 0,
  duration: 0,
  magnitude: 0,
  offsetX: 0,
  offsetY: 0,
};

const pendingExplosions = [];
let lastStateRef = null;

const DAMAGE_PULSE_DURATION = 420;
const damagePulse = {
  time: 0,
  strength: 0,
};

const EXPLOSION_PRESETS = {
  small: [
    { key: 'enemyHitDefault', count: 22, spread: 2.8, life: 360 },
    { key: 'enemyHitStrafer', count: 12, spread: 2.2, life: 280 },
  ],
  boss: [
    { key: 'bossHit', count: 80, spread: 5.4, life: 1100 },
    { key: 'bossCore', count: 52, spread: 4.6, life: 960 },
    { key: 'enemyHitDefault', count: 36, spread: 3.8, life: 840 },
  ],
};

const TOAST_ID = 'game-toast';
let toastEl = null;
let toastTimeout = null;

function ensureToastElement() {
  if (toastEl) {
    return toastEl;
  }
  toastEl = document.getElementById(TOAST_ID);
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = TOAST_ID;
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.className = 'game-toast';
    document.body.appendChild(toastEl);
  }
  return toastEl;
}

function resolveExplosionPreset(kind) {
  if (Array.isArray(kind)) {
    return kind;
  }
  if (EXPLOSION_PRESETS[kind]) {
    return EXPLOSION_PRESETS[kind];
  }
  return EXPLOSION_PRESETS.small;
}

export function shakeScreen(magnitude = 3, duration = 200) {
  const mag = Math.max(0, Number(magnitude) || 0);
  const dur = Math.max(0, Number(duration) || 0);
  if (dur <= 0 || mag <= 0) {
    return;
  }
  shakeState.time = Math.max(shakeState.time, dur);
  shakeState.duration = Math.max(shakeState.duration, dur);
  shakeState.magnitude = Math.max(shakeState.magnitude, mag);
}

function updateScreenShake(dt) {
  if (shakeState.time <= 0) {
    shakeState.time = 0;
    shakeState.duration = 0;
    shakeState.magnitude = 0;
    shakeState.offsetX = 0;
    shakeState.offsetY = 0;
    return;
  }
  shakeState.time = Math.max(0, shakeState.time - dt * 1000);
  const progress = shakeState.duration > 0 ? shakeState.time / shakeState.duration : 0;
  const strength = shakeState.magnitude * progress * progress;
  if (strength > 0.05) {
    shakeState.offsetX = rand(-strength, strength);
    shakeState.offsetY = rand(-strength, strength);
  } else {
    shakeState.offsetX = 0;
    shakeState.offsetY = 0;
  }
  if (shakeState.time <= 0) {
    shakeState.duration = 0;
    shakeState.magnitude = 0;
  }
}

function updateDamagePulse(dtMs) {
  if (damagePulse.time <= 0) {
    damagePulse.time = 0;
    damagePulse.strength = 0;
    return;
  }
  damagePulse.time = Math.max(0, damagePulse.time - dtMs);
  if (damagePulse.time <= 0) {
    damagePulse.strength = 0;
  }
}

function flushExplosions(state) {
  if (!state || pendingExplosions.length === 0) {
    return;
  }
  const palette = resolvePaletteSection(state.theme ?? DEFAULT_THEME_PALETTE, 'particles');
  const fallbackColour = palette.enemyHitDefault || palette.playerHit || '#ffffff';
  while (pendingExplosions.length) {
    const { x, y, preset } = pendingExplosions.shift();
    for (const burst of preset) {
      const colour = palette[burst.key] || fallbackColour;
      addParticle(state, x, y, colour, burst.count, burst.spread, burst.life);
    }
  }
}

export function updateEffects(state, dt) {
  const clampedDt = Math.max(0, Number(dt) || 0);
  lastStateRef = state || lastStateRef;
  updateScreenShake(clampedDt);
  updateDamagePulse(clampedDt * 1000);
  flushExplosions(state);
}

export function getScreenShakeOffset() {
  return shakeState;
}

export function resetEffects() {
  shakeState.time = 0;
  shakeState.duration = 0;
  shakeState.magnitude = 0;
  shakeState.offsetX = 0;
  shakeState.offsetY = 0;
  pendingExplosions.length = 0;
  lastStateRef = null;
  damagePulse.time = 0;
  damagePulse.strength = 0;
  hideToast();
}

export function spawnExplosion(x, y, kind = 'small') {
  const preset = resolveExplosionPreset(kind);
  if (!preset || !preset.length) {
    return;
  }
  pendingExplosions.push({ x, y, preset });
  if (lastStateRef) {
    flushExplosions(lastStateRef);
  }
}

export function triggerDamagePulse(strength = 0.6) {
  const clampedStrength = Math.max(0, Math.min(1.5, Number(strength) || 0));
  damagePulse.time = DAMAGE_PULSE_DURATION;
  damagePulse.strength = clampedStrength;
}

export function drawDamagePulse(ctx, width, height) {
  if (!ctx || damagePulse.time <= 0 || damagePulse.strength <= 0) {
    return;
  }
  const progress = 1 - damagePulse.time / DAMAGE_PULSE_DURATION;
  const pulse = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
  const alpha = Math.max(0, Math.min(1, pulse * damagePulse.strength));
  if (alpha <= 0.01) {
    return;
  }
  const cx = width / 2;
  const cy = height / 2;
  const inner = Math.min(width, height) * 0.28;
  const outer = Math.max(width, height) * 0.75;
  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(255,40,64,1)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function showToast(text, duration = 1200) {
  const message = typeof text === 'string' ? text.trim() : '';
  if (!message) {
    return;
  }
  const el = ensureToastElement();
  const ms = Math.max(600, Number(duration) || 0);
  el.textContent = message;
  el.style.setProperty('--toast-duration', `${ms}ms`);
  el.classList.remove('is-visible');
  // Force reflow so animation restarts consistently.
  void el.offsetWidth; // eslint-disable-line no-unused-expressions
  el.classList.add('is-visible');
  if (toastTimeout) {
    window.clearTimeout(toastTimeout);
  }
  toastTimeout = window.setTimeout(() => {
    el.classList.remove('is-visible');
    toastTimeout = null;
  }, ms);
}

export function hideToast() {
  if (!toastEl) {
    return;
  }
  toastEl.classList.remove('is-visible');
  if (toastTimeout) {
    window.clearTimeout(toastTimeout);
    toastTimeout = null;
  }
}
