/**
 * enemies.js — enemy spawning, behaviour updates, and rendering for Retro Space Run.
 */
import { rand, TAU, drawGlowCircle } from './utils.js';

const spawnTimers = {
  asteroid: 0,
  strafer: 0,
  drone: 0,
  turret: 0,
};

function shouldSpawn(now, key, interval) {
  if (now - spawnTimers[key] < interval) {
    return false;
  }
  spawnTimers[key] = now;
  return true;
}

export function spawnEnemies(state, now, canvas) {
  const w = canvas.width;
  if (shouldSpawn(now, 'asteroid', 900)) {
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      state.enemies.push({
        type: 'asteroid',
        x: rand(40, w - 40),
        y: -20 - rand(0, 200),
        vx: rand(-50, 50),
        vy: rand(80, 160),
        r: rand(12, 24),
        hp: 2,
      });
    }
  }
  if (shouldSpawn(now, 'strafer', 1400)) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      state.enemies.push({
        type: 'strafer',
        x: dir < 0 ? -30 : w + 30,
        y: rand(60, canvas.height * 0.5),
        vx: dir * rand(120, 180),
        vy: 20 * Math.sin(now * 0.001 + i),
        r: 14,
        hp: 3,
        cd: rand(300, 700),
      });
    }
  }
  if (shouldSpawn(now, 'drone', 2000)) {
    for (let i = 0; i < 2; i++) {
      state.enemies.push({
        type: 'drone',
        x: rand(40, w - 40),
        y: -40,
        vx: 0,
        vy: rand(60, 100),
        r: 12,
        hp: 2,
      });
    }
  }
  if (shouldSpawn(now, 'turret', 2600)) {
    for (let i = 0; i < 2; i++) {
      state.enemies.push({
        type: 'turret',
        x: rand(80, w - 80),
        y: -30,
        vx: 0,
        vy: rand(70, 110),
        r: 16,
        hp: 4,
        cd: 600,
      });
    }
  }
}

export function updateEnemies(state, dt, now, player, canvas) {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.type === 'asteroid') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < -40 || e.x > canvas.width + 40) {
        e.vx *= -1;
      }
    } else if (e.type === 'strafer') {
      e.x += e.vx * dt;
      e.y += Math.sin(now * 0.004 + i) * 40 * dt;
      e.cd -= dt * 1000;
      if (e.cd <= 0) {
        e.cd = rand(600, 1100);
        state.enemyBullets.push({
          x: e.x,
          y: e.y + 10,
          vx: (player.x - e.x) * 0.0025,
          vy: 180,
          r: 6,
        });
      }
      if (e.x < -60 || e.x > canvas.width + 60) {
        state.enemies.splice(i, 1);
        continue;
      }
    } else if (e.type === 'drone') {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) + 0.0001;
      e.vx += (dx / d) * 60 * dt;
      e.vy += (dy / d) * 60 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else if (e.type === 'turret') {
      e.y += e.vy * dt;
      e.cd -= dt * 1000;
      if (e.cd <= 0) {
        e.cd = 600 + Math.random() * 600;
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        state.enemyBullets.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(angle) * 220,
          vy: Math.sin(angle) * 220,
          r: 6,
        });
      }
    }
    if (e.y > canvas.height + 80) {
      state.enemies.splice(i, 1);
    }
  }
}

export function drawEnemies(ctx, enemies) {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'asteroid') {
      ctx.shadowColor = '#00e5ff55';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#11293b';
      ctx.strokeStyle = '#00e5ff66';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * TAU;
        const rr = e.r + rand(-4, 4);
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === 'strafer') {
      ctx.shadowColor = '#ff3df799';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#2e003b';
      ctx.strokeStyle = '#ff3df7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(0, -10);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === 'drone') {
      ctx.shadowColor = '#00e5ffaa';
      ctx.shadowBlur = 12;
      drawGlowCircle(ctx, 0, 0, e.r, '#00e5ff88', '#00e5ff00');
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-2, -2, 4, 4);
    } else if (e.type === 'turret') {
      ctx.shadowColor = '#00e5ff88';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#091a2c';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff3df7';
      ctx.fillRect(-2, -8, 4, 8);
    }
    ctx.restore();
  }
}
