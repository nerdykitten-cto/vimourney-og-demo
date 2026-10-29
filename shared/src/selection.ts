import type { EngineState, Pos } from './engine';

function cmp(a: Pos, b: Pos): number {
  return a.row !== b.row ? a.row - b.row : a.col - b.col;
}

export interface CellFlags {
  /** Part of the current Visual selection. */
  selected: boolean;
  /** Part of the range the last operator touched (for the flash). */
  touched: boolean;
}

/** Whether the cell at (row, col) is highlighted. `col` may equal the line length (the line-break cell). */
export function cellFlags(state: EngineState, row: number, col: number): CellFlags {
  return { selected: isSelected(state, row, col), touched: isTouched(state, row, col) };
}

function isSelected(state: EngineState, row: number, col: number): boolean {
  const a = state.visualAnchor;
  if (!a) return false;
  const c = state.cursor;
  if (state.mode === 'visual-line') return row >= Math.min(a.row, c.row) && row <= Math.max(a.row, c.row);
  if (state.mode === 'visual-block') {
    return row >= Math.min(a.row, c.row) && row <= Math.max(a.row, c.row) && col >= Math.min(a.col, c.col) && col <= Math.max(a.col, c.col);
  }
  if (state.mode === 'visual') {
    const [s, e] = cmp(a, c) <= 0 ? [a, c] : [c, a];
    const here = { row, col };
    return cmp(here, s) >= 0 && cmp(here, e) <= 0;
  }
  return false;
}

function isTouched(state: EngineState, row: number, col: number): boolean {
  const r = state.lastRange;
  if (!r) return false;
  if (r.linewise) return row >= r.start.row && row <= r.end.row;
  const here = { row, col };
  return cmp(here, r.start) >= 0 && cmp(here, r.end) <= 0;
}
