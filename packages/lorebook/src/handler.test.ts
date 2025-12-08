import { describe, it, expect } from 'vitest';
import {
  convertLorebook,
  serializeLorebook,
  serializeParsedLorebook,
  mergeLorebooks,
  findEntriesByKeys,
  findEntryByNameOrId,
  updateEntry,
  addEntry,
  removeEntry,
  reorderEntries,
} from './handler.js';
import type { CCv3CharacterBook } from '@character-foundry/schemas';
import type { ParsedLorebook, SillyTavernWorldInfo, AgnaiLorebook } from './types.js';

function makeBook(name: string, entries: Partial<CCv3CharacterBook['entries'][0]>[] = []): CCv3CharacterBook {
  return {
    name,
    entries: entries.map((e, i) => ({
      keys: e.keys || ['key'],
      content: e.content || 'content',
      enabled: e.enabled ?? true,
      insertion_order: e.insertion_order ?? i,
      id: e.id ?? i,
      name: e.name || `Entry ${i}`,
      ...e,
    })),
  };
}

describe('convertLorebook', () => {
  it('returns CCv3 as-is', () => {
    const book = makeBook('Test', [{ keys: ['k'], content: 'c' }]);
    const result = convertLorebook(book, 'ccv3');
    expect(result).toEqual(book);
  });

  it('converts to SillyTavern format', () => {
    const book = makeBook('ST Book', [
      {
        keys: ['trigger1', 'trigger2'],
        secondary_keys: ['sec'],
        content: 'World info content',
        name: 'Entry Name',
        comment: 'A comment',
        position: 'after_char',
        enabled: false,
        selective: true,
        insertion_order: 5,
        id: 42,
      },
    ]);

    const result = convertLorebook(book, 'sillytavern') as SillyTavernWorldInfo;

    expect(result.name).toBe('ST Book');
    expect(result.entries['42']).toBeDefined();
    expect(result.entries['42']!.uid).toBe(42);
    expect(result.entries['42']!.key).toEqual(['trigger1', 'trigger2']);
    expect(result.entries['42']!.keysecondary).toEqual(['sec']);
    expect(result.entries['42']!.content).toBe('World info content');
    expect(result.entries['42']!.disable).toBe(true);
    expect(result.entries['42']!.selective).toBe(true);
    expect(result.entries['42']!.position).toBe(1); // after_char = 1
  });

  it('converts to Agnai format', () => {
    const book = makeBook('Agnai Book', [
      {
        keys: ['keyword1', 'keyword2'],
        content: 'Entry content',
        name: 'Entry Name',
        priority: 15,
        enabled: true,
      },
    ]);

    const result = convertLorebook(book, 'agnai') as AgnaiLorebook;

    expect(result.kind).toBe('memory');
    expect(result.name).toBe('Agnai Book');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.name).toBe('Entry Name');
    expect(result.entries[0]!.entry).toBe('Entry content');
    expect(result.entries[0]!.keywords).toEqual(['keyword1', 'keyword2']);
    expect(result.entries[0]!.priority).toBe(15);
    expect(result.entries[0]!.weight).toBe(1);
    expect(result.entries[0]!.enabled).toBe(true);
  });

  it('preserves original shape for Risu', () => {
    const book = makeBook('Risu', [{ keys: ['k'], content: 'c' }]);
    const original = { type: 'risu', customField: 'preserved', name: 'Old Name' };

    const result = convertLorebook(book, 'risu', original) as Record<string, unknown>;

    expect(result.type).toBe('risu');
    expect(result.customField).toBe('preserved');
    expect(result.name).toBe('Risu'); // Updated from book
  });

  it('preserves original shape for Wyvern', () => {
    const book = makeBook('Wyvern', [{ keys: ['k'], content: 'c' }]);
    const original = { format: 'wyvern', wyvernData: { foo: 'bar' } };

    const result = convertLorebook(book, 'wyvern', original) as Record<string, unknown>;

    expect(result.format).toBe('wyvern');
    expect(result.wyvernData).toEqual({ foo: 'bar' });
  });
});

describe('serializeLorebook', () => {
  it('serializes to pretty JSON by default', () => {
    const book = makeBook('Test', [{ keys: ['k'], content: 'c' }]);
    const json = serializeLorebook(book);

    expect(json).toContain('\n');
    expect(JSON.parse(json).name).toBe('Test');
  });

  it('serializes to compact JSON when pretty=false', () => {
    const book = makeBook('Test', [{ keys: ['k'], content: 'c' }]);
    const json = serializeLorebook(book, 'ccv3', undefined, false);

    expect(json).not.toContain('\n');
  });

  it('converts format before serializing', () => {
    const book = makeBook('Test', [{ keys: ['k'], content: 'c', id: 0 }]);
    const json = serializeLorebook(book, 'sillytavern');
    const parsed = JSON.parse(json) as SillyTavernWorldInfo;

    expect(parsed.entries).toBeDefined();
    expect(typeof parsed.entries).toBe('object');
    expect(parsed.entries['0']).toBeDefined();
  });
});

