import { describe, it, expect } from 'vitest';
import {
  extractLorebookRefs,
  extractLinkedEntries,
  getLorebookCollection,
} from './extractor.js';
import type { CCv3Data, CCv3CharacterBook } from '@character-foundry/schemas';

function makeCard(overrides: Partial<CCv3Data['data']> = {}): CCv3Data {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Test Character',
      description: 'Test description',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      tags: [],
      creator: '',
      character_version: '',
      alternate_greetings: [],
      assets: [],
      ...overrides,
    },
  };
}

describe('extractLorebookRefs', () => {
  it('extracts chub linked_lorebooks', () => {
    const card = makeCard({
      extensions: {
        chub: {
          linked_lorebooks: [
            'https://chub.ai/lorebooks/user/lorebook-name',
            {
              url: 'https://chub.ai/lorebooks/user/another',
              id: 'user/another',
              name: 'Another Lorebook',
            },
          ],
        },
      },
    });

    const refs = extractLorebookRefs(card);

    expect(refs).toHaveLength(2);
    expect(refs[0]!.url).toBe('https://chub.ai/lorebooks/user/lorebook-name');
    expect(refs[0]!.platform).toBe('chub');
    expect(refs[0]!.id).toBe('user/lorebook-name');

    expect(refs[1]!.url).toBe('https://chub.ai/lorebooks/user/another');
    expect(refs[1]!.platform).toBe('chub');
    expect(refs[1]!.id).toBe('user/another');
    expect(refs[1]!.name).toBe('Another Lorebook');
  });

  it('extracts generic world_infos', () => {
    const card = makeCard({
      extensions: {
        world_infos: [
          'https://chub.ai/lorebooks/someone/something',
          { url: 'https://example.com/lorebook', name: 'Generic' },
        ],
      },
    });

    const refs = extractLorebookRefs(card);

    expect(refs).toHaveLength(2);
    expect(refs[0]!.platform).toBe('chub');
    expect(refs[1]!.platform).toBe('unknown');
    expect(refs[1]!.name).toBe('Generic');
  });

  it('extracts generic linked_lorebooks', () => {
    const card = makeCard({
      extensions: {
        linked_lorebooks: [
          {
            url: 'https://risu.io/lorebook/123',
            platform: 'risu',
            id: '123',
          },
        ],
      },
    });

    const refs = extractLorebookRefs(card);

    expect(refs).toHaveLength(1);
    expect(refs[0]!.platform).toBe('risu');
    expect(refs[0]!.id).toBe('123');
  });

  it('extracts Risu ripiLinkedLorebooks', () => {
    const card = makeCard({
      extensions: {
        ripiLinkedLorebooks: [
          { url: 'https://risu.io/lorebook/abc', id: 'abc', name: 'Risu Book' },
        ],
      },
    });

    const refs = extractLorebookRefs(card);

    expect(refs).toHaveLength(1);
    expect(refs[0]!.platform).toBe('risu');
    expect(refs[0]!.name).toBe('Risu Book');
  });

  it('returns empty array when no extensions', () => {
    const card = makeCard({});
    expect(extractLorebookRefs(card)).toEqual([]);
  });

  it('filters out empty URLs', () => {
    const card = makeCard({
      extensions: {
        linked_lorebooks: [
          { url: '', name: 'Empty URL' },
          { url: 'https://example.com/valid', name: 'Valid' },
        ],
      },
    });

    const refs = extractLorebookRefs(card);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.name).toBe('Valid');
  });
});

