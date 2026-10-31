/**
 * Area 1: Movement. The map is a text buffer: spaces are floor, `#` is wall, letters are things you
 * can walk into. Because it is plain text, the Vim engine moves the player (w hops between landmarks).
 *
 *   L lesson sign   S sentry   P patrol   T stalker   C crawler   B blinker   W warden (boss)   D door (locked until 3 wins)
 */
export const GLYPHS = { L: 'lesson', S: 'sentry', P: 'patrol', T: 'stalker', C: 'crawler', B: 'blinker', N: 'sniper', H: 'hopper', K: 'seeker', W: 'warden', D: 'door' } as const;
export type Glyph = keyof typeof GLYPHS;
export type EntityKind = (typeof GLYPHS)[Glyph];

export interface AreaDef {
  id: string;
  title: string;
  lines: string[];
  start: { row: number; col: number };
  /** Enemies that must be beaten before the door opens. */
  doorNeeds: number;
  /** Boss at the end: winning clears the area. */
  boss: string;
  /** Field guide shown at the lesson sign: key, then what it does. */
  lesson: Array<[string, string]>;
  /** Shown when the area is cleared. */
  clearedText: string[];
  next: string | null;
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
  g[2]![20] = 'T';
  g[8]![28] = 'P';
  g[9]![12] = 'S'; // first fight: one k and one w from the start
  g[8]![6] = 'C';
  g[5]![36] = 'B';
  return g.map((row) => row.join(''));
}

export const area1: AreaDef = {
  id: 'area-1',
  title: 'Area 1: Movement',
  lines: build(),
  start: { row: 10, col: 2 },
  doorNeeds: 3,
  boss: 'warden',
  lesson: [
    ['h j k l', 'step left, down, up, right'],
    ['w  b', 'hop to the next / previous landmark in the row'],
    ['e', 'hop to the end of a landmark'],
    ['0  $', 'run to the left / right edge of the row'],
    ['f + letter', 'hook onto the next tile with that letter (try f S)'],
    ['; ,', 'repeat that hook forward / backward'],
  ],
  clearedText: ['Area 2 opens with new moves: f t ; ,', 'and its enemies still ask for what you learned here.'],
  next: 'area-2',
};
