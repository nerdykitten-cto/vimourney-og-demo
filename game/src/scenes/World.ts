import Phaser from 'phaser';
import type { Pos } from '@kbm/shared';
import { BOSSES, ENEMIES, type EnemyId } from '../sim/battle';
import type { Entity } from '../sim/map';
import { SKILLS } from '../sim/mastery';
import { getNav, isCleared, log, markCleared, markDefeated, mastery, sfx, store } from '../session';
import { bindKeys, burst, C, H, heading, hex, keycap, keyLabel, onScreenKeys, panel, stage, sweepIn, sweepOut, text, W } from '../ui';

const TILE = 32;
const MY = 104;
const ACTOR_FRAME: Record<string, number> = { sentry: 1, patrol: 2, stalker: 3, crawler: 4, blinker: 5, lesson: 6, sniper: 7, hopper: 8 };

const COLORS: Record<string, number> = { sentry: C.warn, patrol: C.star, stalker: C.bad, crawler: C.accent, blinker: 0x8b5cf6, sniper: C.normal, hopper: C.accent, seeker: C.normal, warden: C.visual, lesson: C.accent };

/** First steps in Area 1, one key at a time. The last hop lands on the Sentry. */
const COACH: Array<{ key: string; text: string }> = [
  { key: 'l', text: 'Press l to step right' },
  { key: 'k', text: 'Press k to step up' },
  { key: 'w', text: 'Line up with the Sentry on its row, then press w to hop into it' },
];

export class World extends Phaser.Scene {
  private areaId = 'area-1';
  private nav = getNav();
  private ents = new Map<string, Phaser.GameObjects.Container>();
  private player!: Phaser.GameObjects.Container;
  private doorGfx: Phaser.GameObjects.Image | null = null;
  private msg!: Phaser.GameObjects.Text;
  private goal!: Phaser.GameObjects.Text;
  private pendingText!: Phaser.GameObjects.Text;
  private winsText!: Phaser.GameObjects.Text;
  private strip: Phaser.GameObjects.Container[] = [];
  private keys: string[] = [];
  private cmd: string[] = [];
  private busy = false;
  private overlay: Phaser.GameObjects.GameObject[] | null = null;
  private overlayEnter: (() => void) | null = null;
  private coachStep = 0;
  private resultData: { result?: string; enemy?: EnemyId; entityId?: string; area?: string } = {};

  constructor() {
    super('World');
  }

  init(data: { result?: string; enemy?: EnemyId; entityId?: string; area?: string }): void {
    this.resultData = data ?? {};
    this.areaId = data?.area ?? 'area-1';
  }

  create(): void {
    this.nav = getNav(this.areaId);
    this.ents.clear();
    this.strip = [];
    this.keys = [];
    this.cmd = [];
    this.busy = false;
    this.overlay = null;
    this.doorGfx = null;
    stage(this);

    heading(this, 24, 12, this.nav.area.title, 36, C.accent);
    this.winsText = text(this, W - 24, 20, '', 18, C.fg).setOrigin(1, 0);
    if (!onScreenKeys()) {
      text(this, 24, 66, 'Walk the map with real Vim motions. Walk into an enemy to fight it.', 16, C.dim);
      text(this, W - 24, 66, 'Tab: character sheet    Esc: menu', 16, C.dim).setOrigin(1, 0);
    }

    this.overlayEnter = null;
    this.coachStep = 0;
    this.drawMap();
    this.drawPanel();

    const start = this.nav.pos;
    const c = this.center(start);
    this.player = this.makePlayer(c.x, c.y);

    bindKeys(this, (k) => this.onKey(k));
    sweepOut(this);
    this.refreshHud();

    if (this.resultData.result === 'won' && this.resultData.entityId) this.afterWin(this.resultData.entityId, this.resultData.enemy!);
    this.refreshGoal();
    if (this.areaId === 'area-2' && !store.get<boolean>('seen-area-2', false)) {
      store.set('seen-area-2', true);
      this.openLesson();
    }
    this.resultData = {};
  }

  // ---------------------------------------------------------------- drawing

  private center(p: Pos): { x: number; y: number } {
    return { x: p.col * TILE + TILE / 2, y: MY + p.row * TILE + TILE / 2 };
  }

