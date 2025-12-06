/**
 * @character-foundry/charx
 *
 * CharX format reader and writer.
 */

// Types
export type {
  CompressionLevel,
  CharxMetaEntry,
  CharxAssetInfo,
  CharxData,
  CharxReadOptions,
  CharxWriteAsset,
  CharxWriteOptions,
  CharxBuildResult,
  AssetFetcher,
} from './types.js';

// Reader
export {
  isCharX,
  isJpegCharX,
  readCharX,
  readCardJsonOnly,
  readCharXAsync,
} from './reader.js';

// Writer
export {
  writeCharX,
  writeCharXAsync,
} from './writer.js';
