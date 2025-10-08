/**
 * enemies.js — enemy spawning, behaviour updates, and rendering for Retro Space Run.
 */
import { rand, TAU, drawGlowCircle, addParticle, clamp } from './utils.js';
import { getViewSize } from './ui.js';
import { resolvePaletteSection, DEFAULT_THEME_PALETTE } from './themes.js';
import { playPow } from './audio.js';
import { getBullet, drainBullets } from './bullets.js';

const DEFAULT_BOSS_HP = 540;
const ASSIST_DENSITY = 0.7;
const BOSS_PHASE_THRESHOLDS = [0.7, 0.4];
const MAX_BOSS_PHASE = 3;
const PHASE_TELEGRAPH_MS = 500;
const PHASE1_CADENCE_MS = 1500;
const PHASE2_RING_INTERVAL_MS = 3400;
const PHASE2_RING_WAVE_GAP_MS = 260;
const PHASE2_RING_WAVE_COUNT = 3;
const PHASE2_RING_GAP_WIDTH = 0.42;
const PHASE3_BEAM_PREP_MS = 900;
const PHASE3_BEAM_DURATION_MS = 2600;
const PHASE3_BEAM_SWEEP_RANGE = 1.05; // radians swept per beam
const PHASE3_DRONE_INTERVAL_MS = 5600;
const BEAM_LENGTH_RATIO = 0.85;
const BEAM_WIDTH = 220;
const BEAM_SAFE_WIDTH = 80;
const BEAM_SAFE_LANES = [-0.45, 0.45];
const MID_BOSS_BURST_CADENCE_MS = 2600;
const MID_BOSS_SPREAD_CADENCE_MS = 1200;
const MID_BOSS_BURST_COUNT = 14;
const MID_BOSS_BURST_SPEED = 190;
const MID_BOSS_SPREAD = 0.18;
const MID_BOSS_SPREAD_SPEED = 240;

const SPLITTER_DEFAULT_RADIUS = 18;
const SPLITTER_DEFAULT_HP = 5;
const SPLITTER_ACCEL = 42;
const SPLITTER_CHILDREN_RANGE = [2, 3];
const SPLITTER_CHILD_ACCEL = 120;

const SHIELD_DRONE_DEFAULT_RADIUS = 15;
const SHIELD_DRONE_DEFAULT_HP = 4;
const SHIELD_DRONE_COOLDOWN_MS = 4200;
const SHIELD_DRONE_DURATION_MS = 2600;
const SHIELD_DRONE_RANGE = 180;
const SHIELD_DRONE_TARGETS = 2;

const randInt = (min, max) => Math.floor(rand(min, max + 1));

function getDifficultyFactor(state, key, fallback = 1) {
  if (!state || !state.difficulty) {
    return fallback;
  }
  const value = state.difficulty[key];
  return Number.isFinite(value) ? value : fallback;
}

function enemySquallSpread(state, scale = 1) {
  const squall = state.weather?.squall;
  const spread = squall?.active ? squall.enemySpread ?? 0 : 0;
  if (!spread) {
    return 0;
  }
  const factor = Number.isFinite(scale) ? Math.max(0, scale) : 1;
  const multiplier = Number.isFinite(squall.enemySpreadMultiplier)
    ? Math.max(1, squall.enemySpreadMultiplier)
    : 1.3;
  return rand(-spread * factor * multiplier, spread * factor * multiplier);
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

function enemySpeedMod(state) {
  const mod = state?.themeFx?.enemySpeedMultiplier;
  if (!Number.isFinite(mod)) {
    return 1;
  }
  return Math.max(0.2, Math.min(3, mod));
}

function spawnAsteroids(state, count, params) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const asteroidMax = Math.max(viewW - 40, 40);
  const {
    vxMin: vxMinRaw = -50,
    vxMax: vxMaxRaw = 50,
    vyMin: vyMinRaw = 80,
    vyMax: vyMaxRaw = 160,
    radiusMin = 12,
    radiusMax = 24,
    spawnYOffsetMin = 0,
    spawnYOffsetMax = 200,
    hp = 2,
  } = params;
  const speedMod = enemySpeedMod(state);
  const vxMin = vxMinRaw * speedMod;
  const vxMax = vxMaxRaw * speedMod;
  const vyMin = vyMinRaw * speedMod;
  const vyMax = vyMaxRaw * speedMod;
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
    speedMin: speedMinRaw = 120,
    speedMax: speedMaxRaw = 180,
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
  const speedMod = enemySpeedMod(state);
  const speedMin = speedMinRaw * speedMod;
  const speedMax = speedMaxRaw * speedMod;
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
      cdMin: fireCdMin,
      cdMax: fireCdMax,
    });
  }
}

