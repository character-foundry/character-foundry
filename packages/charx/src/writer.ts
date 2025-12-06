/**
 * CharX Writer
 *
 * Creates .charx (ZIP-based character card) files.
 */

import { zipSync, type Zippable } from 'fflate';
import {
  type BinaryData,
  fromString,
  getMimeTypeFromExt,
} from '@character-foundry/core';
import type { CCv3Data, AssetDescriptor } from '@character-foundry/schemas';
import type {
  CharxWriteAsset,
  CharxWriteOptions,
  CharxBuildResult,
  CompressionLevel,
} from './types.js';

/**
 * Get CharX category from MIME type
 */
function getCharxCategory(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'other';
}

/**
 * Sanitize a name for use in file paths
 */
function sanitizeName(name: string, ext: string): string {
  let safeName = name;

  // Strip extension if present
  if (safeName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    safeName = safeName.substring(0, safeName.length - (ext.length + 1));
  }

  // Replace dots and underscores with hyphens, remove special chars, collapse dashes
  safeName = safeName
    .replace(/[._]/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!safeName) safeName = 'asset';

  return safeName;
}

/**
 * Build a CharX ZIP from card data and assets
 */
export function writeCharX(
  card: CCv3Data,
  assets: CharxWriteAsset[],
  options: CharxWriteOptions = {}
): CharxBuildResult {
  const {
    spec = 'v3',
    compressionLevel = 6,
    emitXMeta = spec === 'risu',
    emitReadme = false,
  } = options;

  // Transform card to use embeded:// URIs
  const transformedCard = transformAssetUris(card, assets);

  // Create ZIP entries
  const zipEntries: Zippable = {};

  // Add card.json
  const cardJson = JSON.stringify(transformedCard, null, 2);
  zipEntries['card.json'] = [fromString(cardJson), { level: compressionLevel as CompressionLevel }];

  // Add readme.txt if requested
  if (emitReadme) {
    const readme = `Character: ${card.data.name}
Created with Character Foundry

This is a CharX character card package.
Import this file into SillyTavern, RisuAI, or other compatible applications.
`;
    zipEntries['readme.txt'] = [fromString(readme), { level: compressionLevel as CompressionLevel }];
  }

  // Add assets
  let assetCount = 0;

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]!;
    const mimetype = getMimeTypeFromExt(asset.ext);
    const category = getCharxCategory(mimetype);
    const safeName = sanitizeName(asset.name, asset.ext);

    const assetPath = `assets/${asset.type}/${category}/${safeName}.${asset.ext}`;

    zipEntries[assetPath] = [asset.data, { level: compressionLevel as CompressionLevel }];
    assetCount++;

    // Add x_meta if enabled and it's an image
    if (emitXMeta && mimetype.startsWith('image/')) {
      const metaJson = JSON.stringify({
        type: mimetype.split('/')[1]?.toUpperCase() || 'PNG',
      });
      zipEntries[`x_meta/${i}.json`] = [fromString(metaJson), { level: compressionLevel as CompressionLevel }];
    }
  }

  // Create ZIP
  const buffer = zipSync(zipEntries);

  return {
    buffer,
    assetCount,
    totalSize: buffer.length,
  };
}

/**
 * Transform asset URIs in card to use embeded:// format
 */
function transformAssetUris(card: CCv3Data, assets: CharxWriteAsset[]): CCv3Data {
  // Clone the card to avoid mutations
  const transformed: CCv3Data = JSON.parse(JSON.stringify(card));

  // Generate assets array from provided assets
  transformed.data.assets = assets.map((asset): AssetDescriptor => {
    const mimetype = getMimeTypeFromExt(asset.ext);
    const category = getCharxCategory(mimetype);
    const safeName = sanitizeName(asset.name, asset.ext);

    return {
      type: asset.type as AssetDescriptor['type'],
      uri: `embeded://assets/${asset.type}/${category}/${safeName}.${asset.ext}`,
      name: safeName,
      ext: asset.ext,
    };
  });

  return transformed;
}

/**
 * Async version of writeCharX
 */
export async function writeCharXAsync(
  card: CCv3Data,
  assets: CharxWriteAsset[],
  options: CharxWriteOptions = {}
): Promise<CharxBuildResult> {
  // For now, just wrap sync version
  return writeCharX(card, assets, options);
}
