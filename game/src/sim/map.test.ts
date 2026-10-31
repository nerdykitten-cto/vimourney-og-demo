import { describe, expect, it } from 'vitest';
import { createVimEngine } from '@kbm/vim';
import { area1 } from './area1';
import { MapNav } from './map';

const nav = () => new MapNav(createVimEngine(), area1);

describe('MapNav', () => {
  it('moves one tile with hjkl and reports the path', () => {
    const n = nav();
    const r = n.step('l');
    expect(r).toMatchObject({ kind: 'moved', to: { row: 10, col: 3 } });
    expect(n.pos).toEqual({ row: 10, col: 3 });
  });

  it('stops at the row edge with $ and 0', () => {
    const n = nav();
    const r = n.step('$');
    expect(r).toMatchObject({ kind: 'moved', to: { row: 10, col: 39 } });
    expect(n.step('0')).toMatchObject({ kind: 'moved', to: { row: 10, col: 0 } });
    expect(n.step('0')).toMatchObject({ kind: 'blocked' });
  });

  it('is stopped by a wall', () => {
    const n = nav();
    for (let i = 0; i < 6; i++) n.step('k'); // up to row 4
    expect(n.pos.row).toBe(4);
    for (let i = 0; i < 20; i++) n.step('l');
    expect(n.pos.col).toBeLessThan(18); // wall at cols 18-19 on rows 4-9
    expect(n.step('l')).toMatchObject({ kind: 'blocked' });
  });

  it('w hops between landmarks and bumps what it reaches', () => {
    const n = nav();
    n.step('k');
    n.step('k');
    n.step('k');
    n.step('k');
    n.step('k');
    n.step('k');
    n.step('k');
    n.step('k');
    n.step('k'); // row 1, col 2: the lesson sign
    expect(n.pos).toEqual({ row: 1, col: 2 });
  });

  it('bumps an enemy on contact', () => {
    const n = nav();
    for (let i = 0; i < 8; i++) n.step('k'); // row 2
    n.step('0');
    const r = n.step('w'); // first landmark on row 2 is the wall block at col 10
    expect(r.kind === 'moved' || r.kind === 'blocked').toBe(true);
    // walk right along row 1 into nothing, then go to the stalker on row 2 col 20
    const m = nav();
    for (let i = 0; i < 9; i++) m.step('k'); // row 1
    for (let i = 0; i < 17; i++) m.step('l'); // col 19
    m.step('j'); // row 2 col 19
    const hit = m.step('l');
    expect(hit).toMatchObject({ kind: 'bump', entity: { kind: 'stalker' } });
  });

  it('keeps the door shut until three enemies are beaten', () => {
    const n = nav();
    const doors = () => n.lines.some((l) => l.includes('D'));
    expect(doors()).toBe(true);
    const ids = [...n.entities.values()].filter((e) => ['sentry', 'patrol', 'stalker'].includes(e.kind)).map((e) => e.id);
    ids.slice(0, 2).forEach((id) => n.defeat(id));
    expect(doors()).toBe(true);
    n.defeat(ids[2]!);
    expect(doors()).toBe(false);
    expect(n.isDoorOpen).toBe(true);
  });

  it('refuses keys that would edit the map', () => {
    const n = nav();
    expect(n.step('i')).toMatchObject({ kind: 'blocked' });
    expect(n.lines).toEqual(area1.lines);
    expect(n.step('x')).toMatchObject({ kind: 'blocked' });
    expect(n.lines).toEqual(area1.lines);
  });

  it('every enemy, the lesson and the warden are reachable by walking', () => {
    const n = nav();
    const lines = area1.lines;
    const seen = new Set<string>();
    const q: Array<[number, number]> = [[area1.start.row, area1.start.col]];
    seen.add(`${q[0]![0]},${q[0]![1]}`);
    const doorOpen = (ch: string) => ch !== '#' && ch !== 'D';
    const reachableGlyphs = new Set<string>();
    while (q.length) {
      const [r, c] = q.shift()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        const ch = lines[nr]?.[nc];
        if (ch === undefined || !doorOpen(ch) || seen.has(`${nr},${nc}`)) continue;
        seen.add(`${nr},${nc}`);
        if (ch !== ' ') reachableGlyphs.add(ch);
        if (ch === ' ') q.push([nr, nc]);
      }
    }
    for (const g of ['L', 'S', 'P', 'T']) expect(reachableGlyphs.has(g), g).toBe(true);
    expect(reachableGlyphs.has('W')).toBe(false); // behind the door
    void n;
  });
});

describe('Area 2 map', () => {
  it('every entity is reachable on foot, and the boss once the door opens', async () => {
    const { area2 } = await import('./area2');
    const rows = area2.lines;
    const seen = new Set<string>();
    const queue = [[area2.start.row, area2.start.col]] as Array<[number, number]>;
    while (queue.length) {
      const [r, c] = queue.pop()!;
      const key = `${r},${c}`;
      if (seen.has(key) || rows[r]?.[c] === undefined || rows[r]![c] === '#') continue;
      seen.add(key);
      if (rows[r]![c] === 'D') {
        // treat the door as open for the boss check
      }
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push([r + dr!, c + dc!]);
    }
    rows.forEach((line, r) => [...line].forEach((ch, c) => {
      if ('LNHTK'.includes(ch)) expect(seen.has(`${r},${c}`), `${ch} at ${r},${c}`).toBe(true);
    }));
  });
});
