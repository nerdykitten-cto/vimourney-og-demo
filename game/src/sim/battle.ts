import type { Engine, Pos } from '@kbm/shared';
import type { Rng } from './rng';

export type EnemyId = 'sentry' | 'patrol' | 'stalker' | 'warden';

/** Keys usable in area 1 battles. */
export const BATTLE_KEYS = new Set(['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$', 'x']);

export interface EnemyInfo {
  id: EnemyId;
  title: string;
  /** One line telling the player what this enemy wants. */
  blurb: string;
  lines: string[];
  maxIntegrity: number;
}

export const ENEMIES: Record<EnemyId, EnemyInfo> = {
  sentry: {
    id: 'sentry',
    title: 'SENTRY',
    blurb: 'Weak points sit far along its lines. It pulses if you dawdle.',
    lines: ['guard.watch(door, window, gate, hall, vault, exit, tower);', 'if (alert) { signal(red); lockdown(all); }', 'return sentry;'],
    maxIntegrity: 4,
  },
  patrol: {
    id: 'patrol',
    title: 'PATROL',
    blurb: 'Its weak point walks back and forth. Meet it, do not chase it.',
    lines: ['patrol(north, east, south, west, north, east, south, west, home);', 'return patrol;'],
    maxIntegrity: 4,
  },
  stalker: {
    id: 'stalker',
    title: 'STALKER',
    blurb: 'It hunts your cursor. Keep moving while you strike.',
    lines: ['stalk(target, path, shadow, corner, hallway, ceiling, floor);', 'if (seen) { hide(); } else { hunt(); }', 'return stalker;'],
    maxIntegrity: 4,
  },
  warden: {
    id: 'warden',
    title: 'THE WARDEN',
    blurb: 'Its weak point jumps in patterns. Read the arrow. Later it sweeps whole rows.',
    lines: ['alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu', 'node.link(root, branch, leaf);  // walk the tree', 'return warden;'],
    maxIntegrity: 5,
  },
};

export interface Telegraph {
  kind: 'pulse' | 'jump' | 'sweep' | 'stalk';
  text: string;
  ticksLeft: number;
  cells: Pos[];
}

export type BattleEvent =
  | { t: 'blocked'; key: string }
  | { t: 'hit'; pos: Pos }
  | { t: 'wasted' }
  | { t: 'pulse' }
  | { t: 'stalker-hit' }
  | { t: 'jump'; from: Pos; to: Pos }
  | { t: 'sweep'; row: number; hit: boolean }
  | { t: 'phase'; phase: number }
  | { t: 'win' }
  | { t: 'lose' };

export interface FeedResult {
  accepted: boolean;
  events: BattleEvent[];
  /** The key either moved the cursor or landed a hit: counts toward mastery. */
  effective: boolean;
}

const same = (a: Pos, b: Pos): boolean => a.row === b.row && a.col === b.col;

/** Word starts and ends of a line, sorted, as the places `w` and `e` land. */
export function wordBoundaries(line: string): number[] {
  const out = new Set<number>();
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === ' ') continue;
    if (i === 0 || line[i - 1] === ' ') out.add(i);
    if (i === line.length - 1 || line[i + 1] === ' ') out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * One battle in the Buffer. The world ticks once per accepted keystroke. Weak points are overlay tokens
 * on a fixed text arena: `x` on a weak point hits it, and any other text change is undone.
 */
export class Battle {
  readonly info: EnemyInfo;
  status: 'running' | 'won' | 'lost' = 'running';
  tick = 0;
  integrity: number;
  hitsDone = 0;
  hitsNeeded: number;
  weak: Pos[] = [];
  keysUsed: string[] = [];
  wasted = 0;

  // Pulse (sentry, patrol, warden)
  private pulseEvery: number | null = null;
  private pulseTimer = 0;
  // Patrol
  private patrolDir: 1 | -1 = 1;
  private patrolTimer = 0;
  // Stalker
  stalker: Pos | null = null;
  private stalkerTimer = 0;
  // Warden
  phase = 1;
  private jumpTimer = 0;
  private nextTarget: Pos | null = null;
  private lastBoundaryIdx = 0;
  sweep: { row: number; ticksLeft: number } | null = null;
  private sweepTimer = 0;

