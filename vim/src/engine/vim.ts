import type { Engine, EngineInit, EngineState, Jump, KeyLogEntry, Mode, Pending, Pos, Range, Register } from '@kbm/shared';
import { firstNonBlankCol, firstNonBlankIdx, isWhite, isWordChar, toggleCase } from './chars';
import { runMotion, type FindState, type MotionCtx } from './motions';
import { parseNormal, parseVisual, type Cmd, type Partial } from './parse';
import { selectObject } from './textobjects';

/** Register contents. Linewise text always covers whole lines; `block` is a Visual-block yank. */
interface Reg {
  lines: string[];
  linewise: boolean;
  block?: boolean;
}

interface UndoEntry {
  before: string[];
  after: string[];
  cursorBefore: Pos;
  /** Single-line linewise delete/change: undo parks the cursor no further right than the indent. */
  capIndent: boolean;
  /** Recorded without a text change (Vim's u_save_cursor() on an empty region). */
  forced: boolean;
}

interface InsertSession {
  /** Times the typed text is inserted (3ix<Esc>). */
  count: number;
  /** o/O repeat by opening new lines; everything else re-types in place. */
  openLine: boolean;
  typed: string[];
  start: Pos;
}

/** Size of the Visual area a change was made on, so `.` can redo it on the same amount of text. */
interface VisualRedo {
  kind: VisualKind;
  lines: number;
  /** Chars wide (single-line `v`), end column (multi-line `v`) or block width. */
  width: number;
  toEol: boolean;
}

interface LastChange {
  cmd: Cmd;
  insertKeys: string[] | null;
  visual?: VisualRedo;
}

type VisualKind = 'v' | 'V' | 'block';

/** A span an operator works on. Charwise ranges are half-open: [start, endEx). */
interface OpRange {
  linewise: boolean;
  start: Pos;
  endEx: Pos;
  /** Lines touched, as Vim counts them (decides whether a delete lands in register 1). */
  lineCount: number;
  /** Always put the deleted text in register 1 (Vim's use_reg_one). */
  regOne: boolean;
  /** Vim's oap->empty: an exclusive range with start == end. Deleting it does nothing at all. */
  empty?: boolean;
  /** Cursor position when the operator starts (min of start/end in Vim terms). */
  cursor: Pos;
  block?: { top: number; bottom: number; left: number; right: number; toEol: boolean };
}

const NAMED = /^[a-z]$/;
const UPPER = /^[A-Z]$/;

function cmpPos(a: Pos, b: Pos): number {
  return a.row !== b.row ? a.row - b.row : a.col - b.col;
}

function cloneReg(r: Reg): Reg {
  return { lines: [...r.lines], linewise: r.linewise, block: r.block };
}

export class VimEngine implements Engine {
  private L: string[] = [''];
  private row = 0;
  private col = 0;
  private want = 0;
  private mode: Mode = 'normal';
  private keys: string[] = [];
  private partial: Partial = { register: null, count: null, operator: null, awaiting: null };
  private regs: Record<string, Reg> = {};
  private unnamed: Reg | null = null;
  private find: FindState | null = null;
  private marks: Record<string, Pos> = {};
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private txn: { lines: string[]; cursor: Pos; cursorSet: boolean; force: boolean; capIndent: boolean } | null = null;
  private lastChange: LastChange | null = null;
  private ins: InsertSession | null = null;
  private recording: { cmd: Cmd; keys: string[]; visual?: VisualRedo } | null = null;
  private replaying = false;
  /** Set when the current command actually modified text, so failed commands don't become the `.` target. */
  private changeRan = false;
  /** Vim's ML_EMPTY: every line was deleted. Deleting the leftover empty line yanks nothing. */
  private emptyBuf = false;
  /** The cursor column was chosen explicitly, so curswant follows it once it is clamped. */
  private syncWant = false;
  /** Command to record for `.` when it differs from the typed one (J with a clamped count). */
  private effectiveCmd: Cmd | null = null;
  private visual: { kind: VisualKind; anchor: Pos } | null = null;
  private keyLog: KeyLogEntry[] = [];
  private lastRange: Range | null = null;
  private lastJump: Jump | null = null;

  constructor() {
    this.reset({ lines: [''] });
  }

  reset(init: EngineInit): void {
    this.L = init.lines.length > 0 ? [...init.lines] : [''];
    this.row = init.cursor?.row ?? 0;
    this.col = init.cursor?.col ?? 0;
    this.clampNormal();
    this.want = this.col;
    this.mode = 'normal';
    this.keys = [];
    this.partial = { register: null, count: null, operator: null, awaiting: null };
    this.regs = {};
    this.unnamed = null;
    this.find = null;
    this.marks = {};
    this.undoStack = [];
    this.redoStack = [];
    this.txn = null;
    this.lastChange = null;
    this.ins = null;
    this.recording = null;
    this.replaying = false;
    this.emptyBuf = false;
    this.visual = null;
    this.keyLog = [];
    this.lastRange = null;
    this.lastJump = null;
  }

  get state(): EngineState {
    const pending: Pending = {
      count: this.partial.count,
      register: this.partial.register,
      operator: this.partial.operator,
      awaiting: this.partial.awaiting,
    };
    const registers: Record<string, Register> = {};
    const out = (name: string, r: Reg | null | undefined) => {
      if (r) registers[name] = { text: r.lines.join('\n') + (r.linewise ? '\n' : ''), linewise: r.linewise };
    };
    out('"', this.unnamed);
    for (const k of Object.keys(this.regs)) out(k, this.regs[k]);
    return {
      lines: [...this.L],
      cursor: { row: this.row, col: this.col },
      mode: this.mode,
      pending,
      registers,
      marks: { ...this.marks },
      keyLog: [...this.keyLog],
      visualAnchor: this.visual ? { ...this.visual.anchor } : null,
      lastRange: this.lastRange,
      lastJump: this.lastJump,
    };
  }

  feed(key: string): EngineState {
    this.keyLog.push({ key, mode: this.mode });
    this.lastRange = null;
    this.lastJump = null;
    const from = { row: this.row, col: this.col };
    if (this.mode === 'insert') this.insertKey(key);
    else if (this.visual) this.visualKey(key);
    else this.normalKey(key);
    if (from.row !== this.row || from.col !== this.col) this.lastJump = { from, to: { row: this.row, col: this.col } };
    return this.state;
  }

  // ---------------------------------------------------------------- helpers

  private len(r: number): number {
    return this.L[r]!.length;
  }

  private clampNormal(): void {
    this.row = Math.min(Math.max(this.row, 0), this.L.length - 1);
    this.col = Math.min(Math.max(this.col, 0), Math.max(0, this.len(this.row) - 1));
  }

  private clampVisual(): void {
    this.row = Math.min(Math.max(this.row, 0), this.L.length - 1);
    this.col = Math.min(Math.max(this.col, 0), this.len(this.row));
  }

