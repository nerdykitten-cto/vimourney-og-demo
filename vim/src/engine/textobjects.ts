import type { Pos } from '@kbm/shared';
import { isWhite } from './chars';
import { bckendWord, bckWord, cls, dec, endWord, fwdWord, inc, type Cur } from './motions';

/*
 * Text objects (iw aw iW aW ip ap i( a( ... i" a" ...), ported from Vim's textobject.c.
 * Not implemented: sentences (is/as) and tags (it/at).
 */

/** Result when an object can't be selected but Vim has already moved the cursor (word objects do that). */
export interface ObjFailure {
  failAt: Pos;
}

export interface ObjResult {
  start: Pos;
  end: Pos;
  /** End position is part of the object. When false, `end` is the first char after it. */
  inclusive: boolean;
  linewise: boolean;
  /** In Visual mode: the selection to leave behind (anchor, cursor and, if it changes, the Visual kind). */
  visual?: { anchor: Pos | null; cursor: Pos; mode?: 'v' | 'V'; onlyFromV?: boolean };
}

type Lines = readonly string[];

function incl(L: Lines, c: Cur): number {
  let r = inc(L, c);
  if (r >= 1 && c.col) r = inc(L, c);
  return r;
}

function decl(L: Lines, c: Cur): number {
  let r = dec(L, c);
  if (r === 1 && c.col) r = dec(L, c);
  return r;
}

function backInLine(L: Lines, c: Cur, big: boolean): void {
  const sclass = cls(L, c, big);
  for (;;) {
    if (c.col === 0) break;
    dec(L, c);
    if (cls(L, c, big) !== sclass) {
      inc(L, c);
      break;
    }
  }
}

function inIndent(L: Lines, c: Cur, extra: number): boolean {
  const line = L[c.row]!;
  let n = 0;
  while (n < line.length && isWhite(line[n])) n++;
  return n >= c.col + extra;
}

function currentWord(L: Lines, cursor: Pos, include: boolean, big: boolean, count: number, anchor: Pos | null): ObjResult | ObjFailure {
  const fail = (c: Cur): ObjFailure => ({ failAt: { row: c.row, col: c.col } });
  const vis = anchor !== null;
  const fresh = !vis || (anchor.row === cursor.row && anchor.col === cursor.col);
  const c: Cur = { ...cursor };
  let startPos: Pos = { ...cursor };
  let inclusive = true;
  let includeWhite = false;
  let newAnchor: Pos | null = null;

  if (fresh) {
    backInLine(L, c, big);
    startPos = { ...c };
    if ((cls(L, c, big) === 0) === include) {
      if (!endWord(L, c, 1, big, true, true)) return fail(c);
    } else {
      fwdWord(L, c, 1, big, true);
      if (c.col === 0) decl(L, c);
      else c.col--;
      if (include) includeWhite = true;
    }
    if (vis) newAnchor = { ...startPos };
    count--;
  }

  while (count > 0) {
    inclusive = true;
    if (vis && cmpPos(c, anchor!) < 0) {
      // Selection runs backwards: grow it at the cursor end.
      if (decl(L, c) === -1) return fail(c);
      if (include !== (cls(L, c, big) !== 0)) {
        if (!bckWord(L, c, 1, big, true)) return fail(c);
      } else {
        if (!bckendWord(L, c, 1, big, true)) return fail(c);
        incl(L, c);
      }
    } else {
      if (incl(L, c) === -1) return fail(c);
      if (include !== (cls(L, c, big) === 0)) {
        if (!fwdWord(L, c, 1, big, true) && count > 1) return fail(c);
        if (c.col === 0) inclusive = false;
        else c.col--;
      } else if (!endWord(L, c, 1, big, true, true)) {
        return fail(c);
      }
    }
    count--;
  }

  if (includeWhite && (cls(L, c, big) !== 0 || (c.col === 0 && !inclusive))) {
    // No trailing white space was taken: take leading white space instead (but not indent).
    const end: Cur = { row: c.row, col: c.col };
    const s2: Cur = { ...startPos };
    if (s2.col > 0) {
      s2.col--;
      backInLine(L, s2, big);
      if (cls(L, s2, big) === 0 && s2.col > 0) {
        startPos = { row: s2.row, col: s2.col };
        if (vis) newAnchor = { ...startPos };
      }
    }
    c.row = end.row;
    c.col = end.col;
  }
  const res: ObjResult = { start: startPos, end: { row: c.row, col: c.col }, inclusive, linewise: false };
  if (vis) res.visual = { anchor: newAnchor, cursor: { row: c.row, col: c.col }, mode: 'v', onlyFromV: true };
  return res;
}

