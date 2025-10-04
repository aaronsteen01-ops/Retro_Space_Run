/**
 * weapons.js — player and enemy projectile management for Retro Space Run.
 */
import { coll } from './utils.js';
import { playPew, playPow } from './audio.js';
import { updateWeapon, updateScore, getViewSize } from './ui.js';
import { resolvePaletteSection, DEFAULT_THEME_PALETTE } from './themes.js';

const DEFAULT_BULLET_LEVELS = DEFAULT_THEME_PALETTE.bullets.playerLevels;

export const WEAPON_DISPLAY_NAMES = Object.freeze({
  pulse: 'Pulse Cannon',
  twin: 'Twin Blaster',
  burst: 'Burst Laser',
  heavy: 'Heavy Plasma',
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
    vy: 90,
    r: 14,
    weapon,
    spin: Math.random() * Math.PI,
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
  const levelLabel = `Level ${levelIndex + 1}`;
  return `${name} – ${levelLabel}`;
}

export function getWeaponLabel(weapon) {
  return weaponHudLabel(weapon);
}

export function getWeaponDisplayName(id) {
  return WEAPON_DISPLAY_NAMES[id] || null;
}

export function updateWeaponHud(state) {
  const weapon = state?.weapon ?? null;
  updateWeapon(weaponHudLabel(weapon));
}

export function setupWeapons(state) {
  ensureWeaponState(state);
  state.weapon.name = 'pulse';
  state.weapon.level = 0;
  state.lastShot = 0;
  state.weaponDrops.length = 0;
  state.weaponDropSecured = false;
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

function spawnProjectile(state, projectile) {
  const bornAt = state.time * 1000;
  const width = projectile.width ?? 4;
  const height = projectile.height ?? 12;
  const radius = projectile.radius ?? Math.max(width, height) / 2;
  state.bullets.push({
    x: state.player.x + projectile.offsetX,
    y: state.player.y + projectile.offsetY,
    vx: projectile.vx,
    vy: projectile.vy,
    r: radius,
    damage: projectile.damage,
    colour: projectileColour(state, projectile.colourIndex ?? 0),
    bornAt,
    w: width,
    h: height,
  });
}

export function handlePlayerShooting(state, keys, now) {
  ensureWeaponState(state);
  const level = currentLevel(state);
  if (!level) {
    return;
  }
  const rapid = state.power.name === 'rapid';
  const delay = Math.max(70, level.delay * (rapid ? 0.6 : 1));
  if ((keys.has(' ') || keys.has('space')) && now - state.lastShot > delay) {
    state.lastShot = now;
    for (const projectile of level.projectiles) {
      spawnProjectile(state, projectile);
    }
    playPew();
  }
}

const PLAYER_BULLET_MAX_AGE_MS = 3000;

export function updatePlayerBullets(state, dt) {
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const nowMs = state.time * 1000;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    const age = nowMs - (b.bornAt ?? nowMs);
    if (
      b.y < -40 ||
      b.y > viewH + 40 ||
      b.x < -40 ||
      b.x > viewW + 40 ||
      age > PLAYER_BULLET_MAX_AGE_MS
    ) {
      state.bullets.splice(i, 1);
    }
  }
}

export function drawPlayerBullets(ctx, bullets) {
  const fallbackColour = DEFAULT_BULLET_LEVELS[0];
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const colour = b.colour ?? fallbackColour;
    ctx.shadowColor = `${colour}aa`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = colour;
    const w = b.w ?? 4;
    const h = b.h ?? 12;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

const ENEMY_BULLET_MAX_AGE_MS = 3000;

export function updateEnemyBullets(state, dt) {
  const { w, h } = getViewSize();
  const viewW = Math.max(w, 1);
  const viewH = Math.max(h, 1);
  const nowMs = state.time * 1000;
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    const age = nowMs - (b.bornAt ?? nowMs);
    if (
      b.y < -40 ||
      b.y > viewH + 40 ||
      b.x < -40 ||
      b.x > viewW + 40 ||
      age > ENEMY_BULLET_MAX_AGE_MS
    ) {
      state.enemyBullets.splice(i, 1);
    }
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
  if (state.weapon.name !== weaponName) {
    state.weapon.name = weaponName;
    state.weapon.level = 0;
  } else if (state.weapon.level < maxLevel) {
    state.weapon.level += 1;
  } else {
    state.score = (state.score ?? 0) + 250;
    updateScore(state.score);
    updateWeaponHud(state);
    state.weaponDropSecured = true;
    playPow();
    return;
  }
  state.lastShot = 0;
  state.weaponDropSecured = true;
  updateWeaponHud(state);
  playPow();
}

export function maybeDropWeaponToken(state, enemy) {
  ensureWeaponState(state);
  if (Math.random() > DROP_CHANCE) {
    return;
  }
  const weapon = pickWeaponKey();
  pushWeaponDrop(state, weapon, enemy.x, enemy.y);
}

export function updateWeaponDrops(state, dt) {
  const { h } = getViewSize();
  const viewH = Math.max(h, 1);
  ensureWeaponState(state);
  for (let i = state.weaponDrops.length - 1; i >= 0; i--) {
    const drop = state.weaponDrops[i];
    drop.y += drop.vy * dt;
    drop.spin = (drop.spin || 0) + dt * 2.4;
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
    const def = weaponDefs[drop.weapon];
    const fill = tokenPalette.fill;
    const stroke = tokenPalette.stroke;
    const glow = tokenPalette.glow;
    ctx.save();
    ctx.translate(drop.x, drop.y);
    ctx.rotate(drop.spin || 0);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = tokenPalette.text;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def ? def.label.charAt(0) : 'W', 0, 0);
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
