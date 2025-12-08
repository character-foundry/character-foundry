/**
 * Lorebook Inserter
 *
 * Stamp entries with source metadata when inserting linked lorebooks.
 * Keeps lorebooks separate - never smooshes to one giant lorebook.
 */

import type { CCv3CharacterBook, CCv3LorebookEntry, CCv3Data } from '@character-foundry/schemas';
import type { EntrySourceMeta, LinkedLorebook, LorebookCollection } from './types.js';

/**
 * Stamp all entries in a lorebook with source metadata
 *
 * Used when fetching a linked lorebook to mark where entries came from.
 * This allows later extraction/separation of linked vs embedded entries.
 */
export function stampEntriesWithSource(
  book: CCv3CharacterBook,
  source: Omit<EntrySourceMeta, 'originalEntryId'>
): CCv3CharacterBook {
  const stampedEntries = book.entries.map((entry: CCv3LorebookEntry) => stampEntry(entry, source));

  return {
    ...book,
    entries: stampedEntries,
  };
}

/**
 * Stamp a single entry with source metadata
 */
function stampEntry(
  entry: CCv3LorebookEntry,
  source: Omit<EntrySourceMeta, 'originalEntryId'>
): CCv3LorebookEntry {
  const sourceMeta: EntrySourceMeta = {
    ...source,
    originalEntryId: entry.name || String(entry.id),
  };

  return {
    ...entry,
    extensions: {
      ...entry.extensions,
      lorebookSource: sourceMeta,
    },
  };
}

/**
 * Create a LinkedLorebook from a fetched book with source info
 *
 * This is used after downloading/fetching a lorebook from an external source.
 * The book is stamped with source metadata for later extraction.
 */
export function createLinkedLorebook(
  book: CCv3CharacterBook,
  sourceUrl: string,
  platform: string,
  sourceId?: string
): LinkedLorebook {
  const fetchedAt = new Date().toISOString();

  const stampedBook = stampEntriesWithSource(book, {
    linkedFrom: sourceUrl,
    platform,
    fetchedAt,
    lorebookName: book.name,
  });

  return {
    source: sourceUrl,
    platform,
    sourceId,
    fetchedAt,
    name: book.name,
    book: stampedBook,
  };
}

/**
 * Add a linked lorebook to a card's collection
 *
 * Does NOT merge into character_book - keeps it separate.
 * Stores in extensions.additional_lorebooks array.
 */
export function addLinkedLorebookToCard(
  card: CCv3Data,
  linkedBook: LinkedLorebook
): CCv3Data {
  const extensions = (card.data.extensions || {}) as Record<string, unknown>;
  const additionalLorebooks = (extensions.additional_lorebooks as CCv3CharacterBook[]) || [];

  return {
    ...card,
    data: {
      ...card.data,
      extensions: {
        ...extensions,
        additional_lorebooks: [...additionalLorebooks, linkedBook.book],
      },
    },
  };
}

/**
 * Add an embedded lorebook to a card
 *
 * Adds to extensions.additional_lorebooks if character_book already exists.
 * Otherwise sets as the main character_book.
 */
export function addEmbeddedLorebookToCard(
  card: CCv3Data,
  book: CCv3CharacterBook
): CCv3Data {
  // If no character_book exists, use this as the main one
  if (!card.data.character_book || card.data.character_book.entries.length === 0) {
    return {
      ...card,
      data: {
        ...card.data,
        character_book: book,
      },
    };
  }

  // Otherwise add to additional_lorebooks
  const extensions = (card.data.extensions || {}) as Record<string, unknown>;
  const additionalLorebooks = (extensions.additional_lorebooks as CCv3CharacterBook[]) || [];

  return {
    ...card,
    data: {
      ...card.data,
      extensions: {
        ...extensions,
        additional_lorebooks: [...additionalLorebooks, book],
      },
    },
  };
}

/**
 * Remove a lorebook from a card by name
 *
 * Checks both character_book and additional_lorebooks.
 */
