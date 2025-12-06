# AGENTS.md — @character-foundry/loader

## Purpose

Universal `parseCard()` API that accepts any supported format and returns a unified result.

---

## Main Export

```typescript
interface ParseResult {
  card: NormalizedCard;           // Unified accessor
  assets: ExtractedAsset[];       // Binary assets
  sourceFormat: SourceFormat;     // Detected format
  spec: 'v2' | 'v3';              // Card spec version
  originalShape: OriginalShape;   // wrapped/unwrapped/legacy
  rawJson: unknown;               // Preserved for re-export
  rawBuffer: Uint8Array;          // Bit-perfect original
}

function parseCard(
  data: Uint8Array | Buffer,
  filename?: string
): ParseResult;

function parseCardAsync(
  data: Uint8Array | Buffer | ReadableStream,
  filename?: string,
  options?: ParseOptions
): Promise<ParseResult>;
```

---

## Detection Order

```typescript
function detectFormat(data: Uint8Array, filename?: string): SourceFormat {
  // 1. Check magic bytes
  if (isPNG(data)) return detectPNGFormat(data);
  if (isJPEG(data) && hasZipAppended(data)) return 'charx_jpeg';
  if (isZIP(data)) return detectZIPFormat(data);

  // 2. Try JSON parse
  if (looksLikeJSON(data)) return detectJSONFormat(data);

  // 3. Use filename hint
  if (filename?.endsWith('.charx')) return 'charx';
  if (filename?.endsWith('.voxpkg')) return 'voxta';

  return null; // Unknown format
}
```

---

## Normalization Rules

The loader provides a **virtual unified view** but does NOT rewrite the source.

```typescript
// v2 field mapping
card.data.description    -> normalized.description
card.data.personality    -> normalized.personality
card.data.first_mes      -> normalized.firstMes
card.data.mes_example    -> normalized.mesExample

// v3 field mapping (same names, different structure)
card.data.description    -> normalized.description
card.data.system_prompt  -> normalized.systemPrompt
```

---

## Error Handling

```typescript
// Throw specific errors with context
throw new ParseError('Invalid PNG: no card chunk found', 'png');
throw new ParseError('CharX missing card.json', 'charx');

// Never swallow errors
// Include format in error for debugging
```

---

## Dependencies

- `@character-foundry/core`
- `@character-foundry/schemas`
- `@character-foundry/png`
- `@character-foundry/charx`
- `@character-foundry/voxta`

---

## Testing Focus

- Detect all formats correctly
- Parse all fixture types
- Preserve rawBuffer bit-perfect
- Handle malformed input gracefully
- Async streaming for large files
