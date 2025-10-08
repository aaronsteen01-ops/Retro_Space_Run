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
      weather: {
        squall: {
          top: 'rgba(0, 229, 255, 0)',
          mid: 'rgba(0, 229, 255, 0.35)',
          bottom: 'rgba(255, 61, 247, 0.18)',
          band: 'rgba(0, 229, 255, 0.5)',
          gradientBase: 0.12,
          gradientPulse: 0.25,
          bandAlpha: 0.18,
          bandPulse: 0.2,
        },
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
        splitterFill: '#0c1230',
        splitterStroke: '#ff3df7',
        splitterGlow: '#ff3df788',
        splitterCore: '#00e5ff',
        shieldDroneFill: '#07152c',
        shieldDroneTrim: '#00e5ff',
        shieldDroneGlow: '#00e5ff99',
        shieldDroneInner: '#ff3df7',
        shieldBubbleInner: 'rgba(0, 229, 255, 0.22)',
        shieldBubbleOuter: 'rgba(255, 61, 247, 0.08)',
        shieldBubbleRim: 'rgba(0, 229, 255, 0.6)',
      },
      boss: {
        shadowPhase1: '#ff3df7aa',
        shadowPhase2: '#ff9dfd',
        shadowPhase3: '#ffe55c',
        bodyFill: '#1a0524',
        strokePhase1: '#ff3df7',
        strokePhase2: '#ffb5ff',
        strokePhase3: '#ffe066',
        canopy: '#ffdbff',
        canopyPhase2: '#ffdbff',
        canopyPhase3: '#fff4b8',
        coreGlow: '#ff3df7aa',
        coreOuter: '#ff3df700',
        beam: '#0ae6ff',
        trim: '#00e5ff',
        phase2Trim: '#ff3df7',
        phase3Trim: '#ffe066',
        phaseShiftGlow: '#fff6a6',
        strokePhaseShift: '#fff6a6',
        phaseShiftTrim: '#ffe066',
        phaseShiftOuter: '#fff6a600',
        warningBackdrop: 'rgba(255, 61, 247, 0.16)',
        warningFill: 'rgba(255, 245, 160, 0.9)',
        warningStroke: 'rgba(255, 61, 247, 0.85)',
        warningGlow: '#ff3df7',
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
        highlight: '#ffeeff',
        muzzleCore: '#ff3df7',
        muzzleEdge: '#00e5ff',
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
      weather: {
        squall: {
          top: 'rgba(36, 245, 217, 0)',
          mid: 'rgba(22, 128, 255, 0.32)',
          bottom: 'rgba(19, 116, 210, 0.16)',
          band: 'rgba(36, 245, 217, 0.48)',
          gradientBase: 0.16,
          gradientPulse: 0.24,
          bandAlpha: 0.22,
          bandPulse: 0.24,
        },
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
        splitterFill: '#08243a',
        splitterStroke: '#1680ff',
        splitterGlow: '#24f5d988',
        splitterCore: '#24f5d9',
        shieldDroneFill: '#031b2e',
        shieldDroneTrim: '#24f5d9',
        shieldDroneGlow: '#24f5d988',
        shieldDroneInner: '#1680ff',
        shieldBubbleInner: 'rgba(36, 245, 217, 0.22)',
        shieldBubbleOuter: 'rgba(22, 128, 255, 0.08)',
        shieldBubbleRim: 'rgba(36, 245, 217, 0.55)',
      },
      boss: {
        shadowPhase1: '#1680ffaa',
        shadowPhase2: '#51c5ff',
        shadowPhase3: '#9bf0ff',
        bodyFill: '#021524',
        strokePhase1: '#1680ff',
        strokePhase2: '#6ad5ff',
        strokePhase3: '#c6f6ff',
        canopy: '#c5f1ff',
        canopyPhase2: '#c5f1ff',
        canopyPhase3: '#f0fdff',
        coreGlow: '#24f5d9aa',
        coreOuter: '#1680ff00',
        beam: '#24f5d9',
        trim: '#24f5d9',
        phase2Trim: '#1680ff',
        phase3Trim: '#9bf0ff',
        phaseShiftGlow: '#bffbff',
        strokePhaseShift: '#bffbff',
        phaseShiftTrim: '#9bf0ff',
        phaseShiftOuter: '#bffbff00',
        warningBackdrop: 'rgba(36, 245, 217, 0.14)',
        warningFill: 'rgba(201, 255, 255, 0.92)',
        warningStroke: 'rgba(22, 128, 255, 0.8)',
        warningGlow: '#24f5d9',
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
        highlight: '#e2ffff',
        muzzleCore: '#24f5d9',
        muzzleEdge: '#c2fbff',
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
      weather: {
        squall: {
          top: 'rgba(255, 123, 57, 0)',
          mid: 'rgba(255, 189, 45, 0.32)',
          bottom: 'rgba(255, 123, 57, 0.18)',
          band: 'rgba(255, 189, 45, 0.5)',
          gradientBase: 0.18,
          gradientPulse: 0.26,
          bandAlpha: 0.24,
          bandPulse: 0.24,
        },
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
        splitterFill: '#2a0d05',
        splitterStroke: '#ff7b39',
        splitterGlow: '#ff7b3988',
        splitterCore: '#ffbd2d',
        shieldDroneFill: '#200805',
        shieldDroneTrim: '#ffbd2d',
        shieldDroneGlow: '#ffbd2d88',
        shieldDroneInner: '#ff7b39',
        shieldBubbleInner: 'rgba(255, 189, 45, 0.24)',
        shieldBubbleOuter: 'rgba(255, 123, 57, 0.1)',
        shieldBubbleRim: 'rgba(255, 189, 45, 0.55)',
      },
      boss: {
        shadowPhase1: '#ff7b39aa',
        shadowPhase2: '#ffb37a',
        shadowPhase3: '#ffe47a',
        bodyFill: '#2a0400',
        strokePhase1: '#ff7b39',
        strokePhase2: '#ffbd2d',
        strokePhase3: '#ffe47a',
        canopy: '#ffe6c6',
        canopyPhase2: '#ffe6c6',
        canopyPhase3: '#fff3d2',
        coreGlow: '#ff7b39aa',
        coreOuter: '#ffbd2d00',
        beam: '#ffbd2d',
        trim: '#ffbd2d',
        phase2Trim: '#ff7b39',
        phase3Trim: '#ffe47a',
        phaseShiftGlow: '#ffeaa0',
        strokePhaseShift: '#ffeaa0',
        phaseShiftTrim: '#ffe47a',
        phaseShiftOuter: '#ffeaa000',
        warningBackdrop: 'rgba(255, 123, 57, 0.16)',
        warningFill: 'rgba(255, 228, 122, 0.92)',
        warningStroke: 'rgba(255, 189, 45, 0.82)',
        warningGlow: '#ff7b39',
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
        highlight: '#fff4da',
        muzzleCore: '#ff7b39',
        muzzleEdge: '#ffe47a',
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
  'neon-void': {
    label: 'Neon Void',
    palette: {
      background: {
        gradient:
          'radial-gradient(1200px 800px at 50% 20%, #1b0130 0%, #0a0019 60%, #030008 100%)',
        base: '#0a0019',
      },
      hud: {
        text: '#f1eaff',
        shadow: '#6dff8d88',
        panel: '#130021cc',
        accent: '#c43dff',
        secondary: '#6dff8d',
      },
      ship: {
        primary: '#c43dff',
        trim: '#6dff8d',
        cockpit: '#f6d6ff',
        glow: '#c43dff88',
        trailStart: '#c43dffcc',
        trailEnd: '#6dff8d00',
        shieldInner: '#6dff8d55',
        shieldOuter: '#c43dff00',
      },
      gate: {
        glow: '#6dff8daa',
        fill: '#6dff8d',
        trim: '#c43dff',
        strut: '#c43dff',
      },
      stars: {
        bright: '#6dff8d',
        dim: '#c43dff',
      },
      weather: {
        squall: {
          top: 'rgba(196, 61, 255, 0)',
          mid: 'rgba(109, 255, 141, 0.32)',
          bottom: 'rgba(196, 61, 255, 0.18)',
          band: 'rgba(109, 255, 141, 0.5)',
          gradientBase: 0.14,
          gradientPulse: 0.24,
          bandAlpha: 0.2,
          bandPulse: 0.22,
        },
      },
      particles: {
        shieldHit: '#6dff8d',
        playerHit: '#c43dff',
        enemyHitDefault: '#6dff8d',
        enemyHitStrafer: '#c43dff',
        bossHit: '#c43dff',
        bossCore: '#6dff8d',
      },
      enemies: {
        asteroidFill: '#201334',
        asteroidStroke: '#6dff8d66',
        asteroidGlow: '#6dff8d55',
        straferFill: '#1a022f',
        straferStroke: '#c43dff',
        straferGlow: '#c43dff99',
        droneGlowInner: '#6dff8d88',
        droneGlowOuter: '#c43dff00',
        droneCore: '#6dff8d',
        turretFill: '#150423',
        turretStroke: '#6dff8d',
        turretGlow: '#6dff8d88',
        turretBarrel: '#c43dff',
        splitterFill: '#18072c',
        splitterStroke: '#c43dff',
        splitterGlow: '#c43dff88',
        splitterCore: '#6dff8d',
        shieldDroneFill: '#110426',
        shieldDroneTrim: '#6dff8d',
        shieldDroneGlow: '#6dff8d88',
        shieldDroneInner: '#c43dff',
        shieldBubbleInner: 'rgba(109, 255, 141, 0.24)',
        shieldBubbleOuter: 'rgba(196, 61, 255, 0.08)',
        shieldBubbleRim: 'rgba(109, 255, 141, 0.52)',
      },
      boss: {
        shadowPhase1: '#c43dffaa',
        shadowPhase2: '#de8bff',
        shadowPhase3: '#e4ff71',
        bodyFill: '#1b0327',
        strokePhase1: '#c43dff',
        strokePhase2: '#6dff8d',
        strokePhase3: '#e4ff71',
        canopy: '#f9d4ff',
        canopyPhase2: '#e9ffe1',
        canopyPhase3: '#faffdb',
        coreGlow: '#c43dffaa',
        coreOuter: '#6dff8d00',
        beam: '#6dff8d',
        trim: '#6dff8d',
        phase2Trim: '#c43dff',
        phase3Trim: '#e4ff71',
        phaseShiftGlow: '#e7ff8a',
        strokePhaseShift: '#e7ff8a',
        phaseShiftTrim: '#e4ff71',
        phaseShiftOuter: '#e7ff8a00',
        warningBackdrop: 'rgba(196, 61, 255, 0.16)',
        warningFill: 'rgba(232, 255, 139, 0.92)',
        warningStroke: 'rgba(109, 255, 141, 0.85)',
        warningGlow: '#c43dff',
        introText: '#c43dff',
        introGlow: '#c43dff88',
        healthBackground: '#12001bcc',
        healthFill: '#c43dff',
        healthShadow: '#c43dff99',
        healthStroke: '#6dff8daa',
        healthText: '#f1eaff',
      },
      bullets: {
        playerLevels: ['#f3b7ff', '#d7ffed', '#f4ffe1'],
        enemyGlow: '#6dff8daa',
        enemyFill: '#b6ffd0',
        highlight: '#f4ffe1',
        muzzleCore: '#c43dff',
        muzzleEdge: '#d7ffed',
      },
      weaponToken: {
        fill: '#c43dff',
        stroke: '#6dff8d',
        glow: '#c43dffaa',
        text: '#6dff8d',
      },
      powerups: {
        glow: '#faffff',
        shield: '#6dff8d',
        rapid: '#c43dff',
        boost: '#faffff',
      },
    },
  },
  'cosmic-abyss': {
    label: 'Cosmic Abyss',
    palette: {
      background: {
        gradient:
          'radial-gradient(1200px 800px at 50% 20%, #120b2e 0%, #050312 60%, #02010a 100%)',
        base: '#050312',
      },
      hud: {
        text: '#e9f4ff',
        shadow: '#5a76ff88',
        panel: '#07061dcc',
        accent: '#7a5cff',
        secondary: '#3df2ff',
      },
      ship: {
        primary: '#7a5cff',
        trim: '#3df2ff',
        cockpit: '#cfd6ff',
        glow: '#7a5cff88',
        trailStart: '#7a5cffcc',
        trailEnd: '#3df2ff00',
        shieldInner: '#3df2ff55',
        shieldOuter: '#7a5cff00',
      },
      gate: {
        glow: '#3df2ffaa',
        fill: '#3df2ff',
        trim: '#7a5cff',
        strut: '#7a5cff',
      },
      stars: {
        bright: '#3df2ff',
        dim: '#7a5cff',
      },
      weather: {
        squall: {
          top: 'rgba(61, 242, 255, 0)',
          mid: 'rgba(122, 92, 255, 0.28)',
          bottom: 'rgba(61, 242, 255, 0.16)',
          band: 'rgba(122, 92, 255, 0.5)',
          gradientBase: 0.18,
          gradientPulse: 0.24,
          bandAlpha: 0.22,
          bandPulse: 0.24,
        },
      },
      particles: {
        shieldHit: '#3df2ff',
        playerHit: '#7a5cff',
        enemyHitDefault: '#54d0ff',
        enemyHitStrafer: '#8b74ff',
        bossHit: '#8b74ff',
        bossCore: '#7bf4ff',
      },
      enemies: {
        asteroidFill: '#101538',
        asteroidStroke: '#3df2ff66',
        asteroidGlow: '#3df2ff55',
        straferFill: '#170b31',
        straferStroke: '#7a5cff',
        straferGlow: '#7a5cff99',
        droneGlowInner: '#3df2ff88',
        droneGlowOuter: '#7a5cff00',
        droneCore: '#3df2ff',
        turretFill: '#0c0d26',
        turretStroke: '#7a5cff',
        turretGlow: '#7a5cff88',
        turretBarrel: '#3df2ff',
        splitterFill: '#111b3d',
        splitterStroke: '#7a5cff',
        splitterGlow: '#3df2ff88',
        splitterCore: '#9aeaff',
        shieldDroneFill: '#091436',
        shieldDroneTrim: '#3df2ff',
        shieldDroneGlow: '#3df2ff88',
        shieldDroneInner: '#7a5cff',
        shieldBubbleInner: 'rgba(61, 242, 255, 0.22)',
        shieldBubbleOuter: 'rgba(122, 92, 255, 0.1)',
        shieldBubbleRim: 'rgba(122, 92, 255, 0.5)',
      },
      boss: {
        shadowPhase1: '#7a5cffaa',
        shadowPhase2: '#a88cff',
        shadowPhase3: '#9af6ff',
        bodyFill: '#0c0a21',
        strokePhase1: '#7a5cff',
        strokePhase2: '#3df2ff',
        strokePhase3: '#9af6ff',
        canopy: '#d9e2ff',
        canopyPhase2: '#c8f5ff',
        canopyPhase3: '#f0fbff',
        coreGlow: '#7a5cffaa',
        coreOuter: '#3df2ff00',
        beam: '#3df2ff',
        trim: '#3df2ff',
        phase2Trim: '#7a5cff',
        phase3Trim: '#9af6ff',
        phaseShiftGlow: '#b5e8ff',
        strokePhaseShift: '#b5e8ff',
        phaseShiftTrim: '#9af6ff',
        phaseShiftOuter: '#b5e8ff00',
        warningBackdrop: 'rgba(122, 92, 255, 0.16)',
        warningFill: 'rgba(178, 244, 255, 0.92)',
        warningStroke: 'rgba(61, 242, 255, 0.8)',
        warningGlow: '#7a5cff',
        introText: '#7a5cff',
        introGlow: '#7a5cff88',
        healthBackground: '#07061dcc',
        healthFill: '#7a5cff',
        healthShadow: '#7a5cff99',
        healthStroke: '#3df2ffaa',
        healthText: '#e9f4ff',
      },
      bullets: {
        playerLevels: ['#87b9ff', '#b6e5ff', '#edf9ff'],
        enemyGlow: '#4be6ffaa',
        enemyFill: '#8ad8ff',
        highlight: '#edf9ff',
        muzzleCore: '#7a5cff',
        muzzleEdge: '#b6e5ff',
      },
      weaponToken: {
        fill: '#7a5cff',
        stroke: '#3df2ff',
        glow: '#7a5cffaa',
        text: '#3df2ff',
      },
      powerups: {
        glow: '#f1fbff',
        shield: '#3df2ff',
        rapid: '#7a5cff',
        boost: '#f1fbff',
      },
    },
  },
};

export const THEME_BEHAVIOURS = {
  'synth-horizon': {
    key: 'synth-horizon',
    icon: '🌅',
    title: 'Neon Horizon',
    summary: 'Neon lasers, frequent powerups, balanced pace.',
    overlay: {
      kind: 'laser',
      intensity: 0.28,
      speed: 0.32,
      spacing: 240,
      colours: {
        primary: 'rgba(0, 229, 255, 0.22)',
        secondary: 'rgba(255, 61, 247, 0.16)',
      },
    },
    spawnModifiers: {
      powerupIntervalMultiplier: 0.75,
    },
    paletteAdjustments: {
      particles: {
        enemyHitDefault: '#4ffcff',
        enemyHitStrafer: '#ff6aff',
        bossHit: '#ff6aff',
        bossCore: '#9dfdff',
      },
      bullets: {
        playerLevels: ['#8cfbff', '#c4faff', '#fff4ff'],
        highlight: '#ff92ff',
        muzzleEdge: '#8cfbff',
        enemyGlow: '#66fbffaa',
      },
      stars: {
        bright: '#7af8ff',
        dim: '#ff74ff',
      },
    },
  },
  'luminous-depths': {
    key: 'luminous-depths',
    icon: '💧',
    title: 'Luminous Depths',
    summary: 'Veiled fog, slower movement, heavy drone patrols.',
    overlay: {
      kind: 'fog',
      intensity: 0.46,
      speed: 0.18,
      colours: {
        near: 'rgba(36, 245, 217, 0.2)',
        far: 'rgba(22, 128, 255, 0.08)',
        highlight: 'rgba(110, 255, 255, 0.12)',
      },
    },
    spawnModifiers: {
      enemySpeedMultiplier: 0.85,
      powerupIntervalMultiplier: 1.1,
      enemyWeightMultipliers: {
        asteroid: 0.7,
        strafer: 0.6,
        drone: 1.5,
      },
    },
    paletteAdjustments: {
      particles: {
        enemyHitDefault: '#5ae9ff',
        enemyHitStrafer: '#1a9dff',
        bossHit: '#1a9dff',
        bossCore: '#8cfaff',
      },
      bullets: {
        playerLevels: ['#76f5ff', '#b3f9ff', '#e7fdff'],
        highlight: '#f1ffff',
        muzzleEdge: '#b3f9ff',
        enemyGlow: '#5defffaa',
      },
      stars: {
        bright: '#76f5ff',
        dim: '#2f96ff',
      },
    },
  },
  'ember-overdrive': {
    key: 'ember-overdrive',
    icon: '🔥',
    title: 'Ember Overdrive',
    summary: 'Heat shimmer, faster hostiles, fleeting boosts.',
    overlay: {
      kind: 'heat',
      intensity: 0.4,
      speed: 0.5,
      waves: 4,
      colours: {
        hot: 'rgba(255, 123, 57, 0.24)',
        warm: 'rgba(255, 189, 45, 0.18)',
        highlight: 'rgba(255, 228, 178, 0.14)',
      },
    },
    spawnModifiers: {
      enemySpeedMultiplier: 1.25,
      powerupDurationMultiplier: 0.65,
      enemyWeightMultipliers: {
        asteroid: 0.9,
        drone: 0.85,
        strafer: 1.25,
        turret: 1.15,
      },
    },
    paletteAdjustments: {
      particles: {
        enemyHitDefault: '#ffc96b',
        enemyHitStrafer: '#ff7e42',
        bossHit: '#ff7e42',
        bossCore: '#ffe6a6',
      },
      bullets: {
        playerLevels: ['#ffb867', '#ffd091', '#ffe9bb'],
        highlight: '#fff3cf',
        muzzleEdge: '#ffd091',
        enemyGlow: '#ffb96baa',
      },
      stars: {
        bright: '#ffd66e',
        dim: '#ff6b39',
      },
    },
  },
  'cosmic-abyss': {
    key: 'cosmic-abyss',
    icon: '🌀',
    title: 'Cosmic Abyss',
    summary: 'Nebula currents slow foes while turrets converge.',
    overlay: {
      kind: 'fog',
      intensity: 0.52,
      speed: 0.16,
      colours: {
        near: 'rgba(122, 92, 255, 0.26)',
        far: 'rgba(61, 242, 255, 0.12)',
        highlight: 'rgba(153, 226, 255, 0.18)',
      },
    },
    spawnModifiers: {
      enemySpeedMultiplier: 0.92,
      powerupIntervalMultiplier: 1.05,
      enemyWeightMultipliers: {
        turret: 1.25,
        drone: 0.85,
      },
    },
    paletteAdjustments: {
      particles: {
        enemyHitDefault: '#58d0ff',
        enemyHitStrafer: '#9a80ff',
        bossHit: '#9a80ff',
        bossCore: '#86f6ff',
      },
      bullets: {
        playerLevels: ['#8cbfff', '#c4ebff', '#f2fdff'],
        highlight: '#f6feff',
        enemyGlow: '#4be6ffaa',
        muzzleEdge: '#c4ebff',
      },
      stars: {
        bright: '#63e9ff',
        dim: '#a195ff',
      },
    },
  },
};

export const DEFAULT_THEME_PALETTE = THEMES[DEFAULT_THEME_KEY].palette;

export function resolvePaletteSection(palette, section) {
  const base = DEFAULT_THEME_PALETTE[section] ?? {};
  const override = palette?.[section];
  return { ...base, ...(override ?? {}) };
}

export function getThemeKeys() {
  return Object.keys(THEMES);
}

export function getThemeLabel(key) {
  return THEMES[key]?.label ?? key;
}

export function getThemePalette(key) {
  return THEMES[key]?.palette ?? THEMES[DEFAULT_THEME_KEY].palette;
}

function clonePaletteAdjustments(adjustments = {}) {
  const clone = {};
  for (const [section, value] of Object.entries(adjustments)) {
    if (Array.isArray(value)) {
      clone[section] = value.slice();
    } else if (value && typeof value === 'object') {
      const sectionClone = {};
      for (const [key, entry] of Object.entries(value)) {
        sectionClone[key] = Array.isArray(entry)
          ? entry.slice()
          : entry;
      }
      clone[section] = sectionClone;
    } else {
      clone[section] = value;
    }
  }
  return clone;
}

function cloneBehaviour(behaviour) {
  if (!behaviour) {
    return null;
  }
  return {
    ...behaviour,
    overlay: behaviour.overlay
      ? {
          ...behaviour.overlay,
          colours: behaviour.overlay.colours ? { ...behaviour.overlay.colours } : undefined,
        }
      : null,
    spawnModifiers: behaviour.spawnModifiers
      ? {
          ...behaviour.spawnModifiers,
          enemyWeightMultipliers: behaviour.spawnModifiers.enemyWeightMultipliers
            ? { ...behaviour.spawnModifiers.enemyWeightMultipliers }
            : undefined,
        }
      : undefined,
    paletteAdjustments: behaviour.paletteAdjustments
      ? clonePaletteAdjustments(behaviour.paletteAdjustments)
      : undefined,
  };
}

export function getThemeBehaviour(key) {
  return cloneBehaviour(THEME_BEHAVIOURS[key] ?? null);
}

export function applyThemeBehaviourToPalette(palette, behaviour) {
  const base = palette ?? DEFAULT_THEME_PALETTE;
  const adjustments = behaviour?.paletteAdjustments;
  if (!adjustments || !Object.keys(adjustments).length) {
    return base;
  }
  const merged = { ...base };
  for (const [section, overrides] of Object.entries(adjustments)) {
    if (!overrides) {
      continue;
    }
    if (Array.isArray(overrides)) {
      merged[section] = overrides.slice();
      continue;
    }
    const baseSection = base[section];
    const sectionClone =
      baseSection && typeof baseSection === 'object' && !Array.isArray(baseSection)
        ? { ...baseSection }
        : {};
    for (const [key, value] of Object.entries(overrides)) {
      sectionClone[key] = Array.isArray(value) ? value.slice() : value;
    }
    merged[section] = sectionClone;
  }
  return merged;
}
