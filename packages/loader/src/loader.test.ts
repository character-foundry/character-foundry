/**
 * Universal Loader Tests
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import { parseCard, parseCardAsync, getContainerFormat, parseLorebook, parse } from './loader.js';

describe('parseCard', () => {
  describe('CharX parsing', () => {
    it('should parse CharX ZIP', () => {
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Alice',
          description: 'A helpful AI',
          personality: 'Friendly',
          scenario: 'Chat',
          first_mes: 'Hello!',
          mes_example: '',
          creator_notes: '',
          system_prompt: '',
          post_history_instructions: '',
          alternate_greetings: [],
          group_only_greetings: [],
          tags: ['friendly'],
          creator: 'Test',
          character_version: '1.0',
          extensions: {},
        },
      };

      const zipData = zipSync({
        'card.json': fromString(JSON.stringify(card)),
      });

      const result = parseCard(zipData);

      expect(result.containerFormat).toBe('charx');
      expect(result.spec).toBe('v3');
      expect(result.card.data.name).toBe('Alice');
    });

    it('should extract assets from CharX', () => {
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test',
          extensions: {},
          assets: [{
            type: 'icon',
            uri: 'embeded://assets/icon/images/icon.png',
            name: 'icon',
            ext: 'png',
          }],
        },
      };

      const iconData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

      const zipData = zipSync({
        'card.json': fromString(JSON.stringify(card)),
        'assets/icon/images/icon.png': iconData,
      });

      const result = parseCard(zipData);

      expect(result.assets.length).toBe(1);
      expect(result.assets[0]!.type).toBe('icon');
    });
  });

  describe('Voxta parsing', () => {
    it('should parse Voxta package', () => {
      const character = {
        $type: 'character',
        Id: 'char-123',
        PackageId: 'pkg-456',
        Name: 'Bob',
        Personality: 'Helpful',
        Profile: 'A test character',
        Scenario: 'Testing',
        FirstMessage: 'Hello {{ user }}!',
        MessageExamples: '',
        Creator: 'Test',
        DateCreated: '2024-01-01T00:00:00Z',
        DateModified: '2024-01-01T00:00:00Z',
      };

      const zipData = zipSync({
        'Characters/char-123/character.json': fromString(JSON.stringify(character)),
      });

      const result = parseCard(zipData);

      expect(result.containerFormat).toBe('voxta');
      expect(result.sourceFormat).toBe('voxta');
      expect(result.card.data.name).toBe('Bob');
      // Macros should be converted
      expect(result.card.data.first_mes).toBe('Hello {{user}}!');
    });

    it('should extract Voxta metadata', () => {
      const character = {
        $type: 'character',
        Id: 'char-abc',
        PackageId: 'pkg-xyz',
        Name: 'Test',
        DateCreated: '2024-01-01T00:00:00Z',
        DateModified: '2024-01-02T00:00:00Z',
      };

      const zipData = zipSync({
        'Characters/char-abc/character.json': fromString(JSON.stringify(character)),
      });

      const result = parseCard(zipData);

      expect(result.metadata?.characterId).toBe('char-abc');
      expect(result.metadata?.dateCreated).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('JSON parsing', () => {
    it('should parse CCv3 JSON', () => {
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'JSON Card',
          description: 'Loaded from JSON',
          personality: '',
          scenario: '',
          first_mes: 'Hi!',
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

      const jsonData = fromString(JSON.stringify(card));
      const result = parseCard(jsonData);

      expect(result.containerFormat).toBe('json');
      expect(result.spec).toBe('v3');
      expect(result.card.data.name).toBe('JSON Card');
    });

    it('should parse CCv2 JSON and convert to v3', () => {
      const card = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'V2 Card',
          description: 'A v2 card',
          personality: '',
          scenario: '',
          first_mes: 'Hello!',
          mes_example: '',
          creator_notes: '',
          system_prompt: '',
          post_history_instructions: '',
          alternate_greetings: [],
          tags: [],
          creator: '',
          character_version: '',
          extensions: {},
        },
      };

      const jsonData = fromString(JSON.stringify(card));
      const result = parseCard(jsonData);

      expect(result.spec).toBe('v2');
      expect(result.card.spec).toBe('chara_card_v3');
      expect(result.card.data.name).toBe('V2 Card');
    });
  });

  describe('Error handling', () => {
    it('should throw on unknown format', () => {
      const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

      expect(() => parseCard(data)).toThrow();
    });

    it('should throw on invalid JSON', () => {
      const data = fromString('not valid json {{{');

      expect(() => parseCard(data)).toThrow();
    });

    it('should throw on ZIP without card structure', () => {
      const zipData = zipSync({
        'random.txt': fromString('Hello'),
      });

      expect(() => parseCard(zipData)).toThrow();
    });
  });
});

describe('parseCardAsync', () => {
  it('should return same result as sync version', async () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: { name: 'Async Test', extensions: {} },
    };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
    });

    const syncResult = parseCard(zipData);
    const asyncResult = await parseCardAsync(zipData);

    expect(asyncResult.card.data.name).toBe(syncResult.card.data.name);
    expect(asyncResult.containerFormat).toBe(syncResult.containerFormat);
  });
});

describe('getContainerFormat', () => {
  it('should return format without full parsing', () => {
    const card = {
      spec: 'chara_card_v3',
      data: { name: 'Test' },
    };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
    });

    expect(getContainerFormat(zipData)).toBe('charx');
  });

  it('should return json for JSON data', () => {
    const json = fromString('{"name": "Test"}');

    expect(getContainerFormat(json)).toBe('json');
  });

  it('should return unknown for unrecognized data', () => {
    const data = new Uint8Array([0x00, 0x01, 0x02]);

    expect(getContainerFormat(data)).toBe('unknown');
  });
});

describe('parseLorebook', () => {
  it('should parse SillyTavern world_info format', () => {
    const lorebook = {
      name: 'Test Lorebook',
      description: 'A test lorebook',
      entries: {
        '0': {
          uid: 0,
          key: ['dragon', 'wyrm'],
          content: 'Dragons are mythical creatures.',
          order: 0,
          disable: false,
          selective: false,
        },
        '1': {
          uid: 1,
          key: ['elf', 'elven'],
          content: 'Elves are ancient beings.',
          order: 1,
          disable: false,
          selective: true,
        },
      },
    };

    const data = fromString(JSON.stringify(lorebook));
    const result = parseLorebook(data);

    expect(result.type).toBe('lorebook');
    expect(result.containerFormat).toBe('lorebook');
    expect(result.lorebookFormat).toBe('sillytavern');
    expect(result.book.name).toBe('Test Lorebook');
    expect(result.book.entries.length).toBe(2);
    expect(result.book.entries[0]!.keys).toContain('dragon');
    expect(result.book.entries[0]!.content).toBe('Dragons are mythical creatures.');
  });

  it('should parse CCv3 character_book format', () => {
    const lorebook = {
      name: 'CCv3 Lorebook',
      entries: [
        {
          keys: ['magic', 'spell'],
          content: 'Magic flows through the world.',
          enabled: true,
          insertion_order: 0,
          id: 0,
        },
      ],
    };

    const data = fromString(JSON.stringify(lorebook));
    const result = parseLorebook(data);

    expect(result.type).toBe('lorebook');
    expect(result.lorebookFormat).toBe('ccv3');
    expect(result.book.entries.length).toBe(1);
    expect(result.book.entries[0]!.keys).toContain('magic');
  });

  it('should parse Agnai format', () => {
    const lorebook = {
      kind: 'memory',
      name: 'Agnai Lorebook',
      entries: [
        {
          name: 'Entry 1',
          entry: 'Some lore content.',
          keywords: ['keyword1', 'keyword2'],
          priority: 5,
          weight: 1,
          enabled: true,
        },
      ],
    };

    const data = fromString(JSON.stringify(lorebook));
    const result = parseLorebook(data);

    expect(result.type).toBe('lorebook');
    expect(result.lorebookFormat).toBe('agnai');
    expect(result.book.entries.length).toBe(1);
    expect(result.book.entries[0]!.keys).toContain('keyword1');
  });
});

describe('parse (universal)', () => {
  it('should parse character card and return type=card', () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Universal Test',
        description: 'Testing universal parse',
        extensions: {},
      },
    };

    const zipData = zipSync({
      'card.json': fromString(JSON.stringify(card)),
    });

    const result = parse(zipData);

    expect(result.type).toBe('card');
    if (result.type === 'card') {
      expect(result.card.data.name).toBe('Universal Test');
      expect(result.containerFormat).toBe('charx');
    }
  });

  it('should parse lorebook and return type=lorebook', () => {
    const lorebook = {
      name: 'Universal Lorebook',
      entries: {
        '0': {
          uid: 0,
          key: ['test'],
          content: 'Test content.',
        },
      },
    };

    const data = fromString(JSON.stringify(lorebook));
    const result = parse(data);

    expect(result.type).toBe('lorebook');
    if (result.type === 'lorebook') {
      expect(result.book.name).toBe('Universal Lorebook');
      expect(result.containerFormat).toBe('lorebook');
    }
  });

  it('should parse JSON card correctly', () => {
    const card = {
      spec: 'chara_card_v3',
      data: {
        name: 'JSON Card',
        description: 'A card in JSON',
        extensions: {},
      },
    };

    const data = fromString(JSON.stringify(card));
    const result = parse(data);

    expect(result.type).toBe('card');
    if (result.type === 'card') {
      expect(result.card.data.name).toBe('JSON Card');
      expect(result.containerFormat).toBe('json');
    }
  });

  it('should distinguish card from lorebook in JSON', () => {
    // This card has data.name which is a card indicator
    const card = {
      spec: 'chara_card_v3',
      data: {
        name: 'A Card',
        description: 'Not a lorebook',
      },
    };

    // This is clearly a lorebook (entries object with uid/key/content)
    const lorebook = {
      entries: {
        '0': { uid: 0, key: ['test'], content: 'Content' },
      },
    };

    const cardResult = parse(fromString(JSON.stringify(card)));
    const lorebookResult = parse(fromString(JSON.stringify(lorebook)));

    expect(cardResult.type).toBe('card');
    expect(lorebookResult.type).toBe('lorebook');
  });

  it('should throw on invalid JSON', () => {
    expect(() => parse(fromString('not valid json'))).toThrow();
  });

  it('should throw on unrecognized format', () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(() => parse(data)).toThrow();
  });
});
