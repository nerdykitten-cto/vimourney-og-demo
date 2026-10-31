import type { Store } from './storage';

export interface LogEvent {
  t: number;
  ev: string;
  [k: string]: unknown;
}

/** Local record of what the player did. The Run stats page reads the current run from it. */
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

  /** Everything since the last progress reset. */
  get run(): LogEvent[] {
    return this.events.slice(this.events.map((e) => e.ev).lastIndexOf('reset') + 1);
  }

  clear(): void {
    this.events = [];
    this.store.set('log', this.events);
  }
}
