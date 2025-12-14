/**
 * Exporter Tests
 */

import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import {
  exportCard,
  getSupportedFormats,
  getFormatExtension,
  getFormatMimeType,
} from './exporter.js';
import type { CCv3Data } from '@character-foundry/schemas';
import type { ExportAsset } from './types.js';

// Create a minimal valid PNG
const createMinimalPng = (): Uint8Array => {
  // PNG signature + minimal IHDR + IEND
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR chunk (13 bytes data)
  const ihdrLength = new Uint8Array([0x00, 0x00, 0x00, 0x0d]);
  const ihdrType = new Uint8Array([0x49, 0x48, 0x44, 0x52]);
  const ihdrData = new Uint8Array([
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, // bit depth: 8
    0x02, // color type: RGB
    0x00, // compression: deflate
    0x00, // filter: adaptive
    0x00, // interlace: none
  ]);
  const ihdrCrc = new Uint8Array([0x90, 0x77, 0x53, 0xde]); // Pre-calculated

  // IEND chunk
  const iendLength = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const iendType = new Uint8Array([0x49, 0x45, 0x4e, 0x44]);
  const iendCrc = new Uint8Array([0xae, 0x42, 0x60, 0x82]);

  const totalLength = signature.length + ihdrLength.length + ihdrType.length +
    ihdrData.length + ihdrCrc.length + iendLength.length + iendType.length + iendCrc.length;

  const png = new Uint8Array(totalLength);
  let offset = 0;

  png.set(signature, offset); offset += signature.length;
  png.set(ihdrLength, offset); offset += ihdrLength.length;
  png.set(ihdrType, offset); offset += ihdrType.length;
  png.set(ihdrData, offset); offset += ihdrData.length;
  png.set(ihdrCrc, offset); offset += ihdrCrc.length;
  png.set(iendLength, offset); offset += iendLength.length;
  png.set(iendType, offset); offset += iendType.length;
  png.set(iendCrc, offset);

  return png;
};

const testCard: CCv3Data = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: 'Export Test',
    description: 'A test character for export',
    personality: 'Test personality',
    scenario: 'Test scenario',
    first_mes: 'Hello, this is a test!',
    mes_example: '{{user}}: Test\n{{char}}: Response',
    creator_notes: 'Created for testing',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    group_only_greetings: [],
    tags: ['test'],
    creator: 'Test Suite',
    character_version: '1.0',
    extensions: {},
  },
};

const testAsset: ExportAsset = {
  name: 'main',
  type: 'icon',
  ext: 'png',
  data: createMinimalPng(),
  isMain: true,
};

describe('exportCard', () => {
  describe('PNG export', () => {
    it('should export to PNG format', () => {
      const result = exportCard(testCard, [testAsset], { format: 'png' });

      expect(result.format).toBe('png');
      expect(result.mimeType).toBe('image/png');
      expect(result.filename).toBe('Export_Test.png');
      expect(result.buffer.length).toBeGreaterThan(0);
      // Check PNG signature
      expect(result.buffer[0]).toBe(0x89);
      expect(result.buffer[1]).toBe(0x50);
    });

    it('should throw without icon asset', () => {
      expect(() => exportCard(testCard, [], { format: 'png' })).toThrow();
    });
  });

  describe('CharX export', () => {
    it('should export to CharX format', () => {
      const result = exportCard(testCard, [testAsset], { format: 'charx' });

      expect(result.format).toBe('charx');
      expect(result.mimeType).toBe('application/zip');
      expect(result.filename).toBe('Export_Test.charx');
      expect(result.buffer.length).toBeGreaterThan(0);
      // Check ZIP signature
      expect(result.buffer[0]).toBe(0x50);
      expect(result.buffer[1]).toBe(0x4b);
    });

    it('should include asset count', () => {
      const result = exportCard(testCard, [testAsset], { format: 'charx' });

      expect(result.assetCount).toBe(1);
    });

    it('should include module.risum when exporting Risu CharX', () => {
      const moduleRisum = new Uint8Array([0x01, 0x02, 0x03]);
      const result = exportCard(testCard, [testAsset], {
        format: 'charx',
        charx: { spec: 'risu', moduleRisum },
      });

      const files = unzipSync(result.buffer);
      expect(files['module.risum']).toBeDefined();
      expect(files['module.risum']).toEqual(moduleRisum);
    });

    it('should NOT include module.risum when exporting standard CharX', () => {
      const moduleRisum = new Uint8Array([0x01, 0x02, 0x03]);
      const result = exportCard(testCard, [testAsset], {
        format: 'charx',
        charx: { spec: 'v3', moduleRisum },
      });

      const files = unzipSync(result.buffer);
      expect(files['module.risum']).toBeUndefined();
    });
  });

  describe('Voxta export', () => {
    it('should export to Voxta format', () => {
      const result = exportCard(testCard, [testAsset], { format: 'voxta' });

      expect(result.format).toBe('voxta');
      expect(result.mimeType).toBe('application/zip');
      expect(result.filename).toBe('Export_Test.voxpkg');
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Loss reporting', () => {
    it('should include loss report by default', () => {
      const result = exportCard(testCard, [testAsset], { format: 'png' });

      expect(result.lossReport).toBeDefined();
    });

    it('should skip loss report when disabled', () => {
      const result = exportCard(testCard, [testAsset], {
        format: 'png',
        png: { checkLoss: false },
      });

      expect(result.lossReport).toBeUndefined();
    });
  });
});

describe('getSupportedFormats', () => {
  it('should return all supported formats', () => {
    const formats = getSupportedFormats();

    expect(formats).toContain('png');
    expect(formats).toContain('charx');
    expect(formats).toContain('voxta');
  });
});

describe('getFormatExtension', () => {
  it('should return correct extensions', () => {
    expect(getFormatExtension('png')).toBe('png');
    expect(getFormatExtension('charx')).toBe('charx');
    expect(getFormatExtension('voxta')).toBe('voxpkg');
  });
});

describe('getFormatMimeType', () => {
  it('should return correct MIME types', () => {
    expect(getFormatMimeType('png')).toBe('image/png');
    expect(getFormatMimeType('charx')).toBe('application/zip');
    expect(getFormatMimeType('voxta')).toBe('application/zip');
  });
});
