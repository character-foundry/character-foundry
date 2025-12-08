# Normalizer Package Documentation

The `@character-foundry/normalizer` package handles conversion between character card formats: CCv2, CCv3, and NormalizedCard.

## Table of Contents

- [Overview](#overview)
- [V2 to V3 Conversion](#v2-to-v3-conversion)
- [V3 to V2 Conversion](#v3-to-v2-conversion)
- [NormalizedCard](#normalizedcard)
- [Usage Examples](#usage-examples)

---

## Overview

Character cards exist in multiple versions:

| Version | Spec | Status |
|---------|------|--------|
| **CCv2** | `chara_card_v2` | Legacy, widely supported |
| **CCv3** | `chara_card_v3` | Current, more features |
| **NormalizedCard** | Internal | Flat structure for processing |

This package provides lossless conversion where possible, with loss detection for lossy conversions.

---

## V2 to V3 Conversion

Convert TavernCard V2 to CCv3 (lossless).

```typescript
import { ccv2ToCCv3 } from '@character-foundry/normalizer';

// From wrapped V2
const v3Card = ccv2ToCCv3(v2Wrapped);

// From unwrapped V2 data
const v3Card = ccv2ToCCv3(v2Data);
```

### Field Mapping (V2 → V3)

| V2 Field | V3 Field | Notes |
|----------|----------|-------|
| `name` | `data.name` | Direct |
| `description` | `data.description` | Direct |
| `personality` | `data.personality` | Direct |
| `scenario` | `data.scenario` | Direct |
| `first_mes` | `data.first_mes` | Direct |
| `mes_example` | `data.mes_example` | Direct |
| `creator_notes` | `data.creator_notes` | Direct |
| `system_prompt` | `data.system_prompt` | Direct |
| `post_history_instructions` | `data.post_history_instructions` | Direct |
| `tags` | `data.tags` | Direct |
| `creator` | `data.creator` | Direct |
| `character_version` | `data.character_version` | Direct |
| `alternate_greetings` | `data.alternate_greetings` | Direct |
| `character_book` | `data.character_book` | Entries converted |
| `extensions` | `data.extensions` | Preserved |

### Lorebook Entry Conversion

V2 lorebook entries are converted to V3 format:

```typescript
// V2 entry
{
  keys: ['trigger'],
  content: 'Response',
  extensions: {},
  enabled: true,
  insertion_order: 0,
}

// Becomes V3 entry
{
  keys: ['trigger'],
  content: 'Response',
  enabled: true,
  insertion_order: 0,
  extensions: {},  // Moved to optional
}
```

---

## V3 to V2 Conversion

Convert CCv3 to TavernCard V2 (potentially lossy).

### Functions

```typescript
import {
  ccv3ToCCv2Data,
  ccv3ToCCv2Wrapped,
  checkV3ToV2Loss,
  V3_TO_V2_LOST_FIELDS,
} from '@character-foundry/normalizer';

// Get unwrapped V2 data
const v2Data = ccv3ToCCv2Data(v3Card);

// Get wrapped V2 (with spec/version)
const v2Wrapped = ccv3ToCCv2Wrapped(v3Card);

// Check what will be lost
const lostFields = checkV3ToV2Loss(v3Card);
// ['group_only_greetings', 'nickname', ...]
```

### Fields Lost in V2

```typescript
const V3_TO_V2_LOST_FIELDS = [
  'nickname',
  'creator_notes_multilingual',
  'source',
  'group_only_greetings',
  'creation_date',
];
```

These fields only exist in V3 and cannot be represented in V2.

### Loss Detection

```typescript
import { checkV3ToV2Loss } from '@character-foundry/normalizer';

const v3Card = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: 'Character',
    group_only_greetings: ['Group hello!'],
    nickname: 'Char',
    // ... other fields
  }
};

const lost = checkV3ToV2Loss(v3Card);
// ['group_only_greetings', 'nickname']

if (lost.length > 0) {
  console.warn(`Converting to V2 will lose: ${lost.join(', ')}`);
}
```

---

## NormalizedCard

A flat, camelCase structure for easier processing.

### To NormalizedCard

```typescript
import { normalize, normalizeV2, normalizeV3 } from '@character-foundry/normalizer';

// Auto-detect and normalize
const normalized = normalize(card);

// Explicitly from V2
const normalized = normalizeV2(v2Card);

// Explicitly from V3
const normalized = normalizeV3(v3Card);
```

### NormalizedCard Structure

```typescript
interface NormalizedCard {
  // Identity
  name: string;
  nickname?: string;

  // Character
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;           // camelCase!
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

  // Content
  assets: AssetDescriptor[];
  characterBook?: CharacterBook;

  // Raw extensions
  extensions: Record<string, unknown>;

  // Tracking
  sourceFormat?: 'png' | 'charx' | 'voxta' | 'json';
  originalShape?: 'v2' | 'v3';
}
```

### From NormalizedCard

```typescript
import {
  denormalizeToV3,
  denormalizeToV2Data,
  denormalizeToV2Wrapped,
  checkNormalizedToV2Loss,
} from '@character-foundry/normalizer';

// To CCv3
const v3Card = denormalizeToV3(normalized);

// To CCv2 (unwrapped)
const v2Data = denormalizeToV2Data(normalized);

// To CCv2 (wrapped)
const v2Wrapped = denormalizeToV2Wrapped(normalized);

// Check V2 loss
const lost = checkNormalizedToV2Loss(normalized);
```

---

## Usage Examples

### Round-Trip V2 → V3 → V2

```typescript
import { ccv2ToCCv3, ccv3ToCCv2Wrapped, checkV3ToV2Loss } from '@character-foundry/normalizer';

function updateV2Card(v2Card: CCv2Wrapped, updates: Partial<CCv3DataInner>): CCv2Wrapped {
  // Convert to V3 for editing
  const v3Card = ccv2ToCCv3(v2Card);

  // Apply updates
  Object.assign(v3Card.data, updates);

  // Check if we added V3-only fields
  const loss = checkV3ToV2Loss(v3Card);
  if (loss.length > 0) {
    console.warn('New V3-only fields will be lost on save:', loss);
  }

  // Convert back to V2
  return ccv3ToCCv2Wrapped(v3Card);
}
```

### Normalize for Processing

```typescript
import { normalize } from '@character-foundry/normalizer';

function processCard(rawCard: unknown) {
  const card = normalize(rawCard);

  // Now we have consistent camelCase fields
  console.log(card.name);
  console.log(card.firstMessage);  // Not first_mes!
  console.log(card.alternateGreetings);

  // Calculate stats
  const totalLength =
    card.description.length +
    card.personality.length +
    card.firstMessage.length +
    card.exampleMessages.length;

  return { card, totalLength };
}
```

### Export with Version Choice

```typescript
import { parseCard } from '@character-foundry/loader';
import { ccv3ToCCv2Wrapped, checkV3ToV2Loss } from '@character-foundry/normalizer';

function exportAsV2(buffer: Uint8Array): { json: string; lost: string[] } {
  const { card } = parseCard(buffer);

  // Check loss
  const lost = checkV3ToV2Loss(card);

  // Convert to V2
  const v2Card = ccv3ToCCv2Wrapped(card);

  return {
    json: JSON.stringify(v2Card, null, 2),
    lost,
  };
}
```

### Migration Tool

```typescript
import { isWrappedV2, ccv2ToCCv3 } from '@character-foundry/normalizer';
import { detectSpec } from '@character-foundry/schemas';

function migrateToV3(jsonData: unknown): CCv3Data {
  const spec = detectSpec(jsonData);

  if (spec === 'chara_card_v3') {
    // Already V3
    return jsonData as CCv3Data;
  }

  if (spec === 'chara_card_v2' || isWrappedV2(jsonData)) {
    // Convert V2 to V3
    return ccv2ToCCv3(jsonData);
  }

  throw new Error('Unknown card format');
}
```

### Preserve Extensions Through Normalization

```typescript
import { normalize, denormalizeToV3 } from '@character-foundry/normalizer';

function updateWithExtensionsPreserved(
  card: CCv3Data,
  updates: Partial<NormalizedCard>
): CCv3Data {
  // Normalize
  const normalized = normalize(card);

  // Apply updates (extensions are preserved)
  Object.assign(normalized, updates);

  // Convert back (extensions survive)
  return denormalizeToV3(normalized);
}
```

---

## Conversion Matrix

| From | To | Function | Loss |
|------|----|---------|-|
| CCv2 | CCv3 | `ccv2ToCCv3()` | None |
| CCv3 | CCv2 | `ccv3ToCCv2Wrapped()` | V3-only fields |
| CCv2 | Normalized | `normalizeV2()` | None |
| CCv3 | Normalized | `normalizeV3()` | None |
| Normalized | CCv3 | `denormalizeToV3()` | None |
| Normalized | CCv2 | `denormalizeToV2Wrapped()` | V3-only fields |
| Any | Normalized | `normalize()` | None (auto-detect) |

---

## Best Practices

1. **Use CCv3 internally** - More features, no loss
2. **Check loss before V2 export** - Warn users about lost data
3. **Preserve originalShape** - Track what format data came from
4. **Use NormalizedCard for processing** - Consistent field names
