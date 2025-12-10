/**
 * Metadata Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateClientMetadata,
  validateClientMetadataSync,
  computeContentHash,
  type ClientMetadata,
  type TokenCounts,
} from './validate-metadata.js';
import type { ParseResult } from './types.js';
import type { CCv3Data } from '@character-foundry/schemas';

// Helper to create a mock card
function createMockCard(overrides: Partial<CCv3Data['data']> = {}): CCv3Data {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Test Character',
      description: 'A test character',
      personality: 'Friendly',
      scenario: 'In a test',
      first_mes: 'Hello!',
      mes_example: '<START>',
      system_prompt: 'You are a test.',
      post_history_instructions: '',
      alternate_greetings: ['Hi there!'],
      character_book: {
        entries: [
          { keys: ['test'], content: 'Test entry', enabled: true },
          { keys: ['second'], content: 'Second entry', enabled: true },
        ],
      },
      creator_notes: 'Test notes',
      tags: [],
      creator: 'Test Creator',
      character_version: '1.0',
      ...overrides,
    },
  };
}

// Helper to create mock ParseResult
function createMockParseResult(card: CCv3Data): ParseResult {
  return {
    card,
    assets: [],
    containerFormat: 'json',
    spec: 'v3',
    sourceFormat: 'json_v3',
    originalShape: card,
    rawBuffer: new Uint8Array(),
  };
}

// Mock token counter for testing
function mockCountTokens(card: CCv3Data): TokenCounts {
  const data = card.data;
  return {
    description: (data.description || '').length,
    personality: (data.personality || '').length,
    scenario: (data.scenario || '').length,
    firstMes: (data.first_mes || '').length,
    mesExample: (data.mes_example || '').length,
    systemPrompt: (data.system_prompt || '').length,
    postHistoryInstructions: (data.post_history_instructions || '').length,
    alternateGreetings: (data.alternate_greetings || []).reduce((sum, g) => sum + g.length, 0),
    lorebook: (data.character_book?.entries || []).reduce((sum, e) => sum + (e.content || '').length, 0),
    creatorNotes: (data.creator_notes || '').length,
    total:
      (data.description || '').length +
      (data.personality || '').length +
      (data.scenario || '').length +
      (data.first_mes || '').length +
      (data.mes_example || '').length +
      (data.system_prompt || '').length +
      (data.post_history_instructions || '').length +
      (data.alternate_greetings || []).reduce((sum, g) => sum + g.length, 0) +
      (data.character_book?.entries || []).reduce((sum, e) => sum + (e.content || '').length, 0) +
      (data.creator_notes || '').length,
  };
}

// Simple sync hash for testing
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

describe('validateClientMetadata', () => {
  const card = createMockCard();
  const parseResult = createMockParseResult(card);
  const computedTokens = mockCountTokens(card);

  describe('valid metadata', () => {
    it('should validate matching metadata', async () => {
      const hash = await computeContentHash(card);

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: computedTokens,
        contentHash: hash,
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
      });

      expect(result.isValid).toBe(true);
      expect(result.isTrusted).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return authoritative values', async () => {
      const hash = await computeContentHash(card);

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: {},
        contentHash: hash,
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
      });

      expect(result.authoritative.name).toBe('Test Character');
      expect(result.authoritative.tokens).toEqual(computedTokens);
      expect(result.authoritative.contentHash).toBe(hash);
      expect(result.authoritative.hasLorebook).toBe(true);
      expect(result.authoritative.lorebookEntriesCount).toBe(2);
    });
  });

  describe('discrepancy detection', () => {
    it('should detect name mismatch', async () => {
      const hash = await computeContentHash(card);

      const clientMeta: ClientMetadata = {
        name: 'Wrong Name',
        tokens: computedTokens,
        contentHash: hash,
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
      });

      expect(result.isValid).toBe(false);
      expect(result.discrepancies).toContainEqual(
        expect.objectContaining({
          field: 'name',
          clientValue: 'Wrong Name',
          computedValue: 'Test Character',
        })
      );
    });

    it('should detect hash mismatch', async () => {
      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: computedTokens,
        contentHash: 'wronghash123',
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
      });

      expect(result.isValid).toBe(false);
      expect(result.discrepancies).toContainEqual(
        expect.objectContaining({
          field: 'contentHash',
        })
      );
      expect(result.errors).toContainEqual(expect.stringContaining('hash mismatch'));
    });

    it('should allow hash mismatch when configured', async () => {
      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: computedTokens,
        contentHash: 'wronghash123',
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
        allowHashMismatch: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.isTrusted).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect lorebook presence mismatch', async () => {
      const hash = await computeContentHash(card);

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: computedTokens,
        contentHash: hash,
        hasLorebook: false, // Wrong
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
      });

      expect(result.isValid).toBe(false);
      expect(result.discrepancies).toContainEqual(
        expect.objectContaining({
          field: 'hasLorebook',
          clientValue: false,
          computedValue: true,
        })
      );
    });

    it('should detect lorebook count mismatch', async () => {
      const hash = await computeContentHash(card);

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: computedTokens,
        contentHash: hash,
        hasLorebook: true,
        lorebookEntriesCount: 5, // Wrong
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
      });

      expect(result.isValid).toBe(true); // Count mismatch is just a warning
      expect(result.discrepancies).toContainEqual(
        expect.objectContaining({
          field: 'lorebookEntriesCount',
          clientValue: 5,
          computedValue: 2,
        })
      );
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('token tolerance', () => {
    it('should accept token counts within tolerance', async () => {
      // Create a card with larger token counts for better tolerance testing
      const largeCard = createMockCard({
        description: 'A'.repeat(100), // 100 chars = 100 tokens in our mock
      });
      const largeParseResult = createMockParseResult(largeCard);
      const largeTokens = mockCountTokens(largeCard);
      const hash = await computeContentHash(largeCard);

      // Tokens slightly off (within 5% = difference of at most 5 on 100)
      const slightlyOffTokens = { ...largeTokens };
      slightlyOffTokens.description = largeTokens.description + 4; // 4% diff on 100

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: slightlyOffTokens,
        contentHash: hash,
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, largeParseResult, {
        countTokens: mockCountTokens,
        tokenTolerance: 0.05,
      });

      // Should have discrepancies but marked within tolerance
      const descDisc = result.discrepancies.find((d) => d.field === 'tokens.description');
      expect(descDisc).toBeDefined();
      expect(descDisc!.withinTolerance).toBe(true);
    });

    it('should flag token counts outside tolerance', async () => {
      const hash = await computeContentHash(card);

      // Tokens way off (>5%)
      const wayOffTokens = { ...computedTokens };
      wayOffTokens.description = computedTokens.description * 2;

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: wayOffTokens,
        contentHash: hash,
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
        tokenTolerance: 0.05,
      });

      const descDisc = result.discrepancies.find((d) => d.field === 'tokens.description');
      expect(descDisc?.withinTolerance).toBe(false);
    });
  });

  describe('tag validation', () => {
    it('should validate tags with custom validator', async () => {
      const hash = await computeContentHash(card);

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: computedTokens,
        contentHash: hash,
        tags: ['valid', 'invalid-tag', 'ok'],
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
        validateTags: (tags) => ({
          valid: !tags.includes('invalid-tag'),
          filtered: tags.filter((t) => t !== 'invalid-tag'),
          reason: 'Tag "invalid-tag" is not allowed',
        }),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('invalid-tag'));
    });

    it('should warn about filtered tags', async () => {
      const hash = await computeContentHash(card);

      const clientMeta: ClientMetadata = {
        name: 'Test Character',
        tokens: computedTokens,
        contentHash: hash,
        tags: ['valid', 'removed'],
        hasLorebook: true,
        lorebookEntriesCount: 2,
      };

      const result = await validateClientMetadata(clientMeta, parseResult, {
        countTokens: mockCountTokens,
        validateTags: (tags) => ({
          valid: true,
          filtered: tags.filter((t) => t !== 'removed'),
        }),
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('filtered'));
    });
  });
});

describe('validateClientMetadataSync', () => {
  const card = createMockCard();
  const parseResult = createMockParseResult(card);
  const computedTokens = mockCountTokens(card);

  it('should work synchronously with custom hash', () => {
    const hash = simpleHash(JSON.stringify(card.data));

    const clientMeta: ClientMetadata = {
      name: 'Test Character',
      tokens: computedTokens,
      contentHash: hash,
      hasLorebook: true,
      lorebookEntriesCount: 2,
    };

    const result = validateClientMetadataSync(clientMeta, parseResult, {
      countTokens: mockCountTokens,
      computeHash: (content) => simpleHash(content),
    });

    expect(result.authoritative).toBeDefined();
    expect(result.authoritative.name).toBe('Test Character');
  });
});

describe('computeContentHash', () => {
  it('should return consistent hash for same content', async () => {
    const card = createMockCard();

    const hash1 = await computeContentHash(card);
    const hash2 = await computeContentHash(card);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
  });

  it('should return different hash for different content', async () => {
    const card1 = createMockCard({ name: 'Character A' });
    const card2 = createMockCard({ name: 'Character B' });

    const hash1 = await computeContentHash(card1);
    const hash2 = await computeContentHash(card2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle card without lorebook', async () => {
    const card = createMockCard({ character_book: undefined });

    const hash = await computeContentHash(card);
    expect(hash).toHaveLength(64);
  });
});