  private drawMap(): void {
    const rows = this.nav.lines.length;
    // Floor and walls from the Aseprite tile sheet, scaled 2x with nearest filtering.
    this.nav.area.lines.forEach((line, r) => {
      [...line].forEach((ch, c) => {
        const wall = ch === '#';
        const h = (r * 31 + c * 17 + r * c) % 11;
        const frame = wall ? 3 : h === 0 ? 2 : h <= 2 ? 1 : 0;
        const img = this.add.image(c * TILE, MY + r * TILE, 'tiles', frame).setOrigin(0).setScale(TILE / 16);
        if (wall && this.areaId === 'area-2') img.setTint(0xd8b4ff);
      });
    });
    this.add.graphics().lineStyle(2, C.line, 1).strokeRect(0, MY, W, rows * TILE);

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
    const shadow = this.add.ellipse(0, 12, big ? 40 : 22, 7, 0x000000, 0.45);
    const glow = this.add.ellipse(0, 0, big ? 56 : 38, big ? 56 : 38, col, 0.14);
    const sprite = big
      ? this.add.sprite(0, -4, 'warden').setScale(1.5).play('idle-warden')
      : this.add.sprite(0, 0, 'actors', (ACTOR_FRAME[e.kind] ?? 1) * 2).setScale(TILE / 16).play(`idle-${e.kind === 'lesson' ? 'lesson' : e.kind}`);
    const cont = this.add.container(x, y, [shadow, glow, sprite]).setDepth(5);
    this.tweens.add({ targets: glow, alpha: { from: 0.08, to: 0.26 }, duration: 900, yoyo: true, repeat: -1 });
    return cont;
  }

