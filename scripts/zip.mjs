import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'release/keyboard-mastery-web.zip');

mkdirSync(resolve(root, 'release'), { recursive: true });
rmSync(out, { force: true });
// itch.io needs index.html at the zip root, so zip from inside dist.
execFileSync('zip', ['-r', '-q', out, '.'], { cwd: resolve(root, 'app/dist'), stdio: 'inherit' });
console.log(`wrote ${out}`);
