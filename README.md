# 🚀 Retro Space Run v1.0

Retro Space Run is a neon-soaked arcade runner built on HTML5 Canvas. You pilot a nimble ship through five themed sectors of asteroid fields and synthetic bosses, build a persistent arsenal, and break through to a triumphant campaign finale. The project ships as a set of ES modules, making it easier to extend, optimise, and theme.

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
- `themes.js` — defines theme palettes and the live selector configuration so new palettes can be dropped in without touching gameplay code.
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

### Meta Progression & Ship Hangar
Runs now feed a persistent progression ledger tracked in `src/meta.js`. Total runs, aggregated score, and cumulative boss defeats determine which hulls are available when you next dock. Visit the new Garage overlay from the title screen to inspect ship stats, review unlock goals, and pick your preferred craft before launching.

### Ship Roster
The hangar opens with the reliable Pioneer, but defeating three bosses unlocks the precision Vanguard interceptor, while banking 50,000 total score grants access to the wide-spread Nova gunship. Each hull offers unique speed, fire rate, shield, and projectile spread characteristics that noticeably alter the feel of a run.

### Five-Sector Campaign
The campaign runs across five bespoke sectors, each with its own palette, weather mutators, wave scripts, and boss duo:

1. **Debris Drift** — a calm opening sweep through shattered hulls.
2. **Ion Squalls** — static storms shear the escort corridor.
3. **Ember Breaker** — forge furnaces ignite the void lanes.
4. **Cosmic Abyss** — dark-blue nebulas where splitter frigates rupture into mini drones and shield drones project protective bubbles.
5. **Neon Void** — the finale sector: a purple-and-green wound in space guarded by the Void Sovereign.

### Boss Encounter Flow
Every sector culminates in a bespoke boss fight. Bosses spawn once the timer crosses the late-stage threshold, lock the finish gate, and shift the soundtrack via `audio.js`. Defeating the boss triggers celebratory particles, reopens the gate, and rolls a guaranteed weapon drop.

### Campaign Finale & Credits
Clearing the Neon Void triggers the **Mission Accomplished** finale — a triumphant victory screen with a run tally (score, bosses felled, hostiles cleared, achievements, and new-best flag) and a fanfare, followed by an optional scrolling credits roll. A framing prologue opens each fresh campaign.

### Power-ups & Achievements
Timed **Shield**, **Rapid**, and **Boost** pickups are joined by **Blast**, an instant defensive shockwave that wipes incoming enemy fire. Eight achievements track feats from *First Blood* to *Untouchable Legend* (clear the whole campaign without losing a life).

---

## 🌐 Play Online
The game is a self-contained static site and ships with a GitHub Pages deploy workflow (`.github/workflows/deploy.yml`). To go live:

1. In the repository, open **Settings → Pages → Build and deployment** and set **Source: GitHub Actions**.
2. Merge to `main` (or run the *Deploy to GitHub Pages* workflow manually). Each push to `main` then redeploys automatically.

Once enabled, it will be playable at `https://aaronsteen01-ops.github.io/Retro_Space_Run/`.

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

Thanks, Aaron
