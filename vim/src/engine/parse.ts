/**
 * Normal- and visual-mode command parser. Keys arrive one at a time; `parse` says whether the
 * keys so far form a complete command, a valid prefix, or nonsense (which cancels the command).
 */

export interface Cmd {
  register: string | null;
  /** Combined count (count before operator × count after), or null if none typed. */
  count: number | null;
  kind: 'motion' | 'op' | 'simple' | 'obj';
  /** Motion key, operator key, simple command name, or the `i`/`a` of a text object. */
  name: string;
  /** For `op`: 'line' (dd), 'obj' (diw) or a motion key. */
  motion?: string;
  /** Character argument: f/t target, r replacement, text-object char. */
  arg?: string | null;
  /** For `op` with motion 'obj': 'i' or 'a'. */
  objKind?: 'i' | 'a';
}

export interface Partial {
  register: string | null;
  count: number | null;
  operator: string | null;
  awaiting: string | null;
}

export type ParseResult =
  | { status: 'incomplete'; partial: Partial }
  | { status: 'invalid' }
  | { status: 'done'; cmd: Cmd };

const SIMPLE_MOTIONS = new Set(['h', 'j', 'k', 'l', 'w', 'W', 'b', 'B', 'e', 'E', '^', '$', '_', 'G', '{', '}', '%', ';', ',', '-', '+', 'Enter']);
const OPERATORS = new Set(['d', 'c', 'y']);
const ARG_MOTIONS = new Set(['f', 'F', 't', 'T']);
const OBJECT_CHARS = new Set(['w', 'W', 'p', '(', ')', 'b', '[', ']', '{', '}', 'B', '<', '>', '"', "'", '`']);
const SIMPLE_CMDS = new Set(['x', 'X', 'D', 'C', 's', 'S', 'Y', 'p', 'P', 'J', '~', 'i', 'a', 'I', 'A', 'o', 'O', 'u', '.', 'v', 'V', 'Control-v', 'Control-r', 'R']);
const VISUAL_CMDS = new Set(['d', 'x', 'X', 'D', 'y', 'Y', 'c', 's', 'C', 'S', 'R', 'J', '~', 'u', 'U', 'p', 'P', 'o', 'O', 'v', 'V', 'Control-v', 'I', 'A', 'Escape', 'Control-c']);
const REGISTER_RE = /^[a-zA-Z0-9"\-_]$/;

type MotionRead =
  | { status: 'incomplete'; awaiting: string }
  | { status: 'invalid' }
  | { status: 'ok'; motion: string; arg: string | null; next: number };

function readMotion(keys: readonly string[], i: number): MotionRead {
  const k = keys[i];
  if (k === undefined) return { status: 'incomplete', awaiting: '' };
  if (SIMPLE_MOTIONS.has(k) || k === '0') return { status: 'ok', motion: k, arg: null, next: i + 1 };
  if (ARG_MOTIONS.has(k)) {
    const a = keys[i + 1];
    if (a === undefined) return { status: 'incomplete', awaiting: k };
    if (a.length === 1) return { status: 'ok', motion: k, arg: a, next: i + 2 };
    return { status: 'invalid' };
  }
  if (k === 'g') {
    const a = keys[i + 1];
    if (a === undefined) return { status: 'incomplete', awaiting: 'g' };
    if (a === 'g' || a === 'e' || a === 'E') return { status: 'ok', motion: 'g' + a, arg: null, next: i + 2 };
    return { status: 'invalid' };
  }
  return { status: 'invalid' };
}

function readCount(keys: readonly string[], i: number): { count: number | null; next: number } {
  let count: number | null = null;
  while (i < keys.length) {
    const k = keys[i]!;
    if (/^[1-9]$/.test(k) || (count !== null && k === '0')) {
      count = (count ?? 0) * 10 + Number(k);
      i++;
    } else break;
  }
  return { count, next: i };
}

type PrefixRead =
  | { status: 'ok'; register: string | null; count: number | null; next: number }
  | { status: 'incomplete' }
  | { status: 'invalid' };

/** Count and register prefix in any order ("3\"a", "\"a3"); digits keep accumulating across the register. */
function readPrefix(keys: readonly string[]): PrefixRead {
  let i = 0;
  let register: string | null = null;
  let count: number | null = null;
  for (;;) {
    const k = keys[i];
    if (k === '"') {
      const r = keys[i + 1];
      if (r === undefined) return { status: 'incomplete' };
      if (!REGISTER_RE.test(r)) return { status: 'invalid' };
      register = r;
      i += 2;
    } else if (k !== undefined && (/^[1-9]$/.test(k) || (count !== null && k === '0'))) {
      count = (count ?? 0) * 10 + Number(k);
      i++;
    } else break;
  }
  return { status: 'ok', register, count, next: i };
}

function mulCount(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 1) * (b ?? 1);
}

