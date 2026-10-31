import { C, DISPLAY_FONT, FONT, hex } from './ui';

const SIZE = 1080;
const FILE_NAME = 'vimourney-run.png';

export interface CardSprite {
  image: CanvasImageSource;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Card {
  level: number;
  xp: number;
  tiles: { label: string; value: string; color: number }[];
  site: string;
  player: CardSprite;
  boss: CardSprite;
}

/** A square image: it shows large in phone feeds and is not cropped by any of the big networks. */
export function drawCard(card: Card): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = hex(C.bg);
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const write = (s: string, x: number, y: number, font: string, color: number): void => {
    ctx.font = font;
    ctx.fillStyle = hex(color);
    ctx.fillText(s, x, y);
  };

  ctx.imageSmoothingEnabled = false;
  const { player, boss } = card;
  ctx.drawImage(player.image, player.x, player.y, player.w, player.h, 70, 70, 160, 160);
  ctx.drawImage(boss.image, boss.x, boss.y, boss.w, boss.h, SIZE - 230, 70, 160, 160);
  write('VIMOURNEY', SIZE / 2, 140, `700 112px ${DISPLAY_FONT}`, C.accent);
  write(`Level ${card.level}   ${card.xp} XP`, SIZE / 2, 264, `700 44px ${FONT}`, C.star);

  card.tiles.forEach((t, i) => {
    const x = 60 + (i % 2) * 500;
    const y = 320 + Math.floor(i / 2) * 208;
    ctx.beginPath();
    ctx.roundRect(x, y, 460, 188, 16);
    ctx.fillStyle = hex(C.panel);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = hex(t.color);
    ctx.stroke();
    write(t.value, x + 230, y + 76, `700 84px ${FONT}`, C.star);
    write(t.label, x + 230, y + 148, `400 32px ${FONT}`, C.fg);
  });

  write('Can you beat this?', SIZE / 2, 972, `700 40px ${FONT}`, C.warn);
  write(card.site, SIZE / 2, 1026, `400 32px ${FONT}`, C.fg);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Opens the device's share sheet. Without one, saves the image and copies the caption. Returns what to tell the player. */
export async function shareCard(blob: Blob, caption: string): Promise<string> {
  const file = new File([blob], FILE_NAME, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: caption });
      return 'Shared. Nice run.';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return '';
      // Blocked or failed: fall through and hand over the file instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = FILE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  try {
    await navigator.clipboard.writeText(caption);
    return `Saved ${FILE_NAME} and copied the caption.`;
  } catch {
    return `Saved ${FILE_NAME}.`;
  }
}
