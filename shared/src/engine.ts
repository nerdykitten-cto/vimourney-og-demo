/** Zero-based row/col into the buffer. */
export interface Pos {
  row: number;
  col: number;
}

export type Mode = 'normal' | 'insert' | 'replace' | 'visual' | 'visual-line' | 'visual-block';

/** Span an operator or visual selection touched. Inclusive of both ends. */
export interface Range {
  start: Pos;
  end: Pos;
  linewise: boolean;
}

export interface Register {
  text: string;
  linewise: boolean;
}

export interface Jump {
  from: Pos;
  to: Pos;
}

/** Partially typed command, so the UI can show "d2" waiting for a motion. */
export interface Pending {
  count: number | null;
  register: string | null;
  operator: string | null;
  /** Keys typed after the operator/count that still await completion, e.g. "f" or "i". */
  awaiting: string | null;
}

export interface KeyLogEntry {
  key: string;
  mode: Mode;
}

export interface EngineState {
  lines: readonly string[];
  cursor: Pos;
  mode: Mode;
  pending: Pending;
  registers: Readonly<Record<string, Register>>;
  marks: Readonly<Record<string, Pos>>;
  keyLog: readonly KeyLogEntry[];
  /** Anchor of the visual selection, null outside visual modes. */
  visualAnchor: Pos | null;
  /** Range affected by the most recent operator, for highlight. Cleared by the next key. */
  lastRange: Range | null;
  /** Cursor movement caused by the most recent key, for trails. Null if it did not move. */
  lastJump: Jump | null;
}

export interface EngineInit {
  lines: string[];
  cursor?: Pos;
}

/**
 * Contract every editor package (vim, emacs, neovim) implements.
 * Keys use `KeyboardEvent.key` names: "h", "H", "Escape", "Enter", "Backspace", "Control-r".
 * Engines are synchronous and deterministic so they can be driven by the UI,
 * the par-solution replay and the differential tests alike.
 */
export interface Engine {
  readonly state: EngineState;
  reset(init: EngineInit): void;
  /** Feed one key. Returns the new state (same object as `state`). */
  feed(key: string): EngineState;
}

export type EngineFactory = () => Engine;