export function parseNormal(keys: readonly string[]): ParseResult {
  const pre = readPrefix(keys);
  if (pre.status === 'incomplete') return { status: 'incomplete', partial: { register: null, count: null, operator: null, awaiting: '"' } };
  if (pre.status === 'invalid') return { status: 'invalid' };
  let i = pre.next;
  const register = pre.register;
  const c1 = { count: pre.count, next: i };
  const base: Partial = { register, count: c1.count, operator: null, awaiting: null };
  const k = keys[i];
  if (k === undefined) return { status: 'incomplete', partial: base };

  if (OPERATORS.has(k)) {
    i++;
    const c2 = readCount(keys, i);
    i = c2.next;
    const count = mulCount(c1.count, c2.count);
    const partial: Partial = { register, count, operator: k, awaiting: null };
    const k2 = keys[i];
    if (k2 === undefined) return { status: 'incomplete', partial };
    if (k2 === k) return { status: 'done', cmd: { register, count, kind: 'op', name: k, motion: 'line' } };
    if (k2 === 'i' || k2 === 'a') {
      const o = keys[i + 1];
      if (o === undefined) return { status: 'incomplete', partial: { ...partial, awaiting: k2 } };
      if (!OBJECT_CHARS.has(o)) return { status: 'invalid' };
      return { status: 'done', cmd: { register, count, kind: 'op', name: k, motion: 'obj', objKind: k2, arg: o } };
    }
    const m = readMotion(keys, i);
    if (m.status === 'incomplete') return { status: 'incomplete', partial: { ...partial, awaiting: m.awaiting } };
    if (m.status === 'invalid') return { status: 'invalid' };
    return { status: 'done', cmd: { register, count, kind: 'op', name: k, motion: m.motion, arg: m.arg } };
  }

  const m = readMotion(keys, i);
  if (m.status === 'ok') return { status: 'done', cmd: { register, count: c1.count, kind: 'motion', name: m.motion, arg: m.arg } };
  if (m.status === 'incomplete') return { status: 'incomplete', partial: { ...base, awaiting: m.awaiting } };

  if (k === 'r') {
    const a = keys[i + 1];
    if (a === undefined) return { status: 'incomplete', partial: { ...base, awaiting: 'r' } };
    if (a.length === 1 || a === 'Enter') return { status: 'done', cmd: { register, count: c1.count, kind: 'simple', name: 'r', arg: a } };
    return { status: 'invalid' };
  }
  if (SIMPLE_CMDS.has(k)) return { status: 'done', cmd: { register, count: c1.count, kind: 'simple', name: k } };
  return { status: 'invalid' };
}

/** Visual mode: operators act immediately on the selection; motions and text objects extend it. */
export function parseVisual(keys: readonly string[]): ParseResult {
  const pre = readPrefix(keys);
  if (pre.status === 'incomplete') return { status: 'incomplete', partial: { register: null, count: null, operator: null, awaiting: '"' } };
  if (pre.status === 'invalid') return { status: 'invalid' };
  let i = pre.next;
  const register = pre.register;
  const c1 = { count: pre.count, next: i };
  const base: Partial = { register, count: c1.count, operator: null, awaiting: null };
  const k = keys[i];
  if (k === undefined) return { status: 'incomplete', partial: base };

  if (k === 'i' || k === 'a') {
    const o = keys[i + 1];
    if (o === undefined) return { status: 'incomplete', partial: { ...base, awaiting: k } };
    if (!OBJECT_CHARS.has(o)) return { status: 'invalid' };
    return { status: 'done', cmd: { register, count: c1.count, kind: 'obj', name: k, arg: o } };
  }
  const m = readMotion(keys, i);
  if (m.status === 'ok') return { status: 'done', cmd: { register, count: c1.count, kind: 'motion', name: m.motion, arg: m.arg } };
  if (m.status === 'incomplete') return { status: 'incomplete', partial: { ...base, awaiting: m.awaiting } };

  if (k === 'r') {
    const a = keys[i + 1];
    if (a === undefined) return { status: 'incomplete', partial: { ...base, awaiting: 'r' } };
    if (a.length === 1) return { status: 'done', cmd: { register, count: c1.count, kind: 'simple', name: 'r', arg: a } };
    return { status: 'invalid' };
  }
  if (VISUAL_CMDS.has(k)) return { status: 'done', cmd: { register, count: c1.count, kind: 'simple', name: k } };
  return { status: 'invalid' };
}