describe('serializeParsedLorebook', () => {
  it('round-trips to original format', () => {
    const parsed: ParsedLorebook = {
      book: makeBook('Test', [{ keys: ['k'], content: 'c', id: 5 }]),
      originalFormat: 'sillytavern',
      originalShape: { entries: { '5': { uid: 5, key: ['k'], content: 'c' } } },
    };

    const json = serializeParsedLorebook(parsed);
    const result = JSON.parse(json) as SillyTavernWorldInfo;

    expect(result.entries['5']).toBeDefined();
  });
});

describe('mergeLorebooks', () => {
  it('combines entries from two books', () => {
    const bookA = makeBook('Book A', [
      { keys: ['a1'], content: 'A1', id: 0 },
      { keys: ['a2'], content: 'A2', id: 1 },
    ]);
    const bookB = makeBook('Book B', [
      { keys: ['b1'], content: 'B1', id: 0 },
    ]);

    const merged = mergeLorebooks(bookA, bookB);

    expect(merged.entries).toHaveLength(3);
    expect(merged.entries[0]!.keys).toEqual(['a1']);
    expect(merged.entries[1]!.keys).toEqual(['a2']);
    expect(merged.entries[2]!.keys).toEqual(['b1']);
    // B entries should be renumbered
    expect(merged.entries[2]!.id).toBe(2);
  });

  it('uses custom name when provided', () => {
    const bookA = makeBook('A', []);
    const bookB = makeBook('B', []);

    const merged = mergeLorebooks(bookA, bookB, 'Custom Name');

    expect(merged.name).toBe('Custom Name');
  });

  it('merges extensions', () => {
    const bookA = makeBook('A', []);
    bookA.extensions = { extA: 'valueA' };
    const bookB = makeBook('B', []);
    bookB.extensions = { extB: 'valueB' };

    const merged = mergeLorebooks(bookA, bookB);

    expect(merged.extensions?.extA).toBe('valueA');
    expect(merged.extensions?.extB).toBe('valueB');
  });
});

describe('findEntriesByKeys', () => {
  const book = makeBook('Search Test', [
    { keys: ['cat', 'feline'], content: 'About cats', id: 0, name: 'Cats' },
    { keys: ['dog', 'canine'], content: 'About dogs', id: 1, name: 'Dogs' },
    { keys: ['bird', 'avian'], content: 'About birds', id: 2, name: 'Birds' },
    { keys: ['Cat breed'], content: 'Cat breeds', id: 3, name: 'Cat Breeds' },
  ]);

  it('finds entries matching any key (case-insensitive)', () => {
    const results = findEntriesByKeys(book, ['CAT']);

    expect(results).toHaveLength(2);
    expect(results.map(e => e.name)).toContain('Cats');
    expect(results.map(e => e.name)).toContain('Cat Breeds');
  });

  it('finds entries matching all keys with matchAll', () => {
    const results = findEntriesByKeys(book, ['cat', 'breed'], { matchAll: true });

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Cat Breeds');
  });

  it('respects caseSensitive option', () => {
    const results = findEntriesByKeys(book, ['CAT'], { caseSensitive: true });

    expect(results).toHaveLength(0);
  });

  it('finds partial key matches', () => {
    const results = findEntriesByKeys(book, ['ine']);

    expect(results).toHaveLength(2); // feline, canine
  });
});

describe('findEntryByNameOrId', () => {
  const book = makeBook('Find Test', [
    { keys: ['k1'], content: 'c1', id: 10, name: 'First Entry' },
    { keys: ['k2'], content: 'c2', id: 20, name: 'Second Entry' },
  ]);

  it('finds by numeric id', () => {
    const entry = findEntryByNameOrId(book, 10);
    expect(entry?.name).toBe('First Entry');
  });

  it('finds by name', () => {
    const entry = findEntryByNameOrId(book, 'Second Entry');
    expect(entry?.name).toBe('Second Entry');
  });

  it('finds by string id', () => {
    const entry = findEntryByNameOrId(book, '20');
    expect(entry?.name).toBe('Second Entry');
  });

  it('returns undefined when not found', () => {
    const entry = findEntryByNameOrId(book, 999);
    expect(entry).toBeUndefined();
  });
});

