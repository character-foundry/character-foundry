/**
 * @character-foundry/voxta
 *
 * Voxta package format reader, writer, and mapper.
 */

// Types
export type {
  CompressionLevel,
  VoxtaPackage,
  VoxtaTtsConfig,
  VoxtaScript,
  VoxtaCharacter,
  VoxtaBookItem,
  VoxtaBook,
  VoxtaAction,
  VoxtaScenario,
  ExtractedVoxtaAsset,
  ExtractedVoxtaCharacter,
  ExtractedVoxtaScenario,
  ExtractedVoxtaBook,
  VoxtaData,
  VoxtaReadOptions,
  VoxtaWriteAsset,
  VoxtaWriteOptions,
  VoxtaBuildResult,
  VoxtaExtensionData,
  VoxtaLossReport,
} from './types.js';

// Reader
export {
  isVoxta,
  readVoxta,
  readVoxtaAsync,
} from './reader.js';

// Writer
export {
  writeVoxta,
  writeVoxtaAsync,
} from './writer.js';

// Mapper
export {
  voxtaToCCv3,
  ccv3ToVoxta,
  ccv3LorebookToVoxtaBook,
} from './mapper.js';

// Macros
export {
  voxtaToStandard,
  standardToVoxta,
} from './macros.js';

// Merge utilities
export {
  mergeCharacterEdits,
  mergeBookEdits,
  applyVoxtaDeltas,
  applyVoxtaDeltasAsync,
  getPackageManifest,
  extractCharacterPackage,
  addCharacterToPackage,
  type CCv3Edits,
  type VoxtaDeltas,
  type ApplyDeltaOptions,
  type ManifestCharacter,
  type ManifestBook,
  type ManifestScenario,
  type PackageManifest,
  type ExtractCharacterOptions,
  type AddCharacterOptions,
} from './merge.js';

// Loss reporting
export {
  checkVoxtaLoss,
  isVoxtaExportLossless,
  formatVoxtaLossReport,
} from './loss.js';

// Enricher
export {
  enrichVoxtaAsset,
  type EnrichedAssetMetadata,
} from './enricher.js';

