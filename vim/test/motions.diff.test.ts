import { describe, it } from 'vitest';
import { expectSame, SAMPLE } from './diff';
import { hasVim } from './vimRunner';

const suite = hasVim ? describe : describe.skip;

const starts = [
  { row: 0, col: 0 },
  { row: 0, col: 4 },
  { row: 0, col: 12 },
  { row: 2, col: 5 },
  { row: 3, col: 10 },
  { row: 6, col: 8 },
  { row: 7, col: 3 },
];

suite('basic motions match real Vim', () => {
  const motions = ['h', 'l', 'j', 'k', '3l', '2j', '5h', '0', '$', '^', 'w', 'b', 'e', 'W', 'B', 'E', 'ge', 'gE', '3w', '2b', '4e', 'G', 'gg', '3G', '2gg', '_', '2_', '{', '}', '2}', '3{', '%'];
  for (const m of motions) {
    it(`motion ${m}`, () => {
      for (const at of starts) expectSame({ keys: m, at });
    });
  }

  it('column memory across j/k', () => {
    expectSame({ keys: '$jj', at: { row: 0, col: 0 } });
    expectSame({ keys: 'wwwjjk', at: { row: 0, col: 0 } });
    expectSame({ keys: 'lllllljjjkk', at: { row: 0, col: 0 } });
  });

  it('insert basics', () => {
    expectSame({ keys: 'ixy<Esc>' });
    expectSame({ keys: 'Aend<Esc>' });
    expectSame({ keys: 'Istart<Esc>' });
    expectSame({ keys: 'jjIfoo<Esc>' });
    expectSame({ keys: 'oabc<Esc>' });
    expectSame({ keys: 'Oabc<Esc>' });
    expectSame({ keys: 'ajkl<Esc>' });
    expectSame({ keys: 'wiX<CR>Y<Esc>' });
    expectSame({ keys: 'jjjaZ<Esc>' });
  });

  it('SAMPLE sanity', () => {
    expectSame({ keys: '', at: { row: SAMPLE.length - 1, col: 0 } });
  });
});
