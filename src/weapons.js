/**
 * weapons.js — player and enemy projectile management for Retro Space Run.
 */
// CHANGELOG: Broadcast weapon changes via GameEvents for HUD synchronisation.
import { coll, lerp, rand } from './utils.js';
import { playPew, playPow, playUpgrade } from './audio.js';
import { updateWeapon, updateScore, updateShield, updatePower, getViewSize } from './ui.js';
import { resolvePaletteSection, DEFAULT_THEME_PALETTE } from './themes.js';
import { getBullet } from './bullets.js';
import { showToast } from './effects.js';
import { GameEvents } from './events.js';

const DEFAULT_BULLET_LEVELS = DEFAULT_THEME_PALETTE.bullets.playerLevels;
const SHIELD_BASE_DURATION = 8000;
const DUPLICATE_SHIELD_RATIO = 0.5;

export const WEAPON_DISPLAY_NAMES = Object.freeze({
  pulse: 'Pulse Cannon',
  twin: 'Twin Blaster',
  burst: 'Burst Laser',
  heavy: 'Heavy Plasma',
});

const WEAPON_PICTOGRAMS = Object.freeze({
  pulse: '•',
  twin: '||',
  burst: '≋',
  heavy: '◎',
});

const weaponDefs = {
  pulse: {
    label: WEAPON_DISPLAY_NAMES.pulse,
    levels: [
      {
        delay: 210,
        projectiles: [
          {
            offsetX: 0,
            offsetY: -18,
            vx: 0,
            vy: -620,
            damage: 1,
            colourIndex: 0,
            width: 4,
            height: 12,
          },
        ],
      },
      {
        delay: 160,
        projectiles: [
          {
            offsetX: -12,
            offsetY: -18,
            vx: -110,
            vy: -630,
            damage: 1,
            colourIndex: 1,
            width: 4,
            height: 12,
          },
          {
            offsetX: 12,
            offsetY: -18,
            vx: 110,
            vy: -630,
            damage: 1,
            colourIndex: 1,
            width: 4,
            height: 12,
          },
        ],
      },
      {
        delay: 140,
        projectiles: [
          {
            offsetX: -16,
            offsetY: -14,
            vx: -180,
            vy: -650,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 14,
          },
          {
            offsetX: 0,
            offsetY: -22,
            vx: 0,
            vy: -720,
            damage: 1.4,
            colourIndex: 2,
            width: 6,
            height: 16,
          },
          {
            offsetX: 16,
            offsetY: -14,
            vx: 180,
            vy: -650,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 14,
          },
        ],
      },
    ],
  },
  twin: {
    label: WEAPON_DISPLAY_NAMES.twin,
    levels: [
      {
        delay: 200,
        projectiles: [
          {
            offsetX: -14,
            offsetY: -20,
            vx: -40,
            vy: -610,
            damage: 0.9,
            colourIndex: 0,
            width: 4,
            height: 11,
          },
          {
            offsetX: 14,
            offsetY: -20,
            vx: 40,
            vy: -610,
            damage: 0.9,
            colourIndex: 0,
            width: 4,
            height: 11,
          },
        ],
      },
      {
        delay: 150,
        projectiles: [
          {
            offsetX: -18,
            offsetY: -18,
            vx: -140,
            vy: -640,
            damage: 1.1,
            colourIndex: 1,
            width: 4,
            height: 12,
          },
          {
            offsetX: -6,
            offsetY: -22,
            vx: -10,
            vy: -680,
            damage: 1.1,
            colourIndex: 1,
            width: 4,
            height: 13,
          },
          {
            offsetX: 6,
            offsetY: -22,
            vx: 10,
            vy: -680,
            damage: 1.1,
            colourIndex: 1,
            width: 4,
            height: 13,
          },
          {
            offsetX: 18,
            offsetY: -18,
            vx: 140,
            vy: -640,
            damage: 1.1,
            colourIndex: 1,
            width: 4,
            height: 12,
          },
        ],
      },
      {
        delay: 120,
        projectiles: [
          {
            offsetX: -22,
            offsetY: -16,
            vx: -210,
            vy: -640,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 12,
          },
          {
            offsetX: -10,
            offsetY: -22,
            vx: -60,
            vy: -700,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 14,
          },
          {
            offsetX: 0,
            offsetY: -26,
            vx: 0,
            vy: -750,
            damage: 1.5,
            colourIndex: 2,
            width: 6,
            height: 16,
          },
          {
            offsetX: 10,
            offsetY: -22,
            vx: 60,
            vy: -700,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 14,
          },
          {
            offsetX: 22,
            offsetY: -16,
            vx: 210,
            vy: -640,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 12,
          },
        ],
      },
    ],
  },
  burst: {
    label: WEAPON_DISPLAY_NAMES.burst,
    levels: [
      {
        delay: 230,
        projectiles: [
          {
            offsetX: -16,
            offsetY: -14,
            vx: -180,
            vy: -660,
            damage: 1.1,
            colourIndex: 0,
            width: 4,
            height: 13,
          },
          {
            offsetX: 0,
            offsetY: -20,
            vx: 0,
            vy: -700,
            damage: 1.2,
            colourIndex: 0,
            width: 4,
            height: 14,
          },
          {
            offsetX: 16,
            offsetY: -14,
            vx: 180,
            vy: -660,
            damage: 1.1,
            colourIndex: 0,
            width: 4,
            height: 13,
          },
        ],
      },
      {
        delay: 170,
        projectiles: [
          {
            offsetX: -22,
            offsetY: -12,
            vx: -260,
            vy: -640,
            damage: 1.2,
            colourIndex: 1,
            width: 4,
            height: 13,
          },
          {
            offsetX: -10,
            offsetY: -20,
            vx: -90,
            vy: -700,
            damage: 1.3,
            colourIndex: 1,
            width: 4,
            height: 14,
          },
          {
            offsetX: 0,
            offsetY: -24,
            vx: 0,
            vy: -740,
            damage: 1.3,
            colourIndex: 1,
            width: 5,
            height: 15,
          },
          {
            offsetX: 10,
            offsetY: -20,
            vx: 90,
            vy: -700,
            damage: 1.3,
            colourIndex: 1,
            width: 4,
            height: 14,
          },
          {
            offsetX: 22,
            offsetY: -12,
            vx: 260,
            vy: -640,
            damage: 1.2,
            colourIndex: 1,
            width: 4,
            height: 13,
          },
        ],
      },
      {
        delay: 140,
        projectiles: [
          {
            offsetX: -26,
            offsetY: -10,
            vx: -300,
            vy: -620,
            damage: 1.3,
            colourIndex: 2,
            width: 4,
            height: 12,
          },
          {
            offsetX: -16,
            offsetY: -18,
            vx: -200,
            vy: -660,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 14,
          },
          {
            offsetX: -6,
            offsetY: -24,
            vx: -90,
            vy: -720,
            damage: 1.5,
            colourIndex: 2,
            width: 5,
            height: 15,
          },
          {
            offsetX: 0,
            offsetY: -28,
            vx: 0,
            vy: -760,
            damage: 1.6,
            colourIndex: 2,
            width: 6,
            height: 16,
          },
          {
            offsetX: 6,
            offsetY: -24,
            vx: 90,
            vy: -720,
            damage: 1.5,
            colourIndex: 2,
            width: 5,
            height: 15,
          },
          {
            offsetX: 16,
            offsetY: -18,
            vx: 200,
            vy: -660,
            damage: 1.4,
            colourIndex: 2,
            width: 5,
            height: 14,
          },
          {
            offsetX: 26,
            offsetY: -10,
            vx: 300,
            vy: -620,
            damage: 1.3,
            colourIndex: 2,
            width: 4,
            height: 12,
          },
        ],
      },
    ],
  },
  heavy: {
    label: WEAPON_DISPLAY_NAMES.heavy,
    levels: [
      {
        delay: 300,
        projectiles: [
          {
            offsetX: 0,
            offsetY: -26,
            vx: 0,
            vy: -540,
            damage: 2.4,
            colourIndex: 0,
            width: 7,
            height: 18,
            radius: 8,
          },
        ],
      },
      {
        delay: 230,
        projectiles: [
          {
            offsetX: -8,
            offsetY: -24,
            vx: -40,
            vy: -560,
            damage: 2.6,
            colourIndex: 1,
            width: 7,
            height: 18,
            radius: 8,
          },
          {
            offsetX: 8,
            offsetY: -24,
            vx: 40,
            vy: -560,
            damage: 2.6,
            colourIndex: 1,
            width: 7,
            height: 18,
            radius: 8,
          },
        ],
      },
      {
        delay: 200,
        projectiles: [
          {
            offsetX: -14,
            offsetY: -22,
            vx: -120,
            vy: -560,
            damage: 2.8,
            colourIndex: 2,
            width: 7,
            height: 18,
            radius: 9,
          },
          {
            offsetX: 0,
            offsetY: -28,
            vx: 0,
            vy: -620,
            damage: 3.2,
            colourIndex: 2,
            width: 9,
            height: 22,
            radius: 10,
          },
          {
            offsetX: 14,
            offsetY: -22,
            vx: 120,
            vy: -560,
            damage: 2.8,
            colourIndex: 2,
            width: 7,
            height: 18,
            radius: 9,
          },
        ],
      },
    ],
  },
};

