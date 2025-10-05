/**
 * levels.js — declarative level schedules and mechanics for Retro Space Run.
 */

const LEVEL1_DURATION = 90;
const LEVEL2_DURATION = 105;

function pushRepeatingWaves(target, { start, every, until, type, count, params }) {
  if (!Array.isArray(target) || !type || !Number.isFinite(every) || every <= 0) {
    return;
  }
  const begin = Math.max(0, Number(start ?? 0));
  const end = Math.max(begin, Number(until ?? begin));
  for (let t = begin; t < end; t += every) {
    target.push({
      at: Number(t.toFixed(3)),
      type,
      ...(Number.isFinite(count) ? { count } : {}),
      ...(params ? { params: { ...params } } : {}),
    });
  }
}

const level1Waves = [];

pushRepeatingWaves(level1Waves, {
  start: 0,
  every: 1.25,
  until: LEVEL1_DURATION,
  type: 'asteroid',
});

pushRepeatingWaves(level1Waves, {
  start: 0.8,
  every: 2.2,
  until: LEVEL1_DURATION - 6,
  type: 'strafer',
});

pushRepeatingWaves(level1Waves, {
  start: 1.2,
  every: 2.6,
  until: LEVEL1_DURATION - 8,
  type: 'drone',
});

pushRepeatingWaves(level1Waves, {
  start: 4,
  every: 7.5,
  until: LEVEL1_DURATION - 12,
  type: 'turret',
  params: { count: 1 },
});

level1Waves.push(
  { at: 18, type: 'drone', countRange: [3, 4], params: { vyMin: 70, vyMax: 110 } },
  { at: 32, type: 'strafer', params: { count: 3 } },
  { at: 46, type: 'asteroid', params: { countRange: [6, 8], vyMin: 90, vyMax: 150 } },
  { at: 58, type: 'turret', params: { count: 2, fireCdMin: 900, fireCdMax: 1400 } },
  { at: 72, type: 'drone', countRange: [4, 5], params: { steerAccel: 34 } },
);

level1Waves.sort((a, b) => a.at - b.at);

const level2Waves = [];

pushRepeatingWaves(level2Waves, {
  start: 0,
  every: 1.1,
  until: LEVEL2_DURATION - 10,
  type: 'asteroid',
  params: { vyMin: 110, vyMax: 170 },
});

pushRepeatingWaves(level2Waves, {
  start: 4.5,
  every: 2,
  until: LEVEL2_DURATION - 18,
  type: 'strafer',
  params: { fireCdMin: 820, fireCdMax: 1260 },
});

pushRepeatingWaves(level2Waves, {
  start: 7,
  every: 3.2,
  until: LEVEL2_DURATION - 15,
  type: 'turret',
  params: { count: 1, fireCdMin: 820, fireCdMax: 1320 },
});

pushRepeatingWaves(level2Waves, {
  start: 6.5,
  every: 2.6,
  until: LEVEL2_DURATION - 12,
  type: 'drone',
  params: { vyMin: 80, vyMax: 130, steerAccel: 44 },
});

level2Waves.push(
  { at: 14, type: 'turret', params: { count: 2, bulletSpeed: 220 } },
  { at: 22, type: 'drone', countRange: [4, 5], params: { steerAccel: 52 } },
  { at: 30, type: 'strafer', params: { count: 4, speedMin: 170, speedMax: 220 } },
  { at: 38, type: 'asteroid', params: { countRange: [7, 9], vxMin: -80, vxMax: 80 } },
  { at: 46, type: 'turret', params: { count: 3, fireCdMin: 740, fireCdMax: 1180 } },
  { at: 58, type: 'drone', countRange: [5, 6], params: { vyMin: 90, vyMax: 140, steerAccel: 54 } },
  { at: 70, type: 'strafer', params: { count: 4, fireCdMin: 780, fireCdMax: 1180 } },
  { at: 82, type: 'turret', params: { count: 2, bulletSpeed: 240, fireCdMin: 720, fireCdMax: 1080 } },
  { at: 92, type: 'drone', countRange: [6, 7], params: { steerAccel: 60, vyMin: 90, vyMax: 150 } },
);

level2Waves.sort((a, b) => a.at - b.at);

const level1Boss = {
  kind: 'standard',
  hp: 360,
  phases: [0.7, 0.4],
};

const level2Boss = {
  kind: 'standard',
  hp: 440,
  phases: [0.75, 0.45],
};

export const LEVELS = [
  {
    id: 'l1',
    name: 'Asteroid Run',
    duration: LEVEL1_DURATION,
    theme: 'synth-horizon',
    modifiers: {
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
      enemyWeights: {
        asteroid: 1,
        drone: 1,
        strafer: 1,
        turret: 1,
      },
    },
    mechanics: {},
    mutators: ['Calm Drift'],
    visuals: {
      overlay: { colour: '#04071c', alpha: 0.26 },
      starfield: {
        density: 0.95,
        sizeRange: [1.3, 2.2],
        twinkle: { amplitude: 0.18, speed: 1.05 },
        baseAlpha: 0.38,
        brightBoost: 1.32,
      },
    },
    waves: level1Waves,
    boss: level1Boss,
    powerups: { intervalMs: 9000 },
  },
  {
    id: 'l2',
    name: 'Tempest Drift',
    duration: LEVEL2_DURATION,
    theme: 'luminous-depths',
    modifiers: {
      spawn: {
        asteroid: { density: 0.85, countRange: [6, 8], vyMin: 110, vyMax: 180 },
        drone: { density: 1.2, count: 3, steerAccel: 46, vyMin: 80, vyMax: 140 },
        strafer: {
          density: 1.15,
          count: 3,
          fireCdMin: 780,
          fireCdMax: 1320,
          speedMin: 160,
          speedMax: 220,
          yMin: 0.25,
          yMax: 0.6,
        },
        turret: {
          density: 1.25,
          count: 2,
          fireCdMin: 760,
          fireCdMax: 1260,
          bulletSpeed: 220,
          vyMin: 90,
          vyMax: 140,
        },
      },
      enemyWeights: {
        asteroid: 0.95,
        drone: 1.25,
        strafer: 1.3,
        turret: 1.35,
      },
    },
    mechanics: {
      windX: 36,
      squallBursts: {
        interval: [10, 14],
        duration: 1.2,
        playerSpread: 90,
        enemySpread: 18,
        dimFactor: 0.45,
      },
    },
    mutators: ['Ion Squalls', 'Wind →'],
    visuals: {
      overlay: { colour: '#02121f', alpha: 0.34 },
      starfield: {
        density: 1.35,
        sizeRange: [1.6, 3],
        twinkle: { amplitude: 0.36, speed: 1.65 },
        baseAlpha: 0.48,
        brightThreshold: 1.22,
        brightBoost: 1.65,
        windFactor: 0.055,
        scrollSpeed: 74,
        scrollSpeedFactor: 0.065,
      },
    },
    waves: level2Waves,
    boss: level2Boss,
    powerups: { intervalMs: 8400 },
  },
];
