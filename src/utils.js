/**
 * utils.js — shared math helpers and lightweight entity utilities for Retro Space Run.
 */
export const TAU = Math.PI * 2;

export const lerp = (a, b, t) => a + (b - a) * t;

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const rand = (a, b) => Math.random() * (b - a) + a;

export function coll(a, b, pad = 0) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = (a.r || 0) + (b.r || 0) + pad;
  return dx * dx + dy * dy <= rr * rr;
}

export function addParticle(state, x, y, col, count = 10, spread = 2, life = 400) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: rand(-spread, spread),
      vy: rand(-spread, spread),
      life,
      t: life,
      col,
    });
  }
}

export function drawGlowCircle(ctx, x, y, r, c1, c2) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.6);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
