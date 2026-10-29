import { describe, expect, it } from 'vitest';
import { capsFor } from './keyboard-layout';
import { keyLabel, normalizeKey, type KeyEventLike } from './keys';
import { cellFlags } from './selection';
import type { EngineState } from './engine';

const ev = (key: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });

describe('normalizeKey', () => {
  it('passes printable characters and named keys', () => {
    expect(normalizeKey(ev('a'))).toBe('a');
    expect(normalizeKey(ev('A', { shiftKey: true }))).toBe('A');
    expect(normalizeKey(ev('$', { shiftKey: true }))).toBe('$');
    expect(normalizeKey(ev(' '))).toBe(' ');
    expect(normalizeKey(ev('Escape'))).toBe('Escape');
    expect(normalizeKey(ev('Enter'))).toBe('Enter');
  });

  it('names Ctrl chords and maps Ctrl-[ to Escape', () => {
    expect(normalizeKey(ev('r', { ctrlKey: true }))).toBe('Control-r');
    expect(normalizeKey(ev('V', { ctrlKey: true, shiftKey: true }))).toBe('Control-v');
    expect(normalizeKey(ev('[', { ctrlKey: true }))).toBe('Escape');
    expect(normalizeKey(ev('5', { ctrlKey: true }))).toBeNull();
  });

  it('ignores modifiers, Alt/Meta chords and keys the engines do not know', () => {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) expect(normalizeKey(ev(k))).toBeNull();
    expect(normalizeKey(ev('r', { altKey: true }))).toBeNull();
    expect(normalizeKey(ev('c', { metaKey: true }))).toBeNull();
    expect(normalizeKey(ev('ArrowLeft'))).toBeNull();
    expect(normalizeKey(ev('F5'))).toBeNull();
  });
});

describe('keyLabel', () => {
  it('shortens special keys', () => {
    expect(keyLabel('Escape')).toBe('Esc');
    expect(keyLabel('Control-r')).toBe('^R');
    expect(keyLabel(' ')).toBe('␣');
    expect(keyLabel('w')).toBe('w');
  });
});

describe('capsFor', () => {
  it('lights Shift plus the base key for shifted characters', () => {
    expect(capsFor('A').ids).toEqual(['Shift', 'a']);
    expect(capsFor('$').ids).toEqual(['Shift', '4']);
    expect(capsFor('a').ids).toEqual(['a']);
    expect(capsFor('Control-r').ids).toEqual(['Ctrl', 'r']);
    expect(capsFor('Escape').ids).toEqual(['Escape']);
    expect(capsFor('é').ids).toEqual([]);
  });
});

describe('cellFlags', () => {
  const base: EngineState = {
    lines: ['hello', 'world'],
    cursor: { row: 0, col: 2 },
    mode: 'visual',
    pending: { count: null, register: null, operator: null, awaiting: null },
    registers: {},
    marks: {},
    keyLog: [],
    visualAnchor: { row: 0, col: 1 },
    lastRange: null,
    lastJump: null,
  };

  it('selects charwise from anchor to cursor inclusive', () => {
    expect(cellFlags(base, 0, 0).selected).toBe(false);
    expect(cellFlags(base, 0, 1).selected).toBe(true);
    expect(cellFlags(base, 0, 2).selected).toBe(true);
    expect(cellFlags(base, 0, 3).selected).toBe(false);
  });

  it('selects whole rows in visual-line and a rectangle in visual-block', () => {
    const v = { ...base, mode: 'visual-line' as const, cursor: { row: 1, col: 0 } };
    expect(cellFlags(v, 0, 4).selected).toBe(true);
    expect(cellFlags(v, 1, 0).selected).toBe(true);
    const b = { ...base, mode: 'visual-block' as const, cursor: { row: 1, col: 3 } };
    expect(cellFlags(b, 1, 2).selected).toBe(true);
    expect(cellFlags(b, 1, 0).selected).toBe(false);
  });

  it('marks the range an operator just touched', () => {
    const s = { ...base, mode: 'normal' as const, visualAnchor: null, lastRange: { start: { row: 0, col: 1 }, end: { row: 0, col: 2 }, linewise: false } };
    expect(cellFlags(s, 0, 1).touched).toBe(true);
    expect(cellFlags(s, 0, 3).touched).toBe(false);
  });
});
