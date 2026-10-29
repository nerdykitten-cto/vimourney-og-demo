import type { EditorPackage, Engine } from '@kbm/shared';
import { cards } from './cards';
import { world1 } from './levels/world1';
import { world2 } from './levels/world2';
import { world3 } from './levels/world3';
import { world4 } from './levels/world4';
import { world5 } from './levels/world5';
import { world6 } from './levels/world6';
import { VimEngine } from './engine/vim';

export function createVimEngine(): Engine {
  return new VimEngine();
}

export const editor: EditorPackage = {
  id: 'vim',
  name: 'Vim',
  available: true,
  createEngine: createVimEngine,
  worlds: [world1, world2, world3, world4, world5, world6],
  cards,
};

export { VimEngine };
