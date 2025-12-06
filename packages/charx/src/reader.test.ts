/**
 * CharX Reader Tests
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import { isCharX, isJpegCharX, readCharX } from './reader.js';

describe('isCharX', () => {
  it('should detect valid CharX ZIP', () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Test',
        description: 'A test character',
      },
    };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
    });

    expect(isCharX(zipData)).toBe(true);
  });

  it('should reject ZIP without card.json', () => {
    const zipData = zipSync({
      'other.json': fromString('{}'),
    });

    expect(isCharX(zipData)).toBe(false);
  });

  it('should reject non-ZIP data', () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(isCharX(data)).toBe(false);
  });

  it('should reject empty data', () => {
    expect(isCharX(new Uint8Array(0))).toBe(false);
  });
});

describe('isJpegCharX', () => {
  it('should detect JPEG with appended ZIP', () => {
    // Create minimal JPEG header + EOI + ZIP
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegEoi = new Uint8Array([0xff, 0xd9]);

    const card = { spec: 'chara_card_v3', data: { name: 'Test' } };
    const zipData = zipSync({ 'card.json': fromString(JSON.stringify(card)) });

    // Combine: JPEG header + EOI + ZIP
    const combined = new Uint8Array(jpegHeader.length + jpegEoi.length + zipData.length);
    combined.set(jpegHeader, 0);
    combined.set(jpegEoi, jpegHeader.length);
    combined.set(zipData, jpegHeader.length + jpegEoi.length);

    expect(isJpegCharX(combined)).toBe(true);
  });

  it('should reject plain JPEG without ZIP', () => {
    const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    expect(isJpegCharX(jpegData)).toBe(false);
  });

  it('should reject non-JPEG data', () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(isJpegCharX(data)).toBe(false);
  });
});

describe('readCharX', () => {
  it('should read card.json from CharX', () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Alice',
        description: 'A helpful assistant',
        personality: 'Friendly',
        scenario: 'Chat',
        first_mes: 'Hello!',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        group_only_greetings: [],
        tags: ['friendly'],
        creator: 'Test',
        character_version: '1.0',
        extensions: {},
      },
    };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
    });

    const result = readCharX(zipData);

    expect(result.card.spec).toBe('chara_card_v3');
    expect(result.card.data.name).toBe('Alice');
    expect(result.card.data.description).toBe('A helpful assistant');
  });

  it('should extract assets from assets/ folder', () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Test',
        extensions: {},
        assets: [{
          type: 'icon',
          uri: 'embeded://assets/icon/images/main.png',
          name: 'main',
          ext: 'png',
        }],
      },
    };

    const iconData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
      'assets/icon/images/main.png': iconData,
    });

    const result = readCharX(zipData);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0]!.path).toBe('assets/icon/images/main.png');
    expect(result.assets[0]!.descriptor.name).toBe('main');
  });

  it('should read x_meta folder when present', () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: { name: 'Test', extensions: {} },
    };

    const metaData = { type: 'PNG' };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
      'x_meta/0.json': fromString(JSON.stringify(metaData)),
    });

    const result = readCharX(zipData);

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.get(0)).toBeDefined();
    expect(result.metadata!.get(0)!.type).toBe('PNG');
  });

  it('should throw on missing card.json', () => {
    const zipData = zipSync({
      'other.txt': fromString('hello'),
    });

    expect(() => readCharX(zipData)).toThrow();
  });

  it('should throw on invalid JSON', () => {
    const zipData = zipSync({
      'card.json': fromString('not valid json'),
    });

    expect(() => readCharX(zipData)).toThrow();
  });

  it('should detect Risu format from module.risum', () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: { name: 'Test', extensions: {} },
    };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
      'module.risum': new Uint8Array([0x01, 0x02, 0x03]),
    });

    const result = readCharX(zipData);

    expect(result.isRisuFormat).toBe(true);
    expect(result.moduleRisum).toBeDefined();
  });
});
