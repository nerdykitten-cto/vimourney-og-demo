import type { Level } from './level';
import type { Save } from './save';
import type { World } from './world';

export function levelStars(save: Save, level: Level): number {
  return save.data.levels[level.id]?.stars ?? 0;
}

export function worldCleared(world: World, save: Save): boolean {
  return world.levels.every((l) => save.isSolved(l.id));
}

/** The first world is always open; each later one opens when the world before it is cleared. */
export function isWorldUnlocked(worlds: World[], index: number, save: Save): boolean {
  return index === 0 || worldCleared(worlds[index - 1]!, save);
}

export function worldStars(world: World, save: Save): { got: number; max: number } {
  return { got: world.levels.reduce((n, l) => n + levelStars(save, l), 0), max: world.levels.length * 3 };
}

/** Free play unlocks once the first world is cleared. */
export function sandboxUnlocked(worlds: World[], save: Save): boolean {
  return worlds.length === 0 || worldCleared(worlds[0]!, save);
}

/** The level after `levelId`, across world boundaries, if that world is open. */
export function nextLevel(worlds: World[], levelId: string, save: Save): { world: World; level: Level } | null {
  for (let wi = 0; wi < worlds.length; wi++) {
    const w = worlds[wi]!;
    const li = w.levels.findIndex((l) => l.id === levelId);
    if (li < 0) continue;
    if (li + 1 < w.levels.length) return { world: w, level: w.levels[li + 1]! };
    const nw = worlds[wi + 1];
    if (nw && nw.levels.length > 0 && isWorldUnlocked(worlds, wi + 1, save)) return { world: nw, level: nw.levels[0]! };
    return null;
  }
  return null;
}

export function findLevel(worlds: World[], levelId: string): { world: World; level: Level } | null {
  for (const w of worlds) {
    const level = w.levels.find((l) => l.id === levelId);
    if (level) return { world: w, level };
  }
  return null;
}
