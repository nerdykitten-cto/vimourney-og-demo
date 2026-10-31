import type { Engine, EngineFactory, Pos } from '@kbm/shared';
import { optimalRoute } from './route';
import type { Rng } from './rng';

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'node', 'link', 'root', 'leaf', 'array', 'index', 'value', 'item', 'queue', 'stack', 'parse', 'token', 'scope', 'block', 'frame', 'cache', 'merge', 'split', 'trim', 'fold', 'map', 'sum', 'min', 'max', 'tree', 'path'];

export const RUSH_SECONDS = 60;
export const RUSH_COLS = 54;
export const WARMUP_TARGETS = 3;
/** Extra keys over the best route before the game shows it as a hint. */
export const HINT_AFTER_EXTRA = 3;
export const RUSH_KEYS = new Set(['h', 'j', 'k', 'l', 'w', 'b', 'e', 'W', 'B', 'E', '0', '^', '$', 'f', 'F', 't', 'T', 'g', 'G', ';', ',']);

export interface Capture {
  keys: string[];
  best: string[];
  points: number;
}

export interface HighScore {
  score: number;
  captures: number;
  date: string;
}

/** Target Rush: reach glowing targets in a block of text, fast and in few keys. */
export class TargetRush {
  readonly lines: string[];
  score = 0;
  combo = 0;
  captures: Capture[] = [];
  target: Pos;
  /** Keys pressed since the current target appeared. */
  keysSince: string[] = [];
  timeLeft = RUSH_SECONDS;
  private best: string[] = [];
  private engine: Engine;

  constructor(
    private readonly factory: EngineFactory,
    private readonly rng: Rng,
    rows = 7,
    cols = RUSH_COLS,
  ) {
    this.engine = factory();
    this.lines = Array.from({ length: rows }, () => {
      let s = '';
      for (;;) {
        const next = (s ? `${s} ` : '') + rng.pick(WORDS);
        if (next.length > cols) return s;
        s = next;
      }
    });
    this.engine.reset({ lines: this.lines, cursor: { row: rng.int(rows), col: rng.int(cols - 10) } });
    this.target = this.pickTarget();
    this.best = this.route();
  }

  get cursor(): Pos {
    return { ...this.engine.state.cursor };
  }

  get over(): boolean {
    return this.timeLeft <= 0;
  }

  private pickTarget(): Pos {
    const c = this.cursor;
    // Warm-up: the first targets sit on the same row, where w, b, e, 0 and $ do the work.
    const warm = this.captures.length < WARMUP_TARGETS;
    for (let tries = 0; tries < 200; tries++) {
      const row = warm ? c.row : this.rng.int(this.lines.length);
      const line = this.lines[row]!;
      const col = this.rng.int(line.length);
      const dist = Math.abs(row - c.row) + Math.abs(col - c.col);
      if (line[col] !== ' ' && dist >= 4 && (!warm || dist <= 16)) {
        const pos = { row, col };
        if (!warm || optimalRoute(this.factory, this.lines, c, pos, { maxKeys: 6 })) return pos;
      }
    }
    return { row: 0, col: 0 };
  }

  private route(): string[] {
    return optimalRoute(this.factory, this.lines, this.cursor, this.target, { maxKeys: 6 }) ?? [];
  }

  /** Advance the clock; returns true when time ran out. */
  tick(seconds: number): boolean {
    if (this.over) return true;
    this.timeLeft = Math.max(0, this.timeLeft - seconds);
    return this.over;
  }

  /** Feed a key. Returns the capture when the cursor lands on the target. */
  feed(key: string): { accepted: boolean; capture: Capture | null } {
    const awaiting = this.engine.state.pending.awaiting;
    // The letter after f, t, F or T is an argument, so any key is allowed there.
    if (this.over || !(awaiting || RUSH_KEYS.has(key))) return { accepted: false, capture: null };
    this.engine.feed(key);
    const st = this.engine.state;
    // Edits are not part of the game: undo any text change.
    if (st.mode !== 'normal' || st.lines.some((l, i) => l !== this.lines[i])) this.engine.reset({ lines: this.lines, cursor: this.cursor });
    this.keysSince.push(key);
    const c = this.cursor;
    if (st.pending.awaiting || st.pending.count !== null || st.pending.operator) return { accepted: true, capture: null };
    if (c.row === this.target.row && c.col === this.target.col) {
      const used = this.keysSince.length;
      const extra = Math.max(0, used - this.best.length);
      const clean = extra <= 1;
      this.combo = clean ? this.combo + 1 : 0;
      const points = Math.max(20, 100 - 15 * extra) + (clean ? Math.min(this.combo, 10) * 10 : 0);
      this.score += points;
      const capture: Capture = { keys: [...this.keysSince], best: this.best, points };
      this.captures.push(capture);
      this.keysSince = [];
      this.target = this.pickTarget();
      this.best = this.route();
      return { accepted: true, capture };
    }
    return { accepted: true, capture: null };
  }

  /** The best route from where the cursor is now, once the player has burned enough keys on this target to need a nudge. */
  get hint(): string[] | null {
    if (this.best.length === 0 || this.keysSince.length < this.best.length + HINT_AFTER_EXTRA) return null;
    return optimalRoute(this.factory, this.lines, this.cursor, this.target, { maxKeys: 6 });
  }

  /** Best route from the current cursor to the current target (for a hint line). */
  get bestRoute(): string[] {
    return this.best;
  }
}

/** Insert a score into a top-ten table; returns the new table and the rank (1-based) or null. */
export function addHighScore(table: HighScore[], entry: HighScore): { table: HighScore[]; rank: number | null } {
  const next = [...table, entry].sort((a, b) => b.score - a.score).slice(0, 10);
  const i = next.indexOf(entry);
  return { table: next, rank: i >= 0 ? i + 1 : null };
}
