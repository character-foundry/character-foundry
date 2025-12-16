# Character Foundry

Universal TypeScript library for reading, writing, and converting AI character card formats.

## Project Structure

```
packages/
  core/       - Binary utilities, base64, ZIP, URI parsing, UUID, data URLs, security
  schemas/    - CCv2, CCv3, Voxta types + Zod runtime validation + format detection
  png/        - PNG chunk handling, metadata stripping, inflate protection
  charx/      - CharX reader/writer, JPEG+ZIP hybrid support
  voxta/      - Voxta packages, multi-character, scenarios, merge utilities
  lorebook/   - Lorebook parsing, extraction, insertion, format conversion
  loader/     - Universal parseCard() with format detection + metadata validation
  exporter/   - Universal exportCard() with loss reporting
  normalizer/ - V2 ↔ V3 ↔ NormalizedCard conversion
  tokenizers/ - GPT-4/LLaMA token counting + card field counting
  media/      - Image format detection, dimensions, thumbnail generation
  image-utils/ - Image URL extraction, SSRF protection, safety validation
  cli/        - Command-line tool: detect, info, validate, loss, export, extract-assets
  federation/ - ActivityPub federation + HTTP signatures + D1 store (gated, opt-in)
  app-framework/ - Schema-driven UI framework: Extension, Registry, AutoForm (React peer dep)
```

## Commands

```bash
pnpm install     # Install dependencies
pnpm build       # Build all packages (tsup: ESM + CJS)
pnpm test        # Run all tests
pnpm typecheck   # TypeScript check
```

## Build Requirements

**CRITICAL: All packages MUST support both ESM and CommonJS (browser + Node.js)**

- All packages use `tsup` for dual ESM/CJS builds
- Package exports must include both `import` and `require` conditions
- tsup.config.ts in each package with `format: ['esm', 'cjs']`
- DO NOT change build to tsc-only - it breaks CJS consumers
- DO NOT remove `require` exports - it breaks Node.js CommonJS users
- **Internal deps use `workspace:^`** - Publishes as semver ranges (e.g., `^0.0.3`), not exact versions
  - DO NOT use `workspace:*` - it publishes exact versions and breaks dep chain

