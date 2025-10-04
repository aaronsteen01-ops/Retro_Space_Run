/**
 * enemies.js — enemy spawning, behaviour updates, and rendering for Retro Space Run.
 */
import { rand, TAU, drawGlowCircle, addParticle, clamp } from './utils.js';

const spawnTimers = {
  asteroid: 0,
  strafer: 0,
  drone: 0,
  turret: 0,
};

const BOSS_HP = 540;

function pushBossBullet(state, x, y, speed, angle, radius = 8) {
  state.enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
  });
}

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

export function spawnBoss(state, canvas) {
  state.enemies.length = 0;
  const boss = {
    type: 'boss',
    x: canvas.width / 2,
    y: -160,
    vx: 0,
    vy: 160,
    r: 60,
    hp: BOSS_HP,
    maxHp: BOSS_HP,
    phase: 1,
    cooldown: 1400,
    volleyTimer: 1200,
    sweepDir: 1,
    entering: true,
    introTimer: 2200,
  };
  state.enemyBullets.length = 0;
  state.boss = boss;
  return boss;
}

export function updateBoss(state, dt, now, player, canvas) {
  const boss = state.boss;
  if (!boss) {
    return;
  }

  if (boss.entering) {
    boss.y += boss.vy * dt;
    if (boss.y >= canvas.height * 0.25) {
      boss.y = canvas.height * 0.25;
      boss.vy = 0;
      boss.entering = false;
      boss.cooldown = 800;
    }
  }

  if (boss.hp <= boss.maxHp * 0.55 && boss.phase === 1) {
    boss.phase = 2;
    boss.cooldown = 500;
    boss.volleyTimer = 400;
    addParticle(state, boss.x, boss.y, '#ff3df7', 40, 4, 800);
  }

  boss.introTimer = Math.max(0, boss.introTimer - dt * 1000);

  const leftBound = 140;
  const rightBound = canvas.width - 140;
  const sweepSpeed = boss.phase === 1 ? 130 : 190;
  boss.x += boss.sweepDir * sweepSpeed * dt;
  if (boss.x < leftBound) {
    boss.x = leftBound;
    boss.sweepDir = 1;
  } else if (boss.x > rightBound) {
    boss.x = rightBound;
    boss.sweepDir = -1;
  }

  if (boss.phase === 1) {
    boss.y = clamp(boss.y + Math.sin(now * 0.0015) * 12 * dt * 60, canvas.height * 0.22, canvas.height * 0.28);
    boss.cooldown -= dt * 1000;
    if (boss.cooldown <= 0) {
      boss.cooldown = 900;
      const base = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -1; i <= 1; i++) {
        const angle = base + i * 0.18;
        pushBossBullet(state, boss.x + i * 26, boss.y + 34, 260 + Math.abs(i) * 20, angle);
      }
    }
  } else {
    boss.y = canvas.height * 0.22 + Math.sin(now * 0.0025) * 36;
    boss.cooldown -= dt * 1000;
    boss.volleyTimer -= dt * 1000;
    if (boss.cooldown <= 0) {
      boss.cooldown = 620;
      const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -2; i <= 2; i++) {
        const angle = aim + i * 0.12;
        pushBossBullet(state, boss.x + i * 22, boss.y + 28, 300 + Math.abs(i) * 18, angle, 9);
      }
    }
    if (boss.volleyTimer <= 0) {
      boss.volleyTimer = 2100;
      for (let i = 0; i < 12; i++) {
        const angle = (-Math.PI / 2) + (i - 5.5) * 0.18;
        pushBossBullet(state, boss.x, boss.y + 12, 260 + i * 6, angle, 7);
      }
    }
  }
}

export function drawBoss(ctx, boss) {
  if (!boss) {
    return;
  }
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.shadowColor = boss.phase === 2 ? '#ff9dfd' : '#ff3df7aa';
  ctx.shadowBlur = boss.phase === 2 ? 40 : 28;
  ctx.fillStyle = '#1a0524';
  ctx.strokeStyle = boss.phase === 2 ? '#ffb5ff' : '#ff3df7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-60, 20);
  ctx.quadraticCurveTo(-20, -40, 0, -50);
  ctx.quadraticCurveTo(20, -40, 60, 20);
  ctx.quadraticCurveTo(20, 40, 0, 54);
  ctx.quadraticCurveTo(-20, 40, -60, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = boss.phase === 2 ? '#ffdbff' : '#ffd0ff';
  ctx.fillRect(-14, -16, 28, 32);
  drawGlowCircle(ctx, 0, 0, 16, '#ff3df7aa', '#ff3df700');
  ctx.fillStyle = '#0ae6ff';
  ctx.fillRect(-4, -10, 8, 20);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(-22, 12, 44, 6);
  if (boss.phase === 2) {
    ctx.fillStyle = '#ff3df7';
    ctx.fillRect(-40, 24, 80, 6);
  }
  if (boss.introTimer > 0) {
    ctx.save();
    ctx.translate(0, -80);
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3df7';
    ctx.shadowColor = '#ff3df788';
    ctx.shadowBlur = 12;
    ctx.fillText('WARNING — CORE GUARDIAN', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

export function drawBossHealth(ctx, boss, canvas) {
  if (!boss) {
    return;
  }
  const width = Math.min(canvas.width * 0.5, 420);
  const x = (canvas.width - width) / 2;
  const y = 42;
  const ratio = Math.max(0, boss.hp) / boss.maxHp;
  ctx.save();
  ctx.fillStyle = '#060712cc';
  ctx.fillRect(x, y, width, 12);
  ctx.shadowColor = '#ff3df799';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ff3df7';
  ctx.fillRect(x, y, width * ratio, 12);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#00e5ffaa';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, width + 2, 14);
  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e7faff';
  ctx.fillText(`Boss Integrity ${Math.ceil(ratio * 100)}%`, canvas.width / 2, y - 6);
  ctx.restore();
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
