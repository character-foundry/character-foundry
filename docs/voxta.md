# Voxta Package Documentation

**Package:** `@character-foundry/voxta`
**Version:** 0.1.8
**Environment:** Node.js and Browser

The `@character-foundry/voxta` package handles reading, writing, and editing Voxta package files (`.voxpkg`) - a multi-character container format with support for memory books, scenarios, collections, and rich assets.

## Features

- Full Voxta package reading and writing
- `VoxtaCharacter` with `AlternativeFirstMessages` (maps to CCv3 `alternate_greetings`)
- `VoxtaBook`, `VoxtaScenario`, and `VoxtaCollection` support
- **Collections** - Organizational groupings for characters, scenarios, and books
- **Delta-based editing** - `mergeCharacterEdits()`, `applyVoxtaDeltas()`
- **Package utilities** - `extractCharacterPackage()`, `addCharacterToPackage()`
- **Macro conversion** - `voxtaToStandard()`, `standardToVoxta()`
- Export type detection: `'package'` | `'scenario'` | `'character'` | `'collection'`

## Table of Contents

- [Overview](#overview)
- [Format Structure](#format-structure)
- [Reader](#reader)
- [Writer](#writer)
- [Mapper](#mapper)
- [Collections](#collections)
- [Merge Utilities](#merge-utilities)
- [Loss Reporting](#loss-reporting)
- [Macros](#macros)
- [Usage Examples](#usage-examples)

---

## Overview

Voxta packages are ZIP archives containing:
- Multiple characters
- Memory books (lorebooks) that can be shared
- Scenarios
- Collections (organizational groupings)
- Assets (images, audio, TTS configs)

Key differences from other formats:
- **Multi-character**: One package can contain many characters
- **Shared books**: Memory books can be referenced by multiple characters
- **Rich metadata**: TTS configs, scripts, scenarios
- **Collections**: Organize content into themed folders with resource references

---

## Format Structure

```
character.voxpkg (ZIP archive)
├── package.json              # Package metadata
├── thumbnail.png             # Package thumbnail
├── Characters/
│   ├── {uuid}/
│   │   ├── character.json    # Character data
│   │   ├── thumbnail.png
│   │   └── Assets/
│   │       ├── avatar.png
│   │       └── emotions/
│   └── {uuid}/
│       └── ...
├── Books/
│   ├── {uuid}/
│   │   └── book.json         # Memory book
│   └── ...
├── Scenarios/
│   └── {uuid}/
│       ├── scenario.json
│       ├── thumbnail.png
│       └── Assets/           # Scenario-specific assets
└── Collections/
    └── {uuid}/
        ├── collection.json   # Collection with resource refs
        └── thumbnail.png
```

### Character JSON

```json
{
  "Id": "550e8400-e29b-41d4-a716-446655440000",
  "Name": "Character Name",
  "Label": "Optional nickname",
  "Description": "Physical/visual appearance",
  "Profile": "Character backstory/personality",
  "Personality": "Personality traits",
  "Scenario": "Current scenario",
  "FirstMessage": "Hello!",
  "AlternativeFirstMessages": ["Hi there!", "Greetings!"],
  "MessageExamples": "Example dialogue",
  "SystemPrompt": "System instructions",
  "PostHistoryInstructions": "Post-history (UJB)",
  "Context": "Context field",
  "Instructions": "User instructions",
  "MemoryBooks": ["book-uuid-1", "book-uuid-2"],
  "Tags": ["tag1", "tag2"],
  "Creator": "Creator name",
  "CreatorNotes": "Notes for users",
  "TextToSpeech": [{ "Voice": {...}, "Service": {...} }],
  "DateCreated": "2024-01-15T12:00:00Z",
  "DateModified": "2024-01-16T14:30:00Z"
}
```

---

## Reader

### Types

```typescript
interface VoxtaReadOptions {
  maxFileSize?: number;
  maxTotalSize?: number;
}

interface VoxtaData {
  package?: VoxtaPackage;           // Package metadata
  characters: ExtractedVoxtaCharacter[];
  books: ExtractedVoxtaBook[];
  scenarios: ExtractedVoxtaScenario[];
  collections: ExtractedVoxtaCollection[];
  exportType: VoxtaExportType;
}

interface ExtractedVoxtaCharacter {
  id: string;
  data: VoxtaCharacter;
  assets: ExtractedVoxtaAsset[];
}

interface ExtractedVoxtaBook {
  id: string;
  data: VoxtaBook;
}
```

### Detection and Reading

```typescript
import { isVoxta, readVoxta, readVoxtaAsync } from '@character-foundry/voxta';

// Detect Voxta package
if (isVoxta(buffer)) {
  // Valid ZIP with Voxta structure
}

// Synchronous read
const data = readVoxta(buffer);
// data.characters - Array of characters
// data.books - Array of memory books
// data.scenarios - Array of scenarios
// data.exportType - 'package' | 'scenario' | 'character'

// Async read
const data = await readVoxtaAsync(buffer, {
  maxFileSize: 50 * 1024 * 1024,
});
```

### Export Types

Voxta packages come in four export types:

| Type | Description | Structure |
|------|-------------|-----------|
| `package` | Full package with metadata | Has `package.json` at root |
| `collection` | Collection export | Has `Collections/` folder |
| `scenario` | Scenario export | Has `Scenarios/` but no `package.json` |
| `character` | Character export | Only `Characters/` folder |

```typescript
const data = readVoxta(buffer);

switch (data.exportType) {
  case 'package':
    console.log(`Package: ${data.package?.Name}`);
    break;
  case 'collection':
    console.log(`Collection with ${data.collections.length} collections`);
    break;
  case 'scenario':
    console.log(`Scenario with ${data.scenarios.length} scenarios`);
    break;
  case 'character':
    console.log(`Character export with ${data.characters.length} characters`);
    break;
}
```

---

## Writer

### Types

```typescript
interface VoxtaWriteOptions {
  compressionLevel?: CompressionLevel;
  preserveUnknownFiles?: boolean;
}

interface VoxtaBuildResult {
  buffer: Uint8Array;
  size: number;
  fileCount: number;
}
```

### Writing

```typescript
import { writeVoxta, writeVoxtaAsync } from '@character-foundry/voxta';

// Synchronous write
const result = writeVoxta(voxtaData, {
  compressionLevel: 6,
});

// Async write
const result = await writeVoxtaAsync(voxtaData, {
  compressionLevel: 6,
});
```

---

## Mapper

Convert between Voxta and CCv3 formats.

### Voxta to CCv3

```typescript
import { voxtaToCCv3 } from '@character-foundry/voxta';

// Convert Voxta character to CCv3
const ccv3Card = voxtaToCCv3(voxtaCharacter, voxtaBooks, voxtaAssets);

// ccv3Card.data.name = voxtaCharacter.Name
// ccv3Card.data.character_book = merged from voxtaBooks
// ccv3Card.data.assets = converted from voxtaAssets
```

### CCv3 to Voxta

```typescript
import { ccv3ToVoxta, ccv3LorebookToVoxtaBook } from '@character-foundry/voxta';

// Convert CCv3 to Voxta character
const voxtaChar = ccv3ToVoxta(ccv3Card);

// Convert lorebook separately
const voxtaBook = ccv3LorebookToVoxtaBook(ccv3Card.data.character_book);
```

### Field Mapping

| CCv3 | Voxta |
|------|-------|
| `name` | `Name` |
| `nickname` | `Label` |
| `description` | `Profile` |
| `personality` | `Personality` |
| `scenario` | `Scenario` |
| `first_mes` | `FirstMessage` |
| `alternate_greetings` | `AlternativeFirstMessages` |
| `mes_example` | `MessageExamples` |
| `system_prompt` | `SystemPrompt` |
| `post_history_instructions` | `PostHistoryInstructions` |
| `creator_notes` | `CreatorNotes` |
| `tags` | `Tags` |
| `creator` | `Creator` |
| `character_book` | `MemoryBooks` (references) |
| `assets` | `Assets/` folder |
| `extensions.visual_description` | `Description` (appearance) |

**Note:** The CCv3 `description` field maps to Voxta `Profile` (backstory/personality), while the Voxta `Description` field contains physical/visual appearance which is stored in `extensions.visual_description`.

---

## Collections

Collections organize resources (characters, scenarios, books) into themed folders.

### Collection Types

```typescript
import { VoxtaResourceKind } from '@character-foundry/voxta';

// Resource kinds for collection items
enum VoxtaResourceKind {
  Character = 1,
  Book = 2,
  Scenario = 3,
}

interface VoxtaCollection {
  $type: 'collection';
  Id: string;
  Name: string;
  Version?: string;
  PackageId?: string;
  ExplicitContent?: boolean;
  Root: VoxtaCollectionRoot;
  Thumbnail?: { RandomizedETag?: string; ContentType?: string };
  DateCreated?: string;
  DateModified?: string;
}

interface VoxtaCollectionRoot {
  Folders: VoxtaCollectionFolder[];
}

interface VoxtaCollectionFolder {
  Name: string;
  Description?: string;
  Kind: VoxtaResourceKind;  // Type of resources in this folder
  Items: VoxtaCollectionItem[];
  Folders?: VoxtaCollectionFolder[];  // Nested folders
}

interface VoxtaCollectionItem {
  Resource: VoxtaResourceRef;
}

interface VoxtaResourceRef {
  Kind: VoxtaResourceKind;
  Id: string;  // UUID of the referenced resource
}
```

### Reading Collections

```typescript
import { readVoxta } from '@character-foundry/voxta';

const data = readVoxta(buffer);

// Access collections
for (const collection of data.collections) {
  console.log(`Collection: ${collection.data.Name}`);

  // Iterate folders
  for (const folder of collection.data.Root.Folders) {
    console.log(`  Folder: ${folder.Name} (${folder.Items.length} items)`);

    // Get referenced resource IDs
    for (const item of folder.Items) {
      const { Kind, Id } = item.Resource;
      console.log(`    - ${Kind === 1 ? 'Character' : Kind === 3 ? 'Scenario' : 'Book'}: ${Id}`);
    }
  }
}
```

### Collection Example

```json
{
  "$type": "collection",
  "Id": "9152ae18-f6bb-2cdb-0cd0-bdeaf8a41543",
  "Name": "Fallout 18",
  "PackageId": "531cd884-451b-c0e2-9865-7f53b3665411",
  "Root": {
    "Folders": [
      {
        "Name": "Adventure",
        "Description": "Main scenario",
        "Kind": 3,
        "Items": [
          { "Resource": { "Kind": 3, "Id": "93a8f3ab-ffb5-6bb1-d7a0-e64c277d84be" } }
        ]
      },
      {
        "Name": "Vault Dwellers",
        "Description": "Characters from Vault 18",
        "Kind": 1,
        "Items": [
          { "Resource": { "Kind": 1, "Id": "23ac4f7e-c899-67b6-2276-6594fb467c91" } },
          { "Resource": { "Kind": 1, "Id": "83502444-1700-62b1-e3d5-1448cc4954df" } }
        ]
      }
    ]
  }
}
```

---

## Merge Utilities

Edit Voxta packages with delta updates - only rewrite changed files.

### Types

```typescript
interface CCv3Edits {
  name?: string;
  description?: string;
  personality?: string;
  // ... all CCv3 fields as optional
}

interface VoxtaDeltas {
  characters?: Map<string, VoxtaCharacter>;
  books?: Map<string, VoxtaBook>;
  scenarios?: Map<string, VoxtaScenario>;
  newAssets?: Map<string, Uint8Array>;
  deletedFiles?: string[];
}

interface PackageManifest {
  packageId?: string;
  packageName?: string;
  characters: ManifestCharacter[];
  books: ManifestBook[];
  scenarios: ManifestScenario[];
}
```

### Merge Character Edits

Apply partial CCv3 edits to a Voxta character:

```typescript
import { mergeCharacterEdits } from '@character-foundry/voxta';

// Only update changed fields
const updated = mergeCharacterEdits(originalVoxtaChar, {
  description: 'New description',
  personality: 'Updated personality',
});

// Returns VoxtaCharacter with merged changes
```

### Merge Book Edits

Apply CCv3 lorebook edits to a Voxta book:

```typescript
import { mergeBookEdits } from '@character-foundry/voxta';

const updatedBook = mergeBookEdits(originalVoxtaBook, {
  entries: [
    { keys: ['dragon'], content: 'Updated dragon lore' },
  ],
});
```

### Apply Deltas

Export with only changed files (faster, smaller diffs):

```typescript
import { applyVoxtaDeltas, applyVoxtaDeltasAsync } from '@character-foundry/voxta';

// Build delta update
const deltas: VoxtaDeltas = {
  characters: new Map([
    [charId, updatedCharacter],
  ]),
  books: new Map([
    [bookId, updatedBook],
  ]),
};

// Apply to original package
const newBuffer = applyVoxtaDeltas(originalBuffer, deltas, {
  compressionLevel: 6,
});

// Async version
const newBuffer = await applyVoxtaDeltasAsync(originalBuffer, deltas);
```

### Package Manifest

Get an overview of package contents for UI:

```typescript
import { getPackageManifest } from '@character-foundry/voxta';

const manifest = getPackageManifest(voxtaData);

// manifest.characters: [{ id, name }, ...]
// manifest.books: [{ id, name, usedBy: [charIds] }, ...]
// manifest.scenarios: [{ id, name }, ...]

// Show which characters use which books
for (const book of manifest.books) {
  console.log(`${book.name} used by: ${book.usedBy.join(', ')}`);
}
```

### Extract/Add Characters

Work with individual characters in multi-character packages:

```typescript
import { extractCharacterPackage, addCharacterToPackage } from '@character-foundry/voxta';

// Extract single character as standalone package
const singleCharBuffer = extractCharacterPackage(voxtaData, characterId, {
  includeSharedBooks: true,
});

// Add character to existing package
const expandedBuffer = addCharacterToPackage(
  existingPackageBuffer,
  newCharacter,
  newAssets,
  { createSharedBooks: true }
);
```

---

## Loss Reporting

Check what data would be lost when converting to/from Voxta.

```typescript
import {
  checkVoxtaLoss,
  isVoxtaExportLossless,
  formatVoxtaLossReport,
} from '@character-foundry/voxta';

// Check for loss when exporting CCv3 to Voxta
const loss = checkVoxtaLoss(ccv3Card);

if (!isVoxtaExportLossless(loss)) {
  console.log(formatVoxtaLossReport(loss));
  // "The following fields will be lost: group_only_greetings, ..."
}

// Loss report structure
interface VoxtaLossReport {
  lostFields: string[];
  warnings: string[];
  preservedInExtensions: string[];
}
```

### Fields Lost in Voxta Export

| CCv3 Field | Status |
|------------|--------|
| `group_only_greetings` | Lost (Voxta doesn't support) |
| `nickname` | Lost |
| `source` | Preserved in extensions |
| `creation_date` | Preserved in extensions |
| Risu scripts | Lost |
| Depth prompts | Lost |

---

## Macros

Convert between Voxta macro syntax and standard syntax.

### Macro Differences

| Standard | Voxta |
|----------|-------|
| `{{char}}` | `[CHARACTER]` |
| `{{user}}` | `[USER]` |
| `{{random::a,b,c}}` | `[RANDOM:a,b,c]` |

### Conversion

```typescript
import { voxtaToStandard, standardToVoxta } from '@character-foundry/voxta';

// Convert Voxta macros to standard
const standard = voxtaToStandard('[CHARACTER] says hello to [USER]');
// '{{char}} says hello to {{user}}'

// Convert standard macros to Voxta
const voxta = standardToVoxta('{{char}} greets {{user}}');
// '[CHARACTER] greets [USER]'
```

---

## Usage Examples

### Load and Inspect Package

```typescript
import { isVoxta, readVoxta, getPackageManifest } from '@character-foundry/voxta';

async function inspectVoxtaPackage(buffer: Uint8Array) {
  if (!isVoxta(buffer)) {
    throw new Error('Not a Voxta package');
  }

  const data = readVoxta(buffer);
  const manifest = getPackageManifest(data);

  console.log(`Package: ${manifest.packageName || 'Unnamed'}`);
  console.log(`Characters: ${manifest.characters.length}`);
  console.log(`Books: ${manifest.books.length}`);
  console.log(`Scenarios: ${manifest.scenarios.length}`);

  for (const char of manifest.characters) {
    console.log(`\n  ${char.name} (${char.id})`);
  }

  for (const book of manifest.books) {
    const users = book.usedBy.length;
    console.log(`\n  ${book.name}: shared by ${users} character(s)`);
  }
}
```

### Edit Character in Package

```typescript
import {
  readVoxta,
  mergeCharacterEdits,
  applyVoxtaDeltas,
} from '@character-foundry/voxta';

function editCharacterDescription(
  packageBuffer: Uint8Array,
  characterId: string,
  newDescription: string
): Uint8Array {
  // Read package
  const data = readVoxta(packageBuffer);

  // Find character
  const char = data.characters.find(c => c.id === characterId);
  if (!char) throw new Error('Character not found');

  // Apply edit
  const updated = mergeCharacterEdits(char.data, {
    description: newDescription,
  });

  // Export with delta
  return applyVoxtaDeltas(packageBuffer, {
    characters: new Map([[characterId, updated]]),
  });
}
```

### Convert CCv3 to Voxta Package

```typescript
import { ccv3ToVoxta, ccv3LorebookToVoxtaBook, writeVoxta } from '@character-foundry/voxta';

function ccv3ToVoxtaPackage(card: CCv3Data, assets: ExtractedAsset[]): Uint8Array {
  // Convert character
  const voxtaChar = ccv3ToVoxta(card);

  // Convert lorebook if present
  const books: ExtractedVoxtaBook[] = [];
  if (card.data.character_book) {
    const book = ccv3LorebookToVoxtaBook(card.data.character_book);
    books.push({ id: book.Id, data: book });

    // Link book to character
    voxtaChar.MemoryBooks = [book.Id];
  }

  // Convert assets
  const voxtaAssets = assets.map(a => ({
    id: a.name,
    path: `Characters/${voxtaChar.Id}/Assets/${a.name}`,
    data: a.data,
    type: a.type,
    mime: getMimeType(a.ext),
  }));

  // Build package
  const voxtaData: VoxtaData = {
    characters: [{ id: voxtaChar.Id, data: voxtaChar, assets: voxtaAssets }],
    books,
    scenarios: [],
  };

  const { buffer } = writeVoxta(voxtaData);
  return buffer;
}
```

### Handle Shared Books

```typescript
import { readVoxta, getPackageManifest } from '@character-foundry/voxta';

function getSharedBooks(buffer: Uint8Array) {
  const data = readVoxta(buffer);
  const manifest = getPackageManifest(data);

  // Find books used by multiple characters
  return manifest.books.filter(b => b.usedBy.length > 1);
}

function warnIfEditingSharedBook(buffer: Uint8Array, bookId: string) {
  const manifest = getPackageManifest(readVoxta(buffer));
  const book = manifest.books.find(b => b.id === bookId);

  if (book && book.usedBy.length > 1) {
    const names = book.usedBy.map(id => {
      const char = manifest.characters.find(c => c.id === id);
      return char?.name || id;
    });

    console.warn(`Warning: This book is shared with: ${names.join(', ')}`);
    console.warn('Changes will affect all characters using this book.');
  }
}
```

---

## Asset Enrichment

Add metadata to Voxta assets:

```typescript
import { enrichVoxtaAsset, type EnrichedAssetMetadata } from '@character-foundry/voxta';

const enriched = enrichVoxtaAsset(asset);
// Adds: dimensions, duration, format detection
```
