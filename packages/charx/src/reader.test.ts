/**
 * CharX Reader Tests
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import { isCharX, isJpegCharX, readCharX } from './reader.js';

function forceZip64Archive(zipData: Uint8Array, totalEntries = 1): Uint8Array {
  const eocdOffset = zipData.length - 22;
  const inputView = new DataView(zipData.buffer, zipData.byteOffset, zipData.byteLength);
  const centralDirectorySize = inputView.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = inputView.getUint32(eocdOffset + 16, true);
  const result = new Uint8Array(zipData.length + 76);
  result.set(zipData.subarray(0, eocdOffset), 0);

  const resultView = new DataView(result.buffer);
  resultView.setUint32(eocdOffset, 0x06064b50, true);
  resultView.setBigUint64(eocdOffset + 4, 44n, true);
  resultView.setUint16(eocdOffset + 12, 45, true);
  resultView.setUint16(eocdOffset + 14, 45, true);
  resultView.setBigUint64(eocdOffset + 24, BigInt(totalEntries), true);
  resultView.setBigUint64(eocdOffset + 32, BigInt(totalEntries), true);
  resultView.setBigUint64(eocdOffset + 40, BigInt(centralDirectorySize), true);
  resultView.setBigUint64(eocdOffset + 48, BigInt(centralDirectoryOffset), true);

  const locatorOffset = eocdOffset + 56;
  resultView.setUint32(locatorOffset, 0x07064b50, true);
  resultView.setBigUint64(locatorOffset + 8, BigInt(eocdOffset), true);
  resultView.setUint32(locatorOffset + 16, 1, true);

  const classicEocdOffset = locatorOffset + 20;
  result.set(zipData.subarray(eocdOffset), classicEocdOffset);
  resultView.setUint16(classicEocdOffset + 8, 0xffff, true);
  resultView.setUint16(classicEocdOffset + 10, 0xffff, true);
  resultView.setUint32(classicEocdOffset + 12, 0xffffffff, true);
  resultView.setUint32(classicEocdOffset + 16, 0xffffffff, true);

  return result;
}

function prefixWithAbsoluteOffsets(zipData: Uint8Array, prefix: Uint8Array): Uint8Array {
  const eocdOffset = zipData.length - 22;
  const inputView = new DataView(zipData.buffer, zipData.byteOffset, zipData.byteLength);
  const zip64LocatorOffset = eocdOffset - 20;
  const hasZip64Locator = inputView.getUint32(zip64LocatorOffset, true) === 0x07064b50;
  const centralDirectoryOffset = hasZip64Locator
    ? Number(inputView.getBigUint64(Number(inputView.getBigUint64(zip64LocatorOffset + 8, true)) + 48, true))
    : inputView.getUint32(eocdOffset + 16, true);
  const result = new Uint8Array(prefix.length + zipData.length);
  result.set(prefix, 0);
  result.set(zipData, prefix.length);

  const resultView = new DataView(result.buffer);
  const shiftedEocdOffset = prefix.length + eocdOffset;
  if (hasZip64Locator) {
    const zip64LocatorOffset = shiftedEocdOffset - 20;
    const zip64RecordOffset = Number(inputView.getBigUint64(eocdOffset - 12, true));
    resultView.setBigUint64(zip64LocatorOffset + 8, BigInt(zip64RecordOffset + prefix.length), true);
    resultView.setBigUint64(
      prefix.length + zip64RecordOffset + 48,
      BigInt(centralDirectoryOffset + prefix.length),
      true
    );
  } else {
    resultView.setUint32(shiftedEocdOffset + 16, centralDirectoryOffset + prefix.length, true);
  }

  const centralDirectoryEntryOffset = prefix.length + centralDirectoryOffset;
  const localHeaderOffset = resultView.getUint32(centralDirectoryEntryOffset + 42, true);
  resultView.setUint32(
    centralDirectoryEntryOffset + 42,
    localHeaderOffset + prefix.length,
    true
  );

  return result;
}

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

  it('should detect prefixed CharX ZIPs with absolute archive offsets', () => {
    const zipData = zipSync({
      'card.json': fromString(JSON.stringify({
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: { name: 'Test' },
      })),
    });
    const prefixedZip = prefixWithAbsoluteOffsets(zipData, new Uint8Array([0xaa, 0xbb, 0xcc]));

    expect(isCharX(prefixedZip)).toBe(true);
    expect(readCharX(prefixedZip).card.data.name).toBe('Test');
  });

  it('should detect prefixed ZIP64 CharX archives with absolute archive offsets', () => {
    const zipData = forceZip64Archive(zipSync({
      'card.json': fromString(JSON.stringify({
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: { name: 'Test' },
      })),
    }));
    const prefixedZip = prefixWithAbsoluteOffsets(zipData, new Uint8Array([0xaa, 0xbb, 0xcc]));

    expect(isCharX(prefixedZip)).toBe(true);
    expect(readCharX(prefixedZip).card.data.name).toBe('Test');
  });

  it('should detect CharX ZIP64 archives', () => {
    const zipData = zipSync({
      'card.json': fromString(JSON.stringify({
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: { name: 'Test' },
      })),
    });

    expect(isCharX(forceZip64Archive(zipData))).toBe(true);
  });

  it('should detect classic ZIPs at the 65,535-entry boundary', () => {
    const files: Record<string, Uint8Array> = {
      'card.json': fromString(JSON.stringify({
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: { name: 'Test' },
      })),
    };

    for (let i = 0; i < 65_534; i++) {
      files[`assets/${i}.bin`] = new Uint8Array([0]);
    }

    const zipData = zipSync(files);
    expect(isCharX(zipData)).toBe(true);
  }, 15_000);

  it('should detect ZIP64 archives beyond the 65,535-entry boundary', () => {
    const files: Record<string, Uint8Array> = {
      'card.json': fromString(JSON.stringify({
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: { name: 'Test' },
      })),
    };

    for (let i = 0; i < 65_535; i++) {
      files[`assets/${i}.bin`] = new Uint8Array([0]);
    }

    const zipData = zipSync(files);
    expect(isCharX(forceZip64Archive(zipData, 65_536))).toBe(true);
  }, 15_000);

  it('should reject ZIP without card.json', () => {
    const zipData = zipSync({
      'other.json': fromString('{}'),
    });

    expect(isCharX(zipData)).toBe(false);
  });

  it('should detect card.json in a large central directory', () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: { name: 'Test' },
    };
    const files: Record<string, Uint8Array> = {
      'card.json': fromString(JSON.stringify(card)),
    };

    for (let i = 0; i < 2_000; i++) {
      files[`assets/emotion-${i}.png`] = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    }

    const zipData = zipSync(files);

    expect(zipData.length).toBeGreaterThan(64 * 1024);
    expect(isCharX(zipData)).toBe(true);
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
