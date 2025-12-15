import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Keep deps with browser/node conditional exports external
  // sharp is optional - users install it manually for better image processing
  external: ['fflate', 'sharp'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
