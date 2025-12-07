/**
 * Tokenizer adapter interface
 */
export interface TokenizerAdapter {
  /** Unique identifier for the tokenizer */
  id: string;
  
  /** Display name */
  name: string;

  /**
   * Count tokens in a text string
   */
  count(text: string): number;

  /**
   * Count tokens in multiple strings
   */
  countMany(texts: string[]): number[];

  /**
   * Encode text to token IDs (optional support)
   */
  encode?(text: string): number[];

  /**
   * Decode token IDs to text (optional support)
   */
  decode?(tokens: number[]): string;
}
