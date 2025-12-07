import { describe, it, expect } from 'vitest';
import { GptTokenizer } from './gpt.js';
import { SimpleTokenizer } from './simple.js';
import { registry, countTokens } from './registry.js';

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
});
