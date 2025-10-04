/**
 * levels.js — declarative wave schedules for Retro Space Run.
 */

const LEVEL1_DURATION = 90;
const level1Waves = [];

const pushRepeatingWaves = (waves, { start, every, duration, type, count, params }) => {
  for (let t = start; t < duration; t += every) {
    waves.push({
      at: Number(t.toFixed(3)),
      type,
      ...(count !== undefined ? { count } : {}),
      ...(params ? { params } : {}),
    });
  }
};

pushRepeatingWaves(level1Waves, {
  start: 0,
  every: 1.2,
  duration: LEVEL1_DURATION,
  type: 'asteroid',
});

pushRepeatingWaves(level1Waves, {
  start: 0.6,
  every: 2,
  duration: LEVEL1_DURATION,
  type: 'strafer',
});

pushRepeatingWaves(level1Waves, {
  start: 0.9,
  every: 2.2,
  duration: LEVEL1_DURATION,
  type: 'drone',
});

pushRepeatingWaves(level1Waves, {
  start: 1.3,
  every: 2.6,
  duration: LEVEL1_DURATION,
  type: 'turret',
});

level1Waves.sort((a, b) => a.at - b.at);

const level1Boss = {
  kind: 'standard',
  hp: 360,
  phases: [0.7, 0.4],
};

export const LEVELS = [
  {
    name: 'Asteroid Run',
    duration: LEVEL1_DURATION,
    waves: level1Waves,
    boss: level1Boss,
  },
];
