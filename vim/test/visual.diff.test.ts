import { describe, it } from 'vitest';
import { compareAll } from './table';
import { hasVim } from './vimRunner';

const suite = hasVim ? describe : describe.skip;

suite('visual modes match real Vim', () => {
  it('charwise v', () => {
    compareAll(['vd', 'vly', 'vwd', 'vey', 'v$d', 'v$y', 'v0d', 'vjd', 'vkd', 'vjly', 'vlc!<Esc>', 'vwx', 'vwohd', 'vlr.', 'vl~', 'vlu', 'vlU', 'vwJ', 'vjJ', 'vlyP', 'vlyjvlp', 'vlyjvlP', 'vf,d', 'vt)d', 'v}d', 'vGd', 'vlod', 'vlooly', 'vv', 'vl<Esc>x'], { stride: 4 });
  });

  it('linewise V', () => {
    compareAll(['Vd', 'Vy', 'Vyp', 'Vjd', 'Vkd', 'V2jd', 'Vjy', 'Vc!<Esc>', 'Vjc!<Esc>', 'V~', 'Vju', 'VjU', 'VjJ', 'VJ', 'Vr.', 'Vjr.', 'Vx', 'VD', 'VY', 'VC!<Esc>', 'VS!<Esc>', 'Vyjp', 'VyjVp', 'VyjvlP', 'Vo2jd', 'Vv'], { stride: 4 });
  });

  it('blockwise <C-v>', () => {
    compareAll(['<C-v>d', '<C-v>ld', '<C-v>jd', '<C-v>jld', '<C-v>jly', '<C-v>jlyP', '<C-v>jlyp', '<C-v>j$d', '<C-v>j$y', '<C-v>jIa<Esc>', '<C-v>jAa<Esc>', '<C-v>j$Aa<Esc>', '<C-v>jlc!<Esc>', '<C-v>jlr.', '<C-v>jl~', '<C-v>jlU', '<C-v>jlod', '<C-v>jlOd', '<C-v>j2ld', '<C-v>jD', '<C-v>jX', '<C-v>jC!<Esc>'], { buffers: [3, 5], stride: 2 });
  });

  it('text objects in visual mode', () => {
    compareAll(['viwd', 'vawd', 'viWd', 'vawy', 'vip', 'vipd', 'vapd', 'vi(d', 'va(d', 'vi{d', 'va{d', 'vi[d', 'vi"d', 'va"d', 'viwiwd', 'vawawd', 'vi(i(d', 'va(a(d', 'vipipd', 'vapapd'], { buffers: [0, 2, 5], stride: 3 });
  });

  it('visual dot repeat', () => {
    compareAll(['vld.', 'Vjd.', 'vlc!<Esc>j.', 'vlU.', '<C-v>jld.', 'vwd2.'], { buffers: [1, 3], stride: 4 });
  });
});
