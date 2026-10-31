import Phaser from 'phaser';
import { createVimEngine } from '@kbm/vim';
import { addHighScore, RUSH_COLS as COLS, RUSH_SECONDS, TargetRush, type HighScore } from '../sim/arcade';
import { createRng } from '../sim/rng';
import { log, mastery, sfx, store } from '../session';
import { bindKeys, burst, C, charWidth, H, heading, keyLabel, panel, stage, text, W } from '../ui';

const FONT_SIZE = 26;
const AY = 170;
const LH = 52;

const CHEAT = [
  ['w  b  e', 'next word / previous word / end of word'],
  ['0  ^  $', 'start of line / first letter / end of line'],
  ['j  k', 'down / up (a count helps: 3j)'],
  ['f + letter', 'jump onto the next letter on the line, ; repeats'],
  ['gg  G', 'first / last line'],
];

type Phase = 'ready' | 'play' | 'over';

/** Arcade Room: Target Rush. A scored, timed movement game with a local top ten. */
export class Arcade extends Phaser.Scene {
  private game_!: TargetRush;
  private phase: Phase = 'ready';
  private cw = 12;
  private ax = 90;
  private g!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private feed!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private keysText!: Phaser.GameObjects.Text;
  private pendingText!: Phaser.GameObjects.Text;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private curText!: Phaser.GameObjects.Text;
  private tgtText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private daily = false;
  private seed = 1;
  private lastTick = -1;
  private hintsShown = 0;

  constructor() {
    super('Arcade');
  }

  create(): void {
    this.phase = 'ready';
    this.overlay = [];
    this.lineTexts = [];
    this.cw = charWidth(this, FONT_SIZE);
    this.ax = Math.round((W - COLS * this.cw) / 2);
    stage(this);
    heading(this, 24, 12, 'Target Rush', 40, C.visual);
    this.scoreText = text(this, W - 24, 16, 'SCORE 0', 28, C.star, true).setOrigin(1, 0);
    this.timeText = text(this, W / 2, 8, '', 48, C.fg, true).setOrigin(0.5, 0);
    this.comboText = text(this, 24, 60, '', 20, C.accent, true);
    this.pendingText = text(this, W - 24, 56, '', 18, C.warn, true).setOrigin(1, 0);
    panel(this, 16, AY - 28, W - 32, LH * 7 + 48, C.line, 0x0d131a);
    this.g = this.add.graphics().setDepth(1);
    this.curText = text(this, 0, 0, '', FONT_SIZE, 0x0a0e13, true).setDepth(4);
    this.tgtText = text(this, 0, 0, '', FONT_SIZE, C.visual, true).setDepth(3);
    panel(this, 16, 568, W - 32, 136);
    this.feed = text(this, 36, 582, '', 19, C.fg);
    this.keysText = text(this, 36, 614, '', 19, C.normal);
    this.hintText = text(this, 36, 646, '', 19, C.warn, true);
    this.info = text(this, 36, 678, '', 15, C.dim);

    this.newRound(false);
    bindKeys(this, (k) => this.onKey(k));
    this.lastTick = -1;
    this.refresh();
  }

  private newRound(daily: boolean): void {
    this.daily = daily;
    const d = new Date();
    this.seed = daily ? d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() : Math.floor(Math.random() * 1e9);
    this.game_ = new TargetRush(createVimEngine, createRng(this.seed));
    this.lineTexts.forEach((t) => t.destroy());
    this.lineTexts = this.game_.lines.map((line, r) => text(this, this.ax, AY + r * LH, line, FONT_SIZE, C.fg).setDepth(2));
    this.clearOverlay();
    this.phase = 'ready';
    const o: Phaser.GameObjects.GameObject[] = [];
    o.push(this.add.rectangle(W / 2, 340, 880, 360, 0x000000, 0.88).setDepth(30), panel(this, W / 2 - 440, 160, 880, 360, C.visual).setDepth(30));
    o.push(text(this, W / 2, 190, 'Reach each glowing target in as few keys as you can.', 24, C.fg, true).setOrigin(0.5).setDepth(31));
    o.push(text(this, W / 2, 228, `${RUSH_SECONDS} seconds. Fewer keys = more points. Clean chains build a combo.`, 17, C.dim).setOrigin(0.5).setDepth(31));
    CHEAT.forEach(([k, d], i) => {
      o.push(text(this, W / 2 - 360, 276 + i * 30, k, 19, C.normal, true).setDepth(31));
      o.push(text(this, W / 2 - 200, 278 + i * 30, d, 17, C.fg).setDepth(31));
    });
    o.push(text(this, W / 2, 478, `Enter: start    d: ${daily ? 'random seed' : 'daily seed'}    Esc: menu`, 19, C.warn).setOrigin(0.5).setDepth(31));
    this.overlay = o;
    this.info.setText(daily ? `Daily seed ${this.seed}: everyone gets the same text today.` : 'Random seed.');
    this.feed.setText('');
    this.keysText.setText('');
    this.hintText.setText('');
  }