const DROP_CHANCE = 0.18;
const DROP_LIFETIME = 10000;
const TOKEN_BASE_VY = 90;
const TOKEN_ATTRACT_RADIUS = 120;
const TOKEN_ATTRACT_RADIUS_SQ = TOKEN_ATTRACT_RADIUS * TOKEN_ATTRACT_RADIUS;
const TOKEN_PULL_ACCEL = 520;
const TOKEN_MAX_SPEED = 340;
const TOKEN_VISUAL_RADIUS = 16;
const TOKEN_PICKUP_RADIUS = 24;
const TOKEN_FLOAT_SPEED = 1.6;
const TOKEN_PULSE_SPEED = 2.2;
const TOKEN_SPIN_SPEED = 1.2;
const WEAPON_PICKUP_FLASH_TIME = 200;

function ensureWeaponState(state) {
  if (!state.weapon) {
    state.weapon = { name: 'pulse', level: 0 };
  }
  if (!state.weaponDrops) {
    state.weaponDrops = [];
  }
  if (state.weaponDropSecured === undefined) {
    state.weaponDropSecured = false;
  }
  if (!state.muzzleFlashes) {
    state.muzzleFlashes = [];
  }
  if (state.weaponPickupFlash === undefined) {
    state.weaponPickupFlash = null;
  }
}

