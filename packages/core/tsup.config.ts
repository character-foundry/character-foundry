import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/zip.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Keep fflate external - it has browser/node conditional exports
  // that the consumer's bundler should resolve
  external: ['fflate'],
});