  private setCursor(row: number, col: number, setWant = true): void {
    this.row = row;
    this.col = col;
    if (setWant) {
      this.want = col;
      this.syncWant = true;
    }
  }

  private resetPending(): void {
    this.keys = [];
    this.partial = { register: null, count: null, operator: null, awaiting: null };
  }

  private beginTxn(): void {
    if (!this.txn) this.txn = { lines: [...this.L], cursor: { row: this.row, col: this.col }, cursorSet: false, force: false, capIndent: false };
  }

  /** Vim saves the undo cursor at the first modification, e.g. the start of an operator's range. */
  private setTxnCursor(p: Pos, capIndent = false): void {
    if (this.txn && !this.txn.cursorSet) {
      this.txn.cursor = { ...p };
      this.txn.cursorSet = true;
      this.txn.capIndent = capIndent;
    }
  }

  private commitTxn(): void {
    const t = this.txn;
    this.txn = null;
    if (!t) return;
    const same = t.lines.length === this.L.length && t.lines.every((l, i) => l === this.L[i]);
    if (same && !t.force) return;
    this.undoStack.push({ before: t.lines, after: [...this.L], cursorBefore: t.cursor, capIndent: t.capIndent, forced: same });
    this.redoStack = [];
  }

  // ---------------------------------------------------------------- registers

  private getReg(name: string | null): Reg | null {
    if (name === null || name === '"') return this.unnamed;
    if (name === '_') return null;
    const key = UPPER.test(name) ? name.toLowerCase() : name;
    return this.regs[key] ?? null;
  }

  private writeNamed(name: string, content: Reg): Reg {
    if (UPPER.test(name)) {
      const key = name.toLowerCase();
      const old = this.regs[key];
      if (old) {
        // Appending: linewise wins; charwise appends join the last/first lines.
        let merged: Reg;
        if (content.linewise || old.linewise) merged = { lines: [...old.lines, ...content.lines], linewise: true };
        else {
          const lines = [...old.lines];
          lines[lines.length - 1] += content.lines[0]!;
          lines.push(...content.lines.slice(1));
          merged = { lines, linewise: false };
        }
        this.regs[key] = merged;
        return merged;
      }
      this.regs[key] = cloneReg(content);
      return this.regs[key]!;
    }
    this.regs[name] = cloneReg(content);
    return this.regs[name]!;
  }

  private writeYank(reg: string | null, content: Reg): void {
    if (reg === '_') return;
    if (reg !== null && reg !== '"' && /^[a-zA-Z]$/.test(reg)) {
      this.unnamed = this.writeNamed(reg, content);
    } else if (reg !== null && reg !== '"' && /^[0-9-]$/.test(reg)) {
      this.regs[reg] = cloneReg(content);
      this.unnamed = this.regs[reg]!;
    } else {
      this.regs['0'] = cloneReg(content);
      this.unnamed = this.regs['0']!;
    }
  }

  private writeDelete(reg: string | null, content: Reg, lineCount: number, regOne: boolean): void {
    if (reg === '_') return;
    let target: Reg | null = null;
    const append = reg !== null && UPPER.test(reg);
    if (reg !== null && reg !== '"' && /^[a-zA-Z]$/.test(reg)) target = this.writeNamed(reg, content);
    else if (reg !== null && reg !== '"' && /^[0-9-]$/.test(reg)) {
      this.regs[reg] = cloneReg(content);
      target = this.regs[reg]!;
    }
    if (content.linewise || lineCount > 1 || regOne) {
      for (let i = 9; i >= 2; i--) {
        const prev = this.regs[String(i - 1)];
        if (prev) this.regs[String(i)] = prev;
        else delete this.regs[String(i)];
      }
      this.regs['1'] = cloneReg(content);
      // Appending to an uppercase register leaves the unnamed register on that register.
      if (!append) target = this.regs['1']!;
    }
    if ((reg === null || reg === '"') && !content.linewise && lineCount === 1) {
      this.regs['-'] = cloneReg(content);
      target = this.regs['-']!;
    }
    if (target) this.unnamed = target;
  }

  // ---------------------------------------------------------------- normal mode

  private normalKey(key: string): void {
    if (key === 'Escape' || key === 'Control-c' || key === 'Control-[') {
      this.resetPending();
      return;
    }
    this.keys.push(key);
    const r = parseNormal(this.keys);
    if (r.status === 'incomplete') {
      this.partial = r.partial;
      return;
    }
    this.resetPending();
    if (r.status === 'invalid') return;
    this.execNormal(r.cmd);
  }

  private static readonly CHANGE_SIMPLE = new Set(['x', 'X', 'D', 'C', 's', 'S', 'p', 'P', 'J', '~', 'r', 'i', 'a', 'I', 'A', 'o', 'O']);

  private execNormal(cmd: Cmd): void {
    const isHistory = cmd.kind === 'simple' && (cmd.name === 'u' || cmd.name === 'Control-r');
    if (!isHistory) this.beginTxn();
    let changed = false;
    this.changeRan = false;
    this.effectiveCmd = null;
    this.syncWant = false;

    if (cmd.kind === 'motion') this.doMotion(cmd);
    else if (cmd.kind === 'op') {
      changed = cmd.name !== 'y';
      this.doOperator(cmd);
    } else if (cmd.kind === 'simple') {
      changed = VimEngine.CHANGE_SIMPLE.has(cmd.name);
      this.doSimple(cmd);
    }

    if (changed && this.changeRan && !this.replaying && cmd.name !== '.') {
      const rec = this.effectiveCmd ?? cmd;
      if (this.mode === 'insert') this.recording = { cmd: rec, keys: [] };
      else this.lastChange = { cmd: rec, insertKeys: null };
    }
    if (this.mode === 'normal') {
      if (this.syncWant && this.want !== Infinity) this.want = this.col;
      this.commitTxn();
    }
  }

  private motionCtx(cmd: Cmd, op: boolean, change: boolean): MotionCtx {
    return {
      lines: this.L,
      row: this.row,
      col: this.col,
      want: this.want,
      op,
      visual: this.visual !== null,
      change,
      opName: op ? cmd.name : null,
      count: cmd.count,
      find: this.find,
    };
  }

  private doMotion(cmd: Cmd): void {
    const res = runMotion(cmd.name, cmd.arg ?? null, this.motionCtx(cmd, false, false));
    if (!res) return;
    if (res.find) this.find = res.find;
    if (res.fail && res.row === this.row && res.col === this.col) return;
    this.row = res.row;
    this.col = res.col;
    if (this.visual) this.clampVisual();
    else this.clampNormal();
    if (res.wantMax) this.want = Infinity;
    else if (!res.keepWant) this.want = this.col;
  }

  // ---------------------------------------------------------------- operators

  private inIndent(p: Pos): boolean {
    return firstNonBlankIdx(this.L[p.row]!) >= p.col;
  }

