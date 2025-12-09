# Character Foundry

Universal TypeScript library for reading, writing, and converting AI character card formats.

## Project Structure

```
packages/
  core/       - Binary utilities, base64, ZIP, URI parsing, errors
  schemas/    - CCv2, CCv3, Voxta types + format detection
  png/        - PNG chunk handling, metadata stripping
  charx/      - CharX reader/writer, JPEG+ZIP hybrid support
  voxta/      - Voxta packages, multi-character, merge utilities
  lorebook/   - Lorebook parsing, extraction, insertion, format conversion
  loader/     - Universal parseCard() with format detection
  exporter/   - Universal exportCard() with loss reporting
  normalizer/ - V2 ↔ V3 ↔ NormalizedCard conversion
  tokenizers/ - GPT-4/LLaMA token counting
  federation/ - ActivityPub federation (experimental, gated)
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

## Test Cards

`.test_cards/` contains real voxpkg files for manual testing (gitignored).

## Open Issues

- #1 - Voxta Package Round-Trip (in progress)
- #3 - Validate RisuAI CharX against SillyTavern
- #5 - CI: Add end-to-end tests

## Publishing

Packages publish to GitHub Packages on push to master. Bump version in package.json to trigger publish.

## Docs

See `docs/` for detailed documentation per package.
