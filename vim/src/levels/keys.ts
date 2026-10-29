import type { Level } from '@kbm/shared';

/** Turn "fa<Esc>" into engine keys: ['f', 'a', 'Escape']. */
export function K(s: string): string[] {
  const names: Record<string, string> = { '<Esc>': 'Escape', '<CR>': 'Enter', '<BS>': 'Backspace', '<C-v>': 'Control-v', '<C-r>': 'Control-r' };
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    const close = s[i] === '<' ? s.indexOf('>', i) : -1;
    const token = close > 0 ? s.slice(i, close + 1) : '';
    if (token in names) {
      out.push(names[token]!);
      i = close + 1;
    } else {
      out.push(s[i]!);
      i++;
    }
  }
  return out;
}

const chars = (s: string): string[] => [...s];

/** Keys unlocked world by world. A level allows everything unlocked so far. */
export const MOVE = chars('hjkl');
export const W1 = [...MOVE, 'i', 'a', 'o', 'Escape'];
export const W2 = [...W1, ...chars('wbeWBE')];
export const W3 = [...W2, '0', '^', '$', 'f', 'F', 't', 'T', ';', ',', 'G', 'g', 'I', 'A', 'O'];
export const W4 = [...W3, ...chars('xXdcypPDCsSJ~r.u'), 'Control-r', ...chars('123456789')];
export const W5 = [...W4, '"', "'", '`', '(', ')', '[', ']', '{', '}', '<', '>'];
export const W6 = [...W5, 'v', 'V', 'Control-v', 'U'];

export interface Def {
  title: string;
  brief: string;
  lines: string[];
  at?: [number, number];
  goal: { text?: string[]; cursor?: [number, number] };
  /** The par solution, written like "fa<Esc>". Its length is the level's par. */
  keys: string;
  allowed: string[];
  /** The level asks for typed text. */
  typing?: boolean;
  hint: [nudge: string, command: string];
  card?: string;
}

export function level(world: number, n: number, d: Def): Level {
  const keys = K(d.keys);
  return {
    id: `vim-${world}-${String(n).padStart(2, '0')}`,
    world: `vim-${world}`,
    title: d.title,
    brief: d.brief,
    start: { lines: d.lines, cursor: { row: d.at?.[0] ?? 0, col: d.at?.[1] ?? 0 } },
    goal: {
      // A cursor-only goal also means the text must come out unchanged.
      text: d.goal.text ?? (d.goal.cursor ? d.lines : undefined),
      cursor: d.goal.cursor ? { row: d.goal.cursor[0], col: d.goal.cursor[1] } : undefined,
    },
    par: keys.length,
    allowedKeys: d.allowed,
    typing: d.typing ? 'any' : undefined,
    parSolution: keys,
    hints: { nudge: d.hint[0], command: d.hint[1] },
    introCard: d.card,
  };
}
