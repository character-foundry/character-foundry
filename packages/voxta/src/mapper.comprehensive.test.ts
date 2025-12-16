/**
 * COMPREHENSIVE Field Mapping Tests
 *
 * These tests verify that EVERY SINGLE FIELD is preserved during conversion.
 * Created to catch empty data bugs that existing tests miss.
 */

import { describe, it, expect } from 'vitest';
import { voxtaToCCv3 } from './mapper.js';
import type { VoxtaCharacter } from './types.js';

describe('voxtaToCCv3 - COMPREHENSIVE field validation', () => {
  it('should preserve ALL character fields (not just name)', () => {
    const fullCharacter: VoxtaCharacter = {
      $type: 'character',
      Id: 'char-uuid-123',
      PackageId: 'pkg-uuid-456',
      Name: 'Alice Thompson',
      Label: 'Ali',
      Version: '2.1.0',

      // Visual/descriptive
      Description: 'Tall woman with long blue hair and green eyes',
      Personality: 'Cheerful, optimistic, loves to help others',
      Profile: 'Alice is a friendly AI assistant who enjoys conversation',
      Scenario: 'You meet Alice at a coffee shop on a rainy afternoon',

      // Messages
      FirstMessage: 'Hello {{user}}! Nice to meet you!',
      AlternativeFirstMessages: [
        'Hi there {{user}}!',
        'Greetings {{user}}, how are you today?',
        'Hey {{user}}, ready to chat?'
      ],
      MessageExamples: '{{user}}: How are you?\n{{char}}: I\'m doing great, thanks for asking!',

      // Prompts
      SystemPrompt: 'You are Alice, a helpful assistant',
      PostHistoryInstructions: 'Remember to stay in character as {{char}}',
      Context: 'Additional context for the scene',
      Instructions: 'Special instructions for behavior',

      // User overrides
      UserNameOverride: 'CustomUser',
      UserDescriptionOverride: 'A friendly person',

      // Metadata
      Creator: 'TestCreator',
      CreatorNotes: 'This is a test character for validation',
      Tags: ['friendly', 'helpful', 'ai', 'assistant'],
      Culture: 'en-US',
      ImportedFrom: 'TestSuite',

      // TTS & Settings
      TextToSpeech: {
        Provider: 'azure',
        Voice: 'en-US-JennyNeural',
        Speed: 1.0,
      },
      ChatStyle: 'conversational',
      EnableThinkingSpeech: true,
      NotifyUserAwayReturn: false,
      TimeAware: true,
      UseMemory: true,
      MaxTokens: 2048,
      MaxSentences: 5,
      SystemPromptOverrideType: 'custom',

      // Simulation
      ClimaxSensitivity: 0.8,
      PleasureDecay: 0.1,

      // Advanced
      Scripts: ['script1.js', 'script2.js'],
      Augmentations: ['aug1', 'aug2'],

      // Timestamps
      DateCreated: '2024-01-15T10:30:00Z',
      DateModified: '2024-01-20T15:45:00Z',
    };

    const result = voxtaToCCv3(fullCharacter);

    // VERIFY EVERY FIELD
    expect(result.spec).toBe('chara_card_v3');
    expect(result.spec_version).toBe('3.0');

    // Core fields
    expect(result.data.name).toBe('Alice Thompson');
    expect(result.data.nickname).toBe('Ali');
    expect(result.data.description).toBe('Alice is a friendly AI assistant who enjoys conversation');
    expect(result.data.personality).toBe('Cheerful, optimistic, loves to help others');
    expect(result.data.scenario).toBe('You meet Alice at a coffee shop on a rainy afternoon');
    expect(result.data.first_mes).toBe('Hello {{user}}! Nice to meet you!');
    expect(result.data.mes_example).toBe('{{user}}: How are you?\n{{char}}: I\'m doing great, thanks for asking!');

    // Prompts
    expect(result.data.system_prompt).toBe('You are Alice, a helpful assistant');
    expect(result.data.post_history_instructions).toBe('Remember to stay in character as {{char}}');

    // Metadata
    expect(result.data.creator).toBe('TestCreator');
    expect(result.data.creator_notes).toBe('This is a test character for validation');
    expect(result.data.tags).toEqual(['friendly', 'helpful', 'ai', 'assistant']);
    expect(result.data.character_version).toBe('2.1.0');

    // Alternate greetings
    expect(result.data.alternate_greetings).toHaveLength(3);
    expect(result.data.alternate_greetings[0]).toBe('Hi there {{user}}!');
    expect(result.data.alternate_greetings[1]).toBe('Greetings {{user}}, how are you today?');
    expect(result.data.alternate_greetings[2]).toBe('Hey {{user}}, ready to chat?');

    // Timestamps (Unix seconds)
    expect(result.data.creation_date).toBe(1705314600); // 2024-01-15T10:30:00Z
    expect(result.data.modification_date).toBe(1705765500); // 2024-01-20T15:45:00Z

    // Extensions - Voxta-specific data
    expect(result.data.extensions).toBeDefined();
    const voxta = result.data.extensions.voxta as any;

    expect(voxta.id).toBe('char-uuid-123');
    expect(voxta.packageId).toBe('pkg-uuid-456');
    expect(voxta.label).toBe('Ali');
    expect(voxta.appearance).toBe('Tall woman with long blue hair and green eyes');
    expect(voxta.context).toBe('Additional context for the scene');
    expect(voxta.instructions).toBe('Special instructions for behavior');
    expect(voxta.userNameOverride).toBe('CustomUser');
    expect(voxta.userDescriptionOverride).toBe('A friendly person');
    expect(voxta.culture).toBe('en-US');
    expect(voxta.importedFrom).toBe('TestSuite');

    expect(voxta.textToSpeech).toEqual({
      Provider: 'azure',
      Voice: 'en-US-JennyNeural',
      Speed: 1.0,
    });

    expect(voxta.chatSettings.chatStyle).toBe('conversational');
    expect(voxta.chatSettings.enableThinkingSpeech).toBe(true);
    expect(voxta.chatSettings.notifyUserAwayReturn).toBe(false);
    expect(voxta.chatSettings.timeAware).toBe(true);
    expect(voxta.chatSettings.useMemory).toBe(true);
    expect(voxta.chatSettings.maxTokens).toBe(2048);
    expect(voxta.chatSettings.maxSentences).toBe(5);
    expect(voxta.chatSettings.systemPromptOverrideType).toBe('custom');

    expect(voxta.simulationSettings.climaxSensitivity).toBe(0.8);
    expect(voxta.simulationSettings.pleasureDecay).toBe(0.1);

    expect(voxta.scripts).toEqual(['script1.js', 'script2.js']);
    expect(voxta.augmentations).toEqual(['aug1', 'aug2']);

    expect(voxta.original.DateCreated).toBe('2024-01-15T10:30:00Z');
    expect(voxta.original.DateModified).toBe('2024-01-20T15:45:00Z');

    // Visual description should be in extensions
    expect(result.data.extensions.visual_description).toBe('Tall woman with long blue hair and green eyes');
  });

  it('should handle EMPTY fields correctly (not undefined)', () => {
    const emptyCharacter: VoxtaCharacter = {
      $type: 'character',
      Id: 'char-123',
      PackageId: 'pkg-123',
      Name: '', // Empty name
      Profile: '', // Empty profile
      Personality: '', // Empty personality
      Scenario: '', // Empty scenario
      FirstMessage: '', // Empty first message
      MessageExamples: '', // Empty examples
      DateCreated: '2024-01-01T00:00:00Z',
      DateModified: '2024-01-01T00:00:00Z',
    };

    const result = voxtaToCCv3(emptyCharacter);

    // Should use fallback for empty name
    expect(result.data.name).toBe('Unknown');

    // Empty strings should become empty strings (not undefined)
    expect(result.data.description).toBe('');
    expect(result.data.personality).toBe('');
    expect(result.data.scenario).toBe('');
    expect(result.data.first_mes).toBe('');
    expect(result.data.mes_example).toBe('');
    expect(result.data.creator).toBe('');
    expect(result.data.creator_notes).toBe('');

    // Arrays should be empty arrays (not undefined)
    expect(result.data.tags).toEqual([]);
    expect(result.data.alternate_greetings).toEqual([]);
  });

  it('should handle MISSING fields correctly (undefined in source)', () => {
    const minimalCharacter: VoxtaCharacter = {
      $type: 'character',
      Id: 'char-123',
      PackageId: 'pkg-123',
      Name: 'Bob',
      // All other fields missing/undefined
      DateCreated: '2024-01-01T00:00:00Z',
      DateModified: '2024-01-01T00:00:00Z',
    };

    const result = voxtaToCCv3(minimalCharacter);

    // Should have proper fallbacks
    expect(result.data.name).toBe('Bob');
    expect(result.data.description).toBe('');
    expect(result.data.personality).toBe('');
    expect(result.data.scenario).toBe('');
    expect(result.data.first_mes).toBe('');
    expect(result.data.mes_example).toBe('');
    expect(result.data.creator).toBe('');
    expect(result.data.creator_notes).toBe('');
    expect(result.data.system_prompt).toBe('');
    expect(result.data.post_history_instructions).toBe('');
    expect(result.data.tags).toEqual([]);
    expect(result.data.alternate_greetings).toEqual([]);
    expect(result.data.character_version).toBe('1.0');
  });
});
