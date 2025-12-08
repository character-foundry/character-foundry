/**
 * PNG Parser
 *
 * Extracts text chunks and character card data from PNG files.
 * Uses fflate for zTXt decompression, works in browser and Node.js.
 */

import { inflateSync } from 'fflate';
import {
  type BinaryData,
  readUInt32BE,
  slice,
  toString,
  toLatin1,
  indexOf,
  base64Decode,
  ParseError,
  SizeLimitError,
} from '@character-foundry/core';
import {
  type CCv2Data,
  type CCv3Data,
  type Spec,
  detectSpec,
} from '@character-foundry/schemas';

/**
 * PNG signature bytes
 */
export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Maximum size for a single PNG chunk (50MB per Risu CharX spec)
 */
export const MAX_CHUNK_SIZE = 50 * 1024 * 1024;

/**
 * Text chunk keys used for character cards by various frontends
 */
export const TEXT_CHUNK_KEYS = [
  // v3 keys
  'ccv3',
  'chara_card_v3',
  // v2 keys (most common)
  'chara',
  'ccv2',
  'character',
  // Alternative/legacy keys
  'charactercard',
  'card',
  'CharacterCard',
  'Chara',
];

/**
 * Parsed text chunk from PNG
 */
export interface TextChunk {
  keyword: string;
  text: string;
}

/**
 * Result of extracting card data from PNG
 */
export interface PNGExtractionResult {
  data: CCv2Data | CCv3Data;
  spec: Spec;
  extraChunks: TextChunk[];
}

/**
 * Check if data is a valid PNG (has correct signature)
 */
export function isPNG(data: BinaryData): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Parse all text chunks (tEXt and zTXt) from PNG buffer
 * Returns array of {keyword, text} to support multiple chunks
 */
export function parseTextChunks(data: BinaryData): TextChunk[] {
  const textChunks: TextChunk[] = [];

  // Verify PNG signature
  if (!isPNG(data)) {
    return textChunks;
  }

  let offset = 8; // Skip PNG signature

  while (offset < data.length) {
    // Read chunk length (4 bytes, big-endian)
    if (offset + 4 > data.length) break;
    const length = readUInt32BE(data, offset);
    offset += 4;

    // Read chunk type (4 bytes ASCII)
    if (offset + 4 > data.length) break;
    const typeBytes = slice(data, offset, offset + 4);
    const type = toLatin1(typeBytes);
    offset += 4;

    // Check chunk size limit before reading
    if (length > MAX_CHUNK_SIZE) {
      throw new SizeLimitError(length, MAX_CHUNK_SIZE, `PNG chunk '${type}'`);
    }

    // Read chunk data
    if (offset + length > data.length) break;
    const chunkData = slice(data, offset, offset + length);
    offset += length;

    // Skip CRC (4 bytes)
    if (offset + 4 > data.length) break;
    offset += 4;

    // Parse tEXt chunks
    if (type === 'tEXt') {
      const nullIndex = indexOf(chunkData, new Uint8Array([0]));
      if (nullIndex !== -1) {
        const keyword = toLatin1(slice(chunkData, 0, nullIndex));
        const text = toString(slice(chunkData, nullIndex + 1));
        textChunks.push({ keyword, text });
      }
    }

    // Parse zTXt chunks (compressed)
    if (type === 'zTXt') {
      const nullIndex = indexOf(chunkData, new Uint8Array([0]));
      if (nullIndex !== -1) {
        const keyword = toLatin1(slice(chunkData, 0, nullIndex));
        const compressionMethod = chunkData[nullIndex + 1];

        if (compressionMethod === 0) { // 0 = deflate/inflate
          try {
            const compressedData = slice(chunkData, nullIndex + 2);
            const decompressed = inflateSync(compressedData);
            const text = toString(decompressed);
            textChunks.push({ keyword, text });
          } catch {
            // Failed to decompress zTXt chunk, skip it
          }
        }
      }
    }

    // Stop after IEND chunk
    if (type === 'IEND') break;
  }

  return textChunks;
}

/**
 * List all chunks in a PNG file
 */