  private clearOverlay(): void {
    this.overlay.forEach((o) => o.destroy());
    this.overlay = [];
  }

  private onKey(key: string): void {
    if (this.phase === 'ready') {
      if (key === 'Enter') {
        this.clearOverlay();
        this.phase = 'play';
        this.hintsShown = 0;
        log.add('arcade-start', { seed: this.seed, daily: this.daily });
      } else if (key === 'd') this.newRound(!this.daily);
      else if (key === 'Escape') this.scene.start('Title');
      return;
    }
    if (this.phase === 'over') {
      if (key === 'Enter') this.newRound(this.daily);
      else if (key === 'Escape') this.scene.start('Title');
      return;
    }
    if (key === 'Escape') {
      log.add('arcade-quit', { score: this.game_.score, captures: this.game_.captures.length, timeLeft: Math.round(this.game_.timeLeft), seed: this.seed });
      this.scene.start('Title');
      return;
    }
    const r = this.game_.feed(key);
    if (!r.accepted) {
      sfx.blocked();
      if (key.startsWith('Arrow')) this.hintText.setText('Arrow keys are off here: use h j k l, or better, w b e 0 $');
      return;
    }
    sfx.key();
    const st = this.game_;
    this.keysText.setText(`keys: ${st.keysSince.map(keyLabel).join(' ')}`);
    if (r.capture) {
      const c = r.capture;
      const p = this.cellPx(st.cursor.row, st.cursor.col);
      burst(this, p.x + this.cw / 2, p.y + 18, C.visual, 18, 90);
      sfx.capture(st.combo);
      this.cameras.main.shake(70, 0.002);
      const extra = Math.max(0, c.keys.length - c.best.length);
      this.feed.setText(`+${c.points}   you used ${c.keys.length}, best was ${c.best.length}${c.best.length ? `  (${c.best.map(keyLabel).join(' ')})` : ''}${extra === 0 ? '   PERFECT' : ''}`);
      this.feed.setColor(extra === 0 ? '#5af78e' : extra <= 1 ? '#cbd5e1' : '#ffb86c');
    }
    if (st.hint && this.hintText.text === '') this.hintsShown++;
    this.hintText.setText(st.hint ? `Hint: the best route is ${st.hint.map(keyLabel).join(' ')}  (${st.hint.length} keys)` : r.capture ? '' : this.hintText.text);
    this.refresh();
  }

  private cellPx(row: number, col: number): { x: number; y: number } {
    return { x: this.ax + col * this.cw, y: AY + row * LH };
  }

  private refresh(): void {
    const s = this.game_;
    this.scoreText.setText(`SCORE ${s.score}`);
    this.comboText.setText(s.combo > 1 ? `combo x${s.combo}` : '');
  }

