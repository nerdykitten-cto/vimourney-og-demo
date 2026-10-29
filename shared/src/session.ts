import type { Engine, EngineState } from './engine';
import { checkGoal, isKeyAllowed, type Level } from './level';

export type FeedResult =
  /** The key went to the engine. */
  | { kind: 'ok'; state: EngineState; solved: boolean }
  /** The level does not allow this key yet; nothing happened and it is not counted. */
  | { kind: 'blocked'; key: string };

/**
 * One play of a level (or free play when `level` is null): drives the engine, counts keystrokes,
 * enforces the level's key whitelist and notices when the goal is met.
 */
export class Session {
  keystrokes = 0;
  solved = false;
  /** Keystroke count at the moment the goal was first met. */
  solvedAt: number | null = null;

  constructor(
    readonly engine: Engine,
    readonly level: Level | null = null,
  ) {
    this.restart();
  }

  restart(): void {
    this.keystrokes = 0;
    this.solved = false;
    this.solvedAt = null;
    const l = this.level;
    this.engine.reset(l ? { lines: l.start.lines, cursor: l.start.cursor } : { lines: [''] });
  }

  /** Load different free-play text (sandbox only). */
  load(lines: string[]): void {
    this.engine.reset({ lines });
    this.keystrokes = 0;
  }

  feed(key: string): FeedResult {
    if (this.solved) return { kind: 'ok', state: this.engine.state, solved: true };
    if (this.level) {
      const st = this.engine.state;
      if (!isKeyAllowed(this.level, key, { mode: st.mode, awaiting: st.pending.awaiting })) return { kind: 'blocked', key };
    }
    this.keystrokes++;
    const state = this.engine.feed(key);
    if (this.level && checkGoal(this.level.goal, state)) {
      this.solved = true;
      this.solvedAt = this.keystrokes;
    }
    return { kind: 'ok', state, solved: this.solved };
  }
}
