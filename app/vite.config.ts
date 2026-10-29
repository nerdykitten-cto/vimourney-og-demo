import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './' keeps asset URLs relative so the dist zip works on itch.io (served from a subpath).
export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: { target: 'es2020' },
});
