import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Externalize peer dependencies - consumer's bundler will resolve them
  // This enables deduplication and smaller app bundles
  external: [
    'react',
    'react-dom',
    'react-hook-form',
    '@hookform/resolvers',
    '@hookform/resolvers/zod',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