  /** Vim's do_pending_operator() adjustments for a charwise range, then convert to half-open. */
  private charRange(sIn: Pos, eIn: Pos, inclusive: boolean, op: string, regOne: boolean): OpRange {
    const s = { ...sIn };
    const e = { ...eIn };
    let lineCount = e.row - s.row + 1;
    let linewise = false;
    if (!inclusive && e.col === 0 && lineCount > 1) {
      e.row--;
      lineCount--;
      if (this.inIndent(s)) linewise = true;
      else {
        e.col = this.len(e.row);
        if (e.col > 0) {
          e.col--;
          inclusive = true;
        }
      }
    }
    if (!linewise && op === 'd' && lineCount > 1) {
      const line = this.L[e.row]!;
      let from = e.col;
      if (e.col < line.length) from += inclusive ? 1 : 0;
      if (/^[ \t]*$/.test(line.slice(from)) && this.inIndent(s)) linewise = true;
    }
    if (linewise) {
      return { linewise: true, start: { row: s.row, col: 0 }, endEx: { row: e.row, col: 0 }, lineCount, regOne, cursor: s };
    }
    // An inclusive end on or past the line end covers no more than the line's text (Visual mode differs).
    const endEx: Pos = inclusive ? { row: e.row, col: Math.min(e.col + 1, this.len(e.row)) } : e;
    const empty = !inclusive && e.row === s.row && e.col === s.col;
    return { linewise: false, start: s, endEx, lineCount, regOne, cursor: s, empty };
  }

  private lineRange(r1: number, r2: number, cursor: Pos): OpRange {
    return { linewise: true, start: { row: r1, col: 0 }, endEx: { row: r2, col: 0 }, lineCount: r2 - r1 + 1, regOne: false, cursor };
  }

  private doOperator(cmd: Cmd): void {
    const range = this.opRange(cmd);
    if (!range) {
      // Text objects always reset the remembered column, even when they fail.
      if (cmd.motion === 'obj') this.want = this.col;
      return;
    }
    this.applyOperator(cmd.name, range, cmd.register);
  }

  private opRange(cmd: Cmd): OpRange | null {
    const op = cmd.name;
    const here: Pos = { row: this.row, col: this.col };
    if (cmd.motion === 'line') {
      const n = cmd.count ?? 1;
      let target = this.row;
      if (n > 1) {
        if (this.row >= this.L.length - 1) return null;
        target = Math.min(this.L.length - 1, this.row + n - 1);
      }
      return this.lineRange(this.row, target, here);
    }
    if (cmd.motion === 'obj') {
      const r = selectObject(this.L, here, cmd.objKind!, cmd.arg!, cmd.count ?? 1, null);
      if (!r) return null;
      if ('failAt' in r) {
        // The operator is cancelled, but the word object left the cursor where it gave up.
        this.row = r.failAt.row;
        this.col = r.failAt.col;
        this.clampNormal();
        return null;
      }
      if (r.linewise) return this.lineRange(r.start.row, r.end.row, { row: r.start.row, col: 0 });
      // Some objects (iw on an empty last line) end before they start; the operator sorts that out.
      const [os, oe] = cmpPos(r.end, r.start) < 0 ? [r.end, r.start] : [r.start, r.end];
      return this.charRange(os, oe, r.inclusive, op, false);
    }
    const res = runMotion(cmd.motion!, cmd.arg ?? null, this.motionCtx(cmd, true, op === 'c'));
    if (!res) return null;
    if (res.find) this.find = res.find;
    if (res.fail) {
      // A failed motion cancels the operator, but whatever cursor movement it made sticks.
      this.row = res.row;
      this.col = res.col;
      this.clampNormal();
      return null;
    }
    const there: Pos = { row: res.row, col: res.col };
    const [s, e] = cmpPos(there, here) < 0 ? [there, here] : [here, there];
    if (res.kind === 'linewise') return this.lineRange(s.row, e.row, s);
    const r = this.charRange(s, e, res.kind === 'inclusive', op, res.regOne === true);
    return r;
  }

  private extract(range: OpRange): Reg {
    if (range.linewise) return { lines: this.L.slice(range.start.row, range.endEx.row + 1), linewise: true };
    const { start, endEx } = range;
    if (start.row === endEx.row) return { lines: [this.L[start.row]!.slice(start.col, endEx.col)], linewise: false };
    const lines = [this.L[start.row]!.slice(start.col)];
    for (let r = start.row + 1; r < endEx.row; r++) lines.push(this.L[r]!);
    lines.push(this.L[endEx.row]!.slice(0, endEx.col));
    return { lines, linewise: false };
  }

  private removeRange(range: OpRange): void {
    if (range.linewise) {
      this.L.splice(range.start.row, range.endEx.row - range.start.row + 1);
      if (this.L.length === 0) this.L = [''];
      return;
    }
    const { start, endEx } = range;
    const head = this.L[start.row]!.slice(0, start.col);
    const tail = this.L[endEx.row]!.slice(endEx.col);
    this.L.splice(start.row, endEx.row - start.row + 1, head + tail);
  }

  private markRange(range: OpRange): void {
    if (range.linewise) {
      this.lastRange = { start: { row: range.start.row, col: 0 }, end: { row: range.endEx.row, col: 0 }, linewise: true };
    } else {
      const e = { ...range.endEx };
      if (e.col > 0) e.col--;
      this.lastRange = { start: { ...range.start }, end: e, linewise: false };
    }
  }

  private applyOperator(op: string, range: OpRange, reg: string | null): void {
    this.markRange(range);
    if (range.block) {
      this.applyBlockOperator(op, range, reg);
      return;
    }
    const empty = range.empty === true;
    if (op === 'y') {
      this.writeYank(reg, this.extract(range));
      this.setCursor(range.cursor.row, range.cursor.col);
      this.clampNormal();
      this.want = this.col;
      return;
    }
    if (op === 'd') {
      this.changeRan = true;
      if (empty) {
        // Vim still records an (empty) undo step here, so the next `u` seems to do nothing.
        this.setTxnCursor(range.cursor);
        if (this.txn) this.txn.force = true;
        this.setCursor(range.cursor.row, range.cursor.col);
        this.clampNormal();
        return;
      }
      // `D` and friends on an empty line do nothing, not even touch registers (`c` does).
      if (!range.linewise && range.lineCount === 1 && this.L[range.start.row] === '') return;
      this.setTxnCursor(range.cursor, range.linewise && range.lineCount === 1);
      if (!this.emptyBuf) this.writeDelete(reg, this.extract(range), range.lineCount, range.regOne);
      const wholeBuffer = range.linewise && range.start.row === 0 && range.endEx.row >= this.L.length - 1;
      this.removeRange(range);
      if (range.linewise) {
        if (wholeBuffer) this.emptyBuf = true;
        this.row = Math.min(range.start.row, this.L.length - 1);
        this.col = firstNonBlankCol(this.L[this.row]!);
      } else {
        this.row = range.start.row;
        this.col = range.start.col;
        this.clampNormal();
      }
      this.want = this.col;
      return;
    }
    if (this.txn) this.txn.force = true;
    // change (a multi-line `cc` saves its undo cursor on the second line, where Vim parks it while deleting)
    this.changeRan = true;
    if (range.linewise) this.setTxnCursor({ row: range.cursor.row + (range.lineCount > 1 ? 1 : 0), col: range.cursor.col }, range.lineCount === 1);
    else this.setTxnCursor(range.cursor);
    if (!empty && !this.emptyBuf) this.writeDelete(reg, this.extract(range), range.lineCount, range.regOne);
    if (range.linewise) {
      this.L.splice(range.start.row, range.endEx.row - range.start.row + 1, '');
      this.setCursor(range.start.row, 0);
    } else {
      this.removeRange(range);
      this.setCursor(range.start.row, range.start.col);
    }
    this.startInsert(1, false);
  }

