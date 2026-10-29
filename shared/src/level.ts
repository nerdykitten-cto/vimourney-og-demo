import type { EngineState, Mode, Pos } from './engine';

export interface Goal {
  /** Buffer must equal this exactly. */
  text?: string[];
  /** Cursor must be here. */
  cursor?: Pos;
  /** Mode the editor must be in when solved. Defaults to 'normal'. */
  mode?: Mode;
}

export interface Level {
  /** Unique across the whole game, e.g. "vim-w2-03". */
  id: string;
  /** Key into the editor's world list. */
  world: string;
  title: string;
  /** One-line mission shown above the buffer. */
  brief: string;
  start: { lines: string[]; cursor: Pos };
  goal: Goal;
  /** Fewest keystrokes known to solve it. Verified against real Vim in the level gate. */
  par: number;
  /** Keys the player may press, as `KeyboardEvent.key` values. Always include "Escape" if insert is taught. */
  allowedKeys: string[];
  /**
   * Extra keys allowed only while typing in Insert mode ("any" allows everything), so a level can
   * ask for text without unlocking the letters as commands.
   */
  typing?: string[] | 'any';
  /** Keys that solve it in `par` presses. Used for replay and validation. */
  parSolution: string[];
  /** Escalating hints: nudge, then command name, then the replay (replay needs no text). */
  hints: { nudge: string; command: string };
  /** Id of the intro card shown the first time a command appears, if any. */
  introCard?: string;
}

/** Commands that take the next key as a plain character argument (f( , r, ...). */
const ARG_COMMANDS = new Set(['f', 'F', 't', 'T', 'r']);

/**
 * Whether the level lets the player press `key`. `where` is the engine's current mode and half-typed
 * command: text typed in Insert mode (if the level allows typing) and the character a pending f/t/r
 * waits for are arguments, not commands, so they need no unlocking.
 */
export function isKeyAllowed(level: Pick<Level, 'allowedKeys' | 'typing'>, key: string, where?: { mode: Mode; awaiting?: string | null }): boolean {
  if (level.allowedKeys.includes(key)) return true;
  if (where?.awaiting && ARG_COMMANDS.has(where.awaiting) && key.length === 1) return true;
  if (where?.mode !== 'insert' || !level.typing) return false;
  return level.typing === 'any' || level.typing.includes(key);
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** True when the engine state satisfies every part of the goal. */
export function checkGoal(goal: Goal, state: EngineState): boolean {
  if (state.mode !== (goal.mode ?? 'normal')) return false;
  if (goal.text && !sameLines(goal.text, state.lines)) return false;
  if (goal.cursor && (goal.cursor.row !== state.cursor.row || goal.cursor.col !== state.cursor.col)) {
    return false;
  }
  return true;
}
