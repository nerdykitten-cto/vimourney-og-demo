import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource/pixelify-sans/latin-700.css';
import { buildKeypad } from './keypad';

const notice = document.getElementById('notice')!;

/** Phones and tablets get a start screen first: going fullscreen and sideways needs a tap. */
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

/** iPhones refuse both of these, so the game also has to work without them. */
async function goSideways(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen?.();
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch {
    // The rotate prompt covers this.
  }
}

if (touchOnly) {
  notice.hidden = false;
  document.getElementById('play')!.addEventListener('click', () => {
    document.body.classList.add('touch');
    buildKeypad(document.getElementById('left')!, document.getElementById('right')!);
    void goSideways();
    void start();
  });
  document.getElementById('anyway')!.addEventListener('click', () => void start());
} else void start();
