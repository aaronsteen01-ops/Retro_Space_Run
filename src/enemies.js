/**
 * enemies.js — enemy spawning, behaviour updates, and rendering for Retro Space Run.
 */
import { rand, TAU, drawGlowCircle, addParticle, clamp } from './utils.js';
import { getViewSize } from './ui.js';
import { getDifficulty } from './difficulty.js';
import { resolvePaletteSection } from './themes.js';

const spawnTimers = {
  asteroid: -1,
  strafer: -1,
  drone: -1,
  turret: -1,
};

const SPAWN_WINDOW_MS = 80;

const DEFAULT_BOSS_HP = 540;
const ASSIST_DENSITY = 0.7;
const BOSS_PHASE_THRESHOLDS = [0.7, 0.4];
const MAX_BOSS_PHASE = 3;

function pushBossBullet(state, x, y, speed, angle, radius = 8) {
  const bornAt = state.time * 1000;
  state.enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
    bornAt,
  });
}

function spawnBossMinions(state, boss, count = 2) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const minions = state.enemies.filter((e) => e.type === 'drone' && e.bossMinion).length;
  if (minions >= 4) {
    return;
  }
  const spacing = 90;
  for (let i = 0; i < count; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    const offset = (Math.floor(i / 2) + 1) * spacing * 0.6;
    state.enemies.push({
      type: 'drone',
      x: clamp(boss.x + dir * offset, 60, viewW - 60),
      y: boss.y + 48 + i * 12,
      vx: 0,
      vy: 0,
      r: 13,
      hp: 3,
      accel: 90,
      bossMinion: true,
    });
  }
}

function emitBossRing(state, boss, player, count = 24) {
  const safeAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
  const gapWidth = 0.42;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    let diff = angle - safeAngle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    if (Math.abs(diff) < gapWidth) {
      continue;
    }
    pushBossBullet(state, boss.x, boss.y + 8, 220, angle, 10);
  }
}

function shouldSpawn(now, key, intervalMs, offsetMs = 0) {
  if (!intervalMs || intervalMs <= 0) {
    return false;
  }
  const adjusted = now + offsetMs;
  const cycle = Math.floor(adjusted / intervalMs);
  if (cycle <= spawnTimers[key]) {
    return false;
  }
  const phase = adjusted % intervalMs;
  if (phase > SPAWN_WINDOW_MS) {
    return false;
  }
  spawnTimers[key] = cycle;
  return true;
}

function resolveSpawnCount(baseCount, assistEnabled) {
  if (!assistEnabled) {
    return baseCount;
  }
  if (baseCount <= 1) {
    return Math.random() < ASSIST_DENSITY ? 1 : 0;
  }
  const scaled = Math.floor(baseCount * ASSIST_DENSITY);
  return Math.max(1, scaled);
}

