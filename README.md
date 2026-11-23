# BotWars

A browser-based, top-down, hands-off robot arena auto-battler.

## Game concept
Players spend a fixed credit budget to assemble a roster of robots. Every robot has immutable class capabilities and individual behaviour sliders. Pressing **Ready** locks the roster; all combat from that point is autonomous, with no player intervention until the match ends.

## Planned bot classes
- **Scout** — fast and light
- **Goliath** — slow and durable
- **Spy** (later) — specialist radar scout with **team-wide radar-contact sharing**

The initial prototype uses Scouts and Goliaths.

## Immutable robot capabilities
- Maximum movement speed and health
- Weapon damage, attack range, and fire rate
- Radar detection range **distinct from weapon attack range**
- Armour and any class-specific abilities

A bot cannot acquire the current position of allies or enemies outside its own radar range. **Ordinary bots do not share radar contacts. Only the Spy will have the special ability to share its detected contacts with its team.** No omniscient targeting.

## Individual behaviour sliders (initial candidates)
- Timid ↔ Aggressive
- Lone wolf ↔ Helps teammates
- Reckless ↔ Cautious
- Close combat ↔ Keep distance
- Prefer weakest ↔ Prefer strongest target
- Hold position ↔ Keep moving

Sliders affect decisions, not immutable physical specifications. Bots have no named personality presets.

## Matches
- Free-for-all and team battles, ultimately around 2–50 combatants
- Initially a blank rectangular arena with boundary walls
- Later procedural arenas with obstacles, blocks, pickups/rewards
- Hands-off combat after Ready
- Eventually online: server-authoritative simulation, browser clients watch matches

## Architecture
- TypeScript, Vite and Phaser, developed on Linux Mint
- Combat simulation isolated from Phaser rendering and browser UI
- Fixed-step updates, seeded randomness when required for reproducibility
- Separate roster/configuration, simulation, rendering and eventual networking layers
- Do not add multiplayer networking prematurely

## Current prototype (v0.4)
- Build a budget-limited roster of Scouts and Goliaths
- Mockup-inspired three-column setup interface: available classes, individual roster cards and arena preview/match summary
- Click a roster card to expand and adjust **its own** six behaviour sliders; edits persist as you switch cards
- New robots receive independent default settings; deleting a robot preserves every other robot's settings
- Press Ready for automatic combat against a preset opponent team
- Bots wander when no enemy is detected and strafe during combat
- Teamwork slider is visible but not yet implemented in the AI; spy radar sharing is planned, not yet implemented
- Configuration lives in browser memory for now; reloading resets it
- Arena preview and match settings are display-only for now; the existing battle renderer and simulation are unchanged

## Development roadmap
1. Scaffold application and display an arena in the browser.
2. Define immutable classes and configurable behaviours.
3. Add independent radar detection, movement, targeting and combat.
4. Build credit-budget roster screen and per-bot sliders.
5. Ready → fully automated battle → results.
6. Improve AI, balance and visuals; add Spy and later procedural arenas.
7. Add authoritative multiplayer server and spectator syncing.

## Local setup
Use Node.js LTS (Node 18 is too old for current Vite). Clone this repository on Linux Mint. Run `npm install` and `npm run dev`, then open the Vite URL (usually http://localhost:5173).
