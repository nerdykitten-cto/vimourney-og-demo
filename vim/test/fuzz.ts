import type { Pos } from '@kbm/shared';
import { createVimEngine } from '../src';
import { keysOf, runEmulator, runRealVim, type Outcome } from './vimRunner';

/** Small seeded PRNG (mulberry32) so failures reproduce. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof rng>;

export const BUFFERS: string[][] = [
  ['hello world foo.bar baz', '', '  indented line (with parens) here', 'second-line, with: punctuation!', '', '', 'last paragraph word', 'tail'],
  ['one two three', 'four five six', 'seven eight nine', 'ten'],
  ['function foo(a, b) {', '  return [a, b].map((x) => x + 1);', '}', '', 'const s = "str ing" + \'q\';'],
  ['a', 'bb', 'ccc', 'dddd', 'eeeee'],
  ['   ', 'x', '', '  y z  ', 'end.'],
  ['foo(bar(baz), qux) + {a: [1, 2, 3]}', 'if (x) {', '  y();', '}'],
];

const FIND_CHARS = 'aeo ,.(){}[]"\'xyz';

function count(r: Rng, p = 0.3): string {
  return r.chance(p) ? String(1 + r.int(4)) : '';
}

export interface Pools {
  motions: string[];
  /** Whole-command generators. */
  commands: Array<(r: Rng) => string>;
}

export function motion(r: Rng, set: 'basic' | 'all' = 'all'): string {
  const basic = ['h', 'j', 'k', 'l', 'w', 'b', 'e', 'W', 'B', 'E', '0', '^', '$', 'ge', 'gE'];
  const more = ['{', '}', '%', 'G', 'gg', '_', ';', ',', '-', '+'];
  const find = () => r.pick(['f', 'F', 't', 'T']) + r.pick([...FIND_CHARS]);
  const pool = set === 'basic' ? basic : [...basic, ...basic, ...more];
  if (r.chance(0.15)) return count(r) + find();
  return count(r) + r.pick(pool);
}

const WORDS = ['xy', 'foo bar', 'Z', 'a b', '', '()', 'end.'];
/** Marker replaced by typed text only if the emulator actually entered insert mode. */
const TYPED = '\u0001';
function typedText(r: Rng): string {
  let s = r.pick(WORDS);
  if (r.chance(0.15)) s += '<CR>' + r.pick(WORDS);
  if (r.chance(0.1)) s += '<BS>';
  return s + '<Esc>';
}
function typed(_r: Rng): string {
  return TYPED;
}

export function textObject(r: Rng): string {
  return r.pick(['i', 'a']) + r.pick(['w', 'W', 'p', '(', ')', 'b', '[', '{', '}', 'B', '"', "'"]);
}

export function opCommand(r: Rng, objects: boolean): string {
  const op = r.pick(['d', 'c', 'y']);
  const reg = r.chance(0.12) ? '"' + r.pick(['a', 'b', 'A', '_']) : '';
  let body: string;
  if (r.chance(0.2)) body = count(r) + op;
  else if (objects && r.chance(0.4)) body = count(r, 0.15) + textObject(r);
  else body = count(r, 0.2) + motion(r);
  const text = op === 'c' ? typed(r) : '';
  return reg + count(r, 0.1) + op + body + text;
}

export function editCommand(r: Rng): string {
  const c = r.int(18);
  switch (c) {
    case 0:
      return count(r) + 'x';
    case 1:
      return count(r) + 'X';
    case 2:
      return 'D';
    case 3:
      return 'C' + typed(r);
    case 4:
      return count(r) + 's' + typed(r);
    case 5:
      return 'S' + typed(r);
    case 6:
      return count(r) + 'Y';
    case 7:
      return count(r) + r.pick(['p', 'P']);
    case 8:
      return count(r) + 'J';
    case 9:
      return count(r) + '~';
    case 10:
      return count(r) + 'r' + r.pick([...'xyz ']);
    case 11:
      return count(r, 0.2) + r.pick(['i', 'a', 'I', 'A', 'o', 'O']) + typed(r);
    case 12:
      return 'u';
    case 13:
      return '<C-r>';
    case 14:
      return count(r, 0.2) + '.';
    case 15:
      return '"' + r.pick(['a', 'b', '0', '1', '"']) + r.pick(['p', 'P']);
    default:
      return motion(r);
  }
}

