/**
 * URI utilities tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseURI,
  normalizeURI,
  isURISafe,
  getExtensionFromURI,
  getMimeTypeFromExt,
  getExtFromMimeType,
  isImageExt,
  isAudioExt,
  isVideoExt,
} from './uri.js';

describe('URI utilities', () => {
  describe('normalizeURI', () => {
    it('normalizes embedded:// typo to embeded://', () => {
      expect(normalizeURI('embedded://assets/icon.png'))
        .toBe('embeded://assets/icon.png');
    });

    it('normalizes __asset: to pngchunk:', () => {
      expect(normalizeURI('__asset:0')).toBe('pngchunk:0');
      expect(normalizeURI('__asset:avatar.png')).toBe('pngchunk:avatar.png');
    });

    it('normalizes asset: to pngchunk:', () => {
      expect(normalizeURI('asset:0')).toBe('pngchunk:0');
    });

    it('normalizes chara-ext-asset_ variants', () => {
      expect(normalizeURI('chara-ext-asset_:0')).toBe('pngchunk:0');
      expect(normalizeURI('chara-ext-asset_0')).toBe('pngchunk:0');
    });

    it('preserves other URIs unchanged', () => {
      expect(normalizeURI('embeded://assets/icon.png'))
        .toBe('embeded://assets/icon.png');
      expect(normalizeURI('https://example.com/image.png'))
        .toBe('https://example.com/image.png');
    });
  });

  describe('parseURI', () => {
    it('parses embeded:// URIs', () => {
      const parsed = parseURI('embeded://assets/icon.png');
      expect(parsed.scheme).toBe('embeded');
      expect(parsed.path).toBe('assets/icon.png');
    });

    it('parses embedded:// (typo) and normalizes', () => {
      const parsed = parseURI('embedded://assets/icon.png');
      expect(parsed.scheme).toBe('embeded');
      expect(parsed.normalizedUri).toBe('embeded://assets/icon.png');
    });

    it('parses __asset: URIs with candidates', () => {
      const parsed = parseURI('__asset:0');
      expect(parsed.scheme).toBe('pngchunk');
      expect(parsed.chunkKey).toBe('0');
      expect(parsed.chunkCandidates).toContain('0');
      expect(parsed.chunkCandidates).toContain('__asset:0');
      expect(parsed.chunkCandidates).toContain('chara-ext-asset_0');
    });

    it('parses ccdefault:', () => {
      const parsed = parseURI('ccdefault:');
      expect(parsed.scheme).toBe('ccdefault');
    });

    it('parses https URLs', () => {
      const parsed = parseURI('https://example.com/image.png');
      expect(parsed.scheme).toBe('https');
      expect(parsed.url).toBe('https://example.com/image.png');
    });

    it('parses data URIs', () => {
      const parsed = parseURI('data:image/png;base64,abc123');
      expect(parsed.scheme).toBe('data');
      expect(parsed.mimeType).toBe('image/png');
      expect(parsed.encoding).toBe('base64');
      expect(parsed.data).toBe('abc123');
    });

    it('parses internal asset IDs', () => {
      const parsed = parseURI('abc123-def456');
      expect(parsed.scheme).toBe('internal');
      expect(parsed.path).toBe('abc123-def456');
    });
  });

  describe('isURISafe', () => {
    it('allows safe schemes by default', () => {
      expect(isURISafe('embeded://assets/icon.png')).toBe(true);
      expect(isURISafe('ccdefault:')).toBe(true);
      expect(isURISafe('https://example.com')).toBe(true);
      expect(isURISafe('__asset:0')).toBe(true);
      expect(isURISafe('data:image/png;base64,abc')).toBe(true);
    });

    it('blocks http by default', () => {
      expect(isURISafe('http://example.com')).toBe(false);
      expect(isURISafe('http://example.com', { allowHttp: true })).toBe(true);
    });

    it('blocks file by default', () => {
      expect(isURISafe('file:///etc/passwd')).toBe(false);
      expect(isURISafe('file:///etc/passwd', { allowFile: true })).toBe(true);
    });
  });

  describe('extension utilities', () => {
    it('gets extension from URI', () => {
      expect(getExtensionFromURI('embeded://assets/icon.png')).toBe('png');
      expect(getExtensionFromURI('https://example.com/image.jpg?v=1')).toBe('jpg');
    });

    it('gets MIME type from extension', () => {
      expect(getMimeTypeFromExt('png')).toBe('image/png');
      expect(getMimeTypeFromExt('mp3')).toBe('audio/mpeg');
      expect(getMimeTypeFromExt('unknown')).toBe('application/octet-stream');
    });

    it('gets extension from MIME type', () => {
      expect(getExtFromMimeType('image/png')).toBe('png');
      expect(getExtFromMimeType('audio/mpeg')).toBe('mp3');
      expect(getExtFromMimeType('unknown/type')).toBe('bin');
    });
  });

  describe('media type checks', () => {
    it('identifies image extensions', () => {
      expect(isImageExt('png')).toBe(true);
      expect(isImageExt('JPG')).toBe(true);
      expect(isImageExt('mp3')).toBe(false);
    });

    it('identifies audio extensions', () => {
      expect(isAudioExt('mp3')).toBe(true);
      expect(isAudioExt('wav')).toBe(true);
      expect(isAudioExt('png')).toBe(false);
    });

    it('identifies video extensions', () => {
      expect(isVideoExt('mp4')).toBe(true);
      expect(isVideoExt('webm')).toBe(true);
      expect(isVideoExt('mp3')).toBe(false);
    });
  });
});
