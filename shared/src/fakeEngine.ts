import type { Engine, EngineInit, EngineState } from './engine';

/** Minimal engine: `l` moves right, `x` deletes a char, everything else is ignored. */
export function fakeEngine(): Engine {
  let lines: string[] = [''];
  let col = 0;
  const snapshot = (): EngineState => ({
    lines: [...lines],
    cursor: { row: 0, col },
    mode: 'normal',
    pending: { count: null, register: null, operator: null, awaiting: null },
    registers: {},
    marks: {},
    keyLog: [],
    visualAnchor: null,
    lastRange: null,
    lastJump: null,
  });
  return {
    get state() {
      return snapshot();
    },
    reset(init: EngineInit) {
      lines = [...init.lines];
      col = init.cursor?.col ?? 0;
    },
    feed(key: string) {
      if (key === 'l') col++;
      if (key === 'x') lines = [lines[0]!.slice(0, col) + lines[0]!.slice(col + 1)];
      return snapshot();
    },
  };
}

