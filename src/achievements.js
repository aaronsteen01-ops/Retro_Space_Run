import { getMetaValue, updateStoredMeta } from './storage.js';

export const ACHIEVEMENTS = [
  {
    id: 'firstBlood',
    name: 'First Blood',
    description: 'Defeat your first enemy.',
    condition: (stats) => (stats.kills ?? 0) >= 1,
  },
  {
    id: 'bossSlayer',
    name: 'Boss Slayer',
    description: 'Defeat a sector boss.',
    condition: (stats) => (stats.bossesDefeated ?? 0) >= 1,
  },
  {
    id: 'noHitL1',
    name: 'Untouchable',
    description: 'Clear Level 1 without losing a life.',
    condition: (stats) => (stats.livesLost ?? 0) === 0 && (stats.level ?? '') === 'L1',
  },
  {
    id: 'million',
    name: 'Score Chaser',
    description: 'Reach a score of 100,000.',
    condition: (stats) => (stats.score ?? 0) >= 100000,
  },
];

function normaliseStats(stats = {}) {
  const safeNumber = (value) => {
    const numeric = Number.isFinite(value) ? value : Number.parseInt(value, 10);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  };
  return {
    kills: safeNumber(stats.kills),
    bossesDefeated: safeNumber(stats.bossesDefeated),
    livesLost: safeNumber(stats.livesLost),
    score: safeNumber(stats.score),
    level: typeof stats.level === 'string' ? stats.level : null,
  };
}

function readEarnedAchievements() {
  const stored = getMetaValue('achievements', []);
  if (!Array.isArray(stored)) {
    return new Set();
  }
  const cleaned = stored
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter((id) => id.length > 0);
  return new Set(cleaned);
}

function writeEarnedAchievements(ids) {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  updateStoredMeta({ achievements: unique });
  return new Set(unique);
}

export function getAchievementProgress() {
  const earned = readEarnedAchievements();
  return ACHIEVEMENTS.map((achievement) => ({
    id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    earned: earned.has(achievement.id),
  }));
}

export function evaluateAchievements(stats = {}) {
  const safeStats = normaliseStats(stats);
  const earned = readEarnedAchievements();
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach((achievement) => {
    if (earned.has(achievement.id)) {
      return;
    }
    let fulfilled = false;
    try {
      fulfilled = Boolean(achievement.condition?.(safeStats));
    } catch (error) {
      fulfilled = false;
    }
    if (fulfilled) {
      newlyUnlocked.push(achievement);
      earned.add(achievement.id);
    }
  });
  if (newlyUnlocked.length > 0) {
    writeEarnedAchievements(Array.from(earned));
  }
  return {
    unlocked: newlyUnlocked,
    earned: Array.from(earned),
  };
}

export function isAchievementUnlocked(id) {
  if (typeof id !== 'string' || !id.trim()) {
    return false;
  }
  const earned = readEarnedAchievements();
  return earned.has(id.trim());
}