  // ---------------------------------------------------------------- simple commands

  private doSimple(cmd: Cmd): void {
    const n = cmd.count ?? 1;
    const here: Pos = { row: this.row, col: this.col };
    switch (cmd.name) {
      case 'x':
      case 'X':
      case 's': {
        const alias: Cmd = { register: cmd.register, count: cmd.count, kind: 'op', name: cmd.name === 's' ? 'c' : 'd', motion: cmd.name === 'X' ? 'h' : 'l' };
        this.doOperator(alias);
        break;
      }
      case 'D':
      case 'C': {
        this.doOperator({ register: cmd.register, count: cmd.count, kind: 'op', name: cmd.name === 'D' ? 'd' : 'c', motion: '$' });
        break;
      }
      case 'S':
        this.doOperator({ register: cmd.register, count: cmd.count, kind: 'op', name: 'c', motion: 'line' });
        break;
      case 'Y':
        this.doOperator({ register: cmd.register, count: cmd.count, kind: 'op', name: 'y', motion: 'line' });
        break;
      case 'p':
      case 'P':
        this.put(cmd.register, cmd.name === 'P', n);
        break;
      case 'J': {
        let c = Math.max(2, n);
        const remaining = this.L.length - here.row;
        if (c > remaining && c > 2) {
          c = remaining;
          this.effectiveCmd = { ...cmd, count: c };
        }
        this.joinLines(c, here.row);
        break;
      }
      case '~': {
        const line = this.L[this.row]!;
        if (line.length === 0) break;
        this.changeRan = true;
        if (this.txn) this.txn.force = true;
        const end = Math.min(line.length, this.col + n);
        const flipped = [...line.slice(this.col, end)].map(toggleCase).join('');
        this.L[this.row] = line.slice(0, this.col) + flipped + line.slice(end);
        this.col = Math.min(end, line.length - 1);
        this.want = this.col;
        break;
      }
      case 'r': {
        const line = this.L[this.row]!;
        if (this.col + n > line.length) break;
        this.changeRan = true;
        if (this.txn) this.txn.force = true;
        if (cmd.arg === 'Enter') {
          this.L[this.row] = line.slice(0, this.col);
          this.L.splice(this.row + 1, 0, line.slice(this.col + n));
          this.setCursor(this.row + 1, 0);
        } else {
          this.L[this.row] = line.slice(0, this.col) + cmd.arg!.repeat(n) + line.slice(this.col + n);
          this.setCursor(this.row, this.col + n - 1);
        }
        break;
      }
      case 'i':
        this.setTxnCursor(here);
        this.startInsert(n, false);
        break;
      case 'a':
        if (this.len(this.row) > 0) this.col++;
        this.setTxnCursor({ row: this.row, col: this.col });
        this.startInsert(n, false);
        break;
      case 'I':
        this.col = firstNonBlankIdx(this.L[this.row]!);
        this.setTxnCursor({ row: this.row, col: this.col });
        this.startInsert(n, false);
        break;
      case 'A':
        this.col = this.len(this.row);
        this.setTxnCursor({ row: this.row, col: this.col });
        this.startInsert(n, false);
        break;
      case 'o':
      case 'O':
        this.setTxnCursor(here);
        this.openLine(cmd.name === 'o');
        this.startInsert(n, true);
        break;
      case 'u':
        this.undo(n);
        break;
      case 'Control-r':
        this.redo(n);
        break;
      case '.':
        this.repeatLast(cmd.count);
        break;
      case 'v':
      case 'V':
      case 'Control-v':
        this.visual = { kind: cmd.name === 'v' ? 'v' : cmd.name === 'V' ? 'V' : 'block', anchor: { ...here } };
        this.mode = cmd.name === 'v' ? 'visual' : cmd.name === 'V' ? 'visual-line' : 'visual-block';
        break;
      default:
        break;
    }
    if (this.mode === 'normal') this.clampNormal();
  }

  private openLine(below: boolean): void {
    const at = below ? this.row + 1 : this.row;
    this.L.splice(at, 0, '');
    this.setCursor(at, 0);
  }

  private joinLines(count: number, row: number): void {
    const last = this.L.length - 1;
    if (row + count - 1 > last) {
      if (count <= 2) return;
      count = last - row + 1;
    }
    this.changeRan = true;
    if (count < 2) {
      // A count that ran out of lines joins nothing, but Vim still parks the cursor at the join column (0).
      this.setCursor(row, 0);
      return;
    }
    let line = this.L[row]!;
    let col = 0;
    // Vim looks at the end of the last piece appended (not the whole accumulated line) to place spaces.
    let e1 = line.length > 0 ? line[line.length - 1]! : '';
    let e2 = line.length > 1 ? line[line.length - 2]! : '';
    for (let i = 1; i < count; i++) {
      const next = this.L[row + i]!.replace(/^[ \t]+/, '');
      let sep = '';
      if (next.length > 0 && next[0] !== ')' && line.length > 0 && e1 !== '\t') {
        let end = e1;
        if (e1 === ' ') end = e2;
        else sep = ' ';
        // 'joinspaces' (on by default in Vim): two spaces after a sentence end.
        if (end === '.' || end === '?' || end === '!') sep += ' ';
      }
      col = line.length;
      line = line + sep + next;
      e1 = next.length > 0 ? next[next.length - 1]! : '';
      e2 = next.length > 1 ? next[next.length - 2]! : '';
    }
    this.L.splice(row, count, line);
    this.row = row;
    this.col = Math.min(col, Math.max(0, line.length - 1));
    this.want = this.col;
  }

  private put(regName: string | null, before: boolean, count: number): void {
    // Vim records the put for `.` and opens an undo step before it even looks at the register.
    this.changeRan = true;
    if (this.txn) this.txn.force = true;
    const reg = this.getReg(regName);
    if (!reg) return;
    this.putReg(cloneReg(reg), before, count, false, false);
  }

