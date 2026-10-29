import { describe, expect, it } from 'vitest';
import { starsFor, twoStarLimit } from './scoring';

describe('starsFor', () => {
  it('gives 3 stars at or under par', () => {
    expect(starsFor(4, 4)).toBe(3);
    expect(starsFor(2, 4)).toBe(3);
  });

  it('gives 2 stars up to par + 25% rounded up', () => {
    expect(twoStarLimit(4)).toBe(5);
    expect(twoStarLimit(8)).toBe(10);
    expect(twoStarLimit(5)).toBe(7);
    expect(starsFor(5, 4)).toBe(2);
    expect(starsFor(10, 8)).toBe(2);
  });

  it('gives 1 star for any slower solve', () => {
    expect(starsFor(6, 4)).toBe(1);
    expect(starsFor(500, 4)).toBe(1);
  });
});
