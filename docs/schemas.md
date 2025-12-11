# Schemas Package Documentation

**Package:** `@character-foundry/schemas`
**Version:** 0.1.1
**Environment:** Node.js and Browser

The `@character-foundry/schemas` package provides TypeScript type definitions and detection utilities for character card formats (CCv2, CCv3, Voxta, Risu extensions).

## Table of Contents

- [Overview](#overview)
- [Common Types](#common-types)
- [CCv2 Types](#ccv2-types)
- [CCv3 Types](#ccv3-types)
- [Risu Extension Types](#risu-extension-types)
- [Normalized Card](#normalized-card)
- [Detection Utilities](#detection-utilities)

---

## Overview

Character cards come in several formats:

| Format | Spec | Notes |
|--------|------|-------|
| **CCv2** | `chara_card_v2` | TavernCard V2, widely supported |
| **CCv3** | `chara_card_v3` | Character Card V3, newer features |
| **Risu** | CCv3 + extensions | RisuAI-specific extensions |

This package defines TypeScript types for all formats and provides utilities to detect which format a card uses.

---

## Common Types

### Asset Types

```typescript
type AssetType = 'icon' | 'background' | 'user_icon' | 'emotion' | 'audio' | 'video' | 'other';

interface AssetDescriptor {
  type: AssetType;
  uri: string;       // Data URI, embeded://, or external URL
  name: string;      // Display name
  ext: string;       // File extension without dot
}

interface ExtractedAsset {
  type: AssetType;
  name: string;
  ext: string;
  data: Uint8Array;  // Raw binary data
}
```

### Utility Types

```typescript
type ISO8601 = string;  // '2024-01-15T12:00:00Z'
type UUID = string;     // '550e8400-e29b-41d4-a716-446655440000'
type Spec = 'chara_card_v2' | 'chara_card_v3';
type SourceFormat = 'png' | 'charx' | 'voxta' | 'json';
type OriginalShape = 'v2' | 'v3';
```

---

## CCv2 Types

TavernCard V2 format (spec: `chara_card_v2`).

### CCv2Data

The inner data structure:

```typescript
interface CCv2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string[];
  creator: string;
  character_version: string;
  alternate_greetings: string[];
  character_book?: CCv2CharacterBook;
  extensions: Record<string, unknown>;
}
```

### CCv2Wrapped

The full card structure (as stored in PNG):

```typescript
interface CCv2Wrapped {
  spec: 'chara_card_v2';
  spec_version: string;
  data: CCv2Data;
}
```

### CCv2CharacterBook

Lorebook/World Info:

```typescript
interface CCv2CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: CCv2LorebookEntry[];
}

interface CCv2LorebookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
}
```

### Utility Functions

```typescript
import { isWrappedV2, isV2CardData, getV2Data } from '@character-foundry/schemas';

// Check if object is CCv2Wrapped
if (isWrappedV2(obj)) {
  // obj.spec === 'chara_card_v2'
}

// Check if object looks like CCv2 data (has required fields)
if (isV2CardData(obj)) { ... }

// Extract V2 data (handles both wrapped and unwrapped)
const data = getV2Data(card); // CCv2Data | null
```

---

## CCv3 Types

Character Card V3 format (spec: `chara_card_v3`).

### CCv3Data

The full card structure:

```typescript
interface CCv3Data {
  spec: 'chara_card_v3';
  spec_version: string;  // '3.0'
  data: CCv3DataInner;
}

interface CCv3DataInner {
  // Core fields (same as v2)
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string[];
  creator: string;
  character_version: string;
  alternate_greetings: string[];

  // V3 additions
  nickname?: string;
  creator_notes_multilingual?: Record<string, string>;
  source?: string[];
  group_only_greetings?: string[];
  assets?: AssetDescriptor[];
  creation_date?: ISO8601;

  // Lorebook
  character_book?: CCv3CharacterBook;

  // Extensions
  extensions?: Record<string, unknown>;
}
```

### CCv3CharacterBook

Enhanced lorebook with more entry options:

```typescript
interface CCv3CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CCv3LorebookEntry[];
}

interface CCv3LorebookEntry {
  keys: string[];
  content: string;
  enabled: boolean;
  insertion_order: number;

  // Optional fields
  id?: number;
  name?: string;
  comment?: string;
  priority?: number;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
  case_sensitive?: boolean;
  use_regex?: boolean;

  // V3 additions
  extensions?: Record<string, unknown>;
}
```

### Utility Functions

```typescript
import { isV3Card, getV3Data } from '@character-foundry/schemas';

// Check if object is CCv3Data
if (isV3Card(obj)) {
  // obj.spec === 'chara_card_v3'
}

// Extract V3 data
const data = getV3Data(card); // CCv3DataInner | null
```

---

## Risu Extension Types

RisuAI-specific extensions stored in `data.extensions`.

### Types

```typescript
interface RisuEmotions {
  [emotionName: string]: string;  // Emotion name -> asset URI
}

interface RisuAdditionalAssets {
  name: string;
  uri: string;
  type: string;
}

interface RisuDepthPrompt {
  prompt: string;
  depth: number;
  role: 'system' | 'user' | 'assistant';
}

interface RisuExtensions {
  emotions?: RisuEmotions;
  additionalAssets?: RisuAdditionalAssets[];
  depth_prompt?: RisuDepthPrompt;
  ripiScripts?: unknown[];
  // ... more fields
}
```

### CharX Meta Entry

Used in CharX format to store extra files:

```typescript
interface CharxMetaEntry {
  name: string;
  path: string;
  mime: string;
  size?: number;
  hash?: string;
}
```

### Detection Functions

```typescript
import { hasRisuExtensions, hasRisuScripts, hasDepthPrompt } from '@character-foundry/schemas';

// Check for Risu extensions
if (hasRisuExtensions(card)) {
  // Has emotions, additionalAssets, etc.
}

// Check for Risu scripts
if (hasRisuScripts(card)) {
  // Has ripiScripts array
}

// Check for depth prompt
if (hasDepthPrompt(card)) {
  // Has depth_prompt extension
}
```

---

## Normalized Card

A flattened representation for easier processing.

### NormalizedCard

```typescript
interface NormalizedCard {
  // Identity
  name: string;
  nickname?: string;

  // Character definition
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: string;
  alternateGreetings: string[];
  groupOnlyGreetings?: string[];

  // System
  systemPrompt: string;
  postHistoryInstructions: string;

  // Metadata
  creatorNotes: string;
  creatorNotesMultilingual?: Record<string, string>;
  tags: string[];
  creator: string;
  characterVersion: string;
  source?: string[];
  creationDate?: string;

  // Assets & Lorebook
  assets: AssetDescriptor[];
  characterBook?: CCv3CharacterBook;

  // Extensions (preserved raw)
  extensions: Record<string, unknown>;

  // Source tracking
  sourceFormat?: SourceFormat;
  originalShape?: OriginalShape;
}
```

### DerivedFeatures

Computed features for UI display:

```typescript
interface DerivedFeatures {
  hasLorebook: boolean;
  hasAlternateGreetings: boolean;
  hasGroupGreetings: boolean;
  hasEmotions: boolean;
  hasAssets: boolean;
  hasSystemPrompt: boolean;
  hasPostHistory: boolean;
  hasScripts: boolean;
  hasDepthPrompt: boolean;
  estimatedTokens?: number;
}
```

### Factory Functions

```typescript
import { createEmptyNormalizedCard, createEmptyFeatures } from '@character-foundry/schemas';

// Create empty card
const card = createEmptyNormalizedCard();
card.name = 'New Character';

// Create empty features
const features = createEmptyFeatures();
```

---

## Detection Utilities

Detect card format from raw data.

### Basic Detection

```typescript
import { detectSpec, hasLorebook, looksLikeCard } from '@character-foundry/schemas';

// Detect spec from parsed JSON
const spec = detectSpec(json);
// Returns: 'chara_card_v3' | 'chara_card_v2' | null

// Check if card has a lorebook
if (hasLorebook(card)) {
  // card.data.character_book exists and has entries
}

// Quick check if object looks like a character card
if (looksLikeCard(obj)) {
  // Has name, description, first_mes, etc.
}
```

### Detailed Detection

For more information about why a format was detected:

```typescript
import { detectSpecDetailed } from '@character-foundry/schemas';

const result = detectSpecDetailed(json);
// {
//   spec: 'chara_card_v3',
//   confidence: 'high',
//   indicators: ['Has spec field', 'Has V3-only fields: assets, creation_date'],
//   warnings: []
// }

// Confidence levels:
// - 'high': Explicit spec field or multiple V3-only fields
// - 'medium': Implicit detection from structure
// - 'low': Minimal indicators, could be ambiguous
```

---

## CardNormalizer

Fix malformed card data from various sources (ChubAI, CharacterTavern, etc.).

```typescript
import { CardNormalizer } from '@character-foundry/schemas';

// Auto-detect and normalize
const normalized = CardNormalizer.autoNormalize(malformedData);
// Returns CCv2Wrapped | CCv3Data | null

// Normalize to specific version
const v3Card = CardNormalizer.normalize(data, 'v3');
const v2Card = CardNormalizer.normalize(data, 'v2');

// Fix lorebook/character_book
const fixedBook = CardNormalizer.normalizeCharacterBook(book, 'v3');

// Fix individual lorebook entries
const fixedEntry = CardNormalizer.normalizeEntry(entry, 'v3');

// Fix timestamps (CharacterTavern uses milliseconds instead of seconds)
const fixedCard = CardNormalizer.fixTimestamps(card);
```

### What CardNormalizer Fixes

- **ChubAI hybrid format**: Merges root-level data fields into proper `data` object
- **CharacterTavern timestamps**: Converts milliseconds to seconds for `creation_date`/`modification_date`
- **Numeric position**: Converts `0`/`1` to `'before_char'`/`'after_char'` in lorebook entries
- **V3-only lorebook fields in V2**: Moves fields like `probability`, `depth`, `group`, `use_regex` to extensions
- **Missing required fields**: Adds defaults for `name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example`
- **Null character_book**: Removes `character_book: null` entirely
- **Invalid arrays**: Ensures `tags`, `alternate_greetings`, `group_only_greetings` are arrays
- **Missing extensions**: Ensures `extensions` object exists for V2 entries

### Example: Normalizing ChubAI Card

ChubAI sometimes exports cards with fields at both root and in `data`:

```typescript
// Malformed ChubAI card
const malformed = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  name: 'Character Name',  // Wrong: at root level
  data: {
    description: 'Some description',
    // Missing other required fields
  },
};

// Normalize it
const normalized = CardNormalizer.normalize(malformed, 'v3');
// normalized.data.name = 'Character Name' (moved from root)
// normalized.data.personality = '' (default added)
// etc.
```

---

## Type Aliases

For convenience:

```typescript
// These are exported for simpler usage
export type CharacterBook = CCv3CharacterBook;
export type LorebookEntry = CCv3LorebookEntry;
```

---

## Usage Examples

### Type-Safe Card Access

```typescript
import { CCv3Data, isV3Card, getV3Data } from '@character-foundry/schemas';

function processCard(data: unknown) {
  if (isV3Card(data)) {
    // TypeScript knows data is CCv3Data
    const inner = data.data;
    console.log(`Character: ${inner.name}`);

    if (inner.character_book) {
      console.log(`Lorebook entries: ${inner.character_book.entries.length}`);
    }
  }
}
```

### Detecting Format

```typescript
import { detectSpec, isWrappedV2, isV3Card } from '@character-foundry/schemas';

function getCardVersion(json: unknown): 'v2' | 'v3' | 'unknown' {
  const spec = detectSpec(json);

  if (spec === 'chara_card_v3') return 'v3';
  if (spec === 'chara_card_v2') return 'v2';

  // Fallback checks
  if (isV3Card(json)) return 'v3';
  if (isWrappedV2(json)) return 'v2';

  return 'unknown';
}
```

### Working with Assets

```typescript
import { CCv3Data, AssetDescriptor } from '@character-foundry/schemas';

function getEmotionAssets(card: CCv3Data): AssetDescriptor[] {
  return (card.data.assets || []).filter(a => a.type === 'emotion');
}

function hasAvatar(card: CCv3Data): boolean {
  return (card.data.assets || []).some(a => a.type === 'icon');
}
```
