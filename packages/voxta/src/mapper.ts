/**
 * Voxta <-> CCv3 Mapping
 *
 * Conversion utilities between Voxta format and CCv3 format.
 */

import type {
  CCv3Data,
  CCv3CharacterBook,
  CCv3LorebookEntry,
} from '@character-foundry/schemas';
import { generateUUID } from '@character-foundry/core';
import type {
  VoxtaCharacter,
  VoxtaBook,
  VoxtaExtensionData,
} from './types.js';
import { voxtaToStandard, standardToVoxta } from './macros.js';

/**
 * Convert a Voxta character to CCv3 format
 */
export function voxtaToCCv3(character: VoxtaCharacter, books?: VoxtaBook[]): CCv3Data {
  // Build voxta extension data to preserve Voxta-specific fields
  const voxtaExt: VoxtaExtensionData = {
    id: character.Id,
    packageId: character.PackageId,
    label: character.Label,
    appearance: character.Description,
    context: character.Context,
    instructions: character.Instructions,
    userNameOverride: character.UserNameOverride,
    userDescriptionOverride: character.UserDescriptionOverride,
    culture: character.Culture,
    importedFrom: character.ImportedFrom,
    textToSpeech: character.TextToSpeech,
    chatSettings: {
      chatStyle: character.ChatStyle,
      enableThinkingSpeech: character.EnableThinkingSpeech,
      notifyUserAwayReturn: character.NotifyUserAwayReturn,
      timeAware: character.TimeAware,
      useMemory: character.UseMemory,
      maxTokens: character.MaxTokens,
      maxSentences: character.MaxSentences,
      systemPromptOverrideType: character.SystemPromptOverrideType,
    },
    simulationSettings: {
      climaxSensitivity: character.ClimaxSensitivity,
      pleasureDecay: character.PleasureDecay,
    },
    scripts: character.Scripts,
    augmentations: character.Augmentations,
    original: {
      DateCreated: character.DateCreated,
      DateModified: character.DateModified,
    },
  };

  // Convert lorebook from VoxtaBooks
  let characterBook: CCv3CharacterBook | undefined;

  if (books && books.length > 0) {
    const entries: CCv3LorebookEntry[] = [];
    const linkedBookIds = new Set(character.MemoryBooks || []);

    for (const book of books) {
      // Only include if linked or if no links defined (legacy/implicit)
      if (linkedBookIds.size === 0 || linkedBookIds.has(book.Id)) {
        if (book.Items) {
          for (let i = 0; i < book.Items.length; i++) {
            const item = book.Items[i]!;
            entries.push({
              keys: item.Keywords || [],
              content: voxtaToStandard(item.Text || ''),
              enabled: item.Deleted !== true,
              insertion_order: i,
              name: item.Id || '',
              priority: item.Weight || 10,
              id: i,
              comment: '',
              selective: false,
              secondary_keys: [],
              constant: false,
              position: 'before_char',
            });
          }
        }
      }
    }

    if (entries.length > 0) {
      characterBook = {
        entries,
        name: books[0]!.Name || 'Imported Lorebook',
      };
    }
  }

  // Convert timestamps (ISO string -> Unix seconds)
  const creationDate = character.DateCreated
    ? Math.floor(new Date(character.DateCreated).getTime() / 1000)
    : undefined;
  const modificationDate = character.DateModified
    ? Math.floor(new Date(character.DateModified).getTime() / 1000)
    : undefined;

  // Build CCv3 card
  const card: CCv3Data = {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: character.Name || 'Unknown',
      nickname: character.Label,
      description: voxtaToStandard(character.Profile || ''),
      personality: voxtaToStandard(character.Personality || ''),
      scenario: voxtaToStandard(character.Scenario || ''),
      first_mes: voxtaToStandard(character.FirstMessage || ''),
      mes_example: voxtaToStandard(character.MessageExamples || ''),
      creator_notes: character.CreatorNotes || '',
      system_prompt: voxtaToStandard(character.SystemPrompt || ''),
      post_history_instructions: voxtaToStandard(character.PostHistoryInstructions || ''),
      alternate_greetings: (character.AlternateGreetings || []).map(voxtaToStandard),
      group_only_greetings: [],
      tags: character.Tags || [],
      creator: character.Creator || '',
      character_version: character.Version || '1.0',
      creation_date: creationDate,
      modification_date: modificationDate,
      character_book: characterBook,
      extensions: {
        voxta: voxtaExt,
        visual_description: character.Description || undefined,
      },
    },
  };

  return card;
}