export function visualCommand(r: Rng, objects = true): string {
  const start = r.pick(['v', 'v', 'V', '<C-v>']);
  let body = start;
  const n = r.int(4);
  let linewiseObject = false;
  for (let i = 0; i < n; i++) {
    if (objects && r.chance(0.25)) {
      // Quote objects have extra Visual-mode rules (repeating i" selects the quotes) that aren't ported.
      let o = textObject(r);
      while (/["'`]$/.test(o)) o = textObject(r);
      if (o.endsWith('p')) linewiseObject = true;
      body += o;
    }
    else if (r.chance(0.15)) body += 'o';
    else body += motion(r);
  }
  // I and A outside block mode have odd cursor rules (Vim reuses stale column state); only fuzz them in block mode.
  const ops = ['d', 'x', 'y', 'c', 's', 'J', '~', 'u', 'U', 'r' + r.pick([...'xy ']), 'D', 'X', 'Y', 'C', 'S', 'p', 'P', '<Esc>', 'd', 'y'];
  if (start === '<C-v>' && !linewiseObject) ops.push('I', 'A', 'I', 'A');
  const op = r.pick(ops);
  const typedOps = ['c', 's', 'C', 'S', 'I', 'A'];
  const prefix = op === 'p' || op === 'P' ? r.pick(['', '"a', '"0']) : '';
  return body + prefix + op + (typedOps.includes(op) ? typed(r) : '');
}

export interface FuzzCase {
  lines: string[];
  at: Pos;
  units: string[];
}

export function genCase(seed: number, opts: { objects?: boolean; ops?: boolean; edits?: boolean; visual?: boolean; len?: number } = {}): FuzzCase {
  const r = rng(seed);
  const lines = r.pick(BUFFERS);
  const at = { row: r.int(lines.length), col: 0 };
  at.col = r.int(Math.max(1, lines[at.row]!.length));
  const n = 1 + r.int(opts.len ?? 6);
  const units: string[] = [];
  // Lockstep emulator: text for a change command is only typed when it really entered insert mode.
  const probe = createVimEngine();
  probe.reset({ lines, cursor: at });
  for (let i = 0; i < n; i++) {
    let unit: string;
    if (opts.visual && r.chance(0.5)) unit = visualCommand(r, opts.objects === true);
    else if (opts.ops !== false && r.chance(0.5)) unit = opCommand(r, opts.objects === true);
    else if (opts.edits !== false && r.chance(0.7)) unit = editCommand(r);
    else unit = motion(r);
    const cut = unit.indexOf(TYPED);
    if (cut >= 0) {
      const head = unit.slice(0, cut);
      for (const k of keysOf(head)) probe.feed(k);
      if (probe.state.mode === 'insert') {
        const text = typedText(r);
        for (const k of keysOf(text)) probe.feed(k);
        unit = head + text;
      } else unit = head;
    } else {
      for (const k of keysOf(unit)) probe.feed(k);
    }
    units.push(unit);
  }
  return { lines, at, units };
}

function same(a: Outcome, b: Outcome, regs: boolean): boolean {
  return (
    JSON.stringify(a.lines) === JSON.stringify(b.lines) &&
    a.row === b.row &&
    a.col === b.col &&
    (!regs || JSON.stringify(a.regs) === JSON.stringify(b.regs))
  );
}

export function differs(c: FuzzCase, regs: boolean): { real: Outcome; mine: Outcome } | null {
  const keys = keysOf(c.units.join(''));
  const real = runRealVim(c.lines, c.at, keys);
  let mine: Outcome;
  try {
    mine = runEmulator(c.lines, c.at, keys);
  } catch (e) {
    mine = { lines: ['EXCEPTION ' + String(e)], row: -1, col: -1, regs: {} };
  }
  return same(real, mine, regs) ? null : { real, mine };
}

/** Drop units while the case still differs, to give a minimal repro. */
export function shrink(c: FuzzCase, regs: boolean): FuzzCase {
  let cur = c;
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < cur.units.length; i++) {
      const trial = { ...cur, units: cur.units.filter((_, j) => j !== i) };
      if (trial.units.length > 0 && differs(trial, regs)) {
        cur = trial;
        progress = true;
        break;
      }
    }
  }
  return cur;
}

export function describeFailure(seed: number, c: FuzzCase, regs: boolean): string {
  const small = shrink(c, regs);
  const d = differs(small, regs)!;
  return [
    `seed ${seed}`,
    `buffer: ${JSON.stringify(small.lines)}`,
    `start:  ${small.at.row},${small.at.col}`,
    `keys:   ${small.units.join('')}`,
    `real:   ${JSON.stringify(d.real)}`,
    `mine:   ${JSON.stringify(d.mine)}`,
  ].join('\n');
}
