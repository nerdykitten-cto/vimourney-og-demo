import { describe, expect, it } from 'vitest';
import { createVimEngine } from '@kbm/vim';
import { Battle, BATTLE_KEYS, wordBoundaries, type EnemyId } from './battle';
import { createRng } from './rng';

const make = (id: EnemyId, seed = 1) => new Battle(id, createVimEngine(), createRng(seed));
const press = (b: Battle, keys: string) => keys.split('').flatMap((k) => b.feed(k).events);

describe('Battle basics', () => {
  it('refuses keys outside the area 1 set', () => {
    const b = make('sentry');
    const r = b.feed('d');
    expect(r.accepted).toBe(false);
    expect(r.events).toEqual([{ t: 'blocked', key: 'd' }]);
    expect(b.tick).toBe(0);
    expect(BATTLE_KEYS.has('x')).toBe(true);
  });

  it('counts a tick per accepted key and moves the cursor', () => {
    const b = make('sentry');
    expect(b.feed('l')).toMatchObject({ accepted: true, effective: true });
    expect(b.tick).toBe(1);
    expect(b.cursor).toEqual({ row: 0, col: 1 });
    expect(b.feed('h').effective).toBe(true);
    expect(b.feed('h').effective).toBe(false); // already at the edge
  });

  it('x on a plain character is wasted and the text is restored', () => {
    const b = make('sentry');
    const events = press(b, 'x');
    expect(events).toContainEqual({ t: 'wasted' });
    expect(b.lines[0]).toBe('guard.watch(door, window, gate, hall, vault, exit, tower);');
    expect(b.wasted).toBe(1);
  });
});

describe('Sentry', () => {
  it('is beaten by reaching and hitting each weak point', () => {
    const b = make('sentry');
    // weak points: (0,50), (1,30), (2,12)
    press(b, '$'); // end of line 0
    const last = b.lines[0]!.length - 1;
    expect(b.cursor.col).toBe(last);
    press(b, 'h'.repeat(last - 50));
    expect(b.cursor.col).toBe(50);
    const ev = press(b, 'x');
    expect(ev).toContainEqual({ t: 'hit', pos: { row: 0, col: 50 } });
    expect(b.hitsDone).toBe(1);
    expect(b.weak).toHaveLength(2);
  });

  it('pulses for 1 damage if you take too long, and a hit resets the timer', () => {
    const b = make('sentry');
    let pulses = 0;
    for (let i = 0; i < 11; i++) pulses += press(b, i % 2 ? 'h' : 'l').filter((e) => e.t === 'pulse').length;
    expect(pulses).toBe(0);
    const ev = press(b, 'l');
    expect(ev).toContainEqual({ t: 'pulse' });
    expect(b.integrity).toBe(3);
  });

  it('shows a pulse telegraph three ticks ahead', () => {
    const b = make('sentry');
    press(b, 'lllllllll'); // 9 ticks
    expect(b.telegraphs().some((t) => t.kind === 'pulse' && t.ticksLeft === 3)).toBe(true);
  });

  it('is lost at zero Integrity and ignores keys afterwards', () => {
    const b = make('sentry');
    const alt = 'lh'.repeat(60);
    for (const k of alt) b.feed(k);
    expect(b.status).toBe('lost');
    expect(b.feed('l').accepted).toBe(false);
  });
});

describe('Patrol', () => {
  it('walks its weak point back and forth and bounces off the ends', () => {
    const b = make('patrol');
    b.integrity = 9999; // survive the pulses so the weak point keeps walking
    const cols: number[] = [];
    for (let i = 0; i < 320; i++) {
      b.feed(i % 2 ? 'h' : 'l');
      cols.push(b.weak[0]!.col);
    }
    expect(Math.max(...cols)).toBeGreaterThan(40);
    expect(Math.min(...cols)).toBeLessThan(10);
    const first = cols.findIndex((c, i) => i > 0 && c < cols[i - 1]!);
    expect(first).toBeGreaterThan(0); // it turned around
  });

  it('needs four hits', () => {
    const b = make('patrol');
    expect(b.hitsNeeded).toBe(4);
  });
});

describe('Stalker', () => {
  it('closes in on a cursor that stands still and hits it', () => {
    const b = make('stalker');
    let hit = false;
    for (let i = 0; i < 200 && b.status === 'running' && !hit; i++) {
      const ev = b.feed(i % 2 ? 'h' : 'l').events;
      hit = ev.some((e) => e.t === 'stalker-hit');
    }
    expect(hit).toBe(true);
    expect(b.integrity).toBeLessThan(4);
  });
});

describe('Warden', () => {
  it('relocates its weak point on a timer and telegraphs the jump', () => {
    const b = make('warden');
    const start = { ...b.weak[0]! };
    for (let i = 0; i < 4; i++) b.feed(i % 2 ? 'h' : 'l');
    expect(b.telegraphs().some((t) => t.kind === 'jump')).toBe(true);
    for (let i = 0; i < 2; i++) b.feed(i % 2 ? 'h' : 'l');
    expect(b.weak[0]).not.toEqual(start);
  });

  it('moves to phase 2 after three hits and takes twelve to win', () => {
    const b = make('warden');
    const bounds = wordBoundaries(b.lines[0]!);
    expect(bounds.length).toBeGreaterThan(10);
    let guard = 0;
    while (b.status === 'running' && guard++ < 400) {
      // cheat-walk: step the cursor toward the weak point, then hit
      const w = b.weak[0]!;
      const c = b.cursor;
      if (c.row !== w.row) b.feed(c.row < w.row ? 'j' : 'k');
      else if (c.col < w.col) b.feed('l');
      else if (c.col > w.col) b.feed('h');
      else b.feed('x');
    }
    expect(b.hitsDone).toBeGreaterThanOrEqual(3);
  });

  it('sweeps a row in phase 3 and damages only if you stay on it', () => {
    const b = make('warden');
    (b as unknown as { phase: number }).phase = 3;
    (b as unknown as { sweepTimer: number }).sweepTimer = 1;
    b.feed('l'); // creates the sweep on the cursor's row
    expect(b.sweep).toMatchObject({ row: 0, ticksLeft: 3 });
    expect(b.telegraphs().some((t) => t.kind === 'sweep')).toBe(true);
    b.feed('j'); // dodge to row 1
    b.feed('l');
    const before = b.integrity;
    const ev = b.feed('l').events;
    expect(ev).toContainEqual({ t: 'sweep', row: 0, hit: false });
    expect(b.integrity).toBe(before);
  });

  it('a sweep hurts a cursor that does not dodge', () => {
    const b = make('warden');
    (b as unknown as { phase: number }).phase = 3;
    (b as unknown as { sweepTimer: number }).sweepTimer = 1;
    b.feed('l');
    b.feed('h');
    b.feed('l');
    const before = b.integrity;
    const ev = b.feed('h').events;
    expect(ev).toContainEqual({ t: 'sweep', row: 0, hit: true });
    expect(b.integrity).toBe(before - 1);
  });
});

describe('wordBoundaries', () => {
  it('lists the starts and ends of words', () => {
    expect(wordBoundaries('ab cd e')).toEqual([0, 1, 3, 4, 6]);
  });
});
