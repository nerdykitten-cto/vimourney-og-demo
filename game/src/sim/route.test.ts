import { describe, expect, it } from 'vitest';
import { createVimEngine } from '@kbm/vim';
import { optimalRoute } from './route';

const f = createVimEngine;

describe('optimalRoute', () => {
  const lines = ['const answer = compute(forty, two);', 'return answer;'];

  it('finds a one-key route', () => {
    expect(optimalRoute(f, lines, { row: 0, col: 0 }, { row: 0, col: 6 })).toEqual(['w']);
    expect(optimalRoute(f, lines, { row: 0, col: 5 }, { row: 0, col: 4 })).toHaveLength(1);
  });

  it('prefers $ for the line end', () => {
    expect(optimalRoute(f, lines, { row: 0, col: 0 }, { row: 0, col: 34 })).toEqual(['$']);
  });

  it('uses f for a character far along the line', () => {
    const r = optimalRoute(f, lines, { row: 0, col: 0 }, { row: 0, col: 22 })!;
    expect(r).toEqual(['f', '(']);
  });

  it('crosses lines', () => {
    const r = optimalRoute(f, lines, { row: 0, col: 0 }, { row: 1, col: 0 })!;
    expect(r).toEqual(['j']);
  });

  it('returns [] when already there and null when out of reach', () => {
    expect(optimalRoute(f, lines, { row: 0, col: 3 }, { row: 0, col: 3 })).toEqual([]);
    expect(optimalRoute(f, lines, { row: 0, col: 0 }, { row: 1, col: 13 }, { maxKeys: 1 })).toBeNull();
  });

  it('never returns a route longer than the best simple alternative', () => {
    const r = optimalRoute(f, lines, { row: 0, col: 0 }, { row: 0, col: 15 })!;
    expect(r.length).toBeLessThanOrEqual(3);
  });
});