  /** Insert register contents at the cursor. `asLines` and `split` mirror Vim's PUT_LINE and PUT_LINE_SPLIT. */
  private putReg(reg: Reg, before: boolean, count: number, asLines: boolean, split: boolean): void {
    this.emptyBuf = false;
    if (asLines) reg = { lines: reg.lines, linewise: true };
    if (reg.block) {
      this.putBlock(reg, before, count);
      return;
    }
    if (reg.linewise) {
      if (split) {
        // Visual `p`/`P` of lines over part of a line: split the line and put the lines in between.
        const line = this.L[this.row]!;
        const at = !before && line.length > 0 ? Math.min(this.col + 1, line.length) : this.col;
        this.L.splice(this.row, 1, line.slice(0, at), line.slice(at));
        before = false;
      }
      const at = before ? this.row : this.row + 1;
      const lines: string[] = [];
      for (let i = 0; i < count; i++) lines.push(...reg.lines);
      this.L.splice(at, 0, ...lines);
      this.row = at;
      this.col = firstNonBlankCol(this.L[at]!);
      this.want = this.col;
      this.lastRange = { start: { row: at, col: 0 }, end: { row: at + lines.length - 1, col: 0 }, linewise: true };
      return;
    }
    const line = this.L[this.row]!;
    const p = line.length === 0 ? 0 : before ? this.col : this.col + 1;
    if (reg.lines.length === 1) {
      const text = reg.lines[0]!.repeat(count);
      this.L[this.row] = line.slice(0, p) + text + line.slice(p);
      if (text.length > 0) this.setCursor(this.row, p + text.length - 1);
      this.lastRange = { start: { row: this.row, col: p }, end: { row: this.row, col: p + Math.max(0, text.length - 1) }, linewise: false };
      return;
    }
    const all = reg.lines.join('\n').repeat(count).split('\n');
    const head = line.slice(0, p);
    const tail = line.slice(p);
    const out = [...all];
    out[0] = head + out[0];
    out[out.length - 1] += tail;
    this.L.splice(this.row, 1, ...out);
    this.setCursor(this.row, p);
    this.lastRange = { start: { row: this.row, col: p }, end: { row: this.row + out.length - 1, col: 0 }, linewise: false };
  }

  private putBlock(reg: Reg, before: boolean, count: number): void {
    const width = Math.max(...reg.lines.map((l) => l.length));
    const line = this.L[this.row]!;
    const col = line.length === 0 ? 0 : before ? this.col : this.col + 1;
    reg.lines.forEach((text, i) => {
      const r = this.row + i;
      if (r >= this.L.length) this.L.push('');
      let l = this.L[r]!;
      if (l.length < col) l = l + ' '.repeat(col - l.length);
      const piece = (text + ' '.repeat(width - text.length)).repeat(count);
      const rest = l.slice(col);
      this.L[r] = l.slice(0, col) + (rest.length > 0 ? piece : piece.replace(/ +$/, '')) + rest;
    });
    this.setCursor(this.row, col);
  }

  // ---------------------------------------------------------------- insert mode

  private startInsert(count: number, openLine: boolean): void {
    this.changeRan = true;
    this.mode = 'insert';
    this.ins = { count, openLine, typed: [], start: { row: this.row, col: this.col } };
    this.visual = null;
  }

  private insertKey(key: string): void {
    const ins = this.ins!;
    if (key === 'Escape' || key === 'Control-[' || key === 'Control-c') {
      this.finishInsert();
      return;
    }
    if (!this.insertAction(key)) return;
    ins.typed.push(key);
    this.recording?.keys.push(key);
  }

  /** Perform one insert-mode key; returns false when the key does nothing here. */
  private insertAction(key: string): boolean {
    const line = this.L[this.row]!;
    if (key.length === 1 || key === 'Tab' || key === 'Enter') this.emptyBuf = false;
    if (key.length === 1 || key === 'Tab') {
      const ch = key === 'Tab' ? '\t' : key;
      this.L[this.row] = line.slice(0, this.col) + ch + line.slice(this.col);
      this.col += ch.length;
    } else if (key === 'Enter') {
      this.L[this.row] = line.slice(0, this.col);
      this.L.splice(this.row + 1, 0, line.slice(this.col));
      this.row++;
      this.col = 0;
    } else if (key === 'Backspace' || key === 'Control-h') {
      this.backspace();
    } else if (key === 'Delete') {
      if (this.col < line.length) this.L[this.row] = line.slice(0, this.col) + line.slice(this.col + 1);
      else if (this.row < this.L.length - 1) {
        this.L[this.row] = line + this.L[this.row + 1];
        this.L.splice(this.row + 1, 1);
      }
    } else if (key === 'Control-w') {
      this.deleteWordBack();
    } else if (key === 'Control-u') {
      this.deleteLineBack();
    } else return false;
    this.want = this.col;
    return true;
  }

  private backspace(): void {
    if (this.col > 0) {
      const line = this.L[this.row]!;
      this.L[this.row] = line.slice(0, this.col - 1) + line.slice(this.col);
      this.col--;
    } else if (this.row > 0) {
      const prev = this.L[this.row - 1]!;
      this.col = prev.length;
      this.L[this.row - 1] = prev + this.L[this.row];
      this.L.splice(this.row, 1);
      this.row--;
    }
  }

  private atInsertStart(): boolean {
    const s = this.ins?.start;
    return !!s && s.row === this.row && s.col === this.col;
  }

  private deleteWordBack(): void {
    if (this.col === 0) {
      this.backspace();
      return;
    }
    const line = this.L[this.row]!;
    let i = this.col;
    const stop = this.ins && this.ins.start.row === this.row && this.ins.start.col < this.col ? this.ins.start.col : 0;
    while (i > stop && isWhite(line[i - 1])) i--;
    if (i > stop) {
      const word = isWordChar(line[i - 1]!);
      while (i > stop && !isWhite(line[i - 1]) && isWordChar(line[i - 1]!) === word) i--;
    }
    this.L[this.row] = line.slice(0, i) + line.slice(this.col);
    this.col = i;
  }

  private deleteLineBack(): void {
    if (this.col === 0) {
      this.backspace();
      return;
    }
    const line = this.L[this.row]!;
    const stop = this.ins && this.ins.start.row === this.row && this.ins.start.col < this.col ? this.ins.start.col : 0;
    this.L[this.row] = line.slice(0, stop) + line.slice(this.col);
    this.col = stop;
  }

