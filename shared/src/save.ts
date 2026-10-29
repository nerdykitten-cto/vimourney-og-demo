import type { Stars } from './scoring';

export interface LevelRecord {
  stars: Stars;
  /** Fewest keystrokes used to solve it. */
  best: number;
}

export interface SaveData {
  version: 1;
  muted: boolean;
  levels: Record<string, LevelRecord>;
  /** Intro cards the player has already seen. */
  seenCards: string[];
}

/** Subset of the Web Storage API we use, so tests can inject a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'keyboard-mastery:save';

function emptySave(): SaveData {
  return { version: 1, muted: false, levels: {}, seenCards: [] };
}

function parse(raw: string | null): SaveData {
  if (!raw) return emptySave();
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1 || typeof data.levels !== 'object' || data.levels === null) return emptySave();
    return { version: 1, muted: data.muted === true, levels: data.levels, seenCards: Array.isArray(data.seenCards) ? data.seenCards.filter((c) => typeof c === 'string') : [] };
  } catch {
    return emptySave();
  }
}

/** Default storage: window.localStorage, or null where the browser blocks it (private mode, sandboxed iframe). */
function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Save store. Works without storage (progress then lasts only for the session),
 * and never throws, since itch.io iframes and private windows can block localStorage.
 */
export function createSave(storage: StorageLike | null = defaultStorage()) {
  let data = emptySave();
  try {
    data = parse(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    // storage readable only in theory; stay with the empty save
  }

  function persist(): void {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // quota or blocked storage: keep going in memory
    }
  }

  return {
    get data(): Readonly<SaveData> {
      return data;
    },

    record(levelId: string, keystrokes: number, stars: Stars): void {
      const prev = data.levels[levelId];
      data.levels[levelId] = {
        stars: prev ? (Math.max(prev.stars, stars) as Stars) : stars,
        best: prev ? Math.min(prev.best, keystrokes) : keystrokes,
      };
      persist();
    },

    isSolved(levelId: string): boolean {
      return levelId in data.levels;
    },

    totalStars(): number {
      return Object.values(data.levels).reduce((sum, r) => sum + r.stars, 0);
    },

    hasSeenCard(id: string): boolean {
      return data.seenCards.includes(id);
    },

    markCardSeen(id: string): void {
      if (!data.seenCards.includes(id)) {
        data.seenCards.push(id);
        persist();
      }
    },

    setMuted(muted: boolean): void {
      data.muted = muted;
      persist();
    },

    reset(): void {
      data = emptySave();
      persist();
    },
  };
}

export type Save = ReturnType<typeof createSave>;
