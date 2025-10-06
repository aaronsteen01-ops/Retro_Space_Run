/**
 * player.js — player creation, movement, and rendering helpers for Retro Space Run.
 */
import { clamp, lerp, drawGlowCircle } from './utils.js';
import { getViewSize } from './ui.js';
import { resolvePaletteSection } from './themes.js';

export function createPlayer(shipConfig = {}) {
  const { w, h } = getViewSize();
  const baseSpeed = Number.isFinite(shipConfig.speed) ? Math.max(120, shipConfig.speed) : 260;
  const fireRate = Number.isFinite(shipConfig.fireRate) ? Math.max(0.4, shipConfig.fireRate) : 1;
  const baseShield = Number.isFinite(shipConfig.shield) ? Math.max(0, shipConfig.shield) : 0;
  const spread = Number.isFinite(shipConfig.spread) ? Math.max(0.5, shipConfig.spread) : 1;
  const shipKey = typeof shipConfig.key === 'string' ? shipConfig.key : 'pioneer';
  return {
    x: (w || 0) / 2,
    y: (h || 0) * 0.75,
    vx: 0,
    vy: 0,
    speed: baseSpeed,
    baseSpeed,
    fireRate,
    baseFireRate: fireRate,
    r: 14,
    shield: baseShield,
    baseShield,
    invuln: 0,
    projectileSpread: spread,
    baseSpread: spread,
    shipKey,
  };
}

export function resetPlayer(state, shipConfig = state?.ship) {
  state.player = createPlayer(shipConfig);
  if (state?.player) {
    state.speed = state.player.baseSpeed ?? state.player.speed ?? state.speed;
  }
}

export function updatePlayer(player, input, dt, hasBoost, windX = 0, speedMultiplier = 1) {
  const safeMultiplier = Number.isFinite(speedMultiplier) ? Math.max(0.5, speedMultiplier) : 1;
  const baseSpeed = Number.isFinite(player?.speed) ? Math.max(120, player.speed) : 260;
  const accelBase = hasBoost ? 560 : 380;
  const accel = accelBase * safeMultiplier * Math.max(0.4, baseSpeed / 260);
  const moveX = clamp(Number.isFinite(input?.moveX) ? input.moveX : 0, -1, 1);
  const moveY = clamp(Number.isFinite(input?.moveY) ? input.moveY : 0, -1, 1);
  const ax = moveX * accel;
  const ay = moveY * accel * 0.8;
  player.vx = lerp(player.vx, ax, 0.08);
  player.vy = lerp(player.vy, ay, 0.08);
  const drift = clamp(Number.isFinite(windX) ? windX : 0, -80, 80);
  player.x += (player.vx + drift) * dt;
  player.y += player.vy * dt;
}

export function clampPlayerToBounds(player) {
  const { w, h } = getViewSize();
  player.x = clamp(player.x, 20, Math.max(w - 20, 20));
  player.y = clamp(player.y, 40, Math.max(h - 40, 40));
}

export function drawPlayer(ctx, player, input, palette, weaponFlash = null) {
  const ship = resolvePaletteSection(palette, 'ship');
  ctx.save();
  ctx.translate(player.x, player.y);
  const tilt = clamp(Number.isFinite(input?.moveX) ? input.moveX : 0, -1, 1);
  const invulnActive = (player.invuln || 0) > 0;
  const precisionActive = Boolean(input?.precision);
  const variant = player?.shipKey ?? 'pioneer';
  let spriteAlpha = 1;
  if (invulnActive) {
    const flickerInterval = 1000 / 6;
    const phase = Math.floor(performance.now() / flickerInterval);
    spriteAlpha = phase % 2 === 0 ? 1 : 0.35;
  }
  ctx.rotate(tilt * 0.08);
  ctx.globalAlpha = spriteAlpha;

  const enginePulse = 14 + (Math.sin(performance.now() * 0.02) + 1) * 6;
  const engineScale = variant === 'vanguard' ? 1.25 : variant === 'nova' ? 0.95 : 1;
  const engLen = enginePulse * engineScale;
  const trail = ctx.createLinearGradient(0, 0, 0, 30);
  trail.addColorStop(0, ship.trailStart);
  trail.addColorStop(1, ship.trailEnd);
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-6, 24 + engLen);
  ctx.lineTo(6, 24 + engLen);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = ship.glow;
  ctx.shadowBlur = 12;
  ctx.fillStyle = ship.primary;
  ctx.strokeStyle = ship.trim;
  ctx.lineWidth = 1.6;
  const wing = variant === 'nova' ? 18 : variant === 'vanguard' ? 10 : 14;
  const tail = variant === 'nova' ? 20 : 16;
  const nose = variant === 'nova' ? -20 : variant === 'vanguard' ? -14 : -16;
  ctx.beginPath();
  ctx.moveTo(0, nose);
  ctx.lineTo(wing, 10);
  ctx.lineTo(0, tail);
  ctx.lineTo(-wing, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = ship.cockpit;
  ctx.beginPath();
  const cockpitWidth = variant === 'nova' ? 6.5 : variant === 'vanguard' ? 4.2 : 5;
  const cockpitHeight = variant === 'nova' ? 8.5 : 7;
  const cockpitOffset = variant === 'nova' ? -8 : -6;
  ctx.ellipse(0, cockpitOffset, cockpitWidth, cockpitHeight, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.shield > 0) {
    ctx.save();
    const shieldAlpha = 0.6 + 0.4 * Math.sin(performance.now() * 0.01);
    ctx.globalAlpha = shieldAlpha * spriteAlpha;
    drawGlowCircle(
      ctx,
      0,
      0,
      player.r + 6,
      ship.shieldInner,
      ship.shieldOuter,
    );
    ctx.restore();
  }
  if (weaponFlash && weaponFlash.t > 0 && weaponFlash.colour) {
    const alpha = Math.max(0, Math.min(1, weaponFlash.t / weaponFlash.life));
    if (alpha > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85 * alpha * spriteAlpha;
      ctx.shadowColor = weaponFlash.colour;
      ctx.shadowBlur = 18;
      ctx.fillStyle = weaponFlash.colour;
      ctx.beginPath();
      ctx.ellipse(0, -18, 6.5, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
  if (invulnActive) {
    ctx.save();
    const ringPulse = 0.35 + 0.25 * (Math.sin(performance.now() * 0.006) + 1) / 2;
    ctx.globalAlpha = ringPulse;
    ctx.shadowColor = ship.glow;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = ship.trim;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, player.r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  if (precisionActive) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = ship.trim || '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