export function spawnEnemies(state, now) {
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const difficulty = getDifficulty(state.levelIndex);
  const spawnConfig = difficulty?.spawn || {};
  const assistEnabled = Boolean(state.assistEnabled);
  const asteroidSettings = spawnConfig.asteroid || difficulty?.asteroid || {};
  const straferSettings = spawnConfig.strafer || difficulty?.strafer || {};
  const droneSettings = spawnConfig.drone || difficulty?.drone || {};
  const turretSettings = spawnConfig.turret || difficulty?.turret || {};
  const asteroidInterval = asteroidSettings.every ?? asteroidSettings.intervalMs ?? 900;
  const asteroidOffset = asteroidSettings.offset ?? 0;
  const asteroidVyMin = asteroidSettings.vyMin ?? 80;
  const asteroidVyMax = asteroidSettings.vyMax ?? 160;
  const straferInterval = straferSettings.every ?? 1400;
  const straferOffset = straferSettings.offset ?? 0;
  const straferCount = Math.max(1, Math.round(straferSettings.count ?? 3));
  const straferCdMin = straferSettings.fireCdMin ?? straferSettings.fireCdMsMin ?? 600;
  const straferCdMax = straferSettings.fireCdMax ?? straferSettings.fireCdMsMax ?? 1100;
  const droneInterval = droneSettings.every ?? 2000;
  const droneOffset = droneSettings.offset ?? 0;
  const droneAccel = droneSettings.steerAccel ?? 60;
  const turretInterval = turretSettings.every ?? 2600;
  const turretOffset = turretSettings.offset ?? 0;
  const turretCdMin = turretSettings.fireCdMin ?? 600;
  const turretCdMax = turretSettings.fireCdMax ?? 1200;
  const turretBulletSpeed = turretSettings.bulletSpeed ?? 220;
  const asteroidMax = Math.max(viewW - 40, 40);
  const droneMax = Math.max(viewW - 40, 40);
  const turretMax = Math.max(viewW - 80, 80);
  if (shouldSpawn(now, 'asteroid', asteroidInterval, asteroidOffset)) {
    const base = 5 + Math.floor(Math.random() * 3);
    const count = resolveSpawnCount(base, assistEnabled);
    for (let i = 0; i < count; i++) {
      state.enemies.push({
        type: 'asteroid',
        x: rand(40, asteroidMax),
        y: -20 - rand(0, 200),
        vx: rand(-50, 50),
        vy: rand(asteroidVyMin, asteroidVyMax),
        r: rand(12, 24),
        hp: 2,
      });
    }
  }
  if (shouldSpawn(now, 'strafer', straferInterval, straferOffset)) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const count = resolveSpawnCount(straferCount, assistEnabled);
    for (let i = 0; i < count; i++) {
      state.enemies.push({
        type: 'strafer',
        x: dir < 0 ? -30 : viewW + 30,
        y: rand(60, viewH * 0.5),
        vx: dir * rand(120, 180),
        vy: 20 * Math.sin(now * 0.001 + i),
        r: 14,
        hp: 3,
        cd: rand(straferCdMin, straferCdMax),
      });
    }
  }
  if (shouldSpawn(now, 'drone', droneInterval, droneOffset)) {
    const count = resolveSpawnCount(2, assistEnabled);
    for (let i = 0; i < count; i++) {
      state.enemies.push({
        type: 'drone',
        x: rand(40, droneMax),
        y: -40,
        vx: 0,
        vy: rand(60, 100),
        r: 12,
        hp: 2,
        accel: droneAccel,
      });
    }
  }
  if (shouldSpawn(now, 'turret', turretInterval, turretOffset)) {
    const count = resolveSpawnCount(2, assistEnabled);
    for (let i = 0; i < count; i++) {
      state.enemies.push({
        type: 'turret',
        x: rand(80, turretMax),
        y: -30,
        vx: 0,
        vy: rand(70, 110),
        r: 16,
        hp: 4,
        cd: rand(turretCdMin, turretCdMax),
        bulletSpeed: turretBulletSpeed,
      });
    }
  }
}

