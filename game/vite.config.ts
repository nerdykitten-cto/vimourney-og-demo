import { defineConfig } from 'vite';

// base './' keeps asset URLs relative so the dist folder works on itch.io (served from a subpath).
export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
