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
  federation/ - ActivityPub federation + HTTP signatures + D1 store (experimental, gated)
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

## Key Concepts

- **CCv3 is the internal format** - Everything normalizes to CCv3
- **Assets are separate** - parseCard() returns { card, assets, format }
- **Loss detection** - checkExportLoss() before format conversion
- **50MB per-asset limit** - Enforced in all parsers
- **Federation is gated** - Must call enableFederation() explicitly
- **Runtime validation** - Zod schemas available for all core types (CCv2, CCv3, assets)

## Security Features

- **Streaming ZIP protection** - Tracks actual decompressed bytes during extraction, aborts if limits exceeded (protects against crafted archives that lie in central directory)
- **PNG inflate cap** - Limits zTXt/iTXt decompression to 50MB
- **Secure UUID** - crypto.randomUUID() with fallback for non-secure contexts
- **Data URL validation** - Safe parsing with size limits
- **Dual-package safe errors** - `isFoundryError()` uses Symbol.for() marker for cross-module compatibility

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

Packages publish to GitHub Packages on push to master. Bump version in package.json to trigger publish.

**CRITICAL: GitHub Actions uses `NPM_TOKEN` secret (NOT `GITHUB_TOKEN`)**
- GitHub rejects secrets starting with `GITHUB_` prefix
- The PAT with `write:packages` scope is stored as `NPM_TOKEN`
- DO NOT change the workflow to use `GITHUB_TOKEN` or `secrets.GITHUB_*`
- If publish fails with 403, check that `NPM_TOKEN` secret exists and workflow uses it

### When to Bump Versions - FOOLPROOF GUIDE

**BEFORE making ANY changes to a package, determine what version bump is needed:**

#### Step 1: What kind of change are you making?

**Bug fix / security fix / internal refactor (NO public API changes):**
- Bump PATCH version (0.0.X)
- Example: `0.0.3` → `0.0.4`
- Dependents automatically pick this up via `^0.0.3` range

**New export / new function / new feature (backwards compatible):**
- Bump MINOR version (0.X.0)
- Example: `0.0.3` → `0.1.0`
- Dependents automatically pick this up via `^0.0.3` range
- **IF dependent packages use the new feature, bump them too**

**Breaking change / removed export / changed signature:**
- Bump MAJOR version (X.0.0)
- Example: `0.0.3` → `1.0.0` (or `0.3.0` if using 0.x convention)
- **MUST bump ALL dependent packages** - they will break with the old version

#### Step 2: Did you add a NEW export to core or schemas?

**Example: Adding `streamingUnzipSync` to `@character-foundry/core`**

1. **Check if any packages already import it** (common mistake):
   ```bash
   grep -r "streamingUnzipSync" packages/*/src --include="*.ts"
   ```

2. **If packages already import it but it doesn't exist in published version:**
   - This is a version drift bug - the code imports something unpublished
   - Bump core IMMEDIATELY (MINOR version: `0.0.3` → `0.1.0`)
   - Update version tables in CLAUDE.md and README.md
   - Commit and push to publish

3. **If no one imports it yet:**
   - Safe to bump MINOR version when you're ready
   - Bump core when you add the export, not when dependents use it

#### Step 3: Verify version consistency

**Run this check BEFORE committing:**
```bash
# Check that all imports exist in published versions
pnpm build && pnpm test
```

**If tests pass but you get "cannot find module" in production:**
- You have version drift - an import exists in local code but not in published version
- Find the missing export: `git log -p -- packages/PACKAGE/src/index.ts`
- Bump the package that should export it

#### Common Mistakes

❌ **Adding a function to `core` without bumping version**
- Dependents import it locally (works)
- Published version doesn't have it (breaks)
- **Fix:** Bump core IMMEDIATELY when adding exports

❌ **Forgetting that `workspace:^` only works for PUBLISHED versions**
- Local dev uses workspace code (latest)
- Production uses `^0.0.3` semver range (published only)
- **Fix:** Always bump before pushing if you added exports

❌ **Bumping dependents but not the provider**
- `voxta@0.1.8` imports from `core@^0.0.3`
- But `streamingUnzipSync` was never in published `core@0.0.3`
- **Fix:** Bump core FIRST, then push

### Version Bump Workflow

**When you add/change exports in a package:**

1. Immediately bump the package version:
   - New export/feature: bump MINOR (`0.0.3` → `0.1.0`)
   - Bug fix: bump PATCH (`0.0.3` → `0.0.4`)
   - Breaking change: bump MAJOR (`0.0.3` → `1.0.0`)