function pickWeaponKey() {
  const weaponKeys = Object.keys(weaponDefs);
  if (!weaponKeys.length) {
    return 'pulse';
  }
  return weaponKeys[Math.floor(Math.random() * weaponKeys.length)];
}

function pushWeaponDrop(state, weapon, x, y) {
  ensureWeaponState(state);
  state.weaponDrops.push({
    x,
    y,
    vx: 0,
    vy: TOKEN_BASE_VY,
    baseVy: TOKEN_BASE_VY,
    r: TOKEN_PICKUP_RADIUS,
    visualRadius: TOKEN_VISUAL_RADIUS,
    weapon,
    spin: Math.random() * Math.PI,
    spinSpeed: rand(0.7, 1.3) * TOKEN_SPIN_SPEED,
    floatPhase: Math.random() * Math.PI * 2,
    pulsePhase: Math.random() * Math.PI * 2,
    life: DROP_LIFETIME,
    t: DROP_LIFETIME,
  });
  state.weaponDropSecured = true;
}

function clampLevel(def, level) {
  if (!def) {
    return 0;
  }
  return Math.min(level, def.levels.length - 1);
}

function currentLevel(state) {
  const weapon = state.weapon;
  const def = weaponDefs[weapon?.name];
  if (!def) {
    return null;
  }
  const levelIndex = clampLevel(def, weapon.level);
  return def.levels[levelIndex];
}

