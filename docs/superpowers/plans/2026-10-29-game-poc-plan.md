# Buffer Overflow — proof of concept (G0) plan

Design: the approved game pitch (private Claude doc "Buffer Overflow: game pitch"). Decisions taken from its recommendations: Phaser 4 + TypeScript + Vite, 2D top-down, battle in a separate scene (the Buffer) with Strike and Dodge (Dodge in the boss only), map walked with real Vim motions, free retries, local playtest log. The existing course app is not touched.

## What G0 proves
One slice of area 1 is fun for ten minutes: walk a tile map with Vim motions, bump into an enemy, cut to the Buffer, read a telegraph, answer with the right motion, beat the Warden boss, see mastery grow, and chase a high score in Target Rush.

## Architecture
- `game/` is a new workspace (Vite + Phaser 4). It imports `@kbm/vim` (emulator) and `@kbm/shared` (key normalizing, audio, save) unchanged.
- `game/src/sim/` is plain TypeScript with no Phaser: map navigation, battle rules, enemy and boss data, best-route search, mastery, scoring. All of it is unit tested headless.
- `game/src/scenes/` draws and wires input only. Placeholder art is drawn in code (rectangles, text), so no assets are needed.
- Overworld movement reuses the Vim emulator: the map is a text buffer, a key is fed to the engine, and the new cursor is accepted unless a wall is in the way. `w` therefore hops between landmarks for free.
- In the Buffer, weak points are overlay tokens on a static text arena. A hit is `x` on a weak point; any other text change is undone, so the arena never drifts.

## Tasks (each ends with tests or a visible check)
1. **Scaffold.** `game` workspace, Phaser 4, Vite `base './'`, root scripts. Check: `npm run build` works; a blank scene shows.
2. **Map sim** (`sim/map.ts`, `sim/area1.ts`). Parse the area, move by feeding the Vim engine, stop at walls, doors and entities, report what was bumped. Tests: walls block, `w` hops landmarks, `$` and `0` stop at the edge, every enemy and the door are reachable.
3. **Battle sim** (`sim/battle.ts`, `sim/enemies.ts`). Ticks per keystroke, weak points, pulses, Patrol movement, Stalker chase, Warden phases and sweep hazards, Integrity, allowed keys. Tests: hit on `x`, miss otherwise, pulse timing, patrol bounce, phase advance, sweep damage and dodge.
4. **Best-route search** (`sim/route.ts`). Breadth-first search over cursor positions using the engine. Tests: matches hand-checked optima.
5. **Mastery and save** (`sim/mastery.ts`). Per-key use counts to mastery 0-5, saved in localStorage. Tests.
6. **Scenes.** Boot/Title, World (tile map, smooth movement, camera, enemies, door, lesson sign), diff-sweep transition, Battle (the Buffer layout from the pitch: enemy header, telegraph, arena, key strip, move rack, result screen), Character sheet, Arcade (Target Rush, local top ten).
7. **Juice and audio.** Screen shake, hit flash, particles on a hit, key sounds via the shared audio, telegraph pulses.
8. **Playtest log.** Local event log with an export button.
9. **Verify in the browser** with real key presses, fix what feels wrong, then report to the user with a list of what to judge.

## Out of scope for G0
Areas 2 to 6, real pixel art, other arcade games, saving across areas, Dodge outside the boss, story.
