/**
 * difficulty.js — configuration for level tuning.
 */
export const DIFFICULTY = {
  l1: {
    spawn: {
      asteroid: { density: 1, countRange: [5, 7], vyMin: 60, vyMax: 130 },
      drone: { density: 1, count: 2, steerAccel: 28, vyMin: 60, vyMax: 100 },
      strafer: {
        density: 1,
        count: 2,
        fireCdMin: 1200,
        fireCdMax: 1800,
        speedMin: 120,
        speedMax: 180,
        yMin: 60,
        yMax: 0.5,
      },
      turret: {
        density: 1,
        count: 2,
        fireCdMin: 1200,
        fireCdMax: 1600,
        bulletSpeed: 140,
        vyMin: 70,
        vyMax: 110,
      },
    },
    powerupIntervalMs: 9000,
    bossHp: 360,
  },
  l2: {
    spawn: {
      asteroid: { density: 0.9, countRange: [6, 8], vyMin: 100, vyMax: 180 },
      drone: { density: 1.2, count: 3, steerAccel: 46, vyMin: 80, vyMax: 130 },
      strafer: {
        density: 1.2,
        count: 3,
        fireCdMin: 820,
        fireCdMax: 1320,
        speedMin: 150,
        speedMax: 220,
        yMin: 0.25,
        yMax: 0.6,
      },
      turret: {
        density: 1.25,
        count: 2,
        fireCdMin: 780,
        fireCdMax: 1260,
        bulletSpeed: 210,
        vyMin: 90,
        vyMax: 140,
      },
    },
    powerupIntervalMs: 8400,
    bossHp: 420,
  },
};

export function getDifficulty(levelIndex) {
  if (levelIndex === 1) {
    return DIFFICULTY.l1;
  }
  if (levelIndex === 2) {
    return DIFFICULTY.l2;
  }
  return DIFFICULTY.l2 ?? DIFFICULTY.l1;
}
