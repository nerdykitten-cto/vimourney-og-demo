/**
 * Area 1: Movement. The map is a text buffer: spaces are floor, `#` is wall, letters are things you
 * can walk into. Because it is plain text, the Vim engine moves the player (w hops between landmarks).
 *
 *   L lesson sign   S sentry   P patrol   T stalker   W warden (boss)   D door (locked until 3 wins)
 */
export const GLYPHS = { L: 'lesson', S: 'sentry', P: 'patrol', T: 'stalker', W: 'warden', D: 'door' } as const;
export type Glyph = keyof typeof GLYPHS;
export type EntityKind = (typeof GLYPHS)[Glyph];

export interface AreaDef {
  id: string;
  title: string;
  lines: string[];
  start: { row: number; col: number };
  /** Enemies that must be beaten before the door opens. */
  doorNeeds: number;
}

const W = 40;
const H = 12;

function build(): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill(' '));
  const wall = (r1: number, c1: number, r2: number, c2: number): void => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) g[r]![c] = '#';
  };
  wall(2, 10, 5, 12); // a block to walk around
  wall(4, 18, 9, 19); // a long wall: use j and k, or go around
  wall(6, 24, 6, 33); // a ledge
  wall(2, 30, 2, 39); // warden corridor, top
  wall(4, 30, 4, 39); // warden corridor, bottom
  g[3]![34] = 'D';
  g[3]![38] = 'W';
  g[1]![2] = 'L';
  g[2]![20] = 'S';
  g[8]![28] = 'P';
  g[9]![12] = 'T';
  return g.map((row) => row.join(''));
}

export const area1: AreaDef = {
  id: 'area-1',
  title: 'Area 1: Movement',
  lines: build(),
  start: { row: 10, col: 2 },
  doorNeeds: 3,
};
