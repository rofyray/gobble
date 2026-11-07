import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  test: { include: ['tests/engine/**/*.test.ts', 'tests/cli/**/*.test.ts'], testTimeout: 30000 },
});
