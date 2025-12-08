/**
 * Lorebook Extractor
 *
 * Extract linked lorebook references from cards and
 * separate linked entries from embedded entries.
 */

import type { CCv3Data, CCv3CharacterBook, CCv3LorebookEntry } from '@character-foundry/schemas';
import type {
  LorebookRef,
  LorebookCollection,
  LinkedLorebook,
  EntrySourceMeta,
} from './types.js';

/**
 * Extract linked lorebook references from card extensions
 *
 * Looks for lorebook URLs/IDs in various extension patterns:
 * - extensions.chub.linked_lorebooks
 * - extensions.world_infos
 * - extensions.linked_lorebooks
 * - etc.
 */
export function extractLorebookRefs(card: CCv3Data): LorebookRef[] {
  const refs: LorebookRef[] = [];
  const extensions = card.data.extensions as Record<string, unknown> | undefined;

  if (!extensions) return refs;

  // Chub pattern: extensions.chub.linked_lorebooks
  if (extensions.chub && typeof extensions.chub === 'object') {
    const chub = extensions.chub as Record<string, unknown>;

    if (Array.isArray(chub.linked_lorebooks)) {
      for (const item of chub.linked_lorebooks) {
        if (typeof item === 'string') {
          refs.push(parseLorebookUrl(item, 'chub'));
        } else if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          refs.push({
            url: String(obj.url || obj.uri || ''),
            platform: 'chub',
            id: obj.id ? String(obj.id) : undefined,
            name: obj.name ? String(obj.name) : undefined,
          });
        }
      }
    }
  }

  // Generic pattern: extensions.world_infos
  if (Array.isArray(extensions.world_infos)) {
    for (const item of extensions.world_infos) {
      if (typeof item === 'string') {
        refs.push(parseLorebookUrl(item, 'unknown'));
      } else if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        refs.push({
          url: String(obj.url || obj.uri || ''),
          platform: detectPlatformFromUrl(String(obj.url || obj.uri || '')),
          id: obj.id ? String(obj.id) : undefined,
          name: obj.name ? String(obj.name) : undefined,
        });
      }
    }
  }

  // Generic pattern: extensions.linked_lorebooks
  if (Array.isArray(extensions.linked_lorebooks)) {
    for (const item of extensions.linked_lorebooks) {
      if (typeof item === 'string') {
        refs.push(parseLorebookUrl(item, 'unknown'));
      } else if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        refs.push({
          url: String(obj.url || obj.uri || ''),
          platform: obj.platform ? String(obj.platform) : detectPlatformFromUrl(String(obj.url || '')),
          id: obj.id ? String(obj.id) : undefined,
          name: obj.name ? String(obj.name) : undefined,
        });
      }
    }
  }

  // Risu pattern: extensions.ripiLinkedLorebooks
  if (Array.isArray(extensions.ripiLinkedLorebooks)) {
    for (const item of extensions.ripiLinkedLorebooks) {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        refs.push({
          url: String(obj.url || ''),
          platform: 'risu',
          id: obj.id ? String(obj.id) : undefined,
          name: obj.name ? String(obj.name) : undefined,
        });
      }
    }
  }

  return refs.filter(r => r.url.length > 0);
}

/**
 * Parse a lorebook URL and extract platform info
 */
function parseLorebookUrl(url: string, defaultPlatform: string): LorebookRef {
  const platform = detectPlatformFromUrl(url) || defaultPlatform;
  const id = extractIdFromUrl(url, platform);

  return { url, platform, id };
}

/**
 * Detect platform from URL
 */
function detectPlatformFromUrl(url: string): string {
  if (url.includes('chub.ai') || url.includes('characterhub.org')) return 'chub';
  if (url.includes('risu.io') || url.includes('risuai')) return 'risu';
  if (url.includes('janitorai')) return 'janitor';
  if (url.includes('pygmalion')) return 'pygmalion';
  return 'unknown';
}

/**
 * Extract ID from platform URL
 */
