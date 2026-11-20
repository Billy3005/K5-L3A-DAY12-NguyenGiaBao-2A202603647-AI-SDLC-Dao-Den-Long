import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist/web', emptyOutDir: true },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
