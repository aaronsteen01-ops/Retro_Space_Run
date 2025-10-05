const MAX_BULLET_AGE_MS = 3000;

const bulletPool = [];

function resetBullet(bullet) {
  bullet.x = 0;
  bullet.y = 0;
  bullet.vx = 0;
  bullet.vy = 0;
  bullet.r = 0;
  bullet.damage = 0;
  bullet.colour = null;
  bullet.bornAt = 0;
  bullet.updatedAt = 0;
  bullet.w = 0;
  bullet.h = 0;
  bullet.level = 0;
  bullet.maxAge = undefined;
  bullet.owner = null;
  return bullet;
}

export function getBullet() {
  const bullet = bulletPool.pop() ?? {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 0,
    damage: 0,
    colour: null,
    bornAt: 0,
    updatedAt: 0,
    w: 0,
    h: 0,
    level: 0,
    maxAge: undefined,
    owner: null,
  };
  return bullet;
}

export function freeBullet(bullet) {
  if (!bullet) {
    return;
  }
  resetBullet(bullet);
  bulletPool.push(bullet);
}

export function updateBullets(bullets, now, bounds, { windX = 0 } = {}) {
  if (!Array.isArray(bullets) || !bullets.length) {
    return;
  }
  const { minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity } = bounds ?? {};
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const lastUpdate = bullet.updatedAt ?? now;
    const dt = Math.max(0, (now - lastUpdate) / 1000);
    if (dt > 0) {
      const drift = Number.isFinite(windX) ? windX : 0;
      bullet.x += (bullet.vx ?? 0) * dt + drift * dt;
      bullet.y += (bullet.vy ?? 0) * dt;
    }
    bullet.updatedAt = now;
    const age = now - (bullet.bornAt ?? now);
    const maxAge = bullet.maxAge ?? MAX_BULLET_AGE_MS;
    if (
      bullet.x < minX ||
      bullet.x > maxX ||
      bullet.y < minY ||
      bullet.y > maxY ||
      age > maxAge
    ) {
      bullets.splice(i, 1);
      freeBullet(bullet);
    }
  }
}

export function drainBullets(bullets) {
  if (!Array.isArray(bullets) || !bullets.length) {
    return;
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    freeBullet(bullets[i]);
  }
  bullets.length = 0;
}

export { MAX_BULLET_AGE_MS };
