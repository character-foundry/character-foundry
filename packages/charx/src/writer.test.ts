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

  it.each([
    ['main', 'main', 'main', 'main'],
    ['happy.face', 'happy_face', 'happy-face', 'happy-face-2'],
    ['Happy', 'happy', 'HAPPY', 'happy-2'],
  ])('preserves each colliding image in the archive and its descriptor: %s', (...names) => {
    const assets = names.map((name, index) => ({
      name, type: 'icon', ext: 'png', data: new Uint8Array([index + 1]),
    }));
    const original = structuredClone(assets);
    const result = writeCharX(testCard, assets, { spec: 'risu' });
    const files = unzipSync(result.buffer);
    const parsed = readCharX(result.buffer);
    const descriptors = parsed.card.data.assets!;

    expect(Object.keys(files).filter(path => path.startsWith('assets/'))).toHaveLength(assets.length);
    expect(new Set(descriptors.map(asset => asset.uri.toLowerCase())).size).toBe(assets.length);
    expect(new Set(descriptors.map(asset => asset.name.toLowerCase())).size).toBe(assets.length);
    expect(parsed.assets.map(asset => asset.buffer)).toEqual(assets.map(asset => asset.data));
    expect(parsed.metadata?.size).toBe(assets.length);
    expect(result.assetCount).toBe(assets.length);
    expect(assets).toEqual(original);
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

describe('preserveDescriptors', () => {
  const bytes = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]), new Uint8Array([7, 8, 9])];
  const names = ['Same.Name', 'same_name', 'same-name'];
  const assets = names.map((name, index) => ({ name, ext: 'PNG', type: 'icon', data: bytes[index]! }));
  function card() {
    return { spec: 'chara_card_v3', spec_version: '3.0', opaque_envelope: { keep: true }, data: {
      name: 'Preserved', extensions: { vendor: { keep: [null, true] } },
      assets: names.map((name, index) => ({ name, ext: 'PNG', type: 'icon', uri: `https://example.test/${index}.png`,
        vendor: { position: index, license: ['keep', null] }, tags: ['portrait'], geometry: { width: 7 } })),
    } } as unknown as CCv3Data;
  }
  it('retains opaque descriptor fields and authored names while allocating distinct safe ZIP paths', () => {
    const input = card(); const before = structuredClone(input);
    const output = writeCharX(input, assets, { preserveDescriptors: true });
    const read = readCharX(output.buffer);
    expect(output.assetCount).toBe(3); expect(read.assets).toHaveLength(3);
    expect(new Set(read.assets.map((asset) => asset.path.toLowerCase())).size).toBe(3);
    for (let index = 0; index < assets.length; index++) {
      expect(read.assets[index]!.buffer).toEqual(bytes[index]);
      expect(read.card.data.assets![index]).toEqual({ ...before.data.assets![index], uri: read.card.data.assets![index]!.uri });
      expect(read.card.data.assets![index]!.uri).toMatch(/^embeded:\/\/assets\/icon\/images\/[A-Za-z0-9-]+\.png$/);
    }
    expect(read.card).toEqual({ ...before, data: { ...before.data, assets: read.card.data.assets } });
    expect(input).toEqual(before);
  });
  it('rejects missing, extra, reordered and relabeled bindings instead of guessing correspondence', () => {
    for (const value of [assets.slice(1), [...assets, assets[0]!], [...assets].reverse(), assets.map((asset) => ({ ...asset, ext: 'png' }))]) {
      expect(() => writeCharX(card(), value, { preserveDescriptors: true })).toThrow(/Preserving CharX export/);
    }
    const input = card(); input.data.assets![0]!.uri = undefined as unknown as string;
    expect(() => writeCharX(input, assets, { preserveDescriptors: true })).toThrow(/exact descriptor/);
  });
  it('preserves missing versus empty descriptors while keeping legacy generation available', () => {
    const input = card(); delete input.data.assets;
    expect(readCharX(writeCharX(input, [], { preserveDescriptors: true }).buffer).card.data).not.toHaveProperty('assets');
    input.data.assets = [];
    expect(readCharX(writeCharX(input, [], { preserveDescriptors: true }).buffer).card.data.assets).toEqual([]);
    const generated = readCharX(writeCharX(card(), assets).buffer).card.data.assets!;
    expect(generated[0]!.name).toBe('Same-Name'); expect(generated[0]).not.toHaveProperty('vendor');
  });
});
