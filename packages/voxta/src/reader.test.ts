/**
 * Voxta Reader Tests
 *
 * Tests for isVoxta() detection and readVoxta() parsing.
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import { isVoxta, readVoxta } from './reader.js';

describe('isVoxta', () => {
  it('should detect Voxta package with package.json', () => {
    const pkg = {
      Id: 'test-pkg',
      Name: 'Test Package',
    };

    const zipData = zipSync({
      'package.json': fromString(JSON.stringify(pkg)),
    });

    expect(isVoxta(zipData)).toBe(true);
  });

  it('should detect Voxta package with Characters directory', () => {
    const character = {
      $type: 'character',
      Id: 'char-123',
      Name: 'Test Character',
    };

    const zipData = zipSync({
      'Characters/char-123/character.json': fromString(JSON.stringify(character)),
    });

    expect(isVoxta(zipData)).toBe(true);
  });

  it('should detect Voxta package with MemoryBooks directory', () => {
    const book = {
      $type: 'memoryBook',
      Id: 'book-123',
      Name: 'Test Book',
    };

    const zipData = zipSync({
      'MemoryBooks/book-123/book.json': fromString(JSON.stringify(book)),
    });

    expect(isVoxta(zipData)).toBe(true);
  });

  it('should detect Voxta package with Scenarios directory', () => {
    const scenario = {
      $type: 'scenario',
      Id: 'scenario-123',
      Name: 'Test Scenario',
    };

    const zipData = zipSync({
      'Scenarios/scenario-123/scenario.json': fromString(JSON.stringify(scenario)),
    });

    expect(isVoxta(zipData)).toBe(true);
  });

  it('should detect Voxta package with character.json at root', () => {
    const character = {
      $type: 'character',
      Id: 'char-123',
      Name: 'Test Character',
    };

    const zipData = zipSync({
      'character.json': fromString(JSON.stringify(character)),
    });

    expect(isVoxta(zipData)).toBe(true);
  });

  it('should detect large Voxta package (issue #4 regression)', () => {
    // Create a package with many files to push the central directory
    // far into the file (beyond the old 2000 byte limit)
    const character = {
      $type: 'character',
      Id: 'char-123',
      Name: 'Test Character',
    };

    const files: Record<string, Uint8Array> = {};

    // Add many "asset" files to push the central directory beyond 2000 bytes
    for (let i = 0; i < 50; i++) {
      files[`Characters/char-123/Assets/asset_${i.toString().padStart(3, '0')}.dat`] =
        fromString(`Asset data ${i}: ${'x'.repeat(100)}`);
    }

    // Add the character.json last
    files['Characters/char-123/character.json'] = fromString(JSON.stringify(character));

    const zipData = zipSync(files);

    // The ZIP should be larger than 2000 bytes
    expect(zipData.length).toBeGreaterThan(2000);

    // Detection should still work
    expect(isVoxta(zipData)).toBe(true);
  });

  it('should reject ZIP without Voxta markers', () => {
    const zipData = zipSync({
      'random.txt': fromString('Hello world'),
      'data.json': fromString('{"foo": "bar"}'),
    });

    expect(isVoxta(zipData)).toBe(false);
  });

  it('should reject CharX packages', () => {
    const card = {
      spec: 'chara_card_v3',
      data: { name: 'Test' },
    };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
    });

    expect(isVoxta(zipData)).toBe(false);
  });

  it('should reject non-ZIP data', () => {
    const notZip = fromString('This is not a ZIP file');

    expect(isVoxta(notZip)).toBe(false);
  });

  it('should reject empty data', () => {
    expect(isVoxta(new Uint8Array(0))).toBe(false);
  });
});

describe('readVoxta', () => {
  it('should read package with single character', () => {
    const character = {
      $type: 'character',
      Id: 'char-123',
      Name: 'Test Character',
      Description: 'A test character',
    };

    const zipData = zipSync({
      'Characters/char-123/character.json': fromString(JSON.stringify(character)),
    });

    const result = readVoxta(zipData);

    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].id).toBe('char-123');
    expect(result.characters[0].data.Name).toBe('Test Character');
  });

  it('should read package metadata', () => {
    const pkg = {
      Id: 'pkg-123',
      Name: 'Test Package',
      Version: '1.0.0',
    };

    const character = {
      $type: 'character',
      Id: 'char-123',
      Name: 'Test Character',
    };

    const zipData = zipSync({
      'package.json': fromString(JSON.stringify(pkg)),
      'Characters/char-123/character.json': fromString(JSON.stringify(character)),
    });

    const result = readVoxta(zipData);

    expect(result.package).toBeDefined();
    expect(result.package?.Id).toBe('pkg-123');
    expect(result.package?.Name).toBe('Test Package');
  });

  it('should read multiple characters', () => {
    const char1 = { $type: 'character', Id: 'char-1', Name: 'Character 1' };
    const char2 = { $type: 'character', Id: 'char-2', Name: 'Character 2' };

    const zipData = zipSync({
      'Characters/char-1/character.json': fromString(JSON.stringify(char1)),
      'Characters/char-2/character.json': fromString(JSON.stringify(char2)),
    });

    const result = readVoxta(zipData);

    expect(result.characters).toHaveLength(2);
    expect(result.characters.map(c => c.data.Name).sort()).toEqual(['Character 1', 'Character 2']);
  });

  it('should read books', () => {
    const book = {
      $type: 'memoryBook',
      Id: 'book-123',
      Name: 'Test Book',
      Entries: [],
    };

    const zipData = zipSync({
      'Books/book-123/book.json': fromString(JSON.stringify(book)),
    });

    const result = readVoxta(zipData);

    expect(result.books).toHaveLength(1);
    expect(result.books[0].id).toBe('book-123');
    expect(result.books[0].data.Name).toBe('Test Book');
  });

  it('should read scenarios', () => {
    const scenario = {
      $type: 'scenario',
      Id: 'scenario-123',
      Name: 'Test Scenario',
    };

    const zipData = zipSync({
      'Scenarios/scenario-123/scenario.json': fromString(JSON.stringify(scenario)),
    });

    const result = readVoxta(zipData);

    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].id).toBe('scenario-123');
    expect(result.scenarios[0].data.Name).toBe('Test Scenario');
  });
});
