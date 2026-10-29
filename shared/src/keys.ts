/** Subset of KeyboardEvent we need, so key handling can be tested without a DOM. */
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Dead', 'Process', 'Unidentified', 'Hyper', 'Super', 'Fn', 'FnLock']);
const NAMED_KEYS = new Set(['Escape', 'Enter', 'Backspace', 'Delete', 'Tab']);

/**
 * Turn a keyboard event into an engine key name (`KeyboardEvent.key` style, Ctrl as "Control-x").
 * Returns null for events the game ignores: bare modifiers, Alt/Meta chords (reserved for the UI and
 * the browser) and keys the engines do not know (arrows, function keys).
 */
export function normalizeKey(e: KeyEventLike): string | null {
  if (MODIFIER_KEYS.has(e.key) || e.metaKey || e.altKey) return null;
  if (e.ctrlKey) {
    if (e.key === '[') return 'Escape';
    return e.key.length === 1 && /[a-z]/i.test(e.key) ? `Control-${e.key.toLowerCase()}` : null;
  }
  if (NAMED_KEYS.has(e.key)) return e.key;
  return e.key.length === 1 ? e.key : null;
}

const LABELS: Record<string, string> = {
  Escape: 'Esc',
  Enter: '⏎',
  Backspace: '⌫',
  Delete: 'Del',
  Tab: '⇥',
  ' ': '␣',
};

/** Short text for a key in the history strip: "Esc", "⏎", "^R", "w". */
export function keyLabel(key: string): string {
  if (key in LABELS) return LABELS[key]!;
  if (key.startsWith('Control-')) return `^${key.slice(8).toUpperCase()}`;
  return key;
}

/** Name to show in a message ("the d key"). */
export function keyName(key: string): string {
  if (key === ' ') return 'Space';
  if (key.startsWith('Control-')) return `Ctrl-${key.slice(8)}`;
  return key;
}
