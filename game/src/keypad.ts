import { sendKey } from './keys';

interface Cap {
  key: string;
  /** Sideways position in key widths, from the key's real place on a physical keyboard. */
  x: number;
  y: number;
}

const run = (y: number, x: number, keys: string): Cap[] => [...keys].map((key, i) => ({ key, x: x + i, y }));

/**
 * Sideways: square keys big enough for thumbs, in two halves split along 7|8, y|u, g|h, b|n. Wide keys
 * like Tab and Shift are squares pinned to the outer edge, and the gap beside them is the width they
 * have on a physical keyboard. x values on the right start from h. Keys the game never needs are left
 * out to leave room, and Esc takes the spot of the key left of 1, as on a compact keyboard. A phone held
 * sideways is short, so its number row keeps only the keys that are moves; the rest are SPARE.
 */
const BOARD_LEFT: Cap[] = [
  { key: 'Escape', x: 0, y: 0 },
  ...run(0, 1, '1234567'),
  { key: 'Tab', x: 0, y: 1 },
  ...run(1, 1.5, 'qwerty'),
  { key: 'CapsLock', x: 0, y: 2 },
  ...run(2, 1.75, 'asdfg'),
  { key: 'Shift', x: 0, y: 3 },
  ...run(3, 2.25, 'zxcvb'),
];
const BOARD_RIGHT: Cap[] = [
  ...run(0, 1.25, '890='),
  ...run(1, 0.75, 'uiop'),
  ...run(2, 0, 'hjkl;'),
  { key: 'Enter', x: 5.5, y: 2 },
  ...run(3, 0.5, 'nm,./'),
  { key: 'Shift', x: 5.5, y: 3 },
];

const SPARE = new Set([...'1235678', '9', '=']);

/** Upright: the same keys as one 10.5-wide phone keyboard, with the rest on a bottom row. */
const UPRIGHT = new Map<string, [number, number]>([
  ...[...'1234567890'].map((k, i): [string, [number, number]] => [k, [i, 0]]),
  ...[...'qwertyuiop'].map((k, i): [string, [number, number]] => [k, [i + 0.25, 1]]),
  ...[...'asdfghjkl;'].map((k, i): [string, [number, number]] => [k, [i + 0.5, 2]]),
  ...[...'zxcvbnm,.'].map((k, i): [string, [number, number]] => [k, [i + 1, 3]]),
  ['Shift', [0, 3]],
  ['Escape', [0, 4]],
  ['Tab', [1.25, 4]],
  ['CapsLock', [2.5, 4]],
  ['=', [6.5, 4]],
  ['/', [7.75, 4]],
  ['Enter', [9.5, 4]],
]);

/** The shifted symbols of the UK layout. */
const SHIFTED: Record<string, string> = { '1': '!', '2': '"', '3': '£', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '=': '+', ';': ':', ',': '<', '.': '>', '/': '?' };
const LABELS: Record<string, string> = { Escape: 'Esc', Tab: 'Tab', Enter: 'Ent', Shift: '⇧', CapsLock: 'Caps' };
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
    el.className = `key${MOVES.has(key) ? ' move' : ''}${key in LABELS ? ' ctl' : ''}${key === 'Shift' ? ' shift' : ''}`;
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

  const place = (cap: Cap, side: 'left' | 'right'): HTMLElement => {
    const el = makeKey(cap.key);
    el.style.setProperty('--x', String(cap.x));
    el.style.setProperty('--y', String(cap.y));
    const [ux, uy] = UPRIGHT.get(cap.key)!;
    el.style.setProperty('--ux', String(ux));
    el.style.setProperty('--uy', String(uy));
    // The upright keyboard has one Shift, so the right-hand one is sideways only.
    if (cap.key === 'Shift' && side === 'right') el.classList.add('sideways-only');
    if (SPARE.has(cap.key)) el.classList.add('spare');
    return el;
  };

  boardLeft.append(...BOARD_LEFT.map((cap) => place(cap, 'left')));
  boardRight.append(...BOARD_RIGHT.map((cap) => place(cap, 'right')));
}
