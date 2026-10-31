import { describe, expect, it } from 'vitest';
import type { Pos } from '@kbm/shared';
import { createVimEngine } from '@kbm/vim';
import { Battle, ENEMIES, type EnemyId } from './battle';
import { createRng } from './rng';
import { optimalRoute, type Move } from './route';

const BASIC: Move[] = ['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$'].map((k) => ({ keys: [k] }));
const AREA2 = new Set<EnemyId>(['sniper', 'hopper', 'seeker']);

function movesFor(b: Battle): Move[] {
  if (!AREA2.has(b.id)) return BASIC;
  const chars = new Set(b.lines.join('').replace(/ /g, ''));
  return [...BASIC, ...[...chars].flatMap((c) => ['f', 'F'].map((k) => ({ keys: [k, c] })))];
}

/** A fair stand-in for a skilled player: sees only what the screen shows and always takes a shortest route. */
function play(id: EnemyId, seed: number): Battle {
  const b = new Battle(id, createVimEngine(), createRng(seed));
  const moves = movesFor(b);
  let queued: string | null = null;
  for (let guard = 0; b.status === 'running' && guard < 500; guard++) {
    if (queued) {
      b.feed(queued);
      queued = null;
      continue;
    }
    const c = b.cursor;
    const sweep = b.telegraphs().find((t) => t.kind === 'sweep');
    if (sweep && sweep.ticksLeft <= 1 && sweep.cells[0]?.row === c.row) {
      b.feed(c.row === 0 ? 'j' : 'k');
      continue;
    }
    if (b.weak.some((w) => w.row === c.row && w.col === c.col)) {
      b.feed('x');
      continue;
    }
    // On the target's row, skip j and k: the search does not model the column Vim remembers after $.
    const search = (w: Pos): string[] | null => optimalRoute(createVimEngine, b.lines, c, w, { maxKeys: 7, moves: w.row === c.row ? moves.filter((m) => m.keys[0] !== 'j' && m.keys[0] !== 'k') : moves });
    const routes = b.weak.map(search).filter((r): r is string[] => r !== null);
    const route = routes.sort((p, q) => p.length - q.length)[0];
    if (!route || route.length === 0) {
      b.feed('l');
      continue;
    }
    b.feed(route[0]!);
    if (b.awaitingChar) queued = route[1] ?? null;
  }
  return b;
}

describe('every fight can be won', () => {
  for (const id of Object.keys(ENEMIES) as EnemyId[]) {
    it(`${id}: a skilled player wins nearly every time`, () => {
      const seeds = Array.from({ length: 12 }, (_, i) => i * 7 + 1);
      const games = seeds.map((s) => play(id, s));
      const wins = games.filter((g) => g.status === 'won');
      const keys = wins.map((g) => g.keysUsed.length);
      console.info(`${id}: ${wins.length}/12 wins, keys ${Math.min(...keys)}-${Math.max(...keys)}, integrity left ${Math.min(...wins.map((g) => g.integrity))}+`);
      expect(wins.length).toBeGreaterThanOrEqual(10);
    }, 60000);
  }
});
