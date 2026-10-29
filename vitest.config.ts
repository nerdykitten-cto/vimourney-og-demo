import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Differential tests shell out to real Vim hundreds of times.
    testTimeout: 300_000,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
