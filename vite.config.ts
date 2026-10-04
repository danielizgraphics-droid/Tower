import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produces one self-contained index.html (used for sharing the game as a single page).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
