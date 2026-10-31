import { BOSSES, type EnemyId } from './battle';
import type { LogEvent } from './log';

export interface RunStats {
  fightsWon: number;
  fightsLost: number;
  bossesBeaten: number;
  wastedStrikes: number;
  seconds: number;
  topKey: string | null;
  arcadeRounds: number;
  bestScore: number;
  targets: number;
  extraKeysPerTarget: number;
  hints: number;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

/** Adds up one run's log events. Older events lack some fields, which count as zero. */
export function runStats(events: readonly LogEvent[]): RunStats {
  const s: RunStats = { fightsWon: 0, fightsLost: 0, bossesBeaten: 0, wastedStrikes: 0, seconds: 0, topKey: null, arcadeRounds: 0, bestScore: 0, targets: 0, extraKeysPerTarget: 0, hints: 0 };
  const bosses = new Set<string>();
  const keys = new Map<string, number>();
  let extraKeys = 0;
  for (const e of events) {
    if (e.ev === 'battle-won' || e.ev === 'battle-lost' || e.ev === 'retreat') {
      if (e.ev === 'battle-won') s.fightsWon++;
      else s.fightsLost++;
      if (e.ev === 'battle-won' && BOSSES.has(e.enemy as EnemyId)) bosses.add(String(e.enemy));
      s.wastedStrikes += num(e.wasted);
      s.seconds += num(e.seconds);
      for (const [k, n] of Object.entries((e.moves ?? {}) as Record<string, number>)) keys.set(k, (keys.get(k) ?? 0) + num(n));
    } else if (e.ev === 'arcade-end') {
      s.arcadeRounds++;
      s.bestScore = Math.max(s.bestScore, num(e.score));
      s.targets += num(e.captures);
      s.hints += num(e.hintsShown);
      extraKeys += num(e.wastedKeys);
    }
  }
  s.bossesBeaten = bosses.size;
  s.topKey = [...keys].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  s.extraKeysPerTarget = s.targets ? extraKeys / s.targets : 0;
  return s;
}

/** The words that go out with the shared image. */
export function shareCaption(s: RunStats, level: number, areas: string, bosses: string, site: string): string {
  return `Level ${level} in Vimourney, the Vim action RPG: ${areas} areas cleared, ${bosses} bosses beaten, best arcade score ${s.bestScore}. Can you beat it? ${site}`;
}

/** 59 becomes 59s, 372 becomes 6m 12s. */
export function clockTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return m ? `${m}m ${seconds % 60}s` : `${seconds}s`;
}
