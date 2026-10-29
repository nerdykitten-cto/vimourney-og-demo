import Phaser from 'phaser';
import { createVimEngine } from '@kbm/vim';
import { Battle as Sim, BATTLE_KEYS, BOSSES, FIND_KEYS, type BattleEvent, type EnemyId, ENEMIES } from '../sim/battle';
import { createRng } from '../sim/rng';
import { SKILLS } from '../sim/mastery';
import { log, mastery, sfx } from '../session';
import { ACTORS } from './Boot';
import { bindKeys, burst, C, charWidth, H, keycap, keyLabel, panel, sweepOut, text, W } from '../ui';

const FONT_SIZE = 24;
const ARENA_X = 100;
const ARENA_Y = 250;
const LINE_H = 44;
const BOTTOM_Y = 590;

const AREA2_ENEMIES = new Set<EnemyId>(['sniper', 'hopper', 'seeker']);
const ACTOR_INDEX: Record<string, number> = Object.fromEntries(ACTORS.map((a, i) => [a, i]));
const ENEMY_COLOR: Record<EnemyId, number> = { sentry: C.warn, patrol: C.star, stalker: C.bad, crawler: C.accent, blinker: 0x8b5cf6, sniper: C.normal, hopper: C.accent, seeker: C.normal, warden: C.visual };
const XP: Record<EnemyId, number> = { sentry: 20, patrol: 20, stalker: 25, crawler: 25, blinker: 30, sniper: 35, hopper: 35, seeker: 110, warden: 80 };

/** The Buffer: a separate battle scene built for typing. */
export class Battle extends Phaser.Scene {
  private sim!: Sim;
  private enemy: EnemyId = 'sentry';
  private entityId = '';
  private areaId = 'area-1';
  private cw = 11;
  private g!: Phaser.GameObjects.Graphics;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private weakTexts: Phaser.GameObjects.Text[] = [];
  private curText!: Phaser.GameObjects.Text;
  private stalkText!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Rectangle[] = [];
  private teleText!: Phaser.GameObjects.Text;
  private progText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private tickText!: Phaser.GameObjects.Text;
  private strip: Phaser.GameObjects.Container[] = [];
  private portrait!: Phaser.GameObjects.Container;
  private flash!: Phaser.GameObjects.Rectangle;
  private overlay: Phaser.GameObjects.GameObject[] | null = null;
  private finished = false;
  private seed = 1;
  private startedAt = 0;
  private dodged = 0;
  private damageBy: Record<string, number> = {};

  constructor() {
    super('Battle');
  }

  init(data: { enemy: EnemyId; entityId: string; seed?: number; area?: string }): void {
    this.areaId = data.area ?? 'area-1';
    this.enemy = data.enemy;
    this.entityId = data.entityId;
    this.seed = data.seed ?? Math.floor(Math.random() * 1e6);
  }

