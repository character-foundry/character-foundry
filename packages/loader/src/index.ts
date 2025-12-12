/**
 * @character-foundry/loader
 *
 * Universal character card loader - detects format and parses any card type.
 * Now also supports standalone lorebook files.
 */

// Types
export type {
  ContainerFormat,
  ExtractedAsset,
  ParseResult,
  ParseOptions,
  DetectionResult,
  // Lorebook support
  LorebookFormat,
  LorebookParseResult,
  CardParseResult,
  UniversalParseResult,
} from './types.js';

// Detector
export {
  detectFormat,
  mightBeCard,
} from './detector.js';

// Loader
export {
  parseCard,
  parseCardAsync,
  getContainerFormat,
  // Lorebook support
  parseLorebook,
  parseLorebookAsync,
  // Universal parser (cards + lorebooks)
  parse,
  parseAsync,
} from './loader.js';

// Metadata validation
export {
  validateClientMetadata,
  validateClientMetadataSync,
  computeContentHash,
  type ClientMetadata,
  type TokenCounts,
  type MetadataDiscrepancy,
  type AuthoritativeMetadata,
  type ValidationResult,
  type ValidationOptions,
  type SyncValidationOptions,
  type TagValidator,
} from './validate-metadata.js';
