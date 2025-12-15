/**
 * @character-foundry/schemas
 *
 * Type definitions and schemas for character card formats.
 */

// Common types and schemas
export {
  type ISO8601,
  type UUID,
  type Spec,
  type SourceFormat,
  type OriginalShape,
  type AssetType,
  type AssetDescriptor,
  type ExtractedAsset,
  ISO8601Schema,
  UUIDSchema,
  SpecSchema,
  SourceFormatSchema,
  OriginalShapeSchema,
  AssetTypeSchema,
  AssetDescriptorSchema,
  ExtractedAssetSchema,
} from './common.js';

// CCv2 types and schemas
export {
  type CCv2LorebookEntry,
  type CCv2CharacterBook,
  type CCv2Data,
  type CCv2Wrapped,
  CCv2LorebookEntrySchema,
  CCv2CharacterBookSchema,
  CCv2DataSchema,
  CCv2WrappedSchema,
  isWrappedV2,
  isV2CardData,
  looksLikeWrappedV2,
  getV2Data,
  parseWrappedV2,
  parseV2Data,
} from './ccv2.js';

// CCv3 types and schemas
export {
  type CCv3LorebookEntry,
  type CCv3CharacterBook,
  type CCv3DataInner,
  type CCv3Data,
  CCv3LorebookEntrySchema,
  CCv3CharacterBookSchema,
  CCv3DataInnerSchema,
  CCv3DataSchema,
  isV3Card,
  looksLikeV3Card,
  getV3Data,
  parseV3Card,
  parseV3DataInner,
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

// Validation utilities
export {
  zodErrorToMessage,
  getFirstErrorField,
  safeParse,
} from './validation.js';

// Type aliases for convenience
export type CharacterBook = import('./ccv3.js').CCv3CharacterBook;
export type LorebookEntry = import('./ccv3.js').CCv3LorebookEntry;