/**
 * Convert CCv3 card to Voxta character format
 */
export function ccv3ToVoxta(card: CCv3Data): VoxtaCharacter {
  const cardData = card.data;
  const extensions = cardData.extensions as Record<string, unknown> | undefined;
  const voxtaExt = extensions?.voxta as VoxtaExtensionData | undefined;
  const dateNow = new Date().toISOString();

  const appearance = voxtaExt?.appearance || (extensions?.visual_description as string) || '';

  // Convert timestamps (Unix seconds -> ISO string)
  const dateCreated = cardData.creation_date
    ? new Date(cardData.creation_date * 1000).toISOString()
    : voxtaExt?.original?.DateCreated || dateNow;
  const dateModified = cardData.modification_date
    ? new Date(cardData.modification_date * 1000).toISOString()
    : dateNow;

  const character: VoxtaCharacter = {
    $type: 'character',
    Id: voxtaExt?.id || generateUUID(),
    PackageId: voxtaExt?.packageId || generateUUID(),
    Name: cardData.name,
    Label: cardData.nickname || voxtaExt?.label,
    Version: cardData.character_version,

    // Core content
    Description: appearance,
    Personality: standardToVoxta(cardData.personality),
    Profile: standardToVoxta(cardData.description),
    Scenario: standardToVoxta(cardData.scenario),
    FirstMessage: standardToVoxta(cardData.first_mes),
    AlternateGreetings: (cardData.alternate_greetings || []).map(standardToVoxta),
    MessageExamples: standardToVoxta(cardData.mes_example || ''),

    // System prompts
    SystemPrompt: standardToVoxta(cardData.system_prompt || ''),
    PostHistoryInstructions: standardToVoxta(cardData.post_history_instructions || ''),
    Context: voxtaExt?.context,
    Instructions: voxtaExt?.instructions,

    // Persona overrides
    UserNameOverride: voxtaExt?.userNameOverride,
    UserDescriptionOverride: voxtaExt?.userDescriptionOverride,

    // Metadata
    Creator: cardData.creator,
    CreatorNotes: cardData.creator_notes,
    Tags: cardData.tags,
    Culture: voxtaExt?.culture,
    ImportedFrom: voxtaExt?.importedFrom,

    // TTS & AI settings
    TextToSpeech: voxtaExt?.textToSpeech,
    ChatStyle: voxtaExt?.chatSettings?.chatStyle,
    EnableThinkingSpeech: voxtaExt?.chatSettings?.enableThinkingSpeech,
    NotifyUserAwayReturn: voxtaExt?.chatSettings?.notifyUserAwayReturn,
    TimeAware: voxtaExt?.chatSettings?.timeAware,
    UseMemory: voxtaExt?.chatSettings?.useMemory,
    MaxTokens: voxtaExt?.chatSettings?.maxTokens,
    MaxSentences: voxtaExt?.chatSettings?.maxSentences,
    SystemPromptOverrideType: voxtaExt?.chatSettings?.systemPromptOverrideType,

    // Simulation settings
    ClimaxSensitivity: voxtaExt?.simulationSettings?.climaxSensitivity,
    PleasureDecay: voxtaExt?.simulationSettings?.pleasureDecay,

    // Advanced
    Scripts: voxtaExt?.scripts,
    Augmentations: voxtaExt?.augmentations,

    DateCreated: dateCreated,
    DateModified: dateModified,
  };

  return character;
}

/**
 * Convert CCv3 lorebook to Voxta book format
 */
export function ccv3LorebookToVoxtaBook(card: CCv3Data): VoxtaBook | null {
  const characterBook = card.data.character_book;
  if (!characterBook?.entries || characterBook.entries.length === 0) {
    return null;
  }

  const book: VoxtaBook = {
    $type: 'book',
    Id: generateUUID(),
    Name: characterBook.name || `${card.data.name}'s Lorebook`,
    Items: characterBook.entries.map((entry) => ({
      Id: generateUUID(),
      Keywords: entry.keys || [],
      Text: standardToVoxta(entry.content || ''),
      Weight: entry.priority || 10,
      Deleted: entry.enabled === false,
    })),
  };

  return book;
}