  private finishInsert(): void {
    const ins = this.ins!;
    const typed = [...ins.typed];
    if (ins.count > 1 && !this.replaying) {
      for (let i = 1; i < ins.count; i++) {
        if (ins.openLine) this.openLine(true);
        for (const k of typed) this.insertAction(k);
      }
    } else if (ins.count > 1) {
      for (let i = 1; i < ins.count; i++) {
        if (ins.openLine) this.openLine(true);
        for (const k of typed) this.insertAction(k);
      }
    }
    this.replicateBlockInsert();
    if (this.col > 0) this.col--;
    this.want = this.col;
    this.mode = 'normal';
    this.ins = null;
    if (this.recording && !this.replaying) {
      this.lastChange = { cmd: this.recording.cmd, insertKeys: this.recording.keys, visual: this.recording.visual };
    }
    this.recording = null;
    this.clampNormal();
    this.commitTxn();
  }

  // ---------------------------------------------------------------- undo / redo / dot

  /** Mirrors Vim's u_undoredo() cursor placement, using the minimal changed region of the buffer. */
  private placeCursorAfterHistory(entry: UndoEntry, from: string[], to: string[]): void {
    let d = 0;
    while (d < from.length && d < to.length && from[d] === to[d]) d++;
    // Vim saved undo text starting at the line where the command began, even if the first lines came out unchanged.
    d = Math.min(d, entry.cursorBefore.row);
    let suffix = 0;
    while (suffix < from.length - d && suffix < to.length - d && from[from.length - 1 - suffix] === to[to.length - 1 - suffix]) suffix++;
    let newSize = to.length - d - suffix;
    const uh = entry.cursorBefore;
    if (entry.forced) {
      d = uh.row;
      newSize = 1;
    }
    let row: number;
    if (uh.row + 1 >= d && uh.row + 1 <= d + newSize + 1) row = uh.row;
    else row = d;
    if (uh.row + 1 === row && row > 0) row--;
    if (row <= to.length - 1) {
      this.row = row;
      this.col = uh.row === row ? uh.col : firstNonBlankCol(to[row]!);
      if (entry.capIndent && uh.row === row) this.col = Math.min(this.col, firstNonBlankIdx(to[row]!));
    } else {
      this.row = to.length - 1;
      this.col = 0;
    }
    this.clampNormal();
    this.want = this.col;
  }

  private undo(count: number): void {
    this.emptyBuf = false;
    for (let i = 0; i < count; i++) {
      const e = this.undoStack.pop();
      if (!e) break;
      this.redoStack.push(e);
      const from = this.L;
      this.L = [...e.before];
      this.placeCursorAfterHistory(e, from, this.L);
    }
  }

  private redo(count: number): void {
    this.emptyBuf = false;
    for (let i = 0; i < count; i++) {
      const e = this.redoStack.pop();
      if (!e) break;
      this.undoStack.push(e);
      const from = this.L;
      this.L = [...e.after];
      this.placeCursorAfterHistory(e, from, this.L);
    }
  }

  private repeatLast(count: number | null): void {
    const last = this.lastChange;
    if (!last) return;
    // Repeating a put from a numbered register walks down the delete history: "1p then . puts "2p, ...
    if (last.cmd.kind === 'simple' && (last.cmd.name === 'p' || last.cmd.name === 'P') && last.cmd.register && /^[1-8]$/.test(last.cmd.register)) {
      last.cmd = { ...last.cmd, register: String(Number(last.cmd.register) + 1) };
    }
    const cmd: Cmd = count !== null ? { ...last.cmd, count } : last.cmd;
    this.replaying = true;
    try {
      if (last.visual) this.redoVisual(cmd, last.visual);
      else this.execNormalInner(cmd);
      if (this.mode === 'insert') {
        for (const k of last.insertKeys ?? []) this.insertKey(k);
        this.insertKey('Escape');
      }
    } finally {
      this.replaying = false;
    }
  }

  private execNormalInner(cmd: Cmd): void {
    if (cmd.kind === 'op') this.doOperator(cmd);
    else if (cmd.kind === 'simple') this.doSimple(cmd);
    else this.doMotion(cmd);
  }

  // ---------------------------------------------------------------- visual mode

  private visualKey(key: string): void {
    const v = this.visual!;
    if (key === 'Escape' || key === 'Control-c' || key === 'Control-[') {
      if (this.keys.length > 0) this.resetPending();
      else this.exitVisual();
      return;
    }
    this.keys.push(key);
    const r = parseVisual(this.keys);
    if (r.status === 'incomplete') {
      this.partial = r.partial;
      return;
    }
    this.resetPending();
    if (r.status === 'invalid') return;
    const cmd = r.cmd;
    void v;
    if (cmd.kind === 'motion') {
      this.doMotion(cmd);
      return;
    }
    if (cmd.kind === 'obj') {
      this.visualObject(cmd);
      return;
    }
    this.visualCommand(cmd);
  }

  private exitVisual(): void {
    this.visual = null;
    this.mode = 'normal';
    this.clampNormal();
    this.want = this.col;
  }

  private visualObject(cmd: Cmd): void {
    const v = this.visual!;
    const here: Pos = { row: this.row, col: this.col };
    const r = selectObject(this.L, here, cmd.name as 'i' | 'a', cmd.arg!, cmd.count ?? 1, v.anchor, v.kind);
    if (!r) {
      this.want = this.col;
      return;
    }
    if ('failAt' in r) {
      this.row = r.failAt.row;
      this.col = r.failAt.col;
      this.clampVisual();
      this.want = this.col;
      return;
    }
    if (r.visual) {
      if (r.visual.anchor) v.anchor = { ...r.visual.anchor };
      const want = r.visual.mode;
      if (want && (!r.visual.onlyFromV || v.kind === 'V') && want !== v.kind) {
        v.kind = want;
        this.mode = want === 'v' ? 'visual' : 'visual-line';
      }
      this.row = r.visual.cursor.row;
      this.col = r.visual.cursor.col;
      this.clampVisual();
      this.want = this.col;
      return;
    }
    // Objects without Visual-specific rules (quotes): select start..end.
    if (cmpPos(v.anchor, here) === 0) v.anchor = { ...r.start };
    this.row = r.end.row;
    this.col = r.end.col;
    if (!r.inclusive) {
      if (this.col > 0) this.col--;
      else if (this.row > 0) {
        this.row--;
        this.col = Math.max(0, this.len(this.row) - 1);
      }
    }
    this.clampVisual();
    this.want = this.col;
  }

