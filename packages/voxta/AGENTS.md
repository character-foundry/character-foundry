# AGENTS.md — @character-foundry/voxta

## Purpose

Read and write Voxta character packages (.voxpkg). Currently character-only; scenarios/packages are future scope.

---

## Voxta Structure

```
character.voxpkg (ZIP)
├── character.json      # Required: Voxta character format
├── avatar.png          # Optional: character image
└── [other assets]
```

---

## Exports

| Function | Description |
|----------|-------------|
| `readVoxta(data)` | Parse VoxPkg to VoxtaData |
| `writeVoxta(card)` | Create VoxPkg from NormalizedCard |
| `isVoxta(data)` | Detect Voxta format |

---

## ID Requirements

**Strict UUID v4 format.** Voxta requires valid UUIDs.

```typescript
import { randomUUID } from 'crypto';

// DO NOT use nanoid, cuid, or other formats
const id = randomUUID(); // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

---

## Export Lossiness

Voxta lacks an `extensions` field. Many CC fields cannot be preserved.

```typescript
interface VoxtaLossReport {
  lostFields: [
    'extensions.*',           // All extensions
    'character_book.extensions',
    'creator_notes',          // If too long
  ];
  reason: 'Voxta schema does not support extensions';
}
```

**Strategy:** Store full CC metadata in our DB. Re-export when Voxta adds extensions.

---

## Field Mapping

| CC Field | Voxta Field | Notes |
|----------|-------------|-------|
| name | name | Direct |
| description | description | Direct |
| personality | personality | Direct |
| scenario | scenario | Direct |
| first_mes | firstMessage | Renamed |
| mes_example | messageExample | Renamed |
| system_prompt | systemPrompt | Direct |
| character_book | - | Embedded in prompts |
| extensions | - | LOST |

---

## Dependencies

- `@character-foundry/core` (SafeZip, binary)
- `@character-foundry/schemas` (Voxta types)

---

## Testing Focus

- Read Voxta character packages
- Write with valid UUID
- Loss report accuracy
- Round-trip (within Voxta's capabilities)
