/**
 * enemies.js — enemy spawning, behaviour updates, and rendering for Retro Space Run.
 */
import { rand, TAU, drawGlowCircle, addParticle, clamp } from './utils.js';
import { getViewSize } from './ui.js';
import { getDifficulty } from './difficulty.js';
import { resolvePaletteSection } from './themes.js';
import { playPow } from './audio.js';
import { getBullet, drainBullets } from './bullets.js';

const DEFAULT_BOSS_HP = 540;
const ASSIST_DENSITY = 0.7;
const BOSS_PHASE_THRESHOLDS = [0.7, 0.4];
const MAX_BOSS_PHASE = 3;
const PHASE_TELEGRAPH_MS = 500;
const PHASE1_CADENCE_MS = 1180;
const PHASE2_RING_INTERVAL_MS = 3200;
const PHASE2_RING_WAVE_GAP_MS = 200;
const PHASE3_BEAM_PREP_MS = 900;
const PHASE3_BEAM_DURATION_MS = 2600;
const PHASE3_BEAM_SWEEP_RANGE = 1.05; // radians swept per beam
const PHASE3_DRONE_INTERVAL_MS = 5600;
const BEAM_LENGTH_RATIO = 0.85;
const BEAM_WIDTH = 220;
const BEAM_SAFE_WIDTH = 80;
const BEAM_SAFE_LANES = [-0.45, 0.45];

const randInt = (min, max) => Math.floor(rand(min, max + 1));

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

function spawnAsteroids(state, count, params) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const asteroidMax = Math.max(viewW - 40, 40);
  const {
    vxMin = -50,
    vxMax = 50,
    vyMin = 80,
    vyMax = 160,
    radiusMin = 12,
    radiusMax = 24,
    spawnYOffsetMin = 0,
    spawnYOffsetMax = 200,
    hp = 2,
  } = params;
  for (let i = 0; i < count; i++) {
    state.enemies.push({
      type: 'asteroid',
      x: rand(40, asteroidMax),
      y: -20 - rand(spawnYOffsetMin, spawnYOffsetMax),
      vx: rand(vxMin, vxMax),
      vy: rand(vyMin, vyMax),
      r: rand(radiusMin, radiusMax),
      hp,
    });
  }
}

function spawnStrafers(state, count, params) {
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const {
    speedMin = 120,
    speedMax = 180,
    fireCdMin: fireCdMinRaw,
    fireCdMax: fireCdMaxRaw,
    fireCdMsMin,
    fireCdMsMax,
    radius = 14,
    hp = 3,
    yMin = 60,
    yMax = viewH * 0.5,
    direction,
  } = params;
  const fireCdMin = fireCdMinRaw ?? fireCdMsMin ?? 600;
  const fireCdMax = fireCdMaxRaw ?? fireCdMsMax ?? 1100;
  const dir = direction ?? (Math.random() < 0.5 ? -1 : 1);
  const yMinVal = yMin <= 1 ? viewH * yMin : yMin;
  const yMaxVal = yMax <= 1 ? viewH * yMax : yMax;
  for (let i = 0; i < count; i++) {
    state.enemies.push({
      type: 'strafer',
      x: dir < 0 ? -30 : viewW + 30,
      y: rand(yMinVal, Math.max(yMinVal, yMaxVal)),
      vx: dir * rand(speedMin, speedMax),
      vy: 0,
      r: radius,
      hp,
      cd: rand(fireCdMin, fireCdMax),
    });
  }
}

function spawnDrones(state, count, params) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const droneMax = Math.max(viewW - 40, 40);
  const {
    vyMin = 60,
    vyMax = 100,
    accel: accelRaw,
    steerAccel,
    hp = 2,
    startY = -40,
  } = params;
  const accel = accelRaw ?? steerAccel ?? 60;
  for (let i = 0; i < count; i++) {
    state.enemies.push({
      type: 'drone',
      x: rand(40, droneMax),
      y: startY,
      vx: 0,
      vy: rand(vyMin, vyMax),
      r: 12,
      hp,
      accel,
    });
  }
}

