import type { World } from '@kbm/shared';
import { level, W1, W2 } from './keys';

const WORD_KEYS = [...W1, 'w', 'b', 'e'];

/** World 2: words. */
export const world2: World = {
  id: 'vim-2',
  title: 'Words',
  flavor: 'Single steps are slow. Cross whole words in one keypress.',
  levels: [
    level(2, 1, {
      title: 'Word hopping',
      brief: 'Hop onto the f of four.',
      lines: ['one two three four'],
      goal: { cursor: [0, 14] },
      keys: 'www',
      allowed: [...W1, 'w'],
      hint: ['You can jump a whole word at a time.', 'w moves to the start of the next word.'],
      card: 'words',
    }),
    level(2, 2, {
      title: 'Word back',
      brief: 'Go back to the start of two.',
      lines: ['one two three four'],
      at: [0, 14],
      goal: { cursor: [0, 4] },
      keys: 'bb',
      allowed: [...W1, 'w', 'b'],
      hint: ['Backwards works by word too.', 'b moves to the start of the previous word.'],
    }),
    level(2, 3, {
      title: 'Word ends',
      brief: 'Land on the last a of gamma.',
      lines: ['alpha beta gamma'],
      goal: { cursor: [0, 15] },
      keys: 'eee',
      allowed: WORD_KEYS,
      hint: ['There is a motion that stops at the end of a word.', 'e moves to the end of the current or next word.'],
    }),
    level(2, 4, {
      title: 'Big words',
      brief: 'Get to baz in one keypress.',
      lines: ['foo.bar baz'],
      goal: { cursor: [0, 8] },
      keys: 'W',
      allowed: W2,
      hint: ['w stops at punctuation. A capital letter ignores it.', 'W jumps over everything up to the next space.'],
      card: 'bigword',
    }),
    level(2, 5, {
      title: 'Big word back',
      brief: 'Back to the start of baz, using as few keys as you can.',
      lines: ['foo.bar baz qux.quux'],
      at: [0, 19],
      goal: { cursor: [0, 8] },
      keys: 'BB',
      allowed: W2,
      hint: ['Two words back, and punctuation does not count.', 'B moves back one space-separated word.'],
    }),
    level(2, 6, {
      title: 'Mix and match',
      brief: 'Get onto four. Combine line moves and word moves.',
      lines: ['one two', 'three four'],
      goal: { cursor: [1, 6] },
      keys: 'jw',
      allowed: W2,
      hint: ['Go down a line first, then hop.', 'j moves down, w hops to the next word.'],
    }),
    level(2, 7, {
      title: 'Ends of big words',
      brief: 'Land on the ; at the very end.',
      lines: ['x = foo(bar, baz);'],
      goal: { cursor: [0, 17] },
      keys: 'EEE',
      allowed: W2,
      hint: ['Big words end at spaces, punctuation and all.', 'E jumps to the end of the next space-separated word.'],
    }),
    level(2, 8, {
      title: 'Cross the line',
      brief: 'Land on the x of tax.',
      lines: ['let total = price + tax;'],
      goal: { cursor: [0, 22] },
      keys: 'wwwwe',
      allowed: W2,
      hint: ['Hop along, then finish with a word end.', 'w four times, then e.'],
    }),
  ],
};
