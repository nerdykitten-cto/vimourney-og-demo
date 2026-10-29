import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pos } from '@kbm/shared';
import { createVimEngine } from '../src';

/** True when a real `vim` binary is available for differential tests. */
export const hasVim: boolean = (() => {
  try {
    return spawnSync('vim', ['--version']).status === 0;
  } catch {
    return false;
  }
})();

export interface Outcome {
  lines: string[];
  row: number;
  col: number;
  /** Register contents by name; linewise text ends with "\n". */
  regs: Record<string, string>;
}

const SPECIAL: Record<string, string> = {
  Escape: '\\<Esc>',
  Enter: '\\<CR>',
  Backspace: '\\<BS>',
  Delete: '\\<Del>',
  Tab: '\\<Tab>',
  'Control-r': '\\<C-r>',
  'Control-v': '\\<C-v>',
  'Control-w': '\\<C-w>',
  'Control-u': '\\<C-u>',
  'Control-h': '\\<C-h>',
};

function vimString(keys: string[]): string {
  return keys
    .map((k) => {
      if (k in SPECIAL) return SPECIAL[k]!;
      if (k.length !== 1) throw new Error(`unsupported key ${k}`);
      return k === '\\' ? '\\\\' : k === '"' ? '\\"' : k;
    })
    .join('');
}

const REG_NAMES = ['"', '0', '1', '2', '3', '-', 'a', 'b'];

/** Run `keys` through real Vim headless and read back buffer, cursor and registers. */
export function runRealVim(lines: string[], cursor: Pos, keys: string[]): Outcome {
  const dir = mkdtempSync(join(tmpdir(), 'kbm-vim-'));
  try {
    const file = join(dir, 'buf.txt');
    writeFileSync(file, lines.join('\n') + '\n');
    const regDump = REG_NAMES.map((r) => `'${r === '"' ? '"' : r}': getreg('${r}')`).join(',');
    writeFileSync(
      join(dir, 's.vim'),
      [
        `call cursor(${cursor.row + 1}, ${cursor.col + 1})`,
        `call feedkeys("${vimString(keys)}", 'xt')`,
        `call writefile([json_encode({'lines': getline(1,'$'), 'row': line('.')-1, 'col': col('.')-1, 'regs': {${regDump}}})], '${join(dir, 'out.json')}')`,
        'qa!',
        '',
      ].join('\n'),
    );
    try {
      execFileSync('vim', ['-Nu', 'DEFAULTS', '-i', 'NONE', '-n', '-es', file, '-S', join(dir, 's.vim')], { stdio: 'ignore', timeout: 10000 });
    } catch (e) {
      // Vim exits non-zero after an error message (e.g. a failed command); the result file is what counts.
      if (!existsSync(join(dir, 'out.json'))) throw e;
    }
    const raw = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8')) as Outcome;
    const regs: Record<string, string> = {};
    for (const r of REG_NAMES) regs[r] = raw.regs[r] ?? '';
    return { ...raw, regs };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Run `keys` through the emulator. */
export function runEmulator(lines: string[], cursor: Pos, keys: string[]): Outcome {
  const e = createVimEngine();
  e.reset({ lines, cursor });
  let st = e.state;
  for (const k of keys) st = e.feed(k);
  // Real Vim ends an unfinished insert when the typeahead runs out, as if <Esc> was typed.
  if (st.mode === 'insert') st = e.feed('Escape');
  const regs: Record<string, string> = {};
  for (const r of REG_NAMES) regs[r] = st.registers[r]?.text ?? '';
  return { lines: [...st.lines], row: st.cursor.row, col: st.cursor.col, regs };
}

/** Split "dw2x" style strings into keys; `<Esc>`, `<CR>`, `<BS>`, `<C-r>` style tokens are single keys. */
export function keysOf(s: string): string[] {
  const out: string[] = [];
  const names: Record<string, string> = {
    '<Esc>': 'Escape',
    '<CR>': 'Enter',
    '<BS>': 'Backspace',
    '<Del>': 'Delete',
    '<Tab>': 'Tab',
    '<C-r>': 'Control-r',
    '<C-v>': 'Control-v',
    '<C-w>': 'Control-w',
    '<C-u>': 'Control-u',
    '<C-h>': 'Control-h',
  };
  for (let i = 0; i < s.length; ) {
    if (s[i] === '<') {
      const close = s.indexOf('>', i);
      const token = close > 0 ? s.slice(i, close + 1) : '';
      if (token in names) {
        out.push(names[token]!);
        i = close + 1;
        continue;
      }
    }
    out.push(s[i]!);
    i++;
  }
  return out;
}
