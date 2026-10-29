import { describe, it } from 'vitest';
import { compareAll } from './table';
import { hasVim } from './vimRunner';

const suite = hasVim ? describe : describe.skip;

suite('undo, redo and dot repeat match real Vim', () => {
  it('undo', () => {
    compareAll(['dwu', 'ddu', '2ddu', 'xu', 'xxuu', 'cwab<Esc>u', 'oab<Esc>u', 'Oab<Esc>u', 'Aab<Esc>u', 'Jup', 'pu', 'ddjpu', 'dwdwu', 'dwdwuu', 'yyu', 'ia<Esc>ib<Esc>u', 'dwu<C-r>', 'dwdwuu<C-r>', 'xuu', 'u<C-r>'], { stride: 4 });
  });

  it('dot repeat', () => {
    compareAll(['x.', '3x.', 'x3.', 'dw.', 'dw..', 'd2w.', 'dd.', 'cwab<Esc>w.', 'cwab<Esc>w2.', 'Aab<Esc>j.', 'oab<Esc>.', '3oab<Esc>.', 'ia<Esc>l.', 'J.', 'rxl.', '~.', 'p.', 'ddp.', 'C!<Esc>j.', 'S!<Esc>j.', 'Ia<Esc>j.', 'yy.', 'dwu.', 'ciwab<Esc>w.', 'daw.'], { stride: 4 });
  });
});
