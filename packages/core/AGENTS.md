# AGENTS.md — @character-foundry/core

## Purpose

Foundation utilities shared by all other packages. No external dependencies.

---

## Exports

| Module | Functions | Description |
|--------|-----------|-------------|
| `binary.ts` | `concat`, `slice`, `equals`, `toHex` | BinaryData operations |
| `base64.ts` | `encode`, `decode`, `isBase64` | Base64 encode/decode |
| `zip.ts` | `SafeZip` class | ZIP read/write with size limits |
| `uri.ts` | `normalizeURI`, `parseURI` | URI scheme handling |
| `errors.ts` | `FoundryError`, `ParseError`, etc. | Error classes |

---

## URI Normalization

Handle all known variants:

```typescript
// Input -> Normalized
'embedded://path'      -> 'embeded://path'  // Fix typo
'__asset:0'            -> 'pngchunk:0'
'chara-ext-asset_:0'   -> 'pngchunk:0'
'chara-ext-asset_0'    -> 'pngchunk:0'      // No colon variant
'ccdefault:'           -> 'ccdefault:'
'data:image/png;...'   -> 'data:image/png;...'
```

---

## SafeZip Requirements

```typescript
interface SafeZipOptions {
  maxFileSize: number;    // Default 50MB (Risu standard)
  maxTotalSize: number;   // Default 200MB
  maxFiles: number;       // Default 1000
}

// Must validate paths for traversal attacks
// Must check sizes BEFORE extracting
```

---

## Dependencies

**None.** This is the foundation layer.

---

## Testing Focus

- Binary operations (concat, slice edge cases)
- Base64 round-trips with unicode
- URI normalization (all variants)
- ZIP path traversal rejection
- ZIP size limit enforcement
