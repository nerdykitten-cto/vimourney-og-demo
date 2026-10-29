import { describe, expect, it } from 'vitest';
import { checkGoal, isKeyAllowed, type EngineState, type Level } from '@kbm/shared';
import { editor } from '../src';

/**
 * Searches for a solution shorter than a level's par, using only keys the level allows. Breadth-first
 * over distinct editor states (buffer, cursor, mode, half-typed command, registers), so it finds
 * what a clever player could do. Hidden state (undo history, the `.` register) is not part of a state,
 * so a trick that relies only on that could be missed.
 */
function shorterSolution(level: Level, limit: number): string[] | 'too-big' | null {
  const run = (keys: string[]): EngineState => {
    const e = editor.createEngine();
    e.reset({ lines: level.start.lines, cursor: level.start.cursor });
    for (const k of keys) e.feed(k);
    return e.state;
  };
  const fingerprint = (s: EngineState): string =>
    JSON.stringify([s.lines, s.cursor, s.mode, s.pending, s.registers, s.visualAnchor]);

  // Keys worth trying: everything unlocked, plus characters that appear in the text for typing.
  const typed = new Set<string>([' ']);
  for (const line of [...level.start.lines, ...(level.goal.text ?? [])]) for (const ch of line) typed.add(ch);
  // Text worth typing in Insert mode: what the goal contains (typing anything else cannot help).
  const wanted = new Set<string>(level.goal.text ? level.goal.text.join('').split('') : []);
  const alphabetFor = (s: EngineState): string[] => {
    const keys = new Set<string>(level.allowedKeys);
    if (level.typing && s.mode === 'insert') for (const k of level.typing === 'any' ? [...wanted, 'Enter', 'Backspace'] : level.typing) keys.add(k);
    // Arguments of f/t/r: characters of the text.
    if (s.pending.awaiting && ['f', 'F', 't', 'T', 'r'].includes(s.pending.awaiting)) for (const ch of typed) keys.add(ch);
    return [...keys].filter((k) => isKeyAllowed(level, k, { mode: s.mode, awaiting: s.pending.awaiting }) || keys.has(k));
  };

  const seen = new Set<string>();
  let frontier: string[][] = [[]];
  seen.add(fingerprint(run([])));
  for (let depth = 1; depth < level.par; depth++) {
    const next: string[][] = [];
    for (const seq of frontier) {
      const before = run(seq);
      for (const k of alphabetFor(before)) {
        if (!isKeyAllowed(level, k, { mode: before.mode, awaiting: before.pending.awaiting })) continue;
        const after = run([...seq, k]);
        if (checkGoal(level.goal, after)) return [...seq, k];
        const fp = fingerprint(after);
        if (seen.has(fp)) continue;
        seen.add(fp);
        next.push([...seq, k]);
      }
      if (next.length > limit) return 'too-big'; // too many states to search exhaustively
    }
    frontier = next;
  }
  return null;
}

const skipped: string[] = [];

describe('par is not beatable', () => {
  for (const world of editor.worlds) {
    it(`${world.id}: no allowed key sequence is shorter than par`, () => {
      const beaten: string[] = [];
      for (const level of world.levels) {
        const found = shorterSolution(level, 150000);
        if (found === 'too-big') skipped.push(level.id);
        else if (found) beaten.push(`${level.id} par ${level.par} but ${JSON.stringify(found)} (${found.length}) works`);
      }
      expect(beaten).toEqual([]);
    });
  }
});

describe('par search coverage', () => {
  it('searched nearly every level exhaustively', () => {
    // Levels that ask for typed text have too many states to enumerate. Each of these was checked by hand:
    // the typed text is the goal's own text, and no command shortcut exists in what the level allows.
    expect([...skipped].sort()).toEqual(
      ['vim-1-05', 'vim-1-08', 'vim-4-06', 'vim-4-09', 'vim-5-03', 'vim-5-04', 'vim-5-06', 'vim-6-03', 'vim-6-04', 'vim-6-05', 'vim-6-06'].sort(),
    );
  });
});