function cmpPos(a: Pos, b: Pos): number {
  return a.row !== b.row ? a.row - b.row : a.col - b.col;
}

function lineWhite(L: Lines, row: number): boolean {
  return /^[ \t]*$/.test(L[row]!);
}

/** Grow a multi-line Visual selection by whole paragraphs (the "extend" branch of Vim's current_par). */
function extendPar(L: Lines, fromRow: number, anchorRow: number, include: boolean, count: number): ObjResult | ObjFailure {
  const last = L.length - 1;
  let startRow = fromRow;
  const dir = startRow < anchorRow ? -1 : 1;
  let ok = true;
  for (let i = count; --i >= 0; ) {
    if (startRow === (dir < 0 ? 0 : last)) {
      ok = false;
      break;
    }
    let prevWhite = -1;
    for (let t = 0; t < 2; t++) {
      startRow += dir;
      const startWhite = lineWhite(L, startRow) ? 1 : 0;
      if (prevWhite === startWhite) {
        startRow -= dir;
        break;
      }
      for (;;) {
        if (startRow === (dir < 0 ? 0 : last)) break;
        const nextWhite = lineWhite(L, startRow + dir) ? 1 : 0;
        const para = !startWhite && L[startRow + (dir > 0 ? 1 : 0)]!.length === 0;
        if (startWhite !== nextWhite || para) break;
        startRow += dir;
      }
      if (!include) break;
      if (startRow === (dir < 0 ? 0 : last)) break;
      prevWhite = startWhite;
    }
  }
  const cur = { row: startRow, col: 0 };
  // Even a failed extension leaves the cursor at the line it reached.
  if (!ok) return { failAt: cur };
  return { start: cur, end: cur, inclusive: true, linewise: true, visual: { anchor: null, cursor: cur } };
}

function currentPar(L: Lines, cursor: Pos, include: boolean, count: number, anchor: Pos | null, visKind: string | null): ObjResult | ObjFailure | null {
  const last = L.length - 1;
  let startRow = cursor.row;
  const vis = anchor !== null;

  // The selection already spans lines: extend it by whole paragraphs.
  if (vis && startRow !== anchor!.row) return extendPar(L, startRow, anchor!.row, include, count);

  const whiteInFront = lineWhite(L, startRow);
  while (startRow > 0) {
    if (whiteInFront) {
      if (!lineWhite(L, startRow - 1)) break;
    } else if (lineWhite(L, startRow - 1) || L[startRow]!.length === 0) {
      break;
    }
    startRow--;
  }
  let endRow = startRow;
  while (endRow <= last && lineWhite(L, endRow)) endRow++;
  endRow--;
  let i = count;
  if (!include && whiteInFront) i--;
  let doWhite = false;
  while (i--) {
    if (endRow === last) return null;
    if (!include) doWhite = lineWhite(L, endRow + 1);
    if (include || !doWhite) {
      endRow++;
      while (endRow < last && !lineWhite(L, endRow + 1) && L[endRow + 1]!.length !== 0) endRow++;
    }
    if (i === 0 && whiteInFront && include) break;
    if (include || doWhite) {
      while (endRow < last && lineWhite(L, endRow + 1)) endRow++;
    }
  }
  if (!whiteInFront && !lineWhite(L, endRow) && include) {
    while (startRow > 0 && lineWhite(L, startRow - 1)) startRow--;
  }
  // "Vipipip" would stick on a one-line paragraph, so a linewise selection already there grows instead.
  if (vis && visKind === 'V' && startRow === cursor.row) return extendPar(L, startRow, anchor!.row, include, count);
  const res: ObjResult = { start: { row: startRow, col: 0 }, end: { row: endRow, col: 0 }, inclusive: true, linewise: true };
  if (vis) res.visual = { anchor: { row: startRow, col: 0 }, cursor: { row: endRow, col: 0 }, mode: 'V' };
  return res;
}

/** Search backward from (exclusive) `from` for an unmatched `open`. */
function findOpen(L: Lines, from: Pos, open: string, close: string): Pos | null {
  let depth = 0;
  let r = from.row;
  let c = from.col;
  for (;;) {
    c--;
    while (c < 0) {
      r--;
      if (r < 0) return null;
      c = L[r]!.length - 1;
    }
    const ch = L[r]![c];
    if (ch === close) depth++;
    else if (ch === open) {
      if (depth === 0) return { row: r, col: c };
      depth--;
    }
  }
}

