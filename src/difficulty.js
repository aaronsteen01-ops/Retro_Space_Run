/**
 * difficulty.js — configuration for level tuning.
 */
export const DIFFICULTY = {
  l1: {
    asteroid: { intervalMs: 1200, vyMin: 60, vyMax: 130 },
    strafer: { count: 2, fireCdMsMin: 900, fireCdMsMax: 1400 },
    drone: { steerAccel: 38 },
    turret: { bulletSpeed: 170 },
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
