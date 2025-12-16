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
  encodeChunked as base64EncodeChunked,
} from './base64.js';

// Data URL utilities
export {
  toDataURL,
  fromDataURL,
  isDataURL,
} from './data-url.js';

// ZIP utilities moved to @character-foundry/core/zip subpath
// Import from '@character-foundry/core/zip' instead of '@character-foundry/core'
// This keeps fflate out of the main bundle for consumers who don't need ZIP

// URI utilities
export {
  type URIScheme,
  type ParsedURI,
  type URISafetyOptions,
  type URISafetyResult,
  normalizeURI,
  parseURI,
  isImageExt,
  isAudioExt,
  isVideoExt,
  isURISafe,
  checkURISafety,
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

// UUID utilities
export {
  generateUUID,
  isValidUUID,
} from './uuid.js';

