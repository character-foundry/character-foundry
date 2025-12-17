/**
 * Voxta Writer Tests
 *
 * Tests for writeVoxta() package building.
 */

import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import type { CCv3Data } from '@character-foundry/schemas';
import { writeVoxta } from './writer.js';

function createTestCard(overrides: Partial<CCv3Data['data']> = {}): CCv3Data {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Test Character',
      description: 'A test character',
      personality: 'Friendly',
      scenario: 'Testing',
      first_mes: 'Hello!',
      mes_example: '',
      tags: [],
      creator: 'Test',
      ...overrides,
    },
  };
}

describe('writeVoxta', () => {
  it('should create character export without package.json when includePackageJson is false', () => {
    const card = createTestCard();
    const result = writeVoxta(card, [], { includePackageJson: false });

    const files = unzipSync(result.buffer);
    const filenames = Object.keys(files);

    expect(filenames.some((f) => f.startsWith('Characters/'))).toBe(true);
    expect(filenames.some((f) => f === 'package.json')).toBe(false);
  });

  it('should create package export with package.json when includePackageJson is true', () => {
    const card = createTestCard();
    const result = writeVoxta(card, [], { includePackageJson: true });

    const files = unzipSync(result.buffer);
    const filenames = Object.keys(files);

    expect(filenames.some((f) => f.startsWith('Characters/'))).toBe(true);
    expect(filenames.some((f) => f === 'package.json')).toBe(true);
  });

  describe('issue #16: includePackageJson should not be forced when lorebook exists', () => {
    it('should respect includePackageJson: false even with lorebook', () => {
      const card = createTestCard({
        character_book: {
          name: 'Test Lorebook',
          entries: [
            {
              keys: ['test'],
              content: 'Test entry',
              enabled: true,
              insertion_order: 0,
            },
          ],
        },
      });

      const result = writeVoxta(card, [], { includePackageJson: false });

      const files = unzipSync(result.buffer);
      const filenames = Object.keys(files);

      // Should have character
      expect(filenames.some((f) => f.startsWith('Characters/'))).toBe(true);

      // Should have book (lorebook data)
      expect(filenames.some((f) => f.startsWith('Books/'))).toBe(true);

      // Should NOT have package.json - this was the bug
      expect(filenames.some((f) => f === 'package.json')).toBe(false);
    });

    it('should include lorebook in Books folder for character export', () => {
      const card = createTestCard({
        character_book: {
          name: 'My Lorebook',
          entries: [
            {
              keys: ['keyword1', 'keyword2'],
              content: 'Lore content here',
              enabled: true,
              insertion_order: 0,
            },
          ],
        },
      });

      const result = writeVoxta(card, [], { includePackageJson: false });

      const files = unzipSync(result.buffer);
      const filenames = Object.keys(files);

      // Find the book.json file
      const bookFile = filenames.find((f) => f.endsWith('/book.json'));
      expect(bookFile).toBeDefined();

      // Parse and verify
      const bookData = JSON.parse(new TextDecoder().decode(files[bookFile!]));
      expect(bookData.$type).toBe('book');
      expect(bookData.Name).toBe('My Lorebook');
      expect(bookData.Items).toHaveLength(1);
      expect(bookData.Items[0].Keywords).toEqual(['keyword1', 'keyword2']);
    });

    it('should reference lorebook in character MemoryBooks', () => {
      const card = createTestCard({
        character_book: {
          name: 'Referenced Book',
          entries: [
            {
              keys: ['ref'],
              content: 'Referenced content',
              enabled: true,
              insertion_order: 0,
            },
          ],
        },
      });

      const result = writeVoxta(card, [], { includePackageJson: false });

      const files = unzipSync(result.buffer);
      const filenames = Object.keys(files);

      // Find the character.json file
      const charFile = filenames.find((f) => f.endsWith('/character.json'));
      expect(charFile).toBeDefined();

      // Find the book.json file
      const bookFile = filenames.find((f) => f.endsWith('/book.json'));
      expect(bookFile).toBeDefined();

      // Parse both
      const charData = JSON.parse(new TextDecoder().decode(files[charFile!]));
      const bookData = JSON.parse(new TextDecoder().decode(files[bookFile!]));

      // Character should reference the book by ID
      expect(charData.MemoryBooks).toContain(bookData.Id);
    });
  });

  it('should preserve non-image extensions for misc assets', () => {
    const card = createTestCard();
    const characterId = '00000000-0000-4000-8000-000000000000';
    const packageId = '00000000-0000-4000-8000-000000000001';

    const result = writeVoxta(
      card,
      [
        {
          name: 'notes',
          type: 'data',
          ext: 'txt',
          data: new Uint8Array([0x68, 0x69]), // "hi"
        },
      ],
      { includePackageJson: false, characterId, packageId }
    );

    const files = unzipSync(result.buffer);
    expect(files[`Characters/${characterId}/Assets/Misc/notes.txt`]).toBeDefined();
  });

  it('should reject unsafe extensions that could cause path traversal', () => {
    const card = createTestCard();

    expect(() =>
      writeVoxta(card, [
        {
          name: 'evil',
          type: 'data',
          ext: '../pwned',
          data: new Uint8Array([1]),
        },
      ])
    ).toThrow(/extension/i);
  });
});
