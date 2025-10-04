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
  // l2, l3... later
};

export function getDifficulty(levelIndex) {
  if (levelIndex === 1) {
    return DIFFICULTY.l1;
  }
  return null;
}