function romanNumeral(index) {
  const numerals = ['I', 'II', 'III', 'IV', 'V'];
  const idx = Math.max(0, Math.min(index, numerals.length - 1));
  return numerals[idx] || numerals[numerals.length - 1];
}

function weaponHudLabel(weapon) {
  if (!weapon) {
    return 'None';
  }
  const name = getWeaponDisplayName(weapon.name);
  if (!name) {
    return 'None';
  }
  const def = weaponDefs[weapon.name];
  const levelIndex = def ? clampLevel(def, weapon.level) : 0;
  const levelLabel = romanNumeral(levelIndex);
  return `${name} – ${levelLabel}`;
}

export function getWeaponLabel(weapon) {
  return weaponHudLabel(weapon);
}

export function getWeaponDisplayName(id) {
  return WEAPON_DISPLAY_NAMES[id] || null;
}

function getWeaponPictogram(id) {
  return WEAPON_PICTOGRAMS[id] || '•';
}

export function updateWeaponHud(state) {
  const weapon = state?.weapon ?? null;
  const label = weaponHudLabel(weapon);
  const icon = weapon ? getWeaponPictogram(weapon.name) : undefined;
  updateWeapon(label, {
    icon,
  });
  GameEvents.emit('weapon:changed', weapon
    ? { name: getWeaponDisplayName(weapon.name) ?? label, label, icon }
    : 'None');
}

export function setupWeapons(state) {
  ensureWeaponState(state);
  state.weapon.name = 'pulse';
  state.weapon.level = 0;
  state.lastShot = 0;
  state.weaponDrops.length = 0;
  state.weaponDropSecured = false;
  state.muzzleFlashes.length = 0;
  state.weaponPickupFlash = null;
  updateWeaponHud(state);
}

function projectileColour(state, index = 0) {
  const bulletPalette = resolvePaletteSection(state.theme, 'bullets');
  const colours = Array.isArray(bulletPalette.playerLevels) && bulletPalette.playerLevels.length
    ? bulletPalette.playerLevels
    : DEFAULT_BULLET_LEVELS;
  const idx = Math.max(0, Math.min(colours.length - 1, index));
  return colours[idx];
}

