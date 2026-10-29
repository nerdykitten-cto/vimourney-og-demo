import { firstNonBlankCol, isWhite, isWordChar } from './chars';

/*
 * Cursor motions. The word/paragraph/find algorithms mirror Vim's own C code (textobject.c,
 * search.c, normal.c) so edge cases (empty lines, end of file, operator-pending quirks) match.
 */

export type MotionKind = 'exclusive' | 'inclusive' | 'linewise';

export interface MotionResult {
  row: number;
  col: number;
  kind: MotionKind;
  /** Motion failed (Vim beeps). Position is still reported, since some failed motions still move. */
  fail?: boolean;
  /** Set curswant to "end of line" (the `$` motion). */
  wantMax?: boolean;
  /** Keep curswant unchanged (j/k). */
  keepWant?: boolean;
  /** Deleted text always goes into register 1 (Vim's use_reg_one). */
  regOne?: boolean;
  find?: FindState;
}

export interface FindState {
  ch: string;
  dir: 1 | -1;
  till: boolean;
}

export interface MotionCtx {
  lines: readonly string[];
  row: number;
  col: number;
  want: number;
  /** An operator is pending (d, c, y). */
  op: boolean;
  /** Visual mode is active (cursor may rest one past the last char). */
  visual: boolean;
  /** The operator is `c` (changes `w` into `e`). */
  change: boolean;
  /** Pending operator key, if any. */
  opName?: string | null;
  count: number | null;
  find: FindState | null;
}

export interface Cur {
  row: number;
  col: number;
}

const MAXWANT = Infinity;

/** Vim's inc(): returns 0 within line, 2 when stepping onto the NUL, 1 when crossing a line, -1 at end of file. */
export function inc(L: readonly string[], c: Cur): number {
  const len = L[c.row]!.length;
  if (c.col < len) {
    c.col++;
    return c.col < len ? 0 : 2;
  }
  if (c.row < L.length - 1) {
    c.row++;
    c.col = 0;
    return 1;
  }
  return -1;
}

/** Vim's dec(): 1 when stepping to the NUL of the previous line, -1 at start of file. */
export function dec(L: readonly string[], c: Cur): number {
  if (c.col > 0) {
    c.col--;
    return 0;
  }
  if (c.row > 0) {
    c.row--;
    c.col = L[c.row]!.length;
    return 1;
  }
  return -1;
}

export function cls(L: readonly string[], c: Cur, big: boolean): 0 | 1 | 2 {
  const ch = L[c.row]![c.col];
  if (ch === undefined || ch === ' ' || ch === '\t') return 0;
  if (big) return 1;
  return isWordChar(ch) ? 2 : 1;
}

function skip(L: readonly string[], c: Cur, big: boolean, cclass: number, forward: boolean): boolean {
  while (cls(L, c, big) === cclass) {
    if ((forward ? inc(L, c) : dec(L, c)) === -1) return true;
  }
  return false;
}

function lineEmpty(L: readonly string[], row: number): boolean {
  return L[row]!.length === 0;
}

export function fwdWord(L: readonly string[], c: Cur, count: number, big: boolean, eol: boolean): boolean {
  while (--count >= 0) {
    const sclass = cls(L, c, big);
    const lastLine = c.row === L.length - 1;
    let i = inc(L, c);
    if (i === -1 || (i >= 1 && lastLine)) return false;
    if (i >= 1 && eol && count === 0) return true;
    if (sclass !== 0) {
      while (cls(L, c, big) === sclass) {
        i = inc(L, c);
        if (i === -1 || (i >= 1 && eol && count === 0)) return true;
      }
    }
    while (cls(L, c, big) === 0) {
      if (c.col === 0 && lineEmpty(L, c.row)) break;
      i = inc(L, c);
      if (i === -1 || (i >= 1 && eol && count === 0)) return true;
    }
  }
  return true;
}

export function bckWord(L: readonly string[], c: Cur, count: number, big: boolean, stop: boolean): boolean {
  while (--count >= 0) {
    const sclass = cls(L, c, big);
    if (dec(L, c) === -1) return false;
    let finished = false;
    if (!stop || sclass === cls(L, c, big) || sclass === 0) {
      while (cls(L, c, big) === 0) {
        if (c.col === 0 && lineEmpty(L, c.row)) {
          finished = true;
          break;
        }
        if (dec(L, c) === -1) return true;
      }
      if (!finished && skip(L, c, big, cls(L, c, big), false)) return true;
    }
    if (!finished) inc(L, c);
    stop = false;
  }
  return true;
}