  constructor(
    readonly id: EnemyId,
    private readonly engine: Engine,
    private readonly rng: Rng,
  ) {
    this.info = ENEMIES[id];
    this.integrity = this.info.maxIntegrity;
    this.engine.reset({ lines: this.info.lines, cursor: { row: 0, col: 0 } });
    switch (id) {
      case 'sentry':
        this.weak = [
          { row: 0, col: 50 },
          { row: 1, col: 30 },
          { row: 2, col: 12 },
        ];
        this.hitsNeeded = 3;
        this.pulseEvery = 12;
        break;
      case 'patrol':
        this.weak = [{ row: 0, col: 10 }];
        this.hitsNeeded = 4;
        this.pulseEvery = 14;
        break;
      case 'stalker':
        this.weak = [
          { row: 0, col: 40 },
          { row: 1, col: 8 },
          { row: 2, col: 14 },
        ];
        this.hitsNeeded = 3;
        this.stalker = { row: 0, col: this.info.lines[0]!.length - 1 };
        break;
      case 'warden': {
        const b = wordBoundaries(this.info.lines[0]!);
        this.lastBoundaryIdx = 4;
        this.weak = [{ row: 0, col: b[this.lastBoundaryIdx]! }];
        this.hitsNeeded = 12;
        this.pulseEvery = 10;
        this.jumpTimer = this.jumpEvery();
        this.nextTarget = this.pickNext();
        break;
      }
    }
    this.hitsNeeded ??= 3;
    this.pulseTimer = this.pulseEvery ?? 0;
    this.patrolTimer = 2;
    this.stalkerTimer = 2;
    this.sweepTimer = 9;
  }

  get cursor(): Pos {
    return { ...this.engine.state.cursor };
  }

  get mode(): string {
    return this.engine.state.mode;
  }

  get lines(): readonly string[] {
    return this.info.lines;
  }

  /** Ticks between weak point jumps: slower while you are still learning the pattern. */
  private jumpEvery(): number {
    return [6, 5, 4, 3][Math.min(this.phase, 4) - 1]!;
  }

  private weakAt(p: Pos): number {
    return this.weak.findIndex((w) => same(w, p));
  }

  /** Where the warden's weak point goes next, from its current spot and phase. */
  private pickNext(): Pos {
    const line = this.info.lines[0]!;
    const b = wordBoundaries(line);
    const cur = this.weak[0]!;
    let idx = b.findIndex((c) => c >= cur.col);
    if (idx < 0) idx = b.length - 1;
    const forward = (): Pos => ({ row: 0, col: b[(idx + (b[idx] === cur.col ? 1 : 0)) % b.length]! });
    const backward = (): Pos => {
      const j = (idx - 1 + b.length) % b.length;
      return { row: 0, col: b[j]! };
    };
    const edge = (): Pos => ({ row: 0, col: cur.col <= 1 ? line.length - 1 : 0 });
    const ph = this.phase === 4 ? this.rng.pick([1, 2, 3]) : this.phase;
    if (ph === 1) return forward();
    if (ph === 2) return backward();
    return edge();
  }

  private respawnPatrol(): void {
    const line = this.info.lines[0]!;
    const atLeft = this.rng.next() < 0.5;
    this.weak = [{ row: 0, col: atLeft ? 3 : line.length - 4 }];
    this.patrolDir = atLeft ? 1 : -1;
  }

  /** Active telegraphs for the UI. */
  telegraphs(): Telegraph[] {
    const out: Telegraph[] = [];
    if (this.status !== 'running') return out;
    if (this.pulseEvery && this.pulseTimer <= 3) out.push({ kind: 'pulse', text: `Pulse in ${this.pulseTimer}`, ticksLeft: this.pulseTimer, cells: [] });
    if (this.id === 'warden' && this.nextTarget && this.jumpTimer <= 2) {
      const dir = this.nextTarget.col > this.weak[0]!.col ? 'right' : 'left';
      out.push({ kind: 'jump', text: `Weak point jumps ${dir} in ${this.jumpTimer}`, ticksLeft: this.jumpTimer, cells: [this.nextTarget] });
    }
    if (this.sweep) {
      const len = this.info.lines[this.sweep.row]!.length;
      out.push({
        kind: 'sweep',
        text: `Sweep on row ${this.sweep.row + 1} in ${this.sweep.ticksLeft}`,
        ticksLeft: this.sweep.ticksLeft,
        cells: Array.from({ length: len }, (_, c) => ({ row: this.sweep!.row, col: c })),
      });
    }
    if (this.id === 'patrol' && this.weak[0]) {
      out.push({ kind: 'jump', text: this.patrolDir === 1 ? 'Walking right >>>' : '<<< Walking left', ticksLeft: this.patrolTimer, cells: [] });
    }
    if (this.id === 'stalker' && this.stalker) {
      out.push({ kind: 'stalk', text: 'The Stalker is closing in', ticksLeft: this.stalkerTimer, cells: [this.stalker] });
    }
    return out;
  }