function spawnDrones(state, count, params) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const droneMax = Math.max(viewW - 40, 40);
  const {
    vyMin: vyMinRaw = 60,
    vyMax: vyMaxRaw = 100,
    accel: accelRaw,
    steerAccel,
    hp = 2,
    startY = -40,
  } = params;
  const speedMod = enemySpeedMod(state);
  const vyMin = vyMinRaw * speedMod;
  const vyMax = vyMaxRaw * speedMod;
  const accel = (accelRaw ?? steerAccel ?? 60) * speedMod;
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
    vyMin: vyMinRaw = 70,
    vyMax: vyMaxRaw = 110,
    fireCdMin: fireCdMinRaw,
    fireCdMax: fireCdMaxRaw,
    fireCdMsMin,
    fireCdMsMax,
    bulletSpeed: bulletSpeedRaw = 220,
    hp = 4,
    radius = 16,
  } = params;
  const fireCdMin = fireCdMinRaw ?? fireCdMsMin ?? 600;
  const fireCdMax = fireCdMaxRaw ?? fireCdMsMax ?? 1200;
  const speedMod = enemySpeedMod(state);
  const vyMin = vyMinRaw * speedMod;
  const vyMax = vyMaxRaw * speedMod;
  const bulletSpeed = bulletSpeedRaw * speedMod;
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
      cdMin: fireCdMin,
      cdMax: fireCdMax,
      bulletSpeed,
    });
  }
}

function spawnSplitters(state, count, params) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const spawnMax = Math.max(viewW - 60, 60);
  const {
    vyMin: vyMinRaw = 50,
    vyMax: vyMaxRaw = 90,
    accel: accelRaw = SPLITTER_ACCEL,
    hp = SPLITTER_DEFAULT_HP,
    radius = SPLITTER_DEFAULT_RADIUS,
    childRange = SPLITTER_CHILDREN_RANGE,
    miniAccel = SPLITTER_CHILD_ACCEL,
    startOffset = [0, 140],
    startOffsetMin,
    startOffsetMax,
    childRangeMin,
    childRangeMax,
  } = params;
  const speedMod = enemySpeedMod(state);
  const vyMin = vyMinRaw * speedMod;
  const vyMax = vyMaxRaw * speedMod;
  const accel = accelRaw * speedMod;
  const offsetMin = Number.isFinite(startOffsetMin)
    ? startOffsetMin
    : Array.isArray(startOffset)
      ? startOffset[0]
      : 0;
  const offsetMax = Number.isFinite(startOffsetMax)
    ? startOffsetMax
    : Array.isArray(startOffset)
      ? startOffset[1]
      : 120;
  const [childMinRaw, childMaxRaw] = Array.isArray(childRange)
    ? childRange
    : [childRangeMin ?? SPLITTER_CHILDREN_RANGE[0], childRangeMax ?? SPLITTER_CHILDREN_RANGE[1]];
  const childMin = Math.max(1, Math.floor(childMinRaw ?? SPLITTER_CHILDREN_RANGE[0]));
  const childMax = Math.max(childMin, Math.floor(childMaxRaw ?? SPLITTER_CHILDREN_RANGE[1]));
  for (let i = 0; i < count; i++) {
    state.enemies.push({
      type: 'splitter',
      x: rand(60, spawnMax),
      y: -40 - rand(offsetMin, offsetMax),
      vx: rand(-20, 20),
      vy: rand(vyMin, vyMax),
      r: radius,
      hp,
      accel,
      lobes: Math.max(5, Math.round(params.lobes ?? randInt(5, 7))),
      wobble: rand(0.85, 1.35),
      phase: rand(0, TAU),
      childRange: [childMin, childMax],
      miniAccel: miniAccel,
    });
  }
}

