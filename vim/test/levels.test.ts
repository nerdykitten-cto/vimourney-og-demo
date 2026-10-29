import { describe, expect, it } from 'vitest';
import { checkGoal, isKeyAllowed, type Level } from '@kbm/shared';
import { editor } from '../src';
import { runRealVim } from './vimRunner';
import { hasVim } from './vimRunner';

const all = editor.worlds.flatMap((w) => w.levels.map((l) => [w.id, l] as const));

function solveInEmulator(level: Level): { solved: boolean; at: number } {
  const e = editor.createEngine();
  e.reset({ lines: level.start.lines, cursor: level.start.cursor });
  let at = 0;
  for (const k of level.parSolution) {
    expect(isKeyAllowed(level, k, { mode: e.state.mode, awaiting: e.state.pending.awaiting }), `${level.id}: key ${k} in ${e.state.mode} mode`).toBe(true);
    e.feed(k);
    at++;
    if (checkGoal(level.goal, e.state)) return { solved: true, at };
  }
  return { solved: false, at };
}

describe('level data', () => {
  it('has unique ids and the right world', () => {
    const ids = all.map(([, l]) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [w, l] of all) expect(l.world).toBe(w);
  });

  it('refers only to intro cards that exist, and every card is used once', () => {
    const used: string[] = [];
    for (const [, l] of all) {
      if (l.introCard) {
        expect(editor.cards[l.introCard], l.id).toBeDefined();
        used.push(l.introCard);
      }
    }
    expect(new Set(used).size).toBe(used.length);
    expect(Object.keys(editor.cards).sort()).toEqual([...used].sort());
  });

  it('has about fifty levels', () => {
    expect(all.length).toBeGreaterThanOrEqual(50);
  });

  it('each intro card demo runs without error', () => {
    for (const card of Object.values(editor.cards)) {
      if (!card.demo) continue;
      const e = editor.createEngine();
      e.reset({ lines: card.demo.lines, cursor: card.demo.cursor });
      for (const k of card.demo.keys) e.feed(k);
    }
  });

  for (const [, level] of all) {
    describe(level.id, () => {
      it('does not start already solved', () => {
        const e = editor.createEngine();
        e.reset({ lines: level.start.lines, cursor: level.start.cursor });
        expect(checkGoal(level.goal, e.state)).toBe(false);
      });

      it('par is the length of the par solution', () => {
        expect(level.parSolution.length).toBe(level.par);
      });

      it('par solution solves it in the emulator, on its last key', () => {
        expect(solveInEmulator(level)).toEqual({ solved: true, at: level.par });
      });

      (hasVim ? it : it.skip)('par solution solves it in real Vim', () => {
        const real = runRealVim(level.start.lines, level.start.cursor, level.parSolution);
        const g = level.goal;
        if (g.text) expect(real.lines).toEqual(g.text);
        if (g.cursor) expect([real.row, real.col]).toEqual([g.cursor.row, g.cursor.col]);
      });
    });
  }
});
