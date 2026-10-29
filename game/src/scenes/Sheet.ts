import Phaser from 'phaser';
import { LEVEL_NAMES, progressFor, SKILLS, THRESHOLDS } from '../sim/mastery';
import { mastery } from '../session';
import { bindKeys, C, H, panel, text, W } from '../ui';

export class Sheet extends Phaser.Scene {
  private back = 'Title';

  constructor() {
    super('Sheet');
  }

  init(data: { back?: string }): void {
    this.back = data?.back ?? 'Title';
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);
    text(this, 30, 20, 'CHARACTER', 30, C.accent, true);
    text(this, W - 30, 26, `Level ${mastery.characterLevel}   ${mastery.xp} XP`, 20, C.star, true).setOrigin(1, 0);
    text(this, 30, 62, 'Every command is a skill. Mastery only rises when you use it well.', 15, C.dim);
    panel(this, 20, 96, W - 40, 440);

    text(this, 50, 112, 'skill', 13, C.dim);
    text(this, 330, 112, 'mastery', 13, C.dim);
    text(this, W - 50, 112, 'uses', 13, C.dim).setOrigin(1, 0);
    SKILLS.forEach((s, i) => {
      const y = 136 + i * 36;
      const uses = mastery.uses(s.key);
      const lvl = mastery.level(s.key);
      const col = lvl >= 3 ? C.accent : lvl >= 1 ? C.normal : C.dim;
      text(this, 50, y, s.name, 20, col, true);
      text(this, 100, y + 3, s.blurb, 15, C.fg);
      const barX = 330;
      const g = this.add.graphics();
      g.fillStyle(0x1a2330, 1).fillRoundedRect(barX, y + 4, 260, 14, 5);
      const done = lvl >= THRESHOLDS.length;
      const frac = done ? 1 : (lvl + progressFor(uses)) / THRESHOLDS.length;
      g.fillStyle(col, 1).fillRoundedRect(barX, y + 4, Math.max(0, 260 * frac), 14, 5);
      for (let k = 1; k < THRESHOLDS.length; k++) g.fillStyle(C.bg, 1).fillRect(barX + (260 * k) / THRESHOLDS.length, y + 4, 2, 14);
      text(this, barX + 280, y, LEVEL_NAMES[lvl]!, 16, col);
      text(this, W - 50, y + 2, String(uses), 16, C.dim).setOrigin(1, 0);
    });
    text(this, W / 2, H - 40, 'Esc or Tab: back', 16, C.warn).setOrigin(0.5);

    bindKeys(this, (k) => {
      if (k === 'Escape' || k === 'Tab' || k === 'Enter') this.scene.start(this.back);
    });
  }
}
