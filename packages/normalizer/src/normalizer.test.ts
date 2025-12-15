/**
 * Normalizer Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ccv2ToCCv3,
  ccv3ToCCv2Data,
  ccv3ToCCv2Wrapped,
  checkV3ToV2Loss,
  normalize,
  normalizeV2,
  normalizeV3,
  denormalizeToV3,
  denormalizeToV2Data,
  denormalizeToV2Wrapped,
  checkNormalizedToV2Loss,
} from './index.js';
import type { CCv2Data, CCv2Wrapped, CCv3Data, NormalizedCard } from '@character-foundry/schemas';

const testV2Data: CCv2Data = {
  name: 'V2 Character',
  description: 'A v2 test character',
  personality: 'Friendly',
  scenario: 'Testing',
  first_mes: 'Hello!',
  mes_example: '{{user}}: Hi\n{{char}}: Hey!',
  creator_notes: 'Test notes',
  system_prompt: 'Be helpful',
  post_history_instructions: 'Remember context',
  alternate_greetings: ['Hi!', 'Hey!'],
  tags: ['test'],
  creator: 'Tester',
  character_version: '1.0',
  extensions: { custom: 'value' },
};

const testV2Wrapped: CCv2Wrapped = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: testV2Data,
};

const testV3: CCv3Data = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: 'V3 Character',
    description: 'A v3 test character',
    personality: 'Smart',
    scenario: 'Testing v3',
    first_mes: 'Greetings!',
    mes_example: '{{user}}: Test\n{{char}}: Response',
    creator_notes: 'V3 notes',
    system_prompt: 'Be smart',
    post_history_instructions: 'Stay in character',
    alternate_greetings: ['Howdy!'],
    group_only_greetings: ['Welcome all!'],
    tags: ['v3', 'test'],
    creator: 'V3 Tester',
    character_version: '3.0',
    extensions: { v3_ext: 'data' },
  },
};

describe('ccv2ToCCv3', () => {
  it('should convert unwrapped v2 to v3', () => {
    const result = ccv2ToCCv3(testV2Data);

    expect(result.spec).toBe('chara_card_v3');
    expect(result.spec_version).toBe('3.0');
    expect(result.data.name).toBe('V2 Character');
    expect(result.data.description).toBe('A v2 test character');
    expect(result.data.alternate_greetings).toEqual(['Hi!', 'Hey!']);
    expect(result.data.group_only_greetings).toEqual([]);
    expect(result.data.extensions).toEqual({ custom: 'value' });
  });

  it('should convert wrapped v2 to v3', () => {
    const result = ccv2ToCCv3(testV2Wrapped);

    expect(result.spec).toBe('chara_card_v3');
    expect(result.data.name).toBe('V2 Character');
  });

  // Issue #20: Malformed wrapped V2 cards that fail strict Zod validation
  // but still have valid data in the data field
  it('should handle wrapped v2 with missing required fields in data (Issue #20)', () => {
    // This card is wrapped but data is missing some "required" fields
    // (e.g., personality is missing). Strict Zod validation would reject it.
    const malformedWrapped = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: 'Céline',
        description: 'A character with missing fields',
        // personality is MISSING
        scenario: 'Test scenario',
        first_mes: 'Hello',
        mes_example: 'Example',
      },
    };

    const result = ccv2ToCCv3(malformedWrapped as CCv2Wrapped);

    // Should still extract the name correctly (the bug was returning undefined)
    expect(result.data.name).toBe('Céline');
    expect(result.data.description).toBe('A character with missing fields');
    // Missing fields should be defaulted
    expect(result.data.personality).toBe('');
  });

  it('should handle wrapped v2 with null fields', () => {
    const wrappedWithNulls = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: 'Test Char',
        description: 'Description',
        personality: null, // null instead of string
        scenario: '',
        first_mes: 'Hello',
        mes_example: '',
      },
    };

    const result = ccv2ToCCv3(wrappedWithNulls as unknown as CCv2Wrapped);

    expect(result.data.name).toBe('Test Char');
    // null should be defaulted to empty string via ?? operator
    expect(result.data.personality).toBe('');
  });

  it('should handle wrapped v2 with wrong spec_version', () => {
    // Some tools export with spec_version: "1.0" or other variations
    const wrongVersion = {
      spec: 'chara_card_v2',
      spec_version: '1.0', // Wrong version but still wrapped format
      data: {
        name: 'Wrong Version Char',
        description: 'Desc',
        personality: 'Nice',
        scenario: '',
        first_mes: 'Hi',
        mes_example: '',
      },
    };

    const result = ccv2ToCCv3(wrongVersion as unknown as CCv2Wrapped);

    expect(result.data.name).toBe('Wrong Version Char');
  });

  it('should preserve character book', () => {
    const v2WithBook: CCv2Data = {
      ...testV2Data,
      character_book: {
        entries: [
          {
            keys: ['magic'],
            content: 'Magic exists',
            extensions: {},
            enabled: true,
            insertion_order: 0,
          },
        ],
      },
    };

    const result = ccv2ToCCv3(v2WithBook);

    expect(result.data.character_book).toBeDefined();
    expect(result.data.character_book!.entries.length).toBe(1);
    expect(result.data.character_book!.entries[0]!.keys).toEqual(['magic']);
  });
});

describe('ccv3ToCCv2', () => {
  it('should convert v3 to v2 data', () => {
    const result = ccv3ToCCv2Data(testV3);

    expect(result.name).toBe('V3 Character');
    expect(result.description).toBe('A v3 test character');
    expect(result.alternate_greetings).toEqual(['Howdy!']);
    // group_only_greetings is lost
    expect((result as Record<string, unknown>).group_only_greetings).toBeUndefined();
  });

  it('should convert v3 to v2 wrapped', () => {
    const result = ccv3ToCCv2Wrapped(testV3);

    expect(result.spec).toBe('chara_card_v2');
    expect(result.spec_version).toBe('2.0');
    expect(result.data.name).toBe('V3 Character');
  });
});

describe('checkV3ToV2Loss', () => {
  it('should report no loss for minimal card', () => {
    const minimal: CCv3Data = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Minimal',
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

    const lost = checkV3ToV2Loss(minimal);

    expect(lost.length).toBe(0);
  });

  it('should report loss of group_only_greetings', () => {
    const lost = checkV3ToV2Loss(testV3);

    expect(lost.some((l) => l.includes('group_only_greetings'))).toBe(true);
  });
});

describe('normalize', () => {
  it('should normalize v2 data', () => {
    const result = normalize(testV2Data);

    expect(result.name).toBe('V2 Character');
    expect(result.firstMes).toBe('Hello!');
    expect(result.mesExample).toBe('{{user}}: Hi\n{{char}}: Hey!');
    expect(result.alternateGreetings).toEqual(['Hi!', 'Hey!']);
    expect(result.groupOnlyGreetings).toEqual([]);
  });

  it('should normalize v2 wrapped data', () => {
    const result = normalize(testV2Wrapped);

    expect(result.name).toBe('V2 Character');
  });

  it('should normalize v3 data', () => {
    const result = normalize(testV3);

    expect(result.name).toBe('V3 Character');
    expect(result.firstMes).toBe('Greetings!');
    expect(result.alternateGreetings).toEqual(['Howdy!']);
    expect(result.groupOnlyGreetings).toEqual(['Welcome all!']);
  });
});

describe('denormalize', () => {
  const normalized: NormalizedCard = {
    name: 'Normalized',
    description: 'Test',
    personality: 'Friendly',
    scenario: 'Test',
    firstMes: 'Hi!',
    mesExample: 'Example',
    systemPrompt: 'System',
    postHistoryInstructions: 'Post',
    creatorNotes: 'Notes',
    alternateGreetings: ['Alt1'],
    groupOnlyGreetings: ['Group1'],
    tags: ['tag1'],
    creator: 'Creator',
    characterVersion: '1.0',
    extensions: {},
  };

  it('should denormalize to v3', () => {
    const result = denormalizeToV3(normalized);

    expect(result.spec).toBe('chara_card_v3');
    expect(result.data.name).toBe('Normalized');
    expect(result.data.first_mes).toBe('Hi!');
    expect(result.data.alternate_greetings).toEqual(['Alt1']);
    expect(result.data.group_only_greetings).toEqual(['Group1']);
  });

  it('should denormalize to v2 data', () => {
    const result = denormalizeToV2Data(normalized);

    expect(result.name).toBe('Normalized');
    expect(result.first_mes).toBe('Hi!');
    expect(result.alternate_greetings).toEqual(['Alt1']);
    // group_only_greetings is lost
    expect((result as Record<string, unknown>).group_only_greetings).toBeUndefined();
  });

  it('should denormalize to v2 wrapped', () => {
    const result = denormalizeToV2Wrapped(normalized);

    expect(result.spec).toBe('chara_card_v2');
    expect(result.data.name).toBe('Normalized');
  });
});

describe('checkNormalizedToV2Loss', () => {
  it('should report loss when group_only_greetings exist', () => {
    const card: NormalizedCard = {
      name: 'Test',
      description: '',
      personality: '',
      scenario: '',
      firstMes: '',
      mesExample: '',
      alternateGreetings: [],
      groupOnlyGreetings: ['Group greeting'],
      tags: [],
      extensions: {},
    };

    const lost = checkNormalizedToV2Loss(card);

    expect(lost.some((l) => l.includes('group_only_greetings'))).toBe(true);
  });

  it('should report no loss when group_only_greetings is empty', () => {
    const card: NormalizedCard = {
      name: 'Test',
      description: '',
      personality: '',
      scenario: '',
      firstMes: '',
      mesExample: '',
      alternateGreetings: [],
      groupOnlyGreetings: [],
      tags: [],
      extensions: {},
    };

    const lost = checkNormalizedToV2Loss(card);

    expect(lost.length).toBe(0);
  });
});
