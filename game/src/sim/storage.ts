/** localStorage that never throws (itch.io iframes and private windows can block it). */
export interface Store {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
}

export function createStore(prefix = 'buffer-overflow:'): Store {
  const mem = new Map<string, string>();
  const ls = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  };
  return {
    get<T>(key: string, fallback: T): T {
      let raw: string | null = null;
      try {
        raw = ls()?.getItem(prefix + key) ?? mem.get(prefix + key) ?? null;
      } catch {
        raw = mem.get(prefix + key) ?? null;
      }
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown): void {
      const raw = JSON.stringify(value);
      mem.set(prefix + key, raw);
      try {
        ls()?.setItem(prefix + key, raw);
      } catch {
        // blocked or full: stay in memory
      }
    },
  };
}
