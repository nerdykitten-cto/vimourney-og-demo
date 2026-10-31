import type { Store } from './storage';

export interface LogEvent {
  t: number;
  ev: string;
  [k: string]: unknown;
}

/** Local playtest log: what you did and where you stopped. Exported as text you can send me. */
export class PlaytestLog {
  private events: LogEvent[];

  constructor(private readonly store: Store) {
    this.events = store.get<LogEvent[]>('log', []);
  }

  add(ev: string, data: Record<string, unknown> = {}): void {
    this.events.push({ t: Date.now(), ev, ...data });
    if (this.events.length > 3000) this.events.splice(0, this.events.length - 3000);
    this.store.set('log', this.events);
  }

  get count(): number {
    return this.events.length;
  }

  /** One line per event, newest last, with seconds since the first event. */
  toText(): string {
    if (this.events.length === 0) return 'No events yet.\n';
    const t0 = this.events[0]!.t;
    const lines = this.events.map((e) => {
      const { t, ev, ...rest } = e;
      return `${((t - t0) / 1000).toFixed(1).padStart(8)}s  ${ev}${Object.keys(rest).length ? '  ' + JSON.stringify(rest) : ''}`;
    });
    return `Vimourney playtest log, ${this.events.length} events\n${this.summary()}\n${lines.join('\n')}\n`;
  }

  /** Per-enemy attempts and wins, plus arcade rounds, so the log reads at a glance. */
  private summary(): string {
    const per = new Map<string, { won: number; lost: number; retreat: number }>();
    const row = (e: string) => per.get(e) ?? per.set(e, { won: 0, lost: 0, retreat: 0 }).get(e)!;
    let arcade = 0;
    let best = 0;
    for (const e of this.events) {
      const enemy = String(e.enemy ?? '');
      if (e.ev === 'battle-won') row(enemy).won++;
      else if (e.ev === 'battle-lost') row(enemy).lost++;
      else if (e.ev === 'retreat') row(enemy).retreat++;
      else if (e.ev === 'arcade-end') {
        arcade++;
        best = Math.max(best, Number(e.score ?? 0));
      }
    }
    const parts = [...per].map(([k, v]) => `${k}: ${v.won} won, ${v.lost} lost, ${v.retreat} retreats`);
    return `Summary: ${parts.join('; ') || 'no fights'}; arcade rounds ${arcade}, best ${best}\n`;
  }

  clear(): void {
    this.events = [];
    this.store.set('log', this.events);
  }
}
