/**
 * Universal Loader Tests
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { fromString } from '@character-foundry/core';
import { parseCard, parseCardAsync, getContainerFormat } from './loader.js';

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