function spawnShieldDrones(state, count, params) {
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const spawnMax = Math.max(viewW - 60, 60);
  const {
    vyMin: vyMinRaw = 45,
    vyMax: vyMaxRaw = 75,
    hp = SHIELD_DRONE_DEFAULT_HP,
    radius = SHIELD_DRONE_DEFAULT_RADIUS,
    cooldown = SHIELD_DRONE_COOLDOWN_MS,
    duration = SHIELD_DRONE_DURATION_MS,
    range = SHIELD_DRONE_RANGE,
    targets = SHIELD_DRONE_TARGETS,
    startOffset = [40, 160],
    startOffsetMin,
    startOffsetMax,
  } = params;
  const speedMod = enemySpeedMod(state);
  const vyMin = vyMinRaw * speedMod;
  const vyMax = vyMaxRaw * speedMod;
  const offsetMin = Number.isFinite(startOffsetMin)
    ? startOffsetMin
    : Array.isArray(startOffset)
      ? startOffset[0]
      : 0;
  const offsetMax = Number.isFinite(startOffsetMax)
    ? startOffsetMax
    : Array.isArray(startOffset)
      ? startOffset[1]
      : 160;
  for (let i = 0; i < count; i++) {
    state.enemies.push({
      type: 'shield-drone',
      x: rand(60, spawnMax),
      y: -50 - rand(offsetMin, offsetMax),
      vx: rand(-18, 18),
      vy: rand(vyMin, vyMax),
      r: radius,
      hp,
      cooldown: rand(cooldown * 0.6, cooldown * 1.1),
      cooldownBase: cooldown,
      shieldDuration: duration,
      shieldRange: range,
      shieldTargets: Math.max(1, Math.round(targets)),
      wobblePhase: rand(0, TAU),
      wobbleRadius: rand(18, 32),
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
  const densityFactor = getDifficultyFactor(state, 'density', 1);
  if (densityFactor !== 1) {
    resolvedCount *= densityFactor;
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
  } else if (type === 'splitter') {
    spawnSplitters(state, resolvedCount, config);
  } else if (type === 'shield-drone') {
    spawnShieldDrones(state, resolvedCount, config);
  }
}

function applyShieldEmitter(state, emitter) {
  if (!state || !emitter) {
    return;
  }
  const range = Number.isFinite(emitter.shieldRange) ? emitter.shieldRange : SHIELD_DRONE_RANGE;
  const duration = Number.isFinite(emitter.shieldDuration) ? emitter.shieldDuration : SHIELD_DRONE_DURATION_MS;
  const maxTargets = Math.max(1, Math.round(emitter.shieldTargets ?? SHIELD_DRONE_TARGETS));
  if (range <= 0 || duration <= 0 || maxTargets <= 0) {
    return;
  }
  const rangeSq = range * range;
  const particlesPalette = resolvePaletteSection(state.theme ?? DEFAULT_THEME_PALETTE, 'particles');
  const shieldColour = particlesPalette.shieldHit || particlesPalette.enemyHitDefault || '#9df5ff';
  let applied = 0;
  for (const target of state.enemies) {
    if (target === emitter || target.type === 'shield-drone' || target.hp <= 0) {
      continue;
    }
    const dx = target.x - emitter.x;
    const dy = target.y - emitter.y;
    if (dx * dx + dy * dy > rangeSq) {
      continue;
    }
    if (target.shieldTimer > 0 && target.shieldEmitter !== emitter) {
      continue;
    }
    target.shieldTimer = duration;
    target.shieldDuration = duration;
    target.shieldEmitter = emitter;
    target.shieldStrength = 1;
    target.shieldPhase = rand(0, TAU);
    addParticle(state, target.x, target.y, shieldColour, 12, 3, 260);
    applied += 1;
    if (applied >= maxTargets) {
      break;
    }
  }
}

function spawnSplitterChildren(state, enemy) {
  if (!state || !enemy) {
    return;
  }
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const spawnMinX = 40;
  const spawnMaxX = Math.max(spawnMinX, viewW - 40);
  const spawnMinY = -80;
  const spawnMaxY = viewH + 60;
  const [childMinRaw, childMaxRaw] = Array.isArray(enemy.childRange)
    ? enemy.childRange
    : SPLITTER_CHILDREN_RANGE;
  const childMin = Math.max(1, Math.floor(childMinRaw ?? SPLITTER_CHILDREN_RANGE[0]));
  const childMax = Math.max(childMin, Math.floor(childMaxRaw ?? SPLITTER_CHILDREN_RANGE[1]));
  const count = randInt(childMin, childMax);
  const accel = Number.isFinite(enemy.miniAccel) ? enemy.miniAccel : SPLITTER_CHILD_ACCEL;
  const baseRadius = Math.max(6, Math.round((enemy.r ?? SPLITTER_DEFAULT_RADIUS) * 0.55));
  for (let i = 0; i < count; i++) {
    const spawnX = clamp(enemy.x + rand(-8, 8), spawnMinX, spawnMaxX);
    const spawnY = clamp(enemy.y + rand(-8, 8), spawnMinY, spawnMaxY);
    state.enemies.push({
      type: 'drone',
      x: spawnX,
      y: spawnY,
      vx: rand(-accel * 0.6, accel * 0.6),
      vy: rand(accel * 0.4, accel * 0.9),
      r: baseRadius,
      hp: 1,
      accel,
      mini: true,
    });
  }
}

function clearEmitterShields(state, emitter) {
  if (!state || !emitter) {
    return;
  }
  for (const target of state.enemies) {
    if (target.shieldEmitter === emitter) {
      target.shieldEmitter = null;
      target.shieldTimer = 0;
      target.shieldStrength = 0;
    }
  }
}

export function handleEnemyDestroyed(state, enemy) {
  if (!state || !enemy) {
    return;
  }
  if (enemy.type === 'splitter') {
    spawnSplitterChildren(state, enemy);
  }
  if (enemy.type === 'shield-drone') {
    clearEmitterShields(state, enemy);
  }
}

function pushBossBullet(state, x, y, speed, angle, radius = 8) {
  const bornAt = state.time * 1000;
  const bullet = getBullet();
  bullet.x = x;
  bullet.y = y;
  const angleOffset = angle + enemySquallSpread(state, 0.006);
  const finalSpeed = speed * getDifficultyFactor(state, 'speed', 1);
  bullet.vx = Math.cos(angleOffset) * finalSpeed;
  bullet.vy = Math.sin(angleOffset) * finalSpeed;
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
    count = 32,
    speed = 220,
    safeAngles = [],
    gapWidth = PHASE2_RING_GAP_WIDTH,
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
    const laneTrim = bossPalette.phaseShiftTrim ?? bossPalette.trim ?? DEFAULT_THEME_PALETTE.boss.trim;
    ctx.strokeStyle = laneTrim;
    for (const lane of beam.safeLanes) {
      const laneCenter = lane * beam.width;
      ctx.strokeRect(laneCenter - safeWidth / 2, 0, safeWidth, beam.length);
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function updateMidBoss(state, boss, dt, nowMs, player, viewW, viewH, options = {}) {
  const { fireFactor = 1 } = options;
  const ps = boss.patternState;
  if (!ps.midInitialised) {
    ps.midInitialised = true;
    ps.burstTimer = MID_BOSS_BURST_CADENCE_MS * 0.6;
    ps.spreadTimer = MID_BOSS_SPREAD_CADENCE_MS * 0.75;
    ps.rotation = Math.random() * TAU;
  }
  if (boss.entering) {
    return;
  }
  const cadenceScale = clamp(fireFactor, 0, 1);
  const roamSpeed = 150;
  const leftBound = 120;
  const rightBound = Math.max(leftBound + 40, viewW - 120);
  boss.x += boss.sweepDir * roamSpeed * dt;
  if (boss.x < leftBound) {
    boss.x = leftBound;
    boss.sweepDir = 1;
  } else if (boss.x > rightBound) {
    boss.x = rightBound;
    boss.sweepDir = -1;
  }
  const baseY = viewH * 0.24;
  const floatRange = viewH * 0.04;
  const driftPhase = (ps.rotation || 0) * 0.35;
  boss.y = clamp(baseY + Math.sin(nowMs * 0.0021 + driftPhase) * floatRange, viewH * 0.18, viewH * 0.32);
  if (cadenceScale <= 0) {
    return;
  }
  ps.burstTimer -= dt * 1000 * cadenceScale;
  if (ps.burstTimer <= 0) {
    ps.burstTimer = MID_BOSS_BURST_CADENCE_MS;
    ps.rotation = (ps.rotation ?? 0) + Math.PI / 9;
    for (let i = 0; i < MID_BOSS_BURST_COUNT; i++) {
      const angle = (TAU / MID_BOSS_BURST_COUNT) * i + (ps.rotation ?? 0);
      pushBossBullet(state, boss.x, boss.y + 12, MID_BOSS_BURST_SPEED, angle, 8);
    }
    playPow();
  }
  ps.spreadTimer -= dt * 1000 * cadenceScale;
  if (ps.spreadTimer <= 0) {
    ps.spreadTimer = MID_BOSS_SPREAD_CADENCE_MS;
    const targetX = player?.x ?? viewW / 2;
    const targetY = player?.y ?? viewH / 2;
    const aim = Math.atan2(targetY - boss.y, targetX - boss.x);
    const offsets = [-MID_BOSS_SPREAD, 0, MID_BOSS_SPREAD];
    offsets.forEach((offset, idx) => {
      const angle = aim + offset;
      const lateral = (idx - 1) * 18;
      pushBossBullet(state, boss.x + lateral, boss.y + 28, MID_BOSS_SPREAD_SPEED, angle, 8);
    });
  }
}

function updatePhase1Pattern(state, boss, dt, player, options = {}) {
  const { fireFactor = 1 } = options;
  const ps = boss.patternState;
  if (!ps.initialised) {
    ps.initialised = true;
    ps.fireCooldown = PHASE1_CADENCE_MS;
  }
  const cadenceScale = clamp(fireFactor, 0, 1);
  if (cadenceScale <= 0) {
    return;
  }
  ps.fireCooldown -= dt * 1000 * cadenceScale;
  if (ps.fireCooldown <= 0) {
    ps.fireCooldown = PHASE1_CADENCE_MS;
    const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
    const spread = 0.24;
    const speed = 215;
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
    ps.nextRingTimer = PHASE2_RING_INTERVAL_MS * 0.6;
    ps.waveTimer = 0;
    ps.waveRemaining = 0;
    ps.wavesPerPattern = PHASE2_RING_WAVE_COUNT;
    const downward = Math.PI / 2;
    const laneOffset = 0.38;
    ps.safeAngles = [downward - laneOffset, downward, downward + laneOffset].map((angle) => {
      let wrapped = angle % TAU;
      if (wrapped < 0) {
        wrapped += TAU;
      }
      return wrapped;
    });
  }
  const cadenceScale = clamp(fireFactor, 0, 1);
  if (cadenceScale <= 0) {
    return;
  }
  if (ps.waveRemaining > 0) {
    ps.waveTimer -= dt * 1000;
    if (ps.waveTimer <= 0) {
      const waveIndex = ps.wavesPerPattern - ps.waveRemaining;
      const speed = 210 + waveIndex * 45;
      const count = mercyActive ? 26 : 32;
      const gapWidth = mercyActive ? PHASE2_RING_GAP_WIDTH * 1.25 : PHASE2_RING_GAP_WIDTH;
      emitBossRing(state, boss, {
        count,
        speed,
        safeAngles: ps.safeAngles,
        gapWidth,
      });
      ps.waveRemaining -= 1;
      ps.waveTimer = ps.waveRemaining > 0 ? PHASE2_RING_WAVE_GAP_MS : 0;
    }
    return;
  }

  ps.nextRingTimer -= dt * 1000 * cadenceScale;
  if (ps.nextRingTimer <= 0) {
    ps.waveRemaining = ps.wavesPerPattern;
    ps.waveTimer = PHASE2_RING_WAVE_GAP_MS;
    ps.nextRingTimer = PHASE2_RING_INTERVAL_MS;
    boss.specialCueTimer = Math.max(boss.specialCueTimer, PHASE_TELEGRAPH_MS);
    boss.telegraphPhase = boss.currentPhase || 1;
  }
}

function updatePhase3Pattern(state, boss, dt, player, viewH, options = {}) {
  const { fireFactor = 1 } = options;
  const ps = boss.patternState;
  if (!ps.initialised) {
    ps.initialised = true;
    ps.beamCooldown = PHASE3_BEAM_DURATION_MS + 1400;
    ps.beamCharge = 0;
    ps.nextSweepDir = 1;
    ps.droneTimer = PHASE3_DRONE_INTERVAL_MS;
  }
  const cadenceScale = clamp(fireFactor, 0, 1);
  if (cadenceScale <= 0) {
    return;
  }

  ps.droneTimer -= dt * 1000 * cadenceScale;
  if (ps.droneTimer <= 0) {
    spawnBossMinions(state, boss, 1);
    ps.droneTimer = PHASE3_DRONE_INTERVAL_MS;
  }

  if (ps.beamCharge > 0) {
    ps.beamCharge -= dt * 1000 * cadenceScale;
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
      boss.telegraphPhase = boss.currentPhase || 1;
    }
  }

}

export function updateEnemies(state, dt, now, player) {
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const defaultStraferCdMin = 600;
  const defaultStraferCdMax = 1100;
  const defaultDroneAccel = 60;
  const defaultTurretCdMin = 600;
  const defaultTurretCdMax = 1200;
  const defaultTurretBulletSpeed = 220;
  const speedFactor = getDifficultyFactor(state, 'speed', 1);
  const themeSpeed = enemySpeedMod(state);
  const dtMs = Math.max(0, dt * 1000);
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (Number.isFinite(e.shieldTimer) && e.shieldTimer > 0) {
      if (!Number.isFinite(e.shieldPhase)) {
        e.shieldPhase = rand(0, TAU);
      }
      e.shieldTimer = Math.max(0, e.shieldTimer - dtMs);
      if (e.shieldTimer <= 0) {
        e.shieldEmitter = null;
        e.shieldStrength = 0;
        e.shieldTimer = 0;
      } else {
        e.shieldPhase += dt * 3.2;
      }
    }
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
        const cdMin = Number.isFinite(e.cdMin) ? e.cdMin : defaultStraferCdMin;
        const cdMax = Number.isFinite(e.cdMax) ? e.cdMax : defaultStraferCdMax;
        e.cd = rand(cdMin, cdMax);
        const bullet = getBullet();
        const bornAt = state.time * 1000;
        bullet.x = e.x;
        bullet.y = e.y + 10;
        const baseVx = (player.x - e.x) * 0.0025 + enemySquallSpread(state, 0.12);
        bullet.vx = baseVx * speedFactor * themeSpeed;
        bullet.vy = 180 * speedFactor * themeSpeed;
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
      const accel = Number.isFinite(e.accel) ? e.accel : defaultDroneAccel;
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
        const cdMin = Number.isFinite(e.cdMin) ? e.cdMin : defaultTurretCdMin;
        const cdMax = Number.isFinite(e.cdMax) ? e.cdMax : defaultTurretCdMax;
        e.cd = rand(cdMin, cdMax);
        const angle = Math.atan2(player.y - e.y, player.x - e.x) + enemySquallSpread(state, 0.005);
        const bullet = getBullet();
        const bornAt = state.time * 1000;
        bullet.x = e.x;
        bullet.y = e.y;
        const projectileSpeed =
          (Number.isFinite(e.bulletSpeed) ? e.bulletSpeed : defaultTurretBulletSpeed) * speedFactor * themeSpeed;
        bullet.vx = Math.cos(angle) * projectileSpeed;
        bullet.vy = Math.sin(angle) * projectileSpeed;
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
    } else if (e.type === 'splitter') {
      const accel = Number.isFinite(e.accel) ? e.accel : SPLITTER_ACCEL;
      e.phase = (e.phase ?? 0) + dt * (e.wobble ?? 1.1);
      const wobbleForce = Math.sin(now * 0.002 + e.phase) * accel * 0.25;
      const dx = player.x - e.x;
      const steer = clamp(dx * 0.02, -accel, accel);
      e.vx += (wobbleForce + steer) * dt;
      e.vx = clamp(e.vx, -140, 140);
      e.vy += Math.sin(now * 0.003 + e.phase * 0.6) * accel * 0.12 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 50) {
        e.x = 50;
        e.vx = Math.abs(e.vx || 40) * 0.7;
      } else if (e.x > viewW - 50) {
        e.x = viewW - 50;
        e.vx = -Math.abs(e.vx || 40) * 0.7;
      }
    } else if (e.type === 'shield-drone') {
      e.wobblePhase = (e.wobblePhase ?? 0) + dt * 2.8;
      const wobbleRadius = Number.isFinite(e.wobbleRadius) ? e.wobbleRadius : 24;
      e.x += Math.sin(e.wobblePhase) * wobbleRadius * dt;
      e.y += e.vy * dt;
      e.vx *= 0.96;
      const baseCooldown = Number.isFinite(e.cooldownBase) ? e.cooldownBase : SHIELD_DRONE_COOLDOWN_MS;
      e.cooldown = (e.cooldown ?? baseCooldown) - dtMs;
      if (e.cooldown <= 0) {
        e.cooldown = baseCooldown;
        applyShieldEmitter(state, e);
      }
      if (e.x < 60) {
        e.x = 60;
        e.wobblePhase += Math.PI / 2;
      } else if (e.x > viewW - 60) {
        e.x = viewW - 60;
        e.wobblePhase += Math.PI / 2;
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
  const baseHp = bossConfig.hp ?? DEFAULT_BOSS_HP;
  const resolvedHp = Math.max(1, Math.round(baseHp * getDifficultyFactor(state, 'hp', 1)));
  const rawThresholds = Array.isArray(bossConfig.phases)
    ? bossConfig.phases
    : bossConfig.phaseThresholds ?? BOSS_PHASE_THRESHOLDS;
  const thresholds = (rawThresholds ?? BOSS_PHASE_THRESHOLDS)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  const resolvedMax = bossConfig.maxPhase ?? Math.max(1, thresholds.length + 1);
  const role = bossConfig.role ?? 'final';
  const variant = bossConfig.variant ?? role;
  const introDuration = Number.isFinite(bossConfig.introDuration)
    ? Math.max(0, bossConfig.introDuration)
    : 2200;
  const rawMessage = typeof bossConfig.introMessage === 'string' ? bossConfig.introMessage.trim() : '';
  const introMessage = rawMessage.length ? rawMessage : 'WARNING — CORE GUARDIAN';
  const introColour = bossConfig.introColour ?? null;
  const introGlow = bossConfig.introGlow ?? null;
  const bannerColour = bossConfig.bannerColour ?? null;
  const healthLabel = bossConfig.healthLabel ?? null;
  const warningTimer = Math.max(0, bossConfig.warningTimer ?? 0);
  const boss = {
    type: 'boss',
    kind: bossConfig.kind ?? 'standard',
    x: viewW / 2,
    y: -160,
    vx: 0,
    vy: 160,
    r: 60,
    hp: resolvedHp,
    maxHp: resolvedHp,
    currentPhase: 1,
    phase: 1,
    maxPhase: Math.max(1, resolvedMax ?? MAX_BOSS_PHASE),
    phaseThresholds: thresholds,
    telegraphUntil: 0,
    telegraphIntensity: 0,
    telegraphPhase: 1,
    patternState: {},
    sweepDir: 1,
    entering: true,
    introTimer: introDuration,
    introDuration,
    introMessage,
    introColour,
    introGlow,
    bannerColour,
    healthLabel,
    phaseFlashTimer: 0,
    specialCueTimer: 0,
    warningTimer,
    glowPulse: 0,
    warningPulse: 0,
    rewardDropped: false,
    beam: null,
    role,
    variant,
  };
  drainBullets(state.enemyBullets);
  state.boss = boss;
  state.bossType = role;
  return boss;
}

export function spawnMidBoss(state, bossConfig = {}) {
  const config = {
    ...bossConfig,
    role: 'mid',
    variant: 'mid',
    phaseThresholds: [],
    phases: [],
    maxPhase: 1,
    introDuration: bossConfig?.introDuration ?? 1800,
  };
  if (!Number.isFinite(config.hp)) {
    config.hp = 240;
  }
  if (!config.introMessage) {
    config.introMessage = 'INTRUDER ALERT';
  }
  if (!config.introColour) {
    config.introColour = '#ff5a6e';
  }
  if (!config.bannerColour) {
    config.bannerColour = 'rgba(255, 245, 245, 0.88)';
  }
  if (!config.healthLabel) {
    config.healthLabel = 'Intruder Integrity';
  }
  const boss = spawnBoss(state, config);
  boss.maxPhase = 1;
  boss.phaseThresholds = [];
  boss.currentPhase = 1;
  boss.phase = 1;
  boss.telegraphPhase = 1;
  boss.patternState = {};
  boss.warningTimer = Math.max(boss.warningTimer, 1200);
  boss.sweepDir = Math.random() < 0.5 ? -1 : 1;
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
  const fireFactor = mercyActive ? 0 : 1;
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
  if (!telegraphing) {
    boss.telegraphPhase = boss.currentPhase || 1;
  }

  if (boss.role === 'mid' || boss.variant === 'mid') {
    boss.telegraphPhase = 1;
    updateMidBoss(state, boss, dt, nowMs, player, viewW, viewH, { fireFactor });
    return;
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
    boss.telegraphPhase = clamped;
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
  const { w, h } = getViewSize();
  const bossPalette = resolvePaletteSection(palette, 'boss');
  if (boss.warningTimer > 0) {
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
  if (boss.introTimer > 0 && (boss.role === 'mid' || boss.variant === 'mid')) {
    const introDuration = Math.max(1, boss.introDuration ?? 1800);
    const remaining = clamp(boss.introTimer / introDuration, 0, 1);
    const pulse = 0.4 + 0.6 * Math.sin((1 - remaining) * Math.PI);
    const bandHeight = 68;
    const centerY = h * 0.18;
    ctx.save();
    ctx.fillStyle = boss.bannerColour ?? 'rgba(255, 245, 245, 0.88)';
    ctx.globalAlpha = Math.max(0.2, Math.min(0.95, pulse));
    ctx.fillRect(0, centerY - bandHeight / 2, w, bandHeight);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 44px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.introColour ?? bossPalette.introText;
    ctx.shadowColor = boss.introGlow ?? boss.introColour ?? bossPalette.introGlow;
    ctx.shadowBlur = 24;
    const message = boss.introMessage ?? 'INTRUDER ALERT';
    ctx.fillText(message, w / 2, centerY + 8);
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
  const telegraphPhaseIndex = clamp(
    boss.telegraphPhase ?? phase,
    1,
    boss.maxPhase ?? MAX_BOSS_PHASE,
  );
  const telegraphColor =
    telegraphPhaseIndex >= 3
      ? bossPalette.strokePhase3 || bossPalette.phaseShiftGlow
      : telegraphPhaseIndex === 2
        ? bossPalette.strokePhase2 || bossPalette.phaseShiftGlow
        : bossPalette.strokePhase1 || bossPalette.phaseShiftGlow;
  const telegraphOuter =
    telegraphPhaseIndex >= 3
      ? bossPalette.phase3Trim || bossPalette.phaseShiftOuter || telegraphColor
      : telegraphPhaseIndex === 2
        ? bossPalette.phase2Trim || bossPalette.phaseShiftOuter || telegraphColor
        : bossPalette.phaseShiftOuter || telegraphColor;
  const telegraphTrim =
    telegraphPhaseIndex >= 3
      ? bossPalette.phase3Trim || bossPalette.phaseShiftTrim || telegraphColor
      : telegraphPhaseIndex === 2
        ? bossPalette.phase2Trim || bossPalette.phaseShiftTrim || telegraphColor
        : bossPalette.phaseShiftTrim || telegraphColor;
  if (telegraphActive) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = telegraphColor;
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
    shadowColor = telegraphColor;
    shadowBlur = 52 + telegraphPulse * 12 * clamp(telegraphStrength, 0, 1);
    strokeStyle = telegraphColor;
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
  const coreInner = telegraphStrength > 0.01 ? telegraphColor : bossPalette.coreGlow;
  const coreOuter = telegraphStrength > 0.01 ? telegraphOuter : bossPalette.coreOuter;
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
    trimColor = telegraphTrim;
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
  if (boss.introTimer > 0 && !(boss.role === 'mid' || boss.variant === 'mid')) {
    ctx.save();
    ctx.translate(0, -80);
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.introColour ?? bossPalette.introText;
    ctx.shadowColor = boss.introGlow ?? bossPalette.introGlow;
    ctx.shadowBlur = 12;
    const message = boss.introMessage ?? 'WARNING — CORE GUARDIAN';
    ctx.fillText(message, 0, 0);
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
  const width = Math.min(viewW * 0.55, 440);
  const height = 16;
  const x = (viewW - width) / 2;
  const y = 40;
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
  ctx.shadowColor = bossPalette.healthShadow;
  ctx.shadowBlur = 20;
  ctx.fillStyle = bossPalette.healthBackdrop || 'rgba(0,0,0,0.4)';
  ctx.fillRect(x - 8, y - 10, width + 16, height + 20);
  ctx.shadowBlur = 0;
  const telegraphStrength = clamp(
    Math.max(
      boss.phaseFlashTimer / PHASE_TELEGRAPH_MS,
      boss.specialCueTimer / PHASE_TELEGRAPH_MS,
      boss.telegraphIntensity ?? 0,
    ),
    0,
    1,
  );
  const telegraphPhaseIndex = clamp(
    (boss.telegraphPhase ?? boss.currentPhase ?? 1) - 1,
    0,
    2,
  );
  const currentPhaseIndex = clamp((boss.currentPhase ?? 1) - 1, 0, 2);
  let drawX = x;
  for (let i = 0; i < 3; i++) {
    const upper = bounds[i];
    const lower = bounds[i + 1];
    const span = Math.max(0, upper - lower);
    const segWidth = width * span;
    if (segWidth <= 0) {
      continue;
    }
    const color = phaseColors[i] || bossPalette.healthFill;
    const fillAmount = span > 0 ? clamp((ratio - lower) / span, 0, 1) : 0;
    ctx.fillStyle = bossPalette.healthBackground;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(drawX, y, segWidth, height);
    ctx.globalAlpha = 1;
    if (fillAmount > 0) {
      ctx.fillStyle = color;
      ctx.fillRect(drawX, y, segWidth * fillAmount, height);
    }
    const highlightIndex = telegraphStrength > 0.01 ? telegraphPhaseIndex : currentPhaseIndex;
    const isHighlighted = i === highlightIndex;
    if (isHighlighted) {
      const glowStrength = telegraphStrength > 0.01 ? telegraphStrength : 0.35;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 24 * Math.max(glowStrength, 0.25);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX - 1, y - 1, segWidth + 2, height + 2);
      ctx.restore();
    }
    ctx.strokeStyle = bossPalette.healthStroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(drawX, y, segWidth, height);
    if (i < 2) {
      ctx.fillStyle = bossPalette.healthStroke;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(drawX + segWidth - 1, y - 2, 2, height + 4);
      ctx.globalAlpha = 1;
    }
    drawX += segWidth;
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = bossPalette.healthStroke;
  ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
  ctx.lineWidth = 1;
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = bossPalette.healthText;
  const phaseValue = clamp(boss.currentPhase ?? 1, 1, boss.maxPhase ?? MAX_BOSS_PHASE);
  const percent = Math.ceil(ratio * 100);
  const isMidBoss = boss.role === 'mid' || boss.variant === 'mid';
  const baseLabel = boss.healthLabel
    ?? (isMidBoss ? 'Intruder Integrity' : 'Boss Integrity');
  let caption = `${baseLabel} ${percent}%`;
  if (!isMidBoss && (boss.maxPhase ?? MAX_BOSS_PHASE) > 1) {
    caption += ` · Phase ${phaseValue}`;
  }
  ctx.fillText(caption, viewW / 2, y - 8);
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
    } else if (e.type === 'splitter') {
      const lobes = Math.max(5, e.lobes ?? 6);
      const radius = Math.max(10, e.r ?? SPLITTER_DEFAULT_RADIUS);
      const phase = e.phase ?? 0;
      ctx.shadowColor = enemyPalette.splitterGlow ?? enemyPalette.droneGlowInner;
      ctx.shadowBlur = 14;
      ctx.fillStyle = enemyPalette.splitterFill ?? enemyPalette.droneGlowInner ?? '#1a1433';
      ctx.strokeStyle = enemyPalette.splitterStroke ?? enemyPalette.droneCore ?? '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let l = 0; l < lobes; l++) {
        const ang = (l / lobes) * TAU;
        const wobble = Math.sin(ang * 2 + phase) * radius * 0.28;
        const r = radius + wobble;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (l === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = enemyPalette.splitterCore ?? enemyPalette.droneCore ?? '#9df5ff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (e.type === 'shield-drone') {
      const radius = Math.max(10, e.r ?? SHIELD_DRONE_DEFAULT_RADIUS);
      ctx.shadowColor = enemyPalette.shieldDroneGlow ?? enemyPalette.droneGlowInner;
      ctx.shadowBlur = 14;
      ctx.fillStyle = enemyPalette.shieldDroneFill ?? enemyPalette.droneGlowInner ?? '#0d1a33';
      ctx.strokeStyle = enemyPalette.shieldDroneTrim ?? enemyPalette.droneCore ?? '#3df2ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = enemyPalette.shieldDroneInner ?? enemyPalette.shieldDroneTrim ?? '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.55, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (Number.isFinite(e.shieldTimer) && e.shieldTimer > 0) {
      const duration = Number.isFinite(e.shieldDuration) ? e.shieldDuration : SHIELD_DRONE_DURATION_MS;
      const ratio = duration > 0 ? clamp(e.shieldTimer / duration, 0, 1) : 1;
      const baseRadius = Math.max(10, e.r ?? 10);
      const pulse = Math.sin((e.shieldPhase ?? 0) * 2) * 2;
      const bubbleRadius = baseRadius + 18 + pulse;
      const inner = enemyPalette.shieldBubbleInner ?? 'rgba(255, 255, 255, 0.22)';
      const outer = enemyPalette.shieldBubbleOuter ?? 'rgba(255, 255, 255, 0.05)';
      const gradient = ctx.createRadialGradient(0, 0, baseRadius * 0.85, 0, 0, bubbleRadius);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      ctx.globalAlpha = 0.45 + ratio * 0.35;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, bubbleRadius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = enemyPalette.shieldBubbleRim ?? (enemyPalette.shieldDroneTrim ?? '#3df2ff');
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.6 + ratio * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, bubbleRadius, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
