/**
 * @character-foundry/core
 *
 * Core utilities for character card handling.
 * Works in both Node.js and browser environments.
 */

// Binary utilities
export {
  type BinaryData,
  readUInt32BE,
  writeUInt32BE,
  readUInt16BE,
  writeUInt16BE,
  indexOf,
  concat,
  slice,
  copy,
  fromString,
  toString,
  fromLatin1,
  toLatin1,
  equals,
  alloc,
  from,
  isBinaryData,
  toUint8Array,
  toHex,
  fromHex,
} from './binary.js';

// Base64 utilities
export {
  encode as base64Encode,
  decode as base64Decode,
  isBase64,
  encodeUrlSafe as base64EncodeUrlSafe,
  decodeUrlSafe as base64DecodeUrlSafe,
} from './base64.js';

// ZIP utilities
export {
  ZIP_SIGNATURE,
  JPEG_SIGNATURE,
  type ZipSizeLimits,
  DEFAULT_ZIP_LIMITS,
  isZipBuffer,
  startsWithZipSignature,
  isJPEG,
  isJpegCharX,
  findZipStart,
  getZipOffset,
  isValidZip,
  isPathSafe,
} from './zip.js';

// URI utilities
export {
  type URIScheme,
  type ParsedURI,
  normalizeURI,
  parseURI,
  isImageExt,
  isAudioExt,
  isVideoExt,
  isURISafe,
  getExtensionFromURI,
  getMimeTypeFromExt,
  getExtFromMimeType,
  buildDataURI,
} from './uri.js';

// Error classes
export {
  FoundryError,
  ParseError,
  ValidationError,
  AssetNotFoundError,
  FormatNotSupportedError,
  SizeLimitError,
  PathTraversalError,
  DataLossError,
  isFoundryError,
  wrapError,
} from './errors.js';

// Image utilities
export {
  isAnimatedImage,
} from './image.js';

