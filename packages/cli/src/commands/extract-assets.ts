/**
 * Extract Assets Command
 *
 * Extract all assets with manifest.
 */

import { Command } from 'commander';
import { basename, dirname, join, resolve, relative } from 'node:path';
import { parseCard } from '@character-foundry/loader';
import { isPathSafe } from '@character-foundry/core/zip';
import { output, readFileBytes, writeFileBytes, writeJsonFile, handleError, EXIT_SUCCESS, formatSize } from '../utils/index.js';

interface ExtractOptions {
  json?: boolean;
  quiet?: boolean;
  dir?: string;
  manifest?: boolean;
}

interface AssetManifestEntry {
  name: string;
  type: string;
  ext: string;
  size: number;
  path: string;
  isMain?: boolean;
  characterId?: string;
  tags?: string[];
}

interface AssetManifest {
  card: string;
  extractedAt: string;
  assets: AssetManifestEntry[];
  totalSize: number;
}

/**
 * Validate that a path stays within the output directory (Zip Slip protection).
 * Returns the safe absolute path or throws if traversal is detected.
 *
 * @security This prevents path traversal attacks where malicious asset paths
 * like "../../etc/passwd" could write files outside the intended directory.
 */
function validateExtractPath(baseDir: string, entryPath: string): string {
  // First check using the core isPathSafe function
  if (!isPathSafe(entryPath)) {
    throw new Error(`Unsafe path detected: "${entryPath}" - potential path traversal attack`);
  }

  // Additional check: resolve and verify the path stays within baseDir
  const absolutePath = resolve(baseDir, entryPath);
  const relativePath = relative(baseDir, absolutePath);

  // If the relative path starts with '..' or is absolute, it's a traversal attempt
  if (relativePath.startsWith('..') || resolve(relativePath) === relativePath) {
    throw new Error(`Path traversal detected: "${entryPath}" resolves outside output directory`);
  }

  return absolutePath;
}

export function createExtractAssetsCommand(): Command {
  return new Command('extract-assets')
    .description('Extract all assets from a character card')
    .argument('<file>', 'Character card file')
    .option('--dir <path>', 'Output directory (default: ./[card-name]-assets)')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--no-manifest', 'Skip creating manifest.json')
    .action(async (file: string, opts: ExtractOptions) => {
      try {
        const data = await readFileBytes(file);
        const result = parseCard(data);

        if (result.assets.length === 0) {
          if (opts.json) {
            output.json({
              success: true,
              message: 'No assets found in card',
              assetCount: 0,
            });
          } else {
            output.info('No assets found in card', opts);
          }
          process.exit(EXIT_SUCCESS);
        }

        // Determine output directory
        const inputName = basename(file, basename(file).substring(basename(file).lastIndexOf('.')));
        const outputDir = opts.dir ?? join(dirname(file), `${inputName}-assets`);

        // Track extracted assets for manifest
        const manifestEntries: AssetManifestEntry[] = [];
        let totalSize = 0;

        // Extract each asset
        for (const asset of result.assets) {
          // Build filename - ensure extension
          let filename = asset.name;
          if (!filename.includes('.') && asset.ext) {
            filename = `${filename}.${asset.ext}`;
          }

          // Handle paths (preserve directory structure if present)
          // SECURITY: Validate paths to prevent Zip-Slip attacks
          let assetPath: string;
          if (asset.path && !asset.path.startsWith('pngchunk:')) {
            // Use original path structure with security validation
            assetPath = validateExtractPath(outputDir, asset.path);
          } else {
            assetPath = validateExtractPath(outputDir, filename);
          }

          // Write asset
          await writeFileBytes(assetPath, asset.data);
          totalSize += asset.data.length;

          // Track for manifest
          manifestEntries.push({
            name: asset.name,
            type: asset.type,
            ext: asset.ext,
            size: asset.data.length,
            path: assetPath,
            ...(asset.isMain && { isMain: true }),
            ...(asset.characterId && { characterId: asset.characterId }),
            ...(asset.tags && asset.tags.length > 0 && { tags: asset.tags }),
          });
        }

        // Write manifest
        const manifest: AssetManifest = {
          card: result.card.data.name,
          extractedAt: new Date().toISOString(),
          assets: manifestEntries,
          totalSize,
        };

        if (opts.manifest !== false) {
          const manifestPath = join(outputDir, 'manifest.json');
          await writeJsonFile(manifestPath, manifest);
        }

        if (opts.json) {
          output.json({
            success: true,
            outputDir,
            assetCount: result.assets.length,
            totalSize,
            assets: manifestEntries.map((a) => ({
              name: a.name,
              type: a.type,
              size: a.size,
              isMain: a.isMain,
            })),
          });
        } else {
          output.success(`Extracted ${result.assets.length} assets to ${outputDir}/`, opts);

          for (const entry of manifestEntries) {
            const mainLabel = entry.isMain ? ' (main)' : '';
            output.bullet(`${entry.name}${mainLabel} - ${formatSize(entry.size)}`, 2, opts);
          }

          if (opts.manifest !== false) {
            output.print('');
            output.info(`Created manifest: ${outputDir}/manifest.json`, opts);
          }
        }

        process.exit(EXIT_SUCCESS);
      } catch (err) {
        handleError(err, opts);
      }
    });
}
