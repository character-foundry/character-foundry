/**
 * PNG Builder
 *
 * Embeds character card data into PNG tEXt chunks.
 * Works in browser and Node.js.
 */

import {
  type BinaryData,
  readUInt32BE,
  writeUInt32BE,
  slice,
  concat,
  fromLatin1,
  fromString,
  alloc,
  base64Encode,
  toLatin1,
  ParseError,
} from '@character-foundry/core';
import type { CCv2Data, CCv3Data } from '@character-foundry/schemas';
import { crc32Bytes } from './crc32.js';
import { isPNG } from './parser.js';

/**
 * Options for embedding card data into PNG
 */
export interface EmbedOptions {
  /**
   * Key to use for the tEXt chunk (default: 'chara')
   */
  key?: string;

  /**
   * Whether to base64 encode the JSON (default: true, recommended for compatibility)
   */
  base64?: boolean;

  /**
   * Whether to minify JSON (default: true)
   */
  minify?: boolean;
}

/**
 * Remove all tEXt and zTXt chunks from PNG buffer
 * CRITICAL: Must remove old chunks before adding new ones to prevent duplicate data
 */
export function removeAllTextChunks(pngBuffer: BinaryData): BinaryData {
  if (!isPNG(pngBuffer)) {
    throw new ParseError('Invalid PNG signature', 'png');
  }

  const chunks: BinaryData[] = [slice(pngBuffer, 0, 8)]; // Start with PNG signature
  let offset = 8;

  while (offset < pngBuffer.length) {
    // Read chunk length (4 bytes, big-endian)
    if (offset + 4 > pngBuffer.length) break;
    const length = readUInt32BE(pngBuffer, offset);
    const lengthBuf = slice(pngBuffer, offset, offset + 4);
    offset += 4;

    // Read chunk type (4 bytes ASCII)
    if (offset + 4 > pngBuffer.length) break;
    const type = toLatin1(slice(pngBuffer, offset, offset + 4));
    const typeBuf = slice(pngBuffer, offset, offset + 4);
    offset += 4;

    // Read chunk data + CRC
    if (offset + length + 4 > pngBuffer.length) break;
    const dataBuf = slice(pngBuffer, offset, offset + length);
    const crcBuf = slice(pngBuffer, offset + length, offset + length + 4);
    offset += length + 4;

    // Skip tEXt and zTXt chunks (don't add them to output)
    if (type === 'tEXt' || type === 'zTXt') {
      continue;
    }

    // Keep all other chunks
    chunks.push(lengthBuf, typeBuf, dataBuf, crcBuf);

    // Stop after IEND
    if (type === 'IEND') break;
  }

  return concat(...chunks);
}

/**
 * Find the offset of the IEND chunk in PNG buffer
 */
function findIendOffset(pngBuffer: BinaryData): number {
  // Search backwards from the end - IEND should be near the end
  // IEND format: length(4) + "IEND"(4) + CRC(4) = 12 bytes
  for (let i = pngBuffer.length - 12; i >= 8; i--) {
    if (
      pngBuffer[i + 4] === 0x49 && // 'I'
      pngBuffer[i + 5] === 0x45 && // 'E'
      pngBuffer[i + 6] === 0x4e && // 'N'
      pngBuffer[i + 7] === 0x44    // 'D'
    ) {
      return i; // Start of length field
    }
  }
  return -1;
}

/**
 * Create a tEXt chunk
 */
function createTextChunk(keyword: string, text: string): BinaryData {
  const keywordBuffer = fromLatin1(keyword);
  const textBuffer = fromString(text);

  // Chunk data: keyword + null separator + text
  const chunkData = concat(
    keywordBuffer,
    new Uint8Array([0]), // null separator
    textBuffer
  );

  // Chunk type
  const chunkType = fromLatin1('tEXt');

  // Calculate CRC32 of type + data
  const crc = crc32Bytes(concat(chunkType, chunkData));

  // Build length buffer
  const lengthBuffer = alloc(4);
  writeUInt32BE(lengthBuffer, chunkData.length, 0);

  // Assemble: length + type + data + crc
  return concat(lengthBuffer, chunkType, chunkData, crc);
}

/**
 * Inject a tEXt chunk into PNG buffer before IEND
 */
export function injectTextChunk(pngBuffer: BinaryData, keyword: string, text: string): BinaryData {
  const iendOffset = findIendOffset(pngBuffer);

  if (iendOffset === -1) {
    throw new ParseError('Invalid PNG: IEND chunk not found', 'png');
  }

  const textChunk = createTextChunk(keyword, text);

  // Insert before IEND
  const beforeIend = slice(pngBuffer, 0, iendOffset);
  const iendAndAfter = slice(pngBuffer, iendOffset);

  return concat(beforeIend, textChunk, iendAndAfter);
}

/**
 * Embed character card JSON into PNG tEXt chunk
 */
export function embedIntoPNG(
  imageBuffer: BinaryData,
  cardData: CCv2Data | CCv3Data,
  options: EmbedOptions = {}
): BinaryData {
  const {
    key = 'chara',
    base64 = true,
    minify = true,
  } = options;

  // Remove all existing tEXt chunks first to prevent duplicate/stale data
  const cleanPng = removeAllTextChunks(imageBuffer);

  // Serialize JSON
  const json = minify
    ? JSON.stringify(cardData)
    : JSON.stringify(cardData, null, 2);

  // Optionally base64 encode (recommended for compatibility)
  const text = base64 ? base64Encode(fromString(json)) : json;

  // Inject the text chunk
  return injectTextChunk(cleanPng, key, text);
}

/**
 * Validate PNG size against limits
 */
export function validatePNGSize(
  buffer: BinaryData,
  limits: { max: number; warn: number }
): { valid: boolean; warnings: string[] } {
  const sizeMB = buffer.length / (1024 * 1024);
  const warnings: string[] = [];

  if (sizeMB > limits.max) {
    return {
      valid: false,
      warnings: [`PNG size (${sizeMB.toFixed(2)}MB) exceeds maximum (${limits.max}MB)`],
    };
  }

  if (sizeMB > limits.warn) {
    warnings.push(`PNG size (${sizeMB.toFixed(2)}MB) is large (recommended: <${limits.warn}MB)`);
  }

  return { valid: true, warnings };
}
