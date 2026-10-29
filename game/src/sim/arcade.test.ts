import { describe, expect, it } from 'vitest';
import { createVimEngine } from '@kbm/vim';
import { addHighScore, TargetRush } from './arcade';
import { createRng } from './rng';

describe('TargetRush', () => {
  it('builds a text block and picks a reachable target', () => {
    const g = new TargetRush(createVimEngine, createRng(7));
    expect(g.lines.length).toBe(7);
    expect(g.bestRoute.length).toBeGreaterThan(0);
    expect(g.lines[g.target.row]![g.target.col]).not.toBe(' ');
  });

  it('is deterministic for a seed', () => {
    const a = new TargetRush(createVimEngine, createRng(3));
    const b = new TargetRush(createVimEngine, createRng(3));
    expect(a.lines).toEqual(b.lines);
    expect(a.target).toEqual(b.target);
  });

  it('scores a capture by following the best route', () => {
    const g = new TargetRush(createVimEngine, createRng(11));
    const route = [...g.bestRoute];
    let capture = null;
    for (const k of route) capture = g.feed(k).capture ?? capture;
    expect(capture).not.toBeNull();
    expect(capture!.points).toBeGreaterThanOrEqual(110); // 100 + combo bonus
    expect(g.score).toBe(capture!.points);
    expect(g.combo).toBe(1);
  });

  it('a wasteful route scores less and resets the combo', () => {
    const g = new TargetRush(createVimEngine, createRng(11));
    g.combo = 5;
    const keys: string[] = [];
    let guard = 0;
    let got = null;
    while (!got && guard++ < 300) {
      const c = g.cursor;
      const t = g.target;
      const k = c.row < t.row ? 'j' : c.row > t.row ? 'k' : c.col < t.col ? 'l' : 'h';
      keys.push(k);
      got = g.feed(k).capture;
    }
    expect(got).not.toBeNull();
    if (keys.length > g.captures[0]!.best.length + 1) {
      expect(g.combo).toBe(0);
      expect(got!.points).toBeLessThan(100);
    }
  });

  it('refuses edit keys and stops when time is up', () => {
    const g = new TargetRush(createVimEngine, createRng(2));
    expect(g.feed('d').accepted).toBe(false);
    expect(g.feed('x').accepted).toBe(false);
    expect(g.tick(61)).toBe(true);
    expect(g.feed('l').accepted).toBe(false);
  });
});

describe('addHighScore', () => {
  it('keeps the best ten in order and returns the rank', () => {
    let table = Array.from({ length: 10 }, (_, i) => ({ score: (i + 1) * 100, captures: i, date: 'd' }));
    const r = addHighScore(table, { score: 550, captures: 3, date: 'e' });
    table = r.table;
    expect(r.rank).toBe(6);
    expect(table).toHaveLength(10);
    expect(table[0]!.score).toBe(1000);
    expect(addHighScore(table, { score: 1, captures: 0, date: 'f' }).rank).toBeNull();
  });
});
