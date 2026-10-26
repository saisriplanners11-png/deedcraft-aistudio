import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Ignore generated fixture checkouts; node:test suites run through their own scripts.
export default defineConfig(env => mergeConfig(viteConfig(env), {
  test: {
    include: ['*.test.ts', '*.test.mjs'],
    exclude: ['node_modules/**', 'tmp/**', 'dist/**', '.runtime/**'],
  },
}));
