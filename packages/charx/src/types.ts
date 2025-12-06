/**
 * CharX Types
 *
 * Type definitions for CharX format handling.
 */

import type { BinaryData } from '@character-foundry/core';
import type { CCv3Data, AssetDescriptor } from '@character-foundry/schemas';

/**
 * Valid compression levels for fflate
 */
export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * x_meta entry (PNG chunk metadata preservation)
 */
export interface CharxMetaEntry {
  type?: string;  // e.g., 'WEBP', 'PNG', 'JPEG'
  [key: string]: unknown;
}

/**
 * Asset info from CharX extraction
 */
export interface CharxAssetInfo {
  /** Path within ZIP (e.g., 'assets/icon/image/1.png') */
  path: string;
  /** Corresponding asset descriptor from card.json */
  descriptor: AssetDescriptor;
  /** Binary data (undefined if not found in ZIP) */
  buffer?: BinaryData;
}

/**
 * Complete extracted CharX data
 */
export interface CharxData {
  /** card.json content */
  card: CCv3Data;
  /** All assets extracted from ZIP */
  assets: CharxAssetInfo[];
  /** x_meta/*.json files */
  metadata?: Map<number, CharxMetaEntry>;
  /** module.risum binary data (preserved as opaque blob) */
  moduleRisum?: BinaryData;
  /** Whether this is a Risu-format CharX */
  isRisuFormat: boolean;
}

/**
 * Options for CharX extraction
 */
export interface CharxReadOptions {
  /** Max size for card.json in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Max size for individual assets (default: 50MB) */
  maxAssetSize?: number;
  /** Max total size of all content (default: 200MB) */
  maxTotalSize?: number;
  /** Preserve x_meta folder (default: true) */
  preserveXMeta?: boolean;
  /** Preserve module.risum (default: true) */
  preserveModuleRisum?: boolean;
}

/**
 * Asset to include in CharX export
 */
export interface CharxWriteAsset {
  /** Asset type (icon, background, emotion, etc.) */
  type: string;
  /** Asset name (without extension) */
  name: string;
  /** File extension */
  ext: string;
  /** Binary data of the asset */
  data: BinaryData;
  /** Whether this is the main asset of its type */
  isMain?: boolean;
}

/**
 * Options for building CharX
 */
export interface CharxWriteOptions {
  /** Target spec: 'v3' = standard, 'risu' = include x_meta */
  spec?: 'v3' | 'risu';
  /** Compression level (0-9, default: 6) */
  compressionLevel?: CompressionLevel;
  /** Emit x_meta for image assets (default: false, true for risu spec) */
  emitXMeta?: boolean;
  /** Include readme.txt (default: false) */
  emitReadme?: boolean;
}

/**
 * Result of building a CharX file
 */
export interface CharxBuildResult {
  /** The CharX ZIP buffer */
  buffer: BinaryData;
  /** Number of assets included */
  assetCount: number;
  /** Total size of the CharX */
  totalSize: number;
}

/**
 * Function to fetch remote assets
 */
export type AssetFetcher = (url: string) => Promise<BinaryData | undefined>;
