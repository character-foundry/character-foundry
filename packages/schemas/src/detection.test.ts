/**
 * Format detection tests
 */

import { describe, it, expect } from 'vitest';
import { detectSpec, detectSpecDetailed, hasLorebook, looksLikeCard } from './detection.js';

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
