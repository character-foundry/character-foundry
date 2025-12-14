/**
 * Universal Card Exporter
 *
 * Exports character cards to any supported format.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import { FormatNotSupportedError } from '@character-foundry/core';
import { exportToPng, exportToPngAsync } from './png-exporter.js';
import { exportToCharx, exportToCharxAsync } from './charx-exporter.js';
import { exportToVoxta, exportToVoxtaAsync } from './voxta-exporter.js';
import type {
  ExportFormat,
  ExportAsset,
  ExportResult,
  PngExportOptions,
  CharxExportOptions,
  VoxtaExportOptions,
} from './types.js';

/**
 * Options for exportCard function
 */
export interface ExportCardOptions {
  /** Target format */
  format: ExportFormat;
  /** Format-specific options */
  png?: PngExportOptions;
  charx?: CharxExportOptions;
  voxta?: VoxtaExportOptions;
}

/**
 * Export a character card to any supported format
 *
 * @param card - CCv3 card data to export
 * @param assets - Assets to include in export
 * @param options - Export options including target format
 * @returns ExportResult with buffer and metadata
 */
export function exportCard(
  card: CCv3Data,
  assets: ExportAsset[],
  options: ExportCardOptions
): ExportResult {
  switch (options.format) {
    case 'png':
      return exportToPng(card, assets, options.png);

    case 'charx':
      return exportToCharx(card, assets, options.charx);

    case 'voxta':
      return exportToVoxta(card, assets, options.voxta);

    default:
      throw new FormatNotSupportedError(options.format as string);
  }
}

/**
 * Async version of exportCard
 */
export async function exportCardAsync(
  card: CCv3Data,
  assets: ExportAsset[],
  options: ExportCardOptions
): Promise<ExportResult> {
  switch (options.format) {
    case 'png':
      return exportToPngAsync(card, assets, options.png);

    case 'charx':
      return exportToCharxAsync(card, assets, options.charx);

    case 'voxta':
      return exportToVoxtaAsync(card, assets, options.voxta);

    default:
      throw new FormatNotSupportedError(options.format as string);
  }
}

/**
 * Get supported export formats
 */
export function getSupportedFormats(): ExportFormat[] {
  return ['png', 'charx', 'voxta'];
}

/**
 * Get file extension for a format
 */
export function getFormatExtension(format: ExportFormat): string {
  switch (format) {
    case 'png':
      return 'png';
    case 'charx':
      return 'charx';
    case 'voxta':
      return 'voxpkg';
    default:
      throw new FormatNotSupportedError(format);
  }
}

/**
 * Get MIME type for a format
 */
export function getFormatMimeType(format: ExportFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'charx':
    case 'voxta':
      return 'application/zip';
    default:
      throw new FormatNotSupportedError(format);
  }
}
