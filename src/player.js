/**
 * player.js — player creation, movement, and rendering helpers for Retro Space Run.
 */
import { clamp, lerp, drawGlowCircle } from './utils.js';
import { getViewSize } from './ui.js';

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

export function updatePlayer(player, keys, dt, hasBoost) {
  const accel = hasBoost ? 560 : 380;
  const up = keys.has('arrowup') || keys.has('w');
  const down = keys.has('arrowdown') || keys.has('s');
  const left = keys.has('arrowleft') || keys.has('a');
  const right = keys.has('arrowright') || keys.has('d');
  const ax = (left ? -accel : 0) + (right ? accel : 0);
  const ay = (up ? -accel * 0.8 : 0) + (down ? accel * 0.8 : 0);
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

export function drawPlayer(ctx, player, keys, palette) {
  const ship = palette?.ship ?? {};
  ctx.save();
  ctx.translate(player.x, player.y);
  const tilt = clamp(
    (keys.has('arrowleft') || keys.has('a') ? -1 : 0) +
      (keys.has('arrowright') || keys.has('d') ? 1 : 0),
    -1,
    1,
  );
  ctx.rotate(tilt * 0.08);

  const engLen = 14 + (Math.sin(performance.now() * 0.02) + 1) * 6;
  const trail = ctx.createLinearGradient(0, 0, 0, 30);
  trail.addColorStop(0, ship.trailStart || '#00e5ffcc');
  trail.addColorStop(1, ship.trailEnd || '#ff3df700');
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-6, 24 + engLen);
  ctx.lineTo(6, 24 + engLen);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = ship.glow || '#00e5ff88';
  ctx.shadowBlur = 12;
  ctx.fillStyle = ship.primary || '#0ae6ff';
  ctx.strokeStyle = ship.trim || '#ff3df7';
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
  ctx.fillStyle = ship.cockpit || '#1efcff';
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
      ship.shieldInner || '#00e5ff55',
      ship.shieldOuter || '#00e5ff00',
    );
  }
  ctx.restore();
}
