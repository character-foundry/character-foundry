/**
 * CardNormalizer Tests
 */

import { describe, it, expect } from 'vitest';
import { CardNormalizer } from './normalizer.js';
import type { CCv3Data } from './ccv3.js';
import type { CCv2Wrapped } from './ccv2.js';

describe('CardNormalizer', () => {
  describe('normalize', () => {
    it('should fix ChubAI hybrid format (fields at root level)', () => {
      const input = {
        spec: 'chara_card_v2',
        name: 'Test Character',
        description: 'A test description',
        data: { personality: 'Existing personality' },
      };

      const result = CardNormalizer.normalize(input, 'v2') as CCv2Wrapped;

      expect(result.spec).toBe('chara_card_v2');
      expect(result.data.name).toBe('Test Character');
      expect(result.data.description).toBe('A test description');
      expect(result.data.personality).toBe('Existing personality');
      // Root level fields should not exist
      expect((result as Record<string, unknown>).name).toBeUndefined();
    });

    it('should add missing V3 required fields', () => {
      const input = {
        spec: 'chara_card_v3',
        data: { name: 'Test' },
      };

      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;

      expect(result.data.name).toBe('Test');
      expect(result.data.group_only_greetings).toEqual([]);
      expect(result.data.creator).toBe('');
      expect(result.data.character_version).toBe('1.0');
      expect(result.data.tags).toEqual([]);
      expect(result.data.description).toBe('');
      expect(result.data.personality).toBe('');
      expect(result.data.scenario).toBe('');
      expect(result.data.first_mes).toBe('');
      expect(result.data.mes_example).toBe('');
    });

    it('should add missing V2 required fields', () => {
      const input = {
        spec: 'chara_card_v2',
        data: { name: 'Test' },
      };

      const result = CardNormalizer.normalize(input, 'v2') as CCv2Wrapped;

      expect(result.data.name).toBe('Test');
      expect(result.data.description).toBe('');
      expect(result.data.personality).toBe('');
      expect(result.data.scenario).toBe('');
      expect(result.data.first_mes).toBe('');
      expect(result.data.mes_example).toBe('');
    });

    it('should set correct spec and spec_version for V3', () => {
      const input = { data: { name: 'Test' } };

      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;

      expect(result.spec).toBe('chara_card_v3');
      expect(result.spec_version).toBe('3.0');
    });

    it('should set correct spec and spec_version for V2', () => {
      const input = { data: { name: 'Test' } };

      const result = CardNormalizer.normalize(input, 'v2') as CCv2Wrapped;

      expect(result.spec).toBe('chara_card_v2');
      expect(result.spec_version).toBe('2.0');
    });

    it('should handle null character_book by removing it', () => {
      const input = {
        spec: 'chara_card_v3',
        data: {
          name: 'Test',
          character_book: null,
        },
      };

      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;

      expect(result.data.character_book).toBeUndefined();
    });

    it('should handle invalid input by returning minimal valid card', () => {
      const resultV3 = CardNormalizer.normalize(null, 'v3') as CCv3Data;
      expect(resultV3.spec).toBe('chara_card_v3');
      expect(resultV3.data.name).toBe('');

      const resultV2 = CardNormalizer.normalize(undefined, 'v2') as CCv2Wrapped;
      expect(resultV2.spec).toBe('chara_card_v2');
      expect(resultV2.data.name).toBe('');
    });

    it('should preserve existing data when merging root fields', () => {
      const input = {
        spec: 'chara_card_v2',
        name: 'Root Name',
        data: {
          name: 'Data Name', // Should take precedence
          description: 'Data Description',
        },
      };

      const result = CardNormalizer.normalize(input, 'v2') as CCv2Wrapped;

      expect(result.data.name).toBe('Data Name');
      expect(result.data.description).toBe('Data Description');
    });

    it('should convert non-array tags to empty array', () => {
      const input = {
        spec: 'chara_card_v3',
        data: {
          name: 'Test',
          tags: 'not-an-array',
        },
      };

      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;

      expect(result.data.tags).toEqual([]);
    });

    it('should not mutate the original input', () => {
      const input = {
        spec: 'chara_card_v3',
        data: {
          name: 'Test',
          tags: ['original'],
        },
      };

      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;
      result.data.tags.push('modified');

      expect(input.data.tags).toEqual(['original']);
    });
  });

  describe('normalizeCharacterBook', () => {
    it('should convert numeric position to string enum', () => {
      const book = {
        entries: [
          { keys: ['test'], content: 'Test content', position: 0 },
          { keys: ['test2'], content: 'Test content 2', position: 1 },
        ],
      };

      const result = CardNormalizer.normalizeCharacterBook(book, 'v3');

      expect(result.entries[0]?.position).toBe('before_char');
      expect(result.entries[1]?.position).toBe('after_char');
    });

    it('should preserve valid string position values', () => {
      const book = {
        entries: [{ keys: ['test'], content: 'Test', position: 'after_char' }],
      };

      const result = CardNormalizer.normalizeCharacterBook(book, 'v3');

      expect(result.entries[0]?.position).toBe('after_char');
    });

    it('should add default values for required entry fields', () => {
      const book = {
        entries: [{}], // Empty entry
      };

      const result = CardNormalizer.normalizeCharacterBook(book, 'v3');

      expect(result.entries[0]?.keys).toEqual([]);
      expect(result.entries[0]?.content).toBe('');
      expect(result.entries[0]?.enabled).toBe(true);
      expect(result.entries[0]?.insertion_order).toBe(0);
    });

    it('should move V3-only fields to extensions for V2', () => {
      const book = {
        entries: [
          {
            keys: ['test'],
            content: 'Test',
            probability: 100,
            depth: 4,
            group: 'test-group',
          },
        ],
      };

      const result = CardNormalizer.normalizeCharacterBook(book, 'v2');
      const entry = result.entries[0];

      // V3 fields should be in extensions, not at root
      expect((entry as Record<string, unknown>).probability).toBeUndefined();
      expect((entry as Record<string, unknown>).depth).toBeUndefined();
      expect((entry as Record<string, unknown>).group).toBeUndefined();

      // Should be in extensions
      expect(entry?.extensions?.probability).toBe(100);
      expect(entry?.extensions?.depth).toBe(4);
      expect(entry?.extensions?.group).toBe('test-group');
    });

    it('should preserve V3 fields for V3 spec', () => {
      const book = {
        entries: [
          {
            keys: ['test'],
            content: 'Test',
            probability: 100,
            depth: 4,
            role: 'system',
          },
        ],
      };

      const result = CardNormalizer.normalizeCharacterBook(book, 'v3');
      const entry = result.entries[0] as Record<string, unknown>;

      expect(entry.probability).toBe(100);
      expect(entry.depth).toBe(4);
      expect(entry.role).toBe('system');
    });

    it('should copy book-level fields', () => {
      const book = {
        name: 'Test Book',
        description: 'A test lorebook',
        scan_depth: 1000,
        token_budget: 2048,
        recursive_scanning: true,
        entries: [],
      };

      const result = CardNormalizer.normalizeCharacterBook(book, 'v3');

      expect(result.name).toBe('Test Book');
      expect(result.description).toBe('A test lorebook');
      expect(result.scan_depth).toBe(1000);
      expect(result.token_budget).toBe(2048);
      expect(result.recursive_scanning).toBe(true);
    });
  });

  describe('normalizeEntry', () => {
    it('should handle all optional fields', () => {
      const entry = {
        keys: ['key1', 'key2'],
        content: 'Content',
        enabled: true,
        insertion_order: 5,
        case_sensitive: true,
        name: 'Entry Name',
        priority: 10,
        id: 123,
        comment: 'A comment',
        selective: true,
        secondary_keys: ['sec1', 'sec2'],
        constant: true,
        position: 'after_char',
      };

      const result = CardNormalizer.normalizeEntry(entry, 'v3') as Record<string, unknown>;

      expect(result.keys).toEqual(['key1', 'key2']);
      expect(result.content).toBe('Content');
      expect(result.enabled).toBe(true);
      expect(result.insertion_order).toBe(5);
      expect(result.case_sensitive).toBe(true);
      expect(result.name).toBe('Entry Name');
      expect(result.priority).toBe(10);
      expect(result.id).toBe(123);
      expect(result.comment).toBe('A comment');
      expect(result.selective).toBe(true);
      expect(result.secondary_keys).toEqual(['sec1', 'sec2']);
      expect(result.constant).toBe(true);
      expect(result.position).toBe('after_char');
    });

    it('should require extensions field for V2 entries', () => {
      const entry = { keys: ['test'], content: 'Test' };

      const result = CardNormalizer.normalizeEntry(entry, 'v2');

      expect(result.extensions).toBeDefined();
      expect(result.extensions).toEqual({});
    });
  });

  describe('fixTimestamps', () => {
    it('should convert milliseconds to seconds for creation_date', () => {
      const data: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: '',
          personality: '',
          scenario: '',
          first_mes: '',
          mes_example: '',
          creator: '',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
          creation_date: 1702123456789, // Milliseconds
        },
      };

      const result = CardNormalizer.fixTimestamps(data);

      expect(result.data.creation_date).toBe(1702123456);
    });

    it('should convert milliseconds to seconds for modification_date', () => {
      const data: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: '',
          personality: '',
          scenario: '',
          first_mes: '',
          mes_example: '',
          creator: '',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
          modification_date: 1702123456789,
        },
      };

      const result = CardNormalizer.fixTimestamps(data);

      expect(result.data.modification_date).toBe(1702123456);
    });

    it('should not modify timestamps already in seconds', () => {
      const data: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: '',
          personality: '',
          scenario: '',
          first_mes: '',
          mes_example: '',
          creator: '',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
          creation_date: 1702123456, // Already seconds
        },
      };

      const result = CardNormalizer.fixTimestamps(data);

      expect(result.data.creation_date).toBe(1702123456);
    });

    it('should not mutate the original data', () => {
      const original: CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          description: '',
          personality: '',
          scenario: '',
          first_mes: '',
          mes_example: '',
          creator: '',
          character_version: '1.0',
          tags: [],
          group_only_greetings: [],
          creation_date: 1702123456789,
        },
      };

      CardNormalizer.fixTimestamps(original);

      expect(original.data.creation_date).toBe(1702123456789);
    });
  });

  describe('autoNormalize', () => {
    it('should auto-detect V3 and normalize', () => {
      const input = {
        spec: 'chara_card_v3',
        data: { name: 'Test' },
      };

      const result = CardNormalizer.autoNormalize(input) as CCv3Data;

      expect(result?.spec).toBe('chara_card_v3');
      expect(result?.data.group_only_greetings).toEqual([]);
    });

    it('should auto-detect V2 and normalize', () => {
      const input = {
        spec: 'chara_card_v2',
        data: { name: 'Test' },
      };

      const result = CardNormalizer.autoNormalize(input) as CCv2Wrapped;

      expect(result?.spec).toBe('chara_card_v2');
    });

    it('should return null for non-card data', () => {
      expect(CardNormalizer.autoNormalize({ foo: 'bar' })).toBeNull();
      expect(CardNormalizer.autoNormalize(null)).toBeNull();
      expect(CardNormalizer.autoNormalize('string')).toBeNull();
    });

    it('should upgrade V1 (unwrapped) to V2', () => {
      const input = {
        name: 'Test',
        description: 'A test character',
        personality: 'Friendly',
      };

      const result = CardNormalizer.autoNormalize(input) as CCv2Wrapped;

      expect(result?.spec).toBe('chara_card_v2');
      expect(result?.data.name).toBe('Test');
    });
  });

  describe('edge cases', () => {
    it('should handle extensions deep cloning', () => {
      const input = {
        spec: 'chara_card_v3',
        data: {
          name: 'Test',
          extensions: {
            nested: { deep: { value: 'original' } },
          },
        },
      };

      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;

      // Modify the result
      if (result.data.extensions?.nested) {
        (result.data.extensions.nested as Record<string, unknown>).deep = 'modified';
      }

      // Original should be unchanged
      expect((input.data.extensions.nested as Record<string, unknown>).deep).toEqual({ value: 'original' });
    });

    it('should handle character_book with non-array entries', () => {
      const input = {
        spec: 'chara_card_v3',
        data: {
          name: 'Test',
          character_book: {
            entries: 'not-an-array',
          },
        },
      };

      const result = CardNormalizer.normalize(input, 'v3') as CCv3Data;

      expect(result.data.character_book?.entries).toEqual([]);
    });

    it('should handle secondary_keys non-array conversion', () => {
      const entry = {
        keys: ['test'],
        content: 'Test',
        secondary_keys: 'not-an-array',
      };

      const result = CardNormalizer.normalizeEntry(entry, 'v3') as Record<string, unknown>;

      expect(result.secondary_keys).toEqual([]);
    });
  });
});