function colourWithAlpha(colour, alpha, fallbackColour = DEFAULT_BULLET_LEVELS[0]) {
  const baseColour = typeof colour === 'string' && colour.trim().length ? colour : fallbackColour;
  if (baseColour.startsWith('#')) {
    let hex = baseColour.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (baseColour.startsWith('rgb(')) {
    return baseColour.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  if (baseColour.startsWith('rgba(')) {
    return baseColour.replace(/rgba\(([^)]+)\)/, (_, body) => {
      const parts = body.split(',').map((part) => part.trim());
      return `rgba(${parts.slice(0, 3).join(', ')}, ${alpha})`;
    });
  }
  if (baseColour !== fallbackColour) {
    return colourWithAlpha(fallbackColour, alpha, '#ffffff');
  }
  return `rgba(255, 255, 255, ${alpha})`;
}

function pushMuzzleFlash(state, projectile, levelIndex, width, height, colour, bulletVx, bulletVy) {
  if (!state.player) {
    return;
  }
  const length = Math.max(height * 0.9, 14 + levelIndex * 4);
  const spread = Math.max(width * 0.8, 6 + levelIndex * 1.5);
  const vx = bulletVx ?? projectile.vx ?? 0;
  const vy = bulletVy ?? projectile.vy ?? -1;
  const rotation = Math.atan2(vy, vx) + Math.PI / 2;
  state.muzzleFlashes.push({
    x: state.player.x + projectile.offsetX,
    y: state.player.y + projectile.offsetY,
    rotation,
    life: 140,
    t: 140,
    length,
    spread,
    colour,
  });
}

function triggerWeaponPickupFlash(state, weaponName) {
  if (!weaponName) {
    return;
  }
  ensureWeaponState(state);
  const def = weaponDefs[weaponName];
  if (!def) {
    return;
  }
  const levelIndex = clampLevel(def, state.weapon?.level ?? 0);
  const colour = projectileColour(state, levelIndex);
  state.weaponPickupFlash = {
    colour,
    life: WEAPON_PICKUP_FLASH_TIME,
    t: WEAPON_PICKUP_FLASH_TIME,
  };
}

function spawnProjectile(state, projectile, levelIndex) {
  const bornAt = state.time * 1000;
  const baseWidth = projectile.width ?? 4;
  const baseHeight = projectile.height ?? 12;
  const width = baseWidth + levelIndex * 1.5;
  const height = baseHeight + levelIndex * 3;
  const radius = projectile.radius ?? Math.max(width, height) / 2;
  const colour = projectileColour(state, projectile.colourIndex ?? 0);
  const squall = state.weather?.squall;
  const squallSpread = squall?.active ? squall.playerSpread ?? squall.spread ?? 0 : 0;
  const spreadMultiplier = Number.isFinite(state.player?.projectileSpread)
    ? Math.max(0.4, state.player.projectileSpread)
    : 1;
  const bullet = getBullet();
  const offsetX = projectile.offsetX * spreadMultiplier;
  bullet.x = state.player.x + offsetX;
  bullet.y = state.player.y + projectile.offsetY;
  const velocityX = (projectile.vx ?? 0) * spreadMultiplier;
  const vx = velocityX + (squallSpread ? rand(-squallSpread, squallSpread) : 0);
  const vy = projectile.vy;
  bullet.vx = vx;
  bullet.vy = vy;
  bullet.r = radius;
  bullet.damage = projectile.damage;
  bullet.colour = colour;
  bullet.bornAt = bornAt;
  bullet.updatedAt = bornAt;
  bullet.w = width;
  bullet.h = height;
  bullet.level = levelIndex;
  bullet.owner = 'player';
  bullet.maxAge = undefined;
  state.bullets.push(bullet);
  pushMuzzleFlash(state, projectile, levelIndex, width, height, colour, vx, vy);
}

export function handlePlayerShooting(state, input, now) {
  ensureWeaponState(state);
  const level = currentLevel(state);
  if (!level) {
    return;
  }
  const def = state.weapon ? weaponDefs[state.weapon.name] : null;
  const levelIndex = def ? clampLevel(def, state.weapon.level) : 0;
  const rapid = state.power.name === 'rapid';
  const fireRateMultiplier = state.runUpgrades?.fireRateMultiplier ?? 1;
  const shipFireRate = Number.isFinite(state.player?.fireRate)
    ? Math.max(0.4, state.player.fireRate)
    : 1;
  const delay = Math.max(70, level.delay * (rapid ? 0.6 : 1) * fireRateMultiplier * shipFireRate);
  if (input?.fire && now - state.lastShot > delay) {
    state.lastShot = now;
    for (const projectile of level.projectiles) {
      spawnProjectile(state, projectile, levelIndex);
    }
    playPew();
  }
}

export function drawPlayerBullets(ctx, bullets, palette) {
  const bulletPalette = resolvePaletteSection(palette, 'bullets');
  const playerLevels = Array.isArray(bulletPalette.playerLevels) && bulletPalette.playerLevels.length
    ? bulletPalette.playerLevels
    : DEFAULT_BULLET_LEVELS;
  const fallbackColour = playerLevels[0] ?? DEFAULT_BULLET_LEVELS[0];
  const highlightColour = bulletPalette.highlight ?? playerLevels[playerLevels.length - 1] ?? fallbackColour;
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const colour = b.colour ?? fallbackColour;
    const level = b.level ?? 0;
    const w = b.w ?? 4;
    const h = b.h ?? 12;
    ctx.shadowColor = colourWithAlpha(colour, 0.8, fallbackColour);
    ctx.shadowBlur = 8 + level * 4;
    const gradient = ctx.createLinearGradient(0, h / 2, 0, -h / 2);
    const innerAlpha = Math.max(0, Math.min(1, 0.35 + level * 0.15));
    gradient.addColorStop(0, colourWithAlpha(colour, 0, fallbackColour));
    gradient.addColorStop(0.25, colourWithAlpha(colour, innerAlpha, fallbackColour));
    gradient.addColorStop(0.55, colourWithAlpha(highlightColour, 0.9, highlightColour));
    gradient.addColorStop(1, colourWithAlpha(colour, 1, fallbackColour));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.6 + level * 0.4;
    ctx.strokeStyle = colourWithAlpha(colour, 0.8, fallbackColour);
    ctx.stroke();
    ctx.restore();
  }
}

