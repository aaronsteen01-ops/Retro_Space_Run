export const STORY_BEATS = [
  {
    levelKey: 'L1',
    phase: 'intro',
    title: 'Debris Drift Briefing',
    textLines: [
      'Scavenger beacons flicker through shattered hulls.',
      'Keep the escort lane clear as you sweep the wreck-line.',
    ],
  },
  {
    levelKey: 'L1',
    phase: 'outro',
    title: 'Drift Secured',
    textLines: [
      'Beacon sweep reports no hostile pings remaining.',
      'Convoy engines spin up to cruise velocity.',
    ],
  },
  {
    levelKey: 'L2',
    phase: 'intro',
    title: 'Ion Squalls Run',
    textLines: [
      'Static storms shear the escort corridor tonight.',
      'Ride the squalls and hold formation around the freighters.',
    ],
  },
  {
    levelKey: 'L2',
    phase: 'outro',
    title: 'Squalls Cleared',
    textLines: [
      'The Warden’s core implodes… telemetry stable.',
      'Relay ships merge back into the lane under your cover.',
    ],
  },
  {
    levelKey: 'L3',
    phase: 'intro',
    title: 'Ember Breaker Push',
    textLines: [
      'Forge furnaces ignite the void lanes at random.',
      'Disarm the breakers before the route melts shut.',
    ],
  },
  {
    levelKey: 'L3',
    phase: 'outro',
    title: 'Breaker Silent',
    textLines: [
      'Overdrive heart cools to slag; transit lanes reopen.',
      'Fleet charts mark the sector safe for convoy passage.',
    ],
  },
  {
    levelKey: 'L4',
    phase: 'intro',
    title: 'Cosmic Abyss Briefing',
    textLines: [
      'Bio-luminescent drifters weave between the gate pylons.',
      'Disrupt their shield web and reopen the abyssal corridor.',
    ],
  },
  {
    levelKey: 'L4',
    phase: 'outro',
    title: 'Abyss Secured',
    textLines: [
      'Shield drones scatter as the abyssal core collapses.',
      'Convoy routes chart a new passage through the nebula trench.',
    ],
  },
];

export function getStoryBeat(levelKey, phase) {
  if (!levelKey || !phase) {
    return null;
  }
  const key = `${levelKey}`.toUpperCase();
  const phaseKey = `${phase}`.toLowerCase();
  return (
    STORY_BEATS.find(
      (beat) => beat.levelKey === key && (beat.phase ?? '').toLowerCase() === phaseKey,
    ) ?? null
  );
}
