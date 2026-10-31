import Phaser from 'phaser';
import { Arcade } from './scenes/Arcade';
import { Battle } from './scenes/Battle';
import { Boot } from './scenes/Boot';
import { Sheet } from './scenes/Sheet';
import { Title } from './scenes/Title';
import { World } from './scenes/World';
import { C, H, W, ZOOM } from './ui';

export function startGame(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    title: 'Vimourney',
    banner: false,
    width: W * ZOOM,
    height: H * ZOOM,
    backgroundColor: C.bg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Boot, Title, World, Battle, Sheet, Arcade],
    render: { antialias: true },
  });
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
  game.events.once(Phaser.Core.Events.READY, () => {
    document.getElementById('loading')!.hidden = true;
  });
}
