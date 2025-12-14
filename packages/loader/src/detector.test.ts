/**
 * Format Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import { detectFormat, mightBeCard } from './detector.js';

describe('detectFormat', () => {
  describe('PNG detection', () => {
    it('should detect PNG by signature', () => {
      // Minimal valid PNG structure
      const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      // Add minimal IHDR chunk
      const ihdrLength = new Uint8Array([0x00, 0x00, 0x00, 0x0d]);
      const ihdrType = new Uint8Array([0x49, 0x48, 0x44, 0x52]); // IHDR
      const ihdrData = new Uint8Array(13); // Width, height, bit depth, etc.
      const ihdrCrc = new Uint8Array(4);
      // IEND chunk
      const iendLength = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const iendType = new Uint8Array([0x49, 0x45, 0x4e, 0x44]); // IEND
      const iendCrc = new Uint8Array([0xae, 0x42, 0x60, 0x82]);

      const png = new Uint8Array([
        ...pngSignature,
        ...ihdrLength, ...ihdrType, ...ihdrData, ...ihdrCrc,
        ...iendLength, ...iendType, ...iendCrc,
      ]);

      const result = detectFormat(png);

      expect(result.format).toBe('png');
      expect(result.confidence).toBe('high');
    });
  });

  describe('CharX detection', () => {
    it('should detect CharX ZIP', () => {
      const card = {
        spec: 'chara_card_v3',
        data: { name: 'Test' },
      };

      const zipData = zipSync({
        'card.json': fromString(JSON.stringify(card)),
      });

      const result = detectFormat(zipData);

      expect(result.format).toBe('charx');
      expect(result.confidence).toBe('high');
    });
  });

  describe('Voxta detection', () => {
    it('should detect Voxta package', () => {
      const character = {
        $type: 'character',
        Id: 'test-id',
        Name: 'Test',
      };

      const zipData = zipSync({
        'Characters/test-id/character.json': fromString(JSON.stringify(character)),
      });

      const result = detectFormat(zipData);

      expect(result.format).toBe('voxta');
      expect(result.confidence).toBe('high');
    });
  });

  describe('JSON detection', () => {
    it('should detect JSON starting with {', () => {
      const json = fromString('{"name": "Test"}');

      const result = detectFormat(json);

      expect(result.format).toBe('json');
      expect(result.confidence).toBe('medium');
    });

    it('should detect JSON starting with [', () => {
      const json = fromString('[1, 2, 3]');

      const result = detectFormat(json);

      expect(result.format).toBe('json');
      expect(result.confidence).toBe('medium');
    });

    it('should handle JSON with BOM', () => {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const json = fromString('{"name": "Test"}');
      const withBom = new Uint8Array([...bom, ...json]);

      const result = detectFormat(withBom);

      expect(result.format).toBe('json');
    });

    it('should handle JSON with leading whitespace', () => {
      const json = fromString('  \n\t{"name": "Test"}');

      const result = detectFormat(json);

      expect(result.format).toBe('json');
    });
  });

  describe('SFX/Hybrid archive detection', () => {
    it('should detect CharX with ZIP not at offset 0', () => {
      const card = {
        spec: 'chara_card_v3',
        data: { name: 'SFX Test' },
      };

      const zipData = zipSync({
        'card.json': fromString(JSON.stringify(card)),
      });

      // Prepend some random data (simulating SFX executable header)
      const sfxHeader = new Uint8Array(256).fill(0x90); // NOP sled
      const sfxArchive = new Uint8Array(sfxHeader.length + zipData.length);
      sfxArchive.set(sfxHeader, 0);
      sfxArchive.set(zipData, sfxHeader.length);

      const result = detectFormat(sfxArchive);

      expect(result.format).toBe('charx');
      expect(result.confidence).toBe('high');
      expect(result.reason).toContain('SFX');
    });

    it('should detect Voxta with ZIP not at offset 0', () => {
      const character = {
        $type: 'character',
        Id: 'sfx-test',
        Name: 'SFX Test',
      };

      const zipData = zipSync({
        'Characters/sfx-test/character.json': fromString(JSON.stringify(character)),
      });

      // Prepend some random data
      const sfxHeader = new Uint8Array(128);
      const sfxArchive = new Uint8Array(sfxHeader.length + zipData.length);
      sfxArchive.set(sfxHeader, 0);
      sfxArchive.set(zipData, sfxHeader.length);

      const result = detectFormat(sfxArchive);

      expect(result.format).toBe('voxta');
      expect(result.confidence).toBe('high');
      expect(result.reason).toContain('SFX');
    });
  });

  describe('Unknown format', () => {
    it('should return unknown for empty data', () => {
      const result = detectFormat(new Uint8Array(0));

      expect(result.format).toBe('unknown');
      expect(result.confidence).toBe('high');
    });

    it('should return unknown for unrecognized data', () => {
      const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

      const result = detectFormat(data);

      expect(result.format).toBe('unknown');
    });

    it('should return unknown for ZIP without card structure', () => {
      const zipData = zipSync({
        'random.txt': fromString('Hello world'),
      });

      const result = detectFormat(zipData);

      expect(result.format).toBe('unknown');
      expect(result.reason).toContain('ZIP');
    });
  });
});

describe('mightBeCard', () => {
  it('should return true for recognized formats', () => {
    const card = { spec: 'chara_card_v3', data: { name: 'Test' } };
    const zipData = zipSync({ 'card.json': fromString(JSON.stringify(card)) });

    expect(mightBeCard(zipData)).toBe(true);
  });

  it('should return true for JSON data', () => {
    const json = fromString('{"name": "Test"}');

    expect(mightBeCard(json)).toBe(true);
  });

  it('should return false for random binary data', () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

    expect(mightBeCard(data)).toBe(false);
  });
});
