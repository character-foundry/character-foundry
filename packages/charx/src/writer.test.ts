/**
 * CharX Writer Tests
 */

import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { toString } from '@character-foundry/core';
import { writeCharX } from './writer.js';
import { readCharX } from './reader.js';
import type { CCv3Data } from '@character-foundry/schemas';

describe('writeCharX', () => {
  const testCard: CCv3Data = {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Test Character',
      description: 'A test character for unit tests',
      personality: 'Friendly',
      scenario: 'Testing',
      first_mes: 'Hello, I am a test!',
      mes_example: '',
      creator_notes: 'Created for testing',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: ['Hi there!'],
      group_only_greetings: [],
      tags: ['test', 'unit-test'],
      creator: 'Test Suite',
      character_version: '1.0.0',
      extensions: {},
    },
  };

  it('should create valid CharX ZIP', () => {
    const result = writeCharX(testCard, []);

    expect(result.buffer).toBeInstanceOf(Uint8Array);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.assetCount).toBe(0);
  });

  it('should include card.json in ZIP', () => {
    const result = writeCharX(testCard, []);
    const unzipped = unzipSync(result.buffer);

    expect(unzipped['card.json']).toBeDefined();

    const cardJson = JSON.parse(toString(unzipped['card.json']!));
    expect(cardJson.spec).toBe('chara_card_v3');
    expect(cardJson.data.name).toBe('Test Character');
  });

  it('should include assets in assets/ folder with proper path structure', () => {
    const iconData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const assets = [
      { name: 'main', type: 'icon' as const, ext: 'png', data: iconData },
    ];

    const result = writeCharX(testCard, assets);
    const unzipped = unzipSync(result.buffer);

    // Writer uses assets/{type}/{category}/{name}.{ext} format
    expect(unzipped['assets/icon/images/main.png']).toBeDefined();
    expect(result.assetCount).toBe(1);
  });

  it('should round-trip through read/write', () => {
    const iconData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const assets = [
      { name: 'avatar', type: 'icon' as const, ext: 'png', data: iconData, isMain: true },
    ];

    const written = writeCharX(testCard, assets);
    const read = readCharX(written.buffer);

    expect(read.card.data.name).toBe(testCard.data.name);
    expect(read.card.data.description).toBe(testCard.data.description);
    expect(read.assets.length).toBe(1);
    // The reader extracts the name from the path
    expect(read.assets[0]!.path).toContain('avatar');
  });

  it('should handle x_meta when spec is risu', () => {
    const iconData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const assets = [
      { name: 'icon', type: 'icon' as const, ext: 'png', data: iconData },
    ];

    const result = writeCharX(testCard, assets, { spec: 'risu' });
    const unzipped = unzipSync(result.buffer);

    // x_meta folder should exist for image assets
    const hasXMeta = Object.keys(unzipped).some((k) => k.startsWith('x_meta/'));
    expect(hasXMeta).toBe(true);
  });

  it('should respect compression level', () => {
    const assets = [
      { name: 'large', type: 'icon' as const, ext: 'png', data: new Uint8Array(10000).fill(0) },
    ];

    const compressed = writeCharX(testCard, assets, { compressionLevel: 9 });
    const uncompressed = writeCharX(testCard, assets, { compressionLevel: 0 });

    // Compressed should be smaller for repetitive data
    expect(compressed.buffer.length).toBeLessThan(uncompressed.buffer.length);
  });

  it('should preserve non-whitelisted extensions', () => {
    const scriptData = new Uint8Array([0x63, 0x6f, 0x6e, 0x73, 0x6f, 0x6c, 0x65]); // "console"
    const assets = [
      { name: 'startup', type: 'data' as const, ext: 'js', data: scriptData },
    ];

    const result = writeCharX(testCard, assets);
    const unzipped = unzipSync(result.buffer);

    expect(unzipped['assets/data/other/startup.js']).toBeDefined();
  });

  it('should reject unsafe extensions that could cause path traversal', () => {
    const assets = [
      { name: 'evil', type: 'data' as const, ext: '../pwned', data: new Uint8Array([1]) },
    ];

    expect(() => writeCharX(testCard, assets)).toThrow(/extension/i);
  });
});
