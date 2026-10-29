import { describe, expect, it } from 'vitest';
import type { EngineState } from '@kbm/shared';
import { createVimEngine } from '../index';

function run(lines: string[], keys: string[], cursor = { row: 0, col: 0 }): EngineState {
  const e = createVimEngine();
  e.reset({ lines, cursor });
  let st = e.state;
  for (const k of keys) st = e.feed(k);
  return st;
}

const keys = (s: string) => [...s];

describe('state exposed to the UI', () => {
  it('reports the mode through insert and visual', () => {
    const e = createVimEngine();
    e.reset({ lines: ['hello world'] });
    expect(e.state.mode).toBe('normal');
    expect(e.feed('i').mode).toBe('insert');
    expect(e.feed('Escape').mode).toBe('normal');
    expect(e.feed('v').mode).toBe('visual');
    expect(e.feed('V').mode).toBe('visual-line');
    expect(e.feed('Control-v').mode).toBe('visual-block');
    expect(e.feed('Escape').mode).toBe('normal');
  });

  it('shows a half-typed command in `pending`', () => {
    const e = createVimEngine();
    e.reset({ lines: ['hello world'] });
    e.feed('"');
    expect(e.state.pending.awaiting).toBe('"');
    e.feed('a');
    e.feed('2');
    e.feed('d');
    expect(e.state.pending).toEqual({ count: 2, register: 'a', operator: 'd', awaiting: null });
    e.feed('f');
    expect(e.state.pending.awaiting).toBe('f');
    e.feed('o');
    expect(e.state.pending).toEqual({ count: null, register: null, operator: null, awaiting: null });
  });

  it('logs every key with the mode it was pressed in', () => {
    const st = run(['abc'], ['i', 'x', 'Escape', 'l']);
    expect(st.keyLog).toEqual([
      { key: 'i', mode: 'normal' },
      { key: 'x', mode: 'insert' },
      { key: 'Escape', mode: 'insert' },
      { key: 'l', mode: 'normal' },
    ]);
  });

  it('records cursor jumps for trails, and clears them on keys that do not move', () => {
    const e = createVimEngine();
    e.reset({ lines: ['one two three'] });
    expect(e.feed('w').lastJump).toEqual({ from: { row: 0, col: 0 }, to: { row: 0, col: 4 } });
    e.feed('d');
    expect(e.state.lastJump).toBeNull();
  });

  it('reports the range an operator touched', () => {
    const e = createVimEngine();
    e.reset({ lines: ['one two three'] });
    for (const k of keys('dw')) e.feed(k);
    expect(e.state.lastRange).toEqual({ start: { row: 0, col: 0 }, end: { row: 0, col: 3 }, linewise: false });
    expect(e.state.lines).toEqual(['two three']);
    e.feed('w');
    expect(e.state.lastRange).toBeNull();
  });

  it('exposes registers with linewise text ending in a newline', () => {
    const st = run(['one two', 'three'], keys('yyjdw'));
    expect(st.registers['0']).toEqual({ text: 'one two\n', linewise: true });
    expect(st.registers['-']).toEqual({ text: 'three', linewise: false });
    expect(st.registers['"']).toEqual({ text: 'three', linewise: false });
  });

  it('exposes the visual anchor', () => {
    const e = createVimEngine();
    e.reset({ lines: ['one two three'], cursor: { row: 0, col: 2 } });
    expect(e.state.visualAnchor).toBeNull();
    e.feed('v');
    e.feed('l');
    expect(e.state.visualAnchor).toEqual({ row: 0, col: 2 });
    expect(e.state.cursor).toEqual({ row: 0, col: 3 });
  });

  it('state is a snapshot: later keys do not change an earlier result', () => {
    const e = createVimEngine();
    e.reset({ lines: ['abc'] });
    const before = e.state;
    e.feed('x');
    expect(before.lines).toEqual(['abc']);
    expect(e.state.lines).toEqual(['bc']);
  });
});

describe('editing behaviour spot checks', () => {
  it('dot repeats the last change, undo and redo walk history', () => {
    expect(run(['a b c d'], keys('dw..')).lines).toEqual(['d']);
    expect(run(['a b c d'], keys('dw..u')).lines).toEqual(['c d']);
    expect(run(['a b c d'], keys('dw..uu')).lines).toEqual(['b c d']);
    expect(run(['a b c d'], ['d', 'w', 'u', 'Control-r']).lines).toEqual(['b c d']);
  });

  it('cw behaves like ce on a word', () => {
    expect(run(['foo bar'], [...'cwX', 'Escape']).lines).toEqual(['X bar']);
  });

  it('text objects and counts', () => {
    expect(run(['f(a, (b), c)'], keys('fbdi(')).lines).toEqual(['f(a, (), c)']);
    expect(run(['f(a, (b), c)'], keys('fbd2i(')).lines).toEqual(['f()']);
    expect(run(['say "hi there" ok'], [...'fhci"X', 'Escape']).lines).toEqual(['say "X" ok']);
    expect(run(['a', 'b', '', 'c'], keys('dap')).lines).toEqual(['c']);
  });

  it('visual selections operate on the selected text', () => {
    expect(run(['hello world'], keys('vwd')).lines).toEqual(['orld']);
    expect(run(['a', 'b', 'c'], keys('Vjd')).lines).toEqual(['c']);
    expect(run(['abc', 'def', 'ghi'], ['Control-v', 'j', 'l', 'd']).lines).toEqual(['c', 'f', 'ghi']);
  });
});
