import Phaser from 'phaser';
import { log, mastery, resetProgress, setMuted, sfx } from '../session';
import { bindKeys, C, H, text, W } from '../ui';

type Item = { label: () => string; run: () => void };

export class Title extends Phaser.Scene {
  private index = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Text;
  private note!: Phaser.GameObjects.Text;
  private confirmReset = false;
  private items: Item[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    // Playtest shortcut: open the game with #warden, #sentry, #patrol, #stalker to jump to a battle.
    const jump = location.hash.slice(1);
    if (['warden', 'sentry', 'patrol', 'stalker'].includes(jump)) {
      location.hash = '';
      this.scene.start('Battle', { enemy: jump, entityId: `${jump}-test` });
      return;
    }
    this.index = 0;
    this.confirmReset = false;
    this.labels = [];
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);

    // Falling code rain for atmosphere.
    for (let i = 0; i < 26; i++) {
      const t = text(this, Math.random() * W, Math.random() * H, 'x@{}();=#<>'[Math.floor(Math.random() * 11)]!, 16, C.line);
      t.setAlpha(0.5 + Math.random() * 0.4);
      this.tweens.add({ targets: t, y: H + 30, duration: 6000 + Math.random() * 8000, repeat: -1, delay: Math.random() * 4000, onRepeat: () => t.setY(-20) });
    }

    const title = text(this, W / 2, 110, 'BUFFER OVERFLOW', 56, C.accent, true).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: { from: 0.8, to: 1 }, duration: 1400, yoyo: true, repeat: -1 });
    text(this, W / 2, 168, 'a Vim action RPG  ·  proof of concept', 18, C.dim).setOrigin(0.5);

    this.items = [
      { label: () => 'Adventure: Area 1, Movement', run: () => this.scene.start('World') },
      { label: () => 'Arcade Room: Target Rush', run: () => this.scene.start('Arcade') },
      { label: () => 'Character sheet', run: () => this.scene.start('Sheet', { back: 'Title' }) },
      { label: () => `Sound: ${sfx.muted ? 'off' : 'on'}`, run: () => this.toggleSound() },
      { label: () => `Export playtest log (${log.count} events)`, run: () => this.exportLog() },
      { label: () => (this.confirmReset ? 'Really reset progress? press y' : 'Reset progress'), run: () => this.askReset() },
    ];
    this.items.forEach((it, i) => {
      const t = text(this, 330, 250 + i * 44, it.label(), 24, C.fg);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => this.activate());
      this.labels.push(t);
    });
    this.cursor = text(this, 296, 250, '▶', 24, C.normal, true);
    this.note = text(this, W / 2, 540, '', 16, C.warn).setOrigin(0.5);
    text(this, W / 2, 568, 'j / k move   Enter choose   Tab character sheet in the world   Esc back', 14, C.dim).setOrigin(0.5);
    text(this, W / 2, 20, `Level ${mastery.characterLevel}   ${mastery.xp} XP`, 14, C.dim).setOrigin(0.5, 0);
    this.refresh();

    bindKeys(this, (k) => {
      sfx.menu();
      if (this.confirmReset) {
        if (k === 'y') {
          resetProgress();
          log.add('reset');
          this.note.setText('Progress reset.');
        }
        this.confirmReset = false;
        this.refresh();
        return;
      }
      if (k === 'j') this.select((this.index + 1) % this.items.length);
      else if (k === 'k') this.select((this.index - 1 + this.items.length) % this.items.length);
      else if (k === 'g') this.select(0);
      else if (k === 'G') this.select(this.items.length - 1);
      else if (k === 'Enter') this.activate();
    });
  }

  private select(i: number): void {
    this.index = i;
    this.refresh();
  }

  private activate(): void {
    this.items[this.index]!.run();
    this.refresh();
  }

  private refresh(): void {
    this.items.forEach((it, i) => {
      this.labels[i]!.setText(it.label()).setColor(i === this.index ? '#ffffff' : '#94a3b8');
    });
    this.cursor.setY(250 + this.index * 44);
  }

  private toggleSound(): void {
    setMuted(!sfx.muted);
    log.add('sound', { muted: sfx.muted });
  }

  private askReset(): void {
    this.confirmReset = true;
  }

  private exportLog(): void {
    const blob = new Blob([log.toText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'buffer-overflow-playtest-log.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.note.setText('Saved buffer-overflow-playtest-log.txt');
  }
}
