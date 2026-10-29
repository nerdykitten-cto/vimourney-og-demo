import { describe, it } from 'vitest';
import { compareAll } from './table';
import { hasVim } from './vimRunner';

const suite = hasVim ? describe : describe.skip;

suite('operators and edits match real Vim', () => {
  it('delete with motions', () => {
    compareAll(['dw', 'd2w', 'db', 'de', 'dW', 'dB', 'dE', 'd$', 'd0', 'd^', 'dh', 'dl', 'dj', 'dk', 'dG', 'dgg', 'd}', 'd{', 'df,', 'dt)', 'dF(', 'dT(', 'd%', 'd3l', 'dge', 'd2j'], { stride: 3 });
  });

  it('change with motions', () => {
    compareAll(['cwX<Esc>', 'cWX<Esc>', 'c2wX<Esc>', 'ceX<Esc>', 'cbX<Esc>', 'c$X<Esc>', 'c0X<Esc>', 'cjX<Esc>', 'ckX<Esc>', 'cf,X<Esc>', 'ct)X<Esc>', 'c}X<Esc>', 'cc'+'X<Esc>', '3ccX<Esc>'], { stride: 3 });
  });

  it('yank and put', () => {
    compareAll(['ywP', 'ywp', 'y$p', 'yyp', 'yyP', '2yyp', 'yjP', 'ykp', 'y}P', 'y2wP', 'yiwP', 'yyjp', 'yl3p', 'yw2P', 'Yp', 'xp', 'ddp', 'ddP', 'dwwP'], { stride: 3 });
  });

  it('single-key edits', () => {
    compareAll(['x', '3x', 'X', '3X', 'D', 'C!<Esc>', 's!<Esc>', '3s!<Esc>', 'S!<Esc>', 'J', '3J', '~', '5~', 'rx', '3rx', 'r<CR>', 'ia<Esc>', '3ia<Esc>', 'Ia<Esc>', 'Aa<Esc>', '3Aa<Esc>', 'oa<Esc>', 'Oa<Esc>', '3oa<Esc>', 'Oa<CR>b<Esc>', 'ia<BS><BS><Esc>'], { stride: 3 });
  });

  it('registers', () => {
    compareAll(['"ayw"ap', '"ayy"ap', '"ayw"Ayw"ap', '"add"ap', '"_dd"1p', 'yy"_ddp', 'dwdwdw"1p"2p', 'dddd"1p"2pu', '"ayy"byy"bp"ap', 'ywdd"0p', 'yy3dd"0p'], { stride: 4 });
  });

  it('counts', () => {
    compareAll(['2d3w', '3d2w', '2dd', '10dd', '3dj', '2yyP', '2x2x', '2D', '2C!<Esc>', '2J', '99J', '2S!<Esc>', '5l', '2dl', '9dl'], { stride: 4 });
  });
});
