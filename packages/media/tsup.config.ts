import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  // sharp is optional and has Node-only native bindings; leave it for the
  // consuming runtime rather than bundling it into browser-compatible output.
  external: ['sharp'],
});
