import { describe, expect, it } from 'vitest';
import { fakeEngine } from './fakeEngine';
import type { Level } from './level';
import { findLevel, isWorldUnlocked, nextLevel, sandboxUnlocked, worldStars } from './progress';
import { computeReplay } from './replay';
import { createSave, type StorageLike } from './save';
import type { World } from './world';

const mem = (): StorageLike => {
  const m: Record<string, string> = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => void (m[k] = v) };
};

const lvl = (id: string): Level => ({
  id,
  world: 'w',
  title: id,
  brief: '',
  start: { lines: ['abc'], cursor: { row: 0, col: 0 } },
  goal: { cursor: { row: 0, col: 2 } },
  par: 2,
  allowedKeys: ['l'],
  parSolution: ['l', 'l'],
  hints: { nudge: '', command: '' },
});

const worlds: World[] = [
  { id: 'a', title: 'A', flavor: '', levels: [lvl('a1'), lvl('a2')] },
  { id: 'b', title: 'B', flavor: '', levels: [lvl('b1')] },
  { id: 'c', title: 'C', flavor: '', levels: [lvl('c1')] },
];

describe('progress', () => {
  it('opens worlds in order as the previous one is cleared', () => {
    const save = createSave(mem());
    expect(isWorldUnlocked(worlds, 0, save)).toBe(true);
    expect(isWorldUnlocked(worlds, 1, save)).toBe(false);
    save.record('a1', 2, 3);
    expect(isWorldUnlocked(worlds, 1, save)).toBe(false);
    save.record('a2', 5, 1);
    expect(isWorldUnlocked(worlds, 1, save)).toBe(true);
    expect(isWorldUnlocked(worlds, 2, save)).toBe(false);
  });

  it('unlocks the sandbox with the first world', () => {
    const save = createSave(mem());
    expect(sandboxUnlocked(worlds, save)).toBe(false);
    save.record('a1', 2, 3);
    save.record('a2', 2, 3);
    expect(sandboxUnlocked(worlds, save)).toBe(true);
  });

  it('adds up stars per world', () => {
    const save = createSave(mem());
    save.record('a1', 2, 3);
    save.record('a2', 3, 2);
    expect(worldStars(worlds[0]!, save)).toEqual({ got: 5, max: 6 });
  });

  it('finds the next level, crossing into an unlocked world only', () => {
    const save = createSave(mem());
    expect(nextLevel(worlds, 'a1', save)?.level.id).toBe('a2');
    expect(nextLevel(worlds, 'a2', save)).toBeNull();
    save.record('a1', 2, 3);
    save.record('a2', 2, 3);
    expect(nextLevel(worlds, 'a2', save)?.level.id).toBe('b1');
    expect(nextLevel(worlds, 'c1', save)).toBeNull();
    expect(nextLevel(worlds, 'nope', save)).toBeNull();
  });

  it('looks levels up by id', () => {
    expect(findLevel(worlds, 'b1')?.world.id).toBe('b');
    expect(findLevel(worlds, 'zzz')).toBeNull();
  });
});

describe('seen intro cards', () => {
  it('are remembered across saves', () => {
    const storage = mem();
    const a = createSave(storage);
    expect(a.hasSeenCard('hjkl')).toBe(false);
    a.markCardSeen('hjkl');
    a.markCardSeen('hjkl');
    const b = createSave(storage);
    expect(b.hasSeenCard('hjkl')).toBe(true);
    expect(b.data.seenCards).toEqual(['hjkl']);
  });
});

describe('computeReplay', () => {
  it('returns the start state plus one state per key', () => {
    const states = computeReplay(fakeEngine, { lines: ['abc'], cursor: { row: 0, col: 0 } }, ['l', 'l']);
    expect(states.map((s) => s.cursor.col)).toEqual([0, 1, 2]);
  });
});
