import type { EngineFactory, Pos } from '@kbm/shared';

/** A route step: one or more keys that count as one move, with their key cost. */
export interface Move {
  keys: string[];
}

const BASE: string[][] = [['h'], ['j'], ['k'], ['l'], ['w'], ['b'], ['e'], ['W'], ['B'], ['E'], ['0'], ['^'], ['$'], ['g', 'g'], ['G']];

/** Moves worth searching over for a given text: the basic motions plus f/F/t/T for each character in it. */
export function movesFor(lines: readonly string[], allow: 'basic' | 'find' = 'find'): Move[] {
  const out: Move[] = BASE.map((keys) => ({ keys }));
  if (allow === 'find') {
    const chars = new Set<string>();
    for (const l of lines) for (const c of l) if (c !== ' ') chars.add(c);
    for (const c of chars) for (const k of ['f', 'F', 't', 'T']) out.push({ keys: [k, c] });
  }
  return out;
}

const key = (p: Pos): string => `${p.row},${p.col}`;

/**
 * Fewest keystrokes to take the cursor from `from` to `to`, found by breadth-first search over cursor
 * positions with the real Vim engine doing each move. Returns the keys, or null if no route within `maxKeys`.
 * `blocked` can forbid cells (walls) so the same search works on the map.
 */
export function optimalRoute(
  factory: EngineFactory,
  lines: readonly string[],
  from: Pos,
  to: Pos,
  opts: { maxKeys?: number; moves?: Move[]; allow?: 'basic' | 'find' } = {},
): string[] | null {
  const maxKeys = opts.maxKeys ?? 8;
  const moves = opts.moves ?? movesFor(lines, opts.allow ?? 'find');
  if (from.row === to.row && from.col === to.col) return [];
  const engine = factory();

  // Dijkstra by key cost, since some moves cost two keys.
  const best = new Map<string, { cost: number; keys: string[] }>();
  best.set(key(from), { cost: 0, keys: [] });
  let frontier: Pos[] = [from];
  const buckets: Pos[][] = Array.from({ length: maxKeys + 1 }, () => []);
  buckets[0]!.push(from);
  void frontier;
  frontier = [];

  const cache = new Map<string, Pos | null>();
  const apply = (p: Pos, m: Move): Pos | null => {
    const ck = `${key(p)}|${m.keys.join('')}`;
    if (cache.has(ck)) return cache.get(ck)!;
    engine.reset({ lines: [...lines], cursor: p });
    for (const k of m.keys) engine.feed(k);
    const st = engine.state;
    const res = st.mode === 'normal' && st.lines.every((l, i) => l === lines[i]) ? { ...st.cursor } : null;
    cache.set(ck, res);
    return res;
  };

  for (let cost = 0; cost <= maxKeys; cost++) {
    for (const p of buckets[cost]!) {
      const cur = best.get(key(p))!;
      if (cur.cost !== cost) continue;
      for (const m of moves) {
        const c = cost + m.keys.length;
        if (c > maxKeys) continue;
        const np = apply(p, m);
        if (!np) continue;
        const k = key(np);
        const prev = best.get(k);
        if (prev && prev.cost <= c) continue;
        best.set(k, { cost: c, keys: [...cur.keys, ...m.keys] });
        buckets[c]!.push(np);
      }
    }
    const hit = best.get(key(to));
    if (hit && hit.cost <= cost) return hit.keys;
  }
  return best.get(key(to))?.keys ?? null;
}