2. Update version tables:
   - CLAUDE.md "Published Versions" table
   - README.md "Packages" table

3. Run verification:
   ```bash
   pnpm build
   pnpm test
   pnpm verify-build
   ```

4. Commit and push:
   ```bash
   git add packages/PACKAGE/package.json CLAUDE.md README.md
   git commit -m "chore(PACKAGE): bump to X.Y.Z"
   git push origin master
   ```

5. Wait for GitHub Actions to publish

6. **ONLY THEN** can dependents safely import the new exports

### Release Checklist

**FOLLOW THIS EVERY TIME before pushing version bumps:**

1. [ ] `pnpm build` - Ensure all packages build with tsup (ESM + CJS)
2. [ ] `pnpm test` - Ensure all tests pass
3. [ ] `pnpm verify-build` - Automated ESM/CJS import verification for all packages
4. [ ] Bump version ONLY for the changed package (workspace:^ handles deps automatically)
   - Patch bump (0.0.x): Bug fixes, no API changes - dependents auto-accept via `^`
   - Minor bump (0.x.0): New features, backwards compatible - dependents need bump if using new features
   - Major bump (x.0.0): Breaking changes - ALL dependents MUST be bumped
5. [ ] Verify package.json has BOTH `import` AND `require` exports (see Build Requirements)
6. [ ] Update version table below
7. [ ] Update README.md package versions table
8. [ ] `git push origin master` - Triggers publish workflow
9. [ ] Verify workflow succeeds in GitHub Actions (includes verify-build step)
10. [ ] If workflow fails, check `NPM_TOKEN` secret and fix WITHOUT changing to `GITHUB_TOKEN`
11. [ ] **NEW PACKAGES ONLY**: Verify visibility=public and repo linked (see Troubleshooting below)

### Published Versions

| Package | Version |
|---------|---------|
| `@character-foundry/character-foundry` | 0.1.1 |
| `@character-foundry/core` | 0.0.4 |
| `@character-foundry/schemas` | 0.2.0 |
| `@character-foundry/png` | 0.0.4 |
| `@character-foundry/charx` | 0.0.4 |
| `@character-foundry/exporter` | 0.1.2 |
| `@character-foundry/normalizer` | 0.1.2 |
| `@character-foundry/lorebook` | 0.0.2 |
| `@character-foundry/voxta` | 0.1.8 |
| `@character-foundry/loader` | 0.1.8 |
| `@character-foundry/federation` | 0.1.6 |
| `@character-foundry/media` | 0.1.1 |
| `@character-foundry/tokenizers` | 0.1.1 |
| `@character-foundry/app-framework` | 0.1.0 |

### Publishing Troubleshooting

**CRITICAL: New packages publish as "internal" with no repo link by default. This breaks CI.**

#### Verify Package Health

Run this command to check all packages:
```bash
gh api "/orgs/character-foundry/packages?package_type=npm" --jq '.[] | {name: .name, visibility: .visibility, repo: .repository.full_name}'
```

**All packages MUST show:**
- `visibility: "public"` (NOT "internal")
- `repo: "character-foundry/character-foundry"` (NOT null)

#### Fix Broken Package (Manual UI Required)

If a package shows `visibility: "internal"` or `repo: null`:

1. Go to: `https://github.com/orgs/character-foundry/packages/npm/package/PACKAGE_NAME/settings`
2. Change **Visibility** from "Internal" → "Public"
3. Under **Link to source repository** → Select `character-foundry/character-foundry`
4. Save changes

#### After Publishing a NEW Package

**IMMEDIATELY after first publish:**
1. Run the verify command above
2. Check the new package shows `public` + linked repo
3. If not, fix via UI settings (gh CLI needs write:packages scope which we don't have)

#### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 403 on publish | NPM_TOKEN missing/expired | Regenerate PAT, update secret |
| Package not installable | visibility: "internal" | Change to "public" in UI |
| Package shows in wrong org | Wrong registry URL | Check .npmrc and package.json |
| CI fails after new package | Package created as "internal" | Fix visibility + link repo in UI |

#### Why This Happens

GitHub Packages creates new packages with:
- `visibility: "internal"` (org-only access)
- `repository: null` (not linked to source)

This is a GitHub default, not something we control in the workflow. The PAT token can publish, but the package inherits org defaults which are restrictive.

## Docs

See `docs/` for detailed documentation per package.
