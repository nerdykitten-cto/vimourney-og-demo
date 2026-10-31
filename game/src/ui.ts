import Phaser from 'phaser';
import { normalizeKey } from '@kbm/shared';

export const W = 1280;
export const H = 720;

/**
 * The canvas is drawn at up to twice the design size, enough for most screens without slowing weak
 * laptops, and the camera zooms to match. Scenes keep working in 1280x720 units while text and sprites stay sharp at
 * any window size, including fullscreen and hi-DPI displays.
 */
export const ZOOM = Math.min(2, Math.max(1, Math.ceil(Math.max(screen.width / W, screen.height / H) * (window.devicePixelRatio || 1))));

export const C = {
  bg: 0x0a0e13,
  panel: 0x10161d,
  panel2: 0x141c25,
  line: 0x1f2a36,
  fg: 0xcbd5e1,
  dim: 0x64748b,
  accent: 0x5af78e,
  normal: 0x57c7ff,
  visual: 0xff6ac1,
  warn: 0xffb86c,
  bad: 0xff5c57,
  star: 0xf3d36b,
};

export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export const FONT = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
export const DISPLAY_FONT = '"Pixelify Sans", "IBM Plex Mono", monospace';

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 18, color = C.fg, bold = false): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: hex(color), fontStyle: bold ? 'bold' : 'normal', resolution: ZOOM });
}

/** Big pixel-font text for titles and banners. */
export function heading(scene: Phaser.Scene, x: number, y: number, s: string, size = 36, color = C.fg): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, { fontFamily: DISPLAY_FONT, fontSize: `${size}px`, color: hex(color), fontStyle: 'bold', resolution: ZOOM });
}

/** Every scene starts here: point the camera at the 1280x720 stage and fill it. */
export function stage(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(ZOOM).centerOn(W / 2, H / 2);
  scene.add.rectangle(W / 2, H / 2, W, H, C.bg);
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, border: number = C.line, fill: number = C.panel): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(1, border, 1).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 10);
  return g;
}

/** Width of one monospace character at `size` px. */
export function charWidth(scene: Phaser.Scene, size: number): number {
  const t = scene.add.text(0, 0, 'M'.repeat(20), { fontFamily: FONT, fontSize: `${size}px`, resolution: ZOOM });
  const w = t.width / 20;
  t.destroy();
  return w;
}

/** A small keycap showing a key label. Returns the container. */
export function keycap(scene: Phaser.Scene, x: number, y: number, label: string, color: number): Phaser.GameObjects.Container {
  const t = text(scene, 0, 0, label, 16, color, true);
  const w = Math.max(28, t.width + 14);
  const bg = scene.add.graphics();
  bg.fillStyle(C.panel2, 1).fillRoundedRect(0, 0, w, 28, 6);
  bg.lineStyle(1, color, 0.6).strokeRoundedRect(0.5, 0.5, w - 1, 27, 6);
  t.setPosition((w - t.width) / 2, 4);
  return scene.add.container(x, y, [bg, t]).setSize(w, 28);
}

export function keyLabel(k: string): string {
  if (k === 'Escape') return 'Esc';
  if (k === 'Enter') return '⏎';
  if (k === 'Backspace') return '⌫';
  if (k === ' ') return '␣';
  if (k.startsWith('Control-')) return `^${k.slice(8).toUpperCase()}`;
  return k;
}

/** Burst of little squares from a point: used for hits and captures. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, n = 12, spread = 60): void {
  for (let i = 0; i < n; i++) {
    const r = scene.add.rectangle(x, y, 5, 5, color).setDepth(50);
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.4 + Math.random() * 0.8);
    scene.tweens.add({
      targets: r,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d,
      alpha: 0,
      angle: Math.random() * 180,
      duration: 380 + Math.random() * 220,
      ease: 'Cubic.easeOut',
      onComplete: () => r.destroy(),
    });
  }
}

/** The diff sweep: red and green strips wipe across the screen, then `done` runs. */
export function sweepIn(scene: Phaser.Scene, done: () => void): void {
  const strips: Phaser.GameObjects.Rectangle[] = [];
  const h = 24;
  const rows = Math.ceil(H / h);
  for (let i = 0; i < rows; i++) {
    const red = i % 2 === 0;
    const r = scene.add.rectangle(red ? -W : W * 2, i * h + h / 2, W + 8, h - 1, red ? 0x7a2530 : 0x1f6b3a).setDepth(100);
    strips.push(r);
    scene.tweens.add({ targets: r, x: W / 2, duration: 260, delay: i * 14, ease: 'Cubic.easeOut' });
  }
  scene.time.delayedCall(260 + rows * 14 + 60, () => {
    const cover = scene.add.rectangle(W / 2, H / 2, W, H, C.bg).setDepth(101);
    void cover;
    done();
  });
}

/** Reverse of `sweepIn`, played when a scene starts. */
export function sweepOut(scene: Phaser.Scene): void {
  const h = 24;
  const rows = Math.ceil(H / h);
  for (let i = 0; i < rows; i++) {
    const red = i % 2 === 0;
    const r = scene.add.rectangle(W / 2, i * h + h / 2, W + 8, h - 1, red ? 0x7a2530 : 0x1f6b3a).setDepth(100);
    scene.tweens.add({ targets: r, x: red ? W * 2 : -W, duration: 280, delay: i * 12, ease: 'Cubic.easeIn', onComplete: () => r.destroy() });
  }
}

/** Route normalized key presses (shared key rules: Ctrl chords, no bare modifiers) to `fn` until the scene ends. */
export function bindKeys(scene: Phaser.Scene, fn: (key: string) => void): void {
  const kb = scene.input.keyboard;
  if (!kb) return;
  const handler = (e: KeyboardEvent): void => {
    // Arrow keys are not game keys, but scenes want to say so. Browser chords like Ctrl+R stay the browser's.
    const k = e.key.startsWith('Arrow') ? e.key : normalizeKey(e);
    if (k === null || (k.startsWith('Control-') && k !== 'Control-[')) return;
    e.preventDefault();
    fn(k);
  };
  kb.on('keydown', handler);
  scene.events.once('shutdown', () => kb.off('keydown', handler));
}
