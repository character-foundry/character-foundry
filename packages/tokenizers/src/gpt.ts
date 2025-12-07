import { encode } from 'gpt-tokenizer';
import type { TokenizerAdapter } from './types.js';

/**
 * GPT-3.5/4 compatible tokenizer using cl100k_base encoding
 * Uses gpt-tokenizer (pure JS)
 */
export class GptTokenizer implements TokenizerAdapter {
  readonly id = 'gpt-4';
  readonly name = 'GPT-4 (cl100k_base)';

  count(text: string): number {
    if (!text) return 0;
    try {
      return encode(text).length;
    } catch (error) {
      console.warn('GPT tokenization failed, falling back to approximation', error);
      return Math.ceil(text.length / 4);
    }
  }

  countMany(texts: string[]): number[] {
    return texts.map(t => this.count(t));
  }

  encode(text: string): number[] {
    return encode(text);
  }
}
