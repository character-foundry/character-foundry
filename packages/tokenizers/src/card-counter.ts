/**
 * Card Token Counter
 *
 * Count tokens in character card fields for consistent
 * cross-platform token reporting.
 */

import type { TokenizerAdapter } from './types.js';
import { getTokenizer } from './registry.js';

/**
 * Token counts for a character card
 */
export interface CardTokenCounts {
  description: number;
  personality: number;
  scenario: number;
  firstMes: number;
  mesExample: number;
  systemPrompt: number;
  postHistoryInstructions: number;
  alternateGreetings: number;
  lorebook: number;
  creatorNotes: number;
  total: number;
}

/**
 * Card data structure for token counting
 * Accepts both CCv2 and CCv3 card structures
 */
export interface CardForCounting {
  data?: {
    name?: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    creator_notes?: string;
    character_book?: {
      entries?: Array<{
        content?: string;
        enabled?: boolean;
      }>;
    } | null;
  };
  // Support for unwrapped cards
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  creator_notes?: string;
  character_book?: {
    entries?: Array<{
      content?: string;
      enabled?: boolean;
    }>;
  } | null;
}

/**
 * Token counting options
 */
export interface TokenCountOptions {
  /** Tokenizer ID to use. Default: 'gpt-4' */
  tokenizer?: string;
  /** Only count enabled lorebook entries. Default: true */
  onlyEnabledLorebook?: boolean;
}

/**
 * Count tokens in a character card's fields.
 *
 * @param card - Character card data (CCv2 or CCv3)
 * @param options - Counting options
 * @returns Token counts per field and total
 */
export function countCardTokens(
  card: CardForCounting,
  options: TokenCountOptions = {}
): CardTokenCounts {
  const tokenizer = getTokenizer(options.tokenizer ?? 'gpt-4');
  const onlyEnabled = options.onlyEnabledLorebook ?? true;

  // Handle both wrapped and unwrapped formats
  const data = card.data ?? card;

  // Count each field
  const description = tokenizer.count(data.description ?? '');
  const personality = tokenizer.count(data.personality ?? '');
  const scenario = tokenizer.count(data.scenario ?? '');
  const firstMes = tokenizer.count(data.first_mes ?? '');
  const mesExample = tokenizer.count(data.mes_example ?? '');
  const systemPrompt = tokenizer.count(data.system_prompt ?? '');
  const postHistoryInstructions = tokenizer.count(data.post_history_instructions ?? '');
  const creatorNotes = tokenizer.count(data.creator_notes ?? '');

  // Count alternate greetings
  const altGreetings = data.alternate_greetings ?? [];
  const alternateGreetings = altGreetings.reduce(
    (sum, greeting) => sum + tokenizer.count(greeting ?? ''),
    0
  );

  // Count lorebook entries
  const entries = data.character_book?.entries ?? [];
  const lorebook = entries.reduce((sum, entry) => {
    if (onlyEnabled && entry.enabled === false) {
      return sum;
    }
    return sum + tokenizer.count(entry.content ?? '');
  }, 0);

  // Calculate total
  const total =
    description +
    personality +
    scenario +
    firstMes +
    mesExample +
    systemPrompt +
    postHistoryInstructions +
    alternateGreetings +
    lorebook +
    creatorNotes;

  return {
    description,
    personality,
    scenario,
    firstMes,
    mesExample,
    systemPrompt,
    postHistoryInstructions,
    alternateGreetings,
    lorebook,
    creatorNotes,
    total,
  };
}

/**
 * Count tokens in a text string using the specified tokenizer.
 *
 * @param text - Text to count tokens in
 * @param tokenizerId - Tokenizer ID to use. Default: 'gpt-4'
 * @returns Token count
 */
export function countText(text: string, tokenizerId = 'gpt-4'): number {
  const tokenizer = getTokenizer(tokenizerId);
  return tokenizer.count(text);
}