  private visualRange(): OpRange {
    const v = this.visual!;
    const here: Pos = { row: this.row, col: this.col };
    const [s, e] = cmpPos(v.anchor, here) <= 0 ? [v.anchor, here] : [here, v.anchor];
    // A linewise selection starting at the anchor parks the cursor in column 0; one starting at the cursor keeps its column.
    if (v.kind === 'V') return this.lineRange(s.row, e.row, v.anchor.row <= here.row ? { row: s.row, col: 0 } : { row: here.row, col: here.col });
    if (v.kind === 'block') {
      const left = Math.min(v.anchor.col, this.col);
      const right = Math.max(v.anchor.col, this.col);
      const toEol = this.want === Infinity;
      return {
        linewise: false,
        start: { row: s.row, col: left },
        endEx: { row: e.row, col: right + 1 },
        lineCount: e.row - s.row + 1,
        regOne: false,
        cursor: { row: s.row, col: left },
        block: { top: s.row, bottom: e.row, left, right, toEol },
      };
    }
    // charwise, inclusive; a cursor on the line end includes the line break
    let endEx: Pos;
    let lineCount = e.row - s.row + 1;
    let empty = false;
    if (e.col >= this.len(e.row)) {
      if (e.row < this.L.length - 1) {
        endEx = { row: e.row + 1, col: 0 };
        lineCount++;
      } else {
        endEx = { row: e.row, col: this.len(e.row) };
        empty = s.row === e.row && s.col >= endEx.col;
      }
    } else endEx = { row: e.row, col: e.col + 1 };
    return { linewise: false, start: { ...s }, endEx, lineCount, regOne: false, cursor: { ...s }, empty };
  }

  private visualCommand(cmd: Cmd): void {
    const v = this.visual!;
    const reg = cmd.register;
    switch (cmd.name) {
      case 'o':
      case 'O': {
        const a = v.anchor;
        v.anchor = { row: this.row, col: this.col };
        this.row = a.row;
        this.col = a.col;
        this.want = this.col;
        return;
      }
      case 'v':
      case 'V':
      case 'Control-v': {
        const k: VisualKind = cmd.name === 'v' ? 'v' : cmd.name === 'V' ? 'V' : 'block';
        if (v.kind === k) this.exitVisual();
        else {
          v.kind = k;
          this.mode = k === 'v' ? 'visual' : k === 'V' ? 'visual-line' : 'visual-block';
        }
        return;
      }
      default:
        break;
    }

    this.beginTxn();
    {
      const here: Pos = { row: this.row, col: this.col };
      const [a, b] = cmpPos(v.anchor, here) <= 0 ? [v.anchor, here] : [here, v.anchor];
      this.visualEnds = { start: { ...a }, end: { ...b }, linewise: v.kind === 'V', cursorCol: here.col };
    }
    let range = this.visualRange();
    // Uppercase operators turn a Visual selection linewise, except in block mode (S and R always do).
    const forceLines = cmd.name === 'S' || cmd.name === 'R' || (!range.block && ['X', 'Y', 'D', 'C'].includes(cmd.name));
    if (v.kind !== 'V' && forceLines) {
      const here: Pos = { row: this.row, col: this.col };
      const cur = v.anchor.row <= here.row ? { row: range.start.row, col: 0 } : here;
      range = this.lineRange(range.start.row, Math.max(range.start.row, range.endEx.row - (range.endEx.col === 0 && range.endEx.row > range.start.row ? 1 : 0)), cur);
    }
    if (range.block && (cmd.name === 'D' || cmd.name === 'C')) range.block.toEol = true;
    this.setTxnCursor(range.cursor);
    const redo = this.visualRedoInfo(range, v);
    this.visual = null;
    this.mode = 'normal';
    this.keys = [];
    const n = cmd.count ?? 1;
    this.changeRan = false;
    this.effectiveCmd = null;

    switch (cmd.name) {
      case 'd':
      case 'x':
      case 'X':
      case 'D':
        this.applyOperator('d', range, reg);
        break;
      case 'y':
      case 'Y':
        this.applyOperator('y', range, reg);
        break;
      case 'c':
      case 's':
      case 'C':
      case 'S':
      case 'R':
        this.applyOperator('c', range, reg);
        break;
      case 'J': {
        const top = range.start.row;
        const bottom = range.linewise ? range.endEx.row : Math.max(top, range.endEx.col === 0 && range.endEx.row > top ? range.endEx.row - 1 : range.endEx.row);
        const joinCount = Math.max(2, bottom - top + 1);
        // Joining past the last line just beeps, leaving the cursor at the start of the selection.
        if (top + joinCount - 1 > this.L.length - 1) this.setCursor(range.cursor.row, range.cursor.col);
        else this.joinLines(joinCount, top);
        break;
      }
      case '~':
      case 'u':
      case 'U':
        this.caseRange(range, cmd.name);
        break;
      case 'r':
        this.replaceRange(range, cmd.arg!);
        break;
      case 'p':
      case 'P':
        this.visualPut(range, reg, cmd.name === 'P', n);
        break;
      case 'I':
      case 'A':
        this.blockInsert(range, cmd.name === 'A');
        return;
      default:
        break;
    }
    if (VimEngine.VISUAL_REDO.has(cmd.name) && !this.replaying) {
      // The operator may have started an insert (c, s, I, A), which the compiler can't see through `this`.
      if ((this.mode as Mode) === 'insert') this.recording = { cmd, keys: [], visual: redo };
      else this.lastChange = { cmd, insertKeys: null, visual: redo };
    }
    if (this.mode === 'normal') {
      this.clampNormal();
      this.commitTxn();
    }
  }

  private static readonly VISUAL_REDO = new Set(['d', 'x', 'X', 'D', 'c', 's', 'C', 'S', 'R', 'J', '~', 'u', 'U', 'r', 'p', 'P']);

  private visualRedoInfo(range: OpRange, v: { kind: VisualKind; anchor: Pos }): VisualRedo {
    const here: Pos = { row: this.row, col: this.col };
    const [a, b] = cmpPos(v.anchor, here) <= 0 ? [v.anchor, here] : [here, v.anchor];
    const lines = b.row - a.row + 1;
    if (v.kind === 'V') return { kind: 'V', lines, width: 0, toEol: false };
    if (v.kind === 'block') {
      const w = range.block ? range.block.right - range.block.left + 1 : 1;
      return { kind: 'block', lines, width: w, toEol: range.block?.toEol === true };
    }
    return { kind: 'v', lines, width: lines <= 1 ? b.col - a.col + 1 : b.col, toEol: this.want === Infinity };
  }

  /** Redo a Visual-mode change on the same amount of text, starting at the cursor. */
  private redoVisual(cmd: Cmd, vr: VisualRedo): void {
    const start: Pos = { row: this.row, col: this.col };
    this.visual = { kind: vr.kind, anchor: start };
    this.mode = vr.kind === 'v' ? 'visual' : vr.kind === 'V' ? 'visual-line' : 'visual-block';
    const row = Math.min(this.L.length - 1, start.row + vr.lines - 1);
    let col = start.col;
    if (vr.kind === 'v') col = vr.lines <= 1 ? start.col + vr.width - 1 : vr.width;
    else if (vr.kind === 'block') col = start.col + vr.width - 1;
    this.row = row;
    this.col = Math.min(col, this.len(row));
    this.want = vr.toEol ? Infinity : this.col;
    if (vr.toEol) this.col = this.len(row);
    this.visualCommand(cmd);
  }