function spawnTurrets(state, count, params) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const turretMax = Math.max(viewW - 80, 80);
  const {
    vyMin = 70,
    vyMax = 110,
    fireCdMin: fireCdMinRaw,
    fireCdMax: fireCdMaxRaw,
    fireCdMsMin,
    fireCdMsMax,
    bulletSpeed = 220,
    hp = 4,
    radius = 16,
  } = params;
  const fireCdMin = fireCdMinRaw ?? fireCdMsMin ?? 600;
  const fireCdMax = fireCdMaxRaw ?? fireCdMsMax ?? 1200;
  for (let i = 0; i < count; i++) {
    state.enemies.push({
      type: 'turret',
      x: rand(80, turretMax),
      y: -30,
      vx: 0,
      vy: rand(vyMin, vyMax),
      r: radius,
      hp,
      cd: rand(fireCdMin, fireCdMax),
      bulletSpeed,
    });
  }
}

export function spawn(state, type, params = {}) {
  if (!type) {
    return;
  }
  const { count = 1, countRange, ...config } = params;
  let resolvedCount = count;
  if (Array.isArray(countRange) && countRange.length >= 2) {
    const [min, max] = countRange;
    const minInt = Math.floor(min);
    const maxInt = Math.floor(max);
    const low = Math.max(0, Math.min(minInt, maxInt));
    const high = Math.max(low, Math.max(minInt, maxInt));
    resolvedCount = randInt(low, high);
  }
  resolvedCount = Math.max(0, Math.round(resolvedCount));
  resolvedCount = resolveSpawnCount(resolvedCount, Boolean(state.assistEnabled));
  if (resolvedCount <= 0) {
    return;
  }
  if (type === 'asteroid') {
    spawnAsteroids(state, resolvedCount, config);
  } else if (type === 'strafer') {
    spawnStrafers(state, resolvedCount, config);
  } else if (type === 'drone') {
    spawnDrones(state, resolvedCount, config);
  } else if (type === 'turret') {
    spawnTurrets(state, resolvedCount, config);
  }
}

