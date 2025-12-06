# AGENTS.md — Character Foundry

## 0. Quick Reference

**Project:** Character Foundry (`@character-foundry/*`)
**Purpose:** Shared primitives for AI character card handling (CCv2, CCv3, CharX, Voxta)
**PM:** Opus | **Status:** Design Phase

```
Packages:        core | schemas | png | charx | voxta | loader | exporter | federation
Consuming Apps:  Card Architect | CardsHub | Character Archive (forked)
```

---

## 1. Architecture Overview

### The Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    CONSUMING APPLICATIONS                    │
│  Card Architect (Editor) │ CardsHub (Hub) │ Archive (Library)│
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                      HIGH-LEVEL API                          │
│            loader (parseCard)  │  exporter (exportCard)      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    FORMAT HANDLERS                           │
│         png  │  charx  │  voxta  │  (future: risu-native)   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                      FOUNDATION                              │
│              core (binary, zip, uri)  │  schemas (types)     │
└─────────────────────────────────────────────────────────────┘
```

### Package Dependency Rules

```
loader     → schemas, png, charx, voxta, core
exporter   → schemas, png, charx, voxta, core
png        → schemas, core
charx      → schemas, core
voxta      → schemas, core
schemas    → (none)
core       → (none)
federation → schemas, core
```

**Hard Rule:** No circular dependencies. Lower layers never import higher layers.

---

## 2. Core Principles

### 2.1 Data Integrity

| Context | Mutate? | Rule |
|---------|---------|------|
| Import/Parse | NO | Preserve original exactly |
| Archive Storage | NO | Store raw buffer bit-perfect |
| Format Conversion | YES | v2→v3, v3→Voxta require changes |
| Same-Format Export | NO | Preserve source metadata |
| User Edits | YES | Explicit user action |

**The Law:** Parser never normalizes. Normalization is export-time, user-initiated.

### 2.2 Permissive Read, Strict Write

- **Read:** Accept anything that looks like a card. Handle malformed JSON, missing fields, weird extensions.
- **Write:** Produce spec-compliant output. Document what's lost in conversion.

### 2.3 Opaque Preservation

Do NOT interpret or transform:
- `extensions.risuai.triggerscript`
- `extensions.risuai.customScripts`
- `module.risum` binary data
- Unknown extensions

Copy them through unchanged. Extract presence as metadata flags.

---

## 3. File Structure

```
character-foundry/
├── AGENTS.md                 # This file
├── packages/
│   ├── core/
│   │   ├── AGENTS.md         # Package-specific guide
│   │   ├── src/
│   │   │   ├── binary.ts     # BinaryData, concat, slice
│   │   │   ├── base64.ts     # encode/decode
│   │   │   ├── zip.ts        # SafeZip wrapper
│   │   │   ├── uri.ts        # URI parser/normalizer
│   │   │   ├── errors.ts     # Error classes
│   │   │   └── index.ts      # Public exports
│   │   ├── tests/
│   │   └── package.json
│   ├── schemas/
│   ├── png/
│   ├── charx/
│   ├── voxta/
│   ├── loader/
│   ├── exporter/
│   └── federation/
├── fixtures/                  # Golden test cards
│   ├── png/
│   ├── charx/
│   ├── voxta/
│   └── json/
├── tasks/                     # Active work tracking
│   └── <task-id>/
│       ├── research.md
│       ├── plan.md
│       └── notes.md
└── docs/
    ├── FORMAT_MATRIX.md       # What converts to what
    └── LOSS_REPORTS.md        # What's lost per conversion
```

---

## 4. File Size Limits

| File Type | Soft Limit | Hard Limit | Action |
|-----------|------------|------------|--------|
| Module source | 200 lines | 400 lines | Split by concept |
| Test files | 300 lines | 500 lines | Split by category |
| Type definitions | 200 lines | 400 lines | Split by domain |

**If approaching soft limit:** Plan the split before hitting hard limit.
**If at hard limit:** Stop. Refactor before adding more code.

---

## 5. Naming Conventions

```typescript
// Functions: verb + noun
parseCard()           ✓
extractFromPNG()      ✓
card()                ✗ (too vague)

