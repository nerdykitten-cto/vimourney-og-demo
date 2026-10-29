import { describe, expect, it } from 'vitest';
import { createStore } from './storage';
import { levelFor, Mastery, progressFor } from './mastery';

describe('mastery', () => {
  it('maps uses to levels', () => {
    expect([0, 1, 9, 10, 29, 30, 59, 60, 99, 100, 500].map(levelFor)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('reports progress inside a level', () => {
    expect(progressFor(0)).toBe(0);
    expect(progressFor(5.5)).toBeCloseTo((5.5 - 1) / 9);
    expect(progressFor(200)).toBe(1);
  });

  it('counts only effective uses and persists', () => {
    const store = createStore('test-m:');
    const m = new Mastery(store);
    m.record('w', true);
    m.record('w', false);
    m.record('w', true);
    expect(m.uses('w')).toBe(2);
    expect(m.level('w')).toBe(1);
    expect(new Mastery(store).uses('w')).toBe(2);
  });

  it('raises character level with XP', () => {
    const m = new Mastery(createStore('test-xp:'));
    expect(m.characterLevel).toBe(1);
    m.addXp(80);
    expect(m.characterLevel).toBe(3);
  });
});
