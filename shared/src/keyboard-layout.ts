/** US QWERTY layout for the on-screen keyboard. `id` is what a pressed key is matched against. */
export interface KeyCap {
  id: string;
  base: string;
  shift?: string;
  /** Width in key units (1 = a letter key). */
  w?: number;
  /** Label to draw instead of `base`. */
  label?: string;
}

const row = (base: string, shift: string): KeyCap[] => [...base].map((b, i) => ({ id: b, base: b, shift: shift[i]! }));

export const KEYBOARD_ROWS: KeyCap[][] = [
  [{ id: 'Escape', base: 'Escape', label: 'Esc', w: 1.5 }, ...row('`1234567890-=', '~!@#$%^&*()_+'), { id: 'Backspace', base: 'Backspace', label: '⌫', w: 1.5 }],
  [{ id: 'Tab', base: 'Tab', label: '⇥', w: 1.5 }, ...row('qwertyuiop[]\\', 'QWERTYUIOP{}|')],
  [{ id: 'Ctrl', base: 'Ctrl', label: 'Ctrl', w: 1.75 }, ...row("asdfghjkl;'", 'ASDFGHJKL:"'), { id: 'Enter', base: 'Enter', label: '⏎', w: 2.1 }],
  [{ id: 'Shift', base: 'Shift', label: 'Shift', w: 2.3 }, ...row('zxcvbnm,./', 'ZXCVBNM<>?'), { id: 'Shift', base: 'Shift', label: 'Shift', w: 2.6 }],
  [{ id: ' ', base: ' ', label: 'space', w: 9 }],
];

export interface Lit {
  /** Ids of the key caps to light up. */
  ids: string[];
}

const CHAR_TO_CAP = new Map<string, { id: string; shifted: boolean }>();
for (const r of KEYBOARD_ROWS) {
  for (const k of r) {
    if (k.base.length === 1) CHAR_TO_CAP.set(k.base, { id: k.id, shifted: false });
    if (k.shift) CHAR_TO_CAP.set(k.shift, { id: k.id, shifted: true });
  }
}

/** Which physical keys produce an engine key: "A" is Shift + a, "Control-r" is Ctrl + r. */
export function capsFor(key: string): Lit {
  if (key.startsWith('Control-')) return { ids: ['Ctrl', key.slice(8)] };
  if (key === 'Escape' || key === 'Enter' || key === 'Backspace' || key === 'Tab' || key === ' ') return { ids: [key] };
  const hit = CHAR_TO_CAP.get(key);
  if (!hit) return { ids: [] };
  return { ids: hit.shifted ? ['Shift', hit.id] : [hit.id] };
}
