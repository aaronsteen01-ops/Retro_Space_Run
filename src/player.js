/**
 * player.js — player creation, movement, and rendering helpers for Retro Space Run.
 */
import { clamp, lerp, drawGlowCircle } from './utils.js';
import { getViewSize } from './ui.js';
import { resolvePaletteSection } from './themes.js';

export function createPlayer() {
  const { w, h } = getViewSize();
  return {
    x: (w || 0) / 2,
    y: (h || 0) * 0.75,
    vx: 0,
    vy: 0,
    speed: 260,
    r: 14,
    shield: 0,
    invuln: 0,
  };
}

export function resetPlayer(state) {
  state.player = createPlayer();
}

export function updatePlayer(player, input, dt, hasBoost) {
  const accel = hasBoost ? 560 : 380;
  const moveX = clamp(Number.isFinite(input?.moveX) ? input.moveX : 0, -1, 1);
  const moveY = clamp(Number.isFinite(input?.moveY) ? input.moveY : 0, -1, 1);
  const ax = moveX * accel;
  const ay = moveY * accel * 0.8;
  player.vx = lerp(player.vx, ax, 0.08);
  player.vy = lerp(player.vy, ay, 0.08);
  player.x += player.vx * dt;
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
  ctx.rotate(tilt * 0.08);

  const engLen = 14 + (Math.sin(performance.now() * 0.02) + 1) * 6;
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
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(12, 10);
  ctx.lineTo(0, 16);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = ship.cockpit;
  ctx.beginPath();
  ctx.ellipse(0, -6, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.shield > 0) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() * 0.01);
    drawGlowCircle(
      ctx,
      0,
      0,
      player.r + 6,
      ship.shieldInner,
      ship.shieldOuter,
    );
  }
  if (weaponFlash && weaponFlash.t > 0 && weaponFlash.colour) {
    const alpha = Math.max(0, Math.min(1, weaponFlash.t / weaponFlash.life));
    if (alpha > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85 * alpha;
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
  ctx.restore();
}
