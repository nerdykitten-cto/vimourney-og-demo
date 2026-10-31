import { sendKey } from './keys';

interface Cap {
  key: string;
  /** Position in key widths, from the row's real place on a physical keyboard. */
  x: number;
  y: number;
  /** Where this key goes when the halves join upright, if that differs from x. */
  upright?: number;
}

const run = (y: number, x: number, keys: string): Cap[] => [...keys].map((key, i) => ({ key, x: x + i, y }));

/**
 * Square keys at their real positions, in two halves split along 7|8, y|u, g|h, b|n. Sideways each half
 * sits under a thumb; upright they join into one keyboard (index.html decides). Wide keys like Tab and
 * Shift are squares pinned to the outer edge, and the gap beside them is the width they would have on a
 * physical keyboard. x values on the right start from h, the leftmost key there. Upright the right edge
 * moves in by half a key to fit the width, which also makes the Caps/Ent and Shift gaps mirror each other.
 */
const BOARD_LEFT: Cap[] = [
  { key: 'Escape', x: 0, y: -1.25 },
  ...run(0, 0, '`1234567'),
  { key: 'Tab', x: 0, y: 1 },
  ...run(1, 1.5, 'qwerty'),
  { key: 'CapsLock', x: 0, y: 2 },
  ...run(2, 1.75, 'asdfg'),
  { key: 'Shift', x: 0, y: 3 },
  ...run(3, 2.25, 'zxcvb'),
];
const BOARD_RIGHT: Cap[] = [
  ...run(0, 1.25, '890-='),
  { key: 'Backspace', x: 7.25, y: 0, upright: 6.75 },
  ...run(1, 0.75, 'uiop[]'),
  { key: '#', x: 7.25, y: 1, upright: 6.75 },
  ...run(2, 0, "hjkl;'"),
  { key: 'Enter', x: 7.25, y: 2, upright: 6.75 },
  ...run(3, 0.5, 'nm,./'),
  { key: 'Shift', x: 7.25, y: 3, upright: 6.75 },
];

/** The shifted symbols of the UK layout. */
const SHIFTED: Record<string, string> = { '`': '¬', '1': '!', '2': '"', '3': '£', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+', '[': '{', ']': '}', ';': ':', "'": '@', '#': '~', ',': '<', '.': '>', '/': '?' };
const LABELS: Record<string, string> = { Escape: 'Esc', Tab: 'Tab', Enter: 'Ent', Shift: '⇧', CapsLock: 'Caps', Backspace: '⌫' };
/** Keys that are moves in the game, lit so they are easy to find. */
const MOVES = new Set(['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '4', 'x', 'f', 't', ';', ',']);

const isLetter = (key: string): boolean => /^[a-z]$/.test(key);

export function buildKeypad(boardLeft: HTMLElement, boardRight: HTMLElement): void {
  let shift = false;
  let caps = false;
  const keys: Array<{ key: string; el: HTMLButtonElement }> = [];

  const output = (key: string): string => {
    if (isLetter(key)) return shift !== caps ? key.toUpperCase() : key;
    return shift ? (SHIFTED[key] ?? key) : key;
  };

  const paint = (): void => {
    for (const { key, el } of keys) {
      if (key === 'Shift') el.classList.toggle('on', shift);
      else if (key === 'CapsLock') el.classList.toggle('on', caps);
      else if (!(key in LABELS)) el.firstChild!.textContent = output(key);
    }
  };

  const press = (key: string): void => {
    navigator.vibrate?.(8);
    if (key === 'Shift') shift = !shift;
    else if (key === 'CapsLock') caps = !caps;
    else {
      sendKey(output(key));
      shift = false;
    }
    paint();
  };

  const makeKey = (key: string): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `key${MOVES.has(key) ? ' move' : ''}${key in LABELS ? ' ctl' : ''}${key === 'Shift' || key === 'Backspace' ? ' shift' : ''}`;
    el.append(LABELS[key] ?? key);
    // The two shifted moves show on their keycaps, as they do on a printed keyboard.
    if (key === '4' || key === '6') {
      const small = document.createElement('small');
      small.textContent = SHIFTED[key]!;
      el.append(small);
    }
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('down');
      press(key);
    });
    for (const up of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(up, () => el.classList.remove('down'));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    keys.push({ key, el });
    return el;
  };

  const place = (cap: Cap): HTMLElement => {
    const el = makeKey(cap.key);
    el.style.setProperty('--x', String(cap.x));
    el.style.setProperty('--y', String(cap.y));
    if (cap.upright !== undefined) el.style.setProperty('--upright', String(cap.upright));
    return el;
  };

  boardLeft.append(...BOARD_LEFT.map(place));
  boardRight.append(...BOARD_RIGHT.map(place));
}
