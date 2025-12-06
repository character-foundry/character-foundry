# AGENTS.md — @character-foundry/png

## Purpose

Read and write PNG files with embedded character card data in tEXt/zTXt chunks.

---

## Exports

| Function | Description |
|----------|-------------|
| `extractFromPNG(data)` | Extract card JSON from PNG |
| `embedInPNG(png, json, keyword)` | Embed card JSON in PNG |
| `listChunks(data)` | List all PNG chunks |
| `getChunk(data, keyword)` | Get specific chunk data |

---

## Chunk Handling

```typescript
// Supported keywords
const CARD_KEYWORDS = ['chara', 'ccv3'];

// Read priority (when multiple exist)
// 1. Prefer chunk with character_book if present
// 2. Prefer 'ccv3' over 'chara'
// 3. Take first match

// Compression
// tEXt: uncompressed, base64 encoded
// zTXt: deflate compressed, then base64 encoded
```

---

## Multi-Chunk Cards (Read-Only)

Some cards store assets in additional PNG chunks (`__asset:0`, etc.). We READ these but do NOT write them.

```typescript
// Read asset chunks
function extractAssetChunks(data: Uint8Array): Map<number, Uint8Array>;

// Export decision: NO multi-chunk export
// Reason: Breaks web image loaders, bloats files
```

---

## Dependencies

- `@character-foundry/core` (binary, base64)
- `@character-foundry/schemas` (types)

---

## Testing Focus

- Extract from tEXt chunk
- Extract from zTXt chunk (compressed)
- Handle multiple chara chunks
- Round-trip: embed -> extract = identical
- Reject non-PNG files gracefully