export function updateMuzzleFlashes(state, dt) {
  ensureWeaponState(state);
  for (let i = state.muzzleFlashes.length - 1; i >= 0; i--) {
    const flash = state.muzzleFlashes[i];
    flash.t -= dt * 1000;
    if (flash.t <= 0) {
      state.muzzleFlashes.splice(i, 1);
    }
  }
  if (state.weaponPickupFlash) {
    state.weaponPickupFlash.t -= dt * 1000;
    if (state.weaponPickupFlash.t <= 0) {
      state.weaponPickupFlash = null;
    }
  }
}

export function drawMuzzleFlashes(ctx, flashes, palette) {
  const bulletPalette = resolvePaletteSection(palette, 'bullets');
  const playerLevels = Array.isArray(bulletPalette.playerLevels) && bulletPalette.playerLevels.length
    ? bulletPalette.playerLevels
    : DEFAULT_BULLET_LEVELS;
  const fallbackColour = playerLevels[Math.min(playerLevels.length - 1, 2)] ?? DEFAULT_BULLET_LEVELS[2];
  const muzzleCore = bulletPalette.muzzleCore ?? fallbackColour;
  const muzzleEdge = bulletPalette.muzzleEdge ?? bulletPalette.highlight ?? fallbackColour;
  for (const flash of flashes) {
    const alpha = Math.max(0, Math.min(1, flash.t / flash.life));
    if (alpha <= 0) {
      continue;
    }
    ctx.save();
    ctx.translate(flash.x, flash.y);
    ctx.rotate(flash.rotation || 0);
    ctx.globalAlpha = alpha;
    const colour = flash.colour || muzzleCore;
    const gradient = ctx.createLinearGradient(0, 0, 0, -flash.length);
    gradient.addColorStop(0, colourWithAlpha(colour, 0, fallbackColour));
    gradient.addColorStop(0.2, colourWithAlpha(colour, 0.6, fallbackColour));
    gradient.addColorStop(1, colourWithAlpha(muzzleEdge, 0.95, muzzleEdge));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -flash.length);
    ctx.lineTo(flash.spread, 0);
    ctx.lineTo(-flash.spread, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export function drawEnemyBullets(ctx, bullets, palette) {
  const bulletPalette = resolvePaletteSection(palette, 'bullets');
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = bulletPalette.enemyGlow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = bulletPalette.enemyFill;
    ctx.fillRect(-2, -5, 4, 9);
    ctx.restore();
  }
}

function upgradeWeapon(state, weaponName) {
  ensureWeaponState(state);
  const def = weaponDefs[weaponName];
  if (!def) {
    return;
  }
  const maxLevel = def.levels.length - 1;
  let upgraded = false;
  if (state.weapon.name !== weaponName) {
    state.weapon.name = weaponName;
    state.weapon.level = 0;
    upgraded = true;
  } else if (state.weapon.level < maxLevel) {
    state.weapon.level += 1;
    upgraded = true;
  } else {
    const conversion = state.runUpgrades?.duplicateConversion ?? 'score';
    if (conversion === 'shield') {
      const multiplier = state.runUpgrades?.shieldDurationMultiplier ?? 1;
      const fullCapacity = Math.max(0, Math.round(SHIELD_BASE_DURATION * multiplier));
      const bonus = Math.max(0, Math.round(fullCapacity * DUPLICATE_SHIELD_RATIO));
      const now = performance.now();
      const existingTime = state.power?.name === 'shield'
        ? Math.max(0, state.power.until - now)
        : 0;
      const existingCharge = state.power?.name === 'shield'
        ? Math.max(state.player?.shield ?? existingTime, existingTime)
        : Math.max(state.player?.shield ?? 0, 0);
      const newCharge = Math.min(fullCapacity, existingCharge + bonus);
      const newTime = Math.min(fullCapacity, existingTime + bonus);
      state.power.name = 'shield';
      state.power.until = now + newTime;
      if (state.player) {
        state.player.shield = newCharge;
      }
      state.shieldCapacity = fullCapacity;
      updateShield(newCharge, fullCapacity);
      GameEvents.emit('shield:changed', { value: newCharge, max: fullCapacity });
      updatePower('SHIELD');
      GameEvents.emit('powerup:changed', 'SHIELD');
      showToast('+50% SHIELD', 1000);
    } else {
      if (typeof state.addScore === 'function') {
        state.addScore(500);
      } else {
        state.score = (state.score ?? 0) + 500;
        updateScore(state.score);
        GameEvents.emit('score:changed', state.score);
      }
      showToast('+500 SCORE', 900);
    }
    updateWeaponHud(state);
    state.weaponDropSecured = true;
    playPow();
    return;
  }
  state.lastShot = 0;
  state.weaponDropSecured = true;
  if (upgraded) {
    triggerWeaponPickupFlash(state, weaponName);
  }
  updateWeaponHud(state);
  if (upgraded) {
    const displayName = getWeaponDisplayName(state.weapon.name);
    const levelIndex = def ? clampLevel(def, state.weapon.level) : null;
    if (displayName && levelIndex !== null && levelIndex !== undefined) {
      const roman = romanNumeral(levelIndex);
      if (roman) {
        showToast(`UPGRADE: ${displayName} · ${roman}`, 1200);
      }
    }
    playUpgrade();
  } else {
    playPow();
  }
}

export function maybeDropWeaponToken(state, enemy) {
  ensureWeaponState(state);
  if (Math.random() > DROP_CHANCE) {
    return;
  }
  const weapon = pickWeaponKey();
  pushWeaponDrop(state, weapon, enemy.x, enemy.y);
}

export function spawnWeaponToken(state, x, y, weaponName) {
  ensureWeaponState(state);
  const weapon = weaponName ?? pickWeaponKey();
  pushWeaponDrop(state, weapon, x, y);
  return weapon;
}

export function updateWeaponDrops(state, dt) {
  const { h } = getViewSize();
  const viewH = Math.max(h, 1);
  ensureWeaponState(state);
  for (let i = state.weaponDrops.length - 1; i >= 0; i--) {
    const drop = state.weaponDrops[i];
    drop.floatPhase = (drop.floatPhase || 0) + dt * TOKEN_FLOAT_SPEED;
    drop.pulsePhase = (drop.pulsePhase || 0) + dt * TOKEN_PULSE_SPEED;
    const spinSpeed = drop.spinSpeed ?? TOKEN_SPIN_SPEED;
    drop.spinSpeed = spinSpeed;
    drop.spin = (drop.spin || 0) + dt * spinSpeed;
    const baseVy = drop.baseVy ?? TOKEN_BASE_VY;
    drop.baseVy = baseVy;
    drop.vx = drop.vx ?? 0;
    drop.vy = drop.vy ?? baseVy;
    const activeWeaponName = state.weapon?.name;
    const hasPlayer = Boolean(state.player);
    const shouldMagnet = hasPlayer && activeWeaponName && drop.weapon === activeWeaponName;
    if (hasPlayer) {
      const dx = state.player.x - drop.x;
      const dy = state.player.y - drop.y;
      const distSq = dx * dx + dy * dy;
      if (shouldMagnet && distSq < TOKEN_ATTRACT_RADIUS_SQ) {
        const dist = Math.sqrt(distSq) || 1;
        const pull = 1 - Math.min(1, dist / TOKEN_ATTRACT_RADIUS);
        const accel = TOKEN_PULL_ACCEL * (0.35 + pull * 0.65);
        drop.vx += (dx / dist) * accel * dt;
        drop.vy += (dy / dist) * accel * dt;
      } else {
        drop.vx = lerp(drop.vx, 0, 0.08);
        drop.vy = lerp(drop.vy, baseVy, 0.06);
      }
    } else {
      drop.vx = lerp(drop.vx, 0, 0.08);
      drop.vy = lerp(drop.vy, baseVy, 0.06);
    }
    const speed = Math.hypot(drop.vx, drop.vy);
    if (speed > TOKEN_MAX_SPEED) {
      const scale = TOKEN_MAX_SPEED / speed;
      drop.vx *= scale;
      drop.vy *= scale;
    }
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.t -= dt * 1000;
    if (drop.t <= 0 || drop.y > viewH + 40) {
      state.weaponDrops.splice(i, 1);
      continue;
    }
    if (state.player && coll(state.player, drop)) {
      upgradeWeapon(state, drop.weapon);
      state.weaponDrops.splice(i, 1);
    }
  }
}

export function drawWeaponDrops(ctx, drops, palette) {
  const tokenPalette = resolvePaletteSection(palette, 'weaponToken');
  for (const drop of drops) {
    const fill = tokenPalette.fill || '#ff3df7';
    const stroke = tokenPalette.stroke || '#00e5ff';
    const glow = tokenPalette.glow || stroke;
    const textColour = tokenPalette.text || stroke;
    const radius = drop.visualRadius ?? TOKEN_VISUAL_RADIUS;
    const drift = Math.sin(drop.floatPhase || 0) * 3;
    const pulsePhase = drop.pulsePhase || 0;
    const pulse = 0.5 + 0.5 * Math.sin(pulsePhase);
    const rimRadius = radius - 1.2;
    const pictogram = getWeaponPictogram(drop.weapon);
    ctx.save();
    ctx.translate(drop.x, drop.y + drift);
    const glowStrength = 14 + pulse * 12;
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowStrength;
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
    gradient.addColorStop(0, colourWithAlpha(fill, 0.98));
    gradient.addColorStop(0.45, colourWithAlpha(fill, 0.66));
    gradient.addColorStop(0.82, colourWithAlpha(fill, 0.22));
    gradient.addColorStop(1, colourWithAlpha(fill, 0.06));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    const rimAlpha = 0.55 + pulse * 0.25;
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = colourWithAlpha(stroke, rimAlpha);
    ctx.beginPath();
    ctx.arc(0, 0, rimRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(drop.spin || 0);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8 + pulse * 10;
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = colourWithAlpha(stroke, 0.9);
    const segments = 3;
    const arcSpan = Math.PI / 2.3;
    for (let s = 0; s < segments; s++) {
      const centreAngle = (s / segments) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, rimRadius - 0.4, centreAngle - arcSpan / 2, centreAngle + arcSpan / 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = colourWithAlpha(stroke, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    const innerPulse = 0.18 + pulse * 0.22;
    ctx.fillStyle = colourWithAlpha(textColour, innerPulse, stroke);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colourWithAlpha('#ffffff', 0.22 + pulse * 0.1, '#ffffff');
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.35, radius * 0.6, radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = colourWithAlpha(glow, 0.65, stroke);
    ctx.shadowBlur = 6 + pulse * 6;
    ctx.fillStyle = textColour;
    ctx.font = '600 17px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pictogram, 0, 0.5);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export function ensureGuaranteedWeaponDrop(state) {
  ensureWeaponState(state);
  if (state.weaponDropSecured) {
    return;
  }
  if ((state.weapon?.level ?? 0) > 0) {
    state.weaponDropSecured = true;
    return;
  }
  if (!state.levelDur) {
    return;
  }
  const progress = state.time / state.levelDur;
  if (progress < 0.6) {
    return;
  }
  const { w } = getViewSize();
  const viewW = Math.max(w, 1);
  const weapon = pickWeaponKey();
  const targetX = state.player ? state.player.x : viewW / 2;
  const x = Math.max(40, Math.min(viewW - 40, targetX));
  pushWeaponDrop(state, weapon, x, -24);
}