// Booleans: is/has/can/should
isValidPNG, hasLorebook, canExport    ✓
valid, lorebook, export               ✗

// Errors: [Context]Error
ParseError, ValidationError, AssetNotFoundError    ✓
Error, BadError                                    ✗

// Types: PascalCase, descriptive
ParseResult, ExportOptions, NormalizedCard    ✓
Result, Options, Card                         ✗ (too generic)
```

---

## 6. Error Handling

### Error Taxonomy

```typescript
// Base class
export class FoundryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FoundryError';
  }
}

// Specific errors
export class ParseError extends FoundryError {
  constructor(message: string, public format?: string) {
    super(message, 'PARSE_ERROR');
  }
}

export class ValidationError extends FoundryError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class AssetNotFoundError extends FoundryError {
  constructor(public uri: string) {
    super(`Asset not found: ${uri}`, 'ASSET_NOT_FOUND');
  }
}

export class FormatNotSupportedError extends FoundryError {
  constructor(public format: string) {
    super(`Format not supported: ${format}`, 'FORMAT_NOT_SUPPORTED');
  }
}
```

### Rules

- Never swallow errors silently
- Include context (what file, what field, what URI)
- Use specific error classes, not generic `Error`
- Re-throw unknown errors after logging

---

## 7. Testing Requirements

### Must Test

- ✅ Format detection (`detectFormat()`)
- ✅ URI normalization (all variants)
- ✅ Parse/export round-trips
- ✅ Error paths (malformed input)
- ✅ Loss reporting (format conversions)

### Test Structure

```typescript
describe('parseCard', () => {
  describe('PNG v2', () => {
    it('extracts card from chara chunk', async () => {
      // Arrange
      const fixture = await loadFixture('png/v2_basic.png');

      // Act
      const result = parseCard(fixture);

      // Assert
      expect(result.spec).toBe('v2');
      expect(result.card.data.name).toBeDefined();
    });

    it('throws ParseError for PNG without card data', async () => {
      const fixture = await loadFixture('png/no_card.png');
      expect(() => parseCard(fixture)).toThrow(ParseError);
    });
  });
});
```

### Fixture Naming

```
fixtures/
├── png/
│   ├── v2_basic.png              # Minimal v2 card
│   ├── v2_lorebook.png           # v2 with character_book
│   ├── v3_basic.png              # Minimal v3 card
│   ├── v3_risu_emotions.png      # v3 with Risu extensions
│   └── no_card.png               # PNG without embedded card
├── charx/
│   ├── v3_minimal.charx          # Just card.json
│   ├── v3_with_assets.charx      # card.json + assets/
│   ├── risu_with_module.charx    # Includes module.risum
│   └── jpeg_hybrid.charx         # JPEG+ZIP format
```

---

## 8. Task Workflow

### Starting a Task

1. **Create task folder:** `tasks/<task-id>/`
2. **Research phase:** Write `research.md` with findings
3. **Planning phase:** Write `plan.md` with steps
4. **Implementation:** Follow plan, track progress
5. **Completion:** Update task status, clean up

### Task ID Format

Semantic names: `add-jpeg-charx-reader`, `fix-uri-normalization`, `refactor-zip-handling`

NOT: `task-1`, `fix-bug`, `update`

### Research Template

```markdown
# Research: <task-id>

## Existing Patterns
- What similar code exists?
- What patterns to follow?

## Files to Modify
- List specific files

## External References
- Docs, specs, examples

## Open Questions
- What needs clarification?
```

### Plan Template

```markdown
# Plan: <task-id>

## Overview
One paragraph summary.

## Steps
1. Step one (specific file, specific function)
2. Step two
3. ...

## Testing
- What tests to add?

