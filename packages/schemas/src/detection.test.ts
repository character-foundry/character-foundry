/**
 * Format detection tests
 */

import { describe, it, expect } from 'vitest';
import { detectSpec, detectSpecDetailed, hasLorebook, looksLikeCard } from './detection.js';
import { looksLikeWrappedV2, getV2Data, isWrappedV2 } from './ccv2.js';
import { looksLikeV3Card, isV3Card, CCv3DataInnerSchema } from './ccv3.js';

describe('format detection', () => {
  describe('detectSpec', () => {
    it('detects explicit v3 spec', () => {
      expect(detectSpec({ spec: 'chara_card_v3', data: { name: 'Test' } })).toBe('v3');
    });

    it('detects explicit v2 spec', () => {
      expect(detectSpec({ spec: 'chara_card_v2', data: { name: 'Test' } })).toBe('v2');
    });

    it('detects spec_version 2.0', () => {
      expect(detectSpec({ spec_version: '2.0', name: 'Test' })).toBe('v2');
    });

    it('detects unwrapped v2 format', () => {
      expect(detectSpec({
        name: 'Test',
        description: 'A test character',
        personality: 'Friendly',
      })).toBe('v2');
    });

    it('returns null for invalid data', () => {
      expect(detectSpec(null)).toBe(null);
      expect(detectSpec(undefined)).toBe(null);
      expect(detectSpec('string')).toBe(null);
      expect(detectSpec({})).toBe(null);
    });

    it('detects v3 from V3-only fields', () => {
      expect(detectSpec({
        spec: 'some_spec',
        data: { name: 'Test', group_only_greetings: [] },
      })).toBe('v3');
    });

    it('detects v3 from assets field', () => {
      expect(detectSpec({
        spec: 'some_spec',
        data: { name: 'Test', assets: [] },
      })).toBe('v3');
    });
  });

  describe('detectSpecDetailed', () => {
    it('provides high confidence for explicit v3 spec', () => {
      const result = detectSpecDetailed({ spec: 'chara_card_v3', data: { name: 'Test' } });
      expect(result.spec).toBe('v3');
      expect(result.confidence).toBe('high');
      expect(result.indicators).toContain('spec field is "chara_card_v3"');
      expect(result.warnings).toHaveLength(0);
    });

    it('provides high confidence for explicit v2 spec', () => {
      const result = detectSpecDetailed({ spec: 'chara_card_v2', data: { name: 'Test' } });
      expect(result.spec).toBe('v2');
      expect(result.confidence).toBe('high');
      expect(result.indicators).toContain('spec field is "chara_card_v2"');
    });

    it('warns about V3-only fields in V2 card', () => {
      const result = detectSpecDetailed({
        spec: 'chara_card_v2',
        data: { name: 'Test', group_only_greetings: [] },
      });
      expect(result.spec).toBe('v2');
      expect(result.confidence).toBe('high');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('group_only_greetings'))).toBe(true);
    });

    it('warns about inconsistent spec_version', () => {
      const result = detectSpecDetailed({
        spec: 'chara_card_v3',
        spec_version: '2.0',
        data: { name: 'Test' },
      });
      expect(result.spec).toBe('v3');
      expect(result.warnings.some(w => w.includes('inconsistent'))).toBe(true);
    });

    it('provides medium confidence for V3-only fields detection', () => {
      const result = detectSpecDetailed({
        spec: 'some_spec',
        data: { name: 'Test', creation_date: 1234567890 },
      });
      expect(result.spec).toBe('v3');
      expect(result.confidence).toBe('medium');
      expect(result.indicators.some(i => i.includes('creation_date'))).toBe(true);
    });

    it('provides medium confidence for unwrapped format', () => {
      const result = detectSpecDetailed({
        name: 'Test',
        description: 'A test',
        personality: 'Friendly',
      });
      expect(result.spec).toBe('v2');
      expect(result.confidence).toBe('medium');
      expect(result.indicators.some(i => i.includes('Unwrapped'))).toBe(true);
    });

    it('provides low confidence when no spec but has card structure', () => {
      const result = detectSpecDetailed({
        data: { name: 'Test', description: 'A test' },
      });
      expect(result.spec).toBe('v2');
      expect(result.confidence).toBe('low');
      expect(result.warnings.some(w => w.includes('Missing spec'))).toBe(true);
    });

    it('returns null for non-card data', () => {
      const result = detectSpecDetailed({ foo: 'bar' });
      expect(result.spec).toBeNull();
      expect(result.indicators.some(i => i.includes('No card structure'))).toBe(true);
    });

    it('handles numeric spec_version', () => {
      const result = detectSpecDetailed({ spec_version: 2.0, name: 'Test' });
      expect(result.spec).toBe('v2');
      expect(result.confidence).toBe('high');
      expect(result.indicators.some(i => i.includes('numeric'))).toBe(true);
    });

    it('detects string spec_version starting with 3', () => {
      const result = detectSpecDetailed({ spec_version: '3.0', data: { name: 'Test' } });
      expect(result.spec).toBe('v3');
      expect(result.confidence).toBe('high');
    });
  });

  describe('hasLorebook', () => {
    it('detects lorebook in wrapped format', () => {
      expect(hasLorebook({
        spec: 'chara_card_v2',
        data: {
          name: 'Test',
          character_book: {
            entries: [{ keys: ['test'], content: 'test' }]
          }
        }
      })).toBe(true);
    });

    it('detects lorebook in unwrapped format', () => {
      expect(hasLorebook({
        name: 'Test',
        character_book: {
          entries: [{ keys: ['test'], content: 'test' }]
        }
      })).toBe(true);
    });

    it('returns false for empty lorebook', () => {
      expect(hasLorebook({
        name: 'Test',
        character_book: { entries: [] }
      })).toBe(false);
    });

    it('returns false for no lorebook', () => {
      expect(hasLorebook({ name: 'Test' })).toBe(false);
    });
  });

  describe('looksLikeCard', () => {
    it('recognizes v3 cards', () => {
      expect(looksLikeCard({ spec: 'chara_card_v3', data: { name: 'Test' } })).toBe(true);
    });

    it('recognizes v2 cards', () => {
      expect(looksLikeCard({ spec: 'chara_card_v2', data: { name: 'Test' } })).toBe(true);
    });

    it('recognizes unwrapped cards', () => {
      expect(looksLikeCard({
        name: 'Test',
        description: 'A test',
        personality: 'Friendly'
      })).toBe(true);
    });

    it('rejects invalid data', () => {
      expect(looksLikeCard(null)).toBe(false);
      expect(looksLikeCard({})).toBe(false);
      expect(looksLikeCard({ name: '' })).toBe(false);
    });
  });
});

