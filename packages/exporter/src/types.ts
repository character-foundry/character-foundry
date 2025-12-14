/**
 * Exporter Types
 *
 * Types for the universal card exporter API.
 */

import type { BinaryData } from '@character-foundry/core';
import type { CCv3Data, SourceFormat } from '@character-foundry/schemas';

/**
 * Target export format
 */
export type ExportFormat = 'png' | 'charx' | 'voxta';

/**
 * Asset to include in export
 */
export interface ExportAsset {
  /** Asset name/identifier */
  name: string;
  /** Asset type */
  type: 'icon' | 'emotion' | 'background' | 'sound' | 'data' | 'custom';
  /** File extension */
  ext: string;
  /** Binary data */
  data: BinaryData;
  /** Whether this is the main/primary asset (used for PNG embedding) */
  isMain?: boolean;
  /** Original path or source identifier (e.g., pngchunk:0) */
  path?: string;
  /** Additional tags for categorization */
  tags?: string[];
}

/**
 * Loss report for export
 */
export interface ExportLossReport {
  /** Fields that will be lost */
  lostFields: string[];
  /** Assets that cannot be exported */
  lostAssets: string[];
  /** Warnings about potential issues */
  warnings: string[];
  /** Target format */
  targetFormat: ExportFormat;
  /** Whether export is lossless */
  isLossless: boolean;
}

/**
 * Common export options
 */
export interface ExportOptionsBase {
  /** Whether to check for loss before export (default: true) */
  checkLoss?: boolean;
  /** Compression level for ZIP-based formats (0-9, default: 6) */
  compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

/**
 * PNG export options
 */
export interface PngExportOptions extends ExportOptionsBase {
  /** Chunk key to use (default: 'chara' for v2 compat, 'ccv3' for v3) */
  chunkKey?: 'chara' | 'ccv3' | 'chara_card_v3';
  /** Whether to use zTXt (compressed) chunk (default: true for large cards) */
  useCompression?: boolean;
  /** Export as v2 format for maximum compatibility (default: false) */
  exportAsV2?: boolean;
}

/**
 * CharX export options
 */
export interface CharxExportOptions extends ExportOptionsBase {
  /** Target spec: 'v3' = standard, 'risu' = include x_meta */
  spec?: 'v3' | 'risu';
  /** Include readme.txt (default: false) */
  includeReadme?: boolean;
  /** Emit x_meta for image assets (default: false, auto-enabled for risu spec) */
  emitXMeta?: boolean;
  /** Risu module.risum binary to include (opaque, preserved from read) */
  moduleRisum?: BinaryData;
}

/**
 * Voxta export options
 */
export interface VoxtaExportOptions extends ExportOptionsBase {
  /** Character ID to use (auto-generated if not provided) */
  characterId?: string;
  /** Package ID to use (auto-generated if not provided) */
  packageId?: string;
  /** Include package.json metadata (default: false) */
  includePackageJson?: boolean;
}

/**
 * Export options union
 */
export type ExportOptions = PngExportOptions | CharxExportOptions | VoxtaExportOptions;

/**
 * Result of exporting a card
 */
export interface ExportResult {
  /** The exported binary data */
  buffer: BinaryData;
  /** Target format that was used */
  format: ExportFormat;
  /** Suggested filename */
  filename: string;
  /** MIME type for the export */
  mimeType: string;
  /** Number of assets included */
  assetCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Loss report (if checkLoss was enabled) */
  lossReport?: ExportLossReport;
}

/**
 * Pre-export check result
 */
export interface PreExportCheck {
  /** Whether export can proceed */
  canExport: boolean;
  /** Loss report */
  lossReport: ExportLossReport;
  /** Suggested alternatives if current format has significant loss */
  suggestedFormats?: ExportFormat[];
}
