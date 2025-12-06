/**
 * @character-foundry/exporter
 *
 * Universal character card exporter - export to PNG, CharX, or Voxta formats.
 */

// Types
export type {
  ExportFormat,
  ExportAsset,
  ExportLossReport,
  ExportOptionsBase,
  PngExportOptions,
  CharxExportOptions,
  VoxtaExportOptions,
  ExportOptions,
  ExportResult,
  PreExportCheck,
} from './types.js';

// Main exporter
export {
  exportCard,
  exportCardAsync,
  getSupportedFormats,
  getFormatExtension,
  getFormatMimeType,
  type ExportCardOptions,
} from './exporter.js';

// Format-specific exporters
export {
  exportToPng,
  exportToPngAsync,
} from './png-exporter.js';

export {
  exportToCharx,
  exportToCharxAsync,
} from './charx-exporter.js';

export {
  exportToVoxta,
  exportToVoxtaAsync,
} from './voxta-exporter.js';

// Loss checking
export {
  checkExportLoss,
  preExportCheck,
  formatLossReport,
} from './loss-checker.js';
