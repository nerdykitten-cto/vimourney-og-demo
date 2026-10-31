import Phaser from 'phaser';
import { isCleared, log, mastery, resetProgress, setMuted, sfx } from '../session';
import { bindKeys, C, H, heading, stage, text, W } from '../ui';

const MENU_Y = 268;
const MENU_GAP = 46;

type Item = { label: () => string; run: () => void };

export class Title extends Phaser.Scene {
  private index = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Sprite;
  private note!: Phaser.GameObjects.Text;
  private confirmReset = false;
  private items: Item[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    // Playtest shortcut: open the game with #warden, #sentry, #patrol, #stalker to jump to a battle.
    const jump = location.hash.slice(1);
    if (['warden', 'sentry', 'patrol', 'stalker', 'crawler', 'blinker', 'sniper', 'hopper', 'seeker'].includes(jump)) {
      location.hash = '';
      this.scene.start('Battle', { enemy: jump, entityId: `${jump}-test` });
      return;
    }
    this.index = 0;
    this.confirmReset = false;
    this.labels = [];
    stage(this);

    // Falling code rain for atmosphere.
    for (let i = 0; i < 40; i++) {
      const t = text(this, Math.random() * W, Math.random() * H, 'x@{}();=#<>'[Math.floor(Math.random() * 11)]!, 20, C.line);
      t.setAlpha(0.5 + Math.random() * 0.4);
      this.tweens.add({ targets: t, y: H + 30, duration: 6000 + Math.random() * 8000, repeat: -1, delay: Math.random() * 4000, onRepeat: () => t.setY(-20) });
    }

    const title = heading(this, W / 2, 130, 'VIMOURNEY', 96, C.accent).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: { from: 0.8, to: 1 }, duration: 1400, yoyo: true, repeat: -1 });
    text(this, W / 2, 200, 'Every move is a real Vim command. No Vim experience needed.', 20, C.fg).setOrigin(0.5);
    text(this, W / 2, 232, 'playable demo', 15, C.dim).setOrigin(0.5);

    this.add.sprite(W / 2 - 500, 136, 'actors', 0).setScale(6).play('idle-player');
    this.add.sprite(W / 2 + 500, 130, 'warden').setScale(3.5).play('idle-warden');
    this.items = [
      { label: () => `Adventure: Area 1, Movement${isCleared('area-1') ? '  (cleared)' : ''}`, run: () => this.scene.start('World', { area: 'area-1' }) },
      { label: () => `Adventure: Area 2, Find and Jump${isCleared('area-2') ? '  (cleared)' : ''}`, run: () => this.scene.start('World', { area: 'area-2' }) },
      { label: () => 'Arcade Room: Target Rush', run: () => this.scene.start('Arcade') },
      { label: () => 'Character sheet', run: () => this.scene.start('Sheet', { back: 'Title' }) },
      { label: () => `Sound: ${sfx.muted ? 'off' : 'on'}`, run: () => this.toggleSound() },
      { label: () => `Fullscreen: ${document.fullscreenElement ? 'on' : 'off'}`, run: () => this.toggleFullscreen() },
      { label: () => 'Save play log', run: () => this.exportLog() },
      { label: () => (this.confirmReset ? 'Really reset progress? press y' : 'Reset progress'), run: () => this.askReset() },
    ];
    this.items.forEach((it, i) => {
      const t = text(this, W / 2 - 250, MENU_Y + i * MENU_GAP, it.label(), 24, C.fg);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => this.activate());
      this.labels.push(t);
    });
    this.cursor = this.add.sprite(W / 2 - 285, MENU_Y + 15, 'actors', 0).setScale(1.5).play('idle-player');
    this.note = text(this, W / 2, 648, '', 18, C.warn).setOrigin(0.5);
    text(this, W / 2, 684, 'j / k or arrow keys: move    Enter: choose    Esc: back', 16, C.dim).setOrigin(0.5);
    text(this, W / 2, 16, `Level ${mastery.characterLevel}   ${mastery.xp} XP`, 16, C.dim).setOrigin(0.5, 0);
    this.refresh();

    bindKeys(this, (k) => {
      sfx.menu();
      this.note.setText('');
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
      if (k === 'j' || k === 'ArrowDown') this.select((this.index + 1) % this.items.length);
      else if (k === 'k' || k === 'ArrowUp') this.select((this.index - 1 + this.items.length) % this.items.length);
      else if (k === 'g') this.select(0);
      else if (k === 'G') this.select(this.items.length - 1);
      else if (k === 'Enter') this.activate();
    });
  }

  private openArea2(): void {
    if (isCleared('area-1') || location.hash === '#all') this.scene.start('World', { area: 'area-2' });
    else this.note.setText('Clear Area 1 first (beat the Warden). Tip: open the page with #all to skip.');
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
    this.cursor.setY(MENU_Y + 15 + this.index * MENU_GAP);
  }

  private toggleSound(): void {
    setMuted(!sfx.muted);
    log.add('sound', { muted: sfx.muted });
  }

  private toggleFullscreen(): void {
    const done = (): void => this.refresh();
    const blocked = (): void => void this.note.setText('Fullscreen is not available here.');
    if (document.fullscreenElement) void document.exitFullscreen().finally(done);
    else if (document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen().catch(blocked).finally(done);
    else blocked();
  }

  private askReset(): void {
    this.confirmReset = true;
  }

  private exportLog(): void {
    const blob = new Blob([log.toText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vimourney-playtest-log.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.note.setText('Saved vimourney-playtest-log.txt to your downloads.');
  }
}