export function updateEnemies(state, dt, now, player) {
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const difficulty = getDifficulty(state.levelIndex);
  const spawnConfig = difficulty?.spawn || {};
  const straferSettings = spawnConfig.strafer || difficulty?.strafer || {};
  const droneSettings = spawnConfig.drone || difficulty?.drone || {};
  const turretSettings = spawnConfig.turret || difficulty?.turret || {};
  const straferCdMin = straferSettings.fireCdMin ?? straferSettings.fireCdMsMin ?? 600;
  const straferCdMax = straferSettings.fireCdMax ?? straferSettings.fireCdMsMax ?? 1100;
  const droneAccel = droneSettings.steerAccel ?? 60;
  const turretCdMin = turretSettings.fireCdMin ?? 600;
  const turretCdMax = turretSettings.fireCdMax ?? 1200;
  const turretBulletSpeed = turretSettings.bulletSpeed ?? 220;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.type === 'asteroid') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < -40 || e.x > viewW + 40) {
        e.vx *= -1;
        const dir = Math.sign(e.vx || 0) || 1;
        e.x = clamp(e.x + dir * 6, -40, viewW + 40);
      }
    } else if (e.type === 'strafer') {
      e.x += e.vx * dt;
      e.y += Math.sin(now * 0.004 + i) * 40 * dt;
      e.cd -= dt * 1000;
      if (e.cd <= 0) {
        e.cd = rand(straferCdMin, straferCdMax);
        state.enemyBullets.push({
          x: e.x,
          y: e.y + 10,
          vx: (player.x - e.x) * 0.0025,
          vy: 180,
          r: 6,
          bornAt: state.time * 1000,
        });
      }
      if (e.x < -60 || e.x > viewW + 60) {
        state.enemies.splice(i, 1);
        continue;
      }
    } else if (e.type === 'drone') {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) + 0.0001;
      const accel = e.accel ?? droneAccel;
      e.vx += (dx / d) * accel * dt;
      e.vy += (dy / d) * accel * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < -60 || e.x > viewW + 60) {
        state.enemies.splice(i, 1);
        continue;
      }
    } else if (e.type === 'turret') {
      e.y += e.vy * dt;
      e.cd -= dt * 1000;
      if (e.cd <= 0) {
        e.cd = rand(turretCdMin, turretCdMax);
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        state.enemyBullets.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(angle) * (e.bulletSpeed ?? turretBulletSpeed),
          vy: Math.sin(angle) * (e.bulletSpeed ?? turretBulletSpeed),
          r: 6,
          bornAt: state.time * 1000,
        });
      }
      if (e.x < 60 || e.x > viewW - 60) {
        e.vx *= -1;
        e.x = clamp(e.x, 60, viewW - 60);
      }
    }
    if (e.y > viewH + 80) {
      state.enemies.splice(i, 1);
    }
  }
}

export function spawnBoss(state) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  state.enemies.length = 0;
  const difficulty = getDifficulty(state.levelIndex);
  const bossHp = difficulty?.bossHp ?? DEFAULT_BOSS_HP;
  const boss = {
    type: 'boss',
    x: viewW / 2,
    y: -160,
    vx: 0,
    vy: 160,
    r: 60,
    hp: bossHp,
    maxHp: bossHp,
    phase: 1,
    maxPhase: MAX_BOSS_PHASE,
    phaseThresholds: [...BOSS_PHASE_THRESHOLDS],
    nextPhaseIndex: 0,
    cooldown: 1400,
    volleyTimer: 1200,
    sweepDir: 1,
    sideVolleyFlip: 1,
    entering: true,
    introTimer: 2200,
    phaseFlashTimer: 0,
    specialCueTimer: 0,
    warningTimer: 0,
    ringCooldown: 2600,
    ringChargeTimer: 0,
    summonTimer: 3800,
    glowPulse: 0,
    warningPulse: 0,
    rewardDropped: false,
  };
  state.enemyBullets.length = 0;
  state.boss = boss;
  return boss;
}

