# AGENTS.md — @character-foundry/exporter

## Purpose

Export cards to specific target formats with explicit loss reporting.

---

## Main Export

```typescript
type ExportTarget =
  | 'json_v2' | 'json_v3'
  | 'png_v2' | 'png_v3'
  | 'charx_v3' | 'charx_risu'
  | 'voxta_character';

interface ExportOptions {
  target: ExportTarget;
  baseImage?: Uint8Array;         // Required for PNG
  assets?: ExtractedAsset[];
  preserveSourceMetadata?: boolean; // Default true
  emitXMeta?: boolean;            // Default false, true for charx_risu
}

interface ExportResult {
  buffer: Uint8Array;
  mimeType: string;
  extension: string;
  lossReport?: LossReport;
}

function exportCard(
  card: NormalizedCard,
  options: ExportOptions
): ExportResult;
```

---

## Export Profiles

| Target | Output | Lossless? |
|--------|--------|-----------|
| `json_v2` | JSON file | From v2: Yes |
| `json_v3` | JSON file | From v3: Yes |
| `png_v2` | PNG + tEXt chunk | From v2: Yes |
| `png_v3` | PNG + ccv3 chunk | From v3: Yes |
| `charx_v3` | ZIP per v3 spec | From v3: Yes |
| `charx_risu` | ZIP with x_meta | From Risu: Yes |
| `voxta_character` | VoxPkg | Always lossy |

---

## Loss Checking

```typescript
interface LossReport {
  target: ExportTarget;
  lostFields: string[];     // e.g., ['extensions.risuai.triggerscript']
  lostAssets: string[];     // URIs that couldn't be included
  warnings: string[];       // Non-fatal issues
}

function checkExportCompatibility(
  card: NormalizedCard,
  target: ExportTarget
): LossReport;

// Call BEFORE export to warn user
// Call AFTER export to document what was lost
```

---

## Same-Format Preservation

When exporting v2 -> v2 or v3 -> v3, preserve "weird" source metadata:

```typescript
// If source had non-standard fields, keep them
if (options.preserveSourceMetadata && result.rawJson) {
  // Merge source metadata into output
}
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

- Round-trip: parse -> export -> parse = identical
- Loss reports are accurate
- PNG export requires baseImage
- CharX Risu includes x_meta
- Voxta loses extensions (documented)
