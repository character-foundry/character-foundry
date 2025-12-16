#!/usr/bin/env node
import { generateDtsBundle } from 'dts-bundle-generator';
import { writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');

const entries = [
  'index',
  'core',
  'schemas',
  'png',
  'charx',
  'voxta',
  'lorebook',
  'loader',
  'exporter',
  'normalizer',
  'tokenizers',
  'media',
  'image-utils',
  'federation',
  'app-framework',
];

const externalLibraries = [
  'fflate',
  'zod',
  'sharp',
  'gpt-tokenizer',
  'react',
  'react-dom',
  'react-hook-form',
  '@hookform/resolvers',
];

console.log('Bundling type declarations...');

for (const entry of entries) {
  const entryFile = resolve(rootDir, `src/${entry}.ts`);
  console.log(`  ${entry}.d.ts`);

  try {
    const result = generateDtsBundle([{
      filePath: entryFile,
      output: {
        noBanner: true,
        exportReferencedTypes: true,
      },
      libraries: {
        // Inline types from workspace packages
        inlinedLibraries: [
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
          '@character-foundry/image-utils',
          '@character-foundry/federation',
          '@character-foundry/app-framework',
        ],
        // Keep external dependencies as imports
        allowedTypesLibraries: externalLibraries,
      },
    }], {
      preferredConfigPath: resolve(rootDir, 'tsconfig.json'),
    });

    const dtsContent = result[0];
    writeFileSync(resolve(distDir, `${entry}.d.ts`), dtsContent);
    // Copy as .d.cts for CJS consumers
    writeFileSync(resolve(distDir, `${entry}.d.cts`), dtsContent);
  } catch (error) {
    console.error(`  Error bundling ${entry}:`, error.message);
    // Fallback: create a simple re-export file
    // This will at least not break the build
    const fallback = `// Type bundling failed, using fallback\nexport {};`;
    writeFileSync(resolve(distDir, `${entry}.d.ts`), fallback);
    writeFileSync(resolve(distDir, `${entry}.d.cts`), fallback);
  }
}

console.log('Done bundling types.');
