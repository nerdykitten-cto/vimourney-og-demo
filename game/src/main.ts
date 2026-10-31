import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource/pixelify-sans/latin-700.css';
import { buildKeypad } from './keypad';

const notice = document.getElementById('notice')!;

/** Phones and tablets get a start screen first: going fullscreen needs a tap. */
const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches;

async function start(): Promise<void> {
  notice.hidden = true;
  document.getElementById('loading')!.hidden = false;
  // Canvas text does not wait for web fonts, and battles measure character width, so fonts come first.
  const fonts = ['400 16px "IBM Plex Mono"', '700 16px "IBM Plex Mono"', '700 16px "Pixelify Sans"'].map((f) => document.fonts.load(f));
  await Promise.race([Promise.all(fonts), new Promise((done) => setTimeout(done, 2500))]);
  const { startGame } = await import('./game');
  startGame();
}

/** iPhones refuse this, so the game also has to work inside the browser's own bars. */
function goFullscreen(): void {
  document.documentElement.requestFullscreen?.().catch(() => undefined);
}

/**
 * Phones can drop fullscreen, and asking needs a tap, so the next tap after a start or a rotation asks
 * again. Only once each time, so a player who chose to leave fullscreen is not pulled back in.
 */
function keepFullscreen(): void {
  let asked = false;
  screen.orientation?.addEventListener('change', () => {
    asked = false;
  });
  document.addEventListener('pointerup', () => {
    if (asked || document.fullscreenElement) return;
    asked = true;
    goFullscreen();
  });
}

if (touchOnly) {
  notice.hidden = false;
  document.getElementById('play')!.addEventListener('click', () => {
    document.body.classList.add('touch');
    buildKeypad(document.getElementById('board-left')!, document.getElementById('board-right')!);
    goFullscreen();
    keepFullscreen();
    void start();
  });
  document.getElementById('anyway')!.addEventListener('click', () => void start());
} else void start();