export function listChunks(data: BinaryData): Array<{ type: string; offset: number; length: number }> {
  const chunks: Array<{ type: string; offset: number; length: number }> = [];

  if (!isPNG(data)) {
    return chunks;
  }

  let offset = 8;

  while (offset < data.length) {
    if (offset + 4 > data.length) break;
    const length = readUInt32BE(data, offset);
    const chunkStart = offset;
    offset += 4;

    if (offset + 4 > data.length) break;
    const type = toLatin1(slice(data, offset, offset + 4));
    offset += 4;

    chunks.push({ type, offset: chunkStart, length });

    // Skip data and CRC
    offset += length + 4;

    if (type === 'IEND') break;
  }

  return chunks;
}

/**
 * Try to parse JSON from chunk data (supports plain and base64)
 */
function tryParseChunk(chunkData: string): unknown {
  // Try direct JSON parse first
  try {
    return JSON.parse(chunkData);
  } catch {
    // Try base64 decode then JSON parse
    try {
      const decoded = toString(base64Decode(chunkData));
      return JSON.parse(decoded);
    } catch {
      throw new ParseError('Not valid JSON or base64-encoded JSON', 'png');
    }
  }
}

/**
 * Check if parsed data has a lorebook
 */
function hasLorebookInData(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  const obj = json as Record<string, unknown>;

  // Check wrapped format
  const data = obj.data as Record<string, unknown> | undefined;
  if (data?.character_book) {
    const book = data.character_book as Record<string, unknown>;
    if (Array.isArray(book.entries) && book.entries.length > 0) return true;
  }

  // Check unwrapped format
  if (obj.character_book) {
    const book = obj.character_book as Record<string, unknown>;
    if (Array.isArray(book.entries) && book.entries.length > 0) return true;
  }

  return false;
}

/**
 * Extract character card JSON from PNG tEXt chunks
 * Returns card data, spec version, and any extra chunks
 */
export function extractFromPNG(data: BinaryData): PNGExtractionResult {
  // Validate PNG format
  if (!isPNG(data)) {
    throw new ParseError('Invalid PNG signature', 'png');
  }

  // Parse all text chunks
  const textChunks = parseTextChunks(data);

  if (textChunks.length === 0) {
    throw new ParseError('No text chunks found in PNG', 'png');
  }

  // Try all known keys, preferring chunks with lorebooks
  let fallbackResult: PNGExtractionResult | null = null;

  for (const key of TEXT_CHUNK_KEYS) {
    // Find all chunks with this keyword
    const matchingChunks = textChunks.filter(c => c.keyword === key);

    for (const chunk of matchingChunks) {
      try {
        const json = tryParseChunk(chunk.text);
        const spec = detectSpec(json);

        if (spec === 'v3' || spec === 'v2') {
          const result: PNGExtractionResult = {
            data: json as CCv2Data | CCv3Data,
            spec,
            extraChunks: textChunks.filter(c => c.keyword !== key),
          };

          // Prefer chunks with lorebooks
          if (hasLorebookInData(json)) {
            return result;
          }

          // Store as fallback if we don't find one with lorebook
          if (!fallbackResult) {
            fallbackResult = result;
          }
        }

        // If detectSpec failed but we have JSON that looks like a card, try to infer
        if (!spec && json && typeof json === 'object') {
          const obj = json as Record<string, unknown>;
          let inferredResult: { data: CCv2Data | CCv3Data; spec: Spec } | null = null;

          if (obj.spec === 'chara_card_v3' && obj.data && (obj.data as Record<string, unknown>).name) {
            inferredResult = { data: json as CCv3Data, spec: 'v3' };
          } else if (obj.spec === 'chara_card_v2' && obj.data && (obj.data as Record<string, unknown>).name) {
            inferredResult = { data: json as CCv2Data, spec: 'v2' };
          } else if (obj.name && (obj.description || obj.personality || obj.scenario)) {
            inferredResult = { data: json as CCv2Data, spec: 'v2' };
          }

          if (inferredResult) {
            const fullResult: PNGExtractionResult = {
              ...inferredResult,
              extraChunks: textChunks.filter(c => c.keyword !== key),
            };
            if (hasLorebookInData(json)) {
              return fullResult;
            }
            if (!fallbackResult) fallbackResult = fullResult;
          }
        }
      } catch {
        // Continue to next chunk
      }
    }
  }

  // If we found a valid card but no lorebook, use the fallback
  if (fallbackResult) {
    return fallbackResult;
  }

  throw new ParseError('No valid character card data found in PNG', 'png');
}
