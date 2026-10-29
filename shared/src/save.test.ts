import { describe, expect, it } from 'vitest';
import { createSave, type StorageLike } from './save';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { map: Record<string, string> } {
  const map = { ...initial };
  return {
    map,
    getItem: (k) => map[k] ?? null,
    setItem: (k, v) => {
      map[k] = v;
    },
  };
}

const throwing: StorageLike = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('createSave', () => {
  it('persists records and reloads them', () => {
    const storage = memoryStorage();
    createSave(storage).record('vim-w1-01', 6, 2);
    const reloaded = createSave(storage);
    expect(reloaded.data.levels['vim-w1-01']).toEqual({ stars: 2, best: 6 });
    expect(reloaded.isSolved('vim-w1-01')).toBe(true);
    expect(reloaded.isSolved('vim-w1-02')).toBe(false);
  });

  it('keeps the best stars and fewest keystrokes across attempts', () => {
    const save = createSave(memoryStorage());
    save.record('a', 8, 2);
    save.record('a', 12, 1);
    expect(save.data.levels['a']).toEqual({ stars: 2, best: 8 });
    save.record('a', 5, 3);
    expect(save.data.levels['a']).toEqual({ stars: 3, best: 5 });
  });

  it('sums stars', () => {
    const save = createSave(memoryStorage());
    save.record('a', 1, 3);
    save.record('b', 1, 2);
    expect(save.totalStars()).toBe(5);
  });

  it('remembers mute', () => {
    const storage = memoryStorage();
    createSave(storage).setMuted(true);
    expect(createSave(storage).data.muted).toBe(true);
  });

  it('starts fresh on corrupt or wrong-version data', () => {
    const key = 'keyboard-mastery:save';
    expect(createSave(memoryStorage({ [key]: '{nope' })).data.levels).toEqual({});
    expect(createSave(memoryStorage({ [key]: '{"version":9,"levels":{}}' })).data.levels).toEqual({});
  });

  it('works in memory when storage throws or is missing', () => {
    for (const storage of [throwing, null]) {
      const save = createSave(storage);
      expect(() => save.record('a', 3, 3)).not.toThrow();
      expect(save.isSolved('a')).toBe(true);
    }
  });

  it('reset clears progress', () => {
    const storage = memoryStorage();
    const save = createSave(storage);
    save.record('a', 3, 3);
    save.reset();
    expect(createSave(storage).totalStars()).toBe(0);
  });
});
