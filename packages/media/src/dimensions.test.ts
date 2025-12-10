/**
 * Dimensions detection tests
 */

import { describe, it, expect } from 'vitest';
import { getImageDimensions } from './dimensions.js';

describe('getImageDimensions', () => {
  describe('PNG', () => {
    it('should detect PNG dimensions from IHDR chunk', () => {
      // Minimal PNG with 100x50 dimensions
      const png = new Uint8Array([
        // PNG signature
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        // IHDR chunk: length (13 bytes)
        0x00, 0x00, 0x00, 0x0d,
        // IHDR type
        0x49, 0x48, 0x44, 0x52,
        // Width: 100 (big-endian)
        0x00, 0x00, 0x00, 0x64,
        // Height: 50 (big-endian)
        0x00, 0x00, 0x00, 0x32,
        // Bit depth, color type, etc.
        0x08, 0x02, 0x00, 0x00, 0x00,
      ]);

      const dims = getImageDimensions(png);
      expect(dims).toEqual({ width: 100, height: 50, format: 'png' });
    });

    it('should return null for PNG without IHDR', () => {
      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d,
        0x58, 0x58, 0x58, 0x58, // Not IHDR
        0x00, 0x00, 0x00, 0x64,
        0x00, 0x00, 0x00, 0x32,
      ]);

      expect(getImageDimensions(png)).toBeNull();
    });
  });

  describe('GIF', () => {
    it('should detect GIF dimensions', () => {
      const gif = new Uint8Array([
        // GIF89a signature
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
        // Width: 200 (little-endian)
        0xc8, 0x00,
        // Height: 150 (little-endian)
        0x96, 0x00,
        // Padding to make buffer >= 12 bytes for format detection
        0x00, 0x00,
      ]);

      const dims = getImageDimensions(gif);
      expect(dims).toEqual({ width: 200, height: 150, format: 'gif' });
    });
  });

  describe('WebP', () => {
    it('should detect VP8X (extended) WebP dimensions', () => {
      const webp = new Uint8Array([
        // RIFF header
        0x52, 0x49, 0x46, 0x46,
        // File size (placeholder)
        0x00, 0x00, 0x00, 0x00,
        // WEBP
        0x57, 0x45, 0x42, 0x50,
        // VP8X chunk
        0x56, 0x50, 0x38, 0x58,
        // Chunk size
        0x0a, 0x00, 0x00, 0x00,
        // Flags
        0x00, 0x00, 0x00, 0x00,
        // Canvas width - 1: 319 = 0x13F (3 bytes LE)
        0x3f, 0x01, 0x00,
        // Canvas height - 1: 239 = 0xEF (3 bytes LE)
        0xef, 0x00, 0x00,
      ]);

      const dims = getImageDimensions(webp);
      expect(dims).toEqual({ width: 320, height: 240, format: 'webp' });
    });
  });

  describe('edge cases', () => {
    it('should return null for non-image data', () => {
      const text = new TextEncoder().encode('not an image at all');
      expect(getImageDimensions(text)).toBeNull();
    });

    it('should return null for empty buffer', () => {
      expect(getImageDimensions(new Uint8Array(0))).toBeNull();
    });

    it('should return null for truncated image', () => {
      // PNG signature only, no IHDR
      const truncated = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(getImageDimensions(truncated)).toBeNull();
    });
  });
});
