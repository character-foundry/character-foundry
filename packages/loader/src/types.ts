/**
 * Loader Types
 *
 * Types for the universal card loader API.
 */

import type { BinaryData } from '@character-foundry/core';
import type { CCv3Data, Spec, SourceFormat } from '@character-foundry/schemas';

// Re-export for convenience
export type { Spec, SourceFormat };

/**
 * Detected container format (the file type)
 */
export type ContainerFormat = 'png' | 'charx' | 'voxta' | 'json' | 'unknown';

/**
 * Asset extracted from a card
 */
export interface ExtractedAsset {
  /** Asset name/identifier */
  name: string;
  /** Asset type */
  type: 'icon' | 'emotion' | 'background' | 'sound' | 'data' | 'unknown';
  /** File extension */
  ext: string;
  /** Binary data */
  data: BinaryData;
  /** Asset path within archive (if applicable) */
  path?: string;
  /** Whether this is the main/primary asset */
  isMain?: boolean;
  /** Associated character ID (for multi-character packages) */
  characterId?: string;
  /** Additional tags */
  tags?: string[];
}

/**
 * Result of parsing a character card
 */
export interface ParseResult {
  /** Normalized card data in CCv3 format */
  card: CCv3Data;
  /** Extracted assets */
  assets: ExtractedAsset[];
  /** Original container format */
  containerFormat: ContainerFormat;
  /** Detected spec version */
  spec: Spec;
  /** Original source format indicator */
  sourceFormat: SourceFormat;
  /** The raw JSON object before normalization */
  originalShape: unknown;
  /** Raw JSON string (if available) */
  rawJson?: string;
  /** Original file buffer */
  rawBuffer: BinaryData;
  /** Additional metadata from container */
  metadata?: {
    /** Character ID (for Voxta/CharX) */
    characterId?: string;
    /** Package ID (for Voxta) */
    packageId?: string;
    /** Creation date */
    dateCreated?: string;
    /** Modification date */
    dateModified?: string;
  };
}

/**
 * Options for the parseCard function
 */
export interface ParseOptions {
  /** Maximum file size to process (default: 50MB) */
  maxFileSize?: number;
  /** Maximum individual asset size (default: 50MB) */
  maxAssetSize?: number;
  /** Maximum total size for archives (default: 500MB) */
  maxTotalSize?: number;
  /** Whether to extract assets (default: true) */
  extractAssets?: boolean;
}

/**
 * Detection result
 */
export interface DetectionResult {
  /** Detected container format */
  format: ContainerFormat;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Reason for detection */
  reason: string;
}
