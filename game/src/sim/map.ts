import type { Engine, Pos } from '@kbm/shared';
import { GLYPHS, type AreaDef, type EntityKind, type Glyph } from './area1';

export interface Entity {
  id: string;
  kind: EntityKind;
  glyph: Glyph;
  pos: Pos;
}

export type MoveResult =
  /** The key is only part of a command (like f waiting for its character). */
  | { kind: 'pending' }
  /** Nothing happened (wall, or a motion the map does not allow). */
  | { kind: 'blocked'; key: string }
  | { kind: 'moved'; from: Pos; to: Pos; path: Pos[] }
  /** The player walked into something. `to` is the entity's cell. */
  | { kind: 'bump'; from: Pos; to: Pos; path: Pos[]; entity: Entity };

const same = (a: Pos, b: Pos): boolean => a.row === b.row && a.col === b.col;

/**
 * Walks the area with the real Vim engine: each key goes to the engine, and the new cursor is kept
 * only if the walk is legal. Walls stop you, a locked door is a wall, and entities stop you on contact.
 */
export class MapNav {
  lines: string[];
  readonly entities = new Map<string, Entity>();
  private doorOpen = false;
  private defeated = 0;

  constructor(
    private readonly engine: Engine,
    readonly area: AreaDef,
  ) {
    this.lines = [...area.lines];
    area.lines.forEach((line, row) => {
      [...line].forEach((ch, col) => {
        if (ch in GLYPHS && ch !== 'D') {
          const glyph = ch as Glyph;
          const id = `${GLYPHS[glyph]}-${row}-${col}`;
          this.entities.set(id, { id, kind: GLYPHS[glyph], glyph, pos: { row, col } });
        }
      });
    });
    this.engine.reset({ lines: this.lines, cursor: area.start });
  }

  get pos(): Pos {
    return { ...this.engine.state.cursor };
  }

  get isDoorOpen(): boolean {
    return this.doorOpen;
  }

  get defeatedCount(): number {
    return this.defeated;
  }

  cell(p: Pos): string {
    return this.lines[p.row]?.[p.col] ?? ' ';
  }

  entityAt(p: Pos): Entity | null {
    for (const e of this.entities.values()) if (same(e.pos, p)) return e;
    return null;
  }

  private isSolid(p: Pos): boolean {
    const ch = this.cell(p);
    return ch === '#' || ch === 'D';
  }

  /** Remove an entity from the map (after winning) and keep the engine's text in sync. */
  defeat(id: string): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    this.setCell(e.pos, ' ');
    if (e.kind !== 'lesson' && e.kind !== 'warden' && e.kind !== 'seeker') {
      this.defeated++;
      if (this.defeated >= this.area.doorNeeds) this.openDoors();
    }
  }

  private openDoors(): void {
    this.doorOpen = true;
    this.lines.forEach((line, row) => {
      [...line].forEach((ch, col) => {
        if (ch === 'D') this.setCell({ row, col }, ' ');
      });
    });
  }

  private setCell(p: Pos, ch: string): void {
    const line = this.lines[p.row]!;
    this.lines[p.row] = line.slice(0, p.col) + ch + line.slice(p.col + 1);
    this.engine.reset({ lines: this.lines, cursor: this.engine.state.cursor });
  }

  private place(p: Pos): void {
    this.engine.reset({ lines: this.lines, cursor: p });
  }

  /** Feed one key. */
  step(key: string): MoveResult {
    const from = this.pos;
    this.engine.feed(key);
    const st = this.engine.state;
    if (st.pending.awaiting || st.pending.operator || st.pending.count !== null || st.pending.register) return { kind: 'pending' };
    if (st.mode !== 'normal') {
      // Only motions walk the map; anything that starts a change is refused.
      this.engine.reset({ lines: this.lines, cursor: from });
      return { kind: 'blocked', key };
    }
    const to = st.cursor;
    if (this.engine.state.lines.some((l, i) => l !== this.lines[i])) {
      this.engine.reset({ lines: this.lines, cursor: from });
      return { kind: 'blocked', key };
    }
    if (same(from, to)) return { kind: 'blocked', key };

    // Only single steps change rows; sideways motions stay on their row.
    const dRow = to.row - from.row;
    if (dRow !== 0 && !(Math.abs(dRow) === 1 && to.col === from.col) && !(Math.abs(dRow) === 1 && (key === 'j' || key === 'k'))) {
      this.place(from);
      return { kind: 'blocked', key };
    }

    const path: Pos[] = [];
    if (dRow === 0) {
      const dir = to.col > from.col ? 1 : -1;
      for (let c = from.col + dir; dir > 0 ? c <= to.col : c >= to.col; c += dir) path.push({ row: from.row, col: c });
    } else {
      path.push(to);
    }

    const walked: Pos[] = [];
    for (const p of path) {
      if (this.isSolid(p)) break;
      walked.push(p);
      const hit = this.entityAt(p);
      if (hit) {
        this.place(p);
        return { kind: 'bump', from, to: p, path: walked, entity: hit };
      }
    }
    if (walked.length === 0) {
      this.place(from);
      return { kind: 'blocked', key };
    }
    const end = walked[walked.length - 1]!;
    if (!same(end, to)) this.place(end);
    return { kind: 'moved', from, to: end, path: walked };
  }
}
