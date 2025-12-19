/**
 * Common utilities and preprocessing tests
 */

import { describe, it, expect } from 'vitest';
import {
  preprocessTimestamp,
  preprocessNumeric,
  preprocessAssetType,
  AssetTypeSchema,
  AssetDescriptorSchema,
} from './common.js';
import { CCv3DataSchema, CCv3CharacterBookSchema, isV3Card } from './ccv3.js';
import { CCv2CharacterBookSchema, isWrappedV2 } from './ccv2.js';

describe('preprocessTimestamp', () => {
  it('passes through valid Unix seconds', () => {
    expect(preprocessTimestamp(1705314600)).toBe(1705314600);
  });

  it('converts milliseconds to seconds', () => {
    // 1705314600000 ms = 1705314600 seconds
    expect(preprocessTimestamp(1705314600000)).toBe(1705314600);
  });

  it('parses numeric strings', () => {
    expect(preprocessTimestamp('1705314600')).toBe(1705314600);
  });

  it('parses ISO date strings', () => {
    // 2024-01-15T10:30:00Z = 1705314600 seconds
    const result = preprocessTimestamp('2024-01-15T10:30:00.000Z');
    expect(result).toBe(1705314600);
  });

  it('parses ISO date strings without Z suffix', () => {
    const result = preprocessTimestamp('2024-01-15T10:30:00');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('returns undefined for negative timestamps (.NET default dates)', () => {
    // .NET default date (0001-01-01) produces -62135596800
    expect(preprocessTimestamp(-62135596800)).toBeUndefined();
  });

  it('returns undefined for null/undefined', () => {
    expect(preprocessTimestamp(null)).toBeUndefined();
    expect(preprocessTimestamp(undefined)).toBeUndefined();
  });

  it('returns undefined for empty strings', () => {
    expect(preprocessTimestamp('')).toBeUndefined();
    expect(preprocessTimestamp('   ')).toBeUndefined();
  });

  it('returns undefined for invalid date strings', () => {
    expect(preprocessTimestamp('not-a-date')).toBeUndefined();
    expect(preprocessTimestamp('invalid')).toBeUndefined();
  });

  it('returns undefined for objects/arrays', () => {
    expect(preprocessTimestamp({})).toBeUndefined();
    expect(preprocessTimestamp([])).toBeUndefined();
  });
});

describe('preprocessNumeric', () => {
  it('passes through valid numbers', () => {
    expect(preprocessNumeric(42)).toBe(42);
    expect(preprocessNumeric(3.14)).toBe(3.14);
    expect(preprocessNumeric(0)).toBe(0);
  });

  it('parses numeric strings', () => {
    expect(preprocessNumeric('42')).toBe(42);
    expect(preprocessNumeric('3.14')).toBe(3.14);
    expect(preprocessNumeric('  100  ')).toBe(100);
  });

  it('returns undefined for null/undefined', () => {
    expect(preprocessNumeric(null)).toBeUndefined();
    expect(preprocessNumeric(undefined)).toBeUndefined();
  });

  it('returns undefined for empty strings', () => {
    expect(preprocessNumeric('')).toBeUndefined();
    expect(preprocessNumeric('   ')).toBeUndefined();
  });

  it('returns undefined for non-numeric strings', () => {
    expect(preprocessNumeric('abc')).toBeUndefined();
    expect(preprocessNumeric('12abc')).toBeUndefined();
  });

  it('returns undefined for NaN', () => {
    expect(preprocessNumeric(NaN)).toBeUndefined();
  });
});

describe('preprocessAssetType', () => {
  it('passes through known asset types', () => {
    expect(preprocessAssetType('icon')).toBe('icon');
    expect(preprocessAssetType('background')).toBe('background');
    expect(preprocessAssetType('emotion')).toBe('emotion');
    expect(preprocessAssetType('custom')).toBe('custom');
    expect(preprocessAssetType('x-risu-asset')).toBe('x-risu-asset');
  });

  it('coerces unknown types to custom', () => {
    expect(preprocessAssetType('link')).toBe('custom');
    expect(preprocessAssetType('unknown')).toBe('custom');
    expect(preprocessAssetType('new-type')).toBe('custom');
  });

  it('coerces non-strings to custom', () => {
    expect(preprocessAssetType(null)).toBe('custom');
    expect(preprocessAssetType(undefined)).toBe('custom');
    expect(preprocessAssetType(123)).toBe('custom');
    expect(preprocessAssetType({})).toBe('custom');
  });
});

describe('AssetTypeSchema with preprocessing', () => {
  it('accepts known types', () => {
    expect(AssetTypeSchema.parse('icon')).toBe('icon');
    expect(AssetTypeSchema.parse('background')).toBe('background');
  });

  it('coerces unknown types to custom', () => {
    expect(AssetTypeSchema.parse('link')).toBe('custom');
    expect(AssetTypeSchema.parse('whatever')).toBe('custom');
  });
});

describe('AssetDescriptorSchema with preprocessing', () => {
  it('accepts known asset types', () => {
    const asset = {
      type: 'icon',
      uri: 'chara://assets/icon.png',
      name: 'Icon',
      ext: 'png',
    };
    const result = AssetDescriptorSchema.parse(asset);
    expect(result.type).toBe('icon');
  });

  it('coerces unknown asset types to custom', () => {
    const asset = {
      type: 'link',
      uri: 'https://example.com',
      name: 'Example',
      ext: 'html',
    };
    const result = AssetDescriptorSchema.parse(asset);
    expect(result.type).toBe('custom');
  });
});

// Issue #43: Integration tests for schema preprocessing
describe('CCv3 schema preprocessing (Issue #43)', () => {
  describe('timestamp fields', () => {
    it('accepts ISO string timestamps', () => {
      const card = {
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
          character_version: '',
          tags: [],
          group_only_greetings: [],
          creation_date: '2024-01-15T10:30:00.000Z',
        },
      };
      expect(isV3Card(card)).toBe(true);
      const result = CCv3DataSchema.parse(card);
      expect(result.data.creation_date).toBe(1705314600);
    });

    it('accepts numeric string timestamps', () => {
      const card = {
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
          character_version: '',
          tags: [],
          group_only_greetings: [],
          creation_date: '1705314600',
        },
      };
      expect(isV3Card(card)).toBe(true);
      const result = CCv3DataSchema.parse(card);
      expect(result.data.creation_date).toBe(1705314600);
    });

    it('accepts millisecond timestamps', () => {
      const card = {
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
          character_version: '',
          tags: [],
          group_only_greetings: [],
          creation_date: 1705314600000,
        },
      };
      expect(isV3Card(card)).toBe(true);
      const result = CCv3DataSchema.parse(card);
      expect(result.data.creation_date).toBe(1705314600);
    });

    it('drops negative timestamps (.NET default dates)', () => {
      const card = {
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
          character_version: '',
          tags: [],
          group_only_greetings: [],
          creation_date: -62135596800, // .NET default date
        },
      };
      expect(isV3Card(card)).toBe(true);
      const result = CCv3DataSchema.parse(card);
      expect(result.data.creation_date).toBeUndefined();
    });
  });

  describe('asset types', () => {
    it('coerces unknown asset types to custom', () => {
      const card = {
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
          character_version: '',
          tags: [],
          group_only_greetings: [],
          assets: [{ type: 'link', uri: 'https://example.com', name: 'Example', ext: 'html' }],
        },
      };
      expect(isV3Card(card)).toBe(true);
      const result = CCv3DataSchema.parse(card);
      expect(result.data.assets?.[0]?.type).toBe('custom');
    });
  });

  describe('character book numeric fields', () => {
    it('accepts string scan_depth in V3', () => {
      const book = {
        entries: [],
        scan_depth: '40',
      };
      const result = CCv3CharacterBookSchema.parse(book);
      expect(result.scan_depth).toBe(40);
    });

    it('accepts string token_budget in V3', () => {
      const book = {
        entries: [],
        token_budget: '2048',
      };
      const result = CCv3CharacterBookSchema.parse(book);
      expect(result.token_budget).toBe(2048);
    });
  });
});

describe('CCv2 schema preprocessing (Issue #43)', () => {
  describe('character book numeric fields', () => {
    it('accepts string scan_depth', () => {
      const card = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'Test',
          description: '',
          personality: '',
          scenario: '',
          first_mes: '',
          mes_example: '',
          tags: [],
          creator: '',
          character_version: '',
          character_book: {
            entries: [],
            scan_depth: '40',
          },
        },
      };
      expect(isWrappedV2(card)).toBe(true);
    });

    it('accepts string token_budget', () => {
      const book = {
        entries: [],
        token_budget: '2048',
      };
      const result = CCv2CharacterBookSchema.parse(book);
      expect(result.token_budget).toBe(2048);
    });
  });
});
