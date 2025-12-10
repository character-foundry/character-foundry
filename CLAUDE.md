# Character Foundry

Universal TypeScript library for reading, writing, and converting AI character card formats.

## Project Structure

```
packages/
  core/       - Binary utilities, base64, ZIP, URI parsing, UUID, data URLs, security
  schemas/    - CCv2, CCv3, Voxta types + format detection + CardNormalizer
  png/        - PNG chunk handling, metadata stripping, inflate protection
  charx/      - CharX reader/writer, JPEG+ZIP hybrid support
  voxta/      - Voxta packages, multi-character, scenarios, merge utilities
  lorebook/   - Lorebook parsing, extraction, insertion, format conversion
  loader/     - Universal parseCard() with format detection + metadata validation
  exporter/   - Universal exportCard() with loss reporting
  normalizer/ - V2 ↔ V3 ↔ NormalizedCard conversion
  tokenizers/ - GPT-4/LLaMA token counting + card field counting
  media/      - Image format detection, dimensions, thumbnail generation
  federation/ - ActivityPub federation + HTTP signatures + D1 store (experimental, gated)
```

## Commands

```bash
pnpm install     # Install dependencies
pnpm build       # Build all packages
pnpm test        # Run all tests
pnpm typecheck   # TypeScript check
```

## Key Concepts

- **CCv3 is the internal format** - Everything normalizes to CCv3
- **Assets are separate** - parseCard() returns { card, assets, format }
- **Loss detection** - checkExportLoss() before format conversion
- **50MB per-asset limit** - Enforced in all parsers
- **Federation is gated** - Must call enableFederation() explicitly

## Security Features

- **ZIP preflight** - Validates uncompressed sizes before decompression (zip bomb protection)
- **PNG inflate cap** - Limits zTXt/iTXt decompression to 50MB
- **Secure UUID** - crypto.randomUUID() with fallback for non-secure contexts
- **Data URL validation** - Safe parsing with size limits

## Voxta Package Support

Full round-trip editing with delta-based updates:
- `mergeCharacterEdits()` - Apply CCv3 edits preserving Voxta-specific fields
- `applyVoxtaDeltas()` - Update package with minimal changes
- `extractCharacterPackage()` - Extract single character as new package
- `addCharacterToPackage()` - Add character to existing package
- **Export types**: `'package'` | `'scenario'` | `'character'` detection
- **Scenario support**: Full `VoxtaScenario` with Roles[], Events[], Contexts[]

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

## Open Issues

- #3 - Validate RisuAI CharX against SillyTavern
- #5 - CI: Add end-to-end tests

## Publishing

Packages publish to GitHub Packages on push to master. Bump version in package.json to trigger publish.

Current security prerelease branch: `security/phase-0-1-security-and-core`

### Published Versions (security prerelease)

| Package | Version |
|---------|---------|
| `@character-foundry/core` | 0.0.2-security.0 |
| `@character-foundry/schemas` | 0.1.0-security.0 |
| `@character-foundry/png` | 0.0.3-security.0 |
| `@character-foundry/charx` | 0.0.3-security.0 |
| `@character-foundry/voxta` | 0.1.5-security.0 |
| `@character-foundry/loader` | 0.1.6-security.0 |
| `@character-foundry/federation` | 0.1.4-security.0 |
| `@character-foundry/media` | 0.1.0-security.0 |
| `@character-foundry/tokenizers` | 0.1.0-security.0 |

## Docs

See `docs/` for detailed documentation per package.
