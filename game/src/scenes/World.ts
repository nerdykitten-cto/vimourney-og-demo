import Phaser from 'phaser';
import type { Pos } from '@kbm/shared';
import { ENEMIES, type EnemyId } from '../sim/battle';
import type { Entity } from '../sim/map';
import { SKILLS } from '../sim/mastery';
import { getNav, log, markDefeated, mastery, sfx } from '../session';
import { bindKeys, burst, C, H, keycap, keyLabel, panel, sweepIn, sweepOut, text, W } from '../ui';

const TILE = 24;
const MY = 120;

const COLORS: Record<string, number> = { sentry: C.warn, patrol: C.star, stalker: C.bad, warden: C.visual, lesson: C.accent };

const LESSON = [
  ['h j k l', 'step left, down, up, right'],
  ['w  b', 'hop to the next / previous landmark in the row'],
  ['e', 'hop to the end of a landmark'],
  ['0  $', 'run to the left / right edge of the row'],
  ['f + letter', 'hook onto the next tile with that letter (try f S)'],
  ['; ,', 'repeat that hook forward / backward'],
];

export class World extends Phaser.Scene {
  private nav = getNav();
  private ents = new Map<string, Phaser.GameObjects.Container>();
  private player!: Phaser.GameObjects.Container;
  private doorGfx: Phaser.GameObjects.Graphics | null = null;
  private msg!: Phaser.GameObjects.Text;
  private pendingText!: Phaser.GameObjects.Text;
  private winsText!: Phaser.GameObjects.Text;
  private strip: Phaser.GameObjects.Container[] = [];
  private keys: string[] = [];
  private cmd: string[] = [];
  private busy = false;
  private overlay: Phaser.GameObjects.GameObject[] | null = null;
  private resultData: { result?: string; enemy?: EnemyId; entityId?: string } = {};

  constructor() {
    super('World');
  }

  init(data: { result?: string; enemy?: EnemyId; entityId?: string }): void {
    this.resultData = data ?? {};
  }

  create(): void {
    this.nav = getNav();
    this.ents.clear();
    this.strip = [];
    this.keys = [];
    this.cmd = [];
    this.busy = false;
    this.overlay = null;
    this.doorGfx = null;
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);

    text(this, 24, 16, this.nav.area.title, 24, C.accent, true);
    this.winsText = text(this, W - 24, 20, '', 16, C.dim).setOrigin(1, 0);
    text(this, 24, 52, 'Walk the map with real Vim motions. Bump into an enemy to fight it.', 15, C.dim);
    text(this, 24, 76, 'Tab: character sheet    Esc: menu', 14, C.dim);

    this.drawMap();
    this.drawPanel();

    const start = this.nav.pos;
    const c = this.center(start);
    this.player = this.makePlayer(c.x, c.y);

    bindKeys(this, (k) => this.onKey(k));
    sweepOut(this);
    this.refreshHud();

