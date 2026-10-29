# Keyboard Mastery Game — Design (Vim first)

## Intent
A visual, interactive browser game that teaches programmers keyboard-driven editing. Players who code today with mouse and arrow keys climb from "what is a mode" to text objects. Vim ships first. Emacs and NeoVim follow later as separate editor packages on the same platform. Release target: itch.io (HTML5).

## Goals
- Teach real Vim behavior through short keystroke-golf challenges.
- Make the editor's invisible state visible: mode, keystroke history, cursor jumps, operator ranges, registers, marks.
- Ship v1 small (worlds 1-6, ~50 levels), then grow by updates.
- Platform reusable so a new editor is "add a folder": emulator + levels.

## Non-goals
- Not a full Vim clone (no ex-command surface beyond what levels teach, no plugins, no vimscript, no files on disk).
- No accounts, server, leaderboards, or analytics.
- No mobile/touch support (needs a physical keyboard).
- No music, no story campaign, no pixel-art assets.
- Emacs and NeoVim are out of scope for this plan beyond leaving room for them.

## Anti-goals (failure even if it "works")
- Emulator behavior that differs from real Vim for any taught command.
- Levels solvable by hjkl spam that skip the lesson.
- Browser/itch iframe swallowing keys so Vim input feels broken.

## Stack and structure (decided)
- Svelte + Vite + TypeScript. Build with `base: './'` so `dist/` zips straight to itch.io.
- npm workspaces monorepo:
  - `shared/` — UI shell, keyboard overlay, scoring, save system (localStorage), WebAudio SFX, level-runner interface.
  - `vim/` — Vim emulator, level data, intro cards, world definitions.
  - `app/` — launcher with title screen and editor picker; Emacs/NeoVim listed as "coming soon".
  - Future: `emacs/`, `neovim/` as sibling packages implementing the same editor interface.
- Editor package contract (my design call): exports `id`, `name`, `worlds`, and an `Engine` with `feed(key) -> state` exposing buffer, cursor, mode, registers, marks, pending operator/range, and key history.

## Gameplay (decided)
- Level = start buffer + goal (final text and/or final cursor position). Win only on exact match. Data-driven level files.
- Scoring: keystrokes vs par. 3 stars = par or better, 2 = par+25%, 1 = any solve.
- Each level whitelists commands taught so far plus earlier worlds. Disallowed keys shake and say why.
- Real undo (`u`, `Ctrl-R`) works and counts as keystrokes.
- Restart: on-screen button plus `Alt+R` (my call, since Esc and Ctrl-R are Vim keys).
- Teaching: intro card per new command with small animated demo, then attempt, then escalating hints: nudge, command name, par-solution replay.
- Worlds unlock in order. Stars saved in localStorage. Sandbox (blank buffer, full visuals) unlocks after world 1.
- Worlds in v1: 1 modes + hjkl, 2 words, 3 lines + find, 4 operators, 5 text objects, 6 visual mode. Later updates: 7 search/replace, 8 registers/macros, 9 splits/buffers.
- Light flavor text per world (engineer rescuing code from a broken editor).

## Visuals and feel (decided)
- Dark retro terminal with modern polish: monospace font, glowing cursor, smooth animation.
- Always-on: mode badge, keystroke history, cursor motion trails, highlighted operator range, live registers/marks panel, par replay.
- On-screen QWERTY keyboard lighting pressed keys. Keys matched by typed character, not physical position, so Dvorak/Colemak users still get correct commands.
- WebAudio-synthesized key-click and success SFX, mute toggle, no asset files.

## Correctness (decided)
- Differential tests: feed keystroke sequences to the JS emulator and to installed `vim -es`; compare buffer and cursor. Dev-time only.
- CI-style check: every level's par solution is run through both and must solve the level.
- Unit tests for scoring, whitelist, save.

## itch.io constraints
- Game runs in an iframe: require click-to-focus, `preventDefault` on handled keys, fullscreen button. Browser-reserved chords (Ctrl-W, Ctrl-N, Ctrl-T) can't be captured on web; levels must not require them (those belong to a later desktop build).
- Keep bundle small (target under ~2 MB).

## Left to the builder
- Exact par values, level text content, intro card wording and animations.
- Visual design details (palette, fonts, motion timings).
- Internal emulator architecture beyond the contract above.
- Final level count per world (~8 each).

## Open items
None blocking.
