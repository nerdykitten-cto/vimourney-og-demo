import { describe, expect, it } from 'vitest';
import type { EngineState } from './engine';
import { checkGoal, isKeyAllowed } from './level';

function state(over: Partial<EngineState> = {}): EngineState {
  return {
    lines: ['hello world'],
    cursor: { row: 0, col: 0 },
    mode: 'normal',
    pending: { count: null, register: null, operator: null, awaiting: null },
    registers: {},
    marks: {},
    keyLog: [],
    visualAnchor: null,
    lastRange: null,
    lastJump: null,
    ...over,
  };
}

describe('isKeyAllowed with typing', () => {
  it('allows typed text only in insert mode', () => {
    const level = { allowedKeys: ['i', 'Escape'], typing: 'any' as const };
    expect(isKeyAllowed(level, 'x', { mode: 'normal' })).toBe(false);
    expect(isKeyAllowed(level, 'x', { mode: 'insert' })).toBe(true);
    expect(isKeyAllowed({ allowedKeys: [], typing: ['a'] }, 'b', { mode: 'insert' })).toBe(false);
    expect(isKeyAllowed({ allowedKeys: [], typing: ['a'] }, 'a', { mode: 'insert' })).toBe(true);
  });
});

describe('isKeyAllowed with a pending argument', () => {
  it('lets f, t and r take any character', () => {
    const level = { allowedKeys: ['f'] };
    expect(isKeyAllowed(level, '(', { mode: 'normal' })).toBe(false);
    expect(isKeyAllowed(level, '(', { mode: 'normal', awaiting: 'f' })).toBe(true);
    expect(isKeyAllowed(level, 'Escape', { mode: 'normal', awaiting: 'f' })).toBe(false);
    expect(isKeyAllowed(level, '(', { mode: 'normal', awaiting: 'g' })).toBe(false);
  });
});

describe('isKeyAllowed', () => {
  it('only allows listed keys', () => {
    const level = { allowedKeys: ['h', 'l'] };
    expect(isKeyAllowed(level, 'h')).toBe(true);
    expect(isKeyAllowed(level, 'j')).toBe(false);
  });
});

describe('checkGoal', () => {
  it('matches a cursor goal', () => {
    const goal = { cursor: { row: 0, col: 6 } };
    expect(checkGoal(goal, state({ cursor: { row: 0, col: 6 } }))).toBe(true);
    expect(checkGoal(goal, state({ cursor: { row: 0, col: 5 } }))).toBe(false);
  });

  it('matches a text goal exactly', () => {
    const goal = { text: ['world'] };
    expect(checkGoal(goal, state({ lines: ['world'] }))).toBe(true);
    expect(checkGoal(goal, state({ lines: ['world '] }))).toBe(false);
    expect(checkGoal(goal, state({ lines: ['world', ''] }))).toBe(false);
  });

  it('requires every part of a combined goal', () => {
    const goal = { text: ['world'], cursor: { row: 0, col: 2 } };
    expect(checkGoal(goal, state({ lines: ['world'], cursor: { row: 0, col: 0 } }))).toBe(false);
    expect(checkGoal(goal, state({ lines: ['world'], cursor: { row: 0, col: 2 } }))).toBe(true);
  });

  it('requires normal mode unless the goal names another', () => {
    const goal = { text: ['hello world'] };
    expect(checkGoal(goal, state({ mode: 'insert' }))).toBe(false);
    expect(checkGoal({ ...goal, mode: 'insert' }, state({ mode: 'insert' }))).toBe(true);
  });
});
