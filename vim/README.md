# Vim emulator

A TypeScript implementation of the Vim commands the game teaches. It implements the `Engine`
contract from `@kbm/shared`: feed it one key at a time (`KeyboardEvent.key` names) and read back the
buffer, cursor, mode, half-typed command, registers, last operator range and last cursor jump.

```ts
import { createVimEngine } from '@kbm/vim';
const vim = createVimEngine();
vim.reset({ lines: ['hello world'], cursor: { row: 0, col: 0 } });
vim.feed('d'); vim.feed('w');
vim.state.lines; // ['world']
```

The algorithms for words, paragraphs, text objects, registers, undo cursor placement and Join are
ported from Vim's own C source rather than reinvented, because most of the interesting behaviour is
in the edge cases (empty lines, end of file, operator-pending quirks).

## Supported

| Area | Commands |
| --- | --- |
| Modes | normal, insert, visual `v` `V` `Ctrl-v` |
| Motions | `h j k l`, `w b e W B E ge gE`, `0 ^ $ _ - + Enter`, `gg G {n}G`, `{ } %`, `{n}%`, `f F t T ; ,` |
| Operators | `d c y` with any motion, `dd cc yy`, counts before and after, registers |
| Text objects | `iw aw iW aW ip ap`, `i( a( ib ab`, `i[ a[`, `i{ a{ iB aB`, `i< a<`, `i" a" i' a' i\` a\`` |
| Edits | `x X D C s S Y p P J ~ r{c} i a I A o O`, `u Ctrl-r`, `.` |
| Registers | `"` unnamed, `0`-`9`, `-`, `a`-`z`, `A`-`Z` (append), `_` |
| Insert keys | characters, `Enter`, `Backspace`, `Delete`, `Tab`, `Ctrl-w`, `Ctrl-u`, counts like `3ix` |
| Visual | motions, text objects (grow the selection), `o O`, `d x X D y Y c s C S J ~ u U r p P`, block `I A` and `$`, `.` repeat |

Behaviour follows **Vim** defaults (`vim -u DEFAULTS`), so it differs from Neovim in places:
`startofline` is on (`gg`, `G`, `dd` land on the first non-blank), and `joinspaces` is on
(`J` leaves two spaces after a `.`, `!` or `?`).

## Testing against real Vim

`test/` runs the same keystrokes through the emulator and through the `vim` installed on the machine
(`vim -es` driven by `feedkeys()`), then compares buffer, cursor and registers. If no `vim` is on the
PATH those suites are skipped.

```bash
npm test                                          # everything (about 90s)
FUZZ_N=2000 FUZZ_SEED=1 npx vitest run vim/test/fuzz.diff.test.ts   # random sequences from a seed
FUZZ_VISUAL=1 FUZZ_N=300 npx vitest run vim/test/fuzz.diff.test.ts  # also fuzz Visual mode (opt-in)
```

A fuzz failure prints the seed, the minimal key sequence, and both results. Re-run it with
`FUZZ_SEED=<seed> FUZZ_N=1`.

The level gate (M5) uses the same runner to check that every level's par solution really solves the
level in real Vim.

## Known gaps

Not implemented, so levels must not rely on them:

- sentences (`( ) is as`), tags (`it at`), search (`/ ? n N * #`), marks (`m ' \``), macros (`q @`),
  `R`, `Ctrl-a`/`Ctrl-x`, `> <`, `gu gU g~`, `zz`, `H M L`, folds, and `:` commands
- forced motions (`dv`, `dV`, `d<C-v>`)
- tabs and wide characters (columns are UTF-16 units; levels use plain ASCII)

Visual mode matches Vim for the common commands (see `test/visual.diff.test.ts`) but a few corner
cases differ, found by the opt-in Visual fuzzer (about 2% of random sequences):

- `I`/`A` outside block mode place the cursor by rules Vim derives from stale state
- block-mode cursor after undo, and the register text of block selections that run off short lines
- repeating `i"` in Visual mode (it should grow to include the quotes)
