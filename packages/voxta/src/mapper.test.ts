/**
 * Voxta Mapper Tests
 */

import { describe, it, expect } from 'vitest';
import { voxtaToCCv3, ccv3ToVoxta, ccv3LorebookToVoxtaBook } from './mapper.js';
import type { VoxtaCharacter, VoxtaBook } from './types.js';
import type { CCv3Data } from '@character-foundry/schemas';

describe('voxtaToCCv3', () => {
  const testVoxtaCharacter: VoxtaCharacter = {
    $type: 'character',
    Id: 'char-123',
    PackageId: 'pkg-456',
    Name: 'Alice',
    Version: '1.0',
    Description: 'A friendly assistant',
    Personality: 'Helpful and kind with {{ user }}',
    Profile: 'Alice is an AI assistant',
    Scenario: 'Chat scenario with {{ char }}',
    FirstMessage: 'Hello {{ user }}, I am {{ char }}!',
    MessageExamples: '{{ user }}: Hi\n{{ char }}: Hello!',
    Creator: 'Test',
    CreatorNotes: 'Test character',
    Tags: ['friendly', 'helpful'],
    DateCreated: '2024-01-01T00:00:00Z',
    DateModified: '2024-01-02T00:00:00Z',
  };

  it('should convert basic fields', () => {
    const result = voxtaToCCv3(testVoxtaCharacter);

    expect(result.spec).toBe('chara_card_v3');
    expect(result.data.name).toBe('Alice');
    expect(result.data.creator).toBe('Test');
    expect(result.data.character_version).toBe('1.0');
    expect(result.data.tags).toEqual(['friendly', 'helpful']);
  });

  it('should convert macros from Voxta to standard format', () => {
    const result = voxtaToCCv3(testVoxtaCharacter);

    expect(result.data.first_mes).toBe('Hello {{user}}, I am {{char}}!');
    expect(result.data.personality).toBe('Helpful and kind with {{user}}');
  });

  it('should preserve Voxta-specific data in extensions', () => {
    const result = voxtaToCCv3(testVoxtaCharacter);
    const voxtaExt = result.data.extensions?.voxta as Record<string, unknown>;

    expect(voxtaExt).toBeDefined();
    expect(voxtaExt.id).toBe('char-123');
    expect(voxtaExt.packageId).toBe('pkg-456');
  });

  it('should convert lorebook from VoxtaBooks', () => {
    const books: VoxtaBook[] = [
      {
        $type: 'book',
        Id: 'book-1',
        Name: 'World Lore',
        Items: [
          {
            Id: 'item-1',
            Keywords: ['dragon', 'fire'],
            Text: 'Dragons breathe {{ char }} fire.',
            Weight: 10,
          },
          {
            Id: 'item-2',
            Keywords: ['castle'],
            Text: 'The castle is tall.',
            Weight: 5,
            Deleted: true,
          },
        ],
      },
    ];

    const result = voxtaToCCv3(testVoxtaCharacter, books);

    expect(result.data.character_book).toBeDefined();
    expect(result.data.character_book!.entries.length).toBe(2);
    expect(result.data.character_book!.entries[0]!.keys).toEqual(['dragon', 'fire']);
    expect(result.data.character_book!.entries[0]!.content).toBe('Dragons breathe {{char}} fire.');
    expect(result.data.character_book!.entries[1]!.enabled).toBe(false);
  });
});

describe('ccv3ToVoxta', () => {
  const testCard: CCv3Data = {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Bob',
      description: 'A test character',
      personality: 'Friendly with {{user}}',
      scenario: '{{char}} meets {{user}}',
      first_mes: 'Hello {{user}}!',
      mes_example: '{{user}}: Test\n{{char}}: Reply',
      creator_notes: 'Notes',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      group_only_greetings: [],
      tags: ['test'],
      creator: 'Tester',
      character_version: '2.0',
      extensions: {
        visual_description: 'Tall with blue eyes',
      },
    },
  };

  it('should convert basic fields', () => {
    const result = ccv3ToVoxta(testCard);

    expect(result.$type).toBe('character');
    expect(result.Name).toBe('Bob');
    expect(result.Version).toBe('2.0');
    expect(result.Creator).toBe('Tester');
    expect(result.Tags).toEqual(['test']);
  });

  it('should convert macros to Voxta format', () => {
    const result = ccv3ToVoxta(testCard);

    expect(result.FirstMessage).toBe('Hello {{ user }}!');
    expect(result.Personality).toBe('Friendly with {{ user }}');
    expect(result.Scenario).toBe('{{ char }} meets {{ user }}');
  });

  it('should use visual_description for appearance', () => {
    const result = ccv3ToVoxta(testCard);
    expect(result.Description).toBe('Tall with blue eyes');
  });

  it('should generate UUIDs when not present', () => {
    const result = ccv3ToVoxta(testCard);

    expect(result.Id).toBeDefined();
    expect(result.Id.length).toBeGreaterThan(0);
    expect(result.PackageId).toBeDefined();
  });

  it('should preserve existing Voxta IDs from extensions', () => {
    const cardWithVoxta: CCv3Data = {
      ...testCard,
      data: {
        ...testCard.data,
        extensions: {
          voxta: {
            id: 'existing-id',
            packageId: 'existing-pkg',
          },
        },
      },
    };

    const result = ccv3ToVoxta(cardWithVoxta);

    expect(result.Id).toBe('existing-id');
    expect(result.PackageId).toBe('existing-pkg');
  });
});

describe('ccv3LorebookToVoxtaBook', () => {
  it('should convert lorebook to VoxtaBook', () => {
    const card: CCv3Data = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Test',
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        group_only_greetings: [],
        tags: [],
        creator: '',
        character_version: '',
        character_book: {
          name: 'My Lore',
          entries: [
            {
              keys: ['magic', 'spell'],
              content: 'Magic exists in {{char}}\'s world.',
              enabled: true,
              insertion_order: 0,
              id: 1,
              name: 'Magic Entry',
              priority: 15,
              comment: '',
              selective: false,
              secondary_keys: [],
              constant: false,
              position: 'before_char',
            },
          ],
        },
        extensions: {},
      },
    };

    const result = ccv3LorebookToVoxtaBook(card);

    expect(result).not.toBeNull();
    expect(result!.$type).toBe('book');
    expect(result!.Name).toBe('My Lore');
    expect(result!.Items.length).toBe(1);
    expect(result!.Items[0]!.Keywords).toEqual(['magic', 'spell']);
    expect(result!.Items[0]!.Text).toBe('Magic exists in {{ char }}\'s world.');
    expect(result!.Items[0]!.Weight).toBe(15);
  });

  it('should return null for cards without lorebook', () => {
    const card: CCv3Data = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Test',
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        group_only_greetings: [],
        tags: [],
        creator: '',
        character_version: '',
        extensions: {},
      },
    };

    expect(ccv3LorebookToVoxtaBook(card)).toBeNull();
  });
});