// Issue #20: Tests for lenient structural checks and schema defaulting
describe('lenient parsing (Issue #20)', () => {
  describe('looksLikeWrappedV2 vs isWrappedV2', () => {
    it('isWrappedV2 accepts cards with missing optional string fields due to defaults', () => {
      // Card with missing field (personality is missing) - now passes due to .default('')
      const missingField = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'Céline',
          description: 'A character',
          // personality: MISSING - gets defaulted to ''
          scenario: '',
          first_mes: 'Hello',
          mes_example: '',
        },
      };

      // Now passes due to .default('') on string fields
      expect(isWrappedV2(missingField)).toBe(true);
      expect(looksLikeWrappedV2(missingField)).toBe(true);
    });

    it('looksLikeWrappedV2 accepts malformed cards with wrong field types that isWrappedV2 rejects', () => {
      // Card with wrong type (name is number instead of string)
      const wrongType = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 12345, // Wrong type - should be string
          description: 'A character',
        },
      };

      // Strict Zod validation fails due to wrong type
      expect(isWrappedV2(wrongType)).toBe(false);

      // Structural check passes (doesn't validate types)
      expect(looksLikeWrappedV2(wrongType)).toBe(true);
    });

    it('looksLikeWrappedV2 accepts cards with wrong spec_version', () => {
      const wrongVersion = {
        spec: 'chara_card_v2',
        spec_version: '1.0', // Wrong but still recognizable
        data: { name: 'Test' },
      };

      expect(isWrappedV2(wrongVersion)).toBe(false);
      expect(looksLikeWrappedV2(wrongVersion)).toBe(true);
    });

    it('looksLikeWrappedV2 rejects non-wrapped structures', () => {
      expect(looksLikeWrappedV2(null)).toBe(false);
      expect(looksLikeWrappedV2({ spec: 'chara_card_v2' })).toBe(false); // missing data
      expect(looksLikeWrappedV2({ data: { name: 'Test' } })).toBe(false); // missing spec
      expect(looksLikeWrappedV2({ spec: 'chara_card_v3', data: {} })).toBe(false); // wrong spec
    });
  });

  describe('getV2Data with malformed cards', () => {
    it('unwraps malformed wrapped cards correctly', () => {
      const malformed = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'Céline',
          description: 'Test',
        },
      };

      const result = getV2Data(malformed as any);

      // Should return the inner data, not the wrapper
      expect(result.name).toBe('Céline');
      expect((result as any).spec).toBeUndefined();
    });

    it('returns unwrapped cards as-is', () => {
      const unwrapped = {
        name: 'Unwrapped Char',
        description: 'Test',
        personality: 'Friendly',
        scenario: '',
        first_mes: 'Hi',
        mes_example: '',
      };

      const result = getV2Data(unwrapped as any);

      expect(result.name).toBe('Unwrapped Char');
    });
  });

  describe('looksLikeV3Card', () => {
    it('accepts V3 cards with missing optional fields', () => {
      const minimalV3 = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: { name: 'Test' }, // Missing group_only_greetings, etc.
      };

      expect(looksLikeV3Card(minimalV3)).toBe(true);
    });

    it('rejects non-V3 structures', () => {
      expect(looksLikeV3Card(null)).toBe(false);
      expect(looksLikeV3Card({ spec: 'chara_card_v2', data: {} })).toBe(false);
      expect(looksLikeV3Card({ spec: 'chara_card_v3' })).toBe(false); // missing data
    });
  });

  describe('V3 schema with defaults', () => {
    it('parses V3 inner data with missing optional fields using defaults', () => {
      const minimal = {
        name: 'Test Character',
        description: 'A test',
        personality: 'Friendly',
        scenario: '',
        first_mes: 'Hello',
        mes_example: '',
        // Missing: creator, character_version, tags, group_only_greetings
      };

      const result = CCv3DataInnerSchema.parse(minimal);

      // Defaults should be applied
      expect(result.creator).toBe('');
      expect(result.character_version).toBe('');
      expect(result.tags).toEqual([]);
      expect(result.group_only_greetings).toEqual([]);
    });

    it('preserves provided values over defaults', () => {
      const withValues = {
        name: 'Test Character',
        description: 'A test',
        personality: 'Friendly',
        scenario: '',
        first_mes: 'Hello',
        mes_example: '',
        creator: 'Custom Creator',
        character_version: '2.0',
        tags: ['custom', 'tags'],
        group_only_greetings: ['Hello everyone!'],
      };

      const result = CCv3DataInnerSchema.parse(withValues);

      expect(result.creator).toBe('Custom Creator');
      expect(result.character_version).toBe('2.0');
      expect(result.tags).toEqual(['custom', 'tags']);
      expect(result.group_only_greetings).toEqual(['Hello everyone!']);
    });
  });
});