/** Search forward from (exclusive) `from` for the next `open` that no earlier `close` has claimed. */
function findNextOpen(L: Lines, from: Pos, open: string, close: string): Pos | null {
  let depth = 0;
  let r = from.row;
  let c = from.col;
  for (;;) {
    c++;
    while (c >= L[r]!.length) {
      r++;
      if (r >= L.length) return null;
      c = 0;
      if (L[r]!.length > 0) break;
    }
    const ch = L[r]![c];
    if (ch === close) depth++;
    else if (ch === open) {
      if (depth === 0) return { row: r, col: c };
      depth--;
    }
  }
}

/** Search forward from (exclusive) `from` for an unmatched `close`. */
function findClose(L: Lines, from: Pos, open: string, close: string): Pos | null {
  let depth = 0;
  let r = from.row;
  let c = from.col;
  for (;;) {
    c++;
    while (c >= L[r]!.length) {
      r++;
      if (r >= L.length) return null;
      c = 0;
      if (L[r]!.length > 0) break;
    }
    const ch = L[r]![c];
    if (ch === open) depth++;
    else if (ch === close) {
      if (depth === 0) return { row: r, col: c };
      depth--;
    }
  }
}

const BLOCKS: Record<string, [string, string]> = {
  '(': ['(', ')'],
  ')': ['(', ')'],
  b: ['(', ')'],
  '[': ['[', ']'],
  ']': ['[', ']'],
  '{': ['{', '}'],
  '}': ['{', '}'],
  B: ['{', '}'],
  '<': ['<', '>'],
  '>': ['<', '>'],
};

function currentBlock(L: Lines, cursor: Pos, include: boolean, ch: string, count: number, anchor: Pos | null): ObjResult | null {
  const [open, close] = BLOCKS[ch]!;
  const vis = anchor !== null;
  const c: Cur = { ...cursor };
  let oldStart: Pos = { ...cursor };
  let oldEnd: Pos = { ...cursor };
  const oldPos: Pos = { ...cursor };
  if (!vis || cmpPos(anchor!, cursor) === 0) {
    if (open === '{') {
      while (inIndent(L, c, 1)) if (inc(L, c) !== 0) break;
    }
    if (L[c.row]![c.col] === open) c.col++;
  } else if (cmpPos(anchor!, cursor) < 0) {
    oldStart = { ...anchor! };
    c.row = anchor!.row;
    c.col = anchor!.col;
  } else {
    oldEnd = { ...anchor! };
  }

  let pos: Pos | null = null;
  let startPos: Pos = { row: cursor.row, col: cursor.col };
  let from: Pos = { row: c.row, col: c.col };
  if (findOpen(L, from, open, close)) {
    while (count-- > 0) {
      pos = findOpen(L, from, open, close);
      if (!pos) break;
      from = pos;
      startPos = pos;
    }
  } else {
    // Not inside a block: take the next one ahead of the cursor.
    while (count-- > 0) {
      pos = findNextOpen(L, from, open, close);
      if (!pos) break;
      from = pos;
      startPos = pos;
    }
  }
  if (!pos) return null;
  let endPos = findClose(L, startPos, open, close);
  if (!endPos) return null;

  const end: Cur = { ...endPos };
  const start: Cur = { ...startPos };
  let sol = false;
  while (!include) {
    incl(L, start);
    sol = end.col === 0;
    decl(L, end);
    while (inIndent(L, end, 1)) {
      sol = true;
      if (decl(L, end) !== 0) break;
    }
    // In Visual mode, when the area is no bigger than before, extend to the next block outward.
    if (vis && cmpPos(start, oldStart) >= 0 && cmpPos(oldEnd, end) >= 0 && cmpPos(start, end) !== 0) {
      const back: Cur = { ...oldStart };
      decl(L, back);
      const p2 = findOpen(L, { row: back.row, col: back.col }, open, close);
      if (!p2) return null;
      start.row = p2.row;
      start.col = p2.col;
      const e2 = findClose(L, p2, open, close);
      if (!e2) return null;
      endPos = e2;
      end.row = e2.row;
      end.col = e2.col;
    } else break;
  }
  void oldPos;

  // An empty inner block ("()") selects nothing in Visual mode, so the selection stays as it was.
  if (vis && !include && cmpPos(start, end) > 0) return null;

  if (vis) {
    if (sol && L[end.row]![end.col] !== undefined) inc(L, end);
    return {
      start: { row: start.row, col: start.col },
      end: { row: end.row, col: end.col },
      inclusive: true,
      linewise: false,
      visual: { anchor: { row: start.row, col: start.col }, cursor: { row: end.row, col: end.col }, mode: 'v' },
    };
  }
  if (include) return { start: { ...startPos }, end: { ...endPos }, inclusive: true, linewise: false };

  const s: Pos = { row: start.row, col: start.col };
  if (sol) {
    incl(L, end);
    return { start: s, end: { row: end.row, col: end.col }, inclusive: false, linewise: false };
  }
  const le = end.row > s.row || (end.row === s.row && end.col >= s.col);
  if (le) return { start: s, end: { row: end.row, col: end.col }, inclusive: true, linewise: false };
  // Nothing between the brackets: operate on no text.
  return { start: s, end: s, inclusive: false, linewise: false };
}