Example package.json exports (REQUIRED pattern):
```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

### External Dependencies (CRITICAL)

**Dependencies with browser/node conditional exports MUST be marked external in tsup.config.ts**

If bundled, tsup/esbuild will inline the Node.js version, breaking browser builds with errors like:
```
Uncaught TypeError: (0 , a.createRequire) is not a function
```

**Currently externalized:**
- `fflate` - Used by: core, png, charx, voxta

**tsup.config.ts pattern:**
```typescript
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Keep deps with browser/node conditional exports external
  external: ['fflate'],
});
```

**When adding a new dependency that has conditional exports:**
1. Add it to `external` array in tsup.config.ts
2. Verify with: `grep -l "createRequire" packages/*/dist/*` (should return nothing)
3. Consumer's bundler will resolve the correct browser/node version

## Key Concepts

- **CCv3 is the internal format** - Everything normalizes to CCv3
- **Assets are separate** - parseCard() returns { card, assets, format }
- **Loss detection** - checkExportLoss() before format conversion
- **50MB per-asset limit** - Enforced in all parsers
- **Federation is gated** - Must call enableFederation() explicitly
- **Runtime validation** - Zod schemas available for all core types (CCv2, CCv3, assets)

## Security Features

### Core (Both Modes)

- **Streaming ZIP protection** - Tracks actual decompressed bytes during extraction, aborts if limits exceeded (protects against crafted archives that lie in central directory)
- **Path traversal protection** - Configurable `unsafePathHandling`: `'skip'` (default), `'warn'`, `'reject'`
- **PNG inflate cap** - Limits zTXt/iTXt decompression to 50MB
- **Secure UUID** - crypto.randomUUID() with fallback for non-secure contexts
- **Data URL validation** - Safe parsing with size limits
- **Dual-package safe errors** - `isFoundryError()` uses Symbol.for() marker for cross-module compatibility

### Federation (Full Mode Only)

- **HTTP signature strict mode** - Opt-in enforcement of `(request-target)`, `host`, `date` headers
- **Secure hashing** - Opt-in SHA-256 for change detection (vs default 32-bit fast hash)
- **SSRF protection** - Resource ID validation prevents path traversal and protocol injection
- **Sync mutex** - Prevents concurrent `syncAll()` overlapping

## Voxta Package Support

Full round-trip editing with delta-based updates:
- `mergeCharacterEdits()` - Apply CCv3 edits preserving Voxta-specific fields
- `applyVoxtaDeltas()` - Update package with minimal changes
- `extractCharacterPackage()` - Extract single character as new package
- `addCharacterToPackage()` - Add character to existing package
- **Export types**: `'package'` | `'scenario'` | `'character'` detection
- **Scenario support**: Full `VoxtaScenario` with Roles[], Events[], Contexts[]

## CLI Tool

The `@character-foundry/cli` package provides a command-line interface for working with character cards.

**Installation:**
```bash
npm install -g @character-foundry/cli
# or use directly
npx @character-foundry/cli detect card.png
```

**Commands:**
```bash
cf detect <file>              # Detect format and display basic info
cf info <file>                # Full metadata with token counts
cf validate <file>            # Schema validation with exit codes
cf loss <file> --to <format>  # Preview data loss before conversion
cf export <file> --to <fmt>   # Export to png/charx/voxta
cf extract-assets <file>      # Extract all assets with manifest
cf optimize <file>            # Compress images/audio/video in packages
cf scan <directory>           # Scan directory, categorize cards by format/issues
```

**Exit Codes:**
- 0: Success
- 1: General error (IO, unexpected)
- 2: Validation error
- 3: Parse error
- 4: Unsupported format

**Options:**
- `--json` - Output as JSON for scripting
- `-q, --quiet` - Suppress non-essential output
- `--tokenizer <id>` - Tokenizer for info command (default: gpt-4)

## Test Cards

`.test_cards/` contains real voxpkg files for manual testing (gitignored).

## Federation Storage

D1SyncStateStore for Cloudflare Workers production deployment:
- `D1SyncStateStore` - SQLite-based sync state storage for Cloudflare D1
- `init()` - Creates table schema (idempotent)
- `findByLocalId()` / `findByPlatformId()` - Lookup helpers
- `listByStatus()` - Filter states by sync status
- `count()` / `clear()` - Utilities for management

## Server-side Validation

Metadata validation for optimistic UI with server authority:
- `validateClientMetadata()` - Validates client metadata against parsed card
- `computeContentHash()` - SHA-256 content hash for deduplication
- Token tolerance configuration (default 5%)
- Tag validation callback support
- Returns authoritative values + discrepancies

## Runtime Validation with Zod

The `@character-foundry/schemas` package now includes comprehensive Zod schemas for runtime validation:

**Available Schemas:**
- `CCv3DataSchema` - Full v3 card structure
- `CCv2DataSchema` / `CCv2WrappedSchema` - v2 card formats
- `AssetDescriptorSchema` - Asset metadata validation
- `SpecSchema`, `SourceFormatSchema`, `AssetTypeSchema` - Enum schemas

**Usage:**
```typescript
import { CCv3DataSchema, parseV3Card, isV3Card } from '@character-foundry/schemas';

// Type guard using Zod
if (isV3Card(data)) {
  // data is CCv3Data (validated at runtime)
}

// Parse with validation
try {
  const card = parseV3Card(unknownData);
  // card is guaranteed valid CCv3Data
} catch (err) {
  // Detailed Zod validation errors
}

// Safe parse with error details
import { safeParse } from '@character-foundry/schemas';
const result = safeParse(CCv3DataSchema, data);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error, result.field);
}
```

**Type Inference Pattern:**
All TypeScript types are inferred from Zod schemas using `z.infer<>`, ensuring type-schema sync.

## Open Issues

- #3 - Validate RisuAI CharX against SillyTavern
- #5 - CI: Add end-to-end tests
- #15 - Runtime validation (Phase 1 ✅ complete, Phase 2-4 pending)

## Publishing

**SIMPLIFIED ARCHITECTURE**: Only TWO packages are published to npm:
- `@character-foundry/character-foundry` - Bundled library with all functionality via subpath exports
- `@character-foundry/cli` - Command-line tool

All other packages (core, schemas, png, etc.) are **private workspace packages** - they exist for internal organization but are NOT published. The `character-foundry` package bundles everything into a single distributable.

### Usage for Consumers

```bash
# Install the main library
npm install @character-foundry/character-foundry

# Or install the CLI
npm install -g @character-foundry/cli
```

```typescript
// Import from subpaths - all functionality is bundled
import { parseCard } from '@character-foundry/character-foundry/loader';
import { exportCard } from '@character-foundry/character-foundry/exporter';
import { CCv3Data } from '@character-foundry/character-foundry/schemas';
```

### Version Bumping

**Simple rule**: Only bump `character-foundry` and/or `cli` when making changes.

1. Make your changes to any package(s)
2. Bump version in `packages/character-foundry/package.json` (or `packages/cli/package.json`)
3. Run `pnpm build && pnpm test`
4. Commit and push

No more cascading version bumps across 10+ packages!

### Release Checklist

1. [ ] `pnpm build` - Build all packages
2. [ ] `pnpm test` - Run all tests
3. [ ] Bump version in `packages/character-foundry/package.json` and/or `packages/cli/package.json`
4. [ ] Update version table below
5. [ ] `git push origin master` - Triggers publish workflow

### Published Versions

| Package | Version |
|---------|---------|
| `@character-foundry/character-foundry` | 0.1.5 |
| `@character-foundry/cli` | 0.3.1 |

### Authentication

- GitHub Actions uses `NPM_PUBLISH_TOKEN` secret (npm automation token)
- Token generated at: https://www.npmjs.com/settings/YOUR_USERNAME/tokens

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 403 on publish | NPM_PUBLISH_TOKEN missing/expired | Regenerate token, update GitHub secret |
| 404 on install | Package not yet published | Push to master to trigger publish |
| Version conflict | Version already exists on npm | Bump version in package.json |

## Docs

See `docs/` for detailed documentation per package.