export function removeLorebookFromCard(
  card: CCv3Data,
  lorebookName: string
): CCv3Data {
  let updatedCard = { ...card, data: { ...card.data } };

  // Check main character_book
  if (card.data.character_book?.name === lorebookName) {
    updatedCard.data.character_book = undefined;
  }

  // Check additional_lorebooks
  const extensions = (card.data.extensions || {}) as Record<string, unknown>;
  if (Array.isArray(extensions.additional_lorebooks)) {
    const filtered = (extensions.additional_lorebooks as CCv3CharacterBook[]).filter(
      book => book.name !== lorebookName
    );

    updatedCard.data.extensions = {
      ...extensions,
      additional_lorebooks: filtered.length > 0 ? filtered : undefined,
    };
  }

  return updatedCard;
}

/**
 * Remove linked entries from a card that came from a specific source
 *
 * Useful when unlinking/removing a linked lorebook.
 * Removes entries from ALL lorebooks in the card that have matching source.
 */
export function removeLinkedEntriesBySource(
  card: CCv3Data,
  sourceUrl: string
): CCv3Data {
  let updatedCard = { ...card, data: { ...card.data } };

  // Clean main character_book
  if (card.data.character_book) {
    updatedCard.data.character_book = removeSourceEntriesFromBook(
      card.data.character_book,
      sourceUrl
    );
  }

  // Clean additional_lorebooks
  const extensions = (card.data.extensions || {}) as Record<string, unknown>;
  if (Array.isArray(extensions.additional_lorebooks)) {
    const cleaned = (extensions.additional_lorebooks as CCv3CharacterBook[])
      .map(book => removeSourceEntriesFromBook(book, sourceUrl))
      .filter(book => book.entries.length > 0);

    updatedCard.data.extensions = {
      ...extensions,
      additional_lorebooks: cleaned.length > 0 ? cleaned : undefined,
    };
  }

  return updatedCard;
}

/**
 * Remove entries from a book that came from a specific source
 */
function removeSourceEntriesFromBook(
  book: CCv3CharacterBook,
  sourceUrl: string
): CCv3CharacterBook {
  const filteredEntries = book.entries.filter((entry: CCv3LorebookEntry) => {
    const ext = entry.extensions as Record<string, unknown> | undefined;
    if (!ext?.lorebookSource) return true;

    const source = ext.lorebookSource as Record<string, unknown>;
    return source.linkedFrom !== sourceUrl;
  });

  return {
    ...book,
    entries: filteredEntries,
  };
}

/**
 * Replace a lorebook in a card
 *
 * Matches by name. Updates in place without changing position.
 */
export function replaceLorebookInCard(
  card: CCv3Data,
  updatedBook: CCv3CharacterBook
): CCv3Data {
  let updatedCard = { ...card, data: { ...card.data } };

  // Check main character_book
  if (card.data.character_book?.name === updatedBook.name) {
    updatedCard.data.character_book = updatedBook;
    return updatedCard;
  }

  // Check additional_lorebooks
  const extensions = (card.data.extensions || {}) as Record<string, unknown>;
  if (Array.isArray(extensions.additional_lorebooks)) {
    const updated = (extensions.additional_lorebooks as CCv3CharacterBook[]).map(book =>
      book.name === updatedBook.name ? updatedBook : book
    );

    updatedCard.data.extensions = {
      ...extensions,
      additional_lorebooks: updated,
    };
  }

  return updatedCard;
}

/**
 * Rebuild a card's lorebooks from a LorebookCollection
 *
 * Replaces all lorebooks in the card with the collection contents.
 * Useful after editing operations.
 */
export function setLorebookCollection(
  card: CCv3Data,
  collection: LorebookCollection
): CCv3Data {
  const [mainBook, ...additionalEmbedded] = collection.embedded;
  const linkedBooks = collection.linked.map(l => l.book);
  const additionalBooks = [...additionalEmbedded, ...linkedBooks];

  const extensions = (card.data.extensions || {}) as Record<string, unknown>;

  return {
    ...card,
    data: {
      ...card.data,
      character_book: mainBook,
      extensions: {
        ...extensions,
        additional_lorebooks: additionalBooks.length > 0 ? additionalBooks : undefined,
      },
    },
  };
}
