# Lorebook Package Documentation

**Package:** `@character-foundry/lorebook`
**Environment:** Node.js and Browser

The `@character-foundry/lorebook` package provides primitives for parsing, extracting, and managing lorebooks (also known as world info or memory books) across different AI character card formats.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Architecture](#architecture)
- [Data Structures](#data-structures)
- [Workflows](#workflows)
  - [Parsing Standalone Lorebooks](#parsing-standalone-lorebooks)
  - [Extracting Lorebooks from Cards](#extracting-lorebooks-from-cards)
  - [Managing Linked Lorebooks](#managing-linked-lorebooks)
  - [Entry Manipulation](#entry-manipulation)
  - [Format Conversion](#format-conversion)
- [API Reference](#api-reference)
- [Design Philosophy](#design-philosophy)

---

## Core Concepts

### What is a Lorebook?

A lorebook is a collection of **entries** that provide contextual information to AI models during roleplay. Each entry has:

- **Keys/Triggers**: Words or phrases that activate the entry
- **Content**: The information injected into the context
- **Metadata**: Priority, position, enabled state, etc.

### Embedded vs Linked Lorebooks

Character cards can contain lorebooks in two ways:

1. **Embedded**: Stored directly in the card's `character_book` field or `extensions.additional_lorebooks`
2. **Linked**: Referenced by URL in card extensions, fetched from external sources (Chub, Risu, etc.)

### Multiple Lorebooks Per Card

A key design principle: **cards can have multiple separate lorebooks**. We never "smoosh" them into one giant lorebook. This preserves:

- Original authorship and sources
- Update paths for linked content
- Clean separation of concerns

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Card (CCv3Data)                          │
├─────────────────────────────────────────────────────────────────┤
│  data.character_book          → Primary embedded lorebook       │
│  data.extensions.additional_lorebooks → Array of extra books    │
│  data.extensions.chub.linked_lorebooks → Linked refs (URLs)     │
│  data.extensions.world_infos  → More linked refs                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LorebookCollection                           │
├─────────────────────────────────────────────────────────────────┤
│  embedded: CCv3CharacterBook[]   ← Multiple embedded books      │
│  linked: LinkedLorebook[]        ← Fetched external books       │
└─────────────────────────────────────────────────────────────────┘
```

### Module Structure

| Module | Purpose |
|--------|---------|
| `parser.ts` | Detect format and normalize to CCv3 |
| `extractor.ts` | Extract refs and separate entries by source |
| `inserter.ts` | Stamp entries with source metadata, manage card lorebooks |
| `handler.ts` | Format conversion, serialization, entry utilities |

---

## Data Structures

### LorebookFormat

```typescript
type LorebookFormat =
  | 'ccv3'         // Standard CCv3 character_book
  | 'sillytavern'  // SillyTavern world_info JSON
  | 'agnai'        // Agnai lorebook format
  | 'risu'         // RisuAI .risulorebook
  | 'wyvern'       // Wyvern format
  | 'unknown';
```

### ParsedLorebook

Result of parsing a standalone lorebook file:

```typescript
interface ParsedLorebook {
  book: CCv3CharacterBook;      // Normalized to CCv3
  originalFormat: LorebookFormat;
  originalShape: unknown;        // Raw data for round-trip
}
```

### LorebookRef

Reference to a linked lorebook found in card extensions:

```typescript
interface LorebookRef {
  url: string;          // Source URL
  platform: string;     // 'chub' | 'risu' | 'janitor' | etc.
  id?: string;          // Platform-specific ID
  name?: string;        // Display name if available
}
```

### LinkedLorebook

A fetched/downloaded linked lorebook with source tracking:

```typescript
interface LinkedLorebook {
  source: string;       // Source URL
  platform: string;     // Platform identifier
  sourceId?: string;    // ID on source platform
  fetchedAt: string;    // ISO timestamp
  name?: string;        // Display name
  book: CCv3CharacterBook;  // The actual content
}
```

### EntrySourceMeta

Metadata stamped on entries from linked lorebooks:

```typescript
interface EntrySourceMeta {
  linkedFrom: string;       // Source URL
  platform: string;         // Platform identifier
  fetchedAt: string;        // When fetched
  originalEntryId?: string; // Original entry name/ID
  lorebookName?: string;    // Lorebook name for display
}
```

Stored in `entry.extensions.lorebookSource`.

### LorebookCollection

Complete collection of lorebooks from a card:

```typescript
interface LorebookCollection {
  embedded: CCv3CharacterBook[];   // Directly in card
  linked: LinkedLorebook[];        // From external sources
}
```

---

## Workflows

### Parsing Standalone Lorebooks

Parse a standalone lorebook file (JSON) and normalize to CCv3:

```typescript
import { parseLorebook, detectLorebookFormat } from '@character-foundry/lorebook';

// Auto-detect format and normalize
const jsonBuffer = await fs.readFile('lorebook.json');
const { book, originalFormat, originalShape } = parseLorebook(jsonBuffer);

console.log(`Detected format: ${originalFormat}`);
console.log(`Entries: ${book.entries.length}`);

// Or detect format without parsing
const format = detectLorebookFormat(JSON.parse(jsonBuffer.toString()));
```

**Supported formats:**

| Format | Detection |
|--------|-----------|
| CCv3 | `entries` array with `keys`/`content` |
| SillyTavern | `entries` object keyed by uid, entries have `uid`/`key`/`content` |
| Agnai | `kind: 'memory'`, entries have `keywords`/`entry` |
| Risu | `type: 'risu'` or `ripiVersion` present |
| Wyvern | `format: 'wyvern'` or `wyvern` object present |

### Extracting Lorebooks from Cards

Get all lorebooks from a character card:

```typescript
import {
  getLorebookCollection,
  extractLorebookRefs,
  extractLinkedEntries
} from '@character-foundry/lorebook';

// Get the full collection (embedded + linked)
const collection = getLorebookCollection(card);

console.log(`Embedded lorebooks: ${collection.embedded.length}`);
console.log(`Linked lorebooks: ${collection.linked.length}`);

// List embedded lorebook names
for (const book of collection.embedded) {
  console.log(`- ${book.name}: ${book.entries.length} entries`);
}

// Find linked lorebook references (URLs to fetch)
const refs = extractLorebookRefs(card);
for (const ref of refs) {
  console.log(`Linked: ${ref.url} (${ref.platform})`);
}
```

**Where linked refs are found:**

- `extensions.chub.linked_lorebooks`
- `extensions.world_infos`
- `extensions.linked_lorebooks`
- `extensions.ripiLinkedLorebooks`

### Managing Linked Lorebooks

Complete workflow for adding a linked lorebook to a card:

```typescript
import {
  extractLorebookRefs,
  parseLorebook,
  createLinkedLorebook,
  addLinkedLorebookToCard,
  removeLinkedEntriesBySource,
} from '@character-foundry/lorebook';

// 1. Find linked refs in card
const refs = extractLorebookRefs(card);

// 2. App fetches the lorebook (not our job!)
const lorebookJson = await yourFetchFunction(refs[0].url);

// 3. Parse and stamp with source metadata
const { book } = parseLorebook(lorebookJson);
const linked = createLinkedLorebook(
  book,
  refs[0].url,    // sourceUrl
  refs[0].platform,
  refs[0].id
);

// 4. Add to card (stored in extensions.additional_lorebooks)
let updatedCard = addLinkedLorebookToCard(card, linked);

// Later: Remove linked entries when unlinking
updatedCard = removeLinkedEntriesBySource(updatedCard, refs[0].url);
```

### Entry Manipulation

Work with individual entries:

```typescript
import {
  findEntriesByKeys,
  findEntryByNameOrId,
  updateEntry,
  addEntry,
  removeEntry,
  reorderEntries,
} from '@character-foundry/lorebook';

// Search entries by trigger keys
const matches = findEntriesByKeys(book, ['dragon', 'fire'], {
  caseSensitive: false,
  matchAll: false,  // Any key matches (OR)
});

// Find specific entry
const entry = findEntryByNameOrId(book, 'Dragons');
const entryById = findEntryByNameOrId(book, 42);

// Update an entry
const updated = updateEntry(book, 'Dragons', {
  content: 'Updated dragon lore...',
  enabled: true,
});

// Add new entry
const withNew = addEntry(book, {
  keys: ['phoenix', 'fire bird'],
  content: 'Phoenix lore here...',
  enabled: true,
  name: 'Phoenix',
  priority: 10,
});

// Remove entry
const removed = removeEntry(book, 'Outdated Entry');

// Reorder entries
const reordered = reorderEntries(book, [5, 2, 3, 1, 4]);
```

### Format Conversion

Convert between lorebook formats:

```typescript
import {
  convertLorebook,
  serializeLorebook,
  serializeParsedLorebook,
} from '@character-foundry/lorebook';

// Convert CCv3 to SillyTavern format
const stFormat = convertLorebook(book, 'sillytavern');

// Serialize to JSON string
const json = serializeLorebook(book, 'sillytavern', undefined, true);

// Round-trip: preserve original format
const { book, originalFormat, originalShape } = parseLorebook(input);
// ... modify book ...
const output = serializeParsedLorebook({ book, originalFormat, originalShape });
```

**Format-specific field preservation:**

When converting, format-specific fields are preserved in `entry.extensions`:

```typescript
// SillyTavern fields preserved in entry.extensions.sillytavern
{
  selectiveLogic: 0,
  excludeRecursion: false,
  probability: 100,
  depth: 4,
  // ... etc
}

// Agnai fields preserved in entry.extensions.agnai
{
  weight: 1,
}
```

---

## API Reference

### Parser Module

#### `parseLorebook(data: BinaryData): ParsedLorebook`

Parse a standalone lorebook file. Auto-detects format and normalizes to CCv3.

#### `detectLorebookFormat(data: unknown): LorebookFormat`

Detect the format of a lorebook JSON object without parsing.

#### `normalizeToCC3(data: unknown, format: LorebookFormat): CCv3CharacterBook`

Normalize any lorebook format to CCv3 character_book structure.

### Extractor Module

#### `extractLorebookRefs(card: CCv3Data): LorebookRef[]`

Extract linked lorebook references (URLs) from card extensions.

#### `extractLinkedEntries(book: CCv3CharacterBook): { embedded, linked }`

Separate embedded entries from linked entries using `extensions.lorebookSource`.

#### `getLorebookCollection(card: CCv3Data): LorebookCollection`

Get all lorebooks from a card as a collection with embedded and linked separated.

### Inserter Module

#### `stampEntriesWithSource(book, source): CCv3CharacterBook`

Stamp all entries with source metadata for tracking.

#### `createLinkedLorebook(book, url, platform, sourceId?): LinkedLorebook`

Create a LinkedLorebook from a fetched book with source info.

#### `addLinkedLorebookToCard(card, linkedBook): CCv3Data`

Add a linked lorebook to card's `extensions.additional_lorebooks`.

#### `addEmbeddedLorebookToCard(card, book): CCv3Data`

Add an embedded lorebook. Sets as `character_book` if none exists, otherwise adds to `additional_lorebooks`.

#### `removeLorebookFromCard(card, lorebookName): CCv3Data`

Remove a lorebook by name from card.

#### `removeLinkedEntriesBySource(card, sourceUrl): CCv3Data`

Remove all entries that came from a specific source URL.

#### `replaceLorebookInCard(card, updatedBook): CCv3Data`

Replace a lorebook in card (matches by name).

#### `setLorebookCollection(card, collection): CCv3Data`

Rebuild card's lorebooks from a LorebookCollection.

### Handler Module

#### `convertLorebook(book, targetFormat, originalShape?): unknown`

Convert CCv3 to another format. Preserves original shape for round-trip.

#### `serializeLorebook(book, format?, originalShape?, pretty?): string`

Serialize a lorebook to JSON string.

#### `serializeParsedLorebook(parsed, pretty?): string`

Round-trip a parsed lorebook back to its original format.

#### `mergeLorebooks(bookA, bookB, name?): CCv3CharacterBook`

Merge two lorebooks into one. **Use with caution** - design preference is to keep separate.

#### `findEntriesByKeys(book, keys, options?): CCv3LorebookEntry[]`

Find entries matching search keys.

Options:
- `caseSensitive`: boolean (default: false)
- `matchAll`: boolean - require all keys match (default: false)

#### `findEntryByNameOrId(book, nameOrId): CCv3LorebookEntry | undefined`

Find entry by name string or numeric ID.

#### `updateEntry(book, entryId, updates): CCv3CharacterBook`

Update an entry's fields.

#### `addEntry(book, entry): CCv3CharacterBook`

Add a new entry with auto-generated ID.

#### `removeEntry(book, entryId): CCv3CharacterBook`

Remove an entry by ID or name.

#### `reorderEntries(book, entryIds): CCv3CharacterBook`

Reorder entries by specifying ID/name order.

---

## Design Philosophy

### Why Multiple Separate Lorebooks?

1. **Authorship**: Each lorebook may have a different creator
2. **Updates**: Linked lorebooks can be refreshed from source
3. **Modularity**: Users can enable/disable individual lorebooks
4. **Clarity**: Clear separation between character lore and world lore

### Why Primitives Don't Fetch?

The package provides parsing, extraction, and insertion - **not downloading**. Reasons:

1. **Simplicity**: No HTTP dependencies, works in any environment
2. **Flexibility**: Apps handle auth, caching, rate limits differently
3. **No bloat**: Supporting 100 card sites would be unmaintainable

**Your app's responsibility:**
- Fetch lorebook from URL
- Handle authentication
- Manage caching
- Deal with errors

**Our responsibility:**
- Parse the fetched data
- Stamp with source metadata
- Insert into card structure

### Why No Diff/Merge Conflict Resolution?

Diffing and merge conflict UI is complex and app-specific. Primitives provide:

- Source tracking (so you know where entries came from)
- Entry matching by name/id AND keys
- Update/replace operations

**Your app's responsibility:**
- Show diff UI to users
- Let users resolve conflicts
- Call our update functions with resolved data

---

## Examples

### Complete Editor Integration

```typescript
import {
  parseCard,
  exportCard,
} from '@character-foundry/loader';
import {
  getLorebookCollection,
  extractLorebookRefs,
  parseLorebook,
  createLinkedLorebook,
  addLinkedLorebookToCard,
  replaceLorebookInCard,
  setLorebookCollection,
  updateEntry,
} from '@character-foundry/lorebook';

class LorebookEditor {
  private card: CCv3Data;
  private collection: LorebookCollection;

  async load(buffer: Uint8Array) {
    const { card } = parseCard(buffer);
    this.card = card;
    this.collection = getLorebookCollection(card);
  }

  // Refresh a linked lorebook from source
  async refreshLinked(sourceUrl: string, fetchFn: (url: string) => Promise<Uint8Array>) {
    const data = await fetchFn(sourceUrl);
    const { book } = parseLorebook(data);

    // Find existing linked lorebook
    const existing = this.collection.linked.find(l => l.source === sourceUrl);
    if (existing) {
      // Update with fresh data
      const linked = createLinkedLorebook(book, sourceUrl, existing.platform);
      this.collection.linked = this.collection.linked.map(l =>
        l.source === sourceUrl ? linked : l
      );
    }

    // Rebuild card
    this.card = setLorebookCollection(this.card, this.collection);
  }

  // Edit an entry in an embedded lorebook
  editEntry(bookIndex: number, entryId: number, updates: Partial<CCv3LorebookEntry>) {
    const book = this.collection.embedded[bookIndex];
    const updated = updateEntry(book, entryId, updates);
    this.collection.embedded[bookIndex] = updated;
    this.card = setLorebookCollection(this.card, this.collection);
  }

  // Export
  export(format: 'png' | 'charx'): Uint8Array {
    return exportCard(this.card, [], { format });
  }
}
```

### SillyTavern World Info Converter

```typescript
import { parseLorebook, serializeLorebook } from '@character-foundry/lorebook';

// Convert SillyTavern → CCv3
const stInput = await fs.readFile('world_info.json');
const { book } = parseLorebook(stInput);
const ccv3Output = JSON.stringify(book, null, 2);
await fs.writeFile('lorebook_ccv3.json', ccv3Output);

// Convert CCv3 → SillyTavern
const ccv3Input = await fs.readFile('lorebook_ccv3.json');
const { book: ccv3Book, originalFormat, originalShape } = parseLorebook(ccv3Input);
const stOutput = serializeLorebook(ccv3Book, 'sillytavern');
await fs.writeFile('world_info_converted.json', stOutput);
```
