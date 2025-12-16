/**
 * FULL PIPELINE Integration Test
 *
 * Tests the complete flow: voxpkg ZIP → readVoxta → voxtaToCCv3 → final card
 * This catches bugs that unit tests miss.
 */

import { describe, it, expect } from 'vitest';
import { parseCard } from './loader.js';
import { zipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import type { VoxtaCharacter } from '@character-foundry/voxta';

describe('Voxta FULL PIPELINE - data preservation', () => {
  it('should preserve ALL fields from voxpkg through complete pipeline', () => {
    // Create a FULL character with ALL fields populated
    const character: VoxtaCharacter = {
      $type: 'character',
      Id: 'test-char-uuid',
      PackageId: 'test-pkg-uuid',
      Name: 'Integration Test Character',
      Label: 'ITC',
      Version: '3.0.0',

      // Descriptive fields
      Description: 'A character specifically designed for integration testing',
      Personality: 'Meticulous, detail-oriented, catches bugs that slip through unit tests',
      Profile: 'This character exists to verify that the entire pipeline preserves data',
      Scenario: 'You are conducting integration tests on the character-foundry library',

      // Messages
      FirstMessage: 'Hello {{user}}, I am your integration test character!',
      AlternativeFirstMessages: [
        'Greetings {{user}}, ready to test?',
        'Hi {{user}}, let me help verify this pipeline works!'
      ],
      MessageExamples: '{{user}}: Are you working?\n{{char}}: Yes, all my fields are intact!',

      // Prompts
      SystemPrompt: 'You are a test character. Stay in character.',
      PostHistoryInstructions: 'Remember all context from {{user}}',
      Context: 'Integration test context',
      Instructions: 'Follow test protocols',

      // User overrides
      UserNameOverride: 'Tester',
      UserDescriptionOverride: 'A diligent software tester',

      // Metadata
      Creator: 'Integration Test Suite',
      CreatorNotes: 'Created to catch pipeline bugs',
      Tags: ['test', 'integration', 'validation'],
      Culture: 'en-GB',
      ImportedFrom: 'vitest',

      // TTS
      TextToSpeech: {
        Provider: 'test-provider',
        Voice: 'test-voice',
        Speed: 1.5,
      },

      // Chat settings
      ChatStyle: 'technical',
      EnableThinkingSpeech: false,
      NotifyUserAwayReturn: true,
      TimeAware: false,
      UseMemory: false,
      MaxTokens: 1024,
      MaxSentences: 3,
      SystemPromptOverrideType: 'default',

      // Simulation
      ClimaxSensitivity: 0.5,
      PleasureDecay: 0.2,

      // Advanced
      Scripts: ['test.js'],
      Augmentations: ['test-aug'],

      // Timestamps
      DateCreated: '2024-02-01T12:00:00Z',
      DateModified: '2024-02-01T12:30:00Z',
    };

    // Build a proper voxpkg structure
    const zipData = zipSync({
      'Characters/test-char-uuid/character.json': fromString(JSON.stringify(character)),
      'Characters/test-char-uuid/thumbnail.png': new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // Minimal PNG header
    });

    // Parse through the FULL pipeline
    const result = parseCard(zipData);

    // Verify pipeline metadata
    expect(result.containerFormat).toBe('voxta');
    expect(result.sourceFormat).toBe('voxta');
    expect(result.spec).toBe('v3');

    const card = result.card;

    // ============ VERIFY EVERY SINGLE FIELD ============

    // Core fields
    expect(card.data.name).toBe('Integration Test Character');
    expect(card.data.nickname).toBe('ITC');
    expect(card.data.description).toBe('This character exists to verify that the entire pipeline preserves data');
    expect(card.data.personality).toBe('Meticulous, detail-oriented, catches bugs that slip through unit tests');
    expect(card.data.scenario).toBe('You are conducting integration tests on the character-foundry library');
    expect(card.data.first_mes).toBe('Hello {{user}}, I am your integration test character!');
    expect(card.data.mes_example).toBe('{{user}}: Are you working?\n{{char}}: Yes, all my fields are intact!');

    // Prompts
    expect(card.data.system_prompt).toBe('You are a test character. Stay in character.');
    expect(card.data.post_history_instructions).toBe('Remember all context from {{user}}');

    // Metadata
    expect(card.data.creator).toBe('Integration Test Suite');
    expect(card.data.creator_notes).toBe('Created to catch pipeline bugs');
    expect(card.data.tags).toEqual(['test', 'integration', 'validation']);
    expect(card.data.character_version).toBe('3.0.0');

    // Alternate greetings
    expect(card.data.alternate_greetings).toHaveLength(2);
    expect(card.data.alternate_greetings[0]).toBe('Greetings {{user}}, ready to test?');
    expect(card.data.alternate_greetings[1]).toBe('Hi {{user}}, let me help verify this pipeline works!');

    // Timestamps
    expect(card.data.creation_date).toBe(1706788800); // 2024-02-01T12:00:00Z
    expect(card.data.modification_date).toBe(1706790600); // 2024-02-01T12:30:00Z

    // Extensions - Voxta data
    expect(card.data.extensions).toBeDefined();
    const voxta = card.data.extensions.voxta as any;

    expect(voxta.id).toBe('test-char-uuid');
    expect(voxta.packageId).toBe('test-pkg-uuid');
    expect(voxta.label).toBe('ITC');
    expect(voxta.appearance).toBe('A character specifically designed for integration testing');
    expect(voxta.context).toBe('Integration test context');
    expect(voxta.instructions).toBe('Follow test protocols');
    expect(voxta.userNameOverride).toBe('Tester');
    expect(voxta.userDescriptionOverride).toBe('A diligent software tester');
    expect(voxta.culture).toBe('en-GB');
    expect(voxta.importedFrom).toBe('vitest');

    expect(voxta.textToSpeech.Provider).toBe('test-provider');
    expect(voxta.textToSpeech.Voice).toBe('test-voice');
    expect(voxta.textToSpeech.Speed).toBe(1.5);

    expect(voxta.chatSettings.chatStyle).toBe('technical');
    expect(voxta.chatSettings.enableThinkingSpeech).toBe(false);
    expect(voxta.chatSettings.notifyUserAwayReturn).toBe(true);
    expect(voxta.chatSettings.timeAware).toBe(false);
    expect(voxta.chatSettings.useMemory).toBe(false);
    expect(voxta.chatSettings.maxTokens).toBe(1024);
    expect(voxta.chatSettings.maxSentences).toBe(3);
    expect(voxta.chatSettings.systemPromptOverrideType).toBe('default');

    expect(voxta.simulationSettings.climaxSensitivity).toBe(0.5);
    expect(voxta.simulationSettings.pleasureDecay).toBe(0.2);

    expect(voxta.scripts).toEqual(['test.js']);
    expect(voxta.augmentations).toEqual(['test-aug']);

    // Visual description
    expect(card.data.extensions.visual_description).toBe('A character specifically designed for integration testing');

    // Assets (should have thumbnail)
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].type).toBe('icon');
    expect(result.assets[0].isMain).toBe(true);
  });

  it('should show EXACTLY what happens with EMPTY source data', () => {
    // This simulates what happens if the voxpkg has a minimal/empty character.json
    const emptyCharacter: VoxtaCharacter = {
      $type: 'character',
      Id: 'empty-char',
      PackageId: 'empty-pkg',
      Name: '', // EMPTY!
      Profile: '', // EMPTY!
      Personality: '', // EMPTY!
      Scenario: '', // EMPTY!
      FirstMessage: '', // EMPTY!
      MessageExamples: '', // EMPTY!
      DateCreated: '2024-01-01T00:00:00Z',
      DateModified: '2024-01-01T00:00:00Z',
    };

    const zipData = zipSync({
      'Characters/empty-char/character.json': fromString(JSON.stringify(emptyCharacter)),
    });

    const result = parseCard(zipData);
    const card = result.card;

    // This is what you'll see with empty source data:
    expect(card.data.name).toBe('Unknown'); // Fallback triggered
    expect(card.data.description).toBe(''); // Empty string preserved
    expect(card.data.personality).toBe(''); // Empty string preserved
    expect(card.data.scenario).toBe(''); // Empty string preserved
    expect(card.data.first_mes).toBe(''); // Empty string preserved
    expect(card.data.mes_example).toBe(''); // Empty string preserved

    // If YOUR voxpkg files look like this, YOU'LL GET EMPTY CARDS
    // The code is WORKING CORRECTLY - it's the source data that's empty!
  });
});