describe('extractLinkedEntries', () => {
  it('separates embedded from linked entries', () => {
    const book: CCv3CharacterBook = {
      name: 'Mixed Book',
      entries: [
        {
          keys: ['embedded1'],
          content: 'Embedded content 1',
          enabled: true,
          insertion_order: 0,
          id: 0,
          name: 'Embedded 1',
        },
        {
          keys: ['linked1'],
          content: 'Linked content 1',
          enabled: true,
          insertion_order: 1,
          id: 1,
          name: 'Linked 1',
          extensions: {
            lorebookSource: {
              linkedFrom: 'https://chub.ai/lorebooks/user/book',
              platform: 'chub',
              fetchedAt: '2024-01-01T00:00:00Z',
              lorebookName: 'External Book',
            },
          },
        },
        {
          keys: ['embedded2'],
          content: 'Embedded content 2',
          enabled: true,
          insertion_order: 2,
          id: 2,
          name: 'Embedded 2',
        },
        {
          keys: ['linked2'],
          content: 'Linked content 2',
          enabled: true,
          insertion_order: 3,
          id: 3,
          name: 'Linked 2',
          extensions: {
            lorebookSource: {
              linkedFrom: 'https://chub.ai/lorebooks/user/book',
              platform: 'chub',
              fetchedAt: '2024-01-01T00:00:00Z',
              lorebookName: 'External Book',
            },
          },
        },
      ],
    };

    const { embedded, linked } = extractLinkedEntries(book);

    expect(embedded.entries).toHaveLength(2);
    expect(embedded.entries[0]!.keys).toEqual(['embedded1']);
    expect(embedded.entries[1]!.keys).toEqual(['embedded2']);

    expect(linked.size).toBe(1);
    const linkedBook = linked.get('https://chub.ai/lorebooks/user/book')!;
    expect(linkedBook.entries).toHaveLength(2);
    expect(linkedBook.name).toBe('External Book');
  });

  it('handles book with only embedded entries', () => {
    const book: CCv3CharacterBook = {
      name: 'Only Embedded',
      entries: [
        { keys: ['k1'], content: 'c1', enabled: true, insertion_order: 0, id: 0 },
        { keys: ['k2'], content: 'c2', enabled: true, insertion_order: 1, id: 1 },
      ],
    };

    const { embedded, linked } = extractLinkedEntries(book);

    expect(embedded.entries).toHaveLength(2);
    expect(linked.size).toBe(0);
  });

  it('handles entries from multiple linked sources', () => {
    const book: CCv3CharacterBook = {
      entries: [
        {
          keys: ['a'],
          content: 'a',
          enabled: true,
          insertion_order: 0,
          id: 0,
          extensions: {
            lorebookSource: {
              linkedFrom: 'https://source1.com',
              platform: 'unknown',
              fetchedAt: '',
              lorebookName: 'Source 1',
            },
          },
        },
        {
          keys: ['b'],
          content: 'b',
          enabled: true,
          insertion_order: 1,
          id: 1,
          extensions: {
            lorebookSource: {
              linkedFrom: 'https://source2.com',
              platform: 'unknown',
              fetchedAt: '',
              lorebookName: 'Source 2',
            },
          },
        },
      ],
    };

    const { embedded, linked } = extractLinkedEntries(book);

    expect(embedded.entries).toHaveLength(0);
    expect(linked.size).toBe(2);
    expect(linked.has('https://source1.com')).toBe(true);
    expect(linked.has('https://source2.com')).toBe(true);
  });
});

describe('getLorebookCollection', () => {
  it('returns collection with embedded and linked lorebooks', () => {
    const card = makeCard({
      character_book: {
        name: 'Main Book',
        entries: [
          { keys: ['e1'], content: 'c1', enabled: true, insertion_order: 0, id: 0 },
          {
            keys: ['l1'],
            content: 'c2',
            enabled: true,
            insertion_order: 1,
            id: 1,
            extensions: {
              lorebookSource: {
                linkedFrom: 'https://linked.com/book',
                platform: 'chub',
                fetchedAt: '2024-01-01',
                lorebookName: 'Linked Book',
              },
            },
          },
        ],
      },
    });

    const collection = getLorebookCollection(card);

    expect(collection.embedded).toHaveLength(1);
    expect(collection.embedded[0]!.entries).toHaveLength(1);
    expect(collection.embedded[0]!.entries[0]!.keys).toEqual(['e1']);

    expect(collection.linked).toHaveLength(1);
    expect(collection.linked[0]!.source).toBe('https://linked.com/book');
    expect(collection.linked[0]!.platform).toBe('chub');
    expect(collection.linked[0]!.name).toBe('Linked Book');
  });

  it('includes additional_lorebooks from extensions', () => {
    const card = makeCard({
      character_book: {
        name: 'Main',
        entries: [{ keys: ['m'], content: 'm', enabled: true, insertion_order: 0, id: 0 }],
      },
      extensions: {
        additional_lorebooks: [
          {
            name: 'Additional 1',
            entries: [{ keys: ['a1'], content: 'a1', enabled: true, insertion_order: 0, id: 0 }],
          },
          {
            name: 'Additional 2',
            entries: [{ keys: ['a2'], content: 'a2', enabled: true, insertion_order: 0, id: 0 }],
          },
        ],
      },
    });

    const collection = getLorebookCollection(card);

    // Main book + 2 additional
    expect(collection.embedded).toHaveLength(3);
    expect(collection.embedded[0]!.name).toBe('Main');
    expect(collection.embedded[1]!.name).toBe('Additional 1');
    expect(collection.embedded[2]!.name).toBe('Additional 2');
  });

  it('returns empty collection when no character_book', () => {
    const card = makeCard({});
    const collection = getLorebookCollection(card);

    expect(collection.embedded).toHaveLength(0);
    expect(collection.linked).toHaveLength(0);
  });

  it('handles empty character_book entries', () => {
    const card = makeCard({
      character_book: {
        name: 'Empty',
        entries: [],
      },
    });

    const collection = getLorebookCollection(card);
    expect(collection.embedded).toHaveLength(0);
  });
});