  feed(key: string): FeedResult {
    const events: BattleEvent[] = [];
    if (this.status !== 'running') return { accepted: false, events, effective: false };
    if (!BATTLE_KEYS.has(key)) {
      events.push({ t: 'blocked', key });
      return { accepted: false, events, effective: false };
    }

    const before = this.cursor;
    const onWeak = key === 'x' && this.weakAt(before) >= 0;
    this.engine.feed(key);
    let after = this.cursor;
    const changed = this.engine.state.lines.some((l, i) => l !== this.info.lines[i]);
    if (changed) {
      // Any edit is undone; the arena text never drifts.
      this.engine.reset({ lines: this.info.lines, cursor: after });
      after = this.cursor;
    }

    let effective = !same(before, after);
    this.keysUsed.push(key);
    if (key === 'x') {
      if (onWeak) {
        this.registerHit(before, events);
        effective = true;
      } else {
        this.wasted++;
        events.push({ t: 'wasted' });
      }
    }

    if (this.status === 'running') this.advance(events);
    return { accepted: true, events, effective };
  }

  private registerHit(p: Pos, events: BattleEvent[]): void {
    events.push({ t: 'hit', pos: p });
    this.hitsDone++;
    if (this.pulseEvery) this.pulseTimer = this.pulseEvery;
    if (this.id === 'sentry' || this.id === 'stalker') {
      this.weak.splice(this.weakAt(p), 1);
    } else if (this.id === 'patrol') {
      this.respawnPatrol();
    } else if (this.id === 'warden') {
      const from = this.weak[0]!;
      const to = this.nextTarget ?? from;
      this.weak = [to];
      events.push({ t: 'jump', from, to });
      const phase = Math.min(4, 1 + Math.floor(this.hitsDone / 3));
      if (phase !== this.phase) {
        this.phase = phase;
        events.push({ t: 'phase', phase });
        this.sweep = null;
        this.sweepTimer = this.phase === 3 ? 9 : 7;
      }
      this.jumpTimer = this.jumpEvery();
      this.nextTarget = this.pickNext();
    }
    if (this.hitsDone >= this.hitsNeeded) {
      this.status = 'won';
      events.push({ t: 'win' });
    }
  }

  private damage(events: BattleEvent[], ev: BattleEvent): void {
    this.integrity--;
    events.push(ev);
    if (this.integrity <= 0) {
      this.status = 'lost';
      events.push({ t: 'lose' });
    }
  }

  /** The enemy's turn: runs once after every accepted key. */
  private advance(events: BattleEvent[]): void {
    this.tick++;
    const cursor = this.cursor;

    if (this.pulseEvery) {
      this.pulseTimer--;
      if (this.pulseTimer <= 0) {
        this.pulseTimer = this.pulseEvery;
        this.damage(events, { t: 'pulse' });
        if (this.status !== 'running') return;
      }
    }

    if (this.id === 'patrol') {
      this.patrolTimer--;
      if (this.patrolTimer <= 0) {
        this.patrolTimer = 2;
        const line = this.info.lines[0]!;
        const w = this.weak[0]!;
        let col = w.col + this.patrolDir;
        if (col >= line.length - 3 || col <= 2) {
          this.patrolDir = (this.patrolDir * -1) as 1 | -1;
          col = Math.min(line.length - 3, Math.max(2, col));
        }
        this.weak = [{ row: 0, col }];
      }
    }

    if (this.id === 'stalker' && this.stalker) {
      this.stalkerTimer--;
      if (this.stalkerTimer <= 0) {
        this.stalkerTimer = 2;
        const s = this.stalker;
        const dr = cursor.row - s.row;
        const dc = cursor.col - s.col;
        let next: Pos = { ...s };
        if (Math.abs(dc) >= Math.abs(dr) && dc !== 0) next.col += Math.sign(dc);
        else if (dr !== 0) next.row += Math.sign(dr);
        const len = this.info.lines[next.row]?.length ?? 0;
        next.col = Math.min(Math.max(0, next.col), Math.max(0, len - 1));
        this.stalker = next;
        if (same(next, cursor)) {
          this.stalker = { row: 0, col: this.info.lines[0]!.length - 1 };
          this.damage(events, { t: 'stalker-hit' });
          if (this.status !== 'running') return;
        }
      }
    }

    if (this.id === 'warden') {
      this.jumpTimer--;
      if (this.jumpTimer <= 0) {
        const from = this.weak[0]!;
        const to = this.nextTarget ?? from;
        this.weak = [to];
        events.push({ t: 'jump', from, to });
        this.jumpTimer = this.jumpEvery();
        this.nextTarget = this.pickNext();
      }
      if (this.phase >= 3) {
        if (this.sweep) {
          this.sweep.ticksLeft--;
          if (this.sweep.ticksLeft <= 0) {
            const hit = cursor.row === this.sweep.row;
            const row = this.sweep.row;
            this.sweep = null;
            this.sweepTimer = this.phase === 3 ? 9 : 7;
            if (hit) this.damage(events, { t: 'sweep', row, hit: true });
            else events.push({ t: 'sweep', row, hit: false });
          }
        } else {
          this.sweepTimer--;
          if (this.sweepTimer <= 0) this.sweep = { row: cursor.row, ticksLeft: 3 };
        }
      }
    }
  }
}
