import Phaser from 'phaser';

/** Order of the 16x16 actor cells in `actors.png`: two frames each. */
export const ACTORS = ['player', 'sentry', 'patrol', 'stalker', 'crawler', 'blinker', 'lesson'] as const;
export type ActorName = (typeof ACTORS)[number];
/** Order of the 16x16 cells in `tiles.png`. */
export const TILES = ['floor0', 'floor1', 'floor2', 'wall', 'doorClosed', 'doorOpen'] as const;

/** Loads the Aseprite-built sheets and defines the idle animations. Falls through to the Title even if art is missing. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet('actors', 'assets/actors.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles', 'assets/tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('warden', 'assets/warden.png', { frameWidth: 32, frameHeight: 32 });
  }

  create(): void {
    for (const k of ['actors', 'tiles', 'warden']) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    ACTORS.forEach((name, i) => {
      this.anims.create({ key: `idle-${name}`, frames: this.anims.generateFrameNumbers('actors', { start: i * 2, end: i * 2 + 1 }), frameRate: 3, repeat: -1 });
    });
    this.anims.create({ key: 'idle-warden', frames: this.anims.generateFrameNumbers('warden', { start: 0, end: 1 }), frameRate: 3, repeat: -1 });
    this.scene.start('Title');
  }
}
