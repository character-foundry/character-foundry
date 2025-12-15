import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core.ts',
    schemas: 'src/schemas.ts',
    png: 'src/png.ts',
    charx: 'src/charx.ts',
    voxta: 'src/voxta.ts',
    lorebook: 'src/lorebook.ts',
    loader: 'src/loader.ts',
    exporter: 'src/exporter.ts',
    normalizer: 'src/normalizer.ts',
    tokenizers: 'src/tokenizers.ts',
    media: 'src/media.ts',
    federation: 'src/federation.ts',
    'app-framework': 'src/app-framework.ts',
  },
  format: ['esm', 'cjs'],
  // Disable tsup's dts - we'll use dts-bundle-generator instead
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Bundle all workspace packages - they won't be published separately
  noExternal: [
    '@character-foundry/core',
    '@character-foundry/schemas',
    '@character-foundry/png',
    '@character-foundry/charx',
    '@character-foundry/voxta',
    '@character-foundry/lorebook',
    '@character-foundry/loader',
    '@character-foundry/exporter',
    '@character-foundry/normalizer',
    '@character-foundry/tokenizers',
    '@character-foundry/media',
    '@character-foundry/federation',
    '@character-foundry/app-framework',
  ],
  // External dependencies that consumers should install themselves
  // These are NOT bundled - they have their own browser/node handling
  // or are peer dependencies that consumers provide
  external: [
    // Has browser/node conditional exports - consumer's bundler resolves
    'fflate',
    // Runtime validation library - should be installed by consumer
    'zod',
    // Optional image processing - node-only
    'sharp',
    // Tokenizer library
    'gpt-tokenizer',
    // React peer dependencies for app-framework
    'react',
    'react-dom',
    'react-hook-form',
    '@hookform/resolvers',
  ],
  // Ensure we use the 'browser' field exports when bundling
  platform: 'neutral',
  // Don't tree-shake - we want full re-exports
  treeshake: false,
});
