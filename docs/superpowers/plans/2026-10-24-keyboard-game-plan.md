# Keyboard Mastery Game — Build Plan (Vim v1)

Spec: `docs/superpowers/specs/2026-10-24-keyboard-game-design.md`. Each milestone ends with something runnable and a verification step. Do them in order. Test-first for the emulator (differential tests vs real `vim`).

## M0 — Scaffold
- Root `package.json` with npm workspaces: `shared`, `vim`, `app`. TypeScript strict, Vitest, ESLint-light.
- `app/` = Vite + Svelte + TS, `base: './'`, `build.target: es2020`.
- Packages export TS source; `app` aliases them (no per-package build).
- Scripts: `dev`, `build`, `test`, `zip` (zips `app/dist` to `release/keyboard-mastery-web.zip`).
- **Verify:** `npm run dev` shows blank title screen; `npm run build` produces `dist/` that works via `npx serve dist` from a subpath.

## M1 — Engine contract (shared)
- `shared/src/engine.ts`: `Engine` interface — `feed(key): EngineState`, `reset(buffer)`, `state` with `lines`, `cursor{row,col}`, `mode`, `pending` (count/operator/register/awaiting), `registers`, `marks`, `keyLog`, `lastRange` (for highlight), `lastJump{from,to}` (for trail).
- `shared/src/level.ts`: `Level` type — id, title, world, start buffer + cursor, goal (`text?`, `cursor?`), par, whitelist of keys/commands, intro card ref, hint steps, par solution keys.
- `shared/src/scoring.ts`: keystroke counting rules, stars (par → 3, ≤ par×1.25 → 2, solve → 1). Unit tests.
- `shared/src/save.ts`: localStorage wrapper, try/catch safe (itch iframe/private mode), in-memory fallback. Unit tests.
- **Verify:** unit tests green.

## M2 — Vim emulator core (TDD, in `vim/src/engine/`)
Build in slices; each slice gets differential tests first.
1. **Test harness** `vim/test/diff.ts`: for (buffer, keys) run real vim headless — `vim -Nu NONE -i NONE -es -s keys.txt file`, with keys file ending in a command that writes the cursor (`:call writefile([line('.'),col('.')], 'pos.txt')`) then `:wq!`. Compare text and cursor with emulator. Skip suite with a clear message if `vim` missing.
2. Modes + `hjkl`, `Esc`, `i a I A o O`, counts.
3. Words: `w b e W B E ge`, `0 ^ $ gg G`, `{count}G`.
4. Lines/find: `f F t T ; ,`, `%`, `{ }`.
5. Operators: `d c y p P x X r J ~ .` with motions, `dd cc yy`, linewise vs charwise, registers default + numbered basics, `u`, `Ctrl-R`.
6. Text objects: `iw aw is ip i( a( i[ i{ i" a" i' it`-skip `it`, dot-repeat.
7. Visual: `v V Ctrl-V`, operators on selection, `o`, `gv`-skip.
- Engine records `lastRange`, `lastJump`, `keyLog` per key.
- **Verify:** `npm test` — each slice's differential cases pass (≥15 per slice incl. edge cases: line ends, empty lines, counts past EOF, multibyte-free ASCII only).

## M3 — Game shell (shared + app)
- Screens: Title → Editor picker → World map → Level → Results; Sandbox.
- `shared/ui/`: `EditorView` (renders buffer, cursor, selection, operator range highlight, motion trail via animated SVG/CSS), `ModeBadge`, `KeyHistory`, `RegisterPanel`, `KeyboardOverlay` (QWERTY, matches `event.key`, lights keys, shows shift state), `Hud` (keystrokes vs par, stars preview), `IntroCard`, `HintPanel`.
- Input layer: focus gate ("Click to play"), `keydown` → key normalization → `preventDefault` for handled keys, ignore browser chords, fullscreen button, `Alt+R` restart + on-screen restart.
- Whitelist enforcement: disallowed key shakes and shows tooltip explaining why; does not count as a keystroke.
- Audio: WebAudio synth (key click, error, win, star), mute toggle persisted.
- Style: dark retro terminal tokens as CSS vars, glow cursor, smooth transitions, `prefers-reduced-motion` respected.
- **Verify:** manual run in browser pane (screenshot each screen), plus Vitest component tests for scoring/whitelist wiring.

## M4 — Level runner
- Runner loads a `Level`, resets engine, tracks keystrokes, checks goal after every key, triggers win → results (stars, par compare, "see par replay").
- Hint ladder: nudge → command name → animated par replay (feeds par keys into a ghost engine at readable speed).
- Intro card with small animated demo driven by a mini scripted engine run.
- Progress: stars per level, world unlock rule (all previous world levels solved), sandbox unlock after world 1.
- **Verify:** one hand-authored world-1 level playable end to end; save survives reload.

## M5 — Content: worlds 1-6 (~50 levels)
- Level files in `vim/src/levels/world-N-*.ts` (data-driven). Flavor text per world.
- Worlds: 1 modes+hjkl, 2 words, 3 lines+find, 4 operators, 5 text objects, 6 visual.
- Author ~8 levels per world with par solutions and whitelists; mix cursor-goal and text-goal levels; later levels in a world require combining commands.
- **Automated gate** `vim/test/levels.test.ts`: for every level, run par keys in emulator AND real vim; both must reach goal; par length == declared par; par keys ⊆ whitelist; goal not already satisfied at start.
- **Verify:** gate green; playtest each world in browser.

## M6 — Polish + itch.io release
- Title screen with editor picker (Vim playable; Emacs/NeoVim "coming soon").
- Responsive layout down to ~1024px wide (itch embeds); minimum-size message below that.
- Accessibility: color contrast, reduced motion, not color-only feedback.
- Bundle audit (< ~2 MB), no external requests (fonts bundled or system monospace).
- `npm run zip`; test the zip in an iframe on a local page to confirm focus capture and localStorage; confirm no required browser-reserved chords.
- itch page checklist in `docs/itch-release.md`: embed size, fullscreen enabled, "click to launch" off, description, tags.
- **Verify:** zipped build loads in iframe; full playthrough of world 1; keys not leaking to browser.

## Risks and mitigations
- **Emulator drift:** differential tests + level gate (M2, M5).
- **Key capture in iframe:** focus gate + `preventDefault` (M3, M6); documented limitation for browser-reserved chords.
- **Scope creep in Vim edge cases:** only implement commands in the spec worlds; unimplemented keys are simply not whitelisted.
- **Cursor-column semantics (`curswant`, `$`, tabs):** model `curswant` explicitly from M2 slice 2; ASCII, no tabs in levels.

## Out of this plan
Worlds 7-9, Emacs, NeoVim, desktop build, alt keyboard layouts — future plans reusing the engine contract.
