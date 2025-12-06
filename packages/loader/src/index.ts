/**
 * @character-foundry/loader
 *
 * Universal character card loader - detects format and parses any card type.
 */

// Types
export type {
  ContainerFormat,
  ExtractedAsset,
  ParseResult,
  ParseOptions,
  DetectionResult,
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
} from './loader.js';
