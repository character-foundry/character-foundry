import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  stampEntriesWithSource,
  createLinkedLorebook,
  addLinkedLorebookToCard,
  addEmbeddedLorebookToCard,
  removeLorebookFromCard,
  removeLinkedEntriesBySource,
  replaceLorebookInCard,
  setLorebookCollection,
} from './inserter.js';
import type { CCv3Data, CCv3CharacterBook } from '@character-foundry/schemas';
import type { LorebookCollection } from './types.js';

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

function makeBook(name: string, keys: string[] = ['key']): CCv3CharacterBook {
  return {
    name,
    entries: [
      {
        keys,
        content: `Content for ${name}`,
        enabled: true,
        insertion_order: 0,
        id: 0,
        name: 'Entry 0',
      },
    ],
  };
}

describe('stampEntriesWithSource', () => {
  it('adds source metadata to all entries', () => {
    const book = makeBook('Test Book', ['trigger1', 'trigger2']);

    const stamped = stampEntriesWithSource(book, {
      linkedFrom: 'https://chub.ai/lorebooks/user/book',
      platform: 'chub',
      fetchedAt: '2024-01-15T12:00:00Z',
      lorebookName: 'Test Book',
    });

    expect(stamped.entries[0]!.extensions?.lorebookSource).toEqual({
      linkedFrom: 'https://chub.ai/lorebooks/user/book',
      platform: 'chub',
      fetchedAt: '2024-01-15T12:00:00Z',
      lorebookName: 'Test Book',
      originalEntryId: 'Entry 0',
    });
  });

  it('preserves existing entry extensions', () => {
    const book: CCv3CharacterBook = {
      name: 'Book',
      entries: [
        {
          keys: ['k'],
          content: 'c',
          enabled: true,
          insertion_order: 0,
          id: 0,
          name: 'Entry',
          extensions: {
            customData: { foo: 'bar' },
          },
        },
      ],
    };

    const stamped = stampEntriesWithSource(book, {
      linkedFrom: 'https://example.com',
      platform: 'unknown',
      fetchedAt: '',
    });

    expect(stamped.entries[0]!.extensions?.customData).toEqual({ foo: 'bar' });
    expect(stamped.entries[0]!.extensions?.lorebookSource).toBeDefined();
  });
});

describe('createLinkedLorebook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T10:00:00Z'));
  });

  it('creates a LinkedLorebook with stamped entries', () => {
    const book = makeBook('External Book');

    const linked = createLinkedLorebook(
      book,
      'https://chub.ai/lorebooks/user/external',
      'chub',
      'user/external'
    );

    expect(linked.source).toBe('https://chub.ai/lorebooks/user/external');
    expect(linked.platform).toBe('chub');
    expect(linked.sourceId).toBe('user/external');
    expect(linked.fetchedAt).toBe('2024-06-01T10:00:00.000Z');
    expect(linked.name).toBe('External Book');

    // Entries should be stamped
    expect(linked.book.entries[0]!.extensions?.lorebookSource).toMatchObject({
      linkedFrom: 'https://chub.ai/lorebooks/user/external',
      platform: 'chub',
    });

    vi.useRealTimers();
  });
});

describe('addLinkedLorebookToCard', () => {
  it('adds linked lorebook to extensions.additional_lorebooks', () => {
    const card = makeCard({});
    const linked = {
      source: 'https://example.com/book',
      platform: 'unknown',
      fetchedAt: '',
      book: makeBook('Linked'),
    };

    const updated = addLinkedLorebookToCard(card, linked);

    const additional = (updated.data.extensions as Record<string, unknown>)
      ?.additional_lorebooks as CCv3CharacterBook[];
    expect(additional).toHaveLength(1);
    expect(additional[0]!.name).toBe('Linked');
  });

  it('appends to existing additional_lorebooks', () => {
    const card = makeCard({
      extensions: {
        additional_lorebooks: [makeBook('Existing')],
      },
    });
    const linked = {
      source: 'https://example.com/book2',
      platform: 'unknown',
      fetchedAt: '',
      book: makeBook('New'),
    };

    const updated = addLinkedLorebookToCard(card, linked);

    const additional = (updated.data.extensions as Record<string, unknown>)
      ?.additional_lorebooks as CCv3CharacterBook[];
    expect(additional).toHaveLength(2);
    expect(additional[0]!.name).toBe('Existing');
    expect(additional[1]!.name).toBe('New');
  });
});

describe('addEmbeddedLorebookToCard', () => {
  it('sets as character_book when none exists', () => {
    const card = makeCard({});
    const book = makeBook('Main Book');

    const updated = addEmbeddedLorebookToCard(card, book);

    expect(updated.data.character_book?.name).toBe('Main Book');
  });

  it('adds to additional_lorebooks when character_book exists', () => {
    const card = makeCard({
      character_book: makeBook('Existing Main'),
    });
    const book = makeBook('Secondary');

    const updated = addEmbeddedLorebookToCard(card, book);

    expect(updated.data.character_book?.name).toBe('Existing Main');
    const additional = (updated.data.extensions as Record<string, unknown>)
      ?.additional_lorebooks as CCv3CharacterBook[];
    expect(additional).toHaveLength(1);
    expect(additional[0]!.name).toBe('Secondary');
  });

  it('sets as character_book when existing one is empty', () => {
    const card = makeCard({
      character_book: { name: 'Empty', entries: [] },
    });
    const book = makeBook('New Main');

    const updated = addEmbeddedLorebookToCard(card, book);

    expect(updated.data.character_book?.name).toBe('New Main');
    expect(updated.data.character_book?.entries).toHaveLength(1);
  });
});

