/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// dist/build.json: which build of the web admin this is. The server logs it at start
// (version, build time, commit), and `cargo xtask server` of the hub compares the build time
// with the sources to decide whether to rebuild.
function buildInfo(): Plugin {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  let commit: string | null = null;
  let dirty = false;
  try {
    commit = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    dirty = execSync('git status --porcelain -- src index.html public', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim() !== '';
  } catch {
    // Not a git checkout (a source archive): no commit.
  }
  return {
    name: 'build-info',
    generateBundle() {
      const info = {
        name: pkg.name,
        version: pkg.version,
        built_at: new Date().toISOString(),
        commit,
        dirty,
      };
      this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify(info, null, 2) + '\n' });
    },
  };
}

// The poe-server `[web] bind` address (config/server.toml). Override with POE_API_TARGET.
const target = process.env.POE_API_TARGET ?? 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [svelte(), buildInfo()],
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
