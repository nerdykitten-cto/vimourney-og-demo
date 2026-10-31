import { sendKey } from './keys';

/**
 * An on-screen QWERTY keyboard, split around the game so each thumb keeps its real keys: h j k l stay on
 * the home row, 0 stays above p, and $ stays on Shift+4. null is a gap that keeps the rows staggered.
 */
const LEFT: Array<Array<string | null>> = [
  ['Escape', '1', '2', '3', '4', '5'],
  ['Tab', 'q', 'w', 'e', 'r', 't'],
  [null, 'a', 's', 'd', 'f', 'g'],
  ['Shift', 'z', 'x', 'c', 'v', 'b'],
];
const RIGHT: Array<Array<string | null>> = [
  ['6', '7', '8', '9', '0', '='],
  ['y', 'u', 'i', 'o', 'p', null],
  ['h', 'j', 'k', 'l', ';', 'Enter'],
  ['n', 'm', ',', '.', '/', 'Shift'],
];

const SHIFTED: Record<string, string> = { '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '=': '+', ';': ':', ',': '<', '.': '>', '/': '?' };
const LABELS: Record<string, string> = { Escape: 'Esc', Tab: 'Tab', Enter: 'Ent', Shift: '⇧' };
/** Keys that are moves in the game, lit so they are easy to find. */
const MOVES = new Set(['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '4', 'x', 'f', 't', ';', ',']);

const shifted = (key: string): string => SHIFTED[key] ?? key.toUpperCase();

export function buildKeypad(left: HTMLElement, right: HTMLElement): void {
  let shift = false;
  const keys: Array<{ key: string; el: HTMLButtonElement }> = [];

  const paint = (): void => {
    for (const { key, el } of keys) {
      if (key === 'Shift') el.classList.toggle('on', shift);
      else if (!(key in LABELS)) el.firstChild!.textContent = shift ? shifted(key) : key;
    }
  };

  const press = (key: string): void => {
    navigator.vibrate?.(8);
    if (key === 'Shift') shift = !shift;
    else {
      sendKey(shift && !(key in LABELS) ? shifted(key) : key);
      shift = false;
    }
    paint();
  };

  const row = (cells: Array<string | null>): HTMLElement => {
    const out = document.createElement('div');
    out.className = 'row';
    for (const key of cells) {
      if (key === null) {
        out.append(document.createElement('span'));
        continue;
      }
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `key${MOVES.has(key) ? ' move' : ''}${key in LABELS ? ' ctl' : ''}${key === 'Shift' ? ' shift' : ''}`;
      el.append(LABELS[key] ?? key);
      // The two shifted moves show on their keycaps, as they do on a printed keyboard.
      if (key === '4' || key === '6') {
        const small = document.createElement('small');
        small.textContent = shifted(key);
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
      out.append(el);
    }
    return out;
  };

  left.append(...LEFT.map(row));
  right.append(...RIGHT.map(row));
}
