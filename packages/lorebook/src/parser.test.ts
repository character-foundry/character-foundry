import { describe, it, expect } from 'vitest';
import { parseLorebook, detectLorebookFormat, normalizeToCC3 } from './parser.js';
import type { SillyTavernWorldInfo, AgnaiLorebook } from './types.js';

describe('detectLorebookFormat', () => {
  it('detects CCv3 format', () => {
    const ccv3 = {
      name: 'Test Lorebook',
      entries: [
        { keys: ['key1'], content: 'Content 1' },
      ],
    };

    expect(detectLorebookFormat(ccv3)).toBe('ccv3');
  });

  it('detects SillyTavern format', () => {
    const st: SillyTavernWorldInfo = {
      name: 'Test World Info',
      entries: {
        '0': {
          uid: 0,
          key: ['trigger'],
          content: 'Some content',
        },
      },
    };

    expect(detectLorebookFormat(st)).toBe('sillytavern');
  });

  it('detects Agnai format', () => {
    const agnai: AgnaiLorebook = {
      kind: 'memory',
      name: 'Test Agnai',
      entries: [
        {
          name: 'Entry 1',
          entry: 'Content',
          keywords: ['key1'],
          priority: 10,
          weight: 1,
          enabled: true,
        },
      ],
    };

    expect(detectLorebookFormat(agnai)).toBe('agnai');
  });

  it('detects Risu format', () => {
    const risu = { type: 'risu', name: 'Test' };
    expect(detectLorebookFormat(risu)).toBe('risu');

    const risuAlt = { ripiVersion: 1, name: 'Test' };
    expect(detectLorebookFormat(risuAlt)).toBe('risu');
  });

  it('detects Wyvern format', () => {
    const wyvern = { format: 'wyvern', name: 'Test' };
    expect(detectLorebookFormat(wyvern)).toBe('wyvern');

    const wyvernAlt = { wyvern: {}, name: 'Test' };
    expect(detectLorebookFormat(wyvernAlt)).toBe('wyvern');
  });

  it('returns unknown for unrecognized formats', () => {
    expect(detectLorebookFormat({})).toBe('unknown');
    expect(detectLorebookFormat(null)).toBe('unknown');
    expect(detectLorebookFormat({ random: 'data' })).toBe('unknown');
  });
});

describe('normalizeToCC3', () => {
  it('normalizes CCv3 format', () => {
    const ccv3 = {
      name: 'Test Lorebook',
      description: 'A test',
      entries: [
        {
          keys: ['key1', 'key2'],
          content: 'Content 1',
          enabled: true,
          name: 'Entry 1',
        },
      ],
    };

    const result = normalizeToCC3(ccv3, 'ccv3');

    expect(result.name).toBe('Test Lorebook');
    expect(result.description).toBe('A test');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.keys).toEqual(['key1', 'key2']);
    expect(result.entries[0]!.content).toBe('Content 1');
  });

  it('normalizes SillyTavern format', () => {
    const st: SillyTavernWorldInfo = {
      name: 'ST World Info',
      entries: {
        '0': {
          uid: 0,
          key: ['trigger1', 'trigger2'],
          keysecondary: ['secondary'],
          content: 'World info content',
          comment: 'Entry comment',
          order: 5,
          position: 1,
          disable: false,
          selective: true,
          constant: false,
        },
        '1': {
          uid: 1,
          key: ['another'],
          content: 'Another entry',
          order: 10,
        },
      },
    };

    const result = normalizeToCC3(st, 'sillytavern');

    expect(result.name).toBe('ST World Info');
    expect(result.entries).toHaveLength(2);

    // Should be sorted by order
    expect(result.entries[0]!.keys).toEqual(['trigger1', 'trigger2']);
    expect(result.entries[0]!.secondary_keys).toEqual(['secondary']);
    expect(result.entries[0]!.content).toBe('World info content');
    expect(result.entries[0]!.enabled).toBe(true);
    expect(result.entries[0]!.selective).toBe(true);
    expect(result.entries[0]!.position).toBe('after_char');

    // Should preserve ST-specific extensions
    expect(result.entries[0]!.extensions?.sillytavern).toBeDefined();
  });

  it('normalizes Agnai format', () => {
    const agnai: AgnaiLorebook = {
      kind: 'memory',
      name: 'Agnai Lorebook',
      description: 'Test description',
      entries: [
        {
          name: 'First Entry',
          entry: 'Entry content here',
          keywords: ['keyword1', 'keyword2'],
          priority: 15,
          weight: 2,
          enabled: true,
        },
      ],
    };

    const result = normalizeToCC3(agnai, 'agnai');

    expect(result.name).toBe('Agnai Lorebook');
    expect(result.description).toBe('Test description');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.keys).toEqual(['keyword1', 'keyword2']);
    expect(result.entries[0]!.content).toBe('Entry content here');
    expect(result.entries[0]!.name).toBe('First Entry');
    expect(result.entries[0]!.priority).toBe(15);

    // Should preserve Agnai-specific extensions
    expect(result.entries[0]!.extensions?.agnai).toEqual({ weight: 2 });
  });

  it('handles unknown format with generic normalization', () => {
    const unknown = {
      name: 'Unknown Format',
      entries: [
        { key: 'single,key', text: 'Some text', enabled: true },
      ],
    };

    const result = normalizeToCC3(unknown, 'unknown');

    expect(result.name).toBe('Unknown Format');
    expect(result.entries).toHaveLength(1);
    // Should split comma-separated key string
    expect(result.entries[0]!.keys).toEqual(['single', 'key']);
    expect(result.entries[0]!.content).toBe('Some text');
  });
});

describe('parseLorebook', () => {
  it('parses CCv3 JSON', () => {
    const json = JSON.stringify({
      name: 'My Lorebook',
      entries: [
        { keys: ['test'], content: 'Test content' },
      ],
    });

    const result = parseLorebook(new TextEncoder().encode(json));

    expect(result.originalFormat).toBe('ccv3');
    expect(result.book.name).toBe('My Lorebook');
    expect(result.book.entries).toHaveLength(1);
    expect(result.originalShape).toBeDefined();
  });

  it('parses SillyTavern JSON', () => {
    const json = JSON.stringify({
      name: 'ST Lorebook',
      entries: {
        '0': { uid: 0, key: ['trigger'], content: 'Content' },
      },
    });

    const result = parseLorebook(new TextEncoder().encode(json));

    expect(result.originalFormat).toBe('sillytavern');
    expect(result.book.name).toBe('ST Lorebook');
    expect(result.book.entries).toHaveLength(1);
    expect(result.book.entries[0]!.keys).toEqual(['trigger']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseLorebook(new TextEncoder().encode('not json'))).toThrow(
      'Failed to parse lorebook JSON'
    );
  });

  it('handles string input', () => {
    const json = JSON.stringify({
      name: 'String Input Test',
      entries: [{ keys: ['k'], content: 'c' }],
    });

    // toString in core handles both Uint8Array and string
    const result = parseLorebook(new TextEncoder().encode(json));
    expect(result.book.name).toBe('String Input Test');
  });
});
