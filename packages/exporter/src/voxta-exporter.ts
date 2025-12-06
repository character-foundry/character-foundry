/**
 * Voxta Exporter
 *
 * Exports character cards to Voxta (VoxPkg) format.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import { writeVoxta, type VoxtaWriteAsset } from '@character-foundry/voxta';
import type { ExportAsset, VoxtaExportOptions, ExportResult } from './types.js';
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
 * Map ExportAsset type to Voxta asset type
 */
function mapToVoxtaType(type: ExportAsset['type']): VoxtaWriteAsset['type'] {
  switch (type) {
    case 'icon':
    case 'emotion':
      return 'icon';
    case 'sound':
      return 'sound';
    default:
      return 'icon'; // Default to icon for unknown types
  }
}

/**
 * Convert ExportAsset to VoxtaWriteAsset
 */
function toVoxtaAsset(asset: ExportAsset): VoxtaWriteAsset {
  return {
    name: asset.name,
    type: mapToVoxtaType(asset.type),
    ext: asset.ext,
    data: asset.data,
    isMain: asset.isMain,
    tags: asset.tags,
  };
}

/**
 * Export card to Voxta format
 */
export function exportToVoxta(
  card: CCv3Data,
  assets: ExportAsset[],
  options: VoxtaExportOptions = {}
): ExportResult {
  const {
    characterId,
    packageId,
    compressionLevel = 6,
    includePackageJson = false,
    checkLoss = true,
  } = options;

  // Filter assets to only those Voxta supports
  const supportedAssets = assets.filter(
    (a) => a.type === 'icon' || a.type === 'emotion' || a.type === 'sound'
  );

  // Convert assets to Voxta format
  const voxtaAssets = supportedAssets.map(toVoxtaAsset);

  // Build Voxta package
  const result = writeVoxta(card, voxtaAssets, {
    characterId,
    packageId,
    compressionLevel,
    includePackageJson,
  });

  // Generate loss report if requested
  const lossReport = checkLoss ? checkExportLoss(card, assets, 'voxta') : undefined;

  const filename = `${sanitizeFilename(card.data.name)}.voxpkg`;

  return {
    buffer: result.buffer,
    format: 'voxta',
    filename,
    mimeType: 'application/zip',
    assetCount: result.assetCount,
    totalSize: result.totalSize,
    lossReport,
  };
}

/**
 * Async version of exportToVoxta
 */
export async function exportToVoxtaAsync(
  card: CCv3Data,
  assets: ExportAsset[],
  options: VoxtaExportOptions = {}
): Promise<ExportResult> {
  return exportToVoxta(card, assets, options);
}