function pushBossBullet(state, x, y, speed, angle, radius = 8) {
  const bornAt = state.time * 1000;
  const bullet = getBullet();
  bullet.x = x;
  bullet.y = y;
  bullet.vx = Math.cos(angle) * speed;
  bullet.vy = Math.sin(angle) * speed;
  bullet.r = radius;
  bullet.bornAt = bornAt;
  bullet.updatedAt = bornAt;
  bullet.owner = 'enemy';
  state.enemyBullets.push(bullet);
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

function emitBossRing(state, boss, config = {}) {
  const {
    count = 28,
    speed = 220,
    safeAngles = [],
    gapWidth = 0.4,
  } = config;
  for (let i = 0; i < count; i++) {
    const angle = (i / Math.max(1, count)) * TAU;
    const blocked = safeAngles.some((safe) => {
      let diff = angle - safe;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      return Math.abs(diff) <= gapWidth / 2;
    });
    if (blocked) {
      continue;
    }
    pushBossBullet(state, boss.x, boss.y + 8, speed, angle, 10);
  }
}

function createBossBeam(boss, config) {
  if (!boss) {
    return;
  }
  const {
    startAngle,
    endAngle,
    duration,
    turnRate,
    length,
  } = config;
  const dir = endAngle > startAngle ? 1 : endAngle < startAngle ? -1 : 0;
  boss.beam = {
    angle: startAngle,
    targetAngle: endAngle,
    duration: duration ?? 2400,
    elapsed: 0,
    turnRate: turnRate ?? 0.55,
    turnDir: dir,
    originX: boss.x,
    originY: boss.y + 28,
    width: BEAM_WIDTH,
    length,
    safeWidth: BEAM_SAFE_WIDTH,
    safeLanes: [...BEAM_SAFE_LANES],
  };
}

function updateBossBeam(boss, dt, viewH) {
  const beam = boss?.beam;
  if (!beam) {
    return;
  }
  beam.elapsed += dt * 1000;
  beam.originX = boss.x;
  beam.originY = boss.y + 28;
  beam.length = viewH * BEAM_LENGTH_RATIO;
  if (beam.turnDir !== 0) {
    const delta = beam.turnRate * dt * beam.turnDir;
    beam.angle += delta;
    if (
      (beam.turnDir > 0 && beam.angle >= beam.targetAngle) ||
      (beam.turnDir < 0 && beam.angle <= beam.targetAngle)
    ) {
      beam.angle = beam.targetAngle;
      beam.turnDir = 0;
    }
  }
  if (beam.elapsed >= beam.duration) {
    boss.beam = null;
  }
}

export function isPointInBossBeam(boss, x, y) {
  const beam = boss?.beam;
  if (!beam) {
    return false;
  }
  const dx = x - beam.originX;
  const dy = y - beam.originY;
  const cos = Math.cos(beam.angle);
  const sin = Math.sin(beam.angle);
  const along = dx * cos + dy * sin;
  if (along < 0 || along > beam.length) {
    return false;
  }
  const across = -dx * sin + dy * cos;
  const halfWidth = beam.width / 2;
  if (Math.abs(across) > halfWidth) {
    return false;
  }
  const halfSafe = (beam.safeWidth ?? BEAM_SAFE_WIDTH) / 2;
  for (const lane of beam.safeLanes || []) {
    const laneCenter = lane * halfWidth * 2;
    if (Math.abs(across - laneCenter) <= halfSafe) {
      return false;
    }
  }
  return true;
}

function drawBossBeam(ctx, boss, bossPalette) {
  const beam = boss?.beam;
  if (!beam) {
    return;
  }
  ctx.save();
  ctx.translate(beam.originX, beam.originY);
  ctx.rotate(beam.angle - Math.PI / 2);
  ctx.shadowColor = bossPalette.beam;
  ctx.shadowBlur = 40;
  ctx.fillStyle = bossPalette.beam;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'destination-out';
  const safeWidth = beam.safeWidth ?? BEAM_SAFE_WIDTH;
  for (const lane of beam.safeLanes || []) {
    const laneCenter = lane * beam.width;
    ctx.fillRect(laneCenter - safeWidth / 2, 0, safeWidth, beam.length);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 2;
  ctx.strokeStyle = bossPalette.beam;
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(-beam.width / 2, 0, beam.width, beam.length);
  ctx.globalAlpha = 1;
  if ((beam.safeLanes || []).length) {
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = bossPalette.phaseShiftTrim || '#ffffff';
    for (const lane of beam.safeLanes) {
      const laneCenter = lane * beam.width;
      ctx.strokeRect(laneCenter - safeWidth / 2, 0, safeWidth, beam.length);
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function updatePhase1Pattern(state, boss, dt, player, options = {}) {
  const { fireFactor = 1 } = options;
  const ps = boss.patternState;
  if (!ps.initialised) {
    ps.initialised = true;
    ps.fireCooldown = PHASE1_CADENCE_MS;
  }
  const cadenceScale = clamp(fireFactor, 0.1, 1);
  ps.fireCooldown -= dt * 1000 * cadenceScale;
  if (ps.fireCooldown <= 0) {
    ps.fireCooldown = PHASE1_CADENCE_MS + rand(-120, 160);
    const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
    const spread = 0.22;
    const speed = 220;
    for (let i = -1; i <= 1; i++) {
      const angle = aim + i * spread;
      pushBossBullet(state, boss.x + i * 20, boss.y + 34, speed, angle, 9);
    }
  }
}

function updatePhase2Pattern(state, boss, dt, player, options = {}) {
  const { fireFactor = 1, mercyActive = false } = options;
  const ps = boss.patternState;
  if (!ps.initialised) {
    ps.initialised = true;
    ps.scatterTimer = 1400;
    ps.ringTimer = PHASE2_RING_INTERVAL_MS;
    ps.waveTimer = 0;
    ps.waveRemaining = 0;
    ps.waveCount = 3;
    const downward = Math.PI / 2;
    ps.safeAngles = [downward - 0.4, downward, downward + 0.4].map((angle) => {
      let wrapped = angle % TAU;
      if (wrapped < 0) {
        wrapped += TAU;
      }
      return wrapped;
    });
  }
  const cadenceScale = clamp(fireFactor, 0.1, 1);
  ps.scatterTimer -= dt * 1000 * cadenceScale;
  if (ps.scatterTimer <= 0) {
    ps.scatterTimer = 1480 + rand(-200, 200);
    const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
    const offsets = [-0.18, 0, 0.18];
    const speedBase = 250;
    offsets.forEach((offset, index) => {
      const angle = aim + offset;
      const speed = speedBase + Math.abs(index - 1) * 18;
      pushBossBullet(state, boss.x + (index - 1) * 18, boss.y + 30, speed, angle, 8);
    });
  }
  if (ps.waveRemaining > 0) {
    ps.waveTimer -= dt * 1000;
    if (ps.waveTimer <= 0) {
      const waveIndex = ps.waveCount - ps.waveRemaining;
      const speed = 200 + waveIndex * 40;
      const gapWidth = mercyActive ? 0.55 : 0.36;
      const count = mercyActive ? 24 : 30;
      emitBossRing(state, boss, {
        count,
        speed,
        safeAngles: ps.safeAngles,
        gapWidth,
      });
      ps.waveRemaining -= 1;
      ps.waveTimer = ps.waveRemaining > 0 ? PHASE2_RING_WAVE_GAP_MS : 0;
    }
  } else {
    ps.ringTimer -= dt * 1000 * cadenceScale;
    if (ps.ringTimer <= 0) {
      ps.waveRemaining = ps.waveCount;
      ps.waveTimer = 0;
      ps.ringTimer = PHASE2_RING_INTERVAL_MS + rand(-320, 420);
      boss.specialCueTimer = Math.max(boss.specialCueTimer, 420);
    }
  }
}

function updatePhase3Pattern(state, boss, dt, player, viewH, options = {}) {
  const { fireFactor = 1, mercyActive = false } = options;
  const ps = boss.patternState;
  if (!ps.initialised) {
    ps.initialised = true;
    ps.volleyTimer = 560;
    ps.beamCooldown = 2400;
    ps.beamCharge = 0;
    ps.nextSweepDir = 1;
    ps.droneTimer = PHASE3_DRONE_INTERVAL_MS;
  }
  const cadenceScale = clamp(fireFactor, 0.1, 1);
  if (!boss.beam) {
    ps.volleyTimer -= dt * 1000 * cadenceScale;
    if (ps.volleyTimer <= 0) {
      ps.volleyTimer = 620 + rand(-120, 140);
      const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
      const offsets = [-0.22, -0.08, 0.08, 0.22];
      const speedBase = 310;
      offsets.forEach((offset, index) => {
        const angle = aim + offset;
        const speed = speedBase + Math.abs(index - 1.5) * 18;
        pushBossBullet(state, boss.x + (index - 1.5) * 22, boss.y + 26, speed, angle, 9);
      });
    }
  }

  ps.droneTimer -= dt * 1000 * cadenceScale;
  if (ps.droneTimer <= 0) {
    spawnBossMinions(state, boss, 1);
    ps.droneTimer = PHASE3_DRONE_INTERVAL_MS + rand(-600, 600);
  }

  if (ps.beamCharge > 0) {
    ps.beamCharge -= dt * 1000;
    if (ps.beamCharge <= 0) {
      const sweepDir = ps.nextSweepDir || 1;
      const halfRange = PHASE3_BEAM_SWEEP_RANGE / 2;
      const startAngle = (Math.PI / 2) + (sweepDir > 0 ? -halfRange : halfRange);
      const endAngle = (Math.PI / 2) + (sweepDir > 0 ? halfRange : -halfRange);
      const turnRate = PHASE3_BEAM_SWEEP_RANGE / (PHASE3_BEAM_DURATION_MS / 1000);
      createBossBeam(boss, {
        startAngle,
        endAngle,
        duration: PHASE3_BEAM_DURATION_MS,
        turnRate,
        length: viewH * BEAM_LENGTH_RATIO,
      });
      ps.nextSweepDir = -sweepDir;
      ps.beamCooldown = PHASE3_BEAM_DURATION_MS + 1400;
    }
  } else if (!boss.beam) {
    ps.beamCooldown -= dt * 1000 * cadenceScale;
    if (ps.beamCooldown <= 0) {
      ps.beamCharge = PHASE3_BEAM_PREP_MS;
      boss.specialCueTimer = Math.max(boss.specialCueTimer, PHASE3_BEAM_PREP_MS);
      boss.warningTimer = Math.max(boss.warningTimer, 900);
    }
  }

}

export function updateEnemies(state, dt, now, player) {
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const difficulty = getDifficulty(state.levelIndex);
  const spawnConfig = difficulty?.spawn || {};
  const straferSettings = spawnConfig.strafer || {};
  const droneSettings = spawnConfig.drone || {};
  const turretSettings = spawnConfig.turret || {};
  const straferCdMin = straferSettings.fireCdMin ?? straferSettings.fireCdMsMin ?? 600;
  const straferCdMax = straferSettings.fireCdMax ?? straferSettings.fireCdMsMax ?? 1100;
  const droneAccel = droneSettings.steerAccel ?? droneSettings.accel ?? 60;
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
        const bullet = getBullet();
        const bornAt = state.time * 1000;
        bullet.x = e.x;
        bullet.y = e.y + 10;
        bullet.vx = (player.x - e.x) * 0.0025;
        bullet.vy = 180;
        bullet.r = 6;
        bullet.bornAt = bornAt;
        bullet.updatedAt = bornAt;
        bullet.owner = 'enemy';
        state.enemyBullets.push(bullet);
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
        const bullet = getBullet();
        const bornAt = state.time * 1000;
        bullet.x = e.x;
        bullet.y = e.y;
        bullet.vx = Math.cos(angle) * (e.bulletSpeed ?? turretBulletSpeed);
        bullet.vy = Math.sin(angle) * (e.bulletSpeed ?? turretBulletSpeed);
        bullet.r = 6;
        bullet.bornAt = bornAt;
        bullet.updatedAt = bornAt;
        bullet.owner = 'enemy';
        state.enemyBullets.push(bullet);
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

export function spawnBoss(state, bossConfig = {}) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  state.enemies.length = 0;
  const difficulty = getDifficulty(state.levelIndex);
  const baseHp = bossConfig.hp ?? difficulty?.bossHp ?? DEFAULT_BOSS_HP;
  const rawThresholds = Array.isArray(bossConfig.phases)
    ? bossConfig.phases
    : bossConfig.phaseThresholds ?? BOSS_PHASE_THRESHOLDS;
  const thresholds = (rawThresholds ?? BOSS_PHASE_THRESHOLDS)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  const resolvedMax = bossConfig.maxPhase ?? Math.max(1, thresholds.length + 1);
  const boss = {
    type: 'boss',
    kind: bossConfig.kind ?? 'standard',
    x: viewW / 2,
    y: -160,
    vx: 0,
    vy: 160,
    r: 60,
    hp: baseHp,
    maxHp: baseHp,
    currentPhase: 1,
    phase: 1,
    maxPhase: Math.max(1, resolvedMax ?? MAX_BOSS_PHASE),
    phaseThresholds: thresholds,
    telegraphUntil: 0,
    telegraphIntensity: 0,
    patternState: {},
    sweepDir: 1,
    entering: true,
    introTimer: 2200,
    phaseFlashTimer: 0,
    specialCueTimer: 0,
    warningTimer: 0,
    glowPulse: 0,
    warningPulse: 0,
    rewardDropped: false,
    beam: null,
  };
  drainBullets(state.enemyBullets);
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
  const nowMs = now;

  if (boss.entering) {
    boss.y += boss.vy * dt;
    if (boss.y >= viewH * 0.25) {
      boss.y = viewH * 0.25;
      boss.vy = 0;
      boss.entering = false;
    }
  }

  boss.glowPulse = (boss.glowPulse + dt * 6.5) % TAU;
  boss.warningPulse = (boss.warningPulse + dt * 8.2) % TAU;
  boss.phaseFlashTimer = Math.max(0, boss.phaseFlashTimer - dt * 1000);
  boss.specialCueTimer = Math.max(0, boss.specialCueTimer - dt * 1000);
  boss.warningTimer = Math.max(0, boss.warningTimer - dt * 1000);
  boss.introTimer = Math.max(0, boss.introTimer - dt * 1000);
  const mercyActive = state.bossMercyUntil && nowMs < state.bossMercyUntil;
  const fireFactor = mercyActive ? 0.45 : 1;
  let telegraphing = false;
  if (boss.telegraphUntil) {
    const remaining = boss.telegraphUntil - nowMs;
    if (remaining > 0) {
      boss.telegraphIntensity = clamp(remaining / PHASE_TELEGRAPH_MS, 0, 1);
      telegraphing = true;
    } else {
      boss.telegraphUntil = 0;
      boss.telegraphIntensity = 0;
    }
  } else {
    boss.telegraphIntensity = 0;
  }

  const enterPhase = (targetPhase) => {
    const clamped = Math.min(targetPhase, boss.maxPhase || MAX_BOSS_PHASE);
    if (boss.currentPhase === clamped) {
      return;
    }
    boss.currentPhase = clamped;
    boss.phase = boss.currentPhase;
    boss.phaseFlashTimer = PHASE_TELEGRAPH_MS;
    boss.specialCueTimer = PHASE_TELEGRAPH_MS;
    boss.telegraphUntil = nowMs + PHASE_TELEGRAPH_MS;
    boss.telegraphIntensity = 1;
    boss.patternState = {};
    boss.beam = null;
    addParticle(state, boss.x, boss.y, particles.bossHit, 48, 4.4, 900);
    playPow();
    if (boss.currentPhase >= 3) {
      boss.warningTimer = Math.max(boss.warningTimer, 1200);
    }
  };

  const ratio = boss.maxHp > 0 ? Math.max(0, boss.hp) / boss.maxHp : 1;
  let targetPhase = boss.currentPhase;
  const thresholds = boss.phaseThresholds || [];
  while (targetPhase < (boss.maxPhase || MAX_BOSS_PHASE)) {
    const threshold = thresholds[targetPhase - 1];
    if (threshold === undefined) {
      break;
    }
    if (ratio < threshold) {
      targetPhase += 1;
    } else {
      break;
    }
  }
  if (targetPhase !== boss.currentPhase) {
    enterPhase(targetPhase);
  }

  const leftBound = 140;
  const rightBound = viewW - 140;
  const sweepSpeed = boss.currentPhase === 1 ? 120 : boss.currentPhase === 2 ? 180 : 220;
  boss.x += boss.sweepDir * sweepSpeed * dt;
  if (boss.x < leftBound) {
    boss.x = leftBound;
    boss.sweepDir = 1;
  } else if (boss.x > rightBound) {
    boss.x = rightBound;
    boss.sweepDir = -1;
  }

  if (boss.currentPhase === 1) {
    boss.y = clamp(
      boss.y + Math.sin(nowMs * 0.0015) * 12 * dt * 60,
      viewH * 0.22,
      viewH * 0.28,
    );
  } else if (boss.currentPhase === 2) {
    boss.y = viewH * 0.22 + Math.sin(nowMs * 0.0025) * 36;
  } else {
    boss.y = viewH * 0.2 + Math.sin(nowMs * 0.0031) * 44 + Math.sin(boss.glowPulse) * 6;
  }

  updateBossBeam(boss, dt, viewH);
  if (boss.beam) {
    boss.beam.safeWidth = mercyActive ? BEAM_SAFE_WIDTH * 1.4 : BEAM_SAFE_WIDTH;
  }

  if (!telegraphing && !boss.entering) {
    if (boss.currentPhase === 1) {
      updatePhase1Pattern(state, boss, dt, player, { fireFactor });
    } else if (boss.currentPhase === 2) {
      updatePhase2Pattern(state, boss, dt, player, { fireFactor, mercyActive });
    } else {
      updatePhase3Pattern(state, boss, dt, player, viewH, { fireFactor, mercyActive });
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
  if (boss.beam) {
    drawBossBeam(ctx, boss, bossPalette);
  }
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const phase = boss.currentPhase ?? boss.phase ?? 1;
  const isPhase2 = phase === 2;
  const isPhase3 = phase >= 3;
  const telegraphIntensity = clamp(boss.telegraphIntensity ?? 0, 0, 1);
  const telegraphStrength = Math.max(
    boss.phaseFlashTimer / PHASE_TELEGRAPH_MS,
    boss.specialCueTimer / PHASE_TELEGRAPH_MS,
    telegraphIntensity,
  );
  const telegraphActive = telegraphStrength > 0.01;
  const telegraphPulse = 0.65 + 0.35 * Math.sin((boss.glowPulse || 0) * 2);
  if (telegraphActive) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = bossPalette.phaseShiftGlow;
    ctx.globalAlpha = clamp(0.35 + telegraphStrength * 0.4, 0, 0.85);
    ctx.beginPath();
    ctx.arc(0, 0, 110 + telegraphPulse * 16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
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
  const ratio = boss.maxHp > 0 ? Math.max(0, boss.hp) / boss.maxHp : 0;
  const thresholds = [...(boss.phaseThresholds || [])];
  while (thresholds.length < 2) {
    const fallback = thresholds.length === 0 ? 2 / 3 : thresholds[thresholds.length - 1] * 0.5;
    thresholds.push(clamp(fallback, 0, 1));
  }
  const bounds = [1];
  let lastBound = 1;
  for (let i = 0; i < 2; i++) {
    const next = clamp(thresholds[i], 0, lastBound);
    bounds.push(next);
    lastBound = next;
  }
  bounds.push(0);
  const phaseColors = [
    bossPalette.strokePhase1 || bossPalette.healthFill,
    bossPalette.strokePhase2 || bossPalette.healthFill,
    bossPalette.strokePhase3 || bossPalette.healthFill,
  ];
  ctx.save();
  ctx.fillStyle = bossPalette.healthBackground;
  ctx.fillRect(x, y, width, 12);
  ctx.shadowColor = bossPalette.healthShadow;
  ctx.shadowBlur = 18;
  let drawX = x;
  for (let i = 0; i < 3; i++) {
    const upper = bounds[i];
    const lower = bounds[i + 1];
    const span = Math.max(0, upper - lower);
    const segWidth = width * span;
    const color = phaseColors[i] || bossPalette.healthFill;
    const fillAmount = span > 0 ? clamp((ratio - lower) / span, 0, 1) : 0;
    if (segWidth > 0) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.fillRect(drawX, y, segWidth, 12);
      ctx.globalAlpha = 1;
      if (fillAmount > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(drawX, y, segWidth * fillAmount, 12);
      }
      if (i < 2) {
        ctx.fillStyle = bossPalette.healthBackground;
        ctx.fillRect(drawX + segWidth - 1, y - 1, 2, 14);
      }
    }
    drawX += segWidth;
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = bossPalette.healthStroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, width + 2, 14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  let dividerX = x;
  for (let i = 0; i < 2; i++) {
    dividerX += width * Math.max(0, bounds[i] - bounds[i + 1]);
    ctx.moveTo(dividerX, y - 1);
    ctx.lineTo(dividerX, y + 13);
  }
  ctx.stroke();
  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = bossPalette.healthText;
  const phaseLabel = clamp(boss.currentPhase ?? 1, 1, boss.maxPhase ?? MAX_BOSS_PHASE);
  ctx.fillText(
    `Boss Integrity ${Math.ceil(ratio * 100)}% · Phase ${phaseLabel}`,
    viewW / 2,
    y - 6,
  );
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
