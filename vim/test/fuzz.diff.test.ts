import { describe, expect, it } from 'vitest';
import { describeFailure, differs, genCase } from './fuzz';
import { hasVim } from './vimRunner';

const suite = hasVim ? describe : describe.skip;

/**
 * Random command sequences, run through the emulator and real Vim; buffer, cursor and registers must match.
 * Seeds are fixed so a failure reproduces: FUZZ_SEED=<n> FUZZ_N=1 reruns one case (the message prints the seed).
 * Visual-mode fuzzing is opt-in (FUZZ_VISUAL=1): a few block-mode corner cases are known gaps, see README.
 */
const N = Number(process.env.FUZZ_N ?? 300);
const START = Number(process.env.FUZZ_SEED ?? 1);
const CAP = Number(process.env.FUZZ_CAP ?? 3);

function run(opts: { objects: boolean; visual: boolean }): void {
  const failures: string[] = [];
  for (let seed = START; seed < START + N && failures.length < CAP; seed++) {
    const c = genCase(seed, opts);
    if (differs(c, true)) failures.push(describeFailure(seed, c, true));
  }
  expect(failures.join('\n\n')).toBe('');
}

suite('fuzz: emulator agrees with real Vim', () => {
  it(`${N} random normal-mode sequences from seed ${START}`, () => run({ objects: true, visual: false }));
  const visual = process.env.FUZZ_VISUAL === '1' ? it : it.skip;
  visual(`${N} random sequences including Visual mode from seed ${START}`, () => run({ objects: process.env.FUZZ_OBJECTS === '1', visual: true }));
});