  create(): void {
    this.finished = false;
    this.overlay = null;
    this.lineTexts = [];
    this.weakTexts = [];
    this.pips = [];
    this.strip = [];
    this.dodged = 0;
    this.damageBy = {};
    this.startedAt = Date.now();
    this.sim = new Sim(this.enemy, createVimEngine(), createRng(this.seed));
    this.cw = charWidth(this, FONT_SIZE);
    const info = ENEMIES[this.enemy];
    const color = ENEMY_COLOR[this.enemy];

    this.add.rectangle(W / 2, H / 2, W, H, C.bg);
    // Header
    panel(this, 16, 14, W - 32, 170, color);
    const glyph = this.add.rectangle(0, 0, 120, 120, color, 0.16).setStrokeStyle(2, color, 0.9);
    const art = BOSSES.has(this.enemy) ? this.add.sprite(0, 0, this.enemy).setScale(3.4).play(`idle-${this.enemy}`) : this.add.sprite(0, 0, 'actors', (ACTOR_INDEX[this.enemy] ?? 1) * 2).setScale(6.5).play(`idle-${this.enemy}`);
    this.portrait = this.add.container(92, 99, [glyph, art]);
    this.tweens.add({ targets: this.portrait, x: '+=3', y: '-=2', duration: 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    text(this, 180, 30, info.title, 36, color, true);
    text(this, 180, 82, info.blurb, 17, C.dim).setWordWrapWidth(560);
    this.teleText = text(this, 180, 132, '', 22, C.warn, true);

    text(this, W - 340, 30, 'INTEGRITY', 14, C.dim);
    for (let i = 0; i < info.maxIntegrity; i++) this.pips.push(this.add.rectangle(W - 326 + i * 40, 76, 32, 20, C.accent).setStrokeStyle(1, 0xffffff, 0.4));
    this.progText = text(this, W - 340, 104, '', 18, C.fg);
    this.tickText = text(this, W - 340, 138, '', 15, C.dim);

    // Arena
    const widest = Math.max(...info.lines.map((l) => l.length));
    const aw = widest * this.cw + 60;
    panel(this, 16, ARENA_Y - 34, W - 32, LINE_H * info.lines.length + 76, C.line, 0x0d131a);
    void aw;
    this.g = this.add.graphics().setDepth(1);
    info.lines.forEach((line, r) => {
      text(this, ARENA_X - 48, ARENA_Y + r * LINE_H + 6, String(r + 1), 16, C.dim).setDepth(2);
      this.lineTexts.push(text(this, ARENA_X, ARENA_Y + r * LINE_H, line, FONT_SIZE, C.fg).setDepth(2));
    });
    this.curText = text(this, 0, 0, '', FONT_SIZE, 0x0a0e13, true).setDepth(4);
    this.stalkText = text(this, 0, 0, 'S', FONT_SIZE, 0x0a0e13, true).setDepth(4).setVisible(false);
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, C.bad, 0).setDepth(40);

    // Bottom: key strip and move rack
    const by = BOTTOM_Y;
    panel(this, 16, by, W - 32, H - by - 14);
    text(this, 36, by + 12, 'keys', 13, C.dim);
    text(this, 36, by + 66, 'moves', 13, C.dim);
    SKILLS.filter((s) => BATTLE_KEYS.has(s.key) || (AREA2_ENEMIES.has(this.enemy) && FIND_KEYS.has(s.key))).forEach((s, i) => {
      const lvl = mastery.level(s.key);
      keycap(this, 36 + i * 44, by + 88, s.name, lvl >= 3 ? C.accent : lvl >= 1 ? C.normal : C.dim);
    });
    this.modeText = text(this, W - 36, by + 12, 'NORMAL', 14, C.normal, true).setOrigin(1, 0);
    this.toast = text(this, W / 2, by - 30, '', 20, C.warn).setOrigin(0.5);
    text(this, W - 36, by + 98, 'Esc: retreat', 14, C.dim).setOrigin(1, 0);

    bindKeys(this, (k) => this.onKey(k));
    sweepOut(this);
    this.cameras.main.fadeIn(1, 0, 0, 0);
    log.add('battle', { enemy: this.enemy });
    if (BOSSES.has(this.enemy)) this.banner(ENEMIES[this.enemy].title, ENEMY_COLOR[this.enemy], this.enemy === 'warden' ? 'Phase 1' : 'Its weak point blinks. Read the outline.');
    this.renderAll();
  }

  // ---------------------------------------------------------------- input

  private onKey(key: string): void {
    if (this.overlay) {
      this.overlayKey(key);
      return;
    }
    if (key === 'Escape') {
      log.add('retreat', { enemy: this.enemy, ...this.stats() });
      this.leave('retreat');
      return;
    }
    const before = this.sim.cursor;
    const prevTele = this.sim.telegraphs().map((t) => t.kind + t.ticksLeft).join();
    const res = this.sim.feed(key);
    void prevTele;
    if (!res.accepted) {
      for (const e of res.events) if (e.t === 'blocked') this.say(`"${keyLabel(e.key)}" is not in your moveset yet`, C.bad);
      sfx.blocked();
      return;
    }
    sfx.key();
    mastery.record(key, res.effective);
    const after = this.sim.cursor;
    if (before.row !== after.row || before.col !== after.col) this.spawnTrail(before, after);
    for (const e of res.events) this.handle(e);
    if (this.sim.status === 'running' && this.sim.telegraphs().some((t) => (t.kind === 'pulse' || t.kind === 'sweep') && t.ticksLeft <= 3 && t.ticksLeft > 0)) sfx.warn();
    this.renderAll();
  }

  // ---------------------------------------------------------------- events

  private handle(e: BattleEvent): void {
    switch (e.t) {
      case 'hit': {
        sfx.hit();
        const p = this.cellPx(e.pos.row, e.pos.col);
        burst(this, p.x + this.cw / 2, p.y + LINE_H / 2 - 4, ENEMY_COLOR[this.enemy], 16, 80);
        this.cameras.main.shake(90, 0.003);
        this.tweens.add({ targets: this.portrait, scale: { from: 1.25, to: 1 }, duration: 200 });
        this.say('HIT', C.accent);
        break;
      }
      case 'wasted':
        this.say('Nothing to strike here', C.dim);
        break;
      case 'pulse':
        this.hurt('PULSE', 'pulse');
        break;
      case 'stalker-hit':
        this.hurt('THE STALKER CAUGHT YOU', 'stalker');
        break;
      case 'sweep':
        if (e.hit) this.hurt(`SWEPT: row ${e.row + 1}`, 'sweep');
        else {
          this.dodged++;
          this.say('DODGED!', C.accent);
          sfx.hit();
        }
        break;
      case 'jump':
        sfx.jump();
        break;
      case 'phase':
        this.banner(`PHASE ${e.phase}`, C.visual, e.phase === 3 ? 'Rows will sweep. Dodge with j and k.' : e.phase === 4 ? 'All patterns, faster.' : 'The pattern changes.');
        break;
      case 'win':
        this.finish(true);
        break;
      case 'lose':
        this.finish(false);
        break;
      case 'blocked':
        break;
    }
  }

  private hurt(label: string, source = label): void {
    this.damageBy[source] = (this.damageBy[source] ?? 0) + 1;
    sfx.damage();
    this.cameras.main.shake(220, 0.008);
    this.flash.setAlpha(0.35);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 380 });
    this.say(label, C.bad);
  }

  private say(s: string, color: number): void {
    this.toast.setText(s).setColor(`#${color.toString(16).padStart(6, '0')}`).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 900, duration: 400 });
  }

  private banner(title: string, color: number, sub: string): void {
    const t = text(this, W / 2, 380, title, 64, color, true).setOrigin(0.5).setDepth(30).setAlpha(0);
    const s = text(this, W / 2, 440, sub, 22, C.fg).setOrigin(0.5).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: [t, s], alpha: 1, duration: 200, yoyo: true, hold: 900, onComplete: () => { t.destroy(); s.destroy(); } });
    sfx.warn();
  }

  // ---------------------------------------------------------------- drawing

  private cellPx(row: number, col: number): { x: number; y: number } {
    return { x: ARENA_X + col * this.cw, y: ARENA_Y + row * LINE_H };
  }

  private spawnTrail(a: { row: number; col: number }, b: { row: number; col: number }): void {
    const n = Math.min(10, Math.abs(b.col - a.col) + Math.abs(b.row - a.row));
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n);
      const p = this.cellPx(Math.round(a.row + (b.row - a.row) * t), Math.round(a.col + (b.col - a.col) * t));
      const r = this.add.rectangle(p.x + this.cw / 2, p.y + LINE_H / 2 - 4, this.cw, LINE_H - 8, C.normal, 0.35).setDepth(3);
      this.tweens.add({ targets: r, alpha: 0, duration: 300, onComplete: () => r.destroy() });
    }
  }

  /** Redraw everything that depends on the simulation state. */
  private renderAll(): void {
    const s = this.sim;
    this.pips.forEach((p, i) => {
      p.setFillStyle(i < s.integrity ? (s.integrity <= 1 ? C.bad : C.accent) : 0x2a3340);
    });
    this.progText.setText(`Hits ${s.hitsDone}/${s.hitsNeeded}${s.id === 'warden' ? `   Phase ${s.phase}` : ''}`);
    this.tickText.setText(`tick ${s.tick}   keys ${s.keysUsed.length}   wasted ${s.wasted}`);
    const tele = s.telegraphs();
    const main = tele.find((t) => t.kind === 'sweep') ?? tele.find((t) => t.kind === 'jump' && t.cells.length > 0) ?? tele.find((t) => t.kind === 'pulse') ?? tele[0];
    this.teleText.setText(main ? `>> ${main.text}` : '').setColor(main?.kind === 'sweep' || main?.kind === 'pulse' ? '#ff5c57' : '#ffb86c');
    this.modeText.setText(s.mode === 'normal' ? 'NORMAL' : s.mode.toUpperCase());
    this.strip.forEach((k) => k.destroy());
    this.strip = s.keysUsed.slice(-18).map((k, i) => keycap(this, 36 + i * 40, BOTTOM_Y + 26, keyLabel(k), C.normal));
  }

  update(time: number): void {
    if (!this.sim) return;
    const s = this.sim;
    const g = this.g;
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 160);
    const tele = s.telegraphs();

    for (const t of tele) {
      if (t.kind === 'sweep') {
        const line = s.lines[s.sweep!.row]!;
        const p = this.cellPx(s.sweep!.row, 0);
        const urgent = t.ticksLeft <= 1;
        g.fillStyle(C.bad, (urgent ? 0.34 : 0.18) + 0.12 * pulse).fillRect(p.x - 8, p.y - 2, line.length * this.cw + 16, LINE_H - 4);
        g.lineStyle(2, C.bad, 0.9).strokeRect(p.x - 8, p.y - 2, line.length * this.cw + 16, LINE_H - 4);
      } else if (t.kind === 'jump' && t.cells.length > 0) {
        const c = t.cells[0]!;
        const p = this.cellPx(c.row, c.col);
        g.lineStyle(2, C.warn, 0.5 + 0.5 * pulse).strokeRect(p.x - 2, p.y + 2, this.cw + 4, LINE_H - 10);
      }
    }

    // Blank the characters under weak points so the '@' marker is drawn on a clean cell.
    s.lines.forEach((line, r) => {
      const cells = [...line];
      for (const w of s.weak) if (w.row === r && w.col < cells.length) cells[w.col] = ' ';
      const out = cells.join('');
      if (this.lineTexts[r]!.text !== out) this.lineTexts[r]!.setText(out);
    });

    // weak points
    this.weakTexts.forEach((t) => t.setVisible(false));
    s.weak.forEach((w, i) => {
      const p = this.cellPx(w.row, w.col);
      g.fillStyle(C.visual, 0.18 + 0.2 * pulse).fillRoundedRect(p.x - 5, p.y - 3, this.cw + 10, LINE_H - 6, 6);
      g.fillStyle(0x1a0f1a, 1).fillRect(p.x, p.y + 2, this.cw, LINE_H - 12);
      g.lineStyle(2, C.visual, 0.9).strokeRoundedRect(p.x - 2, p.y, this.cw + 4, LINE_H - 8, 4);
      let t = this.weakTexts[i];
      if (!t) {
        t = text(this, 0, 0, '@', FONT_SIZE, C.visual, true).setDepth(3);
        this.weakTexts[i] = t;
      }
      t.setVisible(true).setPosition(p.x, p.y);
    });

    // stalker
    if (s.stalker) {
      const p = this.cellPx(s.stalker.row, s.stalker.col);
      g.fillStyle(C.bad, 1).fillRoundedRect(p.x - 1, p.y + 1, this.cw + 2, LINE_H - 10, 4);
      this.stalkText.setVisible(true).setPosition(p.x, p.y);
    } else this.stalkText.setVisible(false);

    // cursor
    const c = s.cursor;
    const cp = this.cellPx(c.row, c.col);
    g.fillStyle(C.normal, 0.25).fillRoundedRect(cp.x - 6, cp.y - 4, this.cw + 12, LINE_H - 4, 6);
    g.fillStyle(C.normal, 1).fillRect(cp.x, cp.y + 1, this.cw, LINE_H - 10);
    this.curText.setPosition(cp.x, cp.y).setText(s.lines[c.row]?.[c.col] ?? ' ');
  }

  // ---------------------------------------------------------------- end of battle

  private finish(won: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const s = this.sim;
    const seconds = Math.round((Date.now() - this.startedAt) / 1000);
    let xp = 0;
    if (won) {
      xp = XP[this.enemy] + (s.wasted === 0 ? 10 : 0) + this.dodged * 2;
      mastery.addXp(xp);
      sfx.win();
    } else sfx.lose();
    log.add(won ? 'battle-won' : 'battle-lost', { enemy: this.enemy, seconds, ...this.stats() });
    this.time.delayedCall(won ? 500 : 300, () => this.showResult(won, xp, seconds));
  }

  /** What happened in this fight, for the playtest log. */
  private stats(): Record<string, unknown> {
    const s = this.sim;
    const moves: Record<string, number> = {};
    for (const k of s.keysUsed) moves[k] = (moves[k] ?? 0) + 1;
    return { keys: s.keysUsed.length, wasted: s.wasted, tick: s.tick, hits: `${s.hitsDone}/${s.hitsNeeded}`, phase: s.phase, integrity: s.integrity, dodged: this.dodged, damage: this.damageBy, moves };
  }

  private showResult(won: boolean, xp: number, seconds: number): void {
    const s = this.sim;
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(60));
    objs.push(panel(this, 300, 150, W - 600, 400, won ? C.accent : C.bad).setDepth(61));
    objs.push(text(this, W / 2, 200, won ? `${ENEMIES[this.enemy].title} PURGED` : 'INTEGRITY DEPLETED', 36, won ? C.accent : C.bad, true).setOrigin(0.5).setDepth(62));
    const rows = [
      ['keys pressed', String(s.keysUsed.length)],
      ['wasted strikes', String(s.wasted)],
      ['time', `${seconds}s`],
      ...(this.enemy === 'warden' ? [['sweeps dodged', String(this.dodged)]] : []),
      ...(won ? [['XP earned', `+${xp}`]] : []),
    ];
    rows.forEach(([k, v], i) => {
      objs.push(text(this, 360, 275 + i * 40, k!, 22, C.dim).setDepth(62));
      objs.push(text(this, W - 360, 275 + i * 40, v!, 22, C.fg, true).setOrigin(1, 0).setDepth(62));
    });
    objs.push(text(this, W / 2, 495, won ? 'Enter: back to the map' : 'Enter: retry    Esc: retreat', 17, C.warn).setOrigin(0.5).setDepth(62));
    this.overlay = objs;
    this.won = won;
  }

  private won = false;

  private overlayKey(key: string): void {
    if (key === 'Enter') {
      if (this.won) this.leave('won');
      else this.scene.restart({ enemy: this.enemy, entityId: this.entityId, seed: this.seed + 1, area: this.areaId });
    } else if (key === 'Escape') this.leave(this.won ? 'won' : 'retreat');
  }

  private leave(result: 'won' | 'retreat'): void {
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.time.delayedCall(190, () => this.scene.start('World', { result, enemy: this.enemy, entityId: this.entityId, area: this.areaId }));
  }
}
