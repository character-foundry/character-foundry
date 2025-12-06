/**
 * CharX Exporter
 *
 * Exports character cards to CharX (ZIP) format.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import { writeCharX, type CharxWriteAsset } from '@character-foundry/charx';
import type { ExportAsset, CharxExportOptions, ExportResult } from './types.js';
import { checkExportLoss } from './loss-checker.js';

/**
 * Sanitize filename for safe filesystem use
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100) || 'character';
}

/**
 * Convert ExportAsset to CharxWriteAsset
 */
function toCharxAsset(asset: ExportAsset): CharxWriteAsset {
  return {
    name: asset.name,
    type: asset.type,
    ext: asset.ext,
    data: asset.data,
    isMain: asset.isMain,
  };
}

/**
 * Export card to CharX format
 */
export function exportToCharx(
  card: CCv3Data,
  assets: ExportAsset[],
  options: CharxExportOptions = {}
): ExportResult {
  const {
    spec = 'v3',
    compressionLevel = 6,
    includeReadme = false,
    emitXMeta,
    checkLoss = true,
  } = options;

  // Convert assets to CharX format
  const charxAssets = assets.map(toCharxAsset);

  // Build CharX
  const result = writeCharX(card, charxAssets, {
    spec,
    compressionLevel,
    emitReadme: includeReadme,
    emitXMeta: emitXMeta ?? (spec === 'risu'),
  });

  // Generate loss report if requested
  const lossReport = checkLoss ? checkExportLoss(card, assets, 'charx') : undefined;

  const filename = `${sanitizeFilename(card.data.name)}.charx`;

  return {
    buffer: result.buffer,
    format: 'charx',
    filename,
    mimeType: 'application/zip',
    assetCount: result.assetCount,
    totalSize: result.totalSize,
    lossReport,
  };
}

/**
 * Async version of exportToCharx
 */
export async function exportToCharxAsync(
  card: CCv3Data,
  assets: ExportAsset[],
  options: CharxExportOptions = {}
): Promise<ExportResult> {
  return exportToCharx(card, assets, options);
}
