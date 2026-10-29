import { expect } from 'vitest';
import type { Pos } from '@kbm/shared';
import { keysOf, runEmulator, runRealVim } from './vimRunner';

export const SAMPLE = [
  'hello world foo.bar baz',
  '',
  '  indented line (with parens) here',
  'second-line, with: punctuation!',
  '',
  '',
  'last paragraph word',
  'tail',
];

export interface Case {
  keys: string;
  lines?: string[];
  at?: Pos;
  /** Compare registers too (default true). */
  regs?: boolean;
}

/** Assert emulator and real Vim agree on buffer, cursor and registers after `c.keys`. */
export function expectSame(c: Case): void {
  const lines = c.lines ?? SAMPLE;
  const at = c.at ?? { row: 0, col: 0 };
  const keys = keysOf(c.keys);
  const real = runRealVim(lines, at, keys);
  const mine = runEmulator(lines, at, keys);
  const label = `keys=${JSON.stringify(c.keys)} at=${at.row},${at.col}`;
  expect({ label, lines: mine.lines }).toEqual({ label, lines: real.lines });
  expect({ label, cursor: [mine.row, mine.col] }).toEqual({ label, cursor: [real.row, real.col] });
  if (c.regs !== false) expect({ label, regs: mine.regs }).toEqual({ label, regs: real.regs });
}
