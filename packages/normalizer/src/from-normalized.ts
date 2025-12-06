/**
 * From NormalizedCard Converter
 *
 * Converts NormalizedCard to other formats.
 */

import type {
  CCv2Data,
  CCv2Wrapped,
  CCv3Data,
  NormalizedCard,
} from '@character-foundry/schemas';

/**
 * Convert NormalizedCard to CCv3
 */
export function denormalizeToV3(card: NormalizedCard): CCv3Data {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: card.name,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_mes: card.firstMes,
      mes_example: card.mesExample,
      creator_notes: card.creatorNotes || '',
      system_prompt: card.systemPrompt || '',
      post_history_instructions: card.postHistoryInstructions || '',
      alternate_greetings: card.alternateGreetings,
      group_only_greetings: card.groupOnlyGreetings,
      tags: card.tags,
      creator: card.creator || '',
      character_version: card.characterVersion || '',
      character_book: card.characterBook,
      extensions: card.extensions,
    },
  };
}

/**
 * Convert character book to v2 format (ensure extensions are not undefined)
 */
function convertCharacterBookToV2(book: NormalizedCard['characterBook']): CCv2Data['character_book'] {
  if (!book) return undefined;

  return {
    ...book,
    entries: book.entries.map((entry) => ({
      ...entry,
      extensions: entry.extensions || {},
    })),
  };
}

/**
 * Convert NormalizedCard to CCv2 unwrapped
 *
 * Note: group_only_greetings will be lost
 */
export function denormalizeToV2Data(card: NormalizedCard): CCv2Data {
  return {
    name: card.name,
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    first_mes: card.firstMes,
    mes_example: card.mesExample,
    creator_notes: card.creatorNotes,
    system_prompt: card.systemPrompt,
    post_history_instructions: card.postHistoryInstructions,
    alternate_greetings: card.alternateGreetings,
    tags: card.tags,
    creator: card.creator,
    character_version: card.characterVersion,
    character_book: convertCharacterBookToV2(card.characterBook),
    extensions: card.extensions,
  };
}

/**
 * Convert NormalizedCard to CCv2 wrapped
 *
 * Note: group_only_greetings will be lost
 */
export function denormalizeToV2Wrapped(card: NormalizedCard): CCv2Wrapped {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: denormalizeToV2Data(card),
  };
}

/**
 * Check what would be lost converting NormalizedCard to v2
 */
export function checkNormalizedToV2Loss(card: NormalizedCard): string[] {
  const lost: string[] = [];

  if (card.groupOnlyGreetings.length > 0) {
    lost.push(`group_only_greetings (${card.groupOnlyGreetings.length} entries)`);
  }

  return lost;
}
