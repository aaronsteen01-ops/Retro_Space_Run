export const LEVELS = [
  {
    key: 'L1',
    name: 'Debris Drift',
    duration: 90,
    theme: 'synth-horizon',
    overlays: { tint: 'rgba(0,0,0,0.0)' },
    enemyWeights: { asteroid: 1.0, strafer: 0.8, drone: 0.4, turret: 0.4 },
    waves: [
      { at: 3.0, type: 'asteroid', count: 6, params: { vy: [60, 120] } },
      { at: 8.5, type: 'strafer', count: 2, params: { fireCd: [1200, 1800] } },
      { at: 20.0, type: 'drone', count: 1, params: { steerAccel: 28 } },
    ],
    boss: { kind: 'overlord', hp: 360, phases: [0.7, 0.4] },
    mutators: { windX: 0, squalls: false },
  },
  {
    key: 'L2',
    name: 'Ion Squalls',
    duration: 105,
    theme: 'luminous-depths',
    overlays: { tint: 'rgba(80,0,120,0.06)' },
    enemyWeights: { asteroid: 0.6, strafer: 0.5, drone: 1.1, turret: 0.3 },
    waves: [
      { at: 4.0, type: 'drone', count: 2, params: { steerAccel: 32 } },
      { at: 12.0, type: 'asteroid', count: 5, params: { vy: [70, 120] } },
      { at: 24.0, type: 'strafer', count: 1, params: { fireCd: [1200, 1600] } },
    ],
    boss: { kind: 'warden', hp: 440, phases: [0.8, 0.5] },
    mutators: { windX: 25, squalls: true },
  },
];