function findNextQuote(line: string, col: number, quote: string, escape: string | null): number {
  for (;;) {
    const c = line[col];
    if (c === undefined) return -1;
    if (escape !== null && escape.includes(c)) col++;
    else if (c === quote) return col;
    col++;
  }
}

function findPrevQuote(line: string, colStart: number, quote: string, escape: string | null): number {
  while (colStart > 0) {
    colStart--;
    let n = 0;
    if (escape !== null) {
      while (colStart - n > 0 && escape.includes(line[colStart - n - 1]!)) n++;
    }
    if (n & 1) colStart -= n;
    else if (line[colStart] === quote) break;
  }
  return colStart;
}

function currentQuote(L: Lines, cursor: Pos, include: boolean, quote: string, count: number): ObjResult | null {
  const line = L[cursor.row]!;
  const escape = '\\';
  let colStart = cursor.col;
  let colEnd: number;
  if (line[colStart] === quote) {
    const firstCol = colStart;
    colStart = 0;
    for (;;) {
      colStart = findNextQuote(line, colStart, quote, null);
      if (colStart < 0 || colStart > firstCol) return null;
      colEnd = findNextQuote(line, colStart + 1, quote, escape);
      if (colEnd < 0) return null;
      if (colStart <= firstCol && firstCol <= colEnd) break;
      colStart = colEnd + 1;
    }
  } else {
    colStart = findPrevQuote(line, colStart, quote, escape);
    if (line[colStart] !== quote) {
      colStart = findNextQuote(line, colStart, quote, null);
      if (colStart < 0) return null;
    }
    colEnd = findNextQuote(line, colStart + 1, quote, escape);
    if (colEnd < 0) return null;
  }

  if (include) {
    if (isWhite(line[colEnd + 1])) {
      while (isWhite(line[colEnd + 1])) colEnd++;
    } else {
      while (colStart > 0 && isWhite(line[colStart - 1])) colStart--;
    }
    return { start: { row: cursor.row, col: colStart }, end: { row: cursor.row, col: colEnd }, inclusive: true, linewise: false };
  }
  // A count of 2 or more makes "i" include the quotes themselves (but no white space).
  if (count >= 2) return { start: { row: cursor.row, col: colStart }, end: { row: cursor.row, col: colEnd }, inclusive: true, linewise: false };
  return { start: { row: cursor.row, col: colStart + 1 }, end: { row: cursor.row, col: colEnd }, inclusive: false, linewise: false };
}

/**
 * Select the text object `kind` + `ch` around `cursor`. In Visual mode `anchor` is the other end of
 * the selection; objects then grow it (or switch to the next enclosing block) like Vim does.
 */
export function selectObject(L: Lines, cursor: Pos, kind: 'i' | 'a', ch: string, count: number, anchor: Pos | null, visKind: string | null = null): ObjResult | ObjFailure | null {
  const include = kind === 'a';
  switch (ch) {
    case 'w':
    case 'W':
      return currentWord(L, cursor, include, ch === 'W', count, anchor);
    case 'p':
      return currentPar(L, cursor, include, count, anchor, visKind);
    case '"':
    case "'":
    case '`':
      return currentQuote(L, cursor, include, ch, count);
    default:
      return ch in BLOCKS ? currentBlock(L, cursor, include, ch, count, anchor) : null;
  }
}
