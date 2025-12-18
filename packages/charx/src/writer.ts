/**
 * CharX Writer
 *
 * Creates .charx (ZIP-based character card) files.
 */

import { zipSync, type Zippable } from 'fflate';
import {
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

/** Safe asset types for CharX path construction (whitelist) */
const SAFE_ASSET_TYPES = new Set([
  'icon', 'user_icon', 'emotion', 'background', 'sound', 'video',
  'custom', 'x-risu-asset', 'data', 'unknown',
]);

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
 * Sanitize an asset type for safe use in file paths.
 * Only allows whitelisted types to prevent path traversal.
 */
function sanitizeAssetType(type: string): string {
  // Normalize to lowercase
  const normalized = type.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

  // Use whitelist - if not in whitelist, default to 'custom'
  if (SAFE_ASSET_TYPES.has(normalized)) {
    return normalized;
  }

  // For unknown types, sanitize strictly
  const sanitized = normalized.replace(/[^a-z0-9]/g, '');
  return sanitized || 'custom';
}

/**
 * Sanitize a file extension for safe use in file paths.
 *
 * @remarks
 * CharX assets may be arbitrary file types (including scripts/text). We validate
 * for path-safety and normalize minimally, rather than coercing unknown
 * extensions to `.bin`.
 */
function sanitizeExtension(ext: string): string {
  const normalized = ext.trim().replace(/^\./, '').toLowerCase();

  if (!normalized) {
    throw new Error('Invalid asset extension: empty extension');
  }

  if (normalized.length > 64) {
    throw new Error(`Invalid asset extension: too long (${normalized.length} chars)`);
  }

  // Prevent zip path traversal / separators
  if (normalized.includes('/') || normalized.includes('\\') || normalized.includes('\0')) {
    throw new Error('Invalid asset extension: path separators are not allowed');
  }

  // Conservative filename safety while still allowing common multi-part extensions (e.g. tar.gz)
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw new Error(`Invalid asset extension: "${ext}"`);
  }

  return normalized;
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
    moduleRisum,
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
    // SECURITY: Sanitize all path components to prevent path traversal
    const safeType = sanitizeAssetType(asset.type);
    const safeExt = sanitizeExtension(asset.ext);
    const mimetype = getMimeTypeFromExt(safeExt);
    const category = getCharxCategory(mimetype);
    const safeName = sanitizeName(asset.name, safeExt);

    const assetPath = `assets/${safeType}/${category}/${safeName}.${safeExt}`;

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

  // Add module.risum for Risu format (opaque preservation)
  if (moduleRisum) {
    zipEntries['module.risum'] = [moduleRisum, { level: compressionLevel as CompressionLevel }];
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
  // Note: Using structuredClone where available for better performance and preserving undefined
  const transformed: CCv3Data = typeof structuredClone === 'function'
    ? structuredClone(card)
    : JSON.parse(JSON.stringify(card));

  // Generate assets array from provided assets
  transformed.data.assets = assets.map((asset): AssetDescriptor => {
    // SECURITY: Sanitize all path components to prevent path traversal
    const safeType = sanitizeAssetType(asset.type);
    const safeExt = sanitizeExtension(asset.ext);
    const mimetype = getMimeTypeFromExt(safeExt);
    const category = getCharxCategory(mimetype);
    const safeName = sanitizeName(asset.name, safeExt);

    return {
      type: asset.type as AssetDescriptor['type'],
      uri: `embeded://assets/${safeType}/${category}/${safeName}.${safeExt}`,
      name: safeName,
      ext: safeExt,
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
