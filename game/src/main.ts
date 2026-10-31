import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource/pixelify-sans/latin-700.css';

const notice = document.getElementById('notice')!;
const anyway = document.getElementById('anyway')!;

/** Phones and tablets have no Esc, Tab or real typing, so they get a note instead of a broken game. */
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

if (touchOnly) {
  notice.hidden = false;
  anyway.addEventListener('click', () => void start());
} else void start();
