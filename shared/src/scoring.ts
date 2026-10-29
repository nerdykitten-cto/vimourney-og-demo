export type Stars = 1 | 2 | 3;

/** Highest keystroke count that still earns 2 stars: par + 25%, rounded up. */
export function twoStarLimit(par: number): number {
  return Math.ceil(par * 1.25);
}

/** Stars for a solved level. 3 = par or better, 2 = within par+25%, 1 = any solve. */
export function starsFor(keystrokes: number, par: number): Stars {
  if (keystrokes <= par) return 3;
  if (keystrokes <= twoStarLimit(par)) return 2;
  return 1;
}