describe('updateEntry', () => {
  it('updates entry by id', () => {
    const book = makeBook('Update Test', [
      { keys: ['old'], content: 'old content', id: 5, name: 'Entry' },
    ]);

    const updated = updateEntry(book, 5, { content: 'new content', keys: ['new'] });

    expect(updated.entries[0]!.content).toBe('new content');
    expect(updated.entries[0]!.keys).toEqual(['new']);
    expect(updated.entries[0]!.name).toBe('Entry'); // Unchanged
  });

  it('updates entry by name', () => {
    const book = makeBook('Update Test', [
      { keys: ['k'], content: 'c', id: 0, name: 'Target Entry' },
    ]);

    const updated = updateEntry(book, 'Target Entry', { enabled: false });

    expect(updated.entries[0]!.enabled).toBe(false);
  });

  it('leaves other entries unchanged', () => {
    const book = makeBook('Update Test', [
      { keys: ['k1'], content: 'c1', id: 0 },
      { keys: ['k2'], content: 'c2', id: 1 },
    ]);

    const updated = updateEntry(book, 0, { content: 'updated' });

    expect(updated.entries[0]!.content).toBe('updated');
    expect(updated.entries[1]!.content).toBe('c2');
  });
});

describe('addEntry', () => {
  it('adds entry with auto-generated id', () => {
    const book = makeBook('Add Test', [
      { keys: ['k'], content: 'c', id: 5 },
    ]);

    const updated = addEntry(book, {
      keys: ['new'],
      content: 'new content',
      enabled: true,
      name: 'New Entry',
    });

    expect(updated.entries).toHaveLength(2);
    expect(updated.entries[1]!.id).toBe(6);
    expect(updated.entries[1]!.insertion_order).toBe(1);
    expect(updated.entries[1]!.keys).toEqual(['new']);
  });

  it('handles empty book', () => {
    const book = makeBook('Empty', []);

    const updated = addEntry(book, {
      keys: ['first'],
      content: 'first entry',
      enabled: true,
      name: 'First',
    });

    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0]!.id).toBe(1);
  });
});

describe('removeEntry', () => {
  it('removes entry by id', () => {
    const book = makeBook('Remove Test', [
      { keys: ['k1'], content: 'c1', id: 0 },
      { keys: ['k2'], content: 'c2', id: 1 },
      { keys: ['k3'], content: 'c3', id: 2 },
    ]);

    const updated = removeEntry(book, 1);

    expect(updated.entries).toHaveLength(2);
    expect(updated.entries.map(e => e.id)).toEqual([0, 2]);
  });

  it('removes entry by name', () => {
    const book = makeBook('Remove Test', [
      { keys: ['k'], content: 'c', id: 0, name: 'ToRemove' },
    ]);

    const updated = removeEntry(book, 'ToRemove');

    expect(updated.entries).toHaveLength(0);
  });

  it('does nothing if entry not found', () => {
    const book = makeBook('Remove Test', [
      { keys: ['k'], content: 'c', id: 0 },
    ]);

    const updated = removeEntry(book, 999);

    expect(updated.entries).toHaveLength(1);
  });
});

describe('reorderEntries', () => {
  it('reorders entries by id list', () => {
    const book = makeBook('Reorder Test', [
      { keys: ['k1'], content: 'c1', id: 0 },
      { keys: ['k2'], content: 'c2', id: 1 },
      { keys: ['k3'], content: 'c3', id: 2 },
    ]);

    const updated = reorderEntries(book, [2, 0, 1]);

    expect(updated.entries.map(e => e.id)).toEqual([2, 0, 1]);
    expect(updated.entries[0]!.insertion_order).toBe(0);
    expect(updated.entries[1]!.insertion_order).toBe(1);
    expect(updated.entries[2]!.insertion_order).toBe(2);
  });

  it('reorders entries by name', () => {
    const book = makeBook('Reorder Test', [
      { keys: ['k1'], content: 'c1', id: 0, name: 'Alpha' },
      { keys: ['k2'], content: 'c2', id: 1, name: 'Beta' },
      { keys: ['k3'], content: 'c3', id: 2, name: 'Gamma' },
    ]);

    const updated = reorderEntries(book, ['Gamma', 'Alpha', 'Beta']);

    expect(updated.entries.map(e => e.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('appends entries not in reorder list', () => {
    const book = makeBook('Reorder Test', [
      { keys: ['k1'], content: 'c1', id: 0 },
      { keys: ['k2'], content: 'c2', id: 1 },
      { keys: ['k3'], content: 'c3', id: 2 },
    ]);

    const updated = reorderEntries(book, [2]); // Only specify one

    expect(updated.entries).toHaveLength(3);
    expect(updated.entries[0]!.id).toBe(2);
    // Others appended in original order
  });
});
