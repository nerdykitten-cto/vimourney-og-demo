import { describe, expect, it } from 'vitest';
import { SHARED_VERSION } from '@kbm/shared';
import { editor } from './index';

describe('workspace wiring', () => {
  it('vim package resolves shared package', () => {
    expect(SHARED_VERSION).toBe('0.0.0');
    expect(editor.id).toBe('vim');
  });
});
