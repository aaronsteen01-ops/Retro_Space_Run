# 🚀 Retro Space Run v0.2

Retro Space Run is a neon-soaked arcade runner built on HTML5 Canvas. You pilot a nimble ship through asteroid fields and synthetic bosses while tuning a persistent arsenal for the long haul. The project now ships as a set of ES modules, making it easier to extend, optimise, and theme.

---

## 📦 Module Directory
The codebase lives under `src/` and is split into focused modules:

- `main.js` — boots the game, owns the master state object, and advances the render/update loop at 60 FPS.
- `player.js` — handles player initialisation, movement physics, hit detection, invulnerability frames, and rendering of the ship and its thrust trails.
- `weapons.js` — tracks the player arsenal, calculates fire rates, spawns projectiles, resolves collisions, and governs persistent weapon upgrades between runs.
- `enemies.js` — spawns wave templates, manages drones, turrets, asteroids, and orchestrates the boss lifecycle including attack patterns and health UI.
- `powerups.js` — manages timed buffs, drop logic, and visual effects for temporary boosts.
- `audio.js` — wires up the Web Audio API context, re-usable synth nodes, and SFX triggers for shots, hits, and loot.
- `ui.js` — provides canvas references, overlay toggles, HUD updates, and theme change hooks.
- `themes.js` — defines theme palettes and, in v0.2, exposes the soon-to-launch selector configuration so new palettes can be dropped in without touching gameplay code.
- `utils.js` — houses helper maths, collision helpers, and particle utilities shared across systems.

Each module imports and exports explicit functions, so you can develop or test components in isolation without dragging in the entire game loop.

---

## ✨ Feature Highlights in this build

### Level One Difficulty Tuning
Level one now leans on a shared difficulty configuration so enemy waves, boss integrity, and loot timers can be tuned in one spot. The opening sector ships with calmer spawn intervals, slower projectiles, and a safety weapon drop once you clear 60 % of the run.

### Assist Mode
Need a hand or want to test comfortably? Toggle Assist Mode from the HUD pill or hit **H** to persist the setting. Assist grants an extra starting life, short bursts of invulnerability after hits, and a 50 % boost to power-up spawn cadence.

### Persistent Weapon Upgrades
Destroying priority targets now drops weapon tokens. Collect them to permanently unlock higher-tier blasters that carry across sessions. The `weapons.js` module serialises unlocks to localStorage and reapplies them when a new run starts, letting players build their own loadout ladder.

### Boss Encounter Flow
Every sector culminates in a bespoke boss fight. Bosses spawn once the timer crosses the late-stage threshold, lock the finish gate, and shift the soundtrack via `audio.js`. Defeating the boss triggers celebratory particles, reopens the gate, and rolls a guaranteed weapon drop.

---

## 🛠️ Running the Game

### Modern Build (Recommended)
1. Serve the project root via any static server (for example `npx serve .` or `python -m http.server`).
2. Visit the served URL in a modern browser (Chrome, Edge, Firefox, Safari) so the ES module graph loads automatically via `<script type="module" src="./src/main.js"></script>`.

### Legacy Fallback
For browsers without module support, leave the inline `<script nomodule>…</script>` block in `index.html`. That snippet ships the transpiled single-bundle fallback and gracefully gets skipped by modern browsers. Keep both tags to cover mixed device fleets.

---

## 🎯 Controls
| Action | Key |
|--------|-----|
| Move | WASD / Arrow keys |
| Shoot | Spacebar |
| Pause | P |
| Fullscreen | F |
| Mute / Unmute | M |
| Assist toggle | H / HUD pill |

Controllers with standard gamepad mappings inherit from the browser’s default bindings (left stick to steer, face buttons to fire) when available.

---

## ⚡ Performance & Developer Tips

- The render loop targets greater than **60 frames per second** on mid-range laptops and recent tablets. Use the browser’s performance tools to verify frame pacing when introducing new effects.
- `main.js` centralises the shared `state` object; instrument logging around its update cycle when debugging new features.
- Keep sprite counts lean: both enemy and bullet pools are recyclable arrays—prefer reusing entries instead of allocating new objects inside the loop.
- Particle showers live in `utils.js::addParticle`. Reduce spawn counts or glow intensities when optimising for low-powered hardware.
- Themes are pure data objects; drop new palettes into `themes.js` and they become available to the selector without touching canvas code.

---

## 🤝 Contributing
Bug reports and pull requests are welcome. Please follow the module structure above, favour Australian English in documentation, and profile changes with the performance tips noted earlier.
