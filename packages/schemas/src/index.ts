/**
 * @character-foundry/schemas
 *
 * Type definitions and schemas for character card formats.
 */

// Common types
export {
  type ISO8601,
  type UUID,
  type Spec,
  type SourceFormat,
  type OriginalShape,
  type AssetType,
  type AssetDescriptor,
  type ExtractedAsset,
} from './common.js';

// CCv2 types
export {
  type CCv2LorebookEntry,
  type CCv2CharacterBook,
  type CCv2Data,
  type CCv2Wrapped,
  isWrappedV2,
  isV2CardData,
  getV2Data,
} from './ccv2.js';

// CCv3 types
export {
  type CCv3LorebookEntry,
  type CCv3CharacterBook,
  type CCv3DataInner,
  type CCv3Data,
  isV3Card,
  getV3Data,
} from './ccv3.js';

// Risu extension types
export {
  type RisuEmotions,
  type RisuAdditionalAssets,
  type RisuDepthPrompt,
  type RisuExtensions,
  type CharxMetaEntry,
  hasRisuExtensions,
  hasRisuScripts,
  hasDepthPrompt,
} from './risu.js';

// Normalized card
export {
  type NormalizedCard,
  type DerivedFeatures,
  createEmptyNormalizedCard,
  createEmptyFeatures,
} from './normalized.js';

// Detection
export {
  type SpecDetectionResult,
  detectSpec,
  detectSpecDetailed,
  hasLorebook,
  looksLikeCard,
} from './detection.js';

// Normalizer
export { CardNormalizer } from './normalizer.js';

// Type aliases for convenience
export type CharacterBook = import('./ccv3.js').CCv3CharacterBook;
export type LorebookEntry = import('./ccv3.js').CCv3LorebookEntry;
