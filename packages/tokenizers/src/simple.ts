import type { TokenizerAdapter } from './types.js';

/**
 * Simple BPE-style tokenizer approximation (roughly GPT-2)
 * Useful when exact counts aren't critical or for performance
 */
export class SimpleTokenizer implements TokenizerAdapter {
  readonly id = 'simple';
  readonly name = 'Simple Approximation';

  count(text: string): number {
    if (!text) return 0;
    // Rough approximation: ~4 chars per token, but words count as tokens
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const charCount = text.length;
    return Math.ceil(charCount / 4 + words.length * 0.3);
  }

  countMany(texts: string[]): number[] {
    return texts.map(t => this.count(t));
  }
}

/**
 * LLaMA-style tokenizer approximation
 */
export class LlamaTokenizer implements TokenizerAdapter {
  readonly id = 'llama';
  readonly name = 'LLaMA Approximation';

  count(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4.5);
  }

  countMany(texts: string[]): number[] {
    return texts.map(t => this.count(t));
  }
}
