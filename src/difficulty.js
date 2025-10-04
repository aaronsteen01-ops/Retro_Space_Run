/**
 * difficulty.js — configuration for level tuning.
 */
export const DIFFICULTY = {
  l1: {
    spawn: {
      asteroid: { every: 1200, offset: 0, vyMin: 60, vyMax: 130 },
      drone: { every: 2200, offset: 900, steerAccel: 28 },
      strafer: { every: 2000, offset: 600, count: 2, fireCdMin: 1200, fireCdMax: 1800 },
      turret: { every: 2600, offset: 1300, fireCdMin: 1200, fireCdMax: 1600, bulletSpeed: 140 },
    },
    powerupEvery: 9000,
    powerupIntervalMs: 9000,
    bossHp: 360,
  },
  // l2, l3... later
};

export function getDifficulty(levelIndex) {
  if (levelIndex === 1) {
    return DIFFICULTY.l1;
  }
  return null;
}
