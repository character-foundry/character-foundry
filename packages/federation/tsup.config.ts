import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', sync: 'src/sync.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
