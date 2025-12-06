# AGENTS.md — @character-foundry/charx

## Purpose

Read and write CharX format (ZIP-based character packages per v3 spec).

---

## CharX Structure

```
character.charx (ZIP)
├── card.json           # Required: CCv3 JSON
├── assets/             # Optional: embedded assets
│   ├── avatar.png
│   └── emotion_happy.png
├── x_meta/             # Optional: PNG metadata preservation
│   └── 0.json          # Metadata for assets/0.png
├── module.risum        # Risu-only: compiled scripts (opaque)
└── readme.txt          # Optional: human-readable info
```

---

## Exports

| Function | Description |
|----------|-------------|
| `readCharX(data)` | Parse CharX ZIP to CharxData |
| `writeCharX(card, assets, options)` | Create CharX ZIP |
| `isCharX(data)` | Detect CharX format |

---

## JPEG+ZIP Hybrid (Read-Only)

RisuAI creates JPEG files with appended ZIP data. We READ these but do NOT write them.

```typescript
function isJpegCharX(data: Uint8Array): boolean {
  // Check JPEG magic (FFD8FF) + ZIP signature after JPEG EOI
}

function findZipStart(data: Uint8Array): number {
  // Locate ZIP local file header (504B0304) after JPEG data
}
```

---

## x_meta Handling

```typescript
interface CharxWriteOptions {
  emitXMeta?: boolean;  // Default: false
                        // Set true for charx_risu target
}

// x_meta preserves PNG chunk metadata from image assets
// Only emit when targeting Risu-compatible output
```

---

## module.risum

**Opaque blob.** Do not parse, interpret, or transform. Copy bit-perfect.

```typescript
interface CharxData {
  card: CCv3Data;
  assets: CharxAsset[];
  moduleRisum?: Uint8Array;  // Preserved as-is
  xMeta?: Map<number, object>;
}
```

---

## Dependencies

- `@character-foundry/core` (SafeZip, binary)
- `@character-foundry/schemas` (CCv3 types)

---

## Size Limits

| Item | Limit | Source |
|------|-------|--------|
| card.json | 10MB | Conservative |
| Single asset | 50MB | Risu standard |
| Total package | 200MB | Risu standard |

---

## Testing Focus

- Read standard CharX (card.json + assets/)
- Read Risu CharX (with module.risum)
- Read JPEG+ZIP hybrid
- Write CharX with/without x_meta
- Round-trip integrity
- Size limit enforcement
