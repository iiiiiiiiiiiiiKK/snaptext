import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// `BASE_PATH` lets the same codebase ship to GitHub Pages (`/snaptext/`)
// and to a root-domain host (Cloudflare Pages, custom domain, local preview).
// The Pages workflow sets BASE_PATH=/snaptext/; local dev uses the default '/'.
const basePath = (process.env.BASE_PATH ?? '/') as string;

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
