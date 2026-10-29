import type { Store } from './storage';

/** Skills shown on the character sheet, in teaching order. */
export const SKILLS: Array<{ key: string; name: string; blurb: string }> = [
  { key: 'h', name: 'h', blurb: 'Step left' },
  { key: 'j', name: 'j', blurb: 'Step down' },
  { key: 'k', name: 'k', blurb: 'Step up' },
  { key: 'l', name: 'l', blurb: 'Step right' },
  { key: 'w', name: 'w', blurb: 'Hop to the next word' },
  { key: 'b', name: 'b', blurb: 'Hop to the previous word' },
  { key: 'e', name: 'e', blurb: 'Hop to a word end' },
  { key: '0', name: '0', blurb: 'Run to the line start' },
  { key: '$', name: '$', blurb: 'Run to the line end' },
  { key: 'x', name: 'x', blurb: 'Strike a weak point' },
  { key: 'f', name: 'f', blurb: 'Hook onto a character' },
  { key: 't', name: 't', blurb: 'Stop just short of a character' },
  { key: ';', name: ';', blurb: 'Repeat the hook' },
  { key: ',', name: ',', blurb: 'Repeat the hook backward' },
];

/** Effective uses needed for mastery 1..5 (Seen, Trained, Fluent, Reflex, Master). */
export const THRESHOLDS = [1, 10, 30, 60, 100];
export const LEVEL_NAMES = ['Unseen', 'Seen', 'Trained', 'Fluent', 'Reflex', 'Master'];

export function levelFor(uses: number): number {
  let level = 0;
  for (const t of THRESHOLDS) if (uses >= t) level++;
  return level;
}

/** Progress inside the current level, 0 to 1, for the bar. */
export function progressFor(uses: number): number {
  const level = levelFor(uses);
  if (level >= THRESHOLDS.length) return 1;
  const lo = level === 0 ? 0 : THRESHOLDS[level - 1]!;
  const hi = THRESHOLDS[level]!;
  return (uses - lo) / (hi - lo);
}

export class Mastery {
  private counts: Record<string, number>;
  /** XP from fights and drills; level = floor(sqrt(xp / 20)) + 1. */
  xp: number;

  constructor(private readonly store: Store) {
    this.counts = store.get<Record<string, number>>('mastery', {});
    this.xp = store.get<number>('xp', 0);
  }

  record(key: string, effective: boolean): void {
    if (!effective) return;
    this.counts[key] = (this.counts[key] ?? 0) + 1;
    this.store.set('mastery', this.counts);
  }

  uses(key: string): number {
    return this.counts[key] ?? 0;
  }

  level(key: string): number {
    return levelFor(this.uses(key));
  }

  addXp(n: number): void {
    this.xp += n;
    this.store.set('xp', this.xp);
  }

  get characterLevel(): number {
    return Math.floor(Math.sqrt(this.xp / 20)) + 1;
  }

  reset(): void {
    this.counts = {};
    this.xp = 0;
    this.store.set('mastery', this.counts);
    this.store.set('xp', 0);
  }
}
