/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// The poe-server `[web] bind` address (config/server.toml). Override with POE_API_TARGET.
const target = process.env.POE_API_TARGET ?? 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [svelte()],
  // Relative asset URLs: the SPA uses hash routes, so it works from any mount point.
  base: './',
  server: {
    proxy: {
      '/api': { target, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
