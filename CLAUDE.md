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
  loader/     - Universal parseCard() with format detection
  exporter/   - Universal exportCard() with loss reporting
  normalizer/ - V2 ↔ V3 ↔ NormalizedCard conversion
  tokenizers/ - GPT-4/LLaMA token counting + card field counting
  media/      - Image format detection, dimensions, thumbnail generation
  federation/ - ActivityPub federation + HTTP signatures (experimental, gated)
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

## Open Issues

- #3 - Validate RisuAI CharX against SillyTavern
- #5 - CI: Add end-to-end tests
- #10 - D1SyncStateStore for Cloudflare federation
- #13 - Server-side metadata validation

## Publishing

Packages publish to GitHub Packages on push to master. Bump version in package.json to trigger publish.

Current security prerelease branch: `security/phase-0-1-security-and-core`

## Docs

See `docs/` for detailed documentation per package.
