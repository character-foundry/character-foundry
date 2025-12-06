/**
 * Format detection tests
 */

import { describe, it, expect } from 'vitest';
import { detectSpec, hasLorebook, looksLikeCard } from './detection.js';

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