export function updateBoss(state, dt, now, player, palette) {
  const boss = state.boss;
  if (!boss) {
    return;
  }
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const particles = resolvePaletteSection(palette, 'particles');

  if (boss.entering) {
    boss.y += boss.vy * dt;
    if (boss.y >= viewH * 0.25) {
      boss.y = viewH * 0.25;
      boss.vy = 0;
      boss.entering = false;
      boss.cooldown = 800;
    }
  }

  boss.glowPulse = (boss.glowPulse + dt * 6.5) % TAU;
  boss.warningPulse = (boss.warningPulse + dt * 8.2) % TAU;
  boss.phaseFlashTimer = Math.max(0, boss.phaseFlashTimer - dt * 1000);
  boss.specialCueTimer = Math.max(0, boss.specialCueTimer - dt * 1000);
  boss.warningTimer = Math.max(0, boss.warningTimer - dt * 1000);
  boss.introTimer = Math.max(0, boss.introTimer - dt * 1000);

  const enterPhase = (targetPhase) => {
    if (boss.phase === targetPhase) {
      return;
    }
    boss.phase = targetPhase;
    boss.phaseFlashTimer = 720;
    addParticle(state, boss.x, boss.y, particles.bossHit, 48, 4.4, 900);
    if (boss.phase === 2) {
      boss.cooldown = 520;
      boss.volleyTimer = 460;
      boss.summonTimer = 0;
      boss.sideVolleyFlip = 1;
    } else if (boss.phase >= 3) {
      boss.cooldown = 440;
      boss.volleyTimer = 940;
      boss.ringCooldown = 1400;
      boss.ringChargeTimer = 520;
      boss.specialCueTimer = 720;
      boss.warningTimer = 2000;
      boss.summonTimer = 2600;
      boss.sideVolleyFlip = 1;
    }
  };

  const thresholds = boss.phaseThresholds || [];
  const nextThreshold = thresholds[boss.nextPhaseIndex];
  if (nextThreshold !== undefined && boss.hp <= boss.maxHp * nextThreshold) {
    boss.nextPhaseIndex += 1;
    const targetPhase = Math.min(1 + boss.nextPhaseIndex, boss.maxPhase || MAX_BOSS_PHASE);
    enterPhase(targetPhase);
  }

  const leftBound = 140;
  const rightBound = viewW - 140;
  const sweepSpeed = boss.phase === 1 ? 120 : boss.phase === 2 ? 190 : 230;
  boss.x += boss.sweepDir * sweepSpeed * dt;
  if (boss.x < leftBound) {
    boss.x = leftBound;
    boss.sweepDir = 1;
  } else if (boss.x > rightBound) {
    boss.x = rightBound;
    boss.sweepDir = -1;
  }

  if (boss.phase === 1) {
    boss.y = clamp(
      boss.y + Math.sin(now * 0.0015) * 12 * dt * 60,
      viewH * 0.22,
      viewH * 0.28,
    );
    boss.cooldown -= dt * 1000;
    if (boss.cooldown <= 0) {
      boss.cooldown = 960;
      const base = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -1; i <= 1; i++) {
        const angle = base + i * 0.18;
        pushBossBullet(state, boss.x + i * 24, boss.y + 34, 220 + Math.abs(i) * 18, angle, 9);
      }
    }
    if (boss.summonTimer > 0) {
      boss.summonTimer -= dt * 1000;
      if (boss.summonTimer <= 0) {
        spawnBossMinions(state, boss, 1);
        boss.summonTimer = 5200;
      }
    }
  } else if (boss.phase === 2) {
    boss.y = viewH * 0.22 + Math.sin(now * 0.0025) * 36;
    boss.cooldown -= dt * 1000;
    boss.volleyTimer -= dt * 1000;
    if (boss.cooldown <= 0) {
      boss.cooldown = 520;
      const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -2; i <= 2; i++) {
        const angle = aim + i * 0.11;
        pushBossBullet(state, boss.x + i * 22, boss.y + 30, 300 + Math.abs(i) * 20, angle, 9);
      }
    }
    if (boss.volleyTimer <= 0) {
      boss.volleyTimer = 1800;
      const offset = 52 * boss.sideVolleyFlip;
      boss.sideVolleyFlip *= -1;
      for (let i = -2; i <= 2; i++) {
        const angle = (-Math.PI / 2) + i * 0.09;
        pushBossBullet(state, boss.x - offset, boss.y + 26, 320, angle, 8);
        pushBossBullet(state, boss.x + offset, boss.y + 26, 320, angle + 0.04 * i, 7);
      }
    }
  } else {
    boss.y = viewH * 0.2 + Math.sin(now * 0.0031) * 44 + Math.sin(boss.glowPulse) * 6;
    boss.cooldown -= dt * 1000;
    boss.volleyTimer -= dt * 1000;
    if (boss.cooldown <= 0) {
      boss.cooldown = 440;
      const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -2; i <= 2; i++) {
        const angle = aim + i * 0.1;
        pushBossBullet(state, boss.x + i * 20, boss.y + 26, 340 + Math.abs(i) * 26, angle, 10);
      }
    }
    if (boss.volleyTimer <= 0) {
      boss.volleyTimer = 1400;
      const spread = 0.22;
      for (let i = 0; i < 6; i++) {
        const leftAngle = (-Math.PI / 2) - spread + i * 0.07;
        const rightAngle = (-Math.PI / 2) + spread - i * 0.07;
        pushBossBullet(state, boss.x - 46, boss.y + 16, 330, leftAngle, 7);
        pushBossBullet(state, boss.x + 46, boss.y + 16, 330, rightAngle, 7);
      }
    }
    if (boss.ringChargeTimer > 0) {
      boss.ringChargeTimer -= dt * 1000;
      if (boss.ringChargeTimer <= 0) {
        emitBossRing(state, boss, player, 26);
        boss.ringCooldown = rand(2600, 3600);
        boss.specialCueTimer = 0;
      }
    } else {
      boss.ringCooldown -= dt * 1000;
      if (boss.ringCooldown <= 0) {
        boss.ringChargeTimer = 600;
        boss.specialCueTimer = Math.max(boss.specialCueTimer, 600);
        boss.ringCooldown = 0;
      }
    }
    boss.summonTimer -= dt * 1000;
    if (boss.summonTimer <= 0) {
      spawnBossMinions(state, boss, 2);
      boss.summonTimer = rand(3600, 5200);
    }
  }
}

