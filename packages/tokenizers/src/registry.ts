import type { TokenizerAdapter } from './types.js';
import { GptTokenizer } from './gpt.js';
import { SimpleTokenizer, LlamaTokenizer } from './simple.js';

export class TokenizerRegistry {
  private tokenizers = new Map<string, TokenizerAdapter>();
  private defaultId: string = 'gpt-4';

  constructor() {
    this.register(new GptTokenizer());
    this.register(new SimpleTokenizer());
    this.register(new LlamaTokenizer());
  }

  register(tokenizer: TokenizerAdapter): void {
    this.tokenizers.set(tokenizer.id, tokenizer);
  }

  get(id?: string): TokenizerAdapter {
    const targetId = id || this.defaultId;
    const tokenizer = this.tokenizers.get(targetId);
    if (!tokenizer) {
      // Fallback to simple if requested ID not found
      return this.tokenizers.get('simple') || new SimpleTokenizer();
    }
    return tokenizer;
  }

  list(): TokenizerAdapter[] {
    return Array.from(this.tokenizers.values());
  }
}

export const registry = new TokenizerRegistry();

// Helper for quick usage
export function countTokens(text: string, tokenizerId?: string): number {
  return registry.get(tokenizerId).count(text);
}

// Helper to get a tokenizer by ID
export function getTokenizer(tokenizerId?: string): TokenizerAdapter {
  return registry.get(tokenizerId);
}