  private makeDoor(p: Pos): Phaser.GameObjects.Image {
    const img = this.add.image(p.col * TILE, MY + p.row * TILE, 'tiles', 4).setOrigin(0).setScale(TILE / 16).setDepth(4);
    this.tweens.add({ targets: img, alpha: { from: 0.75, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    return img;
  }

  private makePlayer(x: number, y: number): Phaser.GameObjects.Container {
    const glow = this.add.ellipse(0, 0, 46, 46, C.normal, 0.2);
    const shadow = this.add.ellipse(0, 12, 22, 7, 0x000000, 0.45);
    const body = this.add.sprite(0, 0, 'actors', 0).setScale(TILE / 16).play('idle-player');
    const cont = this.add.container(x, y, [shadow, glow, body]).setDepth(10);
    this.tweens.add({ targets: glow, scale: { from: 0.9, to: 1.2 }, alpha: { from: 0.3, to: 0.12 }, duration: 900, yoyo: true, repeat: -1 });
    return cont;
  }

  private drawPanel(): void {
    const y = MY + this.nav.lines.length * TILE + 14;
    panel(this, 16, y, W - 32, H - y - 16);
    // With on-screen keys, the words the player needs sit in the header, clear of the keys.
    const top = onScreenKeys();
    this.goal = text(this, top ? 24 : 36, top ? 54 : y + 14, '', top ? 20 : 22, C.accent, true);
    this.pendingText = text(this, W - (top ? 24 : 36), top ? 54 : y + 14, '', top ? 20 : 22, C.warn, true).setOrigin(1, 0);
    this.msg = text(this, top ? 24 : 36, top ? 80 : y + 54, '', top ? 16 : 18, C.fg);
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
    this.strip = this.keys.slice(-12).map((k, i, arr) => keycap(this, W - 36 - (arr.length - i) * 38 + 10, y + 120, keyLabel(k), C.normal));
  }

  private say(s: string, color: number = C.fg): void {
    this.msg.setText(s).setColor(hex(color));
  }

  /** The line at the top of the panel: the next thing to do. */
  private refreshGoal(): void {
    const area = this.nav.area;
    let goal = '';
    if (this.coaching()) goal = COACH[this.coachStep]!.text;
    else if (isCleared(area.id)) goal = 'Area cleared. Esc: back to the menu';
    else if (this.nav.isDoorOpen) goal = `The door is open. Find ${ENEMIES[area.boss as EnemyId].title} behind it`;
    else {
      const left = area.doorNeeds - this.nav.defeatedCount;
      goal = `Beat ${left} more ${left === 1 ? 'enemy' : 'enemies'} to open the red door. The sign has a field guide`;
    }
    this.goal.setText(goal);
  }

  /** The first steps run until the player's first fight, and restart if they leave before it. */
  private coaching(): boolean {
    return this.areaId === 'area-1' && this.coachStep < COACH.length && !store.get<boolean>('coached', false);
  }

  private coachKey(key: string): void {
    if (this.coaching() && COACH[this.coachStep]!.key === key && this.coachStep < COACH.length - 1) {
      this.coachStep++;
      this.refreshGoal();
    }
  }

  // ---------------------------------------------------------------- input

  private onKey(key: string): void {
    if (this.busy) return;
    if (this.overlay) {
      if (key === 'Enter' || key === 'Escape') {
        const next = key === 'Enter' ? this.overlayEnter : null;
        const leave = key === 'Escape' && this.overlayEnter !== null;
        this.closeOverlay();
        next?.();
        if (leave) this.scene.start('Title');
      }
      return;
    }
    if (key.startsWith('Arrow')) {
      sfx.blocked();
      this.say('Arrow keys are off here: use h j k l', C.warn);
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
      this.say(this.blockedReason(head), C.bad);
      this.refreshHud();
      return;
    }
    mastery.record(head, true);
    this.coachKey(head);
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

  private blockedReason(key: string): string {
    if (key === 'Escape') return '';
    if ('hjkl'.includes(key)) return 'A wall is in the way.';
    if ('wbe'.includes(key)) return 'Nothing to hop to that way on this row. Try another row.';
    if ('0$'.includes(key)) return 'You are already at that edge.';
    return 'That is not a move on the map. Your moves are listed below.';
  }

  private trail(path: Pos[]): void {
    const step = Math.max(1, Math.floor(path.length / 8));
    path.forEach((p, i) => {
      if (i % step !== 0) return;
      const c = this.center(p);
      const r = this.add.rectangle(c.x, c.y, 24, 24, C.normal, 0.45).setDepth(6);
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
    store.set('coached', true);
    this.busy = true;
    sfx.warn();
    this.say(`${info.title}: ${info.blurb}`, COLORS[e.kind]);
    log.add('battle-start', { enemy: id });
    this.cameras.main.shake(160, 0.004);
    this.time.delayedCall(260, () => {
      sweepIn(this, () => this.scene.start('Battle', { enemy: id, entityId: e.id, area: this.areaId }));
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
    markDefeated(this.areaId, entityId);
    this.refreshHud();
    this.refreshGoal();
    if (BOSSES.has(enemy)) {
      markCleared(this.areaId);
      this.refreshGoal();
      this.time.delayedCall(500, () => this.openCleared());
      return;
    }
    if (!doorWas && this.nav.isDoorOpen) {
      this.say('The door grinds open.', C.visual);
      this.cameras.main.shake(400, 0.006);
      sfx.win();
      if (this.doorGfx) this.tweens.add({ targets: this.doorGfx, alpha: 0, duration: 500, onComplete: () => this.doorGfx?.destroy() });
    } else {
      this.say(`${ENEMIES[enemy].title} purged.`, C.accent);
    }
  }

  // ---------------------------------------------------------------- overlays

  private openLesson(): void {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(60);
    objs.push(dim, panel(this, 180, 100, W - 360, 440, C.accent).setDepth(61));
    objs.push(heading(this, 216, 118, `FIELD GUIDE: ${this.nav.area.title.split(': ')[1]!.toUpperCase()}`, 34, C.accent).setDepth(62));
    objs.push(text(this, 216, 170, 'The map is text, so the same keys that edit text move you.', 17, C.dim).setDepth(62));
    this.nav.area.lesson.forEach(([k, d], i) => {
      objs.push(text(this, 216, 220 + i * 42, k, 20, C.normal, true).setDepth(62));
      objs.push(text(this, 400, 222 + i * 42, d, 17, C.fg).setDepth(62));
    });
    objs.push(text(this, W / 2, 496, 'Enter: close', 19, C.warn, true).setOrigin(0.5).setDepth(62));
    this.overlay = objs;
    log.add('lesson-open');
  }

  private closeOverlay(): void {
    this.overlay?.forEach((o) => o.destroy());
    this.overlay = null;
    this.overlayEnter = null;
  }

  private openCleared(): void {
    const area = this.nav.area;
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(60), panel(this, 240, 170, W - 480, 340, C.accent).setDepth(61));
    objs.push(heading(this, W / 2, 222, `${area.title.split(':')[0]!.toUpperCase()} CLEARED`, 52, C.accent).setOrigin(0.5).setDepth(62));
    objs.push(text(this, W / 2, 286, `Level ${mastery.characterLevel}   ${mastery.xp} XP`, 22, C.star, true).setOrigin(0.5).setDepth(62));
    area.clearedText.forEach((line, i) => objs.push(text(this, W / 2, 336 + i * 30, line, 18, C.fg).setOrigin(0.5).setDepth(62)));
    const hint = area.next ? 'Enter: next area    Esc: menu' : 'Enter: back to the menu';
    objs.push(text(this, W / 2, 454, hint, 19, C.warn, true).setOrigin(0.5).setDepth(62));
    this.overlay = objs;
    this.overlayEnter = () => (area.next ? this.scene.start('World', { area: area.next }) : this.scene.start('Title'));
    log.add('area-cleared', { area: area.id });
    sfx.win();
  }
}
