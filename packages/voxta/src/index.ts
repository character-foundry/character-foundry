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

// Loss reporting
export {
  checkVoxtaLoss,
  isVoxtaExportLossless,
  formatVoxtaLossReport,
} from './loss.js';