## Progress
- [ ] Step one
- [ ] Step two
```

---

## 9. Export Targets

### Supported Targets

| Target | Format | Lossless? | Notes |
|--------|--------|-----------|-------|
| `json_v2` | JSON | From v2: Yes | Preserves source metadata |
| `json_v3` | JSON | From v3: Yes | Preserves source metadata |
| `png_v2` | PNG | From v2: Yes | Requires base image |
| `png_v3` | PNG | From v3: Yes | Requires base image |
| `charx_v3` | ZIP | From v3: Yes | Standard CharX |
| `charx_risu` | ZIP | From Risu: Yes | Includes x_meta, module.risum |
| `voxta_character` | ZIP | No | Lossy, documented |

### Loss Reporting

Every export must check compatibility:

```typescript
const loss = checkExportCompatibility(card, 'voxta_character');
if (loss.lostFields.length > 0) {
  console.warn('Export will lose:', loss.lostFields);
}
```

---

## 10. URI Normalization

### Supported Schemes

| Input | Normalized | Notes |
|-------|------------|-------|
| `embeded://path` | `embeded://path` | Standard (note typo) |
| `embedded://path` | `embeded://path` | Common typo |
| `__asset:N` | `pngchunk:N` | PNG chunk reference |
| `chara-ext-asset_:N` | `pngchunk:N` | Risu variant |
| `chara-ext-asset_N` | `pngchunk:N` | Risu variant (no colon) |
| `ccdefault:` | `ccdefault:` | Use default asset |
| `data:mime;base64,...` | `data:...` | Inline data |
| `https://...` | `https://...` | Remote URL |

### Implementation

```typescript
function normalizeURI(uri: string): ParsedURI {
  const trimmed = uri.trim();

  // Normalize typos
  if (trimmed.startsWith('embedded://')) {
    return parseEmbedded(trimmed.replace('embedded://', 'embeded://'));
  }

  // ... handle all variants
}
```

---

## 11. Security Checklist

Before committing:

- [ ] No hardcoded paths or secrets
- [ ] File paths are sanitized (no path traversal in ZIP)
- [ ] Size limits enforced (50MB per asset, 200MB total)
- [ ] Input validation before processing
- [ ] Errors don't leak internal paths

---

## 12. Common Gotchas

### ZIP Handling

- CharX can be SFX (ZIP appended to other data) — use `findZipStart()`
- JPEG+ZIP hybrid exists — check for JPEG magic before ZIP
- Always check file sizes before extracting

### PNG Chunks

- `tEXt` is uncompressed, `zTXt` is deflate compressed
- Data is base64 encoded in chunks
- Multiple chunks with same keyword can exist — prefer ones with lorebooks

### Voxta

- Requires UUID v4 format — don't use nanoid
- No extensions field — can't round-trip CC metadata
- Character-only for now — packages/scenarios are future

### Risu Extensions

- `emotions` in v2 maps to `assets` in v3
- `depth_prompt` is separate from `system_prompt`
- `module.risum` is binary — preserve as opaque blob

---

## 13. Git Practices

### Commit Messages

```
feat(loader): add JPEG+ZIP hybrid detection
fix(png): handle multiple chara chunks correctly
refactor(core): extract ZIP utilities from charx/voxta
test(charx): add round-trip fixtures for Risu format
docs: update FORMAT_MATRIX with Voxta limitations
```

### Branch Names

```
feat/add-jpeg-charx-reader
fix/uri-normalization-risu
refactor/dedupe-zip-handling
```

---

## 14. When Unsure

1. **Check existing code** — Follow established patterns
2. **Check fixtures** — How do real cards handle this?
3. **Ask in task notes** — Document the question
4. **Default to preservation** — When in doubt, keep the original data

---

## 15. Anti-Entropy Reminders

- "Just add it here for now" → There is no "for now"
- "It's only a few lines" → A few lines becomes a few hundred
- "We'll refactor later" → Later never comes
- File approaching 400 lines? → Stop. Split it now.

**Every commit is a vote for the codebase we want.**
