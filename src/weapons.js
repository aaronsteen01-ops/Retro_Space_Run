/**
 * weapons.js — player and enemy projectile management for Retro Space Run.
 */
import { coll } from './utils.js';
import { playPew, playPow } from './audio.js';
import { updateWeapon } from './ui.js';

const ROMAN = ['I', 'II', 'III'];

const weaponDefs = {
  pulse: {
    label: 'Pulse Cannon',
    levels: [
      {
        delay: 210,
        projectiles: [
          { offsetX: 0, offsetY: -18, vx: 0, vy: -620, damage: 1, colourIndex: 0 },
        ],
      },
      {
        delay: 160,
        projectiles: [
          { offsetX: -12, offsetY: -18, vx: -110, vy: -630, damage: 1, colourIndex: 1 },
          { offsetX: 12, offsetY: -18, vx: 110, vy: -630, damage: 1, colourIndex: 1 },
        ],
      },
      {
        delay: 140,
        projectiles: [
          { offsetX: -16, offsetY: -14, vx: -180, vy: -650, damage: 1.4, colourIndex: 2 },
          { offsetX: 0, offsetY: -22, vx: 0, vy: -720, damage: 1.4, colourIndex: 2 },
          { offsetX: 16, offsetY: -14, vx: 180, vy: -650, damage: 1.4, colourIndex: 2 },
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

export function getWeaponLabel(weapon) {
  if (!weapon) {
    return '—';
  }
  const def = weaponDefs[weapon.name];
  if (!def) {
    return '—';
  }
  const numeral = ROMAN[clampLevel(def, weapon.level)] || ROMAN[ROMAN.length - 1];
  return `${def.label} · ${numeral}`;
}

export function setupWeapons(state) {
  ensureWeaponState(state);
  state.weapon.name = 'pulse';
  state.weapon.level = 0;
  state.lastShot = 0;
  state.weaponDrops.length = 0;
  updateWeapon(getWeaponLabel(state.weapon));
}

function projectileColour(state, index = 0) {
  const palette = state.theme?.bullets?.playerLevels;
  const fallback = ['#ffb8ff', '#ffd6ff', '#ffeeff'];
  const colours = Array.isArray(palette) && palette.length ? palette : fallback;
  const idx = Math.max(0, Math.min(colours.length - 1, index));
  return colours[idx];
}

function spawnProjectile(state, projectile) {
  state.bullets.push({
    x: state.player.x + projectile.offsetX,
    y: state.player.y + projectile.offsetY,
    vx: projectile.vx,
    vy: projectile.vy,
    r: 6,
    damage: projectile.damage,
    colour: projectileColour(state, projectile.colourIndex ?? 0),
    life: 1200,
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

export function updatePlayerBullets(state, dt, canvas) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    b.life = (b.life || 0) - dt * 1000;
    if (
      b.y < -40 ||
      b.y > canvas.height + 40 ||
      b.x < -40 ||
      b.x > canvas.width + 40 ||
      b.life <= 0
    ) {
      state.bullets.splice(i, 1);
    }
  }
}

export function drawPlayerBullets(ctx, bullets) {
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = (b.colour || '#ffb8ff') + 'aa';
    ctx.shadowBlur = 10;
    ctx.fillStyle = b.colour || '#ffb8ff';
    ctx.fillRect(-2, -6, 4, 12);
    ctx.restore();
  }
}

export function updateEnemyBullets(state, dt, canvas) {
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    if (
      b.y < -40 ||
      b.y > canvas.height + 40 ||
      b.x < -40 ||
      b.x > canvas.width + 40
    ) {
      state.enemyBullets.splice(i, 1);
    }
  }
}

export function drawEnemyBullets(ctx, bullets, palette) {
  const bulletPalette = palette?.bullets ?? {};
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = bulletPalette.enemyGlow || '#00e5ffaa';
    ctx.shadowBlur = 8;
    ctx.fillStyle = bulletPalette.enemyFill || '#8af5ff';
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
  if (state.weapon.name !== weaponName) {
    state.weapon.name = weaponName;
    state.weapon.level = 0;
  } else if (state.weapon.level < def.levels.length - 1) {
    state.weapon.level += 1;
  }
  state.lastShot = 0;
  updateWeapon(getWeaponLabel(state.weapon));
  playPow();
}

export function maybeDropWeaponToken(state, enemy) {
  ensureWeaponState(state);
  if (Math.random() > DROP_CHANCE) {
    return;
  }
  const weaponKeys = Object.keys(weaponDefs);
  const weapon = weaponKeys[Math.floor(Math.random() * weaponKeys.length)];
  state.weaponDrops.push({
    x: enemy.x,
    y: enemy.y,
    vy: 90,
    r: 14,
    weapon,
    spin: Math.random() * Math.PI,
    t: DROP_LIFETIME,
  });
}

export function updateWeaponDrops(state, dt, canvas) {
  ensureWeaponState(state);
  for (let i = state.weaponDrops.length - 1; i >= 0; i--) {
    const drop = state.weaponDrops[i];
    drop.y += drop.vy * dt;
    drop.spin = (drop.spin || 0) + dt * 2.4;
    drop.t -= dt * 1000;
    if (drop.t <= 0 || drop.y > canvas.height + 40) {
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
  const tokenPalette = palette?.weaponToken ?? {};
  for (const drop of drops) {
    const def = weaponDefs[drop.weapon];
    const fill = tokenPalette.fill || '#ff3df7';
    const stroke = tokenPalette.stroke || '#00e5ff';
    const glow = tokenPalette.glow || `${stroke}aa`;
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
    ctx.fillStyle = tokenPalette.text || stroke;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def ? def.label.charAt(0) : 'W', 0, 0);
    ctx.restore();
  }
}
