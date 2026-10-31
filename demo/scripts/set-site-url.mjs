// Link previews on Discord need an absolute image URL, and the site's address is only known at deploy
// time. Vercel runs this during the build. It never fails the deploy: the game itself does not need it.
import { readFileSync, writeFileSync } from 'node:fs';

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const file = new URL('../public/index.html', import.meta.url);
try {
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, html.replaceAll('__SITE_URL__', host ? `https://${host}` : '.'));
  console.log(`Preview links point at ${host ?? 'relative paths'}`);
} catch (err) {
  console.warn('Could not set the site URL:', err);
}
