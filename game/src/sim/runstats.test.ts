import { describe, expect, it } from 'vitest';
import { PlaytestLog } from './log';
import { clockTime, runStats, shareCaption } from './runstats';
import { createStore } from './storage';

const logWith = (...events: [string, Record<string, unknown>?][]): PlaytestLog => {
  const log = new PlaytestLog(createStore(`runstats-test-${Math.random()}:`));
  for (const [ev, data] of events) log.add(ev, data);
  return log;
};

describe('runStats', () => {
  it('starts empty', () => {
    expect(runStats([])).toMatchObject({ fightsWon: 0, fightsLost: 0, topKey: null, arcadeRounds: 0, bestScore: 0, extraKeysPerTarget: 0 });
  });

  it('adds up fights, counting a retreat as not won', () => {
    const log = logWith(
      ['battle-won', { enemy: 'sentry', seconds: 20, wasted: 1, moves: { w: 3, x: 2 } }],
      ['battle-lost', { enemy: 'warden', seconds: 40, wasted: 2, moves: { w: 1, b: 5 } }],
      ['retreat', { enemy: 'patrol', wasted: 0, moves: { j: 1 } }],
    );
    expect(runStats(log.run)).toMatchObject({ fightsWon: 1, fightsLost: 2, bossesBeaten: 0, wastedStrikes: 3, seconds: 60, topKey: 'b' });
  });

  it('counts each boss once, and only when beaten', () => {
    const log = logWith(['battle-lost', { enemy: 'seeker' }], ['battle-won', { enemy: 'warden' }], ['battle-won', { enemy: 'warden' }]);
    expect(runStats(log.run).bossesBeaten).toBe(1);
  });

  it('adds up finished arcade rounds and ignores quit ones', () => {
    const log = logWith(
      ['arcade-end', { score: 200, captures: 6, wastedKeys: 3, hintsShown: 1 }],
      ['arcade-end', { score: 90, captures: 2, wastedKeys: 1, hintsShown: 2 }],
      ['arcade-quit', { score: 900, captures: 40 }],
    );
    expect(runStats(log.run)).toMatchObject({ arcadeRounds: 2, bestScore: 200, targets: 8, extraKeysPerTarget: 0.5, hints: 3 });
  });

  it('reads old events that lack newer fields', () => {
    const log = logWith(['battle-won', { enemy: 'sentry', seconds: 21 }], ['arcade-end', { score: 200, captures: 6 }]);
    expect(runStats(log.run)).toMatchObject({ fightsWon: 1, seconds: 21, topKey: null, hints: 0, extraKeysPerTarget: 0 });
  });

  it('only sees the run since the last reset', () => {
    const log = logWith(['battle-won', { enemy: 'warden' }], ['arcade-end', { score: 500, captures: 9 }], ['reset'], ['battle-won', { enemy: 'sentry' }]);
    expect(runStats(log.run)).toMatchObject({ fightsWon: 1, bossesBeaten: 0, arcadeRounds: 0, bestScore: 0 });
  });
});

describe('shareCaption', () => {
  it('names the run and links back to the game', () => {
    const stats = runStats(logWith(['arcade-end', { score: 340, captures: 9 }]).run);
    expect(shareCaption(stats, 4, '1/2', '0/2', 'https://example.com')).toBe(
      'Level 4 in Vimourney, the Vim action RPG: 1/2 areas cleared, 0/2 bosses beaten, best arcade score 340. Can you beat it? https://example.com',
    );
  });
});

describe('clockTime', () => {
  it('shows minutes only when there are any', () => {
    expect(clockTime(0)).toBe('0s');
    expect(clockTime(59)).toBe('59s');
    expect(clockTime(372)).toBe('6m 12s');
  });
});
