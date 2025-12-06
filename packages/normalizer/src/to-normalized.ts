/**
 * To NormalizedCard Converter
 *
 * Converts any card format to NormalizedCard.
 */

import type {
  CCv2Data,
  CCv2Wrapped,
  CCv3Data,
  NormalizedCard,
  CCv3CharacterBook,
} from '@character-foundry/schemas';
import { getV2Data, isWrappedV2, isV3Card } from '@character-foundry/schemas';

/**
 * Normalize CCv2 data to NormalizedCard
 */
export function normalizeV2(input: CCv2Data | CCv2Wrapped): NormalizedCard {
  const data = getV2Data(input);

  return {
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    firstMes: data.first_mes,
    mesExample: data.mes_example,
    systemPrompt: data.system_prompt,
    postHistoryInstructions: data.post_history_instructions,
    creatorNotes: data.creator_notes,
    alternateGreetings: data.alternate_greetings || [],
    groupOnlyGreetings: [],
    tags: data.tags || [],
    creator: data.creator,
    characterVersion: data.character_version,
    characterBook: data.character_book as CCv3CharacterBook | undefined,
    extensions: data.extensions || {},
  };
}

/**
 * Normalize CCv3 data to NormalizedCard
 */
export function normalizeV3(card: CCv3Data): NormalizedCard {
  const data = card.data;

  return {
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    firstMes: data.first_mes,
    mesExample: data.mes_example,
    systemPrompt: data.system_prompt,
    postHistoryInstructions: data.post_history_instructions,
    creatorNotes: data.creator_notes,
    alternateGreetings: data.alternate_greetings || [],
    groupOnlyGreetings: data.group_only_greetings || [],
    tags: data.tags || [],
    creator: data.creator,
    characterVersion: data.character_version,
    characterBook: data.character_book,
    extensions: data.extensions || {},
  };
}

/**
 * Normalize any card format to NormalizedCard
 *
 * @param input - Card data in any supported format
 * @returns NormalizedCard
 */
export function normalize(input: CCv2Data | CCv2Wrapped | CCv3Data): NormalizedCard {
  if (isV3Card(input)) {
    return normalizeV3(input as CCv3Data);
  }

  if (isWrappedV2(input) || 'name' in input) {
    return normalizeV2(input as CCv2Data | CCv2Wrapped);
  }

  throw new Error('Unknown card format');
}
