import Phaser from 'phaser';
import { AREAS } from '../sim/area2';
import { BOSSES } from '../sim/battle';
import { clockTime, runStats, shareCaption } from '../sim/runstats';
import { isCleared, log, mastery } from '../session';
import { drawCard, shareCard, type CardSprite } from '../share';
import { bindKeys, C, heading, keyLabel, onScreenKeys, panel, stage, text, W } from '../ui';

const PANEL_W = 590;
const ROWS = 7;
const SHARE_W = 380;
const SHARE_H = 110;
const WIDE = { top: 130, head: 58, row: 46, label: 22, value: 26 };
// On-screen keys cover the lower corners and phones shrink everything: sit higher, tighter and bigger.
const THUMBS = { top: 62, head: 46, row: 36, label: 28, value: 28 };

type Row = [label: string, value: string];

export class Stats extends Phaser.Scene {
  private look = WIDE;
  private card: Promise<Blob | null> = Promise.resolve(null);
  private caption = '';
  private sharing = false;
  private note!: Phaser.GameObjects.Text;

  constructor() {
    super('Stats');
  }

  create(): void {
    stage(this);
    this.look = onScreenKeys() ? THUMBS : WIDE;
    const { top } = this.look;
    const s = runStats(log.run);
    const areas = `${AREAS.filter((a) => isCleared(a.id)).length}/${AREAS.length}`;
    const bosses = `${s.bossesBeaten}/${BOSSES.size}`;

    heading(this, W / 2, top - 42, 'Run stats', 36, C.accent).setOrigin(0.5);
    text(this, W / 2, top - 16, 'This run only. Reset progress on the main menu to start a new one.', 16, C.dim).setOrigin(0.5);

    this.column(30, top, 'Adventure', C.normal, [
      ['Areas cleared', areas],
      ['Bosses beaten', bosses],
      ['Fights won', String(s.fightsWon)],
      ['Fights lost or fled', String(s.fightsLost)],
      ['Wasted strikes', String(s.wastedStrikes)],
      ['Time fighting', clockTime(s.seconds)],
      ['Most used key', s.topKey === null ? 'none yet' : keyLabel(s.topKey)],
    ]);
    this.column(W - 30 - PANEL_W, top, 'Arcade', C.visual, [
      ['Rounds finished', String(s.arcadeRounds)],
      ['Best score', String(s.bestScore)],
      ['Targets hit', String(s.targets)],
      ['Extra keys per target', s.extraKeysPerTarget.toFixed(1)],
      ['Hints shown', String(s.hints)],
    ]);

    const bottom = top + this.panelHeight();
    text(this, W / 2, bottom + 24, 'Esc: back', 18, C.warn).setOrigin(0.5);
    this.sharing = false;
    this.note = text(this, W / 2, bottom + 46 + SHARE_H + 18, '', 18, C.accent).setOrigin(0.5);
    const played = s.fightsWon + s.fightsLost + s.arcadeRounds > 0;
    if (played) {
      this.caption = shareCaption(s, mastery.characterLevel, areas, bosses, location.origin);
      this.shareButton(bottom + 46 + SHARE_H / 2);
      this.card = drawCard({
        level: mastery.characterLevel,
        xp: mastery.xp,
        tiles: [
          { label: 'Areas cleared', value: areas, color: C.normal },
          { label: 'Bosses beaten', value: bosses, color: C.normal },
          { label: 'Fights won', value: String(s.fightsWon), color: C.normal },
          { label: 'Wasted strikes', value: String(s.wastedStrikes), color: C.normal },
          { label: 'Arcade best score', value: String(s.bestScore), color: C.visual },
          { label: 'Arcade targets hit', value: String(s.targets), color: C.visual },
        ],
        site: location.host,
        player: this.sprite('actors'),
        boss: this.sprite('warden'),
      });
    }
    bindKeys(this, (k) => {
      if (k === 'Escape' || k === 'Enter') this.scene.start('Title');
      else if (k === 's' && played) this.share();
    });
  }

  private sprite(key: string): CardSprite {
    const f = this.textures.getFrame(key, 0);
    return { image: f.source.image as CanvasImageSource, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight };
  }

  private shareButton(y: number): void {
    const box = this.add.rectangle(W / 2, y, SHARE_W, SHARE_H, C.panel2).setStrokeStyle(2, C.accent);
    heading(this, W / 2, y, onScreenKeys() ? 'Share my run' : 's: share my run', 34, C.accent).setOrigin(0.5);
    // pointerup, not pointerdown: a phone only opens its share sheet from the end of a tap.
    box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.share());
  }

  private share(): void {
    if (this.sharing) return;
    this.sharing = true;
    void this.card
      .then((blob) => (blob ? shareCard(blob, this.caption) : 'Could not make the image.'))
      .then((message) => {
        this.sharing = false;
        if (this.sys.isActive()) this.note.setText(message);
      });
  }

  private panelHeight(): number {
    return this.look.head + ROWS * this.look.row + 8;
  }

  private column(x: number, y: number, title: string, color: number, rows: Row[]): void {
    const { head, row, label: labelSize, value: valueSize } = this.look;
    panel(this, x, y, PANEL_W, this.panelHeight(), color);
    text(this, x + 24, y + (head - 30) / 2, title, 24, color, true);
    rows.forEach(([label, value], i) => {
      const rowY = y + head + i * row;
      text(this, x + 24, rowY + valueSize - labelSize, label, labelSize, C.fg);
      text(this, x + PANEL_W - 24, rowY, value, valueSize, C.star, true).setOrigin(1, 0);
    });
  }
}