export function endWord(L: readonly string[], c: Cur, count: number, big: boolean, stop: boolean, empty: boolean): boolean {
  while (--count >= 0) {
    const sclass = cls(L, c, big);
    if (inc(L, c) === -1) return false;
    let finished = false;
    if (cls(L, c, big) === sclass && sclass !== 0) {
      if (skip(L, c, big, sclass, true)) return false;
    } else if (!stop || sclass === 0) {
      while (cls(L, c, big) === 0) {
        if (empty && c.col === 0 && lineEmpty(L, c.row)) {
          finished = true;
          break;
        }
        if (inc(L, c) === -1) return false;
      }
      if (!finished && skip(L, c, big, cls(L, c, big), true)) return false;
    }
    if (!finished) dec(L, c);
    stop = false;
  }
  return true;
}

export function bckendWord(L: readonly string[], c: Cur, count: number, big: boolean, eol = false): boolean {
  while (--count >= 0) {
    const sclass = cls(L, c, big);
    let i = dec(L, c);
    if (i === -1) return false;
    if (eol && i === 1) return true;
    if (sclass !== 0) {
      while (cls(L, c, big) === sclass) {
        i = dec(L, c);
        if (i === -1 || (eol && i === 1)) return true;
      }
    }
    while (cls(L, c, big) === 0) {
      if (c.col === 0 && lineEmpty(L, c.row)) break;
      i = dec(L, c);
      if (i === -1 || (eol && i === 1)) return true;
    }
  }
  return true;
}

/** coladvance(): column for a desired column on `row`. Visual mode may rest one past the end. */
export function colFromWant(L: readonly string[], row: number, want: number, oneMore: boolean): number {
  const len = L[row]!.length;
  if (want >= len) return oneMore ? len : Math.max(0, len - 1);
  return want;
}

function cursorDown(L: readonly string[], c: Cur, n: number): boolean {
  if (n > 0) {
    if (c.row >= L.length - 1) return false;
    c.row = c.row + n >= L.length - 1 ? L.length - 1 : c.row + n;
  }
  return true;
}

function cursorUp(L: readonly string[], c: Cur, n: number): boolean {
  if (n > 0) {
    if (c.row <= 0) return false;
    c.row = n >= c.row ? 0 : c.row - n;
  }
  return true;
}

export { cursorDown, cursorUp };