describe('removeLorebookFromCard', () => {
  it('removes character_book by name', () => {
    const card = makeCard({
      character_book: makeBook('ToRemove'),
    });

    const updated = removeLorebookFromCard(card, 'ToRemove');

    expect(updated.data.character_book).toBeUndefined();
  });

  it('removes from additional_lorebooks by name', () => {
    const card = makeCard({
      character_book: makeBook('Main'),
      extensions: {
        additional_lorebooks: [makeBook('Keep'), makeBook('Remove'), makeBook('AlsoKeep')],
      },
    });

    const updated = removeLorebookFromCard(card, 'Remove');

    expect(updated.data.character_book?.name).toBe('Main');
    const additional = (updated.data.extensions as Record<string, unknown>)
      ?.additional_lorebooks as CCv3CharacterBook[];
    expect(additional).toHaveLength(2);
    expect(additional.map(b => b.name)).toEqual(['Keep', 'AlsoKeep']);
  });

  it('handles non-existent lorebook gracefully', () => {
    const card = makeCard({
      character_book: makeBook('Existing'),
    });

    const updated = removeLorebookFromCard(card, 'NonExistent');

    expect(updated.data.character_book?.name).toBe('Existing');
  });
});

describe('removeLinkedEntriesBySource', () => {
  it('removes entries with matching source from character_book', () => {
    const card = makeCard({
      character_book: {
        name: 'Mixed',
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
                linkedFrom: 'https://remove.me',
                platform: 'unknown',
                fetchedAt: '',
              },
            },
          },
        ],
      },
    });

    const updated = removeLinkedEntriesBySource(card, 'https://remove.me');

    expect(updated.data.character_book?.entries).toHaveLength(1);
    expect(updated.data.character_book?.entries[0]!.keys).toEqual(['e1']);
  });

  it('removes entries from additional_lorebooks too', () => {
    const card = makeCard({
      extensions: {
        additional_lorebooks: [
          {
            name: 'Additional',
            entries: [
              {
                keys: ['linked'],
                content: 'linked',
                enabled: true,
                insertion_order: 0,
                id: 0,
                extensions: {
                  lorebookSource: {
                    linkedFrom: 'https://source.com',
                    platform: 'unknown',
                    fetchedAt: '',
                  },
                },
              },
            ],
          },
        ],
      },
    });

    const updated = removeLinkedEntriesBySource(card, 'https://source.com');

    // Book should be removed since it has no entries left
    const additional = (updated.data.extensions as Record<string, unknown>)?.additional_lorebooks;
    expect(additional).toBeUndefined();
  });
});

describe('replaceLorebookInCard', () => {
  it('replaces character_book when name matches', () => {
    const card = makeCard({
      character_book: makeBook('Main'),
    });
    const updated = {
      name: 'Main',
      entries: [{ keys: ['new'], content: 'new content', enabled: true, insertion_order: 0, id: 0 }],
    };

    const result = replaceLorebookInCard(card, updated);

    expect(result.data.character_book?.entries[0]!.content).toBe('new content');
  });

  it('replaces in additional_lorebooks when name matches', () => {
    const card = makeCard({
      character_book: makeBook('Main'),
      extensions: {
        additional_lorebooks: [makeBook('ToReplace'), makeBook('Other')],
      },
    });
    const updated = {
      name: 'ToReplace',
      entries: [{ keys: ['replaced'], content: 'replaced', enabled: true, insertion_order: 0, id: 0 }],
    };

    const result = replaceLorebookInCard(card, updated);

    const additional = (result.data.extensions as Record<string, unknown>)
      ?.additional_lorebooks as CCv3CharacterBook[];
    expect(additional[0]!.entries[0]!.keys).toEqual(['replaced']);
    expect(additional[1]!.name).toBe('Other');
  });
});

describe('setLorebookCollection', () => {
  it('rebuilds card lorebooks from collection', () => {
    const card = makeCard({
      character_book: makeBook('Old'),
    });

    const collection: LorebookCollection = {
      embedded: [makeBook('New Main'), makeBook('Additional Embedded')],
      linked: [
        {
          source: 'https://linked.com',
          platform: 'chub',
          fetchedAt: '',
          book: makeBook('Linked Book'),
        },
      ],
    };

    const result = setLorebookCollection(card, collection);

    expect(result.data.character_book?.name).toBe('New Main');
    const additional = (result.data.extensions as Record<string, unknown>)
      ?.additional_lorebooks as CCv3CharacterBook[];
    expect(additional).toHaveLength(2);
    expect(additional[0]!.name).toBe('Additional Embedded');
    expect(additional[1]!.name).toBe('Linked Book');
  });

  it('handles empty collection', () => {
    const card = makeCard({
      character_book: makeBook('Existing'),
    });

    const collection: LorebookCollection = {
      embedded: [],
      linked: [],
    };

    const result = setLorebookCollection(card, collection);

    expect(result.data.character_book).toBeUndefined();
    expect((result.data.extensions as Record<string, unknown>)?.additional_lorebooks).toBeUndefined();
  });
});