export function drawBoss(ctx, boss, palette) {
  if (!boss) {
    return;
  }
  const bossPalette = resolvePaletteSection(palette, 'boss');
  if (boss.warningTimer > 0) {
    const { w, h } = getViewSize();
    const intensity = clamp(boss.warningTimer / 2000, 0, 1);
    const pulse = 0.65 + 0.35 * Math.sin(boss.warningPulse || 0);
    ctx.save();
    ctx.fillStyle = bossPalette.warningBackdrop;
    ctx.globalAlpha = intensity * 0.9;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 64px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = bossPalette.warningGlow;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = bossPalette.warningStroke;
    ctx.lineWidth = 3;
    const y = h * 0.2;
    const fill = bossPalette.warningFill;
    ctx.strokeText('WARNING', w / 2, y);
    ctx.fillStyle = fill;
    ctx.globalAlpha = pulse;
    ctx.fillText('WARNING', w / 2, y);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const isPhase2 = boss.phase === 2;
  const isPhase3 = boss.phase >= 3;
  const telegraphStrength = Math.max(
    boss.phaseFlashTimer / 720,
    boss.specialCueTimer / 720,
  );
  const telegraphPulse = 0.65 + 0.35 * Math.sin((boss.glowPulse || 0) * 2);
  let shadowColor = isPhase3
    ? bossPalette.shadowPhase3
    : isPhase2
      ? bossPalette.shadowPhase2
      : bossPalette.shadowPhase1;
  let shadowBlur = isPhase3 ? 46 : isPhase2 ? 40 : 28;
  let strokeStyle = isPhase3
    ? bossPalette.strokePhase3
    : isPhase2
      ? bossPalette.strokePhase2
      : bossPalette.strokePhase1;
  if (telegraphStrength > 0.01) {
    shadowColor = bossPalette.phaseShiftGlow;
    shadowBlur = 52 + telegraphPulse * 12 * clamp(telegraphStrength, 0, 1);
    strokeStyle = bossPalette.strokePhaseShift;
  }
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.fillStyle = bossPalette.bodyFill;
  ctx.strokeStyle = strokeStyle;
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
  const canopyPhase2 = bossPalette.canopyPhase2;
  const canopyPhase3 = bossPalette.canopyPhase3;
  ctx.fillStyle = isPhase3
    ? canopyPhase3
    : isPhase2
      ? canopyPhase2
      : bossPalette.canopy;
  ctx.fillRect(-14, -16, 28, 32);
  const coreInner = telegraphStrength > 0.01
    ? bossPalette.phaseShiftGlow
    : bossPalette.coreGlow;
  const coreOuter = telegraphStrength > 0.01
    ? bossPalette.phaseShiftOuter
    : bossPalette.coreOuter;
  drawGlowCircle(
    ctx,
    0,
    0,
    16,
    coreInner,
    coreOuter,
  );
  ctx.fillStyle = bossPalette.beam;
  ctx.fillRect(-4, -10, 8, 20);
  let trimColor = bossPalette.trim;
  if (telegraphStrength > 0.01) {
    trimColor = bossPalette.phaseShiftTrim;
  }
  ctx.fillStyle = trimColor;
  ctx.fillRect(-22, 12, 44, 6);
  if (isPhase2) {
    ctx.fillStyle = bossPalette.phase2Trim;
    ctx.fillRect(-40, 24, 80, 6);
  }
  if (isPhase3) {
    ctx.fillStyle = bossPalette.phase3Trim;
    ctx.fillRect(-46, 30, 92, 6);
  }
  if (boss.introTimer > 0) {
    ctx.save();
    ctx.translate(0, -80);
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = bossPalette.introText;
    ctx.shadowColor = bossPalette.introGlow;
    ctx.shadowBlur = 12;
    ctx.fillText('WARNING — CORE GUARDIAN', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

export function drawBossHealth(ctx, boss, palette) {
  if (!boss) {
    return;
  }
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const bossPalette = resolvePaletteSection(palette, 'boss');
  const width = Math.min(viewW * 0.5, 420);
  const x = (viewW - width) / 2;
  const y = 42;
  const ratio = Math.max(0, boss.hp) / boss.maxHp;
  ctx.save();
  ctx.fillStyle = bossPalette.healthBackground;
  ctx.fillRect(x, y, width, 12);
  ctx.shadowColor = bossPalette.healthShadow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = bossPalette.healthFill;
  ctx.fillRect(x, y, width * ratio, 12);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = bossPalette.healthStroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, width + 2, 14);
  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = bossPalette.healthText;
  ctx.fillText(`Boss Integrity ${Math.ceil(ratio * 100)}%`, viewW / 2, y - 6);
  ctx.restore();
}

export function drawEnemies(ctx, enemies, palette) {
  const enemyPalette = resolvePaletteSection(palette, 'enemies');
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'asteroid') {
      ctx.shadowColor = enemyPalette.asteroidGlow;
      ctx.shadowBlur = 6;
      ctx.fillStyle = enemyPalette.asteroidFill;
      ctx.strokeStyle = enemyPalette.asteroidStroke;
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
      ctx.shadowColor = enemyPalette.straferGlow;
      ctx.shadowBlur = 10;
      ctx.fillStyle = enemyPalette.straferFill;
      ctx.strokeStyle = enemyPalette.straferStroke;
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
      ctx.shadowColor = enemyPalette.droneGlowInner;
      ctx.shadowBlur = 12;
      drawGlowCircle(
        ctx,
        0,
        0,
        e.r,
        enemyPalette.droneGlowInner,
        enemyPalette.droneGlowOuter,
      );
      ctx.fillStyle = enemyPalette.droneCore;
      ctx.fillRect(-2, -2, 4, 4);
    } else if (e.type === 'turret') {
      ctx.shadowColor = enemyPalette.turretGlow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = enemyPalette.turretFill;
      ctx.strokeStyle = enemyPalette.turretStroke;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = enemyPalette.turretBarrel;
      ctx.fillRect(-2, -8, 4, 8);
    }
    ctx.restore();
  }
}
