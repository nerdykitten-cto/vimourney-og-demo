import { area1, type AreaDef } from './area1';

const W = 40;
const H = 12;

function build(): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill(' '));
  const wall = (r1: number, c1: number, r2: number, c2: number): void => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) g[r]![c] = '#';
  };
  wall(3, 8, 3, 20); // a long wall: hook past it
  wall(7, 12, 7, 28); // a ledge across the middle
  wall(1, 24, 5, 25); // a tower with a gap below it
  wall(8, 24, 10, 25);
  wall(2, 30, 2, 39); // seeker corridor
  wall(4, 30, 4, 39);
  g[3]![34] = 'D';
  g[3]![38] = 'K';
  g[1]![2] = 'L';
  g[5]![16] = 'N';
  g[9]![30] = 'H';
  g[10]![8] = 'T';
  return g.map((row) => row.join(''));
}

export const area2: AreaDef = {
  id: 'area-2',
  title: 'Area 2: Find and Jump',
  lines: build(),
  start: { row: 10, col: 2 },
  doorNeeds: 3,
  boss: 'seeker',
  lesson: [
    ['f + char', 'hook onto the next matching character on the line'],
    ['F + char', 'hook backward onto a matching character'],
    ['t + char', 'stop one short of the character (T goes backward)'],
    [';', 'repeat the last hook, going the same way'],
    [',', 'repeat it the other way'],
    ['Area 1 moves', 'every enemy here still asks for h j k l w b e 0 $'],
  ],
  clearedText: ['The Seeker is purged. More areas arrive in the full game:', 'vertical jumps, text objects, then operators.'],
  next: null,
};

export const AREAS: AreaDef[] = [area1, area2];
export const areaById = (id: string): AreaDef => AREAS.find((a) => a.id === id) ?? area1;
