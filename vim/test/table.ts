import { expect } from 'vitest';
import type { Pos } from '@kbm/shared';
import { BUFFERS } from './fuzz';
import { keysOf, runEmulator, runRealVim } from './vimRunner';

/** Start positions spread over a buffer: start/middle/end of several lines, including blank ones. */
export function spread(lines: string[]): Pos[] {
  const out: Pos[] = [];
  for (let row = 0; row < lines.length; row += 1) {
    const len = lines[row]!.length;
    for (const col of new Set([0, Math.floor(len / 2), Math.max(0, len - 1)])) out.push({ row, col });
  }
  return out;
}

function mismatch(keys: string, lines: string[], at: Pos): string | null {
  const ks = keysOf(keys);
  const real = runRealVim(lines, at, ks);
  let mine;
  try {
    mine = runEmulator(lines, at, ks);
  } catch (e) {
    return `${JSON.stringify(keys)} @${at.row},${at.col}: emulator threw ${String(e)}`;
  }
  const parts: string[] = [];
  if (JSON.stringify(real.lines) !== JSON.stringify(mine.lines)) parts.push(`lines real=${JSON.stringify(real.lines)} mine=${JSON.stringify(mine.lines)}`);
  if (real.row !== mine.row || real.col !== mine.col) parts.push(`cursor real=${real.row},${real.col} mine=${mine.row},${mine.col}`);
  if (JSON.stringify(real.regs) !== JSON.stringify(mine.regs)) {
    const bad = Object.keys(real.regs).filter((k) => real.regs[k] !== mine.regs[k]);
    parts.push(`regs ${bad.map((k) => `${k}: real=${JSON.stringify(real.regs[k])} mine=${JSON.stringify(mine.regs[k])}`).join('; ')}`);
  }
  return parts.length ? `${JSON.stringify(keys)} @${at.row},${at.col} in buffer ${JSON.stringify(lines).slice(0, 60)}: ${parts.join(' | ')}` : null;
}

/** Run every key sequence from every start position of every buffer and compare with real Vim. */
export function compareAll(keys: string[], opts: { buffers?: number[]; stride?: number } = {}): void {
  const failures: string[] = [];
  for (const bi of opts.buffers ?? [0, 5]) {
    const lines = BUFFERS[bi]!;
    const starts = spread(lines).filter((_, i) => i % (opts.stride ?? 3) === 0);
    for (const k of keys) {
      for (const at of starts) {
        const m = mismatch(k, lines, at);
        if (m) {
          failures.push(m);
          break; // one example per key sequence and buffer is enough
        }
      }
    }
  }
  expect(failures.join('\n')).toBe('');
}