    if (this.resultData.result === 'won' && this.resultData.entityId) this.afterWin(this.resultData.entityId, this.resultData.enemy!);
    else if (!this.nav.isDoorOpen) this.say(`Beat ${this.nav.area.doorNeeds} enemies to open the door.`, C.dim);
    else this.say('The door is open. The Warden waits.', C.visual);
    this.resultData = {};
  }

  // ---------------------------------------------------------------- drawing

  private center(p: Pos): { x: number; y: number } {
    return { x: p.col * TILE + TILE / 2, y: MY + p.row * TILE + TILE / 2 };
  }

  private drawMap(): void {
    const rows = this.nav.lines.length;
    const g = this.add.graphics();
    g.fillStyle(0x0d131a, 1).fillRect(0, MY, W, rows * TILE);
    g.lineStyle(1, 0x182230, 1);
    for (let c = 0; c <= 40; c++) g.lineBetween(c * TILE + 0.5, MY, c * TILE + 0.5, MY + rows * TILE);
    for (let r = 0; r <= rows; r++) g.lineBetween(0, MY + r * TILE + 0.5, W, MY + r * TILE + 0.5);
    this.nav.area.lines.forEach((line, r) => {
      [...line].forEach((ch, c) => {
        const x = c * TILE;
        const y = MY + r * TILE;
        if (ch === '#') {
          g.fillStyle(0x2b3b50, 1).fillRect(x + 1, y + 1, TILE - 1, TILE - 1);
          g.fillStyle(0x3d5470, 1).fillRect(x + 1, y + 1, TILE - 1, 3);
          g.fillStyle(0x1c2736, 1).fillRect(x + 1, y + TILE - 4, TILE - 1, 3);
        }
      });
    });
    g.lineStyle(2, C.line, 1).strokeRect(0, MY, W, rows * TILE);

    for (const e of this.nav.entities.values()) this.ents.set(e.id, this.makeEntity(e));
    this.nav.lines.forEach((line, r) => {
      const c = line.indexOf('D');
      if (c >= 0) this.doorGfx = this.makeDoor({ row: r, col: c });
    });
  }

  private makeEntity(e: Entity): Phaser.GameObjects.Container {
    const { x, y } = this.center(e.pos);
    const col = COLORS[e.kind] ?? C.fg;
    const big = e.kind === 'warden';
    const s = big ? 1.25 : 1;
    const shadow = this.add.ellipse(0, 9, 20 * s, 7, 0x000000, 0.4);
    const body = this.add.rectangle(0, 0, 18 * s, 18 * s, col).setStrokeStyle(2, 0xffffff, 0.5);
    const letter = text(this, 0, 0, e.kind === 'lesson' ? '?' : e.glyph, big ? 20 : 16, 0x0a0e13, true).setOrigin(0.5);
    const glow = this.add.rectangle(0, 0, 28 * s, 28 * s, col, 0.18);
    const cont = this.add.container(x, y, [shadow, glow, body, letter]).setDepth(5);
    this.tweens.add({ targets: [body, letter], y: '-=3', duration: 700 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.3 }, duration: 900, yoyo: true, repeat: -1 });
    return cont;
  }

  private makeDoor(p: Pos): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(4);
    const x = p.col * TILE;
    const y = MY + p.row * TILE;
    g.fillStyle(0x3a1218, 1).fillRect(x + 1, y + 1, TILE - 1, TILE - 1);
    g.lineStyle(2, C.bad, 1);
    for (let i = 0; i < 4; i++) g.lineBetween(x + 4 + i * 5, y + 3, x + 4 + i * 5, y + TILE - 3);
    this.tweens.add({ targets: g, alpha: { from: 0.7, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    return g;
  }

  private makePlayer(x: number, y: number): Phaser.GameObjects.Container {
    const glow = this.add.rectangle(0, 0, 34, 34, C.normal, 0.22);
    const body = this.add.rectangle(0, 0, 20, 20, C.normal).setStrokeStyle(2, 0xffffff, 0.8);
    const cont = this.add.container(x, y, [glow, body]).setDepth(10);
    this.tweens.add({ targets: glow, scale: { from: 0.9, to: 1.2 }, alpha: { from: 0.3, to: 0.12 }, duration: 900, yoyo: true, repeat: -1 });
    return cont;
  }

  private drawPanel(): void {
    const y = MY + this.nav.lines.length * TILE + 14;
    panel(this, 16, y, W - 32, H - y - 16);
    this.pendingText = text(this, 36, y + 14, '', 22, C.warn, true);
    this.msg = text(this, 36, y + 52, '', 18, C.fg);
    text(this, 36, y + 100, 'Your moves', 13, C.dim);
    SKILLS.forEach((s, i) => {
      const lvl = mastery.level(s.key);
      const colr = lvl >= 3 ? C.accent : lvl >= 1 ? C.normal : C.dim;
      const kc = keycap(this, 36 + i * 44, y + 120, s.name, colr);
      void kc;
    });
    text(this, W - 36, y + 100, 'keys', 13, C.dim).setOrigin(1, 0);
  }

  private refreshHud(): void {
    const wins = Math.min(this.nav.defeatedCount, this.nav.area.doorNeeds);
    this.winsText.setText(`wins ${wins}/${this.nav.area.doorNeeds}   level ${mastery.characterLevel}  ${mastery.xp} XP`);
    const y = MY + this.nav.lines.length * TILE + 14;
    this.strip.forEach((s) => s.destroy());
    this.strip = this.keys.slice(-12).map((k, i, arr) => keycap(this, W - 36 - (arr.length - i) * 38 + 36, y + 120, keyLabel(k), C.normal));
  }

  private say(s: string, color: number = C.fg): void {
    this.msg.setText(s).setColor(`#${color.toString(16).padStart(6, '0')}`);
  }

  // ---------------------------------------------------------------- input

  private onKey(key: string): void {
    if (this.busy) return;
    if (this.overlay) {
      if (key === 'Enter' || key === 'Escape') this.closeOverlay();
      return;
    }
    if (this.cmd.length === 0) {
      if (key === 'Tab') {
        this.scene.start('Sheet', { back: 'World' });
        return;
      }
      if (key === 'Escape') {
        this.scene.start('Title');
        return;
      }
    }
    this.keys.push(key);
    this.cmd.push(key);
    sfx.key();
    const r = this.nav.step(key);
    this.pendingText.setText(r.kind === 'pending' ? this.cmd.join('') + '▍' : '');
    if (r.kind === 'pending') {
      this.refreshHud();
      return;
    }
    const head = this.cmd[0]!;
    this.cmd = [];
    if (r.kind === 'blocked') {
      sfx.blocked();
      this.tweens.add({ targets: this.player, x: this.player.x + 4, duration: 40, yoyo: true, repeat: 2 });
      this.say(key === 'Escape' ? '' : 'Something is in the way, or that is not a move here.', C.bad);
      this.refreshHud();
      return;
    }
    mastery.record(head, true);
    this.refreshHud();
    const dest = this.center(r.to);
    const dist = Math.abs(r.to.col - r.from.col) + Math.abs(r.to.row - r.from.row);
    sfx.move();
    this.trail(r.path);
    // Keys never wait for the walk animation: a new move simply retargets the player.
    this.tweens.killTweensOf(this.player);
    if (r.kind === 'bump') this.busy = true;
    this.tweens.add({
      targets: this.player,
      x: dest.x,
      y: dest.y,
      duration: Math.min(70 + dist * 12, 380),
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (r.kind === 'bump') {
          this.busy = false;
          this.onBump(r.entity);
        } else this.say('', C.fg);
      },
    });
  }

  private trail(path: Pos[]): void {
    const step = Math.max(1, Math.floor(path.length / 8));
    path.forEach((p, i) => {
      if (i % step !== 0) return;
      const c = this.center(p);
      const r = this.add.rectangle(c.x, c.y, 18, 18, C.normal, 0.45).setDepth(6);
      this.tweens.add({ targets: r, alpha: 0, scale: 0.4, duration: 380, delay: i * 8, onComplete: () => r.destroy() });
    });
  }

  private onBump(e: Entity): void {
    if (e.kind === 'lesson') {
      this.openLesson();
      return;
    }
    const id = e.kind as EnemyId;
    const info = ENEMIES[id];
    this.busy = true;
    sfx.warn();
    this.say(`${info.title}: ${info.blurb}`, COLORS[e.kind]);
    log.add('battle-start', { enemy: id });
    this.cameras.main.shake(160, 0.004);
    this.time.delayedCall(260, () => {
      sweepIn(this, () => this.scene.start('Battle', { enemy: id, entityId: e.id }));
    });
  }

  private afterWin(entityId: string, enemy: EnemyId): void {
    const ent = this.ents.get(entityId);
    const doorWas = this.nav.isDoorOpen;
    if (ent) {
      burst(this, ent.x, ent.y, COLORS[enemy] ?? C.accent, 22, 90);
      this.tweens.add({ targets: ent, alpha: 0, scale: 0.2, duration: 300, onComplete: () => ent.destroy() });
      this.ents.delete(entityId);
    }
    this.nav.defeat(entityId);
    markDefeated(entityId);
    this.refreshHud();
    if (enemy === 'warden') {
      this.time.delayedCall(500, () => this.openCleared());
      return;
    }
    if (!doorWas && this.nav.isDoorOpen) {
      this.say('The door grinds open. The Warden waits behind it.', C.visual);
      this.cameras.main.shake(400, 0.006);
      sfx.win();
      if (this.doorGfx) this.tweens.add({ targets: this.doorGfx, alpha: 0, duration: 500, onComplete: () => this.doorGfx?.destroy() });
    } else {
      this.say(`${ENEMIES[enemy].title} purged. ${this.nav.area.doorNeeds - this.nav.defeatedCount} more to open the door.`, C.accent);
    }
  }

  // ---------------------------------------------------------------- overlays

  private openLesson(): void {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(60);
    objs.push(dim, panel(this, 120, 110, W - 240, 380, C.accent).setDepth(61));
    objs.push(text(this, 150, 130, 'FIELD GUIDE: MOVEMENT', 26, C.accent, true).setDepth(62));
    objs.push(text(this, 150, 172, 'The map is text, so the same keys that edit text move you.', 16, C.dim).setDepth(62));
    LESSON.forEach(([k, d], i) => {
      objs.push(text(this, 150, 220 + i * 40, k, 20, C.normal, true).setDepth(62));
      objs.push(text(this, 330, 222 + i * 40, d, 17, C.fg).setDepth(62));
    });
    objs.push(text(this, W / 2, 450, 'Enter: close', 16, C.warn).setOrigin(0.5).setDepth(62));
    this.overlay = objs;
    log.add('lesson-open');
  }

  private closeOverlay(): void {
    this.overlay?.forEach((o) => o.destroy());
    this.overlay = null;
  }

  private openCleared(): void {
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(60), panel(this, 180, 150, W - 360, 300, C.accent).setDepth(61));
    objs.push(text(this, W / 2, 190, 'AREA 1 CLEARED', 40, C.accent, true).setOrigin(0.5).setDepth(62));
    objs.push(text(this, W / 2, 250, `Level ${mastery.characterLevel}   ${mastery.xp} XP`, 22, C.star).setOrigin(0.5).setDepth(62));
    objs.push(text(this, W / 2, 300, 'In the full game, the next area opens with new moves: f t ; ,', 16, C.fg).setOrigin(0.5).setDepth(62));
    objs.push(text(this, W / 2, 330, 'and its enemies still ask for what you learned here.', 16, C.fg).setOrigin(0.5).setDepth(62));
    objs.push(text(this, W / 2, 400, 'Enter: back to the menu', 16, C.warn).setOrigin(0.5).setDepth(62));
    this.overlay = objs;
    log.add('area-cleared');
    sfx.win();
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Title'));
  }
}
