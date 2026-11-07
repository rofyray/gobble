import { defineConfig } from 'tsup';
export default defineConfig({
  entry: { gobble: 'cli/gobble.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'bin',
  bundle: true,
  noExternal: [/.*/],
  outExtension: () => ({ js: '.mjs' }),
  banner: { js: '#!/usr/bin/env node' },
  clean: false,
});
