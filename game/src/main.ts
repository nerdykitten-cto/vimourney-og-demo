import Phaser from 'phaser';
import { Arcade } from './scenes/Arcade';
import { Battle } from './scenes/Battle';
import { Sheet } from './scenes/Sheet';
import { Title } from './scenes/Title';
import { World } from './scenes/World';
import { C, H, W } from './ui';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: C.bg,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Title, World, Battle, Sheet, Arcade],
  render: { antialias: true },
});
