import { describe, it, expect } from 'vitest';
import { GptTokenizer } from './gpt.js';
import { SimpleTokenizer } from './simple.js';
import { registry, countTokens } from './registry.js';
import { countCardTokens, countText } from './card-counter.js';

describe('Tokenizers', () => {
  const text = 'Hello world, this is a test sentence.';

  describe('GptTokenizer', () => {
    const tokenizer = new GptTokenizer();

    it('should count tokens correctly', () => {
      // "Hello world, this is a test sentence." -> 
      // [Hello] [ world] [,] [ this] [ is] [ a] [ test] [ sentence] [.]
      // gpt-tokenizer (cl100k_base) count might vary slightly but should be accurate
      const count = tokenizer.count(text);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(text.length);
    });

    it('should handle empty strings', () => {
      expect(tokenizer.count('')).toBe(0);
    });
  });

  describe('SimpleTokenizer', () => {
    const tokenizer = new SimpleTokenizer();

    it('should return an estimated count', () => {
      const count = tokenizer.count(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Registry', () => {
    it('should return default tokenizer (GPT-4)', () => {
      const t = registry.get();
      expect(t.id).toBe('gpt-4');
    });

    it('should return specific tokenizer', () => {
      const t = registry.get('simple');
      expect(t.id).toBe('simple');
    });

    it('should fallback to simple if not found', () => {
      const t = registry.get('non-existent');
      expect(t.id).toBe('simple');
    });
  });

  describe('Helper', () => {
    it('should count using default', () => {
      const count = countTokens(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Card Counter', () => {
    it('should count tokens in wrapped card', () => {
      const card = {
        data: {
          name: 'Test Character',
          description: 'A brave adventurer.',
          personality: 'Friendly and helpful.',
          scenario: 'In a magical forest.',
          first_mes: 'Hello there!',
          mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
          system_prompt: 'You are a helpful assistant.',
          post_history_instructions: 'Stay in character.',
          alternate_greetings: ['Hey!', 'Greetings!'],
          creator_notes: 'This is a test card.',
          character_book: {
            entries: [
              { content: 'Lore entry 1', enabled: true },
              { content: 'Lore entry 2', enabled: false },
            ],
          },
        },
      };

      const counts = countCardTokens(card);

      expect(counts.description).toBeGreaterThan(0);
      expect(counts.personality).toBeGreaterThan(0);
      expect(counts.scenario).toBeGreaterThan(0);
      expect(counts.firstMes).toBeGreaterThan(0);
      expect(counts.mesExample).toBeGreaterThan(0);
      expect(counts.systemPrompt).toBeGreaterThan(0);
      expect(counts.postHistoryInstructions).toBeGreaterThan(0);
      expect(counts.alternateGreetings).toBeGreaterThan(0);
      expect(counts.lorebook).toBeGreaterThan(0);
      expect(counts.creatorNotes).toBeGreaterThan(0);
      expect(counts.total).toBeGreaterThan(counts.description);
    });

    it('should count tokens in unwrapped card', () => {
      const card = {
        name: 'Test',
        description: 'A test character.',
        personality: 'Friendly.',
      };

      const counts = countCardTokens(card);

      expect(counts.description).toBeGreaterThan(0);
      expect(counts.personality).toBeGreaterThan(0);
      expect(counts.total).toBe(
        counts.description + counts.personality
      );
    });

    it('should handle empty card', () => {
      const counts = countCardTokens({});

      expect(counts.description).toBe(0);
      expect(counts.total).toBe(0);
    });

    it('should only count enabled lorebook entries by default', () => {
      const card = {
        data: {
          character_book: {
            entries: [
              { content: 'Enabled entry', enabled: true },
              { content: 'Disabled entry', enabled: false },
            ],
          },
        },
      };

      const countsDefault = countCardTokens(card);
      const countsAll = countCardTokens(card, { onlyEnabledLorebook: false });

      expect(countsAll.lorebook).toBeGreaterThan(countsDefault.lorebook);
    });

    it('should use simple tokenizer when specified', () => {
      const card = {
        data: {
          description: 'A test description.',
        },
      };

      const countsGpt = countCardTokens(card, { tokenizer: 'gpt-4' });
      const countsSimple = countCardTokens(card, { tokenizer: 'simple' });

      // Both should return non-zero, but values may differ
      expect(countsGpt.description).toBeGreaterThan(0);
      expect(countsSimple.description).toBeGreaterThan(0);
    });
  });

  describe('countText', () => {
    it('should count tokens in text', () => {
      const count = countText('Hello world!');
      expect(count).toBeGreaterThan(0);
    });

    it('should use specified tokenizer', () => {
      const count = countText('Hello world!', 'simple');
      expect(count).toBeGreaterThan(0);
    });
  });
});
