/**
 * themes.js — colour palette definitions for Retro Space Run themes.
 */

export const DEFAULT_THEME_KEY = 'synth-horizon';

export const THEMES = {
  'synth-horizon': {
    label: 'Synth Horizon',
    palette: {
      background: {
        gradient:
          'radial-gradient(1200px 800px at 50% 20%, #0c0f2a 0%, #060712 60%, #03040b 100%)',
        base: '#060712',
      },
      hud: {
        text: '#e7faff',
        shadow: '#00e5ff88',
        panel: '#0a0d1acc',
        accent: '#ff3df7',
        secondary: '#00e5ff',
      },
      ship: {
        primary: '#0ae6ff',
        trim: '#ff3df7',
        cockpit: '#1efcff',
        glow: '#00e5ff88',
        trailStart: '#00e5ffcc',
        trailEnd: '#ff3df700',
        shieldInner: '#00e5ff55',
        shieldOuter: '#00e5ff00',
      },
      gate: {
        glow: '#00e5ffaa',
        fill: '#00e5ff',
        trim: '#ff3df7',
        strut: '#ff3df7',
      },
      stars: {
        bright: '#00e5ff',
        dim: '#ff3df7',
      },
      particles: {
        shieldHit: '#00e5ff',
        playerHit: '#ff3df7',
        enemyHitDefault: '#00e5ff',
        enemyHitStrafer: '#ff3df7',
        bossHit: '#ff3df7',
        bossCore: '#00e5ff',
      },
      enemies: {
        asteroidFill: '#11293b',
        asteroidStroke: '#00e5ff66',
        asteroidGlow: '#00e5ff55',
        straferFill: '#2e003b',
        straferStroke: '#ff3df7',
        straferGlow: '#ff3df799',
        droneGlowInner: '#00e5ff88',
        droneGlowOuter: '#00e5ff00',
        droneCore: '#00e5ff',
        turretFill: '#091a2c',
        turretStroke: '#00e5ff',
        turretGlow: '#00e5ff88',
        turretBarrel: '#ff3df7',
      },
      boss: {
        shadowPhase1: '#ff3df7aa',
        shadowPhase2: '#ff9dfd',
        bodyFill: '#1a0524',
        strokePhase1: '#ff3df7',
        strokePhase2: '#ffb5ff',
        canopy: '#ffdbff',
        coreGlow: '#ff3df7aa',
        coreOuter: '#ff3df700',
        beam: '#0ae6ff',
        trim: '#00e5ff',
        phase2Trim: '#ff3df7',
        introText: '#ff3df7',
        introGlow: '#ff3df788',
        healthBackground: '#060712cc',
        healthFill: '#ff3df7',
        healthShadow: '#ff3df799',
        healthStroke: '#00e5ffaa',
        healthText: '#e7faff',
      },
      bullets: {
        playerLevels: ['#ffb8ff', '#ffd6ff', '#ffeeff'],
        enemyGlow: '#00e5ffaa',
        enemyFill: '#8af5ff',
      },
      weaponToken: {
        fill: '#ff3df7',
        stroke: '#00e5ff',
        glow: '#00e5ffaa',
        text: '#00e5ff',
      },
      powerups: {
        glow: '#ffffff',
        shield: '#00e5ff',
        rapid: '#ff3df7',
        boost: '#ffffff',
      },
    },
  },
  'luminous-depths': {
    label: 'Luminous Depths',
    palette: {
      background: {
        gradient:
          'radial-gradient(1200px 800px at 50% 20%, #041625 0%, #010910 60%, #000407 100%)',
        base: '#010910',
      },
      hud: {
        text: '#d9faff',
        shadow: '#24f5d988',
        panel: '#03141fcc',
        accent: '#24f5d9',
        secondary: '#1680ff',
      },
      ship: {
        primary: '#24f5d9',
        trim: '#1680ff',
        cockpit: '#9df5ff',
        glow: '#2df5d988',
        trailStart: '#24f5d9cc',
        trailEnd: '#1680ff00',
        shieldInner: '#24f5d955',
        shieldOuter: '#1680ff00',
      },
      gate: {
        glow: '#24f5d9aa',
        fill: '#24f5d9',
        trim: '#1680ff',
        strut: '#1680ff',
      },
      stars: {
        bright: '#24f5d9',
        dim: '#1680ff',
      },
      particles: {
        shieldHit: '#24f5d9',
        playerHit: '#1680ff',
        enemyHitDefault: '#24f5d9',
        enemyHitStrafer: '#1680ff',
        bossHit: '#1680ff',
        bossCore: '#24f5d9',
      },
      enemies: {
        asteroidFill: '#082839',
        asteroidStroke: '#1db0ff66',
        asteroidGlow: '#24f5d955',
        straferFill: '#021732',
        straferStroke: '#1680ff',
        straferGlow: '#1680ff99',
        droneGlowInner: '#24f5d988',
        droneGlowOuter: '#1680ff00',
        droneCore: '#24f5d9',
        turretFill: '#031e30',
        turretStroke: '#24f5d9',
        turretGlow: '#24f5d988',
        turretBarrel: '#1680ff',
      },
      boss: {
        shadowPhase1: '#1680ffaa',
        shadowPhase2: '#51c5ff',
        bodyFill: '#021524',
        strokePhase1: '#1680ff',
        strokePhase2: '#6ad5ff',
        canopy: '#c5f1ff',
        coreGlow: '#24f5d9aa',
        coreOuter: '#1680ff00',
        beam: '#24f5d9',
        trim: '#24f5d9',
        phase2Trim: '#1680ff',
        introText: '#24f5d9',
        introGlow: '#24f5d988',
        healthBackground: '#02141dcc',
        healthFill: '#1680ff',
        healthShadow: '#1680ff99',
        healthStroke: '#24f5d9aa',
        healthText: '#d9faff',
      },
      bullets: {
        playerLevels: ['#a5f6ff', '#c2fbff', '#e2ffff'],
        enemyGlow: '#24f5d9aa',
        enemyFill: '#9df5ff',
      },
      weaponToken: {
        fill: '#1680ff',
        stroke: '#24f5d9',
        glow: '#24f5d9aa',
        text: '#24f5d9',
      },
      powerups: {
        glow: '#f4ffff',
        shield: '#24f5d9',
        rapid: '#1680ff',
        boost: '#f4ffff',
      },
    },
  },
  'ember-overdrive': {
    label: 'Ember Overdrive',
    palette: {
      background: {
        gradient:
          'radial-gradient(1200px 800px at 50% 20%, #2b0b00 0%, #120302 60%, #070101 100%)',
        base: '#120302',
      },
      hud: {
        text: '#ffeada',
        shadow: '#ff7b3988',
        panel: '#200804cc',
        accent: '#ff7b39',
        secondary: '#ffbd2d',
      },
      ship: {
        primary: '#ff7b39',
        trim: '#ffbd2d',
        cockpit: '#ffd9a6',
        glow: '#ff7b3988',
        trailStart: '#ff7b39cc',
        trailEnd: '#ffbd2d00',
        shieldInner: '#ff7b3955',
        shieldOuter: '#ffbd2d00',
      },
      gate: {
        glow: '#ff7b39aa',
        fill: '#ff7b39',
        trim: '#ffbd2d',
        strut: '#ffbd2d',
      },
      stars: {
        bright: '#ffbd2d',
        dim: '#ff7b39',
      },
      particles: {
        shieldHit: '#ffbd2d',
        playerHit: '#ff7b39',
        enemyHitDefault: '#ffbd2d',
        enemyHitStrafer: '#ff7b39',
        bossHit: '#ff7b39',
        bossCore: '#ffbd2d',
      },
      enemies: {
        asteroidFill: '#2f1208',
        asteroidStroke: '#ff9b3666',
        asteroidGlow: '#ff7b3955',
        straferFill: '#2b0500',
        straferStroke: '#ff7b39',
        straferGlow: '#ff7b3999',
        droneGlowInner: '#ffbd2d88',
        droneGlowOuter: '#ff7b3900',
        droneCore: '#ffbd2d',
        turretFill: '#2a0b05',
        turretStroke: '#ffbd2d',
        turretGlow: '#ffbd2d88',
        turretBarrel: '#ff7b39',
      },
      boss: {
        shadowPhase1: '#ff7b39aa',
        shadowPhase2: '#ffb37a',
        bodyFill: '#2a0400',
        strokePhase1: '#ff7b39',
        strokePhase2: '#ffbd2d',
        canopy: '#ffe6c6',
        coreGlow: '#ff7b39aa',
        coreOuter: '#ffbd2d00',
        beam: '#ffbd2d',
        trim: '#ffbd2d',
        phase2Trim: '#ff7b39',
        introText: '#ff7b39',
        introGlow: '#ff7b3988',
        healthBackground: '#1a0502cc',
        healthFill: '#ff7b39',
        healthShadow: '#ff7b3999',
        healthStroke: '#ffbd2daa',
        healthText: '#ffeada',
      },
      bullets: {
        playerLevels: ['#ffd9a6', '#ffe7c0', '#fff4da'],
        enemyGlow: '#ffbd2daa',
        enemyFill: '#ffd18c',
      },
      weaponToken: {
        fill: '#ff7b39',
        stroke: '#ffbd2d',
        glow: '#ff7b39aa',
        text: '#ffbd2d',
      },
      powerups: {
        glow: '#fff1e3',
        shield: '#ffbd2d',
        rapid: '#ff7b39',
        boost: '#fff1e3',
      },
    },
  },
};

export function getThemeKeys() {
  return Object.keys(THEMES);
}

export function getThemeLabel(key) {
  return THEMES[key]?.label ?? key;
}

export function getThemePalette(key) {
  return THEMES[key]?.palette ?? THEMES[DEFAULT_THEME_KEY].palette;
}
