/**
 * ships.js — launch configuration definitions and helpers for ship selection.
 */

export const SHIP_CATALOGUE = [
  {
    key: 'pioneer',
    name: 'Pioneer',
    role: 'Frontline Fighter',
    description: 'Balanced thrusters and standard cannons. Reliable in any sector.',
    speed: 260,
    fireRate: 1,
    shield: 0,
    spread: 1,
    difficulty: 'Balanced',
    unlock: { type: 'default' },
  },
  {
    key: 'vanguard',
    name: 'Vanguard',
    role: 'Strike Interceptor',
    description: 'Precision-tuned engines and focused cannons for daring pilots.',
    speed: 300,
    fireRate: 0.85,
    shield: 0,
    spread: 0.75,
    difficulty: 'Advanced',
    unlock: { type: 'bosses', count: 3, description: 'Defeat 3 bosses in any runs.' },
  },
  {
    key: 'nova',
    name: 'Nova',
    role: 'Scatter Gunship',
    description: 'Reinforced shield plating and wide plasma arrays that saturate space.',
    speed: 240,
    fireRate: 1.1,
    shield: 3,
    spread: 1.35,
    difficulty: 'Tactical',
    unlock: { type: 'score', score: 50000, description: 'Bank 50,000 total score across runs.' },
  },
];

export function getShipByKey(key) {
  return SHIP_CATALOGUE.find((ship) => ship.key === key) ?? null;
}

export function getDefaultShipKey() {
  return SHIP_CATALOGUE[0]?.key ?? 'pioneer';
}

export function getShipDisplayStats(ship) {
  if (!ship) {
    return [];
  }
  const stats = [];
  const speedDelta = ship.speed - 260;
  const speedLabel = speedDelta === 0
    ? 'Standard'
    : speedDelta > 0
      ? `+${Math.round((speedDelta / 260) * 100)}%`
      : `${Math.round((speedDelta / 260) * 100)}%`;
  stats.push({ label: 'Speed', value: speedLabel });
  const fireDelta = ship.fireRate - 1;
  const fireLabel = fireDelta === 0
    ? 'Standard'
    : fireDelta < 0
      ? `+${Math.round(Math.abs(fireDelta) * 100)}%`
      : `-${Math.round(Math.abs(fireDelta) * 100)}%`;
  stats.push({ label: 'Fire Rate', value: fireLabel });
  const shieldLabel = ship.shield > 0 ? 'Reinforced' : 'None';
  stats.push({ label: 'Shield', value: shieldLabel });
  return stats;
}

export function getShipRequirement(ship) {
  if (!ship || !ship.unlock || ship.unlock.type === 'default') {
    return null;
  }
  if (typeof ship.unlock.description === 'string') {
    return ship.unlock.description;
  }
  if (ship.unlock.type === 'bosses') {
    return `Defeat ${ship.unlock.count ?? 0} bosses to unlock.`;
  }
  if (ship.unlock.type === 'score') {
    return `Accumulate ${ship.unlock.score ?? 0} total score.`;
  }
  return null;
}
