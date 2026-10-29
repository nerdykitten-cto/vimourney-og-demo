import { describe, it } from 'vitest';
import { compareAll } from './table';
import { hasVim } from './vimRunner';

const suite = hasVim ? describe : describe.skip;

suite('text objects match real Vim', () => {
  const objects = ['iw', 'aw', 'iW', 'aW', '2iw', '2aw', '3aw', 'ip', 'ap', '2ap', 'i(', 'a(', 'ib', 'ab', 'i)', 'a)', 'i[', 'a[', 'i]', 'i{', 'a{', 'iB', 'aB', 'i}', 'i<', 'i"', 'a"', "i'", "a'", 'i`', '2i"', '2i(', '2a('];
  for (const op of ['d', 'c', 'y']) {
    it(`${op} + object`, () => {
      const tail = op === 'c' ? 'X<Esc>' : op === 'y' ? 'P' : '';
      compareAll(
        objects.map((o) => op + o + tail),
        { buffers: [0, 2, 5], stride: 2 },
      );
    });
  }
});