  private mapRange(range: OpRange, f: (s: string) => string): void {
    if (range.block) {
      const b = range.block;
      for (let r = b.top; r <= b.bottom; r++) {
        const line = this.L[r]!;
        const right = b.toEol ? line.length : b.right + 1;
        if (line.length <= b.left) continue;
        this.L[r] = line.slice(0, b.left) + f(line.slice(b.left, right)) + line.slice(right);
      }
    } else if (range.linewise) {
      for (let r = range.start.row; r <= range.endEx.row; r++) this.L[r] = f(this.L[r]!);
    } else {
      const { start, endEx } = range;
      for (let r = start.row; r <= Math.min(endEx.row, this.L.length - 1); r++) {
        const line = this.L[r]!;
        const from = r === start.row ? start.col : 0;
        const to = r === endEx.row ? endEx.col : line.length;
        this.L[r] = line.slice(0, from) + f(line.slice(from, to)) + line.slice(to);
      }
    }
    this.setCursor(range.cursor.row, range.cursor.col);
  }

  private caseRange(range: OpRange, name: string): void {
    const f = name === 'u' ? (s: string) => s.toLowerCase() : name === 'U' ? (s: string) => s.toUpperCase() : (s: string) => [...s].map(toggleCase).join('');
    this.markRange(range);
    this.mapRange(range, f);
  }

  private replaceRange(range: OpRange, ch: string): void {
    this.markRange(range);
    this.mapRange(range, (s) => ch.repeat(s.length));
  }

  /** Visual `p`/`P`: delete the selection, then put the register where it was (Vim's nv_put). */
  private visualPut(range: OpRange, regName: string | null, keepRegisters: boolean, count: number): void {
    const src = this.getReg(regName);
    const content = src ? cloneReg(src) : null;
    const startPos = { ...range.start };
    const wasV = !range.linewise && !range.block;
    const wholeBuffer = range.linewise && range.start.row === 0 && range.endEx.row >= this.L.length - 1;
    // Delete the selection; `P` sends it to the black hole so the registers stay as they were.
    this.applyOperator('d', range, keepRegisters ? '_' : null);
    if (!content) return;
    this.changeRan = true;
    let before = true;
    if (range.linewise ? this.row < startPos.row : this.col < startPos.col) before = false;
    if (range.block && !keepRegisters && content.linewise) {
      // `p` of lines over a block puts them below the block.
      this.row = range.block.bottom - (range.endEx.row - range.block.bottom === 0 ? 0 : 0);
      this.row = Math.min(range.block.bottom, this.L.length - 1);
      before = false;
    }
    this.putReg(content, before, count, range.linewise, wasV && content.linewise);
    // Everything was selected and deleted: the put leaves the original empty line behind.
    if (wholeBuffer && this.L.length > 1 && this.L[this.L.length - 1] === '') {
      this.L.pop();
      if (this.row > this.L.length - 1) {
        this.row = this.L.length - 1;
        this.col = Math.max(0, this.len(this.row) - 1);
      }
    }
  }

  private blockInsert(range: OpRange, append: boolean): void {
    if (!range.block) {
      // Outside block mode I/A insert at the start, or just after the end, of the selection.
      const sel = this.visualEnds;
      if (append) {
        const e = sel.end;
        const c = sel.cursorCol;
        this.setCursor(e.row, Math.min(c, this.len(e.row)));
        if (this.len(e.row) > 0) this.col = Math.min(this.len(e.row), this.col + 1);
      } else this.setCursor(sel.start.row, 0);
      this.want = this.col;
      this.setTxnCursor({ row: this.row, col: this.col });
      this.startInsert(1, false);
      return;
    }
    const b = range.block;
    if (append) {
      const col = b.toEol ? this.len(b.top) : b.right + 1;
      const line = this.L[b.top]!;
      if (line.length < col) this.L[b.top] = line + ' '.repeat(col - line.length);
      this.setCursor(b.top, col);
    } else this.setCursor(b.top, b.left);
    this.startInsert(1, false);
    this.blockPending = { top: b.top, bottom: b.bottom, col: this.col, append, toEol: b.toEol, left: b.left, right: b.right, park: true };
  }

  private visualEnds: { start: Pos; end: Pos; linewise: boolean; cursorCol: number } = { start: { row: 0, col: 0 }, end: { row: 0, col: 0 }, linewise: false, cursorCol: 0 };
  private blockPending: { top: number; bottom: number; col: number; append: boolean; toEol: boolean; left: number; right: number; park: boolean } | null = null;

  /** Visual-block I / A / c: copy the text typed on the first line onto the other lines of the block. */
  private replicateBlockInsert(): void {
    const bp = this.blockPending;
    this.blockPending = null;
    if (!bp) return;
    if (this.row !== bp.top) {
      return;
    }
    const text = this.L[bp.top]!.slice(bp.col, this.col);
    // Block inserts end on the first column of the block, not after the typed text.
    const park = () => {
      if (!bp.park) return;
      this.row = bp.top;
      this.col = bp.left + 1;
    };
    if (text.length === 0 || this.ins === null) {
      park();
      return;
    }
    for (let r = bp.top + 1; r <= bp.bottom; r++) {
      let line = this.L[r]!;
      if (bp.append) {
        const at = bp.toEol ? line.length : bp.right + 1;
        if (line.length < at) line = line + ' '.repeat(at - line.length);
        this.L[r] = line.slice(0, at) + text + line.slice(at);
      } else {
        if (line.length < bp.left) continue;
        this.L[r] = line.slice(0, bp.left) + text + line.slice(bp.left);
      }
    }
    park();
  }

  private applyBlockOperator(op: string, range: OpRange, reg: string | null): void {
    const b = range.block!;
    // A block delete on a single empty line does nothing at all (not even registers).
    if (op !== 'y' && b.top === b.bottom && this.L[b.top] === '') return;
    const lines: string[] = [];
    for (let r = b.top; r <= b.bottom; r++) {
      const line = this.L[r]!;
      const right = b.toEol ? line.length : b.right + 1;
      // Rows that stop before the block are yanked as blanks of the block's width.
      if (!b.toEol && line.length < b.left) lines.push(' '.repeat(b.right - b.left + 1));
      else lines.push(line.slice(Math.min(b.left, line.length), right));
    }
    const content: Reg = { lines, linewise: false, block: true };
    if (op === 'y') {
      this.writeYank(reg, content);
      this.setCursor(b.top, b.left);
      return;
    }
    if (!this.emptyBuf) this.writeDelete(reg, content, lines.length, false);
    for (let r = b.top; r <= b.bottom; r++) {
      const line = this.L[r]!;
      const right = b.toEol ? line.length : b.right + 1;
      this.L[r] = line.slice(0, Math.min(b.left, line.length)) + line.slice(right);
    }
    this.setCursor(b.top, b.left);
    if (op === 'c') {
      this.startInsert(1, false);
      this.blockPending = { top: b.top, bottom: b.bottom, col: b.left, append: false, toEol: false, left: b.left, right: b.right, park: false };
    } else this.clampNormal();
  }
}
