/**
 * Format detection tests
 */

import { describe, it, expect } from 'vitest';
import { detectImageFormat, getMimeType, getExtension } from './format.js';

describe('format detection', () => {
  describe('detectImageFormat', () => {
    it('should detect PNG from magic bytes', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      expect(detectImageFormat(png)).toBe('png');
    });

    it('should detect JPEG from magic bytes', () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(detectImageFormat(jpeg)).toBe('jpeg');
    });

    it('should detect GIF from magic bytes', () => {
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
      expect(detectImageFormat(gif)).toBe('gif');
    });

    it('should detect WebP from magic bytes', () => {
      // RIFF....WEBP
      const webp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(detectImageFormat(webp)).toBe('webp');
    });

    it('should detect AVIF from ftyp box', () => {
      // ....ftypavif
      const avif = new Uint8Array([
        0x00, 0x00, 0x00, 0x1c, // box size
        0x66, 0x74, 0x79, 0x70, // ftyp
        0x61, 0x76, 0x69, 0x66, // avif brand
      ]);
      expect(detectImageFormat(avif)).toBe('avif');
    });

    it('should return null for unrecognized format', () => {
      const text = new TextEncoder().encode('not an image');
      expect(detectImageFormat(text)).toBeNull();
    });

    it('should return null for empty buffer', () => {
      expect(detectImageFormat(new Uint8Array(0))).toBeNull();
    });

    it('should return null for buffer too small', () => {
      expect(detectImageFormat(new Uint8Array([0x89, 0x50]))).toBeNull();
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(getMimeType('png')).toBe('image/png');
      expect(getMimeType('jpeg')).toBe('image/jpeg');
      expect(getMimeType('webp')).toBe('image/webp');
      expect(getMimeType('gif')).toBe('image/gif');
      expect(getMimeType('avif')).toBe('image/avif');
    });
  });

  describe('getExtension', () => {
    it('should return correct extensions', () => {
      expect(getExtension('png')).toBe('png');
      expect(getExtension('jpeg')).toBe('jpg');
      expect(getExtension('webp')).toBe('webp');
      expect(getExtension('gif')).toBe('gif');
      expect(getExtension('avif')).toBe('avif');
    });
  });
});