function extractIdFromUrl(url: string, platform: string): string | undefined {
  try {
    const parsed = new URL(url);

    switch (platform) {
      case 'chub': {
        // https://chub.ai/lorebooks/username/lorebook-name
        const match = parsed.pathname.match(/\/lorebooks\/([^/]+\/[^/]+)/);
        return match ? match[1] : undefined;
      }
      case 'risu': {
        // Various patterns
        const match = parsed.pathname.match(/\/lorebook\/([^/]+)/);
        return match ? match[1] : undefined;
      }
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * Separate embedded entries from linked entries in a character_book
 *
 * Uses entry.extensions.lorebookSource to identify linked entries.
 * Returns the collection with embedded and linked separated.
 */
export function extractLinkedEntries(
  book: CCv3CharacterBook
): { embedded: CCv3CharacterBook; linked: Map<string, CCv3CharacterBook> } {
  const embeddedEntries: CCv3LorebookEntry[] = [];
  const linkedBySource = new Map<string, CCv3LorebookEntry[]>();

  for (const entry of book.entries || []) {
    const source = getEntrySource(entry);

    if (source) {
      // This entry came from a linked lorebook
      const existing = linkedBySource.get(source.linkedFrom) || [];
      existing.push(entry);
      linkedBySource.set(source.linkedFrom, existing);
    } else {
      // This is an embedded entry
      embeddedEntries.push(entry);
    }
  }

  // Build embedded book
  const embedded: CCv3CharacterBook = {
    ...book,
    entries: embeddedEntries,
  };

  // Build linked books map
  const linked = new Map<string, CCv3CharacterBook>();
  for (const [source, entries] of linkedBySource) {
    // Try to get lorebook name from first entry's source metadata
    const firstSource = getEntrySource(entries[0]!);
    linked.set(source, {
      name: firstSource?.lorebookName || `Linked from ${source}`,
      entries,
    });
  }

  return { embedded, linked };
}

/**
 * Get source metadata from an entry
 */
function getEntrySource(entry: CCv3LorebookEntry): EntrySourceMeta | undefined {
  const ext = entry.extensions as Record<string, unknown> | undefined;
  if (!ext?.lorebookSource) return undefined;

  const source = ext.lorebookSource as Record<string, unknown>;
  return {
    linkedFrom: String(source.linkedFrom || ''),
    platform: String(source.platform || 'unknown'),
    fetchedAt: String(source.fetchedAt || ''),
    originalEntryId: source.originalEntryId ? String(source.originalEntryId) : undefined,
    lorebookName: source.lorebookName ? String(source.lorebookName) : undefined,
  };
}

/**
 * Get all lorebooks from a card as a collection
 *
 * This extracts:
 * 1. The embedded character_book (may be empty)
 * 2. Any additional embedded lorebooks from extensions
 * 3. Separates linked entries if they have source metadata
 */
export function getLorebookCollection(card: CCv3Data): LorebookCollection {
  const embedded: CCv3CharacterBook[] = [];
  const linked: LinkedLorebook[] = [];

  // Get main character_book
  if (card.data.character_book) {
    const { embedded: embeddedBook, linked: linkedBooks } = extractLinkedEntries(
      card.data.character_book
    );

    // Add embedded if it has entries
    if (embeddedBook.entries.length > 0) {
      embedded.push(embeddedBook);
    }

    // Convert linked map to LinkedLorebook array
    for (const [source, book] of linkedBooks) {
      const firstEntry = book.entries[0];
      const sourceMeta = getEntrySource(firstEntry!);

      linked.push({
        source,
        platform: sourceMeta?.platform || 'unknown',
        fetchedAt: sourceMeta?.fetchedAt || '',
        name: book.name,
        book,
      });
    }
  }

  // Check for additional embedded lorebooks in extensions
  const extensions = card.data.extensions as Record<string, unknown> | undefined;
  if (extensions?.additional_lorebooks && Array.isArray(extensions.additional_lorebooks)) {
    for (const additionalBook of extensions.additional_lorebooks) {
      if (additionalBook && typeof additionalBook === 'object') {
        const book = additionalBook as CCv3CharacterBook;
        if (book.entries && book.entries.length > 0) {
          embedded.push(book);
        }
      }
    }
  }

  return { embedded, linked };
}