const MATCH_PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', ')': '(', ']': '[', '}': '{' };
const OPENERS = '([{';

function matchBracket(L: readonly string[], row: number, col: number): { row: number; col: number } | null {
  const line = L[row]!;
  let start = col;
  while (start < line.length && !(line[start]! in MATCH_PAIRS)) start++;
  if (start >= line.length) return null;
  const open = line[start]!;
  const target = MATCH_PAIRS[open]!;
  const forward = OPENERS.includes(open);
  let depth = 0;
  let r = row;
  let c = start;
  for (;;) {
    const ch = L[r]![c];
    if (ch === open) depth++;
    else if (ch === target) {
      depth--;
      if (depth === 0) return { row: r, col: c };
    }
    if (forward) {
      c++;
      while (c >= L[r]!.length) {
        r++;
        c = 0;
        if (r >= L.length) return null;
        if (L[r]!.length > 0) break;
      }
    } else {
      c--;
      while (c < 0) {
        r--;
        if (r < 0) return null;
        c = L[r]!.length - 1;
      }
    }
  }
}

/** Vim's findpar(): `}` and `{`. */
function findPar(L: readonly string[], row: number, forward: boolean, count: number): { row: number; col: number; incl: boolean } | null {
  const dir = forward ? 1 : -1;
  let curr = row;
  while (count--) {
    let didSkip = false;
    for (let first = true; ; first = false) {
      if (L[curr]!.length !== 0) didSkip = true;
      if (!first && didSkip && L[curr]!.length === 0) break;
      curr += dir;
      if (curr < 0 || curr > L.length - 1) {
        if (count) return null;
        curr -= dir;
        break;
      }
    }
  }
  if (curr === L.length - 1 && forward) {
    const len = L[curr]!.length;
    if (len !== 0) return { row: curr, col: len - 1, incl: true };
  }
  return { row: curr, col: 0, incl: false };
}

function searchChar(
  line: string,
  col: number,
  count: number,
  dir: 1 | -1,
  till: boolean,
  ch: string,
  isRepeat: boolean,
): number | null {
  let stop = true;
  if (isRepeat && count === 1 && till) stop = false;
  let c = col;
  while (count--) {
    for (;;) {
      if (dir > 0) {
        c += 1;
        if (c >= line.length) return null;
      } else {
        if (c === 0) return null;
        c -= 1;
      }
      if (line[c] === ch && stop) break;
      stop = true;
    }
  }
  if (till) c -= dir;
  return c;
}

/**
 * Run a motion. Returns null if `motion` is not a known motion key.
 * `motion` is the canonical name: "h", "w", "gg", "f" (with arg), ...
 */
export function runMotion(motion: string, arg: string | null, ctx: MotionCtx): MotionResult | null {
  const L = ctx.lines;
  const count1 = ctx.count ?? 1;
  const cur: Cur = { row: ctx.row, col: ctx.col };
  const oneMore = ctx.visual;
  const lineLen = (r: number) => L[r]!.length;

  switch (motion) {
    case 'h': {
      let moved = 0;
      for (let n = 0; n < count1 && cur.col > 0; n++) {
        cur.col--;
        moved++;
      }
      return { row: cur.row, col: cur.col, kind: 'exclusive', fail: moved === 0 && !ctx.op };
    }
    case 'l': {
      const len = lineLen(cur.row);
      let n = count1;
      let hitEdge = false;
      for (; n > 0; n--) {
        const atEdge = ctx.visual ? cur.col >= len : cur.col >= len - 1;
        if (atEdge) {
          hitEdge = true;
          break;
        }
        cur.col++;
      }
      const moved = cur.col !== ctx.col;
      if (ctx.op) {
        // Operator-pending: running into the edge makes the motion inclusive so the last char is taken.
        return { row: cur.row, col: cur.col, kind: hitEdge && len > 0 ? 'inclusive' : 'exclusive' };
      }
      return { row: cur.row, col: cur.col, kind: 'exclusive', fail: !moved };
    }
    case 'j':
    case 'k': {
      const ok = motion === 'j' ? cursorDown(L, cur, count1) : cursorUp(L, cur, count1);
      if (!ok) return { row: ctx.row, col: ctx.col, kind: 'linewise', fail: true, keepWant: true };
      const col = colFromWant(L, cur.row, ctx.want, oneMore);
      return { row: cur.row, col, kind: 'linewise', fail: !ok, keepWant: true };
    }
    case '+':
    case 'Enter':
    case '-': {
      const ok = motion === '-' ? cursorUp(L, cur, count1) : cursorDown(L, cur, count1);
      if (!ok) return { row: ctx.row, col: ctx.col, kind: 'linewise', fail: true };
      return { row: cur.row, col: firstNonBlankCol(L[cur.row]!), kind: 'linewise', fail: !ok };
    }
    case '_': {
      const ok = cursorDown(L, cur, count1 - 1);
      if (!ok) return { row: ctx.row, col: ctx.col, kind: 'linewise', fail: true };
      // `y_` leaves the column alone; other operators and plain `_` go to the first non-blank.
      if (ctx.op && ctx.opName === 'y') return { row: cur.row, col: colFromWant(L, cur.row, ctx.want, false), kind: 'linewise' };
      return { row: cur.row, col: firstNonBlankCol(L[cur.row]!), kind: 'linewise' };
    }
    case 'G':
    case 'gg': {
      const target = ctx.count === null ? (motion === 'G' ? L.length : 1) : Math.min(Math.max(ctx.count, 1), L.length);
      return { row: target - 1, col: firstNonBlankCol(L[target - 1]!), kind: 'linewise' };
    }
    case '0':
      return { row: cur.row, col: 0, kind: 'exclusive' };
    case '^':
      return { row: cur.row, col: firstNonBlankCol(L[cur.row]!), kind: 'exclusive' };
    case '$': {
      const ok = cursorDown(L, cur, count1 - 1);
      if (!ok) return { row: ctx.row, col: ctx.col, kind: 'inclusive', fail: true };
      const len = lineLen(cur.row);
      const col = oneMore ? len : Math.max(0, len - 1);
      return { row: cur.row, col, kind: 'inclusive', wantMax: true };
    }
    case 'w':
    case 'W': {
      const big = motion === 'W';
      let wordEnd = false;
      if (ctx.op && ctx.change) {
        // "cw" on a non-blank behaves like "ce", but stays on the word when already at its end.
        const ch = L[cur.row]![cur.col];
        if (ch !== undefined && !isWhite(ch)) wordEnd = true;
      }
      if (wordEnd) {
        const ok = endWord(L, cur, count1, big, true, false);
        // The operator still runs when the word end ran into the end of the file.
        if ((cur.row !== ctx.row || cur.col !== ctx.col) && cur.col > 0 && cur.col >= lineLen(cur.row)) cur.col--;
        return { row: cur.row, col: cur.col, kind: 'inclusive', fail: !ok && !ctx.op };
      }
      const startRow = cur.row;
      const startCol = cur.col;
      const ok = fwdWord(L, cur, count1, big, ctx.op);
      let kind: MotionKind = 'exclusive';
      // Don't leave the cursor on the NUL past the end of line, unless it didn't move forward.
      const moved = cur.row > startRow || cur.col > startCol;
      if (moved && !ctx.visual && cur.col > 0 && cur.col >= lineLen(cur.row)) {
        cur.col--;
        kind = 'inclusive';
      }
      return { row: cur.row, col: cur.col, kind, fail: !ok && !ctx.op };
    }
    case 'b':
    case 'B': {
      const ok = bckWord(L, cur, count1, motion === 'B', false);
      return { row: cur.row, col: cur.col, kind: 'exclusive', fail: !ok };
    }
    case 'e':
    case 'E': {
      const ok = endWord(L, cur, count1, motion === 'E', false, false);
      const moved = cur.row !== ctx.row || cur.col !== ctx.col;
      if (moved && !ctx.visual && cur.col > 0 && cur.col >= lineLen(cur.row)) cur.col--;
      return { row: cur.row, col: cur.col, kind: 'inclusive', fail: !ok && !ctx.op };
    }
    case 'ge':
    case 'gE': {
      const ok = bckendWord(L, cur, count1, motion === 'gE');
      return { row: cur.row, col: cur.col, kind: 'inclusive', fail: !ok };
    }
    case '}':
    case '{': {
      const r = findPar(L, cur.row, motion === '}', count1);
      if (!r) return { row: ctx.row, col: ctx.col, kind: 'exclusive', fail: true };
      return { row: r.row, col: r.col, kind: r.incl ? 'inclusive' : 'exclusive', regOne: true };
    }
    case '%': {
      if (ctx.count !== null) {
        // N% jumps to N percent of the file, rounding up.
        if (ctx.count > 100) return { row: ctx.row, col: ctx.col, kind: 'linewise', fail: true };
        const target = Math.min(Math.max(Math.floor((L.length * ctx.count + 99) / 100), 1), L.length) - 1;
        return { row: target, col: firstNonBlankCol(L[target]!), kind: 'linewise' };
      }
      const m = matchBracket(L, cur.row, cur.col);
      if (!m) return { row: ctx.row, col: ctx.col, kind: 'inclusive', fail: true };
      return { row: m.row, col: m.col, kind: 'inclusive', regOne: true };
    }
    case 'f':
    case 'F':
    case 't':
    case 'T': {
      if (arg === null) return null;
      const dir: 1 | -1 = motion === 'f' || motion === 't' ? 1 : -1;
      const till = motion === 't' || motion === 'T';
      const c = searchChar(L[cur.row]!, cur.col, count1, dir, till, arg, false);
      const find: FindState = { ch: arg, dir, till };
      if (c === null) return { row: cur.row, col: cur.col, kind: 'inclusive', fail: true, find };
      return { row: cur.row, col: c, kind: dir > 0 ? 'inclusive' : 'exclusive', find };
    }
    case ';':
    case ',': {
      const f = ctx.find;
      if (!f) return { row: cur.row, col: cur.col, kind: 'exclusive', fail: true };
      const dir: 1 | -1 = motion === ';' ? f.dir : (-f.dir as 1 | -1);
      const c = searchChar(L[cur.row]!, cur.col, count1, dir, f.till, f.ch, true);
      if (c === null) return { row: cur.row, col: cur.col, kind: 'inclusive', fail: true };
      return { row: cur.row, col: c, kind: dir > 0 ? 'inclusive' : 'exclusive' };
    }
    default:
      return null;
  }
}

export { MAXWANT };
