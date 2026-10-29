import { describe, expect, it } from 'vitest';
import { fakeEngine } from './fakeEngine';
import type { Level } from './level';
import { Session } from './session';

const level: Level = {
  id: 't',
  world: 'w',
  title: 't',
  brief: 'b',
  start: { lines: ['abc'], cursor: { row: 0, col: 0 } },
  goal: { cursor: { row: 0, col: 2 } },
  par: 2,
  allowedKeys: ['l'],
  parSolution: ['l', 'l'],
  hints: { nudge: '', command: '' },
};

describe('Session', () => {
  it('counts keystrokes and notices the goal', () => {
    const s = new Session(fakeEngine(), level);
    expect(s.feed('l')).toMatchObject({ kind: 'ok', solved: false });
    expect(s.feed('l')).toMatchObject({ kind: 'ok', solved: true });
    expect(s.keystrokes).toBe(2);
    expect(s.solvedAt).toBe(2);
  });

  it('blocks keys the level does not allow, without counting them', () => {
    const s = new Session(fakeEngine(), level);
    expect(s.feed('x')).toEqual({ kind: 'blocked', key: 'x' });
    expect(s.keystrokes).toBe(0);
    expect(s.engine.state.lines).toEqual(['abc']);
  });

  it('ignores further keys once solved', () => {
    const s = new Session(fakeEngine(), level);
    s.feed('l');
    s.feed('l');
    s.feed('l');
    expect(s.keystrokes).toBe(2);
    expect(s.engine.state.cursor.col).toBe(2);
  });

  it('restart resets the engine and the counters', () => {
    const s = new Session(fakeEngine(), level);
    s.feed('l');
    s.restart();
    expect(s.keystrokes).toBe(0);
    expect(s.solved).toBe(false);
    expect(s.engine.state.cursor.col).toBe(0);
  });

  it('allows every key in free play', () => {
    const s = new Session(fakeEngine(), null);
    s.load(['abc']);
    expect(s.feed('x')).toMatchObject({ kind: 'ok' });
    expect(s.engine.state.lines).toEqual(['bc']);
  });
});
