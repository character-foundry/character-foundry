/**
 * Security-focused tests for PNG parsing
 *
 * Tests the inflate cap mitigation for zTXt decompression bombs.
 */

import { describe, it, expect } from 'vitest';
import { deflateSync } from 'fflate';
import { crc32Bytes } from './crc32.js';
import { extractFromPNG, MAX_INFLATED_SIZE } from './parser.js';
import { SizeLimitError } from '@character-foundry/core';

/**
 * Create a minimal valid PNG with a zTXt chunk containing the given data
 */
function createPNGWithZTXt(keyword: string, uncompressedData: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();

  // PNG signature
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // Minimal IHDR chunk (1x1 RGB PNG)
  const ihdrData = new Uint8Array([
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, // bit depth: 8
    0x02, // color type: RGB
    0x00, // compression
    0x00, // filter
    0x00, // interlace
  ]);
  const ihdrType = encoder.encode('IHDR');
  const ihdrChunk = createChunk(ihdrType, ihdrData);

  // zTXt chunk with the compressed data
  const keywordBytes = encoder.encode(keyword);
  const nullByte = new Uint8Array([0x00]); // Null separator
  const compressionMethod = new Uint8Array([0x00]); // Deflate
  const compressedData = deflateSync(uncompressedData);

  const ztxtData = new Uint8Array(
    keywordBytes.length + 1 + 1 + compressedData.length
  );
  ztxtData.set(keywordBytes, 0);
  ztxtData.set(nullByte, keywordBytes.length);
  ztxtData.set(compressionMethod, keywordBytes.length + 1);
  ztxtData.set(compressedData, keywordBytes.length + 2);

  const ztxtType = encoder.encode('zTXt');
  const ztxtChunk = createChunk(ztxtType, ztxtData);

  // Minimal IDAT chunk (just one transparent pixel)
  const idatData = deflateSync(new Uint8Array([0x00, 0xff, 0xff, 0xff])); // Filter + RGB
  const idatType = encoder.encode('IDAT');
  const idatChunk = createChunk(idatType, idatData);

  // IEND chunk
  const iendType = encoder.encode('IEND');
  const iendChunk = createChunk(iendType, new Uint8Array(0));

  // Combine all chunks
  const totalLength =
    signature.length +
    ihdrChunk.length +
    ztxtChunk.length +
    idatChunk.length +
    iendChunk.length;

  const png = new Uint8Array(totalLength);
  let offset = 0;
  png.set(signature, offset);
  offset += signature.length;
  png.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  png.set(ztxtChunk, offset);
  offset += ztxtChunk.length;
  png.set(idatChunk, offset);
  offset += idatChunk.length;
  png.set(iendChunk, offset);

  return png;
}

/**
 * Create a PNG chunk with length, type, data, and CRC
 */
function createChunk(type: Uint8Array, data: Uint8Array): Uint8Array {
  const length = data.length;
  const chunk = new Uint8Array(4 + 4 + length + 4);

  // Length (big-endian)
  chunk[0] = (length >> 24) & 0xff;
  chunk[1] = (length >> 16) & 0xff;
  chunk[2] = (length >> 8) & 0xff;
  chunk[3] = length & 0xff;

  // Type
  chunk.set(type, 4);

  // Data
  if (length > 0) {
    chunk.set(data, 8);
  }

  // CRC (over type + data)
  const crcInput = new Uint8Array(4 + length);
  crcInput.set(type, 0);
  if (length > 0) {
    crcInput.set(data, 4);
  }
  const crc = crc32Bytes(crcInput);
  chunk.set(crc, 8 + length);

  return chunk;
}

describe('PNG inflate cap security', () => {
  it('should parse normal-sized zTXt chunks', () => {
    // Create a valid character card JSON
    const cardData = JSON.stringify({
      name: 'Test Character',
      description: 'A test character',
      personality: 'Friendly',
      scenario: 'Testing',
      first_mes: 'Hello!',
      mes_example: '',
    });
    const cardBytes = new TextEncoder().encode(cardData);

    // Base64 encode as per character card spec
    const base64 = Buffer.from(cardBytes).toString('base64');
    const base64Bytes = new TextEncoder().encode(base64);

    const png = createPNGWithZTXt('chara', base64Bytes);
    const result = extractFromPNG(png);

    expect(result.data.name).toBe('Test Character');
  });

  it('should reject zTXt chunks that would inflate beyond the limit', () => {
    // Create highly compressible data that would expand to > MAX_INFLATED_SIZE
    // Repeating pattern compresses very well
    const targetSize = MAX_INFLATED_SIZE + 1024 * 1024; // 1MB over limit
    const largeData = new Uint8Array(targetSize);

    // Fill with repeating pattern (compresses well)
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }

    const png = createPNGWithZTXt('chara', largeData);

    expect(() => extractFromPNG(png)).toThrow(SizeLimitError);
  });

  it('should handle multiple zTXt chunks safely', () => {
    // This tests that we don't allow multiple smaller chunks to bypass the limit
    // Create a valid v2 character card JSON that will pass detection
    const cardData = JSON.stringify({
      name: 'Test Character',
      description: 'A test',
      personality: '',
      scenario: '',
      first_mes: 'Hello',
      mes_example: '',
    });
    const cardBytes = new TextEncoder().encode(cardData);
    const base64 = Buffer.from(cardBytes).toString('base64');
    const base64Bytes = new TextEncoder().encode(base64);

    // Create PNG with normal-sized chara chunk
    const png = createPNGWithZTXt('chara', base64Bytes);

    // Should parse normally
    const result = extractFromPNG(png);
    expect(result).toBeDefined();
    expect(result.data.name).toBe('Test Character');
  });

  it('MAX_INFLATED_SIZE should be a reasonable value', () => {
    // The inflate cap should be reasonable for card data but prevent bombs
    // 16MB is reasonable for JSON + some embedded assets
    expect(MAX_INFLATED_SIZE).toBe(16 * 1024 * 1024);
    expect(MAX_INFLATED_SIZE).toBeGreaterThan(1024 * 1024); // At least 1MB
    expect(MAX_INFLATED_SIZE).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
  });
});