  update(time: number, delta: number): void {
    if (!this.game_) return;
    const s = this.game_;
    if (this.phase === 'play') {
      if (s.tick(delta / 1000)) {
        this.endRound();
      }
      const sec = Math.ceil(s.timeLeft);
      if (sec !== this.lastTick) {
        this.lastTick = sec;
        if (sec <= 5 && sec > 0) sfx.warn();
      }
    }
    this.timeText.setText(String(Math.ceil(s.timeLeft))).setColor(s.timeLeft <= 10 ? '#ff5c57' : '#cbd5e1');

    const g = this.g;
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 140);
    const t = s.target;
    // Blank the target's own character so the marker is drawn on a clean cell.
    s.lines.forEach((line, r) => {
      const out = r === t.row ? line.slice(0, t.col) + ' ' + line.slice(t.col + 1) : line;
      if (this.lineTexts[r] && this.lineTexts[r]!.text !== out) this.lineTexts[r]!.setText(out);
    });
    const tp = this.cellPx(t.row, t.col);
    g.fillStyle(C.visual, 0.2 + 0.25 * pulse).fillRoundedRect(tp.x - 7, tp.y - 4, this.cw + 14, LH - 6, 7);
    g.fillStyle(0x1a0f1a, 1).fillRect(tp.x, tp.y + 2, this.cw, LH - 14);
    g.lineStyle(2, C.visual, 1).strokeRoundedRect(tp.x - 3, tp.y - 1, this.cw + 6, LH - 10, 4);
    this.tgtText.setPosition(tp.x, tp.y + 2).setText(s.lines[t.row]![t.col] ?? '');
    const c = s.cursor;
    const cp = this.cellPx(c.row, c.col);
    g.fillStyle(C.normal, 0.25).fillRoundedRect(cp.x - 6, cp.y - 5, this.cw + 12, LH - 6, 6);
    g.fillStyle(C.normal, 1).fillRect(cp.x, cp.y + 1, this.cw, LH - 14);
    this.curText.setPosition(cp.x, cp.y + 1).setText(s.lines[c.row]?.[c.col] ?? ' ');
    this.pendingText.setText('');
  }

  private endRound(): void {
    this.phase = 'over';
    const s = this.game_;
    const table = store.get<HighScore[]>('arcade-hs', []);
    const entry: HighScore = { score: s.score, captures: s.captures.length, date: new Date().toISOString().slice(0, 10) };
    const { table: next, rank } = addHighScore(table, entry);
    store.set('arcade-hs', next);
    const today = entry.date;
    let xp = 0;
    if (store.get<string>('arcade-xp-day', '') !== today && s.score > 0) {
      xp = Math.min(50, Math.floor(s.score / 10));
      mastery.addXp(xp);
      store.set('arcade-xp-day', today);
    }
    const waste = s.captures.reduce((n, c) => n + Math.max(0, c.keys.length - c.best.length), 0);
    const detail = s.captures.map((c) => `${c.keys.length}/${c.best.length}`).join(' ');
    log.add('arcade-end', { score: s.score, captures: s.captures.length, wastedKeys: waste, rank, seed: this.seed, keysVsBest: detail, hintsShown: this.hintsShown, abandoned: s.keysSince.length });
    sfx.win();

    const o: Phaser.GameObjects.GameObject[] = [];
    o.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setDepth(40), panel(this, 300, 70, W - 600, 580, C.visual).setDepth(41));
    o.push(heading(this, W / 2, 112, "TIME'S UP", 56, C.visual).setOrigin(0.5).setDepth(42));
    o.push(text(this, W / 2, 180, `${s.score} points`, 40, C.star, true).setOrigin(0.5).setDepth(42));
    o.push(text(this, W / 2, 230, `${s.captures.length} targets   ${waste} extra keys${xp ? `   +${xp} XP (daily bonus)` : ''}`, 16, C.dim).setOrigin(0.5).setDepth(42));
    o.push(text(this, 360, 275, 'TOP TEN', 15, C.dim).setDepth(42));
    next.slice(0, 10).forEach((h, i) => {
      const mine = rank === i + 1;
      o.push(text(this, 360, 302 + i * 28, `${String(i + 1).padStart(2)}.  ${String(h.score).padStart(5)}   ${h.captures} targets   ${h.date}`, 16, mine ? C.accent : C.fg, mine).setDepth(42));
    });
    o.push(text(this, W / 2, 616, 'Enter: again    Esc: menu', 17, C.warn).setOrigin(0.5).setDepth(42));
    this.overlay = o;
  }
}
